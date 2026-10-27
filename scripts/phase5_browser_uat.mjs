import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";

const uiBaseUrl = process.env.ORAC_PHASE5_UAT_UI_URL || "http://127.0.0.1:5176";
const financeEmail = process.env.ORAC_PHASE5_UAT_FINANCE_EMAIL || "phase5-uat-finance@fixture.invalid";
const reviewerEmail = process.env.ORAC_PHASE5_UAT_REVIEWER_EMAIL || "phase5-uat-finance-reviewer@fixture.invalid";
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

async function signIn(page, email) {
  await page.goto(`${uiBaseUrl}/login`, { waitUntil: "domcontentloaded" });
  await page.getByLabel("Email address").waitFor();
  await page.getByLabel("Email address").fill(email);
  await page.getByLabel("Password").fill(financePassword);
  await page.getByRole("button", { name: /sign in/i }).click();
  await page.waitForURL((url) => !url.pathname.endsWith("/login"), { timeout: 15000 });
}

async function run() {
  fs.mkdirSync(evidenceDir, { recursive: true });
  const results = {
    started_at: new Date().toISOString(),
    ui_base_url: uiBaseUrl,
    accounts: { preparer: financeEmail, reviewer: reviewerEmail },
    assertions: [],
    screenshots: [],
    pass: false
  };

  const browser = await chromium.launch({ channel: "chrome", headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    await signIn(page, financeEmail);

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

    await settlement.getByLabel("Credit note amount").fill("100");
    await settlement.getByLabel("Credit note reason").fill("UAT approved correction");
    await settlement.getByRole("button", { name: "Prepare credit note" }).click();
    await settlement.getByText("Credit note prepared for independent issue.").waitFor();
    assertIncludes(await settlement.innerText(), "Prepared");
    results.assertions.push({ expected: "Finance prepares a reasoned credit note", pass: true });

    await capture(page, settlement, "finance-settlement-desktop.png", { width: 1440, height: 900 }, results.screenshots);
    await capture(page, settlement, "finance-settlement-tablet.png", { width: 768, height: 1024 }, results.screenshots);
    await capture(page, settlement, "finance-settlement-mobile.png", { width: 390, height: 844 }, results.screenshots);

    const reviewerPage = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    await signIn(reviewerPage, reviewerEmail);
    await reviewerPage.goto(`${uiBaseUrl}/finance`, { waitUntil: "domcontentloaded" });
    await reviewerPage.getByRole("button", { name: "View settlement" }).click();
    const reviewerSettlement = reviewerPage.locator('[aria-label*="Invoice settlement"]');
    await reviewerSettlement.getByRole("button", { name: "Issue credit note" }).waitFor();
    reviewerPage.once("dialog", (dialog) => dialog.accept());
    await reviewerSettlement.getByRole("button", { name: "Issue credit note" }).click();
    await reviewerSettlement.getByText("Credit note issued and settlement updated.").waitFor();
    const reviewerText = await reviewerSettlement.innerText();
    assertIncludes(reviewerText, "Issued");
    assertIncludes(reviewerText, "Credit notes\n100.00");
    assertIncludes(reviewerText, "Outstanding\n700.00");
    results.assertions.push({ expected: "Different Finance user issues the prepared credit note", pass: true });
    results.assertions.push({ expected: "Issued credit reduces USD outstanding from 800.00 to 700.00", pass: true });
    await capture(reviewerPage, reviewerSettlement, "finance-credit-note-issued-desktop.png", { width: 1440, height: 900 }, results.screenshots);
    await reviewerPage.close();

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
