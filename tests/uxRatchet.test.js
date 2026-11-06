import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";

test("UX ratchet: no file gained a style violation compared with ux/baseline.json", () => {
  const r = spawnSync(process.execPath, ["scripts/ux-ratchet.mjs"], { encoding: "utf8" });
  assert.equal(r.status, 0, `${r.stdout}\n${r.stderr}`);
});
