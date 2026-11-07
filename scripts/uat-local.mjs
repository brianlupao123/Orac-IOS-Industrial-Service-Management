#!/usr/bin/env node
import { execSync, spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import http from "node:http";
import { createRequire } from "node:module";

const ROOT = process.cwd();
const BACKEND_DIR = process.env.ORAC_BACKEND_DIR || "C:\\Users\\BRIAN LUPAO\\Desktop\\ffims-asset-register\\two-concept-packet-backend-20261005-235259";
const TEMP_DIR = path.resolve(ROOT, "../_uat-run");
const PORT = 5176;
const isServeOnly = process.argv.includes("--serve");

console.log("[uat-local] Starting local UAT harness...");
console.log(`[uat-local] Root: ${ROOT}`);
console.log(`[uat-local] Backend source: ${BACKEND_DIR}`);
console.log(`[uat-local] Temp copy: ${TEMP_DIR}`);
console.log(`[uat-local] Mode: ${isServeOnly ? "serve (long-running)" : "audit (single-run)"}`);

// 1. Verify backend source exists
if (!fs.existsSync(BACKEND_DIR)) {
  console.error(`[uat-local] ERROR: Backend folder not found at ${BACKEND_DIR}`);
  process.exit(1);
}

// 2. Read backend's server.js and verify SPA / public serving lines
const serverJsPath = path.join(BACKEND_DIR, "server.js");
if (!fs.existsSync(serverJsPath)) {
  console.error(`[uat-local] ERROR: server.js not found in ${BACKEND_DIR}`);
  process.exit(1);
}
const serverJsContent = fs.readFileSync(serverJsPath, "utf8");
const lines = serverJsContent.split(/\r?\n/);
let staticLineNum = -1;
let spaFallbackLineNum = -1;
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes("express.static(publicDir)")) {
    staticLineNum = i + 1;
  }
  if (lines[i].includes("sendFile(join(publicDir, \"index.html\"))")) {
    spaFallbackLineNum = i + 1;
  }
}

if (staticLineNum === -1 || spaFallbackLineNum === -1) {
  console.error(`[uat-local] ERROR: backend server.js does not serve static publicDir or SPA fallback.`);
  console.error(`[uat-local] staticLineNum: ${staticLineNum}, spaFallbackLineNum: ${spaFallbackLineNum}`);
  process.exit(1);
}
console.log(`[uat-local] Backend server.js confirmed: static assets served at line ${staticLineNum}, SPA fallback served at line ${spaFallbackLineNum}.`);

// 3. Clean up TEMP_DIR safely
if (fs.existsSync(TEMP_DIR)) {
  console.log(`[uat-local] Cleaning previous temp copy at ${TEMP_DIR}...`);
  const tempModules = path.join(TEMP_DIR, "node_modules");
  if (fs.existsSync(tempModules)) {
    try {
      const stat = fs.lstatSync(tempModules);
      if (stat.isSymbolicLink()) {
        fs.unlinkSync(tempModules);
      } else {
        fs.rmdirSync(tempModules);
      }
    } catch {
      try {
        if (process.platform === "win32") {
          execSync(`cmd /c rmdir "${tempModules}"`, { stdio: "ignore" });
        }
      } catch {}
    }
  }
  fs.rmSync(TEMP_DIR, { recursive: true, force: true });
}

// 4. Copy backend source to TEMP_DIR excluding node_modules and .git
console.log(`[uat-local] Staging backend files into ${TEMP_DIR}...`);
fs.mkdirSync(TEMP_DIR, { recursive: true });
fs.cpSync(BACKEND_DIR, TEMP_DIR, {
  recursive: true,
  filter: (src) => {
    const rel = path.relative(BACKEND_DIR, src);
    if (!rel) return true;
    const parts = rel.split(path.sep);
    if (parts.includes("node_modules") || parts.includes(".git")) return false;
    return true;
  }
});

// Link node_modules
const tempNodeModules = path.join(TEMP_DIR, "node_modules");
const backendNodeModules = path.join(BACKEND_DIR, "node_modules");
if (fs.existsSync(backendNodeModules)) {
  if (process.platform === "win32") {
    execSync(`cmd /c mklink /J "${tempNodeModules}" "${backendNodeModules}"`, { stdio: "pipe" });
  } else {
    fs.symlinkSync(backendNodeModules, tempNodeModules, "junction");
  }
} else {
  console.error(`[uat-local] WARNING: backend node_modules not found at ${backendNodeModules}`);
}

// 5. Build frontend and copy dist/ into TEMP_DIR/public
const apiBase = (process.env.VITE_API_BASE_URL || `http://127.0.0.1:${PORT}/api`).replace(/\/$/, "");
const viteApiBaseUrl = apiBase.endsWith("/api") ? apiBase : `${apiBase}/api`;
console.log(`[uat-local] Building frontend with VITE_API_BASE_URL=${viteApiBaseUrl}...`);
execSync("npm run build", {
  cwd: ROOT,
  stdio: "inherit",
  env: { ...process.env, VITE_API_BASE_URL: viteApiBaseUrl }
});

const distDir = path.join(ROOT, "dist");
const publicDir = path.join(TEMP_DIR, "public");
fs.mkdirSync(publicDir, { recursive: true });
fs.cpSync(distDir, publicDir, { recursive: true });
console.log(`[uat-local] Frontend build copied to ${publicDir}`);

// 6. Make accounts for all 8 roles exist in TEMP copy data/db.json
console.log(`[uat-local] Seeding fixture accounts into temp database...`);
const auditScriptPath = path.join(ROOT, "scripts", "ui_visual_audit.mjs");
const auditScriptContent = fs.readFileSync(auditScriptPath, "utf8");

function extractPattern(src, pattern, fallback) {
  const match = src.match(pattern);
  return match ? match[1] : fallback;
}

const financeEmail = process.env.ORAC_VISUAL_AUDIT_EMAIL || extractPattern(auditScriptContent, /ORAC_VISUAL_AUDIT_EMAIL\s*\|\|\s*["']([^"']+)["']/, "phase5-uat-finance@fixture.invalid");
const adminEmail = process.env.ORAC_VISUAL_AUDIT_ADMIN_EMAIL || extractPattern(auditScriptContent, /ORAC_VISUAL_AUDIT_ADMIN_EMAIL\s*\|\|\s*["']([^"']+)["']/, "phase5-uat-admin@fixture.invalid");
const salesEmail = process.env.ORAC_VISUAL_AUDIT_SALES_EMAIL || extractPattern(auditScriptContent, /ORAC_VISUAL_AUDIT_SALES_EMAIL\s*\|\|\s*["']([^"']+)["']/, "phase5-uat-sales@fixture.invalid");
const clientEmail = process.env.ORAC_VISUAL_AUDIT_CLIENT_EMAIL || extractPattern(auditScriptContent, /ORAC_VISUAL_AUDIT_CLIENT_EMAIL\s*\|\|\s*["']([^"']+)["']/, "phase5-uat-client-viewer@fixture.invalid");
const operationsEmail = process.env.ORAC_VISUAL_AUDIT_OPERATIONS_EMAIL || extractPattern(auditScriptContent, /ORAC_VISUAL_AUDIT_OPERATIONS_EMAIL\s*\|\|\s*["']([^"']+)["']/, "phase5-uat-operations@fixture.invalid");
const supervisorEmail = process.env.ORAC_VISUAL_AUDIT_SUPERVISOR_EMAIL || extractPattern(auditScriptContent, /ORAC_VISUAL_AUDIT_SUPERVISOR_EMAIL\s*\|\|\s*["']([^"']+)["']/, "phase5-uat-supervisor@fixture.invalid");
const technicianEmail = process.env.ORAC_VISUAL_AUDIT_TECHNICIAN_EMAIL || extractPattern(auditScriptContent, /ORAC_VISUAL_AUDIT_TECHNICIAN_EMAIL\s*\|\|\s*["']([^"']+)["']/, "phase5-uat-technician@fixture.invalid");
const auditPassword = process.env.ORAC_VISUAL_AUDIT_PASSWORD || extractPattern(auditScriptContent, /ORAC_VISUAL_AUDIT_PASSWORD\s*\|\|\s*["']([^"']+)["']/, "OracUAT2026!");
const managementEmail = process.env.ORAC_VISUAL_AUDIT_MANAGEMENT_EMAIL || "phase5-uat-management@fixture.invalid";

const tempRequire = createRequire(path.join(TEMP_DIR, "server.js"));
const bcrypt = tempRequire("bcrypt");
const passwordHash = await bcrypt.hash(auditPassword, 10);

const dbPath = path.join(TEMP_DIR, "data", "db.json");
fs.mkdirSync(path.join(TEMP_DIR, "data"), { recursive: true });
let db = {};
if (fs.existsSync(dbPath)) {
  try {
    db = JSON.parse(fs.readFileSync(dbPath, "utf8"));
  } catch {
    db = {};
  }
}
if (!Array.isArray(db.users)) db.users = [];
if (!Array.isArray(db.clients)) db.clients = [];

const clientId = db.clients[0]?.id || "phase5-uat-client";
if (!db.clients.some((c) => c.id === clientId)) {
  db.clients.push({
    id: clientId,
    name: "Phase 5 Fictional Mining Client",
    email: "accounts@phase5-fixture.invalid",
    is_active: true
  });
}

const roleConfigs = [
  { role: "Finance", email: financeEmail, name: "Phase 5 UAT Finance" },
  { role: "Admin", email: adminEmail, name: "Phase 5 UAT Admin" },
  { role: "Management", email: managementEmail, name: "Phase 5 UAT Management" },
  { role: "Sales", email: salesEmail, name: "Phase 5 UAT Sales" },
  { role: "Operations", email: operationsEmail, name: "Phase 5 UAT Operations" },
  { role: "Supervisor", email: supervisorEmail, name: "Phase 5 UAT Supervisor" },
  { role: "Technician", email: technicianEmail, name: "Phase 5 UAT Technician" },
  { role: "Client Viewer", email: clientEmail, name: "Phase 5 UAT Client Viewer", client_id: clientId }
];

for (const rc of roleConfigs) {
  const normEmail = rc.email.trim().toLowerCase();
  const existingIndex = db.users.findIndex((u) => String(u?.email || "").trim().toLowerCase() === normEmail);
  const userRecord = {
    id: existingIndex >= 0 ? db.users[existingIndex].id : `uat-user-${rc.role.toLowerCase().replace(/\s+/g, "-")}`,
    name: rc.name,
    email: rc.email,
    role: rc.role,
    is_active: true,
    password_hash: passwordHash,
    ...(rc.client_id ? { client_id: rc.client_id } : {})
  };
  if (existingIndex >= 0) {
    db.users[existingIndex] = { ...db.users[existingIndex], ...userRecord };
  } else {
    db.users.push(userRecord);
  }
}

fs.writeFileSync(dbPath, JSON.stringify(db, null, 2));
console.log(`[uat-local] Configured ${roleConfigs.length} UAT fixture roles in temporary database.`);

// 7. Start backend server
console.log(`[uat-local] Starting local backend on http://127.0.0.1:${PORT}...`);
const serverProcess = spawn("node", ["server.js"], {
  cwd: TEMP_DIR,
  stdio: ["ignore", "pipe", "pipe"],
  env: {
    ...process.env,
    PORT: String(PORT),
    STORE_DRIVER: "json",
    JSON_DB_PATH: "./data/db.json",
    NODE_ENV: "development",
    CORS_ORIGINS: `http://127.0.0.1:${PORT},http://localhost:${PORT}`
  }
});

serverProcess.stdout.on("data", (data) => {
  const msg = data.toString().trim();
  if (msg) console.log(`[backend] ${msg}`);
});

serverProcess.stderr.on("data", (data) => {
  const msg = data.toString().trim();
  if (msg) console.error(`[backend error] ${msg}`);
});

function stopServer() {
  if (serverProcess && !serverProcess.killed) {
    console.log("[uat-local] Shutting down backend server...");
    try {
      if (process.platform === "win32") {
        execSync(`taskkill /pid ${serverProcess.pid} /T /F`, { stdio: "ignore" });
      } else {
        serverProcess.kill("SIGTERM");
      }
    } catch {}
  }
}

process.on("SIGINT", () => {
  stopServer();
  process.exit(130);
});
process.on("SIGTERM", () => {
  stopServer();
  process.exit(143);
});

// 8. Poll healthz until responsive
async function pollHealthz(maxRetries = 60, intervalMs = 250) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      const res = await new Promise((resolve, reject) => {
        const req = http.get(`http://127.0.0.1:${PORT}/healthz`, (response) => {
          resolve(response.statusCode);
        });
        req.on("error", reject);
        req.setTimeout(1000, () => {
          req.destroy();
          reject(new Error("Timeout"));
        });
      });
      if (res === 200) {
        return true;
      }
    } catch {}
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  return false;
}

const isHealthy = await pollHealthz();
if (!isHealthy) {
  console.error("[uat-local] ERROR: Server failed to start or did not answer /healthz within timeout.");
  stopServer();
  process.exit(1);
}
console.log(`[uat-local] Server is healthy and answering on http://127.0.0.1:${PORT}`);

if (isServeOnly) {
  console.log(`[uat-local] Ready! Server running at http://127.0.0.1:${PORT}. Press Ctrl+C to terminate.`);
} else {
  let auditExitCode = 0;
  try {
    console.log("[uat-local] Executing visual audit (node scripts/ui_visual_audit.mjs)...");
    execSync("node scripts/ui_visual_audit.mjs", {
      cwd: ROOT,
      stdio: "inherit",
      env: {
        ...process.env,
        ORAC_VISUAL_AUDIT_UI_URL: `http://127.0.0.1:${PORT}`
      }
    });
  } catch (err) {
    console.error("[uat-local] Visual audit failed with error.");
    auditExitCode = err.status || 1;
  } finally {
    stopServer();
    process.exit(auditExitCode);
  }
}
