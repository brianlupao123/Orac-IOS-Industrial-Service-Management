import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";

// Read-only local visual audit. It does not create, update, issue, approve,
// or delete any ORAC record. It only signs into the fictional local UAT
// account, reads rendered pages, and writes screenshots/evidence outside src.
const uiBaseUrl = process.env.ORAC_VISUAL_AUDIT_UI_URL || "http://127.0.0.1:5176";
const financeEmail = process.env.ORAC_VISUAL_AUDIT_EMAIL || "phase5-uat-finance@fixture.invalid";
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

async function signIn(page) {
  await page.goto(`${uiBaseUrl}/login`, { waitUntil: "domcontentloaded" });
  await page.getByLabel("Email address").fill(financeEmail);
  await page.getByLabel("Password").fill(financePassword);
  await page.getByRole("button", { name: /^sign in$/i }).click();
  await page.waitForURL((url) => !url.pathname.endsWith("/login"), { timeout: 15000 });
}

async function recordPage(page, viewport, route, heading, results) {
  await page.setViewportSize({ width: viewport.width, height: viewport.height });
  await page.goto(`${uiBaseUrl}${route}`, { waitUntil: "domcontentloaded" });
  await page.getByRole("heading", { name: heading }).waitFor();
  // Route headings render before their data requests complete. Wait for the
  // page-level loading message to disappear so screenshots document the
  // settled experience rather than an in-flight state.
  await page.waitForFunction(
    () => !document.body.textContent.includes("Loading finance work..."),
    undefined,
    { timeout: 15000 }
  );
  await page.waitForTimeout(150);

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

  const file = path.join(evidenceDir, `${viewport.name}-${route === "/" ? "dashboard" : "finance"}.png`);
  await page.screenshot({ path: file, fullPage: true });
  results.checks.push({ viewport: viewport.name, route, heading, ...metrics, pass: true });
  results.screenshots.push(file);
}

async function run() {
  fs.mkdirSync(evidenceDir, { recursive: true });
  const results = {
    started_at: new Date().toISOString(),
    ui_base_url: uiBaseUrl,
    fictional_account: financeEmail,
    read_only: true,
    checks: [],
    screenshots: [],
    pass: false
  };
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  try {
    const page = await browser.newPage({ viewport: viewports[0] });
    await signIn(page);
    for (const viewport of viewports) {
      await recordPage(page, viewport, "/", "Finance & Invoicing", results);
      await recordPage(page, viewport, "/finance", "PO & Invoicing", results);
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
