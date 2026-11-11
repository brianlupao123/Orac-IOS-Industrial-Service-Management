import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const read = (file) => readFileSync(new URL(`../${file}`, import.meta.url), "utf8");
const loginPage = read("src/pages/LoginPage.jsx");
const flagsFile = read("src/totpFlags.js");

test("LoginPage imports the TOTP enrollment UI flag", () => {
  assert.match(loginPage, /import \{ totpEnrollmentUiEnabled \} from ["']\.\.\/totpFlags/);
});

test("LoginPage gates the 'Set up authenticator' link behind totpEnrollmentUiEnabled()", () => {
  // The link must be inside a totpEnrollmentUiEnabled() conditional
  assert.match(loginPage, /totpEnrollmentUiEnabled\(\) &&/);
  // The link target must be /enroll
  assert.match(loginPage, /to=["']\/enroll["']/);
  // The text must reference authenticator setup
  assert.match(loginPage, /Set up authenticator/);
});

test("The link to /enroll is not rendered unconditionally", () => {
  // There should be no <Link to="/enroll"> outside the flag guard
  // Split by the flag guard and check: the link must only appear after the guard
  const lines = loginPage.split("\n");
  let foundGuard = false;
  let foundLinkBeforeGuard = false;
  for (const line of lines) {
    if (line.includes("totpEnrollmentUiEnabled()")) {
      foundGuard = true;
    }
    if (!foundGuard && line.includes('to="/enroll"')) {
      foundLinkBeforeGuard = true;
    }
  }
  assert.ok(foundGuard, "totpEnrollmentUiEnabled() guard must be present");
  assert.ok(!foundLinkBeforeGuard, "/enroll link must not appear before the flag guard");
});

test("TOTP flag file reads VITE_ORAC_TOTP_ENROLLMENT_UI and compares to 'enabled'", () => {
  assert.match(flagsFile, /VITE_ORAC_TOTP_ENROLLMENT_UI/);
  assert.match(flagsFile, /=== "enabled"/);
});

test("TOTP flag defaults to off (function returns false when env var is unset)", () => {
  // The flag function must not default to true or return true without checking
  assert.doesNotMatch(flagsFile, /return true/);
  // It checks equality to "enabled", so unset means it returns false
  assert.match(flagsFile, /=== "enabled"/);
});
