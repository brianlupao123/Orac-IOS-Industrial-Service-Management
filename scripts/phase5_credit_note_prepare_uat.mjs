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
  await page.getByLabel("Email address").fill("phase5-uat-finance@fixture.invalid");
  await page.getByLabel("Password").fill("OracUAT2026!");
  await page.getByRole("button", { name: /sign in/i }).click();
  await page.waitForURL((url) => !url.pathname.endsWith("/login"), { timeout: 15000 });
  await page.goto(`${base}/finance`, { waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: "View settlement" }).click();
  const panel = page.locator('[aria-label*="Invoice settlement"]');
  await panel.getByText("Invoice total").waitFor();
  await panel.getByLabel("Credit note amount").fill("100");
  await panel.getByLabel("Credit note reason").fill("UAT approved correction");
  const createResponse = page.waitForResponse((response) => (
    response.request().method() === "POST" && response.url().includes("/credit-notes")
  ));
  await panel.getByRole("button", { name: "Prepare credit note" }).click();
  const response = await createResponse;
  const responseBody = await response.text();
  if (response.status() !== 201) throw new Error(`Credit-note preparation API failed: ${response.status()} ${responseBody}`);
  await page.getByRole("button", { name: "View settlement" }).waitFor();
  await page.getByRole("button", { name: "View settlement" }).click();
  await panel.getByText("Prepared").first().waitFor();
  const screenshot = path.join(evidence, "finance-credit-note-prepared.png");
  await page.screenshot({ path: screenshot });
  console.log(JSON.stringify({ pass: true, action: "prepared", amount_usd: 100, screenshot }, null, 2));
} finally {
  await browser.close();
}
