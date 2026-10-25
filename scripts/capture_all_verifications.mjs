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

async function capture() {
  const browser = await chromium.launch({ headless: true });
  console.log("Browser launched.");

  async function setupPage(port, email, viewport, isMobile = false) {
    const context = await browser.newContext({
      viewport,
      deviceScaleFactor: isMobile ? 2 : 1,
      isMobile,
      hasTouch: isMobile
    });
    const page = await context.newPage();
    await page.goto(`http://127.0.0.1:${port}/login`, { waitUntil: "networkidle" });
    await page.fill('input[type="email"]', email);
    await page.fill('input[type="password"]', TEST_PASSWORD);
    await page.click('button[type="submit"]');
    await page.waitForSelector('[data-evidence="dashboard-ready"]', { timeout: 15000 });
    await page.waitForTimeout(1000);
    return { context, page };
  }

  // 1. Candidate Desktop Admin (Light)
  {
    console.log("Capturing Candidate Desktop Admin Light...");
    const { page, context } = await setupPage("5176", TEST_ADMIN_EMAIL, { width: 1440, height: 900 });
    await page.screenshot({ path: path.join(outDir, "candidate_desktop_admin_light.png") });
    
    // 2. Candidate Desktop Admin (Dark)
    console.log("Capturing Candidate Desktop Admin Dark...");
    await page.evaluate(() => {
      document.documentElement.setAttribute("data-theme", "dark");
      localStorage.setItem("orac-theme", "dark");
    });
    await page.waitForTimeout(500);
    await page.screenshot({ path: path.join(outDir, "candidate_desktop_admin_dark.png") });
    await context.close();
  }

  // 3. Candidate Mobile Admin (Light)
  {
    console.log("Capturing Candidate Mobile Admin Light...");
    const { page, context } = await setupPage("5176", TEST_ADMIN_EMAIL, { width: 390, height: 844 }, true);
    await page.screenshot({ path: path.join(outDir, "candidate_mobile_admin_light.png") });

    // 4. Candidate Mobile Menu OPEN
    console.log("Capturing Candidate Mobile Menu OPEN...");
    await page.click('button[aria-controls="mobile-nav-menu"]');
    await page.waitForSelector('#mobile-nav-menu', { state: 'visible', timeout: 5000 });
    await page.waitForTimeout(500);
    await page.screenshot({ path: path.join(outDir, "candidate_mobile_menu_open.png") });

    await page.keyboard.press("Escape");
    await page.waitForTimeout(300);

    // 5. Candidate Mobile Admin (Dark)
    console.log("Capturing Candidate Mobile Admin Dark...");
    await page.evaluate(() => {
      document.documentElement.setAttribute("data-theme", "dark");
      localStorage.setItem("orac-theme", "dark");
    });
    await page.waitForTimeout(500);
    await page.screenshot({ path: path.join(outDir, "candidate_mobile_admin_dark.png") });
    await context.close();
  }

  // 6. Candidate Desktop Client Viewer (Light)
  {
    console.log("Capturing Candidate Desktop Client Viewer Light...");
    const { page, context } = await setupPage("5176", TEST_CLIENT_EMAIL, { width: 1440, height: 900 });
    await page.screenshot({ path: path.join(outDir, "candidate_desktop_client_light.png") });
    await context.close();
  }

  // 7. Integration Desktop Admin (Light) - port 5175
  {
    console.log("Capturing Integration Desktop Admin Light (port 5175)...");
    const { page, context } = await setupPage("5175", TEST_ADMIN_EMAIL, { width: 1440, height: 900 });
    await page.screenshot({ path: path.join(outDir, "integration_desktop_admin_light.png") });
    await context.close();
  }

  // 8. Integration Mobile Admin (Light) - port 5175
  {
    console.log("Capturing Integration Mobile Admin Light (port 5175)...");
    const { page, context } = await setupPage("5175", TEST_ADMIN_EMAIL, { width: 390, height: 844 }, true);
    await page.screenshot({ path: path.join(outDir, "integration_mobile_admin_light.png") });
    await context.close();
  }

  await browser.close();
  console.log("All verifications captured successfully!");
}

capture().catch((err) => {
  console.error("Capture failed:", err);
  process.exit(1);
});