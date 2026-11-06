import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";

const run = () => {
  const r = spawnSync(process.execPath, ["scripts/ux-tokens.mjs", "--json"], { encoding: "utf8" });
  return JSON.parse(r.stdout);
};
const enforce = JSON.parse(readFileSync(new URL("../ux/tokens.json", import.meta.url), "utf8")).enforce || {};

test("design tokens: every declared colour pair meets its contrast minimum in both themes", () => {
  const failing = run().contrast.filter((c) => !c.pass);
  assert.deepEqual(failing, [], "contrast failures in ux/tokens.json");
});

test("design tokens: src/index.css and the HTML prototype agree with ux/tokens.json", (t) => {
  if (!enforce.parity) { t.skip("parity not enforced yet (set enforce.parity=true in ux/tokens.json at the end of Phase 1)"); return; }
  const res = run();
  assert.deepEqual(res.problems, [], "run: node scripts/ux-tokens.mjs --write, then review the diff");
});
