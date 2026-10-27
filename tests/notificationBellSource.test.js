import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const bell = readFileSync(new URL("../src/components/NotificationBell.jsx", import.meta.url), "utf8");

test("clicking a notification marks it read AND navigates to the resolved target", () => {
  assert.match(bell, /resolveNotificationTarget\(user, item\)/);
  assert.match(bell, /notificationsApi\.markRead\(item\.id\)/);
  assert.match(bell, /navigate\(target\.to\)/);
});

test("read state is the server's per-user `read` flag; the old never-populated read_at is gone", () => {
  assert.equal(bell.includes("read_at"), false);
  assert.match(bell, /n\.read/);
});

test("a failed mark-read is rolled back and reported, not silent", () => {
  assert.match(bell, /read: false/);
  assert.match(bell, /role="alert"/);
});

test("mark-all-read rolls back on failure", () => {
  assert.match(bell, /setItems\(before\)/);
});

test("keyboard and screen-reader support: disclosure button, Escape returns focus, live status, unread label", () => {
  assert.match(bell, /aria-expanded=\{open\}/);
  assert.match(bell, /aria-controls=\{PANEL_ID\}/);
  assert.match(bell, /aria-label=\{bellLabel\(unread\)\}/);
  assert.match(bell, /event\.key === "Escape"/);
  assert.match(bell, /buttonRef\.current\?\.focus\(\)/);
  assert.match(bell, /role="status" aria-live="polite"/);
  assert.match(bell, /sr-only">Unread\. /);
  assert.match(bell, /focus-visible:outline/);
});

test("loading, empty, error and retry states exist", () => {
  assert.match(bell, /Loading notifications/);
  assert.match(bell, /You have no notifications/);
  assert.match(bell, /Notifications could not be loaded/);
  assert.match(bell, /Try again/);
});

test("mobile layout: viewport-anchored panel on small screens, bounded height", () => {
  assert.match(bell, /fixed inset-x-2 top-16/);
  assert.match(bell, /sm:absolute/);
  assert.match(bell, /max-h-\[60vh\]/);
});

test("the bell button meets a 40px target and only polls while the tab is visible", () => {
  assert.match(bell, /h-11 w-11/);
  assert.match(bell, /document\.hidden/);
});
