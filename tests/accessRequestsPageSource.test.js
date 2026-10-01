import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (p) => readFileSync(new URL(p, import.meta.url), "utf8");
const page = read("../src/pages/AdminAccessRequestsPage.jsx");
const admin = read("../src/pages/AdminPage.jsx");
const reset = read("../src/pages/ResetPassword.jsx");
const html = read("../index.html");

test("approve is called with a decision object, and Client Viewer needs a client before Approve is enabled", () => {
  assert.match(page, /accessRequests\.approve\(r\.id, \{ role, client_id:/);
  assert.match(page, /disabled=\{busy \|\| needsClient\}/);
});

test("errors are shown inline with retry, not in blocking alert() dialogs", () => {
  assert.equal(page.includes("alert("), false);
  assert.match(page, /Try again/);
  assert.match(page, /role="alert"/);
});

test("a notification deep link opens the tab, focuses the request, and says so honestly when it is gone", () => {
  assert.match(admin, /searchParams\.get\("tab"\)/);
  assert.match(admin, /searchParams\.get\("focus"\)/);
  assert.match(admin, /<AdminAccessRequestsPage focusId=\{focusedRequestId\} \/>/);
  assert.match(page, /no longer in the list/);
  assert.match(page, /scrollIntoView/);
});

test("the setup link is shown once from component state and is never persisted or logged", () => {
  for (const banned of ["localStorage", "sessionStorage", "console."]) assert.equal(page.includes(banned), false, banned);
  assert.match(page, /Shown only now/);
  assert.match(page, /Done, hide link/);
});

test("the reset page reads the token from the URL fragment, then removes it from the address bar", () => {
  assert.match(reset, /window\.location\.hash/);
  assert.match(reset, /history\.replaceState/);
});

test("pages send no referrer, so a setup link cannot leak through Referer headers", () => {
  assert.match(html, /<meta name="referrer" content="no-referrer" \/>/);
});
