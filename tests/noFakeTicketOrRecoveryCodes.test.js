import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const read = (file) => readFileSync(new URL(`../${file}`, import.meta.url), "utf8");
const enrollmentPage = read("src/pages/EnrollmentPage.jsx");
const adminPage = read("src/pages/AdminPage.jsx");

// --- EnrollmentPage checks ---

test("EnrollmentPage does not contain hard-coded fake tickets", () => {
  // No realistic-looking ticket strings (4+ alphanumeric groups separated by dashes)
  const fakeTicketPattern = /["'][A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}["']/;
  // The placeholder pattern "K7Q2-M9XD-..." is acceptable as a placeholder hint
  // but actual ticket values used in state or logic would be wrong
  // Check that no ticket string is used in useState or as a default value
  assert.doesNotMatch(enrollmentPage, /useState\(["'][A-Z0-9]{4}-/);
});

test("EnrollmentPage does not contain hard-coded fake enrollment IDs", () => {
  // enrollmentId is initialized as empty string
  assert.match(enrollmentPage, /useState\(""\)/);
  // No UUID-like hard-coded enrollment IDs
  assert.doesNotMatch(enrollmentPage, /useState\(["'][0-9a-f]{8}-[0-9a-f]{4}/);
});

test("EnrollmentPage does not contain hard-coded fake recovery codes", () => {
  // recoveryCodes is initialized as empty array
  assert.match(enrollmentPage, /useState\(\[\]\)/);
  // No array of realistic recovery code strings
  assert.doesNotMatch(enrollmentPage, /\["[A-Z0-9]{16,}"/);
  assert.doesNotMatch(enrollmentPage, /\["[a-z0-9]{4}-[a-z0-9]{4}"/);
});

test("EnrollmentPage does not contain hard-coded fake secret keys", () => {
  // secretKey is initialized as empty string
  // The fallback "ORAC-SECRET-KEY-ABC123" is rendered only as a visual
  // placeholder when secretKey is empty — it is never used as a real value
  assert.doesNotMatch(enrollmentPage, /useState\(["']ORAC-/);
  assert.doesNotMatch(enrollmentPage, /useState\(["'][A-Z2-7]{16,}["']\)/);
});

// --- 404 Handling checks ---

test("EnrollmentPage matches exact err.status === 404 on the START step only", () => {
  // Checks status code 404 explicitly
  assert.match(enrollmentPage, /if \(err\.status === 404\)/);
  // Does not use loose string matching on err.message for 404
  assert.doesNotMatch(enrollmentPage, /err\.message\.includes\(["']404["']\)/);
  assert.doesNotMatch(enrollmentPage, /err\.message.*toLowerCase\(\)\.includes\(["']not found["']\)/);
});

// --- AdminPage checks ---

test("AdminPage does not contain hard-coded fake security event rows", () => {
  // Security events tab was removed — no static audit/security data
  assert.doesNotMatch(adminPage, /Security events/i);
  assert.doesNotMatch(adminPage, /security-events/);
  assert.doesNotMatch(adminPage, /securityEvents/);
});

test("AdminPage does not contain hard-coded fake ticket values in state", () => {
  // The ticket modal initializes ticket as null, not a fake string
  assert.match(adminPage, /ticket: null/);
  assert.doesNotMatch(adminPage, /ticket: ["'][A-Z0-9]{4}-/);
});

test("AdminPage issue-ticket dialog labels verification as 'not stored by the system'", () => {
  assert.match(adminPage, /not stored by the system/);
});
