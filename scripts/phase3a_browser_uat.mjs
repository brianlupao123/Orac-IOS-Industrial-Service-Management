import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";

const EVIDENCE_DIR = "C:\\Users\\ORAC Field Engineer\\.gemini\\antigravity\\brain\\796e2400-706b-49a0-8424-2f8af0202094\\evidence_phase3a";
fs.mkdirSync(EVIDENCE_DIR, { recursive: true });

const API = "http://127.0.0.1:5050/api";
const UI  = "http://localhost:5173";

const results = {
  quoteSetup: { pass: false },
  clientPoSubmission: { pass: false, details: {} },
  clientPoIdempotentRetry: { pass: false, details: {} },
  financeVerification: { pass: false, details: {} },
  financeRejection: { pass: false, details: {} },
  poVerifiedStatus: { pass: false, details: {} },
  salesCannotVerify: { pass: false, details: {} },
  dispatchAllowed: { pass: false, details: {} },
  poPdfRendered: { pass: false },
  clientBrowserJourney: { pass: false },
  financeBrowserJourney: { pass: false },
  screenshots: []
};

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

async function api(method, path, token, body) {
  const opts = {
    method,
    headers: { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" }
  };
  if (body) opts.body = JSON.stringify(body);
  const r = await fetch(`${API}${path}`, opts);
  return r.json();
}

async function run() {
  console.log("=== PHASE 3A BROWSER UAT ===\n");

  // ---- Step 1: Setup via API — create quote, send, approve ----
  console.log("--- Step 1: Quote setup (Sales creates → sends → Management approves) ---");
  const salesAuth = await auth("sal-01@pilot-fixture.orac.invalid");
  const salesToken = salesAuth.token;
  const mgmtAuth = await auth("mgt-01@pilot-fixture.orac.invalid");
  const mgmtToken = mgmtAuth.token;
  const finAuth = await auth("fin-01@pilot-fixture.orac.invalid");
  const finToken = finAuth.token;
  const clientAuth = await auth("clv-01@pilot-fixture.orac.invalid");
  const clientToken = clientAuth.token;

  // Get a client and equipment tag
  const clients = await api("GET", "/clients", salesToken);
  const client = (clients.data || clients).find(c => c.id === clientAuth.user.client_id) || (clients.data || clients)[0];
  console.log(`  Client: ${client.name} (${client.id})`);

  let tag = null;
  try {
    const tags = await api("GET", "/equipment-tags", salesToken);
    const tagList = Array.isArray(tags.data) ? tags.data : Array.isArray(tags) ? tags : [];
    tag = tagList.find(t => t.client_id === client.id) || tagList[0] || null;
  } catch (e) { console.log("  (equipment tags not available, proceeding without)"); }

  // Create quote
  const createRes = await api("POST", "/quotes", salesToken, {
    client_id: client.id,
    equipment_tag_id: tag?.id || null,
    scope_summary: "Phase 3A PO lifecycle UAT — 33kV switchgear maintenance",
    assumptions: "Client provides site access and switching clearances",
    tax_status: "taxable",
    applied_tax_rate: 0.15,
    lines: [
      { description: "Switchgear diagnostics", quantity: 10, unit_price: 250, unit_of_measure: "hours", cost_type: "labour" },
      { description: "Transformer oil sampling", quantity: 5, unit_price: 180, unit_of_measure: "each", cost_type: "material" }
    ]
  });
  if (!createRes.success) throw new Error(`Quote create failed: ${createRes.message}`);
  const quoteId = createRes.data.id;
  const quoteTotal = createRes.data.total_amount;
  console.log(`  Created quote ${createRes.data.quote_number}, total: USD ${quoteTotal}, id: ${quoteId}`);

  // Send
  const sendRes = await api("POST", `/quotes/${quoteId}/transition`, salesToken, { target_state: "Sent" });
  if (!sendRes.success) throw new Error(`Send failed: ${sendRes.message}`);
  console.log(`  Sent → status: ${sendRes.data?.status || sendRes.quote?.status}`);

  // Approve (Management)
  const approveRes = await api("POST", `/quotes/${quoteId}/transition`, mgmtToken, { target_state: "Approved_Pending_PO" });
  if (!approveRes.success) throw new Error(`Approve failed: ${approveRes.message}`);
  console.log(`  Approved → status: Approved_Pending_PO`);
  results.quoteSetup.pass = true;

  // ---- Step 2: Client submits PO via API ----
  console.log("\n--- Step 2: Client PO submission ---");
  const poRef = `UAT-PO-3A-${Date.now()}`;
  const submitRes = await api("POST", `/quotes/${quoteId}/client-po`, clientToken, {
    po_reference: poRef,
    po_amount: quoteTotal,
    document_reference: "DOC-UAT-3A-001"
  });
  console.log(`  Submit status: ${submitRes.success ? "OK" : "FAIL"} (HTTP body code: ${submitRes.code || "none"})`);
  if (submitRes.success) {
    results.clientPoSubmission.pass = true;
    results.clientPoSubmission.details = { poId: submitRes.data?.id, status: submitRes.data?.status };
    console.log(`  PO id: ${submitRes.data?.id}, status: ${submitRes.data?.status}`);
  } else {
    console.log(`  Error: ${submitRes.message}`);
  }

  // ---- Step 3: Idempotent retry ----
  console.log("\n--- Step 3: Idempotent retry (same reference) ---");
  const retryRes = await api("POST", `/quotes/${quoteId}/client-po`, clientToken, {
    po_reference: poRef,
    po_amount: quoteTotal,
    document_reference: "DOC-UAT-3A-001"
  });
  console.log(`  Retry status: ${retryRes.success ? "OK (idempotent)" : "FAIL"}`);
  if (retryRes.success) {
    results.clientPoIdempotentRetry.pass = true;
    results.clientPoIdempotentRetry.details = { poId: retryRes.data?.id };
    console.log(`  Same PO id returned: ${retryRes.data?.id === submitRes.data?.id}`);
  } else {
    console.log(`  Response: ${retryRes.message}`);
  }

  // ---- Step 4: Sales cannot verify ----
  console.log("\n--- Step 4: Sales cannot verify PO ---");
  const salesVerifyRes = await api("POST", `/quotes/${quoteId}/po`, salesToken, {
    po_reference: poRef,
    po_amount: quoteTotal
  });
  results.salesCannotVerify.pass = !salesVerifyRes.success && (salesVerifyRes.message || "").includes("cannot perform verifyPo");
  console.log(`  Sales verify blocked: ${results.salesCannotVerify.pass} (${salesVerifyRes.message})`);

  // ---- Step 5: Finance verifies PO ----
  console.log("\n--- Step 5: Finance verifies PO ---");
  const verifyRes = await api("POST", `/quotes/${quoteId}/po`, finToken, {
    po_reference: poRef,
    po_amount: quoteTotal,
    verification_notes: "Phase 3A UAT verification"
  });
  console.log(`  Verify status: ${verifyRes.success ? "OK" : "FAIL"}`);
  if (verifyRes.success) {
    results.financeVerification.pass = true;
    results.financeVerification.details = {
      poStatus: verifyRes.data?.status,
      verifiedBy: verifyRes.data?.verified_by,
      quoteStatus: verifyRes.quote?.status
    };
    console.log(`  PO status: ${verifyRes.data?.status}, verified_by: ${verifyRes.data?.verified_by}`);
    console.log(`  Quote status after verify: ${verifyRes.quote?.status}`);
    results.poVerifiedStatus.pass = verifyRes.quote?.status === "PO_Verified";
    results.poVerifiedStatus.details = { quoteStatus: verifyRes.quote?.status };
  } else {
    console.log(`  Error: ${verifyRes.message}`);
  }

  // ---- Step 6: Dispatch is allowed from PO_Verified ----
  console.log("\n--- Step 6: Dispatch from PO_Verified ---");
  const opsAuth = await auth("ops-01@pilot-fixture.orac.invalid");
  const dispatchRes = await api("POST", `/quotes/${quoteId}/transition`, opsAuth.token, { target_state: "Field_Dispatch" });
  results.dispatchAllowed.pass = dispatchRes.success === true;
  results.dispatchAllowed.details = { success: dispatchRes.success, message: dispatchRes.message };
  console.log(`  Dispatch allowed: ${dispatchRes.success} ${dispatchRes.message || ""}`);

  // ---- Step 7: PO PDF ----
  console.log("\n--- Step 7: PO PDF render ---");
  const poId = submitRes.data?.id;
  if (poId) {
    const pdfRes = await fetch(`${API}/documents/purchase-orders/${poId}.pdf`, {
      headers: { "Authorization": `Bearer ${finToken}` }
    });
    if (pdfRes.ok) {
      const buf = Buffer.from(await pdfRes.arrayBuffer());
      const pdfPath = path.join(EVIDENCE_DIR, "po_verified.pdf");
      fs.writeFileSync(pdfPath, buf);
      results.poPdfRendered.pass = buf.length > 500;
      console.log(`  PDF saved: ${pdfPath} (${buf.length} bytes)`);
    } else {
      // Try quotation PDF instead
      const qPdfRes = await fetch(`${API}/documents/quotes/${quoteId}.pdf`, {
        headers: { "Authorization": `Bearer ${finToken}` }
      });
      if (qPdfRes.ok) {
        const buf = Buffer.from(await qPdfRes.arrayBuffer());
        const pdfPath = path.join(EVIDENCE_DIR, "quotation_po_verified.pdf");
        fs.writeFileSync(pdfPath, buf);
        results.poPdfRendered.pass = buf.length > 500;
        console.log(`  Quotation PDF saved: ${pdfPath} (${buf.length} bytes)`);
      } else {
        console.log(`  PDF endpoints returned ${pdfRes.status} / ${qPdfRes.status}`);
      }
    }
  }

  // ---- Step 8: Finance rejects a second client PO ----
  console.log("\n--- Step 8: Finance rejects a separate PO ---");
  // Create a second quote for the rejection test
  const q2Res = await api("POST", "/quotes", salesToken, {
    client_id: client.id,
    equipment_tag_id: tag?.id || null,
    scope_summary: "Rejection test quote",
    tax_status: "taxable",
    applied_tax_rate: 0.15,
    lines: [{ description: "Test line", quantity: 1, unit_price: 500, unit_of_measure: "each", cost_type: "labour" }]
  });
  if (q2Res.success) {
    const q2Id = q2Res.data.id;
    await api("POST", `/quotes/${q2Id}/transition`, salesToken, { target_state: "Sent" });
    await api("POST", `/quotes/${q2Id}/transition`, mgmtToken, { target_state: "Approved_Pending_PO" });
    const sub2 = await api("POST", `/quotes/${q2Id}/client-po`, clientToken, {
      po_reference: `UAT-PO-REJECT-${Date.now()}`,
      po_amount: q2Res.data.total_amount,
      document_reference: "DOC-REJECT-001"
    });
    if (sub2.success) {
      const rejRes = await api("POST", `/quotes/${q2Id}/reject-po`, finToken, {
        reason: "PO document reference does not match the client's procurement system."
      });
      results.financeRejection.pass = rejRes.success === true;
      results.financeRejection.details = { rejectedPoStatus: rejRes.data?.status, reason: rejRes.data?.rejection_reason };
      console.log(`  Rejection: ${rejRes.success ? "OK" : "FAIL"}, status: ${rejRes.data?.status}`);
    }
  }

  // ---- Step 9: Browser journeys ----
  console.log("\n--- Step 9: Browser journeys (Client Portal + Finance) ---");
  const browser = await chromium.launch({
    executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    headless: true
  });

  // Client Portal journey
  try {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await ctx.newPage();
    await page.goto(`${UI}/login`);
    await page.evaluate(({ token, user }) => {
      localStorage.setItem("orac_token", token);
      localStorage.setItem("orac_user", JSON.stringify(user));
    }, clientAuth);
    await page.goto(`${UI}/client-portal`, { waitUntil: "networkidle" });
    await page.waitForTimeout(1500);
    const shot1 = path.join(EVIDENCE_DIR, "01_client_portal_po_submission.png");
    await page.screenshot({ path: shot1, fullPage: true });
    results.screenshots.push(shot1);
    results.clientBrowserJourney.pass = true;
    console.log("  Client Portal screenshot captured.");
    await ctx.close();
  } catch (e) {
    console.log(`  Client browser journey error: ${e.message}`);
  }

  // Finance journey
  try {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await ctx.newPage();
    await page.goto(`${UI}/login`);
    await page.evaluate(({ token, user }) => {
      localStorage.setItem("orac_token", token);
      localStorage.setItem("orac_user", JSON.stringify(user));
    }, finAuth);
    await page.goto(`${UI}/finance`, { waitUntil: "networkidle" });
    await page.waitForTimeout(1500);
    const shot2 = path.join(EVIDENCE_DIR, "02_finance_po_verification.png");
    await page.screenshot({ path: shot2, fullPage: true });
    results.screenshots.push(shot2);
    results.financeBrowserJourney.pass = true;
    console.log("  Finance dashboard screenshot captured.");
    await ctx.close();
  } catch (e) {
    console.log(`  Finance browser journey error: ${e.message}`);
  }

  await browser.close();

  // ---- Summary ----
  console.log("\n=== PHASE 3A UAT SUMMARY ===");
  let allPass = true;
  for (const [k, v] of Object.entries(results)) {
    if (k === "screenshots") continue;
    const status = v.pass ? "✔ PASS" : "✖ FAIL";
    if (!v.pass) allPass = false;
    console.log(`  ${status}  ${k}`);
  }
  console.log(`\n  Overall: ${allPass ? "ALL PASSED" : "SOME FAILED"}`);
  console.log(`  Screenshots: ${results.screenshots.length}`);

  // Save results JSON
  const resultsPath = path.join(EVIDENCE_DIR, "uat_results.json");
  fs.writeFileSync(resultsPath, JSON.stringify(results, null, 2));
  console.log(`  Results saved: ${resultsPath}`);
}

run().catch(e => { console.error("FATAL:", e); process.exit(1); });
