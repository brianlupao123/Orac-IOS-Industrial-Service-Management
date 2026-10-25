import test from "node:test";
import assert from "node:assert/strict";
import {
  formatMoney,
  formatSignedMoney,
  formatNumber,
  formatDate,
  formatDateTime,
  formatTime,
  formatLongDate,
} from "../src/lib/format.js";

const DASH = "\u2014";

test("formatMoney correctly formats USD currency and handles 0 and negatives", () => {
  assert.equal(formatMoney(12500), "$12,500.00");
  assert.equal(formatMoney(12500.5), "$12,500.50");
  assert.equal(formatMoney(0.99), "$0.99");
  assert.equal(formatMoney("12500"), "$12,500.00");
  assert.equal(formatMoney(0), "$0.00");
  assert.equal(formatMoney("0"), "$0.00");
  assert.equal(formatMoney(-500), "-$500.00");
  assert.equal(formatMoney("-12500.75"), "-$12,500.75");
});

test("formatSignedMoney includes leading +/- sign and preserves zero", () => {
  assert.equal(formatSignedMoney(500), "+$500.00");
  assert.equal(formatSignedMoney("500"), "+$500.00");
  assert.equal(formatSignedMoney(-500), "-$500.00");
  assert.equal(formatSignedMoney(0), "$0.00");
  assert.equal(formatSignedMoney("0"), "$0.00");
});

test("formatNumber adds comma grouping and handles negatives", () => {
  assert.equal(formatNumber(12500), "12,500");
  assert.equal(formatNumber(1234567), "1,234,567");
  assert.equal(formatNumber(-12500), "-12,500");
  assert.equal(formatNumber(0), "0");
  assert.equal(formatNumber("0"), "0");
});

test("date formatters handle strings and Date instances correctly without timezone shifts", () => {
  const d = new Date(2026, 9, 12, 14, 30); // 12 Oct 2026 14:30
  assert.equal(formatDate(d), "12 Oct 2026");
  assert.equal(formatDateTime(d), "12 Oct 2026, 14:30");
  assert.equal(formatTime(d), "14:30");
  assert.equal(formatLongDate(d), "12 October 2026");

  // String date without timezone shift
  assert.equal(formatDate("2026-10-12"), "12 Oct 2026");
  assert.equal(formatLongDate("2026-10-12"), "12 October 2026");
});

test("formatters gracefully return em-dash for null, undefined, empty string, and NaN", () => {
  assert.equal(formatMoney(null), DASH);
  assert.equal(formatMoney(undefined), DASH);
  assert.equal(formatMoney(""), DASH);
  assert.equal(formatMoney(Number.NaN), DASH);
  assert.equal(formatDate(null), DASH);
  assert.equal(formatDate(""), DASH);
  assert.equal(formatDate("not-a-date"), DASH);
  assert.equal(formatDateTime(null), DASH);
  assert.equal(formatTime(null), DASH);
  assert.equal(formatLongDate(null), DASH);
});

test("format.js rejects non-finite numeric values and whitespace-only inputs instead of displaying false zeroes", () => {
  // Whitespace-only strings must NOT parse to 0 / $0.00
  assert.equal(formatMoney("   "), DASH);
  assert.equal(formatMoney("\t\n"), DASH);
  assert.equal(formatSignedMoney("   "), DASH);
  assert.equal(formatNumber("   "), DASH);

  // Non-finite values
  assert.equal(formatMoney(Infinity), DASH);
  assert.equal(formatMoney(-Infinity), DASH);
  assert.equal(formatSignedMoney(Infinity), DASH);
  assert.equal(formatNumber(Infinity), DASH);

  // Booleans must not coerce to 1 or 0
  assert.equal(formatMoney(true), DASH);
  assert.equal(formatMoney(false), DASH);
  assert.equal(formatNumber(true), DASH);
  assert.equal(formatNumber(false), DASH);

  // Non-numeric alphanumeric strings
  assert.equal(formatMoney("abc"), DASH);
  assert.equal(formatMoney("123abc"), DASH);
  assert.equal(formatSignedMoney("xyz"), DASH);
});

test("format.js rejects invalid calendar dates and prevents silent month rollover", () => {
  // February 31 does not exist
  assert.equal(formatDate("2026-02-31"), DASH);
  assert.equal(formatDateTime("2026-02-31T12:00:00"), DASH);
  assert.equal(formatLongDate("2026-02-31"), DASH);

  // April 31 does not exist (April has 30 days)
  assert.equal(formatDate("2026-04-31"), DASH);

  // 2026 is not a leap year, so Feb 29 is invalid
  assert.equal(formatDate("2026-02-29"), DASH);

  // Leap year Feb 29 (2024 or 2028) IS valid
  assert.equal(formatDate("2024-02-29"), "29 Feb 2024");
  assert.equal(formatDate("2028-02-29"), "29 Feb 2028");

  // Out-of-bounds months and days
  assert.equal(formatDate("2026-13-01"), DASH);
  assert.equal(formatDate("2026-00-10"), DASH);
  assert.equal(formatDate("2026-05-32"), DASH);
  assert.equal(formatDate("2026-05-00"), DASH);
});

test("format.js preserves valid zeroes and explicit zero representations", () => {
  assert.equal(formatMoney(0), "$0.00");
  assert.equal(formatMoney("0"), "$0.00");
  assert.equal(formatMoney("0.00"), "$0.00");
  assert.equal(formatMoney(-0), "$0.00");

  assert.equal(formatSignedMoney(0), "$0.00");
  assert.equal(formatSignedMoney("0"), "$0.00");
  assert.equal(formatSignedMoney(-0), "$0.00");

  assert.equal(formatNumber(0), "0");
  assert.equal(formatNumber("0"), "0");
  assert.equal(formatNumber(-0), "0");
});
