import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";

const baseUrl = (process.env.ORAC_BASE_URL || "https://orac-industrial-service-portal.onrender.com").trim().replace(/\/$/, "");
const outputRoot = join(process.cwd(), "deliverables", "final-documents");
const screenshotRoot = join(outputRoot, "missing-screens");
const chromePath = process.env.ORAC_CHROME_PATH || "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";

async function run() {
  await mkdir(screenshotRoot, { recursive: true });
  console.log(`Saving screenshots to ${screenshotRoot}`);
  const browser = await chromium.launch({ executablePath: chromePath, headless: true });
  
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1 });

    const rolesToCapture = [
      { email: "sales@orac.co.zw", filename: "sales-dashboard-LIVE-2026-09-17.png" },
      { email: "supervisor@orac.co.zw", filename: "supervisor-dashboard-LIVE-2026-09-17.png" },
      { email: "tech@orac.co.zw", filename: "technician-dashboard-LIVE-2026-09-17.png" }
    ];

    for (const role of rolesToCapture) {
      console.log(`Logging in as ${role.email}...`);
      await page.goto(`${baseUrl}/login`, { waitUntil: "networkidle", timeout: 90000 });
      await page.locator('input[type="email"]').fill(role.email);
      await page.locator('input[type="password"]').fill("Test@123");
      await page.getByRole("button", { name: "Sign in" }).click();

      // Poll for login completion
      for (let attempt = 0; attempt < 60; attempt++) {
        await page.waitForTimeout(1000);
        const stillOnLogin = await page.getByText("Sign in to your account").isVisible().catch(() => false);
        if (!stillOnLogin) break;
      }
      
      console.log(`Capturing ${role.filename}...`);
      // Dashboard is root, but let's make sure it's fully loaded
      await page.waitForTimeout(4000); 
      await page.screenshot({ path: join(screenshotRoot, role.filename), fullPage: true });

      // Log out
      console.log(`Logging out ${role.email}...`);
      await page.evaluate(() => { localStorage.clear(); });
    }
    
    await page.close();
    console.log("Capture completed.");
  } catch (err) {
    console.error("Failed:", err);
  } finally {
    await browser.close();
  }
}

run();
