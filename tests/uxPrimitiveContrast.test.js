import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { contrast } from "../scripts/ux-lib.mjs";

const tokens = JSON.parse(fs.readFileSync(path.resolve("ux/tokens.json"), "utf8"));
const colors = tokens.colors;

function getHex(tokenOrHex, theme) {
  if (tokenOrHex.startsWith("#")) return tokenOrHex;
  const entry = colors[tokenOrHex];
  if (!entry) throw new Error(`Unknown token: ${tokenOrHex}`);
  return entry[theme];
}

// Map of component element token pairs: { component, element, fg, bg, min }
export const COMPONENT_CONTRAST_PAIRS = [
  // Button
  { component: "Button (primary)", element: "label text", fg: "#ffffff", bg: "accent-strong", min: 4.5 },
  { component: "Button (secondary)", element: "label text / border", fg: "accent", bg: "surface", min: 4.5 },
  { component: "Button (danger)", element: "label text / border", fg: "danger-text", bg: "surface", min: 4.5 },
  { component: "Button (ghost)", element: "label text", fg: "accent", bg: "surface", min: 4.5 },
  { component: "Button (link)", element: "link text", fg: "accent", bg: "surface", min: 4.5 },
  { component: "Button (focus ring)", element: "focus indicator", fg: "focus-ring", bg: "surface", min: 3.0 },

  // Field
  { component: "Field (label)", element: "label text", fg: "text-primary", bg: "surface", min: 4.5 },
  { component: "Field (helper)", element: "helper text", fg: "text-muted", bg: "surface", min: 4.5 },
  { component: "Field (error)", element: "error text & icon", fg: "danger-text", bg: "surface", min: 4.5 },

  // Input / Select / Textarea
  { component: "Input", element: "body text", fg: "text-primary", bg: "canvas", min: 4.5 },
  { component: "Input", element: "placeholder text", fg: "text-muted", bg: "canvas", min: 4.5 },
  { component: "Input (border)", element: "control boundary", fg: "border-strong", bg: "canvas", min: 3.0 },
  { component: "Input (focus ring)", element: "focus indicator", fg: "focus-ring", bg: "canvas", min: 3.0 },
  { component: "Select", element: "body text", fg: "text-primary", bg: "canvas", min: 4.5 },
  { component: "Select (border)", element: "control boundary", fg: "border-strong", bg: "canvas", min: 3.0 },
  { component: "Select (focus ring)", element: "focus indicator", fg: "focus-ring", bg: "canvas", min: 3.0 },
  { component: "Textarea", element: "body text", fg: "text-primary", bg: "canvas", min: 4.5 },
  { component: "Textarea (border)", element: "control boundary", fg: "border-strong", bg: "canvas", min: 3.0 },
  { component: "Textarea (focus ring)", element: "focus indicator", fg: "focus-ring", bg: "canvas", min: 3.0 },

  // Panel
  { component: "Panel", element: "content text", fg: "text-primary", bg: "surface", min: 4.5 },

  // Titles
  { component: "PageTitle", element: "h1 heading", fg: "text-primary", bg: "page", min: 3.0 },
  { component: "SectionTitle", element: "h2 heading", fg: "text-primary", bg: "surface", min: 4.5 },
  { component: "SubTitle", element: "h3 heading", fg: "text-primary", bg: "surface", min: 4.5 },

  // Notice
  { component: "Notice (error)", element: "alert text & icon", fg: "danger-text", bg: "danger-bg", min: 4.5 },
  { component: "Notice (warning)", element: "warning text & icon", fg: "warning-text", bg: "warning-bg", min: 4.5 },
  { component: "Notice (info)", element: "info text & icon", fg: "info-text", bg: "info-bg", min: 4.5 },
  { component: "Notice (success)", element: "success text & icon", fg: "success-text", bg: "success-bg", min: 4.5 },

  // Badge
  { component: "Badge (info)", element: "badge text", fg: "info-text", bg: "info-bg", min: 4.5 },
  { component: "Badge (success)", element: "badge text", fg: "success-text", bg: "success-bg", min: 4.5 },
  { component: "Badge (warning)", element: "badge text", fg: "warning-text", bg: "warning-bg", min: 4.5 },
  { component: "Badge (danger)", element: "badge text", fg: "danger-text", bg: "danger-bg", min: 4.5 },
  { component: "Badge (neutral)", element: "badge text", fg: "text-secondary", bg: "surface-muted", min: 4.5 },

  // CountBadge (FIXED: canvas on danger-text gives 6.47:1 in light and 9.52:1 in dark)
  { component: "CountBadge", element: "notification count numeral", fg: "canvas", bg: "danger-text", min: 4.5 },

  // BrandMark
  { component: "BrandMark", element: "brand logo", fg: "#00488c", bg: "#ffffff", min: 4.5 }
];

test("primitive contrast: each component token pair meets its minimum contrast in light theme", () => {
  for (const pair of COMPONENT_CONTRAST_PAIRS) {
    const fgHex = getHex(pair.fg, "light");
    const bgHex = getHex(pair.bg, "light");
    const ratio = contrast(fgHex, bgHex);
    assert.ok(
      ratio >= pair.min,
      `[LIGHT] ${pair.component} ${pair.element} (${pair.fg} on ${pair.bg}) ratio ${ratio.toFixed(2)}:1 below required ${pair.min}:1`
    );
  }
});

test("primitive contrast: each component token pair meets its minimum contrast in dark theme", () => {
  for (const pair of COMPONENT_CONTRAST_PAIRS) {
    const fgHex = getHex(pair.fg, "dark");
    const bgHex = getHex(pair.bg, "dark");
    const ratio = contrast(fgHex, bgHex);
    assert.ok(
      ratio >= pair.min,
      `[DARK] ${pair.component} ${pair.element} (${pair.fg} on ${pair.bg}) ratio ${ratio.toFixed(2)}:1 below required ${pair.min}:1`
    );
  }
});
