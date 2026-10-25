import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const read = (file) => fs.readFileSync(new URL(`../${file}`, import.meta.url), "utf8");
const exists = (file) => fs.existsSync(new URL(`../${file}`, import.meta.url));

test("the app has installable icons and an apple touch icon", () => {
  const manifest = JSON.parse(read("public/manifest.json"));
  assert.deepEqual(manifest.icons.map((i) => `${i.sizes}:${i.purpose}`), ["192x192:any", "512x512:any", "512x512:maskable"]);
  for (const icon of manifest.icons) assert.ok(exists(`public${icon.src}`), icon.src);
  assert.match(read("index.html"), /rel="apple-touch-icon"/);
});

test("auth fields allow password managers and paste, with labels tied to inputs", () => {
  const login = read("src/pages/LoginPage.jsx");
  assert.match(login, /htmlFor="login-email"/);
  assert.match(login, /id="login-email"[\s\S]*autoComplete="username"/);
  assert.match(login, /autoComplete="current-password"/);
  assert.match(read("src/pages/ResetPassword.jsx"), /autoComplete="new-password"[\s\S]*autoComplete="new-password"/);
  assert.match(read("src/pages/ForgotPassword.jsx"), /htmlFor="forgot-email"/);
  for (const file of ["LoginPage", "ResetPassword", "ForgotPassword", "RequestAccess"]) {
    assert.doesNotMatch(read(`src/pages/${file}.jsx`), /onPaste|onCopy/, file);
  }
});

test("the style guide states the hierarchy rule and makes no currency claim", () => {
  const guide = read("STYLE_GUIDE.md");
  assert.match(guide, /name and meaning first, count second/);
  assert.match(guide, /real quantities/);
  assert.match(guide, /currency symbol is not changed by presentation work/i);
  assert.doesNotMatch(guide, /\$12,500|never an "R"|Never `toLocaleString/i);
});
