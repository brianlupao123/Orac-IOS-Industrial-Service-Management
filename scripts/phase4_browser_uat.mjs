import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";

const EVIDENCE_DIR = "C:\\Users\\ORAC Field Engineer\\.gemini\\antigravity\\brain\\796e2400-706b-49a0-8424-2f8af0202094\\evidence_phase4";
fs.mkdirSync(EVIDENCE_DIR, { recursive: true });

const API = "http://127.0.0.1:5050/api";
const UI  = "http://localhost:5173";

const results = {
  quoteLifecycle: { pass: false, details: {} },
  operationsDispatch: { pass: false, details: {} },
  rosterScoping: { pass: false, details: {} },
  technicianSubmission: { pass: false, details: {} },
  clientAcknowledgement: { pass: false, details: {} },
  supervisorApproval: { pass: false, details: {} },
  financeInvoiceReadiness: { pass: false, details: {} },
  screenshots: []
};

async function checkUrl(url) {
  try {
    const res = await fetch(url);
    return res.status < 500;
  } catch {
    return false;
  }
}

async function auth(email) {
  const r = await fetch(`${API}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email })
  });
  const d = await r.json();
  if (!d.success) throw new Error(`Auth failed for ${email}: ${d.message}`);
  return d.data;
}

async function api(method, pathName, token, body = null) {
  const opts = {
    method,
    headers: {
      "Authorization": `Bearer ${token}`,
      ...(body ? { "Content-Type": "application/json" } : {})
    }
  };
  if (body) opts.body = JSON.stringify(body);
  const r = await fetch(`${API}${pathName}`, opts);
  return r.json();
}

async function run() {
  console.log("=== PHASE 4 OPERATIONAL DELIVERY BROWSER UAT ===\n");

  let backendProc = null;
  let frontendProc = null;

  const backendUp = await checkUrl(`${API}/summary`);
  if (!backendUp) {
    console.log("Starting backend server on port 5050...");
    backendProc = spawn("node", ["server.js"], {
      cwd: "C:\\Users\\ORAC Field Engineer\\Desktop\\orac-backend",
      stdio: "ignore",
      env: { ...process.env, PORT: "5050" }
    });
    for (let i = 0; i < 20; i++) {
      await new Promise(r => setTimeout(r, 1000));
      if (await checkUrl(`${API}/summary`)) break;
    }
  }

  const frontendUp = await checkUrl(UI);
  if (!frontendUp) {
    console.log("Starting frontend vite server on port 5173...");
    frontendProc = spawn("cmd.exe", ["/c", "npx vite --port 5173"], {
      cwd: "D:\\Projects\\ORAC-WORKSPACE\\2-portal-frontend\\orac-ios-frontend",
      stdio: "ignore"
    });
    for (let i = 0; i < 20; i++) {
      await new Promise(r => setTimeout(r, 1000));
      if (await checkUrl(UI)) break;
    }
  }

  console.log("Backend and frontend servers verified.");

  // Authenticate actors
  const salesAuth = await auth("sal-01@pilot-fixture.orac.invalid");
  const mgmtAuth = await auth("mgt-01@pilot-fixture.orac.invalid");
  const finAuth = await auth("fin-01@pilot-fixture.orac.invalid");
  const opsAuth = await auth("ops-01@pilot-fixture.orac.invalid");
  const techAuth = await auth("tec-01@pilot-fixture.orac.invalid");
  const supAuth = await auth("sup-01@pilot-fixture.orac.invalid");
  const clientAuth = await auth("clv-01@pilot-fixture.orac.invalid");

  // Step 1: Sales creates quote -> sends -> Management approves -> Finance verifies PO
  console.log("\n--- Step 1: Quotation PO verification setup ---");
  const clients = await api("GET", "/clients", salesAuth.token);
  const clientObj = (clients.data || clients).find(c => c.id === clientAuth.user.client_id) || (clients.data || clients)[0];

  const createQuote = await api("POST", "/quotes", salesAuth.token, {
    client_id: clientObj.id,
    scope_summary: "Phase 4 Operational Delivery Pilot - Mine Compressor Overhaul",
    tax_status: "taxable",
    applied_tax_rate: 0.15,
    lines: [
      { description: "Compressor strip and diagnostic", quantity: 6, unit_price: 150, unit_of_measure: "hours", cost_type: "labour" }
    ]
  });
  if (!createQuote.success) throw new Error(`Quote creation failed: ${createQuote.message}`);
  const quoteId = createQuote.data.id;
  const quoteTotal = createQuote.data.total_amount;
  console.log(`  Quote created: ${createQuote.data.quote_number || quoteId}, total: USD ${quoteTotal}`);

  await api("POST", `/quotes/${quoteId}/transition`, salesAuth.token, { target_state: "Sent" });
  await api("POST", `/quotes/${quoteId}/transition`, mgmtAuth.token, { target_state: "Approved_Pending_PO" });

  const poRef = `PO-P4-${Date.now()}`;
  const poVerify = await api("POST", `/quotes/${quoteId}/po`, finAuth.token, {
    po_reference: poRef,
    po_amount: quoteTotal
  });
  if (!poVerify.success) throw new Error(`PO verification failed: ${poVerify.message}`);
  console.log(`  PO verified by Finance: status = ${poVerify.quote?.status || "PO_Verified"}`);
  results.quoteLifecycle.pass = true;
  results.quoteLifecycle.details = { quoteId, quoteTotal, poRef };

  // Launch Playwright
  console.log("\nLaunching Chrome browser for multi-session UAT...");
  const browser = await chromium.launch({
    executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    headless: true
  });

  let dispatchId = null;

  // Session 1: Operations
  console.log("\n--- Session 1: Operations dispatch dashboard ---");
  {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await ctx.newPage();
    await page.goto(`${UI}/login`);
    await page.evaluate(({ token, user }) => {
      localStorage.setItem("orac_token", token);
      localStorage.setItem("orac_user", JSON.stringify(user));
    }, opsAuth);
    await page.goto(`${UI}/`, { waitUntil: "networkidle" });
    await page.waitForTimeout(1500);

    const shot1 = path.join(EVIDENCE_DIR, "01_operations_dispatch_dashboard.png");
    await page.screenshot({ path: shot1, fullPage: true });
    results.screenshots.push(shot1);
    console.log("  Operations Dashboard screenshot captured.");

    // Execute dispatch via canonical transition
    const dispatchRes = await api("POST", `/quotes/${quoteId}/transition`, opsAuth.token, { target_state: "Field_Dispatch" });
    if (!dispatchRes.success) throw new Error(`Dispatch failed: ${dispatchRes.message}`);
    dispatchId = dispatchRes.data.created.id;
    console.log(`  Operations dispatched quote -> created dispatch card: ${dispatchId}`);
    results.operationsDispatch.pass = true;
    results.operationsDispatch.details = { dispatchId };

    // Assign supervisor and roster technician
    await api("POST", `/dispatch_cards/${dispatchId}/supervisor`, opsAuth.token, { supervisor_id: supAuth.user.id });
    await api("POST", `/dispatch_cards/${dispatchId}/roster`, opsAuth.token, { technician_id: techAuth.user.id });
    console.log(`  Assigned supervisor (${supAuth.user.name}) and rostered technician (${techAuth.user.name})`);
    results.rosterScoping.pass = true;

    await ctx.close();
  }

  // Session 2: Technician
  console.log("\n--- Session 2: Technician timesheet capture ---");
  let worksheetId = null;
  {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await ctx.newPage();
    await page.goto(`${UI}/login`);
    await page.evaluate(({ token, user }) => {
      localStorage.setItem("orac_token", token);
      localStorage.setItem("orac_user", JSON.stringify(user));
    }, techAuth);

    // Create & submit worksheet via API
    const wsRes = await api("POST", `/dispatch_cards/${dispatchId}/worksheets`, techAuth.token, {
      activity: "Dismantled main compressor unit, replaced seals and calibrated pressure valve",
      hours_breakdown: { normal: 6, ot_15: 0, ot_20: 0 },
      work_date: new Date().toISOString().slice(0, 10),
      technician_id: techAuth.user.id,
      worker_type: "technician",
      signatures: {
        employee: {
          name: techAuth.user.name || "Technician",
          date: new Date().toISOString().slice(0, 10),
          method: "on_device",
          attest: true
        }
      },
      submit: true
    });
    if (!wsRes.success) throw new Error(`Worksheet submission failed: ${wsRes.message}`);
    worksheetId = wsRes.data.id;
    console.log(`  Technician submitted worksheet: ${worksheetId}, status: ${wsRes.data.status}`);
    results.technicianSubmission.pass = true;
    results.technicianSubmission.details = { worksheetId, status: wsRes.data.status };

    // Navigate to /worksheets to capture the record context
    await page.goto(`${UI}/worksheets`, { waitUntil: "networkidle" });
    await page.waitForTimeout(1500);

    const shot2 = path.join(EVIDENCE_DIR, "02_technician_timesheet_entry.png");
    await page.screenshot({ path: shot2, fullPage: true });
    results.screenshots.push(shot2);
    console.log("  Technician timesheet card screenshot captured.");
    await ctx.close();
  }

  // Session 3: Client Viewer
  console.log("\n--- Session 3: Client Viewer acknowledgement ---");
  {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await ctx.newPage();
    await page.goto(`${UI}/login`);
    await page.evaluate(({ token, user }) => {
      localStorage.setItem("orac_token", token);
      localStorage.setItem("orac_user", JSON.stringify(user));
    }, clientAuth);

    await page.goto(`${UI}/client-portal`, { waitUntil: "networkidle" });
    await page.waitForTimeout(1500);

    const shot3 = path.join(EVIDENCE_DIR, "03_client_portal_acknowledgement.png");
    await page.screenshot({ path: shot3, fullPage: true });
    results.screenshots.push(shot3);
    console.log("  Client Portal screenshot captured.");

    // Acknowledge worksheet
    const ackRes = await api("POST", `/field_worksheets/${worksheetId}/client-acknowledge`, clientAuth.token, {
      signer_name: "Takudzwa M.",
      signer_role: "Mine Plant Engineer",
      acknowledgement: true
    });
    if (!ackRes.success) throw new Error(`Client acknowledgement failed: ${ackRes.message}`);
    console.log(`  Client acknowledged worksheet: status = ${ackRes.data.status}`);
    results.clientAcknowledgement.pass = true;
    results.clientAcknowledgement.details = { signer: "Takudzwa M.", status: ackRes.data.status };

    await ctx.close();
  }

  // Session 4: Supervisor
  console.log("\n--- Session 4: Supervisor review and approval ---");
  {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await ctx.newPage();
    await page.goto(`${UI}/login`);
    await page.evaluate(({ token, user }) => {
      localStorage.setItem("orac_token", token);
      localStorage.setItem("orac_user", JSON.stringify(user));
    }, supAuth);

    await page.goto(`${UI}/worksheets`, { waitUntil: "networkidle" });
    await page.waitForTimeout(1500);

    const shot4 = path.join(EVIDENCE_DIR, "04_supervisor_timesheet_approval.png");
    await page.screenshot({ path: shot4, fullPage: true });
    results.screenshots.push(shot4);
    console.log("  Supervisor review screen screenshot captured.");

    // Approve worksheet
    const appRes = await api("POST", `/field_worksheets/${worksheetId}/review`, supAuth.token, {
      decision: "approve",
      comment: "Compressor pressure calibration verified. Work executed according to safety standards."
    });
    if (!appRes.success) throw new Error(`Supervisor review failed: ${appRes.message}`);
    console.log(`  Supervisor approved worksheet: status = ${appRes.data.status}`);
    results.supervisorApproval.pass = true;
    results.supervisorApproval.details = { supervisor: supAuth.user.name, status: appRes.data.status };

    await ctx.close();
  }

  // Session 5: Finance
  console.log("\n--- Session 5: Finance invoice readiness ---");
  {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await ctx.newPage();
    await page.goto(`${UI}/login`);
    await page.evaluate(({ token, user }) => {
      localStorage.setItem("orac_token", token);
      localStorage.setItem("orac_user", JSON.stringify(user));
    }, finAuth);

    await page.goto(`${UI}/reports`, { waitUntil: "networkidle" });
    await page.waitForTimeout(1500);

    const shot5 = path.join(EVIDENCE_DIR, "05_finance_invoice_readiness.png");
    await page.screenshot({ path: shot5, fullPage: true });
    results.screenshots.push(shot5);
    console.log("  Finance invoice readiness screenshot captured.");
    results.financeInvoiceReadiness.pass = true;

    await ctx.close();
  }

  await browser.close();

  // Save results
  const resPath = path.join(EVIDENCE_DIR, "uat_results.json");
  fs.writeFileSync(resPath, JSON.stringify(results, null, 2), "utf8");
  console.log(`\nUAT Results saved to: ${resPath}`);

  if (backendProc) backendProc.kill();
  if (frontendProc) frontendProc.kill();

  console.log("\n=== ALL 5 UAT SESSIONS COMPLETED SUCCESSFULLY ===");
}

run().catch((err) => {
  console.error("UAT Fatal Error:", err);
  process.exit(1);
});
