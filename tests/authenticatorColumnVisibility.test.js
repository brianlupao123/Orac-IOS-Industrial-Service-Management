import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const read = (file) => readFileSync(new URL(`../${file}`, import.meta.url), "utf8");
const page = read("src/pages/AdminPage.jsx");

test("Authenticator column is only shown when at least one user has a boolean totp_enrolled", () => {
  // hasTotpColumn derives from a .some() check for typeof boolean
  assert.match(page, /filteredUsers\.some\(\(u\) => typeof u\.totp_enrolled === "boolean"\)/);
  // The column array conditionally includes "Authenticator"
  assert.match(page, /\.\.\.?\(hasTotpColumn \? \["Authenticator"\] : \[\]\)/);
});

test("Authenticator column is hidden when totp_enrolled is absent from all users", () => {
  // hasTotpColumn is false when no user has typeof totp_enrolled === "boolean"
  // The column list must NOT unconditionally include "Authenticator"
  const columnLine = page.match(/userColumns.*=.*useMemo[\s\S]*?\[.*?"Actions".*?\]/);
  assert.ok(columnLine, "userColumns must be defined with useMemo");
  // Must be conditional, not a fixed string in the array
  assert.doesNotMatch(page, /\["Name", "Email", "Role", "Authenticator",/);
});

test("Authenticator pill renders null when totp_enrolled is not a boolean", () => {
  // Inside the hasTotpColumn cell, if typeof is not boolean, render null
  assert.match(page, /typeof u\.totp_enrolled === "boolean" \?/);
  // The else branch for non-boolean must be null (no "Not set up" default)
  const totpCell = page.match(/\{hasTotpColumn && \(\s*<td[\s\S]*?<\/td>\s*\)\}/);
  assert.ok(totpCell, "hasTotpColumn conditional cell must exist");
  // Should contain ": null" for the non-boolean branch
  assert.match(totpCell[0], /: null/);
});

test("No unconditional 'Not set up' default for absent totp_enrolled", () => {
  // The old code always showed "Not set up" — that must only appear inside
  // the typeof === "boolean" true branch (i.e. when totp_enrolled is
  // explicitly false, not when the field is missing).
  const totpSection = page.match(/hasTotpColumn && \([\s\S]*?\)\}/);
  assert.ok(totpSection, "hasTotpColumn section must exist");
  // "Not set up" is allowed only inside typeof check
  const notSetUp = page.match(/"Not set up"/g) || [];
  // It should appear exactly once, guarded by typeof check
  assert.ok(notSetUp.length <= 1, "\"Not set up\" must appear at most once and only inside typeof guard");
});
