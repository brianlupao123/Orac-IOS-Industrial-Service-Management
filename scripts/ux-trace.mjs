#!/usr/bin/env node
// Traceability: requirement -> design anchor -> build target -> verification -> evidence, with live status.
//   node scripts/ux-trace.mjs                       writes docs/ux/TRACEABILITY.md and ux/traceability.json
//   node scripts/ux-trace.mjs --embed docs/ux/ORAC_UI_PROTOTYPE.html   also embeds the result in the prototype's SDLC screen
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { ROOT, readJson, writeJson } from "./ux-lib.mjs";

const args = process.argv.slice(2);
const run = (script, extra = []) => { const r = spawnSync(process.execPath, [`scripts/${script}`, ...extra], { cwd: ROOT, encoding: "utf8", maxBuffer: 50e6 }); return { status: r.status, out: r.stdout }; };
const parse = (s) => { try { return JSON.parse(s); } catch { return null; } };

const reqs = readJson("ux/requirements.json");
const ratchet = parse(run("ux-ratchet.mjs", ["--json"]).out);
const tokens = parse(run("ux-tokens.mjs", ["--json"]).out);
const guard = run("ux-guard.mjs");
const manual = readJson("ux/manual-evidence.json").evidence || {};
const sumById = Object.fromEntries((ratchet?.summary || []).map((s) => [s.id, s]));

function latestProbe(target) {
  const dir = path.join(ROOT, "evidence/ux-probe");
  if (!fs.existsSync(dir)) return null;
  const runs = fs.readdirSync(dir).sort().reverse();
  for (const r of runs) { const f = path.join(dir, r, "results.json"); if (fs.existsSync(f)) { const j = JSON.parse(fs.readFileSync(f, "utf8")); if (j.target === target) return { runId: r, byCheck: j.byCheck || {}, fail: j.summary.fail }; } }
  return null;
}
const probes = { prototype: latestProbe("prototype"), app: latestProbe("app") };

function status(v) {
  if (v.kind === "ratchet") { const s = sumById[v.ref]; if (!s) return { s: "NOT RUN", d: "rule missing" }; return s.current === 0 ? { s: "PASS", d: "0 violations" } : { s: "OPEN", d: `${s.current} now (baseline ${s.baseline}); ${s.guardedCount} in guarded files` }; }
  if (v.kind === "tokens") {
    if (!tokens) return { s: "NOT RUN", d: "" };
    if (v.ref === "contrast") { const n = tokens.contrast.filter((c) => !c.pass).length; return n ? { s: "FAIL", d: `${n} failing pairs` } : { s: "PASS", d: `${tokens.contrast.length} pairs pass` }; }
    const n = tokens.problems.filter((p) => !p.startsWith("contrast")).length; return n ? { s: "OPEN", d: `${n} token differences` } : { s: "PASS", d: "tokens agree" };
  }
  if (v.kind === "probe") {
    const one = (p) => (!p ? "not run" : (p.byCheck[v.ref] || 0) === 0 ? "pass" : `${p.byCheck[v.ref]} findings`);
    const pa = one(probes.prototype), po = one(probes.app);
    const ok = pa === "pass" && po === "pass";
    const s = ok ? "PASS" : po.includes("findings") || pa.includes("findings") ? "OPEN" : pa === "pass" ? "PARTIAL" : "NOT RUN";
    return { s, d: `prototype: ${pa}; portal: ${po}` };
  }
  if (v.kind === "manual") { const e = manual[v.ref]; return e ? { s: "VERIFIED", d: `${e.by}, ${e.date}` } : { s: "PENDING", d: "needs a person to check and record" }; }
  if (v.kind === "guard") return guard.status === 0 ? { s: "PASS", d: guard.out.trim().split("\n").pop() } : { s: "FAIL", d: "guarded file changed without approval" };
  return { s: "NOT RUN", d: "" };
}

let commit = ""; try { commit = spawnSync("git", ["rev-parse", "--short", "HEAD"], { cwd: ROOT, encoding: "utf8" }).stdout.trim(); } catch {}
const rows = reqs.requirements.map((r) => {
  const checks = r.verify.map((v) => ({ ...v, ...status(v) }));
  const good = (c) => c.s === "PASS" || c.s === "VERIFIED";
  const overall = checks.some((c) => c.s === "FAIL") ? "FAIL" : checks.every(good) ? "DONE" : checks.some((c) => good(c) || c.s === "PARTIAL") ? "IN PROGRESS" : "NOT STARTED";
  return { ...r, checks, overall };
});
const count = (k) => rows.filter((r) => r.overall === k).length;
const out = { generated: new Date().toISOString(), commit, total: rows.length, done: count("DONE"), inProgress: count("IN PROGRESS"), notStarted: count("NOT STARTED"), failed: count("FAIL"), phases: reqs.phases, probes: { prototype: probes.prototype?.runId || null, app: probes.app?.runId || null }, rows };
writeJson("ux/traceability.json", out);

const md = [`# UX traceability matrix`, "", `Generated ${out.generated}${commit ? ` at commit ${commit}` : ""} by scripts/ux-trace.mjs. Do not edit by hand.`, "",
  `${out.done} of ${out.total} requirements done, ${out.inProgress} in progress, ${out.notStarted} not started, ${out.failed} failing.`, "",
  "Chain: **Requirement** (why) -> **Design** (where it is in the prototype) -> **Build** (code target and phase) -> **Verify** (automated or manual check) -> **Evidence** (status, with numbers).", "",
  "| ID | Requirement | Source | Design anchor | Build / phase | Verification and evidence | Status |", "|---|---|---|---|---|---|---|",
  ...rows.map((r) => `| ${r.id} | ${r.statement} | ${r.source} | ${r.design} | ${r.build} (${r.phase}) | ${r.checks.map((c) => `${c.kind}:${c.ref} = **${c.s}** (${c.d})`).join("<br>")} | **${r.overall}** |`), ""].join("\n");
fs.mkdirSync(path.join(ROOT, "docs/ux"), { recursive: true });
fs.writeFileSync(path.join(ROOT, "docs/ux/TRACEABILITY.md"), md);

const emb = args.includes("--embed") ? args[args.indexOf("--embed") + 1] : null;
if (emb) {
  const p = path.join(ROOT, emb); let h = fs.readFileSync(p, "utf8");
  const slim = { generated: out.generated, commit, total: out.total, done: out.done, phases: out.phases, rows: rows.map((r) => ({ id: r.id, area: r.area, statement: r.statement, source: r.source, design: r.design, build: r.build, phase: r.phase, overall: r.overall, checks: r.checks.map((c) => ({ kind: c.kind, ref: c.ref, s: c.s, d: c.d })) })) };
  const block = `<!--UX-TRACE:BEGIN--><script type="application/json" id="ux-trace">${JSON.stringify(slim).replace(/</g, "\\u003c")}</script><!--UX-TRACE:END-->`;
  h = h.includes("<!--UX-TRACE:BEGIN-->") ? h.replace(/<!--UX-TRACE:BEGIN-->[\s\S]*?<!--UX-TRACE:END-->/, () => block) : h.replace("</body>", () => block + "\n</body>");
  fs.writeFileSync(p, h);
}
console.log(`ux-trace: ${out.done}/${out.total} done, ${out.inProgress} in progress, ${out.notStarted} not started, ${out.failed} failing. Wrote docs/ux/TRACEABILITY.md and ux/traceability.json${emb ? `, embedded in ${emb}` : ""}.`);
