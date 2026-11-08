#!/usr/bin/env node
// Diff guard for UX branches. Catches what the ratchet cannot see:
//   LOGIC-FILE  a business-logic file was changed on a UX branch
//   SIZE-LOST   a text size class was deleted from a line and not replaced
//   node scripts/ux-diffguard.mjs [--base main]     compare HEAD with the merge base of <base>
//   node scripts/ux-diffguard.mjs --stdin diff.txt  check size classes in a saved diff only
// Exceptions: ux/diffguard.allow.json  {"allow":[{"file":"src/x.jsx","rule":"SIZE-LOST","reason":"moved into <Badge>"}]}
// Run it on UX branches only. It is not part of ux-check, so other work is not affected.
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { ROOT } from "./ux-lib.mjs";

const args = process.argv.slice(2);
const opt = (f, d) => (args.includes(f) ? args[args.indexOf(f) + 1] : d);
const git = (...a) => { const r = spawnSync("git", a, { cwd: ROOT, encoding: "utf8", maxBuffer: 100e6 }); if (r.status !== 0) { console.error(`git ${a.join(" ")} failed: ${r.stderr.trim()}`); process.exit(2); } return r.stdout; };
const allowPath = path.join(ROOT, "ux/diffguard.allow.json");
const allow = fs.existsSync(allowPath) ? JSON.parse(fs.readFileSync(allowPath, "utf8")).allow || [] : [];
const allowed = (file, rule) => allow.some((a) => a.file === file && a.rule === rule);

const LOGIC = [/^src\/(lib|api)\//, /(Model|Logic|Policy)\.js$/, /^src\/accessPolicy\.js$/, /^backend\//];
const SIZE = /(?<![\w-])(?:[a-z0-9-]+:)*text-(?:xs|sm|base|lg|xl|[2-9]xl|\[[\d.]+(?:px|rem)\])(?![\w-])/g;
const count = (s) => (s.match(SIZE) || []).length;
const findings = [];

let diff;
if (args.includes("--stdin")) diff = fs.readFileSync(opt("--stdin"), "utf8");
else {
  const base = opt("--base", "main");
  const mb = git("merge-base", base, "HEAD").trim();
  for (const f of git("diff", "--name-only", mb, "HEAD").split("\n").filter(Boolean))
    if (LOGIC.some((re) => re.test(f)) && !allowed(f, "LOGIC-FILE")) findings.push({ rule: "LOGIC-FILE", file: f, msg: "business-logic file changed on a UX branch" });
  diff = git("diff", "-U0", mb, "HEAD", "--", "src");
}

let file = "(stdin)", rem = [], add = [], mode = null;
const flush = () => {
  const key = (x) => { const t = x.trim(); const i = t.indexOf("class"); return i < 0 ? t.slice(0, 20) : t.slice(0, i); };
  if (rem.length && add.length)
    for (let i = 0; i < Math.min(rem.length, add.length); i++) {
      const r = rem[i], a = add[i];
      if (key(r) !== key(a)) continue;
      if (!/(className|class=|text-)/.test(r) || !/(className|class=|text-)/.test(a)) continue;
      if (count(r) > count(a) && !allowed(file, "SIZE-LOST")) findings.push({ rule: "SIZE-LOST", file, msg: `size class lost (${count(r)} -> ${count(a)}): ${r.trim().slice(0, 110)}` });
    }
  rem = []; add = []; mode = null;
};
for (const l of diff.split("\n")) {
  if (l.startsWith("+++ ")) { flush(); file = l.slice(4).replace(/^b\//, ""); continue; }
  if (l.startsWith("--- ") || l.startsWith("diff ") || l.startsWith("index ") || l.startsWith("@@")) { flush(); continue; }
  if (l.startsWith("-")) { if (mode === "add") flush(); rem.push(l.slice(1)); mode = "rem"; }
  else if (l.startsWith("+")) { add.push(l.slice(1)); mode = "add"; }
  else flush();
}
flush();

console.log(`ux-diffguard: ${findings.length} finding(s).`);
for (const f of findings) console.log(`  - [${f.rule}] ${f.file}: ${f.msg}`);
process.exit(findings.length ? 1 : 0);
