import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const panel = read("src/components/ServiceRequestPanel.jsx");
const triage = read("src/pages/ServiceRequestTriagePage.jsx");
const app = read("src/App.jsx");
const portal = read("src/pages/ClientPortalPage.jsx");
const client = read("src/api/client.js");
const newUi = { "ServiceRequestPanel.jsx": panel, "ServiceRequestTriagePage.jsx": triage, "serviceRequestModel.js": read("src/serviceRequestModel.js") };

test("new service-request UI never calls fetch, reads tokens or storage, or hard-codes identities", () => {
  for (const [name, code] of Object.entries(newUi)) {
    assert.doesNotMatch(code, /\bfetch\s*\(/, `${name}: raw fetch`);
    assert.doesNotMatch(code, /localStorage|sessionStorage|getToken|orac_token|Authorization/, `${name}: token/storage access`);
    assert.doesNotMatch(code, /["'`](?:u_|c_)[a-z0-9_]+["'`]/i, `${name}: hard-coded user or client id`);
    assert.doesNotMatch(code, /["']Bearer/, `${name}: authorization header`);
  }
});

test("the UI does not enforce tenancy or roles in the browser", () => {
  for (const [name, code] of Object.entries(newUi)) {
    assert.doesNotMatch(code, /\.client_id\s*[!=]==?|client_id\s*[!=]==?\s*/, `${name}: client-side tenant comparison`);
    assert.doesNotMatch(code, /user\??\.(role|client_id)|getCachedUser/, `${name}: reads the current user to filter data`);
    assert.doesNotMatch(code, /\.filter\(/, `${name}: browser-side filtering of records`);
  }
});

test("the client panel and triage page use only the approved API operations", () => {
  assert.match(panel, /serviceRequests\.mine\(\)/);
  assert.match(panel, /serviceRequests\.create\(buildServiceRequestPayload\(form\)\)/);
  assert.doesNotMatch(panel, /serviceRequests\.(triage|triageDecision|convertToLead)/);
  assert.match(triage, /serviceRequests\.triage\(/);
  assert.match(triage, /serviceRequests\.triageDecision\(/);
  assert.match(triage, /serviceRequests\.convertToLead\(/);
  assert.doesNotMatch(triage, /serviceRequests\.(create|mine)/);
  assert.doesNotMatch(triage + panel, /collections\.list|quotes\.|leads\.create|dispatch\.|admin\./, "no other API is used");
});

test("both screens implement real loading, error, empty and submitting/working states", () => {
  for (const code of [panel, triage]) {
    assert.match(code, /setLoading\(true\)/);
    assert.match(code, /ErrorBanner/);
    assert.match(code, /PageEmptyState/);
  }
  assert.match(panel, /submitting/);
  assert.match(panel, /role="status"/);
  assert.match(triage, /busyId/);
  assert.match(triage, /role="status"/);
});

test("conversion needs an explicit confirmation and states what it does not create", () => {
  assert.match(triage, /Confirm conversion/);
  assert.match(triage, /one<\/strong> lead/);
  assert.match(triage, /does not create a quote, purchase order, dispatch, invoice, email or notification/);
});

test("the guarded route and the portal panel are wired in", () => {
  assert.match(app, /import ServiceRequestTriagePage from "\.\/pages\/ServiceRequestTriagePage\.jsx"/);
  assert.match(app, /<Route path="\/service-requests" element=\{<GuardedRoute user=\{user\} path="\/service-requests"><ServiceRequestTriagePage \/><\/GuardedRoute>\} \/>/);
  assert.match(portal, /import ServiceRequestPanel from "\.\.\/components\/ServiceRequestPanel\.jsx"/);
  assert.match(portal, /<ServiceRequestPanel \/>/);
  assert.doesNotMatch(app.split("\n").filter((line) => line.includes("/service-requests")).join("\n"), /path="\/portal"/);
});

test("client.js gained only the serviceRequests object and still has no service-request URL outside it", () => {
  const [outside, block] = client.split("export const serviceRequests");
  assert.doesNotMatch(outside, /service-requests/);
  const paths = [...block.matchAll(/request\(\s*[`"]([^`"]*)/g)]
    .map((match) => match[1].replace(/\$\{[^}]*\}/g, ":id").replace(/\$\{.*$/, ""));
  assert.deepEqual(paths.sort(), [
    "/service-requests", "/service-requests/:id/convert-lead", "/service-requests/:id/triage", "/service-requests/mine", "/service-requests/triage"
  ].sort());
});
