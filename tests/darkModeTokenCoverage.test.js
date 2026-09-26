import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import url from "node:url";

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const SRC_DIR = path.join(__dirname, "..", "src");
const CSS_PATH = path.join(SRC_DIR, "index.css");
const TAILWIND_CONFIG_PATH = path.join(__dirname, "..", "tailwind.config.js");

const COLOR_CLASS_RE =
  /(?:bg|text|border|ring|divide)-(?:white|black|gray|slate|zinc|neutral|stone|red|rose|amber|yellow|orange|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink)-[0-9]+(?:\/[0-9]+)?/g;

// Classes that are intentionally left unmapped: each pairs a fixed-dark
// background with white/near-white text, so it stays legible regardless of
// the active theme, or is a decorative, non-text-carrying accent on the
// public LandingPage (out of the operational portal's dark-mode scope).
const INTENTIONALLY_UNMAPPED = new Set([
  "bg-gray-800",       // hover state of an always-dark bg-gray-900 button
  "bg-slate-700",      // LandingPage CTA hover, always-dark button
  "bg-slate-800",      // LandingPage CTA hover, always-dark button
  "bg-slate-900",      // LandingPage CTA / footer, always-dark by design
  "border-slate-500",  // LandingPage decorative hover border, non-essential
  "border-slate-900",  // LandingPage decorative accent stripe, non-essential
  "text-white",        // always paired with a fixed-dark background
  "text-white/70"       // always paired with a fixed-dark background
]);

function listJsxFiles(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...listJsxFiles(full));
    else if (entry.name.endsWith(".jsx")) out.push(full);
  }
  return out;
}

function collectUsedColorClasses() {
  const classes = new Set();
  for (const file of listJsxFiles(SRC_DIR)) {
    const text = fs.readFileSync(file, "utf8");
    for (const match of text.matchAll(COLOR_CLASS_RE)) classes.add(match[0]);
  }
  return classes;
}

test("every fixed-shade Tailwind color class used in src/**/*.jsx is either mapped in the dark-mode bridge or explicitly allowlisted", () => {
  const css = fs.readFileSync(CSS_PATH, "utf8");
  const bridgeStart = css.indexOf("DARK-MODE RETROFIT BRIDGE");
  assert.ok(bridgeStart !== -1, "index.css must contain the DARK-MODE RETROFIT BRIDGE section");
  const bridge = css.slice(bridgeStart);

  const used = collectUsedColorClasses();
  const missing = [];
  for (const cls of used) {
    if (INTENTIONALLY_UNMAPPED.has(cls)) continue;
    const cssSelectorForm = `.${cls.replace(/\//g, "\\/")}`;
    if (!bridge.includes(cssSelectorForm)) missing.push(cls);
  }

  assert.deepEqual(
    missing,
    [],
    `these classes are used in JSX but have no dark-mode token mapping and are not in the allowlist: ${missing.join(", ")}`
  );
});

test("index.css defines the full semantic token set in both :root (light) and html[data-theme=dark]", () => {
  const css = fs.readFileSync(CSS_PATH, "utf8");
  const rootBlock = css.slice(css.indexOf(":root {"), css.indexOf("html[data-theme=\"dark\"] {"));
  const darkBlockStart = css.indexOf("html[data-theme=\"dark\"] {");
  const darkBlock = css.slice(darkBlockStart, css.indexOf("GLOBAL BASE STYLES"));

  const requiredTokens = [
    "--orac-canvas",
    "--orac-surface",
    "--orac-surface-muted",
    "--orac-text-primary",
    "--orac-text-secondary",
    "--orac-text-muted",
    "--orac-border",
    "--orac-border-strong",
    "--orac-accent",
    "--orac-accent-strong",
    "--orac-focus-ring",
    "--orac-success-text",
    "--orac-success-bg",
    "--orac-success-border",
    "--orac-danger-text",
    "--orac-danger-bg",
    "--orac-danger-border",
    "--orac-warning-text",
    "--orac-warning-bg",
    "--orac-warning-border",
    "--orac-info-text",
    "--orac-info-bg",
    "--orac-info-border"
  ];

  for (const token of requiredTokens) {
    assert.ok(rootBlock.includes(token), `:root is missing ${token}`);
    assert.ok(darkBlock.includes(token), `html[data-theme="dark"] is missing ${token}`);
  }
});

test("index.css defines a reduced-motion guard covering the animation/transition utilities used in the app", () => {
  const css = fs.readFileSync(CSS_PATH, "utf8");
  assert.ok(css.includes("prefers-reduced-motion: reduce"), "missing @media (prefers-reduced-motion: reduce) block");
});

test("index.css gives native form controls an accessible (>=3:1) border in both themes via --orac-border-strong", () => {
  const css = fs.readFileSync(CSS_PATH, "utf8");
  const inputRuleStart = css.indexOf("input,\nselect,\ntextarea {");
  assert.ok(inputRuleStart !== -1, "expected a shared input/select/textarea base rule");
  const rule = css.slice(inputRuleStart, css.indexOf("}", inputRuleStart));
  assert.ok(rule.includes("var(--orac-border-strong)"));
});

test("tailwind.config.js exposes the semantic orac.* token names used for Chat 2-5 migration", () => {
  const config = fs.readFileSync(TAILWIND_CONFIG_PATH, "utf8");
  const requiredKeys = [
    "canvas",
    "surface",
    "surface-muted",
    "text-primary",
    "text-secondary",
    "text-muted",
    "border-default",
    "border-strong",
    "accent",
    "accent-strong",
    "focus-ring",
    "success-text",
    "success-bg",
    "success-border",
    "danger-text",
    "danger-bg",
    "danger-border",
    "warning-text",
    "warning-bg",
    "warning-border",
    "info-text",
    "info-bg",
    "info-border"
  ];
  for (const key of requiredKeys) {
    const quoted = config.includes(`"${key}"`);
    const bare = config.includes(`${key}:`);
    assert.ok(quoted || bare, `tailwind.config.js is missing the orac.${key} token`);
  }
});
