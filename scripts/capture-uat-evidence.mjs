import { chromium } from "playwright";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const roles = [
  ["Admin", "ADMIN"], ["Management", "MANAGEMENT"], ["Sales", "SALES"], ["Finance", "FINANCE"],
  ["Operations", "OPERATIONS"], ["Supervisor", "SUPERVISOR"], ["Technician", "TECHNICIAN"], ["Client Viewer", "CLIENT_VIEWER"]
];
const allowedEvidenceClasses = new Set(["LOCAL_UAT", "ISOLATED_STAGING", "DEPLOYED_PILOT"]);

function parseEnv(file) {
  const values = {};
  for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
    const match = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
    if (match && !match[1].startsWith("#")) values[match[1]] = match[2].replace(/^['"]|['"]$/g, "");
  }
  return values;
}

function git(...args) { return execFileSync("git", args, { cwd: root, encoding: "utf8" }).trim(); }
function isGitIgnored(target) {
  try { execFileSync("git", ["check-ignore", "--quiet", target], { cwd: root, stdio: "ignore" }); return true; }
  catch { return false; }
}
function redact(value) { return String(value || "").replace(/https?:\/\/[^\s?]+\?[^\s]*/gi, "[redacted-url]").replace(/[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/g, "[redacted-email]").replace(/(?:token|password|authorization)[^\s,]*/gi, "[redacted-secret]").slice(0, 240); }

function assertSafeWorkspace(envFile) {
  if (git("status", "--porcelain")) throw new Error("Workspace is dirty. Commit or stash reviewed work before UAT capture.");
  if (!isGitIgnored(envFile)) throw new Error(`${envFile} must be ignored by Git.`);
  if (!isGitIgnored("evidence/uat/.gitignore-probe")) throw new Error("evidence/uat must be ignored by Git.");
}

async function loginAndCapture(browser, baseUrl, role, key, env, captureDir, entries) {
  const email = env[`UAT_${key}_EMAIL`];
  const password = env[`UAT_${key}_PASSWORD`];
  if (!email || !password) {
    entries.push({ id: `dashboard-${key.toLowerCase()}`, role, label: `${role} dashboard`, status: "BLOCKED", detail: "Approved UAT credentials were not supplied.", evidenceClass: env.UAT_EVIDENCE_CLASS });
    return;
  }
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  try {
    await page.goto(`${baseUrl}/login`, { waitUntil: "networkidle" });
    await page.locator('input[type="email"]').fill(email);
    await page.locator('input[type="password"]').fill(password);
    await page.getByRole("button", { name: "Sign in" }).click();
    await page.locator('[data-evidence="dashboard-ready"], [data-evidence="forbidden-state"]').waitFor({ timeout: 15000 });
    const file = `${key.toLowerCase()}-dashboard.png`;
    await page.screenshot({ path: path.join(captureDir, file), fullPage: true });
    entries.push({ id: `dashboard-${key.toLowerCase()}`, role, label: `${role} dashboard`, status: "PASS", detail: "Authenticated role dashboard captured.", screenshot: file, evidenceClass: env.UAT_EVIDENCE_CLASS, capturedAtUtc: new Date().toISOString() });
    if (role === "Client Viewer") {
      await page.goto(`${baseUrl}/reports`, { waitUntil: "networkidle" });
      await page.locator('[data-evidence="forbidden-state"]').waitFor({ timeout: 10000 });
      const forbidden = "client-viewer-forbidden-reports.png";
      await page.screenshot({ path: path.join(captureDir, forbidden), fullPage: true });
      entries.push({ id: "client-viewer-forbidden-reports", role, label: "Client Viewer forbidden report route", status: "PASS", detail: "Real authenticated low-privilege route check.", screenshot: forbidden, evidenceClass: env.UAT_EVIDENCE_CLASS, capturedAtUtc: new Date().toISOString() });
    }
  } catch (error) {
    entries.push({ id: `dashboard-${key.toLowerCase()}`, role, label: `${role} dashboard`, status: "FAIL", detail: redact(error.message), evidenceClass: env.UAT_EVIDENCE_CLASS, capturedAtUtc: new Date().toISOString() });
  } finally { await page.close(); }
}

async function main() {
  const envArg = process.argv.indexOf("--env");
  const envFile = envArg >= 0 ? process.argv[envArg + 1] : ".env.uat.local";
  if (!envFile || !existsSync(path.resolve(root, envFile))) throw new Error(`Environment file not found: ${envFile}`);
  assertSafeWorkspace(envFile);
  const env = parseEnv(path.resolve(root, envFile));
  if (!allowedEvidenceClasses.has(env.UAT_EVIDENCE_CLASS)) throw new Error("UAT_EVIDENCE_CLASS must be LOCAL_UAT, ISOLATED_STAGING, or DEPLOYED_PILOT.");
  if (!/^https:\/\//.test(env.UAT_BASE_URL || "")) throw new Error("UAT_BASE_URL must be an HTTPS deployed portal URL.");
  const captureId = `UAT-${new Date().toISOString().replace(/[:.]/g, "-")}`;
  const captureDir = path.join(root, "evidence", "uat", captureId);
  mkdirSync(captureDir, { recursive: true });
  const entries = [];
  const browser = await chromium.launch({ headless: true });
  try { for (const [role, key] of roles) await loginAndCapture(browser, env.UAT_BASE_URL.replace(/\/$/, ""), role, key, env, captureDir, entries); }
  finally { await browser.close(); }
  entries.push({ id: "session-expiry", label: "Session expiry", status: "BLOCKED", detail: "Requires an approved test-only expired-session mechanism; no artificial evidence was created.", evidenceClass: env.UAT_EVIDENCE_CLASS });
  entries.push({ id: "empty-error-states", label: "Empty and error states", status: "BLOCKED", detail: "Requires documented test-only API response controls; no production data was altered.", evidenceClass: env.UAT_EVIDENCE_CLASS });
  const manifest = { captureId, timestampUtc: new Date().toISOString(), hostname: new URL(env.UAT_BASE_URL).hostname, evidenceClass: env.UAT_EVIDENCE_CLASS, entries };
  writeFileSync(path.join(captureDir, "manifest.json"), JSON.stringify(manifest, null, 2));
  console.log(`UAT capture complete: ${path.join(captureDir, "manifest.json")}`);
}

main().catch((error) => { console.error(`STOP: ${redact(error.message)}`); process.exit(1); });
