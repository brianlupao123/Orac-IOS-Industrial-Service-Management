// Shared helpers for the ORAC UX gate. No dependencies. Node 18+.
import fs from "node:fs";
import path from "node:path";

export const ROOT = process.cwd();
export const rel = (p) => path.relative(ROOT, p).split(path.sep).join("/");
export const readJson = (p) => JSON.parse(fs.readFileSync(path.join(ROOT, p), "utf8"));
export const writeJson = (p, v) => fs.writeFileSync(path.join(ROOT, p), JSON.stringify(v, null, 2) + "\n");

export function walk(dir, exts, out = []) {
  const abs = path.join(ROOT, dir);
  if (!fs.existsSync(abs)) return out;
  for (const e of fs.readdirSync(abs, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) { if (!["node_modules", "dist", "dist-uat", "evidence", ".git"].includes(e.name)) walk(p, exts, out); }
    else if (exts.some((x) => e.name.endsWith(x))) out.push(p.split(path.sep).join("/"));
  }
  return out;
}

// WCAG relative luminance and contrast. Accepts #rgb or #rrggbb.
export function lum(hex) {
  let h = hex.replace("#", "");
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  const c = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255).map((x) => (x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4));
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
}
export const contrast = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };

export function out(title, rows) { console.log(`\n${title}`); for (const r of rows) console.log("  " + r); }
