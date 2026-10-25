import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";

const targetPort = process.argv[2] || "5176";
const prefix = process.argv[3] || "redesigned";
const outDir = process.env.SCREENSHOT_OUT_DIR || path.join(process.cwd(), "evidence", "screenshots");
const TEST_PASSWORD = process.env.TEST_PASSWORD;
if (!TEST_PASSWORD) {
  console.error("Error: TEST_PASSWORD environment variable is required to run verification.");
  process.exit(1);
}
const TEST_ADMIN_EMAIL = process.env.TEST_ADMIN_EMAIL || "adm-01@pilot-fixture.orac.invalid";

fs.mkdirSync(outDir, { recursive: true });

async function main() {
  console.log(`Capturing ${prefix} on port ${targetPort}...`);
  const browser = await chromium.launch({ headless: true });
  
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 1
  });
  const page = await context.newPage();
  
  await page.goto(`http://127.0.0.1:${targetPort}/login`, { waitUntil: "networkidle" });
  await page.fill('input[type="email"]', TEST_ADMIN_EMAIL);
  await page.fill('input[type="password"]', TEST_PASSWORD);
  await page.click('button[type="submit"]');
  
  await page.waitForSelector('[data-evidence="dashboard-ready"]', { timeout: 15000 });
  await page.waitForTimeout(1000);
  
  const desktopPath = path.join(outDir, `${prefix}_desktop.png`);
  await page.screenshot({ path: desktopPath, fullPage: false });
  console.log(`Saved desktop light screenshot: ${desktopPath}`);
  
  await page.evaluate(() => {
    document.documentElement.setAttribute("data-theme", "dark");
    localStorage.setItem("orac-theme", "dark");
  });
  await page.waitForTimeout(500);
  const desktopDarkPath = path.join(outDir, `${prefix}_desktop_dark.png`);
  await page.screenshot({ path: desktopDarkPath, fullPage: false });
  console.log(`Saved desktop dark screenshot: ${desktopDarkPath}`);

  const mobileContext = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true
  });
  const mobilePage = await mobileContext.newPage();
  
  const token = await page.evaluate(() => localStorage.getItem("orac_token"));
  const user = await page.evaluate(() => localStorage.getItem("orac_user"));
  
  await mobilePage.goto(`http://127.0.0.1:${targetPort}/login`);
  await mobilePage.evaluate(({ t, u }) => {
    if (t) localStorage.setItem("orac_token", t);
    if (u) localStorage.setItem("orac_user", u);
    document.documentElement.setAttribute("data-theme", "light");
  }, { t: token, u: user });
  
  await mobilePage.goto(`http://127.0.0.1:${targetPort}/`, { waitUntil: "networkidle" });
  await mobilePage.waitForSelector('[data-evidence="dashboard-ready"]', { timeout: 15000 });
  await mobilePage.waitForTimeout(1000);
  
  const mobilePath = path.join(outDir, `${prefix}_mobile.png`);
  await mobilePage.screenshot({ path: mobilePath, fullPage: false });
  console.log(`Saved mobile light screenshot: ${mobilePath}`);

  await mobilePage.evaluate(() => {
    document.documentElement.setAttribute("data-theme", "dark");
    localStorage.setItem("orac-theme", "dark");
  });
  await mobilePage.waitForTimeout(500);
  const mobileDarkPath = path.join(outDir, `${prefix}_mobile_dark.png`);
  await mobilePage.screenshot({ path: mobileDarkPath, fullPage: false });
  console.log(`Saved mobile dark screenshot: ${mobileDarkPath}`);
  
  await browser.close();
  console.log(`All screenshots for ${prefix} captured successfully.`);
}

main().catch(err => {
  console.error("Capture error:", err);
  process.exit(1);
});