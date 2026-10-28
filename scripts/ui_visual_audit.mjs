import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";

// Read-only local visual audit. It does not create, update, issue, approve,
// or delete any ORAC record. It only signs into the fictional local UAT
// account, reads rendered pages, and writes screenshots/evidence outside src.
const uiBaseUrl = process.env.ORAC_VISUAL_AUDIT_UI_URL || "http://127.0.0.1:5176";
const financeEmail = process.env.ORAC_VISUAL_AUDIT_EMAIL || "phase5-uat-finance@fixture.invalid";
const adminEmail = process.env.ORAC_VISUAL_AUDIT_ADMIN_EMAIL || "phase5-uat-admin@fixture.invalid";
const salesEmail = process.env.ORAC_VISUAL_AUDIT_SALES_EMAIL || "phase5-uat-sales@fixture.invalid";
const clientEmail = process.env.ORAC_VISUAL_AUDIT_CLIENT_EMAIL || "phase5-uat-client-viewer@fixture.invalid";
const operationsEmail = process.env.ORAC_VISUAL_AUDIT_OPERATIONS_EMAIL || "phase5-uat-operations@fixture.invalid";
const supervisorEmail = process.env.ORAC_VISUAL_AUDIT_SUPERVISOR_EMAIL || "phase5-uat-supervisor@fixture.invalid";
const technicianEmail = process.env.ORAC_VISUAL_AUDIT_TECHNICIAN_EMAIL || "phase5-uat-technician@fixture.invalid";
const financePassword = process.env.ORAC_VISUAL_AUDIT_PASSWORD || "OracUAT2026!";
const runId = new Date().toISOString().replace(/[:.]/g, "-");
const evidenceDir = path.resolve("evidence", "ui-visual-audit", runId);

const viewports = [
  { name: "desktop", width: 1440, height: 900 },
  { name: "tablet", width: 1024, height: 800 },
  { name: "nav-900", width: 900, height: 800 },
  { name: "mobile", width: 390, height: 844 }
];

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function signIn(page, email) {
  await page.goto(`${uiBaseUrl}/login`, { waitUntil: "domcontentloaded" });
  await page.getByLabel("Email address").fill(email);
  await page.getByLabel("Password").fill(financePassword);
  await page.getByRole("button", { name: /^sign in$/i }).click();
  await page.waitForURL((url) => !url.pathname.endsWith("/login"), { timeout: 15000 });
}

async function recordPage(page, viewport, route, heading, results, audience) {
  await page.setViewportSize({ width: viewport.width, height: viewport.height });
  await page.goto(`${uiBaseUrl}${route}`, { waitUntil: "domcontentloaded" });
  await page.getByRole("heading", { name: heading }).waitFor();
  // Route headings render before their data requests complete. Wait for the
  // shared page-loading state to disappear so screenshots document the
  // settled experience rather than an in-flight state.
  await page.waitForFunction(
    () => !document.querySelector('[data-evidence="page-loading-skeleton"], [data-evidence="documents-loading"]'),
    undefined,
    { timeout: 15000 }
  );
  await page.waitForTimeout(150);

  if (route === "/documents") {
    assert(!(await page.getByRole("alert").count()), `${viewport.name} ${audience} documents returned an error`);
  }

  if (viewport.name === "nav-900") {
    assert(await page.locator(".orac-primary-nav").isVisible(), "900px must retain the labelled top navigation");
    assert(!(await page.locator(".orac-mobile-tabs").isVisible()), "900px must not render the compact bottom tab bar");
  }

  const metrics = await page.evaluate(() => ({
    viewportWidth: window.innerWidth,
    documentWidth: document.documentElement.scrollWidth,
    bodyFontSize: getComputedStyle(document.body).fontSize
  }));
  assert(metrics.documentWidth <= metrics.viewportWidth, `${viewport.name} ${route} has horizontal page overflow`);
  assert(metrics.bodyFontSize === "16px", `${viewport.name} ${route} no longer uses the approved 16px base type`);

  const touchTargets = {
    "/quotations": ["New quotation", "Download PDF"],
    "/documents": ["Download PDF"],
    "/reports": ["Export CSV"],
    "/internal-requests": ["My Requests", "Team Inbox", "Refresh"],
    "/service-requests": ["Refresh"]
  };
  if (touchTargets[route]) {
    for (const name of touchTargets[route]) {
      const button = page.getByRole("button", { name, exact: true }).first();
      if (await button.count()) {
        const box = await button.boundingBox();
        assert(box?.height >= 44, `${viewport.name} ${name} is smaller than the 44px touch target`);
      }
    }
  }

  const pageName = route === "/" ? "dashboard" : route.replace(/^\//, "");
  const file = path.join(evidenceDir, `${audience}-${viewport.name}-${pageName}.png`);
  await page.screenshot({ path: file, fullPage: true });
  results.checks.push({ audience, viewport: viewport.name, route, heading, ...metrics, pass: true });
  results.screenshots.push(file);
}

async function run() {
  fs.mkdirSync(evidenceDir, { recursive: true });
  const results = {
    started_at: new Date().toISOString(),
    ui_base_url: uiBaseUrl,
    fictional_accounts: [financeEmail, adminEmail, salesEmail, clientEmail, operationsEmail, supervisorEmail, technicianEmail],
    read_only: true,
    checks: [],
    screenshots: [],
    pass: false
  };
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  try {
    const audits = [
      { audience: "finance", email: financeEmail, pages: [["/", "Finance & Invoicing"], ["/finance", "PO & Invoicing"], ["/reports", "Operational Reports"], ["/documents", "Documents"]] },
      { audience: "admin", email: adminEmail, pages: [["/admin", "Administration Console"], ["/inventory", "Inventory management"]] },
      { audience: "sales", email: salesEmail, pages: [["/quotations", "Quotations"], ["/internal-requests", "Internal Requests"], ["/service-requests", "Service Requests"]] },
      { audience: "client", email: clientEmail, pages: [["/portal", "Client Portal"], ["/documents", "Documents"]] },
      { audience: "operations", email: operationsEmail, pages: [["/worksheets", "Timesheets"], ["/operational-data", "Operational Data"]] },
      { audience: "supervisor", email: supervisorEmail, pages: [["/worksheets", "Timesheets"]] },
      { audience: "technician", email: technicianEmail, pages: [["/worksheets", "Timesheets"]] }
    ];
    for (const audit of audits) {
      const context = await browser.newContext({ viewport: viewports[0] });
      const page = await context.newPage();
      await signIn(page, audit.email);
      for (const viewport of viewports) {
        for (const [route, heading] of audit.pages) await recordPage(page, viewport, route, heading, results, audit.audience);
      }
      await context.close();
    }
    results.pass = true;
    results.finished_at = new Date().toISOString();
    fs.writeFileSync(path.join(evidenceDir, "results.json"), JSON.stringify(results, null, 2));
    console.log(JSON.stringify(results, null, 2));
  } finally {
    await browser.close();
  }
}

run().catch((error) => {
  console.error(`Visual audit failed: ${error.message}`);
  process.exitCode = 1;
});
