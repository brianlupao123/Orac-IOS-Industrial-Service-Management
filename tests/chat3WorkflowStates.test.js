import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const read = (file) => readFileSync(new URL(`../${file}`, import.meta.url), "utf8");

test("Chat 3 uses a visible restricted state for unauthorised deep links", () => {
  const app = read("src/App.jsx");
  const denied = read("src/pages/AccessDeniedPage.jsx");
  assert.match(app, /GuardedRoute/);
  assert.match(app, /path="\/reports" element={<GuardedRoute/);
  assert.match(denied, /data-evidence="forbidden-state"/);
});

test("Chat 3 displays a session-expiry state on the sign-in route", () => {
  const app = read("src/App.jsx");
  const login = read("src/pages/LoginPage.jsx");
  assert.match(app, /setSessionExpired\(true\)/);
  assert.match(login, /data-evidence="session-expired-state"/);
});

test("Chat 3 keeps UAT evidence out of Git and enables export for structured reports", () => {
  assert.match(read(".gitignore"), /^evidence\/uat\/$/m);
  assert.match(read("src/pages/ReportsPage.jsx"), /const canExport = Boolean\(data\)/);
  assert.match(read("src/pages/ReportsPage.jsx"), /data-evidence="reports-page"/);
});
