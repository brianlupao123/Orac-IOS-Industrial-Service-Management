#!/usr/bin/env node
/**
 * orac-export.mjs v3 - bundle the ORAC portal FRONTEND plus a static UI/UX inventory.
 *
 * Run from the frontend root (the folder that holds package.json and src/):
 *     node orac-export.mjs                         zip + inventory only
 *     node orac-export.mjs --with-tests            also run `npm test`
 *     node orac-export.mjs --with-build            also run `npm run build`
 *     node orac-export.mjs --with-maintain         also run `npm run maintain`
 *     node orac-export.mjs --slim                  skip images/PDF/Office files (keeps small logos)
 *     (flags can be combined; output of each is stored in the zip)
 *
 * No dependencies. Node 18+. Read-only: never edits your project.
 * Writes ONE file next to package.json: orac-ui-export.zip
 *
 * Inside the zip, besides your files:
 *   EXPORT_MANIFEST.md   what was included/skipped, versions, secret warnings
 *   UX_INVENTORY.md      generated facts (part 2: type hierarchy per element, heading order,
 *                        card/button/input/badge variants, page skeletons, logo use, where
 *                        styling is centrally controlled): text sizes, colours, buttons, inputs,
 *                        tone maps, widths, component usage, routes, tokens, tests
 *   ux_inventory.json    the same numbers, machine-readable
 *   *_OUTPUT.txt         test/build/maintain output when requested
 *
 * Left out: node_modules, .git, dist/build, .env*, data/, uploads/, db files, logs,
 * lock files, keys, fonts, video, zips, and any file over 400 KB.
 * Note: the inventory is a regex scan of source text, not rendered pages. It finds
 * candidates for review; it is not proof of what users see.
 */
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { execSync } from 'node:child_process';

const ROOT = process.cwd();
const OUT = 'orac-ui-export.zip';
const MAX_BYTES = 400 * 1024;
const has = (f) => process.argv.includes(f);
const SLIM = has('--slim');
const BIN = /\.(png|jpe?g|gif|webp|bmp|ico|pdf|docx?|xlsx?|pptx?|mp3|wav|psd|ai|sketch|fig)$/i;
const RUN = { test: has('--with-tests'), build: has('--with-build'), maintain: has('--with-maintain') };

if (!fs.existsSync(path.join(ROOT, 'package.json')) || !fs.existsSync(path.join(ROOT, 'src'))) {
  console.error('Run this from the frontend root (needs package.json and src/ here).');
  process.exit(1);
}

const SKIP_DIRS = new Set(['node_modules', '.git', 'dist', 'build', 'coverage', '.vite', '.next',
  'data', 'uploads', 'storage', '.cache', '.turbo', '.vercel', '.idea', '.vscode']);
const SKIP_FILE = [/^\.env/i, /\.(log|pem|key|p12|pfx|sqlite3?|db)$/i, /^package-lock\.json$/i,
  /^yarn\.lock$/i, /^pnpm-lock\.yaml$/i, /\.zip$/i, /\.(mp4|mov|woff2?|ttf|otf)$/i, /^\.DS_Store$/];
const SECRET_LINE = /(secret|password|passwd|token|api[_-]?key|private[_-]?key)\s*[:=]\s*['"][^'"\s]{12,}['"]/i;

// ---------- collect files ----------
const files = [];
const skipped = [];
(function walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name);
    const rel = path.relative(ROOT, full).split(path.sep).join('/');
    if (e.isSymbolicLink()) continue;
    if (e.isDirectory()) {
      if (SKIP_DIRS.has(e.name)) { skipped.push(rel + '/ (folder)'); continue; }
      walk(full);
    } else if (e.isFile()) {
      if (rel === OUT) continue;
      if (SKIP_FILE.some((r) => r.test(e.name))) { skipped.push(rel + ' (type)'); continue; }
      const size = fs.statSync(full).size;
      if (size > MAX_BYTES) { skipped.push(`${rel} (${Math.round(size / 1024)} KB)`); continue; }
      if (SLIM && BIN.test(e.name) && !(/logo|orac|brand|favicon/i.test(e.name) && size < 150 * 1024)) { skipped.push(`${rel} (slim: binary)`); continue; }
      files.push({ rel, data: fs.readFileSync(full) });
    }
  }
})(ROOT);
const text = (f) => f.data.toString('utf8');

const flagged = [];
for (const f of files) {
  if (!/\.(jsx?|tsx?|json|cjs|mjs|html|css|md)$/i.test(f.rel)) continue;
  text(f).split('\n').forEach((l, i) => { if (SECRET_LINE.test(l)) flagged.push(`${f.rel}:${i + 1}`); });
}

const sh = (c) => { try { return execSync(c, { cwd: ROOT, stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim(); } catch { return ''; } };
function runNpm(label, cmd) {
  console.log(`Running ${cmd} ...`);
  try { return `EXIT 0\n` + execSync(`${cmd} 2>&1`, { cwd: ROOT, maxBuffer: 50e6 }).toString(); }
  catch (err) { return `EXIT ${err.status}\n` + String(err.stdout || '') + String(err.stderr || ''); }
}
const outputs = [];
if (RUN.test) outputs.push({ rel: 'TEST_OUTPUT.txt', data: Buffer.from(runNpm('test', 'npm test')) });
if (RUN.build) outputs.push({ rel: 'BUILD_OUTPUT.txt', data: Buffer.from(runNpm('build', 'npm run build')) });
if (RUN.maintain) outputs.push({ rel: 'MAINTAIN_OUTPUT.txt', data: Buffer.from(runNpm('maintain', 'npm run maintain')) });

// ---------- static UX inventory ----------
const src = files.filter((f) => /^src\/.*\.(jsx?|tsx?)$/.test(f.rel));
const cssFiles = files.filter((f) => /\.css$/.test(f.rel));
const tally = (s, re) => (s.match(re) || []).length;
const COLORS = 'slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose';
const RE = {
  rawColor: new RegExp(`\\b(?:bg|text|border|ring|divide|from|to|via|fill|stroke|outline|placeholder)-(?:${COLORS})-\\d{2,3}\\b`, 'g'),
  hex: /#[0-9a-fA-F]{6}\b|#[0-9a-fA-F]{3}\b/g,
  oracTok: /orac-[a-z-]+/g,
  textXs: /\btext-xs\b/g, textSm: /\btext-sm\b/g, textBase: /\btext-base\b/g,
  textLg: /\btext-(?:lg|xl|2xl|3xl|4xl)\b/g, textPx: /\btext-\[\d+(?:\.\d+)?(?:px|rem)\]/g,
  button: /<button\b/g, input: /<(?:input|select|textarea)\b/g,
  btnComp: /<Button\b/g, fieldComp: /<(?:FormField|Field)\b/g,
  smallH: /\bh-(?:6|7|8|9|10)\b/g, okH: /\b(?:h-11|min-h-\[44px\]|min-h-11|h-12)\b/g,
  ariaLabel: /aria-label=/g,
  maxW: /\bmax-w-(?:xs|sm|md|lg|xl|2xl|3xl|4xl|5xl|6xl|7xl|full|screen-\w+)\b/g,
  pad: /\bp-(?:4|5|6|8)\b/g,
  toneMap: /\b(?:statusTone|TONES?|STATUS_MAP|toneClass(?:es)?|\w*ToneMap|\w*Tones)\s*=/g,
  roundedBtn: /\brounded-(?:sm|md|lg|xl|full)\b/g,
  dark: /\bdark:/g,
};
const per = src.map((f) => {
  const s = text(f);
  const row = { file: f.rel, lines: s.split('\n').length };
  for (const k of Object.keys(RE)) row[k] = tally(s, RE[k]);
  return row;
});
const sum = (k) => per.reduce((a, r) => a + r[k], 0);
const totals = Object.fromEntries(Object.keys(RE).map((k) => [k, sum(k)]));

// component usage graph
const comps = src.filter((f) => /^src\/(components|layouts)\//.test(f.rel));
const usedBy = {};
for (const c of comps) {
  const base = path.basename(c.rel).replace(/\.[jt]sx?$/, '');
  usedBy[c.rel] = src.filter((o) => o.rel !== c.rel &&
    new RegExp(`import[^;]*['"][^'"]*/${base}(?:\\.[jt]sx?)?['"]`).test(text(o))).map((o) => o.rel);
}

// routes (read only)
const routes = [];
for (const f of src.filter((x) => /App\.[jt]sx?$/.test(x.rel))) {
  for (const m of text(f).matchAll(/path=["']([^"']+)["']/g)) routes.push(m[1]);
}

// tokens
const tokens = {};
for (const f of cssFiles) {
  for (const m of text(f).matchAll(/(--orac-[a-z0-9-]+)\s*:\s*([^;]+);/g)) tokens[m[1]] = (tokens[m[1]] || []).concat(m[2].trim()).slice(0, 4);
}

// tests: which source files they read and which literals they assert
const testFiles = files.filter((f) => /(^|\/)(tests?|__tests__)\/|\.test\.[mc]?[jt]sx?$/.test(f.rel));
const tests = testFiles.map((f) => {
  const s = text(f);
  const reads = [...new Set([...s.matchAll(/['"`]((?:\.\.?\/)+[^'"`]*src\/[^'"`]+|src\/[^'"`]+)['"`]/g)].map((m) => m[1]))];
  const lits = [...s.matchAll(/\b(?:includes|match|doesNotMatch|notMatch)\(\s*(['"`])((?:(?!\1).){2,140})\1/g)].map((m) => m[2]);
  return { file: f.rel, reads, assertions: lits.length, literals: lits.slice(0, 60) };
});

const top = (k, n = 12) => [...per].sort((a, b) => b[k] - a[k]).slice(0, n).filter((r) => r[k] > 0);
const tbl = (k) => ['| File | Count |', '|---|---|', ...top(k).map((r) => `| ${r.file} | ${r[k]} |`)].join('\n');
const inv = [
  '# UX inventory (generated by regex scan of source text)', '',
  'Candidates for review only. Not rendered pages. Counts include comments and strings.', '',
  `Source files scanned: ${src.length} (${comps.length} in components/layouts)`, '',
  '## Totals', '| Measure | Count |', '|---|---|',
  ...[
    ['Raw Tailwind colour classes (bg-slate-100 etc.)', 'rawColor'], ['Hex colours in JS/JSX', 'hex'],
    ['--orac / orac-* token references', 'oracTok'], ['text-xs', 'textXs'], ['text-sm', 'textSm'], ['text-base', 'textBase'],
    ['text-lg and larger', 'textLg'], ['arbitrary text-[Npx]', 'textPx'],
    ['<button> elements', 'button'], ['<Button> component uses', 'btnComp'],
    ['<input>/<select>/<textarea>', 'input'], ['<FormField>/<Field> uses', 'fieldComp'],
    ['small heights h-6..h-10', 'smallH'], ['44 px+ heights', 'okH'], ['aria-label attributes', 'ariaLabel'],
    ['max-w-* container widths', 'maxW'], ['p-4/5/6/8 page-like padding', 'pad'],
    ['local tone/status map definitions', 'toneMap'], ['dark: variants', 'dark'],
  ].map(([l, k]) => `| ${l} | ${totals[k]} |`), '',
  '## Files with most raw colour classes', tbl('rawColor'), '',
  '## Files with most text-xs', tbl('textXs'), '',
  '## Files with most text-sm', tbl('textSm'), '',
  '## Files with most <button> elements', tbl('button'), '',
  '## Files with most small heights (h-6..h-10)', tbl('smallH'), '',
  '## Local tone/status map definitions (candidates to merge into StatusBadge/tone tokens)',
  ...(top('toneMap', 40).map((r) => `- ${r.file} (${r.toneMap})`) || []), '',
  '## Container widths per file (max-w-*, page padding)',
  ...per.filter((r) => /pages\//.test(r.file) && (r.maxW || r.pad)).map((r) => `- ${r.file}: max-w ${r.maxW}, p-* ${r.pad}`), '',
  '## Shared components and who uses them',
  ...comps.map((c) => `- ${c.rel}: used by ${usedBy[c.rel].length}${usedBy[c.rel].length ? ' (' + usedBy[c.rel].slice(0, 6).join(', ') + (usedBy[c.rel].length > 6 ? ', ...' : '') + ')' : ' (no importers found)'}`), '',
  '## Routes found in App (read only)', ...(routes.length ? routes.map((r) => `- ${r}`) : ['- none found']), '',
  '## Design tokens found in CSS (--orac-*)', ...(Object.keys(tokens).length ? Object.entries(tokens).map(([k, v]) => `- ${k}: ${v.join(' | ')}`) : ['- none found']), '',
  '## Tests that read source files (these can break when markup changes)',
  ...tests.filter((t) => t.reads.length || t.assertions).map((t) => `### ${t.file}\nReads: ${t.reads.join(', ') || 'n/a'}\nAsserted strings (${t.assertions}):\n${t.literals.map((l) => '- `' + l.replace(/`/g, "'") + '`').join('\n')}`), '',
].join('\n');


// ---------- v3: hierarchy, uniformity, signatures, logo, central control ----------
const SZ = ['xs', 'sm', 'base', 'lg', 'xl', '2xl', '3xl', '4xl', '5xl', '6xl'];
const WT = { thin: 100, light: 300, normal: 400, medium: 500, semibold: 600, bold: 700, extrabold: 800, black: 900 };
const lineOf = (s, i) => s.slice(0, i).split('\n').length;
function nodesOf(f) {
  const s = text(f); const out = [];
  const re = /className=(?:"([^"]*)"|'([^']*)'|\{`([^`]*)`\}|\{"([^"]*)"\}|\{'([^']*)'\})/g;
  for (const m of s.matchAll(re)) {
    const cls = (m[1] ?? m[2] ?? m[3] ?? m[4] ?? m[5] ?? '').replace(/\$\{[^}]*\}/g, ' ').replace(/\s+/g, ' ').trim();
    const lt = s.lastIndexOf('<', m.index); const tm = /^<([A-Za-z][\w.]*)/.exec(s.slice(lt, lt + 40));
    const toks = cls.split(' ').filter(Boolean).map((t) => t.replace(/^(?:sm|md|lg|xl|2xl|min-\[[^\]]+\]|max-\[[^\]]+\]):/, ''));
    const size = (toks.find((t) => /^text-(?:xs|sm|base|lg|xl|[2-9]xl|\[[\d.]+(?:px|rem)\])$/.test(t)) || '').replace('text-', '');
    const wt = (toks.find((t) => /^font-(?:thin|light|normal|medium|semibold|bold|extrabold|black)$/.test(t)) || '').replace('font-', '');
    out.push({ file: f.rel, line: lineOf(s, m.index), tag: tm ? tm[1] : '?', cls, toks, size, wt });
  }
  return out;
}
const nodes = src.flatMap(nodesOf);
const sizeRank = (z) => { const i = SZ.indexOf(z); return i < 0 ? (/^\[/.test(z) ? -2 : -1) : i; };

// 1) element-role distributions (uniformity): same tag should look the same everywhere
const ROLE_TAGS = ['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'label', 'th', 'td', 'p', 'button', 'input', 'select', 'textarea', 'a', 'Button', 'PageHeaderBanner'];
const roleDist = {};
for (const t of ROLE_TAGS) {
  const m = {};
  for (const n of nodes.filter((x) => x.tag === t)) { const k = `${n.size || 'inherit'} / ${n.wt || 'inherit'}`; m[k] = (m[k] || 0) + 1; }
  if (Object.keys(m).length) roleDist[t] = Object.entries(m).sort((a, b) => b[1] - a[1]).slice(0, 8);
}

// 2) heading inversions: a lower-level heading rendered larger than an earlier higher-level one
const inversions = [];
for (const f of src) {
  const hs = nodes.filter((n) => n.file === f.rel && /^h[1-6]$/.test(n.tag) && sizeRank(n.size) >= 0);
  for (let i = 0; i < hs.length; i++) for (let j = i + 1; j < hs.length; j++) {
    if (+hs[j].tag[1] > +hs[i].tag[1] && sizeRank(hs[j].size) > sizeRank(hs[i].size)) {
      inversions.push(`${f.rel}:${hs[i].line} ${hs[i].tag} ${hs[i].size} < ${hs[j].tag} ${hs[j].size} at line ${hs[j].line}`); break;
    }
  }
}
// 3) label vs value inside one class string (tile-like): flags when same-file siblings invert
const tileHints = nodes.filter((n) => /text-(?:2xl|3xl|4xl)/.test(n.cls) && /(?:text-)?(?:muted|gray|slate)/.test(n.cls)).slice(0, 25)
  .map((n) => `${n.file}:${n.line} <${n.tag}> ${n.cls.slice(0, 90)}`);

// 4) generic scale distributions across ALL class strings
const dist = (re) => { const m = {}; for (const n of nodes) for (const t of n.toks) if (re.test(t)) m[t] = (m[t] || 0) + 1; return Object.entries(m).sort((a, b) => b[1] - a[1]).slice(0, 14); };
const scales = {
  'font size': dist(/^text-(?:xs|sm|base|lg|xl|[2-9]xl|\[[\d.]+(?:px|rem)\])$/), 'font weight': dist(/^font-(?:thin|light|normal|medium|semibold|bold|extrabold|black)$/),
  'radius': dist(/^rounded(?:-(?:none|sm|md|lg|xl|2xl|3xl|full|\[[^\]]+\]))?$/), 'shadow': dist(/^shadow(?:-\w+)?$/),
  'padding': dist(/^p-(?:\d+|\[[^\]]+\])$/), 'gap': dist(/^gap-(?:\d+|\[[^\]]+\])$/), 'vertical stack': dist(/^space-y-\d+$/),
  'max width': dist(/^max-w-\S+$/), 'height': dist(/^(?:h|min-h)-(?:\d+|\[[^\]]+\])$/),
};

// 5) component "signatures": how cards/panels, buttons, inputs, badges are really styled
const sig = (n, keep) => n.toks.filter((t) => keep.test(t)).sort().join(' ');
const sigTable = (pred, keep, top = 18) => {
  const m = {};
  for (const n of nodes.filter(pred)) { const k = sig(n, keep) || '(none)'; (m[k] = m[k] || { c: 0, ex: `${n.file}:${n.line}` }).c++; }
  return Object.entries(m).sort((a, b) => b[1].c - a[1].c).slice(0, top).map(([k, v]) => `| ${v.c} | \`${k}\` | ${v.ex} |`);
};
const cardPred = (n) => /\brounded/.test(n.cls) && /\b(?:border|shadow)/.test(n.cls) && /\bbg-/.test(n.cls) && /\bp-|\bpx-|\bpy-/.test(n.cls);
const btnPred = (n) => n.tag === 'button' || n.tag === 'Button' || /\bbtn\b/.test(n.cls);
const inpPred = (n) => ['input', 'select', 'textarea'].includes(n.tag);
const badgePred = (n) => /\brounded-full\b/.test(n.cls) && /\bpx-\d/.test(n.cls) && /text-(?:xs|sm)/.test(n.cls);
const sigs = {
  card: sigTable(cardPred, /^(?:rounded(?:-\w+)?|p[xy]?-\d+|border(?:-\w+)?|shadow(?:-\w+)?)$/),
  button: sigTable(btnPred, /^(?:text-(?:xs|sm|base|lg)|font-\w+|h-\d+|min-h-\S+|px-\d+|py-\d+|rounded(?:-\w+)?|border(?:-\d)?)$/),
  input: sigTable(inpPred, /^(?:text-(?:xs|sm|base|lg)|h-\d+|min-h-\S+|px-\d+|py-\d+|rounded(?:-\w+)?|border(?:-\w+)?)$/),
  badge: sigTable(badgePred, /^(?:text-(?:xs|sm)|font-\w+|px-\d+|py-\d+)$/),
};
const sigCounts = { card: nodes.filter(cardPred).length, button: nodes.filter(btnPred).length, input: nodes.filter(inpPred).length, badge: nodes.filter(badgePred).length };

// 6) page skeletons (which building blocks each page uses, in order)
const skeleton = src.filter((f) => /^src\/pages\//.test(f.rel)).map((f) => {
  const s = text(f); const seen = [];
  for (const m of s.matchAll(/<([A-Z][A-Za-z0-9]*)\b/g)) if (!seen.includes(m[1])) seen.push(m[1]);
  const plain = ['section', 'article', 'header', 'table', 'form', 'nav', 'aside', 'main'].map((t) => [t, tally(s, new RegExp(`<${t}\\b`, 'g'))]).filter(([, c]) => c).map(([t, c]) => `${t}×${c}`);
  return `- ${f.rel}: ${seen.slice(0, 30).join(' > ') || '(no components)'}${plain.length ? '  | ' + plain.join(' ') : ''}`;
});

// 7) logo and brand usage
const assetFiles = files.filter((f) => /\.(png|svg|jpe?g|webp|ico)$/i.test(f.rel));
const pngDims = (f) => (f.data.length > 24 && f.data.slice(1, 4).toString() === 'PNG') ? `${f.data.readUInt32BE(16)}x${f.data.readUInt32BE(20)}` : '';
const logoAssets = assetFiles.filter((f) => /logo|orac|brand|handon|favicon/i.test(f.rel)).map((f) => `- ${f.rel} (${Math.round(f.data.length / 1024)} KB${pngDims(f) ? ', ' + pngDims(f) : ''})`);
const logoUses = [];
for (const f of files.filter((x) => /\.(jsx?|tsx?|html|css)$/.test(x.rel))) {
  text(f).split('\n').forEach((l, i) => { if (/logo|orac[-_]?(?:mark|brand)|<img\b/i.test(l) && /(?:src=|import |url\(|alt=)/.test(l)) logoUses.push(`- ${f.rel}:${i + 1} ${l.trim().slice(0, 170)}`); });
}
const brandHexes = {};
for (const f of [...cssFiles, ...files.filter((x) => /tailwind\.config/.test(x.rel))]) for (const m of text(f).matchAll(/#[0-9a-fA-F]{6}\b/g)) { const h = m[0].toLowerCase(); brandHexes[h] = (brandHexes[h] || 0) + 1; }

// 8) central control: where does styling decisions live?
const twc = files.find((f) => /^tailwind\.config\.[cm]?[jt]s$/.test(f.rel));
const twText = twc ? text(twc) : '';
const prims = ['Button', 'Card', 'Panel', 'FormField', 'Field', 'Input', 'Select', 'Modal', 'Dialog', 'Notice', 'Alert', 'SectionHeading', 'PageHeader', 'PageHeaderBanner', 'StatCard', 'IconStatCard', 'StatusBadge', 'DataTable', 'EmptyState', 'Skeleton', 'Tabs', 'Toast'];
const primFound = prims.map((p) => { const f = src.find((x) => new RegExp(`/${p}\\.[jt]sx?$`).test(x.rel)); return `- ${p}: ${f ? f.rel + ' (used by ' + ((usedBy[f.rel] || []).length) + ')' : 'NOT FOUND'}`; });
const control = [
  `- tailwind config: ${twc ? twc.rel : 'not found'}; theme.extend: ${/extend\s*:/.test(twText) ? 'yes' : 'no'}; custom fontSize: ${/fontSize/.test(twText) ? 'yes' : 'no'}; colors mapped to CSS variables: ${/var\(--/.test(twText) ? 'yes' : 'no'}; darkMode: ${(/darkMode\s*:\s*([^,\n]+)/.exec(twText) || [, '?'])[1].trim()}`,
  `- --orac-* variables declared: ${Object.keys(tokens).length}; @apply uses: ${cssFiles.reduce((a, f) => a + tally(text(f), /@apply\b/g), 0)}; @layer blocks: ${cssFiles.reduce((a, f) => a + tally(text(f), /@layer\b/g), 0)}`,
  `- CSS rules overriding raw Tailwind classes (retrofit bridge; selectors containing \\.bg-|\\.text-|\\.border-): ${cssFiles.reduce((a, f) => a + tally(text(f), /\.(?:bg|text|border|ring|divide)-[a-z]+-\d{2,3}/g), 0)}`,
  `- inline style={{ }} in JSX: ${tally(src.map(text).join('\n'), /style=\{\{/g)}`,
  `- letter-spacing overrides: ${cssFiles.reduce((a, f) => a + tally(text(f), /letter-spacing/g), 0)}; font-family declarations: ${cssFiles.reduce((a, f) => a + tally(text(f), /font-family/g), 0)}`,
];

const inv3 = [
  '', '# PART 2: hierarchy, uniformity and central control', '',
  '## A. Same element, same look? (element role -> text size / weight, count)',
  'If one tag shows many different pairs, pages are not governed by one rule.',
  ...Object.entries(roleDist).map(([t, arr]) => `- <${t}>: ${arr.map(([k, c]) => `${k} x${c}`).join('; ')}`), '',
  '## B. Heading order inversions (a lower-level heading drawn larger than an earlier higher-level one)',
  ...(inversions.length ? inversions.slice(0, 60).map((x) => '- ' + x) : ['- none found by pattern']), '',
  '## C. Large muted text (possible label/value inversions in tiles; review by eye)',
  ...(tileHints.length ? tileHints.map((x) => '- ' + x) : ['- none']), '',
  '## D. Scale usage across all class strings (token, count)',
  ...Object.entries(scales).map(([k, arr]) => `- ${k}: ${arr.map(([t, c]) => `${t} x${c}`).join(', ')}`), '',
  '## E. Component signatures (count | classes that define the look | first example)',
  ...['card', 'button', 'input', 'badge'].flatMap((k) => [`### ${k} (${sigCounts[k]} nodes; each distinct row is a variant that should be on purpose)`, '| Count | Signature | Example |', '|---|---|---|', ...sigs[k], '']),
  '## F. Page skeletons (building blocks per page, in order of first use)', ...skeleton, '',
  '## G. Logo and brand',
  'Logo files:', ...(logoAssets.length ? logoAssets : ['- none matched logo|orac|brand|handon|favicon']), '',
  'Logo/image references (file:line):', ...(logoUses.length ? logoUses.slice(0, 40) : ['- none found']), '',
  'Hex colours declared in CSS/tailwind config (count):', Object.entries(brandHexes).sort((a, b) => b[1] - a[1]).slice(0, 20).map(([h, c]) => `${h} x${c}`).join(', ') || 'none', '',
  '## H. Central control: where styling decisions live',
  ...control, '', 'Shared primitives:', ...primFound, '',
].join('\n');
const invFull = inv + inv3;
const inv3json = { roleDist, inversions, scales, sigCounts, skeleton, logoAssets, logoUses, brandHexes, control, primFound };

function sizeBy(key) { const m = {}; for (const f of files) { const k = key(f); m[k] = (m[k] || 0) + f.data.length; } return Object.entries(m).sort((x, y) => y[1] - x[1]).slice(0, 10).map(([k, v]) => `${k}: ${Math.round(v / 1024)}`); }
const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
const manifest = [
  '# ORAC UI export manifest', '',
  `Created: ${new Date().toISOString()}`, `Node: ${process.version}`,
  `Git commit: ${sh('git rev-parse --short HEAD') || 'n/a'}${sh('git status --porcelain') ? ' (uncommitted changes present)' : ''}`,
  `Package: ${pkg.name || '?'} ${pkg.version || ''}`,
  `Scripts: ${JSON.stringify(pkg.scripts || {})}`,
  `Dependencies: ${JSON.stringify(pkg.dependencies || {})}`,
  `DevDependencies: ${JSON.stringify(pkg.devDependencies || {})}`,
  `Files included: ${files.length}`,
  `Commands run: ${Object.entries(RUN).filter(([, v]) => v).map(([k]) => k).join(', ') || 'none'}`, '',
  '## Size by top-level folder (KB, uncompressed)',
  ...sizeBy((f) => f.rel.split('/')[0]).map((x) => '- ' + x),
  '## Size by file type (KB, uncompressed)',
  ...sizeBy((f) => (path.extname(f.rel) || '(none)').toLowerCase()).map((x) => '- ' + x),
  '## Largest 15 included files',
  ...[...files].sort((x, y) => y.data.length - x.data.length).slice(0, 15).map((f) => `- ${f.rel} (${Math.round(f.data.length / 1024)} KB)`), '',
  '## Possible hard-coded secrets (file:line only; review before sharing)',
  ...(flagged.length ? flagged.map((x) => '- ' + x) : ['- none found by pattern (not a guarantee)']), '',
  '## Skipped', ...skipped.map((x) => '- ' + x), '',
  '## Included', ...files.map((f) => '- ' + f.rel), '',
].join('\n');

const jsonInv = JSON.stringify({ part2: inv3json, totals, perFile: per, usedBy, routes, tokens, tests: tests.map(({ literals, ...t }) => t) }, null, 1);
const extra = [
  { rel: 'EXPORT_MANIFEST.md', data: Buffer.from(manifest) },
  { rel: 'UX_INVENTORY.md', data: Buffer.from(invFull) },
  { rel: 'ux_inventory.json', data: Buffer.from(jsonInv) },
  ...outputs,
];
const all = [...extra, ...files];

// ---------- minimal zip writer (deflate) ----------
const T = new Uint32Array(256).map((_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
const crc32 = (b) => { let c = 0xffffffff; for (let i = 0; i < b.length; i++) c = T[(c ^ b[i]) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
const parts = []; const central = []; let off = 0;
for (const f of all) {
  const name = Buffer.from(f.rel); const comp = zlib.deflateRawSync(f.data); const crc = crc32(f.data);
  const lh = Buffer.alloc(30);
  lh.writeUInt32LE(0x04034b50, 0); lh.writeUInt16LE(20, 4); lh.writeUInt16LE(0x0800, 6); lh.writeUInt16LE(8, 8);
  lh.writeUInt16LE(0, 10); lh.writeUInt16LE(0x21, 12); lh.writeUInt32LE(crc, 14);
  lh.writeUInt32LE(comp.length, 18); lh.writeUInt32LE(f.data.length, 22); lh.writeUInt16LE(name.length, 26);
  parts.push(lh, name, comp);
  const ch = Buffer.alloc(46);
  ch.writeUInt32LE(0x02014b50, 0); ch.writeUInt16LE(20, 4); ch.writeUInt16LE(20, 6); ch.writeUInt16LE(0x0800, 8);
  ch.writeUInt16LE(8, 10); ch.writeUInt16LE(0, 12); ch.writeUInt16LE(0x21, 14); ch.writeUInt32LE(crc, 16);
  ch.writeUInt32LE(comp.length, 20); ch.writeUInt32LE(f.data.length, 24); ch.writeUInt16LE(name.length, 28);
  ch.writeUInt32LE(off, 42);
  central.push(ch, name);
  off += lh.length + name.length + comp.length;
}
const cdSize = central.reduce((a, b) => a + b.length, 0);
const end = Buffer.alloc(22);
end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(all.length, 8); end.writeUInt16LE(all.length, 10);
end.writeUInt32LE(cdSize, 12); end.writeUInt32LE(off, 16);
fs.writeFileSync(path.join(ROOT, OUT), Buffer.concat([...parts, ...central, end]));

const kb = Math.round(fs.statSync(path.join(ROOT, OUT)).size / 1024);
console.log(`\nDone: ${OUT} (${kb} KB, ${all.length} files)`);
console.log(`Scanned ${src.length} source files: ${totals.rawColor} raw colour classes, ${totals.button} <button>, ${totals.input} form controls, ${totals.toneMap} local tone maps.`);
if (kb > 20000) console.log('NOTE: zip is over 20 MB. Re-run with --slim, or see "Size by" in EXPORT_MANIFEST.md.');
if (flagged.length) console.log(`WARNING: ${flagged.length} line(s) look like hard-coded secrets. See EXPORT_MANIFEST.md and check before sharing.`);
