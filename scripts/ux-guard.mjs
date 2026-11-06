#!/usr/bin/env node
// Guard: files the owner protected may not change unless ux/owner-approvals.json records a decision.
//   node scripts/ux-guard.mjs [--base origin/main]
// Compares the working tree and commits since --base (default: HEAD~0 vs working tree) with the guarded list in ux/rules.json.
import { execFileSync } from "node:child_process";
import { readJson } from "./ux-lib.mjs";

const args = process.argv.slice(2);
const base = args.includes("--base") ? args[args.indexOf("--base") + 1] : null;
const rules = readJson("ux/rules.json");
const approvals = new Set(readJson("ux/owner-approvals.json").approvals.map((a) => a.file));
const git = (a) => { try { return execFileSync("git", a, { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).split("\n").filter(Boolean); } catch { return null; } };
const committed = base ? git(["diff", "--name-only", `${base}...HEAD`]) : [];
const dirty = git(["status", "--porcelain"]);
if (committed === null || dirty === null) { console.log("ux-guard: not a git repository or git unavailable; skipped."); process.exit(0); }
const changed = new Set([...committed, ...dirty.map((l) => l.slice(3).replace(/^"|"$/g, ""))]);
const hit = rules.guarded.filter((f) => changed.has(f) && !approvals.has(f));
if (hit.length) { console.log("ux-guard FAILED. Guarded files changed without an owner approval in ux/owner-approvals.json:"); hit.forEach((f) => console.log("  - " + f)); process.exit(1); }
console.log(`ux-guard: ${rules.guarded.length} guarded files untouched or approved.`);
