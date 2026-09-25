import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { NAV_ITEMS } from "../src/accessPolicy.js";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("navigation uses Timesheets while preserving the technical route", () => {
  assert.deepEqual(NAV_ITEMS.find((item) => item.path === "/worksheets"), { path: "/worksheets", label: "Timesheets" });
});

test("operational screens use Timesheets in their visible labels", () => {
  const sources = [
    "src/pages/DashboardPage.jsx",
    "src/pages/ReportsPage.jsx",
    "src/pages/OperationalDataPage.jsx",
    "src/pages/AdminAnalyticsPage.jsx",
    "src/pages/DocumentsPage.jsx"
  ].map(read).join("\n");

  assert.match(sources, /Timesheets Pending Review/);
  assert.match(sources, /label="Timesheets"/);
  assert.doesNotMatch(sources, /Field Worksheets|Worksheets Pending Review|My Worksheets|No worksheets/);
});
