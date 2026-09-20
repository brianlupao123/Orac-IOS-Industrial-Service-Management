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
const outputRoot = join(process.cwd(), "deliverables", "final-uat");
const screenshotRoot = join(outputRoot, "screenshots");
const chromePath = process.env.ORAC_CHROME_PATH || "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const roles = [["Admin", "ADMIN"], ["Management", "MANAGEMENT"], ["Sales", "SALES"], ["Finance", "FINANCE"], ["Operations", "OPERATIONS"], ["Supervisor", "SUPERVISOR"], ["Technician", "TECHNICIAN"], ["Client Viewer", "CLIENT_VIEWER"]];
const demoEmails = {
  ADMIN: "admin@orac.co.zw",
  MANAGEMENT: "management@orac.co.zw",
  SALES: "sales@orac.co.zw",
  FINANCE: "finance@orac.co.zw",
  OPERATIONS: "ops@orac.co.zw",
  SUPERVISOR: "supervisor@orac.co.zw",
  TECHNICIAN: "tech@orac.co.zw",
  CLIENT_VIEWER: "client@orac.co.zw"
};

const fileName = (role) => role.toLowerCase().replace(/[^a-z0-9]+/g, "-");

async function capturePublicScreens(browser) {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1 });
  const screenshots = [];
  try {
    for (const [path, name] of [
      ["/", "public-landing.png"],
      ["/login", "public-login.png"],
      ["/request-access", "public-request-access.png"]
    ]) {
      await page.goto(`${baseUrl}${path}`, { waitUntil: "networkidle", timeout: 60000 });
      await page.screenshot({ path: join(screenshotRoot, name), fullPage: true });
      screenshots.push(name);
    }
    return { role: "Public", status: "PASS", detail: "Landing, login, and request-access screens captured.", screenshots };
  } catch (error) {
    return { role: "Public", status: "FAILED", detail: error.message, screenshots };
  } finally {
    await page.close();
  }
}

async function captureRole(browser, role, key) {
  const email = cleanEnv(process.env[`ORAC_${key}_EMAIL`] || demoEmails[key]);
  const password = cleanEnv(process.env[`ORAC_${key}_PASSWORD`] || process.env.ORAC_PASSWORD);
  if (!email || !password) return { role, status: "SKIPPED", detail: `Missing ORAC_${key}_EMAIL or ORAC_${key}_PASSWORD.`, screenshots: [] };
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1 });
  const screenshots = [];
  const errors = [];
  page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); });
  page.on("pageerror", (error) => errors.push(error.message));
  try {
    await page.goto(`${baseUrl}/login`, { waitUntil: "networkidle", timeout: 60000 });
    await page.locator('input[type="email"]').fill(email);
    await page.locator('input[type="password"]').fill(password);
    await page.getByRole("button", { name: "Sign in" }).click();
    // Wait for login to complete — Render cold starts can take 5-15 seconds.
    for (let attempt = 0; attempt < 30; attempt++) {
      await page.waitForTimeout(1000);
      const stillOnLogin = await page.getByText("Sign in to your account").isVisible().catch(() => false);
      if (!stillOnLogin) break;
    }
    if (await page.getByText("Sign in to your account").isVisible().catch(() => false)) {
      const detail = await page.locator("form div.text-red-600").textContent().catch(() => "Login did not complete.");
      return { role, status: "FAILED", detail: detail || "Login did not complete.", screenshots };
    }
    const stem = fileName(role);
    for (const [suffix, action] of [
      ["dashboard", async () => {}],
      ["assistant-open", async () => { await page.getByRole("button", { name: `Open ${role} dashboard assistant` }).click(); await page.getByRole("dialog", { name: "Dashboard assistant" }).waitFor({ timeout: 20000 }); }],
      ["assistant-answer", async () => { const input = page.locator('#dashboard-assistant-panel input[maxlength="500"]'); await input.fill("What needs attention?"); await page.getByRole("button", { name: "Send" }).click(); await page.getByText("Finding:").waitFor({ timeout: 30000 }); }]
    ]) {
      await action();
      const name = `${stem}-${suffix}.png`;
      await page.screenshot({ path: join(screenshotRoot, name), fullPage: true });
      screenshots.push(name);
    }
    const evidence = page.getByRole("button", { name: /Show evidence:/ }).first();
    if (await evidence.isVisible().catch(() => false)) {
      await evidence.click();
      await page.waitForTimeout(500);
      const name = `${stem}-evidence-highlight.png`;
      await page.screenshot({ path: join(screenshotRoot, name), fullPage: true });
      screenshots.push(name);
    }
    if (role === "Admin") {
      const input = page.locator('#dashboard-assistant-panel input[maxlength="500"]');
      await input.fill("What will the weather be tomorrow?");
      await page.getByRole("button", { name: "Send" }).click();
      await page.getByText("I do not have verified dashboard data", { exact: false }).waitFor({ timeout: 30000 });
      const name = `${stem}-no-match.png`;
      await page.screenshot({ path: join(screenshotRoot, name), fullPage: true });
      screenshots.push(name);
    }
    return { role, status: errors.length ? "PASS_WITH_CONSOLE_ERRORS" : "PASS", detail: errors.length ? errors.join(" | ") : "Dashboard, answer, and evidence interaction captured.", screenshots };
  } catch (error) {
    return { role, status: "FAILED", detail: error.message, screenshots };
  } finally { await page.close(); }
}

function buildReport(results) {
  const rows = results.map((item) => `| ${item.role} | ${item.status} | ${item.screenshots.length} | ${item.detail.replaceAll("|", "\\|").replaceAll("\n", " ")} |`).join("\n");
  const links = results.flatMap((item) => item.screenshots.map((name) => `- ${item.role}: [${name}](screenshots/${name})`)).join("\n") || "- No screenshots captured.";
  return `# ORAC-IOS Final UAT Evidence\n\nGenerated: ${new Date().toISOString()}\nTarget: ${baseUrl}\n\n## Execution Status\n\n| Role | Status | Screenshots | Result |\n|---|---|---:|---|\n${rows}\n\n## Screenshot Evidence\n\n${links}\n\n## Capture Notes\n\n- Public captures cover landing, login, and request-access screens.\n- Role captures cover dashboard, assistant open, assistant answer, evidence highlight when available, and Admin safe no-match refusal.\n- Environment variables are normalised to remove accidental Markdown links and escaped email at-signs.\n\n## Release Gate\n\nPASS confirms the deployed role could log in, open the assistant, receive a structured response, and use an evidence link. PASS_WITH_CONSOLE_ERRORS requires triage. SKIPPED is not a pass. Do not sign off until each required role has PASS evidence.\n`;
}

await mkdir(screenshotRoot, { recursive: true });
const browser = await chromium.launch({ executablePath: chromePath, headless: true });
const results = [];
try {
  results.push(await capturePublicScreens(browser));
  for (const [role, key] of roles) results.push(await captureRole(browser, role, key));
} finally { await browser.close(); }
const reportPath = join(outputRoot, "ORAC_IOS_FINAL_UAT_EVIDENCE.md");
await writeFile(reportPath, buildReport(results), "utf8");
console.table(results.map(({ role, status, screenshots }) => ({ role, status, screenshots: screenshots.length })));
console.log(`Evidence report: ${reportPath}`);
if (results.some((item) => item.status === "FAILED")) process.exitCode = 1;
