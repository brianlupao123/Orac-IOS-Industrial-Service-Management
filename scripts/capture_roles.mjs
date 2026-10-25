import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";

const outDir = process.env.SCREENSHOT_OUT_DIR || path.join(process.cwd(), "evidence", "screenshots");
const TEST_PASSWORD = process.env.TEST_PASSWORD;
if (!TEST_PASSWORD) {
  console.error("Error: TEST_PASSWORD environment variable is required to run verification.");
  process.exit(1);
}
const TEST_ADMIN_EMAIL = process.env.TEST_ADMIN_EMAIL || "adm-01@pilot-fixture.orac.invalid";
const TEST_CLIENT_EMAIL = process.env.TEST_CLIENT_EMAIL || "clv-01@pilot-fixture.orac.invalid";

fs.mkdirSync(outDir, { recursive: true });

async function captureRole(port, email, roleName) {
  console.log(`Capturing ${roleName} on port ${port}...`);
  const browser = await chromium.launch({ headless: true });
  
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 1
  });
  const page = await context.newPage();
  
  await page.goto(`http://127.0.0.1:${port}/login`, { waitUntil: "networkidle" });
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', TEST_PASSWORD);
  await page.click('button[type="submit"]');
  
  await page.waitForSelector('[data-evidence="dashboard-ready"]', { timeout: 15000 });
  await page.waitForTimeout(1000);
  
  const desktopPath = path.join(outDir, `${roleName}_desktop.png`);
  await page.screenshot({ path: desktopPath, fullPage: false });
  console.log(`Saved: ${desktopPath}`);
  
  await browser.close();
}

async function main() {
  await captureRole("5176", TEST_CLIENT_EMAIL, "client_redesigned");
  await captureRole("5176", TEST_ADMIN_EMAIL, "admin_redesigned");
  console.log("All done!");
}

main().catch(err => {
  console.error("Capture error:", err);
  process.exit(1);
});