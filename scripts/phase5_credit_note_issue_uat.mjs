import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";

const base = "http://127.0.0.1:5176";
const evidence = path.resolve("evidence", "phase5-browser-uat");
fs.mkdirSync(evidence, { recursive: true });
const browser = await chromium.launch({ channel: "chrome", headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto(`${base}/login`, { waitUntil: "domcontentloaded" });
  await page.getByLabel("Email address").fill("phase5-uat-finance-reviewer@fixture.invalid");
  await page.getByLabel("Password").fill("OracUAT2026!");
  await page.getByRole("button", { name: /sign in/i }).click();
  await page.waitForURL((url) => !url.pathname.endsWith("/login"), { timeout: 15000 });
  await page.goto(`${base}/finance`, { waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: "View settlement" }).click();
  const panel = page.locator('[aria-label*="Invoice settlement"]');
  await panel.getByText("Invoice total").waitFor();
  const issueButton = panel.getByRole("button", { name: "Issue credit note" });
  if (await issueButton.count()) {
    const issueResponse = page.waitForResponse((response) => (
      response.request().method() === "POST" && /\/credit-notes\/[^/]+\/issue$/.test(new URL(response.url()).pathname)
    ));
    page.once("dialog", (dialog) => dialog.accept());
    await issueButton.click();
    const response = await issueResponse;
    if (response.status() !== 200) throw new Error(`Credit-note issue API failed: ${response.status()} ${await response.text()}`);
    await page.getByRole("button", { name: "View settlement" }).waitFor();
    await page.getByRole("button", { name: "View settlement" }).click();
  }
  await panel.getByText("Issued").first().waitFor();
  const text = await panel.innerText();
  for (const expected of ["Issued", "Credit notes\n100.00", "Outstanding\n700.00"]) {
    if (!text.includes(expected)) throw new Error(`Expected issued credit-note view to include: ${expected}`);
  }
  const screenshot = path.join(evidence, "finance-credit-note-issued.png");
  await page.screenshot({ path: screenshot });
  console.log(JSON.stringify({ pass: true, action: "issued", credited_usd: 100, outstanding_usd: 700, screenshot }, null, 2));
} finally {
  await browser.close();
}
