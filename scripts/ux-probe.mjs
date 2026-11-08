#!/usr/bin/env node
// Rendered-page probe. Measures what users actually see, on the HTML prototype or the running portal,
// against ux/components.spec.json. Needs Playwright (already a devDependency of the portal).
//
//   node scripts/ux-probe.mjs --target prototype [--file docs/ux/ORAC_UI_PROTOTYPE.html]
//   node scripts/ux-probe.mjs --target app --url http://127.0.0.1:5176          (needs sign-in env vars, see below)
//   options: --theme light|dark|both (default both)  --roles management,sales (prototype only)  --json  --out evidence/ux-probe
//
// App sign-in (read-only, same convention as scripts/ui_visual_audit.mjs):
//   ORAC_PROBE_PASSWORD and ORAC_PROBE_EMAIL_<ROLE> for each role in ux/routes.json, e.g. ORAC_PROBE_EMAIL_FINANCE.
// Exit code 1 when any FAIL finding exists. WARN findings are reported, never fail.
import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright";
import { ROOT, readJson } from "./ux-lib.mjs";

const args = process.argv.slice(2);
const opt = (k, d) => (args.includes(k) ? args[args.indexOf(k) + 1] : d);
const target = opt("--target", "prototype");
const themes = opt("--theme", "both") === "both" ? ["light", "dark"] : [opt("--theme", "light")];
const spec = readJson("ux/components.spec.json");
const runId = new Date().toISOString().replace(/[:.]/g, "-");
const outDir = path.join(ROOT, opt("--out", "evidence/ux-probe"), runId);

// ---------- in-page measurement (runs in the browser) ----------
function measure(cfg) {
  const { spec, kind } = cfg;
  const findings = [];
  const add = (level, check, el, msg) => findings.push({ level, check, where: describe(el), msg });
  const describe = (el) => {
    if (!el) return "";
    const t = (el.getAttribute && (el.getAttribute("aria-label") || el.textContent || "")).trim().replace(/\s+/g, " ").slice(0, 40);
    return `${el.tagName.toLowerCase()}${el.className && typeof el.className === "string" ? "." + el.className.trim().split(/\s+/).slice(0, 2).join(".") : ""} "${t}"`;
  };
  const visible = (el) => { const r = el.getBoundingClientRect(); const cs = getComputedStyle(el); return r.width > 0 && r.height > 0 && cs.visibility !== "hidden" && cs.display !== "none" && cs.opacity !== "0"; };
  const root = document.querySelector(kind === "prototype" ? "#frame" : "body") || document.body;
  const ignoreSel = spec.global.ignore[kind === "prototype" ? "proto" : "app"];
  const all = [...root.querySelectorAll("*")].filter((e) => !["SCRIPT", "STYLE", "SVG", "PATH", "use", "symbol"].includes(e.tagName) && !e.closest("svg") && !e.closest(ignoreSel));
  const px = (v) => parseFloat(v) || 0;
  const parse = (c) => { const m = /rgba?\(([^)]+)\)/.exec(c); if (!m) return null; const p = m[1].split(/[ ,/]+/).filter(Boolean).map(Number); return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 }; };
  const over = (top, bot) => ({ r: top.r * top.a + bot.r * (1 - top.a), g: top.g * top.a + bot.g * (1 - top.a), b: top.b * top.a + bot.b * (1 - top.a), a: 1 });
  const L = (c) => { const f = [c.r, c.g, c.b].map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }); return 0.2126 * f[0] + 0.7152 * f[1] + 0.0722 * f[2]; };
  const ratio = (a, b) => { const [x, y] = [L(a), L(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
  function bgOf(el) { // composite ancestors; null when a gradient/image makes it unknowable
    let layers = [];
    for (let e = el; e; e = e.parentElement) {
      const cs = getComputedStyle(e);
      if (cs.backgroundImage && cs.backgroundImage !== "none") return null;
      const c = parse(cs.backgroundColor);
      if (c && c.a > 0) { layers.push(c); if (c.a === 1) break; }
    }
    let base = { r: 255, g: 255, b: 255, a: 1 };
    for (const l of layers.reverse()) base = over(l, base);
    return base;
  }
  const own = (el) => [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim().length > 0);

  // G1 text floor, G2 reading size info, G4 contrast
  let small = 0, readable = 0, textNodes = 0;
  const seenContrast = new Set();
  for (const el of all) {
    if (!own(el) || !visible(el)) continue;
    textNodes++;
    const cs = getComputedStyle(el), fs = px(cs.fontSize);
    if (fs < spec.global.minFontPx) add("FAIL", "TYP-FLOOR", el, `${fs}px text; minimum is ${spec.global.minFontPx}px`);
    else if (fs < spec.global.readingFontPx) small++;
    else readable++;
    const fg = parse(cs.color), bg = bgOf(el);
    if (fg && bg) {
      const c = ratio(over(fg, bg), bg), large = fs >= 24 || (fs >= 18.66 && px(cs.fontWeight) >= 700), need = large ? spec.global.minContrastLarge : spec.global.minContrast;
      if (c < need) { const key = describe(el) + c.toFixed(1); if (!seenContrast.has(key)) { seenContrast.add(key); add("FAIL", "A11Y-CONTRAST", el, `contrast ${c.toFixed(2)}:1, needs ${need}:1`); } }
    }
  }
  // G3 interactive target size
  const interactive = root.querySelectorAll('button, [role=button], [role=tab], input:not([type=hidden]):not([type=checkbox]):not([type=radio]), select, textarea, a.btn, .nav-item, .tab-item');
  for (const el of interactive) {
    if (!visible(el) || el.closest("[hidden]") || el.closest(ignoreSel)) continue;
    const r = el.getBoundingClientRect();
    const isSmall = el.matches(spec.global.smallTarget[kind === "prototype" ? "proto" : "app"]);
    const touch = window.innerWidth < 900, need = touch ? (isSmall ? spec.global.smallTargetPx : spec.global.minTargetPx) : (spec.global.desktopTargetPx || 32);
    if (r.height + 0.5 < need && !el.closest(".is-compact"))
      add("FAIL", "A11Y-TARGET", el, `${Math.round(r.height)}px high; minimum is ${need}px${touch ? " (touch width)" : " (pointer width)"}${isSmall && touch ? " (small control)" : ""}`);
  }
  // G5 heading ladder + variants
  const heads = [...root.querySelectorAll("h1,h2,h3,h4,h5,h6")].filter((h) => visible(h) && !h.closest(ignoreSel));
  const variants = {};
  heads.forEach((h, i) => {
    const cs = getComputedStyle(h), lv = +h.tagName[1], fs = px(cs.fontSize);
    (variants[h.tagName.toLowerCase()] = variants[h.tagName.toLowerCase()] || new Set()).add(`${fs}/${cs.fontWeight}`);
    for (let j = 0; j < i; j++) { const hj = heads[j]; if (+hj.tagName[1] < lv && px(getComputedStyle(hj).fontSize) < fs) { add("FAIL", "TYP-HIERARCHY", h, `${h.tagName} (${fs}px) is larger than earlier ${hj.tagName} (${px(getComputedStyle(hj).fontSize)}px)`); break; } }
  });
  for (const [tag, set] of Object.entries(variants)) { const max = spec.global.maxVariantsPerTag[tag]; if (max && set.size > max) add("FAIL", "CON-VARIANTS", null, `${tag} has ${set.size} looks on this page: ${[...set].join(", ")}`); }
  const thSet = new Set([...root.querySelectorAll("th")].filter(visible).map((e) => `${px(getComputedStyle(e).fontSize)}/${getComputedStyle(e).fontWeight}`));
  if (thSet.size > (spec.global.maxVariantsPerTag.th || 99)) add("FAIL", "CON-VARIANTS", null, `th has ${thSet.size} looks: ${[...thSet].join(", ")}`);
  // component rules
  const sel = (c) => c[kind === "prototype" ? "proto" : "app"];
  const counts = {};
  for (const [name, c] of Object.entries(spec.components)) {
    const els = [...root.querySelectorAll(sel(c))].filter(visible);
    counts[name] = els.length;
    for (const el of els) {
      const cs = getComputedStyle(el), r = el.getBoundingClientRect();
      if (c.minHeight && r.height + 0.5 < c.minHeight && !el.closest(".is-compact")) add("FAIL", `CMP-${name}`, el, `height ${Math.round(r.height)}px < ${c.minHeight}px`);
      if (c.minFontPx && px(cs.fontSize) + 0.01 < c.minFontPx && !el.closest(".is-compact")) add("FAIL", `CMP-${name}`, el, `font ${px(cs.fontSize)}px < ${c.minFontPx}px`);
      if (c.minFontWeight && px(cs.fontWeight) < c.minFontWeight) add("FAIL", `CMP-${name}`, el, `weight ${cs.fontWeight} < ${c.minFontWeight}`);
      if (c.borderRadiusPx && Math.abs(px(cs.borderTopLeftRadius) - c.borderRadiusPx) > 0.5) add("FAIL", `CMP-${name}`, el, `radius ${px(cs.borderTopLeftRadius)}px != ${c.borderRadiusPx}px`);
    }
  }
  // tile hierarchy
  const t = spec.tile;
  for (const tile of [...root.querySelectorAll(sel(t))].filter(visible)) {
    const lab = tile.querySelector(sel(t.label)) || (kind === "prototype" && tile.querySelector(".tile__top")), cnt = tile.querySelector(sel(t.count));
    if (!lab || !cnt) continue;
    const lcs = getComputedStyle(lab), ccs = getComputedStyle(cnt), bg = bgOf(tile) || { r: 255, g: 255, b: 255, a: 1 };
    const lc = ratio(parse(lcs.color), bg), cc = ratio(parse(ccs.color), bg);
    if (px(lcs.fontWeight) < px(ccs.fontWeight) || lc + 0.01 < cc) add("FAIL", "TYP-TILE", tile, `label (${lcs.fontWeight}, ${lc.toFixed(1)}:1) is not at least as strong as count (${ccs.fontWeight}, ${cc.toFixed(1)}:1)`);
  }
  // brand sizes
  const sizes = [...root.querySelectorAll(sel(spec.brand))].filter(visible).map((e) => Math.round(e.getBoundingClientRect().width));
  for (const s of sizes) if (!spec.brand.allowedSizesPx.includes(s)) add("FAIL", "BRD-SIZE", null, `brand mark ${s}px is not one of ${spec.brand.allowedSizesPx.join("/")}`);
  // images without alt
  for (const img of root.querySelectorAll("img:not([alt])")) add("FAIL", "A11Y-IMGALT", img, "image has no alt attribute");
  // overflow
  const de = document.documentElement;
  if (kind === "app" && de.scrollWidth > de.clientWidth + 1) add("FAIL", "LAY-OVERFLOW", null, `page scrolls sideways (${de.scrollWidth} > ${de.clientWidth})`);
  if (kind === "prototype") { const f = document.getElementById("frame"); if (f && f.scrollWidth > f.clientWidth + 1) add("FAIL", "LAY-OVERFLOW", null, `frame scrolls sideways (${f.scrollWidth} > ${f.clientWidth})`); }
  return { findings, stats: { textNodes, smallReading: small, readable, interactive: interactive.length, counts } };
}

async function focusStops(page, n, within) {
  const bad = [];
  await page.evaluate(() => document.activeElement && document.activeElement.blur());
  for (let i = 0; i < n; i++) {
    await page.keyboard.press("Tab");
    const r = await page.evaluate((within) => {
      const e = document.activeElement; if (!e || e === document.body) return null;
      if (within && !e.closest(within)) return null;
      if (e.tagName === "INPUT" && /^(date|time|datetime-local|month|week)$/.test(e.type)) return null; // native multi-segment controls: the browser draws their focus state
      const cs = getComputedStyle(e), outline = cs.outlineStyle !== "none" && parseFloat(cs.outlineWidth) > 0, shadow = cs.boxShadow && cs.boxShadow !== "none";
      const r = e.getBoundingClientRect();
      return { ok: outline || shadow, dbg: `${cs.outlineStyle} ${cs.outlineWidth} ${cs.boxShadow.slice(0, 20)}`, where: `${e.tagName.toLowerCase()}${e.id ? "#" + e.id : ""}${typeof e.className === "string" && e.className ? "." + e.className.trim().split(/\s+/).slice(0, 2).join(".") : ""}${e.type ? "[type=" + e.type + "]" : ""} "${(e.getAttribute("aria-label") || e.textContent || e.placeholder || "").trim().slice(0, 30)}"`, vis: r.width > 0 && r.height > 0 };
    }, within);
    if (r && r.vis && !r.ok) bad.push({ level: "FAIL", check: "A11Y-FOCUS", where: r.where, msg: `no visible focus indicator (${r.dbg})` });
  }
  return bad;
}

const results = [];
const summary = { fail: 0, warn: 0, pages: 0 };
function record(ctx, res, extra = []) {
  const all = [...res.findings, ...extra];
  summary.pages++;
  for (const f of all) { f.level === "FAIL" ? summary.fail++ : summary.warn++; }
  results.push({ ...ctx, stats: res.stats, findings: all });
}

const browser = await chromium.launch();
try {
  if (target === "prototype") {
    const file = opt("--file", "docs/ux/ORAC_UI_PROTOTYPE.html");
    const url = "file://" + path.resolve(ROOT, file);
    const page = await browser.newPage({ viewport: { width: 1500, height: 900 } });
    await page.goto(url); await page.waitForTimeout(300);
    await page.addStyleTag({ content: "*,*::before,*::after{transition:none!important;animation:none!important}" });
    const only = opt("--roles", ""); const roles = (await page.$$eval("#roleSel option", (o) => o.map((x) => x.value))).filter((r) => !only || only.split(",").includes(r));
    for (const theme of themes) {
      await page.click(`[data-act=theme][data-v=${theme}]`);
      for (const device of ["desktop", "tablet", "mobile"]) {
        await page.click(`[data-act=device][data-v=${device}]`);
        for (const screen of ["app", "ds", "docs", "sdlc"]) {
          await page.selectOption("#screenSel", screen).catch(() => {});
          if (screen !== "app") {
            await page.waitForTimeout(120);
            const res = await page.evaluate(measure, { spec, kind: "prototype" });
            record({ theme, device, screen, role: "-", page: screen }, res);
            continue;
          }
          for (const role of roles) {
            await page.selectOption("#roleSel", role); await page.waitForTimeout(80);
            const pages = await page.$$eval("[data-act=go][data-p]", (e) => [...new Set(e.map((x) => x.dataset.p))]);
            const home = await page.evaluate(() => S.page);
            for (const p of [...new Set([home, ...pages])]) {
              await page.evaluate((p) => { S.page = p; S.menu = null; render(); }, p); await page.waitForTimeout(60);
              const res = await page.evaluate(measure, { spec, kind: "prototype" });
              const extra = device === "desktop" && theme === "light" ? await focusStops(page, spec.global.focusTabStops, "#frame") : [];
              record({ theme, device, screen, role, page: p }, res, extra);
            }
          }
        }
      }
    }
  } else {
    const base = opt("--url", "http://127.0.0.1:5176");
    if (!/^https?:\/\/(127\.0\.0\.1|localhost)(:|\/|$)/.test(base) && process.env.ORAC_PROBE_ALLOW_REMOTE !== "1") { console.error(`REFUSED: ${base} is not a local address. The probe signs in; run it against a local or test backend only. Set ORAC_PROBE_ALLOW_REMOTE=1 only with the owner's written approval.`); process.exit(2); }
    const routes = readJson("ux/routes.json");
    const pw = process.env.ORAC_PROBE_PASSWORD;
    for (const [role, list] of Object.entries(routes.roles)) {
      const email = process.env[`ORAC_PROBE_EMAIL_${role.toUpperCase()}`];
      if (!email || !pw) { console.log(`skip role ${role}: set ORAC_PROBE_EMAIL_${role.toUpperCase()} and ORAC_PROBE_PASSWORD`); continue; }
      for (const theme of themes) for (const vp of routes.viewports) {
        const ctx = await browser.newContext({ viewport: vp, colorScheme: theme });
        const page = await ctx.newPage();
        await page.addInitScript((t) => { try { localStorage.setItem("orac-theme", t); } catch {} }, theme);
        await page.addInitScript(() => { document.addEventListener("DOMContentLoaded", () => { const s = document.createElement("style"); s.textContent = "*,*::before,*::after{transition:none!important;animation:none!important}"; document.head.appendChild(s); }); });
        await page.goto(`${base}/login`, { waitUntil: "domcontentloaded" });
        await page.getByLabel(routes.login.emailLabel).fill(email); await page.getByLabel(routes.login.passwordLabel).fill(pw);
        await page.getByRole("button", { name: new RegExp(routes.login.submitName, "i") }).click();
        await page.waitForURL((u) => !u.pathname.endsWith("/login"), { timeout: 15000 });
        for (const route of list) {
          await page.goto(`${base}${route}`, { waitUntil: "domcontentloaded" });
          await page.waitForFunction(() => !document.querySelector('[data-evidence*="loading"]'), undefined, { timeout: 15000 }).catch(() => {});
          await page.waitForTimeout(200);
          const res = await page.evaluate(measure, { spec, kind: "app" });
          const extra = vp.width >= 1024 && theme === "light" ? await focusStops(page, spec.global.focusTabStops) : [];
          record({ theme, device: `${vp.width}px`, screen: "app", role, page: route }, res, extra);
        }
        await ctx.close();
      }
    }
  }
} finally { await browser.close(); }

// ---------- report ----------
const byCheck = {};
for (const r of results) for (const f of r.findings) { const k = f.check; (byCheck[k] = byCheck[k] || { count: 0, examples: new Map() }).count++; const ex = `${r.role}/${r.page}@${r.device}/${r.theme}: ${f.where} ${f.msg}`; if (byCheck[k].examples.size < 4) byCheck[k].examples.set(ex, 1); }
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, "results.json"), JSON.stringify({ target, runId, summary, byCheck: Object.fromEntries(Object.entries(byCheck).map(([k, v]) => [k, { count: v.count, examples: [...v.examples.keys()] }])), results }, null, 1));
const readable = results.reduce((a, r) => a + r.stats.readable, 0), smallRead = results.reduce((a, r) => a + r.stats.smallReading, 0);
const lines = [`# UX probe: ${target} (${runId})`, "", `Pages measured: ${summary.pages}. FAIL findings: ${summary.fail}. Text nodes at ${spec.global.readingFontPx}px or more: ${readable}; between ${spec.global.minFontPx} and ${spec.global.readingFontPx}px (secondary text, informational): ${smallRead}.`, ""];
if (!Object.keys(byCheck).length) lines.push("No findings.");
for (const [k, v] of Object.entries(byCheck).sort((a, b) => b[1].count - a[1].count)) { lines.push(`## ${k}: ${v.count}`); for (const e of v.examples.keys()) lines.push(`- ${e}`); lines.push(""); }
fs.writeFileSync(path.join(outDir, "summary.md"), lines.join("\n"));
if (args.includes("--json")) console.log(JSON.stringify({ ok: summary.fail === 0, summary, byCheck: Object.fromEntries(Object.entries(byCheck).map(([k, v]) => [k, v.count])) }));
else { console.log(lines.join("\n")); console.log(`Evidence: ${path.relative(ROOT, outDir)}`); }
process.exit(summary.fail ? 1 : 0);
