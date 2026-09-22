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
// Route used to probe the UAT-only empty/error display gate. Chosen because
// inventory.listStockItems() (src/api/client.js) is a VERIFIED array-shaped
// read; whether InventoryPage.jsx itself renders the shared PageEmptyState/
// ErrorBanner components is INFERRED, not verified (that page's source is
// outside this snapshot) — see FINAL_DELIVERY_READINESS.md. If the
// assumption is wrong, the waitFor below times out and the run is recorded
// BLOCKED, never upgraded to PASSED.
const STATE_GATE_ROUTE = "/inventory";
const STATE_GATE_ROLE_KEY = "ADMIN";

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
  if (!isGitIgnored("evidence/uat")) throw new Error("evidence/uat must be ignored by Git.");
}

async function loginAndCapture(browser, baseUrl, role, key, env, captureDir, entries) {
  const email = env[`UAT_${key}_EMAIL`];
  const password = env[`UAT_${key}_PASSWORD`];
  if (!email || !password) {
    entries.push({ id: `dashboard-${key.toLowerCase()}`, role, label: `${role} dashboard`, status: "SKIPPED", detail: "Approved UAT credentials were not supplied for this role.", evidenceClass: env.UAT_EVIDENCE_CLASS });
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
    entries.push({ id: `dashboard-${key.toLowerCase()}`, role, label: `${role} dashboard`, status: "PASSED", detail: "Authenticated role dashboard captured.", screenshot: file, evidenceClass: env.UAT_EVIDENCE_CLASS, capturedAtUtc: new Date().toISOString() });
    if (role === "Client Viewer") {
      await page.goto(`${baseUrl}/reports`, { waitUntil: "networkidle" });
      await page.locator('[data-evidence="forbidden-state"]').waitFor({ timeout: 10000 });
      const forbidden = "client-viewer-forbidden-reports.png";
      await page.screenshot({ path: path.join(captureDir, forbidden), fullPage: true });
      entries.push({ id: "client-viewer-forbidden-reports", role, label: "Client Viewer forbidden report route", status: "PASSED", detail: "Real authenticated low-privilege route check.", screenshot: forbidden, evidenceClass: env.UAT_EVIDENCE_CLASS, capturedAtUtc: new Date().toISOString() });
    }
  } catch (error) {
    entries.push({ id: `dashboard-${key.toLowerCase()}`, role, label: `${role} dashboard`, status: "FAILED", detail: redact(error.message), evidenceClass: env.UAT_EVIDENCE_CLASS, capturedAtUtc: new Date().toISOString() });
  } finally { await page.close(); }
}

// Test-only state-gate captures: empty, error, session-expired. Requires the
// deployed target to be a build produced with `npm run build:uat` (loads
// .env.uat, sets VITE_UAT_STATE_MODE=true). This function never writes to
// the backend itself; it only asks the already-running app, via the
// ?uatState= query param, to short-circuit its own read path or replay its
// own real session-expiry pathway (see src/api/client.js uatState).
async function captureStateGateEvidence(browser, baseUrl, env, captureDir, entries) {
  const email = env[`UAT_${STATE_GATE_ROLE_KEY}_EMAIL`];
  const password = env[`UAT_${STATE_GATE_ROLE_KEY}_PASSWORD`];
  if (!email || !password) {
    for (const id of ["state-empty", "state-error", "session-expired"]) {
      entries.push({ id, label: id, status: "SKIPPED", detail: `Approved UAT credentials for ${STATE_GATE_ROLE_KEY} were not supplied.`, evidenceClass: env.UAT_EVIDENCE_CLASS });
    }
    return;
  }

  async function withAuthenticatedPage(run) {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    try {
      await page.goto(`${baseUrl}/login`, { waitUntil: "networkidle" });
      await page.locator('input[type="email"]').fill(email);
      await page.locator('input[type="password"]').fill(password);
      await page.getByRole("button", { name: "Sign in" }).click();
      await page.locator('[data-evidence="dashboard-ready"]').waitFor({ timeout: 15000 });
      await run(page);
    } finally { await page.close(); }
  }

  for (const [id, mode, selector, label, timeoutMs] of [
    ["state-empty", "empty", '[data-evidence="table-empty-state"]', "Deterministic empty state", 10000],
    ["state-error", "error", '[data-evidence="page-error-state"]', "Deterministic API error state", 10000]
  ]) {
    try {
      await withAuthenticatedPage(async (page) => {
        await page.goto(`${baseUrl}${STATE_GATE_ROUTE}?uatState=${mode}`, { waitUntil: "networkidle" });
        await page.locator(selector).waitFor({ timeout: timeoutMs });
        const file = `${id}.png`;
        await page.screenshot({ path: path.join(captureDir, file), fullPage: true });
        entries.push({ id, label, status: "PASSED", detail: `${label} rendered via VITE_UAT_STATE_MODE, no backend write.`, screenshot: file, evidenceClass: env.UAT_EVIDENCE_CLASS, capturedAtUtc: new Date().toISOString() });
      });
    } catch (error) {
      entries.push({ id, label, status: "BLOCKED", detail: redact(`${error.message} (target may not be a build:uat build, or the consuming page may not use the shared empty/error components).`), evidenceClass: env.UAT_EVIDENCE_CLASS, capturedAtUtc: new Date().toISOString() });
    }
  }

  try {
    await withAuthenticatedPage(async (page) => {
      await page.goto(`${baseUrl}/?uatState=session-expired`, { waitUntil: "networkidle" });
      await page.locator('[data-evidence="session-expired-state"]').waitFor({ timeout: 10000 });
      const file = "session-expired.png";
      await page.screenshot({ path: path.join(captureDir, file), fullPage: true });
      entries.push({ id: "session-expired", label: "Session expiry", status: "PASSED", detail: "App's real session-expiry pathway (clearSession + listeners) replayed via VITE_UAT_STATE_MODE; no credentials or tokens were fabricated.", screenshot: file, evidenceClass: env.UAT_EVIDENCE_CLASS, capturedAtUtc: new Date().toISOString() });
    });
  } catch (error) {
    entries.push({ id: "session-expired", label: "Session expiry", status: "BLOCKED", detail: redact(`${error.message} (target may not be a build:uat build).`), evidenceClass: env.UAT_EVIDENCE_CLASS, capturedAtUtc: new Date().toISOString() });
  }
}

async function main() {
  const envArg = process.argv.indexOf("--env");
  const envFile = envArg >= 0 ? process.argv[envArg + 1] : ".env.uat.local";
  if (!envFile || !existsSync(path.resolve(root, envFile))) throw new Error(`Environment file not found: ${envFile}`);
  assertSafeWorkspace(envFile);
  const env = parseEnv(path.resolve(root, envFile));
  if (!allowedEvidenceClasses.has(env.UAT_EVIDENCE_CLASS)) throw new Error("UAT_EVIDENCE_CLASS must be LOCAL_UAT, ISOLATED_STAGING, or DEPLOYED_PILOT.");
  const classArg = process.argv.indexOf("--evidence-class");
  const cliEvidenceClass = classArg >= 0 ? process.argv[classArg + 1] : null;
  if (!cliEvidenceClass) throw new Error("--evidence-class is required and must match UAT_EVIDENCE_CLASS in the environment file.");
  if (cliEvidenceClass !== env.UAT_EVIDENCE_CLASS) throw new Error(`--evidence-class (${cliEvidenceClass}) does not match UAT_EVIDENCE_CLASS (${env.UAT_EVIDENCE_CLASS}).`);
  if (!/^https:\/\//.test(env.UAT_BASE_URL || "")) throw new Error("UAT_BASE_URL must be an HTTPS deployed portal URL.");
  const captureId = `UAT-${new Date().toISOString().replace(/[:.]/g, "-")}`;
  const captureDir = path.join(root, "evidence", "uat", captureId);
  mkdirSync(captureDir, { recursive: true });
  const entries = [];
  const browser = await chromium.launch({ headless: true });
  try {
    const baseUrl = env.UAT_BASE_URL.replace(/\/$/, "");
    for (const [role, key] of roles) await loginAndCapture(browser, baseUrl, role, key, env, captureDir, entries);
    await captureStateGateEvidence(browser, baseUrl, env, captureDir, entries);
  } finally { await browser.close(); }
  const manifest = { captureId, timestampUtc: new Date().toISOString(), hostname: new URL(env.UAT_BASE_URL).hostname, evidenceClass: env.UAT_EVIDENCE_CLASS, entries };
  writeFileSync(path.join(captureDir, "manifest.json"), JSON.stringify(manifest, null, 2));
  console.log(`UAT capture complete: ${path.join(captureDir, "manifest.json")}`);
}

main().catch((error) => { console.error(`STOP: ${redact(error.message)}`); process.exit(1); });
