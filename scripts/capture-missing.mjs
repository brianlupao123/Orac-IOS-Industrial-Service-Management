import { chromium } from "playwright";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

function cleanEnv(value = "") {
  return String(value)
    .trim()
    .replace(/^\[([^\]]+)\]\([^)]+\)$/, "$1")
    .replaceAll("\\@", "@");
}

const baseUrl = cleanEnv(process.env.ORAC_BASE_URL || "https://orac-industrial-service-portal.onrender.com").replace(/\/$/, "");
const outputRoot = join(process.cwd(), "deliverables", "final-documents");
const screenshotRoot = join(outputRoot, "missing-screens");
const chromePath = process.env.ORAC_CHROME_PATH || "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";

async function run() {
  await mkdir(screenshotRoot, { recursive: true });
  console.log(`Saving screenshots to ${screenshotRoot}`);
  const browser = await chromium.launch({ executablePath: chromePath, headless: true });
  
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1 });
    
    // Group B.8: Public routes
    console.log("Capturing public screens...");
    for (const [path, name] of [
      ["/forgot-password", "public-forgot-password-LIVE-2026-09-17.png"],
      ["/reset-password", "public-reset-password-LIVE-2026-09-17.png"],
      ["/request-access", "public-request-access-LIVE-2026-09-17.png"],
      ["/login", "public-login-LIVE-2026-09-17.png"]
    ]) {
      await page.goto(`${baseUrl}${path}`, { waitUntil: "networkidle", timeout: 60000 });
      await page.screenshot({ path: join(screenshotRoot, name), fullPage: true });
    }

    // Group B.1 & B.2 & B.4-9: Admin flow
    console.log("Logging in as Admin...");
    await page.goto(`${baseUrl}/login`, { waitUntil: "networkidle", timeout: 90000 });
    await page.locator('input[type="email"]').fill("admin@orac.co.zw");
    await page.locator('input[type="password"]').fill("Test@123");
    await page.getByRole("button", { name: "Sign in" }).click();

    // Poll for login completion the same way finalize-handover.mjs does — works with
    // client-side navigation where waitForURL can miss the redirect.
    for (let attempt = 0; attempt < 60; attempt++) {
      await page.waitForTimeout(1000);
      const stillOnLogin = await page.getByText("Sign in to your account").isVisible().catch(() => false);
      if (!stillOnLogin) break;
    }
    const stillOnLogin = await page.getByText("Sign in to your account").isVisible().catch(() => false);
    if (stillOnLogin) throw new Error("Admin login did not complete after 60s");
    
    console.log("Capturing Admin pages...");
    // B.1 Admin
    await page.goto(`${baseUrl}/admin`, { waitUntil: "networkidle" });
    await page.waitForTimeout(4000); // wait for data fetch
    await page.screenshot({ path: join(screenshotRoot, "admin-users-table-LIVE-2026-09-17.png"), fullPage: true });
    
    // B.1 Inventory
    await page.goto(`${baseUrl}/inventory`, { waitUntil: "networkidle" });
    await page.waitForTimeout(4000);
    await page.screenshot({ path: join(screenshotRoot, "inventory-suppliers-table-LIVE-2026-09-17.png"), fullPage: true });

    // B.2 Worksheets
    await page.goto(`${baseUrl}/worksheets`, { waitUntil: "networkidle" });
    await page.waitForTimeout(4000);
    await page.screenshot({ path: join(screenshotRoot, "worksheets-working-state-LIVE-2026-09-17.png"), fullPage: true });
    
    // B.7 Reports
    await page.goto(`${baseUrl}/reports`, { waitUntil: "networkidle" });
    await page.waitForTimeout(4000);
    await page.screenshot({ path: join(screenshotRoot, "reports-main-view-LIVE-2026-09-17.png"), fullPage: true });

    // Log out Admin — clear session via localStorage, then navigate to login
    console.log("Logging out Admin...");
    await page.evaluate(() => { localStorage.clear(); });
    await page.goto(`${baseUrl}/login`, { waitUntil: "networkidle", timeout: 60000 });

    // Group B.3 Client Viewer
    console.log("Logging in as Client Viewer...");
    await page.locator('input[type="email"]').fill("client@orac.co.zw");
    await page.locator('input[type="password"]').fill("Test@123");
    await page.getByRole("button", { name: "Sign in" }).click();

    // Poll for login completion
    for (let attempt = 0; attempt < 60; attempt++) {
      await page.waitForTimeout(1000);
      const stillOnLogin = await page.getByText("Sign in to your account").isVisible().catch(() => false);
      if (!stillOnLogin) break;
    }
    await page.waitForTimeout(4000);
    await page.screenshot({ path: join(screenshotRoot, "client-portal-tab-LIVE-2026-09-17.png"), fullPage: true });
    
    await page.close();
    console.log("Capture completed.");
  } catch (err) {
    console.error("Failed:", err);
  } finally {
    await browser.close();
  }
}

run();
