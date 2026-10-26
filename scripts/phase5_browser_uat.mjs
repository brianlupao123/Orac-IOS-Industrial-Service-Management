import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";

const uiBaseUrl = process.env.ORAC_PHASE5_UAT_UI_URL || "http://127.0.0.1:5176";
const financeEmail = process.env.ORAC_PHASE5_UAT_FINANCE_EMAIL || "phase5-uat-finance@fixture.invalid";
const financePassword = process.env.ORAC_PHASE5_UAT_PASSWORD || "OracUAT2026!";
const evidenceDir = path.resolve("evidence", "phase5-browser-uat");

const requiredSettlementText = [
  "INV-0001",
  "Invoice total",
  "800.00",
  "Received",
  "Outstanding",
  "UAT-PHASE5-RECEIPT-001",
  "Reversed"
];

function assertIncludes(text, expected) {
  if (!text.includes(expected)) throw new Error(`Expected settlement view to include: ${expected}`);
}

async function capture(page, target, name, viewport, screenshots) {
  await page.setViewportSize(viewport);
  await target.scrollIntoViewIfNeeded();
  await page.waitForTimeout(250);
  const file = path.join(evidenceDir, name);
  await page.screenshot({ path: file });
  screenshots.push(file);
}

async function run() {
  fs.mkdirSync(evidenceDir, { recursive: true });
  const results = {
    started_at: new Date().toISOString(),
    ui_base_url: uiBaseUrl,
    account: financeEmail,
    assertions: [],
    screenshots: [],
    pass: false
  };

  const browser = await chromium.launch({ channel: "chrome", headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    await page.goto(`${uiBaseUrl}/login`, { waitUntil: "domcontentloaded" });
    await page.getByLabel("Email address").waitFor();
    await page.getByLabel("Email address").fill(financeEmail);
    await page.getByLabel("Password").fill(financePassword);
    await page.getByRole("button", { name: /sign in/i }).click();
    await page.waitForURL(new RegExp(`${uiBaseUrl.replace(/[.*+?^${}()|[\\]\\]/g, "\\$&")}/(?!login)`), { timeout: 15000 });

    await page.goto(`${uiBaseUrl}/finance`, { waitUntil: "domcontentloaded" });
    await page.getByRole("button", { name: "View settlement" }).click();
    const settlement = page.locator('[aria-label*="Invoice settlement"]');
    await settlement.waitFor();
    const text = await settlement.innerText();

    for (const expected of requiredSettlementText) {
      assertIncludes(text, expected);
      results.assertions.push({ expected, pass: true });
    }
    assertIncludes(text, "Received\n0.00");
    results.assertions.push({ expected: "Received is USD 0.00 after reversal", pass: true });
    assertIncludes(text, "Outstanding\n800.00");
    results.assertions.push({ expected: "Outstanding is USD 800.00 after reversal", pass: true });

    await capture(page, settlement, "finance-settlement-desktop.png", { width: 1440, height: 900 }, results.screenshots);
    await capture(page, settlement, "finance-settlement-tablet.png", { width: 768, height: 1024 }, results.screenshots);
    await capture(page, settlement, "finance-settlement-mobile.png", { width: 390, height: 844 }, results.screenshots);

    results.pass = true;
    results.finished_at = new Date().toISOString();
    fs.writeFileSync(path.join(evidenceDir, "results.json"), JSON.stringify(results, null, 2));
    console.log(JSON.stringify(results, null, 2));
  } finally {
    await browser.close();
  }
}

run().catch((error) => {
  console.error(`Phase 5 browser UAT failed: ${error.message}`);
  process.exitCode = 1;
});
