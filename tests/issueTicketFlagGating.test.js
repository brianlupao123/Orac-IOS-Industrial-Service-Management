import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const adminSrc = readFileSync(
  resolve(import.meta.dirname, "..", "src", "pages", "AdminPage.jsx"),
  "utf8"
);

describe("AdminPage Issue-ticket flag gating", () => {
  it("imports totpEnrollmentUiEnabled from totpFlags", () => {
    assert.match(
      adminSrc,
      /import\s*\{[^}]*totpEnrollmentUiEnabled[^}]*\}\s*from\s*["']\.\.\/totpFlags(?:\.js)?["']/,
      "AdminPage.jsx must import totpEnrollmentUiEnabled from ../totpFlags"
    );
  });

  it("Issue ticket button is gated by totpEnrollmentUiEnabled()", () => {
    // The "Issue ticket" button text on its own line, with </Button> on a subsequent line
    const idx = adminSrc.indexOf(">\n                            Issue ticket\n");
    assert.ok(idx !== -1, '"Issue ticket" button text must exist in AdminPage.jsx');
    const before = adminSrc.slice(Math.max(0, idx - 500), idx);
    assert.match(
      before,
      /totpEnrollmentUiEnabled\(\)/,
      'The "Issue ticket" button must be guarded by totpEnrollmentUiEnabled()'
    );
  });

  it("Enrollment ticket modal is gated by totpEnrollmentUiEnabled()", () => {
    const modalIdx = adminSrc.indexOf("Issue Enrollment Ticket Modal");
    assert.ok(modalIdx !== -1, "Issue Enrollment Ticket Modal comment must exist");
    const after = adminSrc.slice(modalIdx, modalIdx + 200);
    assert.match(
      after,
      /totpEnrollmentUiEnabled\(\)/,
      "The enrollment ticket modal must be wrapped in a totpEnrollmentUiEnabled() guard"
    );
  });

  it("modal closing brace matches the flag guard", () => {
    // Verify the flag guard wraps around </Modal> by checking for
    // </Modal>\n      )} which is the closing of the conditional
    assert.match(
      adminSrc,
      /<\/Modal>\s*\n\s*\)\}/,
      "The </Modal> must be followed by )} closing the totpEnrollmentUiEnabled() guard"
    );
  });
});
