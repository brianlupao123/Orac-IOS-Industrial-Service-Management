import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const source = fs.readFileSync(path.join(here, "../src/api/client.js"), "utf8");

test("shared API client rejects HTML and malformed responses instead of returning an empty payload", () => {
  assert.match(source, /const contentType = res\.headers\?\.get\?\.\("content-type"\) \|\| "";/);
  assert.match(source, /const rawBody = canReadText \? await res\.text\(\) : "";/);
  assert.match(source, /returned \$\{responseKind\} instead of API data/);
  assert.match(source, /body\.success !== true/);
});
