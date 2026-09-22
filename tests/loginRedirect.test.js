import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const loginPage = readFileSync(new URL("../src/pages/LoginPage.jsx", import.meta.url), "utf8");

test("successful login replaces the login route with the dashboard", () => {
  assert.match(loginPage, /useNavigate/);
  assert.match(loginPage, /onLogin\(user\);\s*navigate\("\/", \{ replace: true \}\);/);
});
