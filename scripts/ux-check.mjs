#!/usr/bin/env node
// One command for the fast UX gate: tokens + ratchet + guard. Add --full to also run the prototype probe.
//   node scripts/ux-check.mjs [--full]
import { spawnSync } from "node:child_process";
const steps = [["tokens", "ux-tokens.mjs", []], ["ratchet", "ux-ratchet.mjs", []], ["guard", "ux-guard.mjs", []]];
if (process.argv.includes("--full")) steps.push(["probe (prototype)", "ux-probe.mjs", ["--target", "prototype", "--theme", "light"]]);
let bad = 0;
for (const [name, script, extra] of steps) {
  const r = spawnSync(process.execPath, [`scripts/${script}`, ...extra], { encoding: "utf8" });
  const tail = (r.stdout + r.stderr).trim().split("\n").filter(Boolean);
  console.log(`${r.status === 0 ? "PASS" : "FAIL"}  ${name}: ${tail.filter((l) => /OK|FAILED|problem|ux-|Pages measured/.test(l)).slice(0, 3).join(" | ") || tail.slice(-1)[0]}`);
  if (r.status !== 0) { bad++; console.log(tail.slice(0, 25).map((l) => "      " + l).join("\n")); }
}
console.log(bad ? `\nUX gate FAILED (${bad}).` : "\nUX gate passed.");
process.exit(bad ? 1 : 0);
