import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const files = {
  "src/internalWorkRequestModel.js": read("src/internalWorkRequestModel.js"),
  "src/components/InternalRequestForm.jsx": read("src/components/InternalRequestForm.jsx"),
  "src/components/InternalRequestCard.jsx": read("src/components/InternalRequestCard.jsx"),
  "src/pages/InternalRequestsPage.jsx": read("src/pages/InternalRequestsPage.jsx")
};
const model = files["src/internalWorkRequestModel.js"];
const form = files["src/components/InternalRequestForm.jsx"];
const card = files["src/components/InternalRequestCard.jsx"];
const page = files["src/pages/InternalRequestsPage.jsx"];
const app = read("src/App.jsx");
const client = read("src/api/client.js");
const ui = { "InternalRequestForm.jsx": form, "InternalRequestCard.jsx": card, "InternalRequestsPage.jsx": page };

// Code without comments, so a comment naming a rule cannot satisfy or trip a check.
const stripComments = (code) => code.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`])\/\/[^\n]*/g, "$1");
// "Technician Registry" is the name of the registry the approval button adds to, not a role check.
const withoutProductPhrases = (code) => code.replace(/Technician Registry/g, "");
const ROLE_WORDS = /\b(Admin|Management|Sales|Finance|Operations|Supervisor|Technician|Client Viewer)\b/;
const TYPE_CODES = /STOCK_AVAILABILITY|STOCK_FULFILMENT|PO_AMENDMENT_CONFIRMATION|MATERIAL_RECONCILIATION|FIELD_CLARIFICATION|COMMERCIAL_CLARIFICATION|ADMINISTRATIVE_SUPPORT/;

// Every opening <button ...> tag, read with brace depth so `=>` inside an
// onClick does not end the tag early.
function buttonTags(source) {
  const tags = [];
  for (let index = source.indexOf("<button"); index !== -1; index = source.indexOf("<button", index + 1)) {
    let depth = 0; let quote = null; let end = index;
    for (; end < source.length; end += 1) {
      const char = source[end];
      if (quote) { if (char === quote) quote = null; continue; }
      if (char === '"' || char === "'") { quote = char; continue; }
      if (char === "{") depth += 1;
      else if (char === "}") depth -= 1;
      else if (char === ">" && depth === 0 && source[end - 1] !== "=") break;
    }
    tags.push(source.slice(index, end + 1));
  }
  return tags;
}

// ---- Reading client.js as executable code ------------------------------------
// client.js carries documentation comments that name endpoints and helpers,
// including "request()". A source check has to judge what runs, not what is
// written about it, so every character is classified as code ("c"), text inside a
// string, template or regex ("s"), or comment ("k"). This is a small scanner for
// this one file, not a JavaScript parser: it does not treat a slash after a
// keyword such as `return` as a regex, which client.js never needs.
function classify(source) {
  const n = source.length;
  const mask = new Array(n).fill("c");
  const REGEX_AFTER = "(,=:[!&|?{};+-*%<>~^";
  let i = 0;
  let prev = "";

  function scanTemplate() {
    while (i < n) {
      const ch = source[i];
      if (ch === "\\") { mask[i] = "s"; if (i + 1 < n) mask[i + 1] = "s"; i += 2; continue; }
      if (ch === "`") { mask[i] = "s"; i += 1; return; }
      if (ch === "$" && source[i + 1] === "{") {
        mask[i] = "s"; mask[i + 1] = "s"; i += 2;
        scanCode(true);
        if (i < n) mask[i] = "s"; // the "}" that closes the expression
        i += 1;
        continue;
      }
      mask[i] = "s"; i += 1;
    }
  }

  function scanRegex() {
    let inClass = false;
    mask[i] = "s"; i += 1;
    while (i < n) {
      const ch = source[i];
      mask[i] = "s";
      if (ch === "\\") { if (i + 1 < n) mask[i + 1] = "s"; i += 2; continue; }
      if (ch === "[") inClass = true;
      else if (ch === "]") inClass = false;
      else if (ch === "/" && !inClass) {
        i += 1;
        while (i < n && /[a-z]/i.test(source[i])) { mask[i] = "s"; i += 1; }
        return;
      }
      i += 1;
    }
  }

  function scanCode(inExpression) {
    let depth = 0;
    while (i < n) {
      const ch = source[i];
      const next = source[i + 1];
      if (ch === "/" && next === "/") { while (i < n && source[i] !== "\n") { mask[i] = "k"; i += 1; } continue; }
      if (ch === "/" && next === "*") {
        const close = source.indexOf("*/", i + 2);
        const stop = close === -1 ? n : close + 2;
        for (; i < stop; i += 1) if (source[i] !== "\n") mask[i] = "k";
        continue;
      }
      if (ch === '"' || ch === "'") {
        mask[i] = "s"; i += 1;
        while (i < n && source[i] !== ch) {
          mask[i] = "s";
          if (source[i] === "\\" && i + 1 < n) { i += 1; mask[i] = "s"; }
          i += 1;
        }
        if (i < n) mask[i] = "s";
        i += 1; prev = ch;
        continue;
      }
      if (ch === "`") { mask[i] = "s"; i += 1; scanTemplate(); prev = "`"; continue; }
      if (ch === "/" && (prev === "" || REGEX_AFTER.includes(prev))) { scanRegex(); prev = ")"; continue; }
      if (ch === "{") depth += 1;
      else if (ch === "}") {
        if (inExpression && depth === 0) return;
        depth -= 1;
      }
      if (!/\s/.test(ch)) prev = ch;
      i += 1;
    }
  }

  scanCode(false);
  return mask;
}

// Same length as `source`, so offsets line up. Characters whose class is not in
// `keep` become spaces (newlines stay).
const blankBy = (source, mask, keep) => source.split("").map((ch, k) => (ch === "\n" || keep.includes(mask[k]) ? ch : " ")).join("");
const squash = (text) => text.replace(/\s+/g, " ").trim();

const clientMask = classify(client);
const clientCode = blankBy(client, clientMask, "cs"); // executable code, strings kept, comments gone
const clientStructure = blankBy(client, clientMask, "c"); // code only: strings, templates, regexes and comments blanked

// Index of the bracket that closes the one at `openIndex`, counting code characters only.
function closeOf(openIndex) {
  const open = client[openIndex];
  const close = { "(": ")", "{": "}", "[": "]" }[open];
  let depth = 0;
  for (let k = openIndex; k < client.length; k += 1) {
    if (clientMask[k] !== "c") continue;
    if (client[k] === open) depth += 1;
    else if (client[k] === close) { depth -= 1; if (depth === 0) return k; }
  }
  throw new Error(`No closing bracket for offset ${openIndex}`);
}

// Top-level arguments between `from` and `to` (the text inside a call's parentheses).
function topLevelArgs(from, to) {
  const spans = [];
  let depth = 0;
  let start = from;
  for (let k = from; k < to; k += 1) {
    if (clientMask[k] !== "c") continue;
    const ch = client[k];
    if ("([{".includes(ch)) depth += 1;
    else if (")]}".includes(ch)) depth -= 1;
    else if (ch === "," && depth === 0) { spans.push([start, k]); start = k + 1; }
  }
  spans.push([start, to]);
  return spans.map(([a, b]) => squash(clientCode.slice(a, b))).filter((text) => text !== "");
}

// Methods of an object literal, found at its top level.
function methodsOf(open, close) {
  const methods = [];
  let k = open + 1;
  while (k < close) {
    while (k < close && (/\s/.test(client[k]) || clientMask[k] === "k" || client[k] === ",")) k += 1;
    if (k >= close) break;
    const name = /^[A-Za-z_$][\w$]*/.exec(client.slice(k, close))?.[0];
    if (!name) throw new Error(`Unrecognised member at offset ${k}`);
    let p = k + name.length;
    while (/\s/.test(client[p])) p += 1;
    if (client[p] !== "(") throw new Error(`Member ${name} is not a method`);
    let q = closeOf(p) + 1;
    while (/\s/.test(client[q])) q += 1;
    if (client[q] !== "{") throw new Error(`Method ${name} has no body`);
    const end = closeOf(q) + 1;
    methods.push({ name, start: k, end });
    k = end;
  }
  return methods;
}

// The Internal Work Requests section: the base-path constant, the list-path helper
// and the exported object, located by their declarations rather than by comment text.
const baseDeclarations = [...clientCode.matchAll(/\bconst internalRequestBase\b/g)];
const objectDeclarations = [...clientCode.matchAll(/\bexport const internalWorkRequests\b/g)];
const sectionStart = baseDeclarations[0]?.index ?? -1;
const objectOpen = objectDeclarations[0] ? clientCode.indexOf("{", objectDeclarations[0].index) : -1;
const objectClose = objectOpen === -1 ? -1 : closeOf(objectOpen);
const sectionEnd = objectClose === -1 ? -1 : objectClose + 2; // includes the ";" after "}"
const contractsAt = clientCode.search(/\bexport const contracts\b/);

// Raw text of the section including the comment lines directly above it, for the ASCII check.
let rawStart = client.lastIndexOf("\n", sectionStart - 1) + 1;
for (;;) {
  const previousEnd = rawStart - 1;
  if (previousEnd <= 0) break;
  const previousStart = client.lastIndexOf("\n", previousEnd - 1) + 1;
  if (!client.slice(previousStart, previousEnd).trimStart().startsWith("//")) break;
  rawStart = previousStart;
}
const apiBlock = client.slice(rawStart, sectionEnd);

test("new internal-request files are ASCII only", () => {
  for (const [name, code] of Object.entries(files)) assert.doesNotMatch(code, /[^\x00-\x7F]/, name);
  assert.doesNotMatch(apiBlock, /[^\x00-\x7F]/, "internalWorkRequests block in client.js");
});

test("new UI never calls fetch, reads tokens or storage, alerts, reloads or swallows failures", () => {
  for (const [name, code] of Object.entries(files)) {
    const body = stripComments(code);
    assert.doesNotMatch(body, /\bfetch\s*\(/, `${name}: raw fetch`);
    assert.doesNotMatch(body, /localStorage|sessionStorage|getToken|orac_token|Authorization|["']Bearer/, `${name}: token or storage access`);
    assert.doesNotMatch(body, /\balert\s*\(|\bconfirm\s*\(|location\.reload|window\.location/, `${name}: alert, confirm or reload`);
    assert.doesNotMatch(body, /\.catch\s*\(/, `${name}: promise catch fallback`);
    assert.doesNotMatch(body, /catch\s*(\(\s*\w*\s*\))?\s*\{\s*\}/, `${name}: empty catch`);
    assert.doesNotMatch(body, /Math\.random|mockData|sampleData|dummy|lorem/i, `${name}: mock or sample data`);
    assert.doesNotMatch(body, /["'`](?:u_|c_|iwr_)[a-z0-9_]+["'`]/i, `${name}: hard-coded identity`);
  }
});

test("the browser holds no role matrix: no request-type codes or role names outside the one owner presentation rule", () => {
  for (const [name, code] of Object.entries(ui)) {
    const body = withoutProductPhrases(stripComments(code));
    assert.doesNotMatch(body, TYPE_CODES, `${name}: request-type code`);
    assert.doesNotMatch(body, ROLE_WORDS, `${name}: role name`);
    assert.doesNotMatch(body, /\.role\s*[!=]==?|role\s*[!=]==?\s*["']/, `${name}: role comparison`);
  }
  const modelBody = withoutProductPhrases(stripComments(model));
  const narrowing = modelBody.match(/export const PRESENTATION_RELATED_TYPE_NARROWING[\s\S]*?\}\);\s*\n/);
  assert.ok(narrowing, "narrowing constant present");
  const rest = modelBody.replace(narrowing[0], "");
  assert.doesNotMatch(rest, TYPE_CODES, "model: request-type code outside the narrowing rule");
  assert.doesNotMatch(rest, ROLE_WORDS, "model: role name outside the narrowing rule");
  assert.deepEqual(narrowing[0].match(new RegExp(TYPE_CODES.source, "g")), ["STOCK_FULFILMENT"]);
});

test("the page reads the signed-in role only to pass it to the presentation rule, and never to filter data", () => {
  const body = stripComments(page);
  assert.deepEqual(body.match(/\buser\b\??\.?\w*/g).filter((token) => token !== "user"), ["user?.role"]);
  assert.doesNotMatch(body, /getCachedUser|\.client_id|created_by_user_id|assigned_to_user_id/);
  for (const [name, code] of Object.entries({ card, form })) assert.doesNotMatch(stripComments(code), /\buser\b/, `${name}: reads the user`);
});

test("no browser-side tenancy, role or lifecycle enforcement on records", () => {
  for (const [name, code] of Object.entries(ui)) {
    const body = stripComments(code);
    assert.doesNotMatch(body, /\.filter\(/, `${name}: browser-side filtering of records`);
    assert.doesNotMatch(body, /\.status\s*[!=]==?\s*["']/, `${name}: status comparison used as permission`);
    assert.doesNotMatch(body, /is_requester|is_assignee|is_audit_only/, `${name}: viewer flags used as permission`);
    assert.doesNotMatch(body, /\bcan[A-Z]\w*\(/, `${name}: capability helper`);
  }
});

test("options, recipients, priorities and limits come from the server response, with no hard-coded numbers", () => {
  const body = stripComments(form);
  assert.match(body, /options\.types\.map/);
  assert.match(body, /option\.recipients/);
  assert.match(body, /options\.priorities\.map/);
  assert.match(body, /limits\.subject/);
  assert.match(body, /limits\.description/);
  assert.match(body, /limits\.relatedId/);
  assert.match(body, /relatedTypeChoices\(/);
  assert.doesNotMatch(body, /maxLength=\{\s*\d+\s*\}/, "no fixed length limits");
  assert.doesNotMatch(stripComments(page), /maxLength=\{\s*\d+\s*\}/);
  assert.doesNotMatch(stripComments(card), /maxLength=\{\s*\d+\s*\}/);
  assert.match(page, /internalWorkRequests\.options\(\)/);
  assert.match(page, /normaliseOptions\(/);
});

test("the form sends only the model's whitelisted payload through the create call", () => {
  assert.match(form, /onCreate\(buildInternalRequestPayload\(form, option\)\)/);
  assert.match(page, /internalWorkRequests\.create\(payload\)/);
});

test("actions come from allowed_actions and the browser never sends a status", () => {
  assert.match(card, /actionButtonsFor\(view\.allowed_actions\)/);
  assert.match(page, /internalWorkRequests\.acknowledge\(item\.id\)/);
  assert.match(page, /internalWorkRequests\.transition\(item\.id, action, notes\[item\.id\]\)/);
  assert.doesNotMatch(stripComments(page + card), /target_state|to_status|status:\s/);
});

test("lists are loaded from the server with a server-side status filter and reloaded after every change", () => {
  assert.match(page, /internalWorkRequests\.outbox\(status \|\| undefined\)/);
  assert.match(page, /internalWorkRequests\.inbox\(status \|\| undefined\)/);
  assert.match(page, /asRequestList\(/);
  const reloads = page.match(/await refreshAll\(\)/g) || [];
  assert.ok(reloads.length >= 3, `expected refreshAll after create, after an action and after a stale-state error, found ${reloads.length}`);
  assert.match(page, /isStaleState\(err\)/);
  assert.match(page, /loadDetail\(item\.id\)/);
});

test("Team Inbox appears only when the server did not refuse the inbox request", () => {
  assert.match(page, /const showInbox = inbox\.loaded && !inbox\.forbidden/);
  assert.match(page, /isForbidden\(err\)/);
  assert.match(page, /\{showInbox && <button/);
  assert.match(page, /My Requests/);
  assert.match(page, /Team Inbox/);
});

test("the page implements loading, empty, submitting, validation, API error, forbidden and session-expiry handling", () => {
  assert.match(page, /Loading request options/);
  assert.match(page, /Loading your requests/);
  assert.match(page, /ErrorBanner/);
  assert.match(page, /PageEmptyState/);
  assert.match(page, /"forbidden-state"/);
  assert.match(page, /err\.sessionExpired/);
  assert.match(form, /submitting/);
  assert.match(form, /Sending\.\.\./);
  assert.match(form, /validateInternalRequestForm\(/);
  assert.match(form, /role="status"/);
  assert.match(page, /role="status"/);
  assert.match(card, /busy/);
  assert.match(card, /Loading history/);
});

test("the coordination-only notice is shown on the page and the form", () => {
  assert.match(page, /COORDINATION_ONLY_NOTICE/);
  assert.match(form, /COORDINATION_ONLY_NOTICE/);
  assert.match(page, /Nothing else in ORAC was changed by this/);
});

test("the UI does not touch stock, purchase orders, invoices or any other API", () => {
  for (const [name, code] of Object.entries(ui)) {
    const body = stripComments(code);
    assert.doesNotMatch(body, /\b(collections|quotes|dispatch|inventory|admin|reports|leads|worksheets|kiosk|documents|operationalData|contracts|serviceRequests)\./, `${name}: another API`);
    assert.doesNotMatch(body, /quantity|on_hand|reorder|recordMovement|stock_movement|verifyPo|approveAmendment|voidInvoice|submitClientPo/i, `${name}: stock, PO or invoice action`);
  }
  assert.match(page, /import \{ internalWorkRequests \} from "\.\.\/api\/client\.js"/);
  for (const code of [form, card]) assert.doesNotMatch(code, /api\/client\.js/, "only the page talks to the API");
});

test("every button does something and the important ones are present", () => {
  for (const [name, code] of Object.entries(ui)) {
    for (const tag of buttonTags(code)) assert.ok(/onClick=/.test(tag) || /type="submit"/.test(tag), `${name}: button without a handler: ${tag.slice(0, 80)}`);
  }
  for (const label of ["Send request", "Refresh", "Try again", "Show history"]) assert.ok((page + form + card).includes(label), `${label} is present`);
});

test("the guarded route is wired into App.jsx through the central policy", () => {
  assert.match(app, /import InternalRequestsPage from "\.\/pages\/InternalRequestsPage\.jsx"/);
  assert.match(app, /<Route path="\/internal-requests" element=\{<GuardedRoute user=\{user\} path="\/internal-requests"><InternalRequestsPage user=\{user\} \/><\/GuardedRoute>\} \/>/);
  assert.equal((app.match(/path="\/internal-requests"/g) || []).length, 2, "one Route path and one GuardedRoute path");
  assert.match(page, /export default function InternalRequestsPage/);
});

test("the client.js reader ignores comments, treats strings and templates as text, and does not mistake regexes for strings", () => {
  const sample = [
    "// request() and /internal-work-requests named in a line comment",
    "/* request( \"fetch(\" ) named in a block comment */",
    "const a = \"// not a comment\", b = '/* nor this */';",
    "const c = `${x ? `${y}/internal` : \"\"} // still text`;",
    "const d = value.replace(/[\"']/g, \"\") / 2;",
    "request(`/real/${id}`);"
  ].join("\n");
  const mask = classify(sample);
  const structure = blankBy(sample, mask, "c");
  const code = blankBy(sample, mask, "cs");
  assert.equal(structure.length, sample.length, "offsets stay aligned");
  assert.doesNotMatch(structure, /internal-work-requests|fetch|internal|not a comment|still text/, "comments and string text are not code");
  assert.equal((structure.match(/\brequest\(/g) || []).length, 1, "only the real call counts");
  assert.doesNotMatch(code, /named in a/, "comments are removed");
  for (const kept of ["\"// not a comment\"", "'/* nor this */'", "// still text", "/[\"']/g", "request(`/real/${id}`)"]) assert.ok(code.includes(kept), `${kept} is kept as text`);
  assert.equal((structure.match(/\bvalue\.replace\(/g) || []).length, 1, "a regex containing quotes does not swallow the code after it");
});

test("the API object uses the shared request helper, is contained, and sits before the contracts block", () => {
  // The section is found by its declarations, exactly once each.
  assert.equal(baseDeclarations.length, 1, "one internalRequestBase declaration");
  assert.equal(objectDeclarations.length, 1, "one internalWorkRequests declaration");
  assert.ok(sectionStart > 0 && objectClose > sectionStart, "the base constant comes before the exported object");
  assert.equal(client[objectClose + 1], ";", "the object literal is closed by a semicolon");
  const section = clientCode.slice(sectionStart, sectionEnd);
  const structure = clientStructure.slice(sectionStart, sectionEnd);

  // Fixed path constants, judged as executable declarations.
  assert.equal(squash(section.slice(0, section.indexOf("export const"))),
    "const internalRequestBase = \"/internal-work-requests\"; " +
    "const internalRequestListPath = (name, status) => `${internalRequestBase}/${name}${status ? `?status=${encodeURIComponent(status)}` : \"\"}`;",
    "only the base path and the encoded status-filter helper precede the object");

  // Every operation is one shared request() call to one permitted endpoint and verb.
  const methods = methodsOf(objectOpen, objectClose);
  const operations = {};
  for (const method of methods) {
    const calls = [...clientStructure.slice(method.start, method.end).matchAll(/(?<![\w$.])request\s*\(/g)];
    assert.equal(calls.length, 1, `${method.name}: exactly one request() call`);
    const open = method.start + calls[0].index + calls[0][0].length - 1;
    const args = topLevelArgs(open + 1, closeOf(open));
    assert.ok(args.length === 1 || args.length === 2, `${method.name}: request() takes a path and optional options`);
    let verb = "GET";
    if (args.length === 2) {
      const options = /^\{ method: "([A-Z]+)", body: JSON\.stringify\(.*\) \}$/.exec(args[1]);
      verb = options ? options[1] : `UNRECOGNISED OPTIONS ${args[1]}`;
    }
    operations[method.name] = { verb, path: args[0] };
  }
  assert.deepEqual(operations, {
    options: { verb: "GET", path: "`${internalRequestBase}/options`" },
    outbox: { verb: "GET", path: "internalRequestListPath(\"outbox\", status)" },
    inbox: { verb: "GET", path: "internalRequestListPath(\"inbox\", status)" },
    detail: { verb: "GET", path: "`${internalRequestBase}/${encodeURIComponent(id)}`" },
    create: { verb: "POST", path: "internalRequestBase" },
    acknowledge: { verb: "POST", path: "`${internalRequestBase}/${encodeURIComponent(id)}/acknowledge`" },
    approveTechnician: { verb: "POST", path: "`${internalRequestBase}/${encodeURIComponent(id)}/approve-technician`" },
    transition: { verb: "POST", path: "`${internalRequestBase}/${encodeURIComponent(id)}/transition`" }
  });
  assert.equal((structure.match(/(?<![\w$.])request\s*\(/g) || []).length, 8, "one shared request() call per operation, none elsewhere in the section");

  // Nothing else is called or reached: no raw fetch, storage, token, destructive verb or other API object.
  assert.doesNotMatch(section, /\bfetch\b|XMLHttpRequest|sendBeacon|localStorage|sessionStorage|getToken|orac_token|Authorization|\bwindow\b|\bdocument\b/);
  assert.doesNotMatch(section, /["'`](?:DELETE|PATCH|PUT|HEAD|OPTIONS)["'`]/i, "no destructive or unexpected verb");
  assert.deepEqual([...section.matchAll(/\bmethod\s*:\s*(["'`])(\w+)\1/g)].map((match) => match[2]), ["POST", "POST", "POST", "POST"], "only the four POST operations name a method");
  const callees = new Set([...structure.matchAll(/([A-Za-z_$][\w$]*)\s*\(/g)].map((match) => match[1]));
  for (const method of methods) callees.delete(method.name);
  assert.deepEqual([...callees].sort(), ["encodeURIComponent", "if", "internalRequestListPath", "request", "stringify", "trim"], "the only calls are the shared helper, URL encoding, JSON and trimming");
  const roots = new Set([...structure.matchAll(/([A-Za-z_$][\w$]*)\s*\./g)].map((match) => match[1]));
  assert.deepEqual([...roots].sort(), ["JSON", "body", "note"], "no other object is reached");
  assert.equal((structure.match(/\bexport\b/g) || []).length, 1, "the section exports only internalWorkRequests");
  const otherApis = [...clientCode.matchAll(/\bexport const (\w+)/g)].map((match) => match[1]).filter((name) => name !== "internalWorkRequests");
  assert.ok(otherApis.includes("contracts") && otherApis.includes("serviceRequests"), "the other API objects were found");
  for (const name of otherApis) assert.doesNotMatch(structure, new RegExp(`\\b${name}\\b`), `the section does not use the ${name} API`);

  // Containment and placement: no executable reference outside the section, and the
  // section sits directly before the contracts block without touching it.
  const outside = clientCode.slice(0, sectionStart) + clientCode.slice(sectionEnd);
  assert.doesNotMatch(outside, /internal-work-requests|internalWorkRequests|internalRequestBase|internalRequestListPath/, "no executable reference outside the section");
  assert.ok(contractsAt > sectionEnd, "the section sits before the contracts block");
  assert.equal(clientCode.slice(sectionEnd, contractsAt).trim(), "", "only comments and blank lines separate the section from the contracts block");
  assert.ok(clientCode.slice(0, sectionStart).trimEnd().endsWith("};"), "the section was not inserted inside an existing declaration");
});

test("request() attaches the HTTP status to errors without changing its existing guards", () => {
  assert.match(client, /error\.status = res\.status;/);
  assert.match(client, /const contentType = res\.headers\?\.get\?\.\("content-type"\) \|\| "";/);
  assert.match(client, /returned \$\{responseKind\} instead of API data/);
  assert.match(client, /error\.sessionExpired = true;/);
});

test("the technician registration UI is driven by server data and the one approval call", () => {
  // The form switches layout on the server's technician_registration block, never on a type code.
  assert.match(form, /option\?\.technician_registration/);
  assert.match(form, /registration\.trades\.map/);
  assert.match(form, /registration\.worker_types\.map/);
  assert.match(form, /registration\.limits\.(name|nationalId|phone)/);
  assert.match(form, /onCreate\(buildInternalRequestPayload\(form, option\)\)/);
  // The approve button comes from allowed_actions; its call is the dedicated endpoint.
  assert.match(card, /actionButtonsFor\(view\.allowed_actions\)/);
  assert.match(page, /internalWorkRequests\.approveTechnician\(item\.id\)/);
  assert.match(page, /APPROVE_REGISTRATION_ACTION/);
  assert.match(model, /Approve & Add to Technician Registry/);
  // An approval adds a record, so it must not claim "nothing was changed".
  assert.match(page, /approving \? describeApproval\(updated\)/);
});
