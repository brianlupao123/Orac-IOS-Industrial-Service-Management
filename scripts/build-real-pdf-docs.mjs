/**
 * build-real-pdf-docs.mjs
 * 
 * Renders the full ORAC-IOS documentation set (markdown → HTML → PDF)
 * using Marked (proper markdown parsing) and Playwright.
 */

import { readFile, writeFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { marked } from "marked";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, "..");
const refDocs = path.join(root, "deliverables", "_ref_docs", "orac-ios-documentation");
const outDir = path.join(root, "deliverables", "final-documents");

// Orac brand
const navy = "#004088";
const gearBlue = "#3890D8";
const dark = "#080838";

const DOC_SET = [
  { file: "README_DOCUMENTATION_INDEX.md",                    title: "Documentation Index" },
  { file: "ORAC_IOS_SYSTEM_DOCUMENTATION.md",                 title: "System Documentation" },
  { file: "ORAC_IOS_USER_MANUAL.md",                          title: "User Manual" },
  { file: "ORAC_IOS_SOFTWARE_ARCHITECTURE.md",                title: "Software Architecture" },
  { file: "ORAC_IOS_WORKFLOW_AND_DATA_DICTIONARY.md",         title: "Workflow & Data Dictionary" },
  { file: "ORAC_IOS_UX_WIREFRAMES_AND_SCREEN_INVENTORY.md",  title: "UX Wireframes & Screen Inventory" },
  { file: "ORAC_IOS_EXECUTIVE_PRESENTATION_CONTENT.md",       title: "Executive Presentation Content" },
  { file: "ORAC_IOS_DOCUMENTATION_IMPLEMENTATION_BRIEF.md",   title: "Documentation Implementation Brief" },
  { file: "VERIFICATION_WORKSHEET.md",                         title: "Verification Worksheet" },
  { file: "ORAC_IOS_CODEX_FINALIZATION_PROMPTS.md",           title: "Codex Finalization Prompts" },
];

function markdownToHtml(md, title) {
  const parsedHtml = marked.parse(md);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>${title} — ORAC-IOS</title>
  <style>
    @page {
      margin: 25mm 20mm 30mm 20mm;
      @bottom-center {
        content: "ORAC-IOS — ${title}";
        font-size: 9px;
        color: #888;
      }
      @bottom-right {
        content: counter(page);
        font-size: 9px;
        color: #888;
      }
    }
    @page :first { margin-top: 0; }
    * { box-sizing: border-box; }
    body {
      font-family: "Segoe UI", -apple-system, BlinkMacSystemFont, Roboto, Helvetica, Arial, sans-serif;
      font-size: 11pt; line-height: 1.55; color: #1a1a1a; max-width: 100%; margin: 0; padding: 0;
    }
    
    .title-page {
      display: flex; flex-direction: column; justify-content: center; align-items: center;
      min-height: 100vh; text-align: center; page-break-after: always;
      background: linear-gradient(180deg, ${navy} 0%, ${dark} 100%);
      color: white; margin: -25mm -20mm 0 -20mm; padding: 60mm 40mm;
    }
    .title-page h1 { font-size: 32pt; font-weight: 700; margin: 0 0 12px; color: white; border: none; padding: 0; }
    .title-page .subtitle { font-size: 14pt; color: ${gearBlue}; margin-bottom: 40px; }
    .title-page .company { font-size: 11pt; color: rgba(255,255,255,0.7); margin-top: auto; }

    h1 { font-size: 22pt; font-weight: 700; color: ${navy}; margin: 32px 0 12px; padding-bottom: 6px; border-bottom: 2px solid ${gearBlue}; page-break-after: avoid; }
    h2 { font-size: 16pt; font-weight: 650; color: ${navy}; margin: 28px 0 10px; page-break-after: avoid; }
    h3 { font-size: 13pt; font-weight: 600; color: ${dark}; margin: 22px 0 8px; page-break-after: avoid; }
    h4 { font-size: 11.5pt; font-weight: 600; color: #333; margin: 18px 0 6px; page-break-after: avoid; }
    
    p { margin: 6px 0; }
    a { color: ${gearBlue}; text-decoration: none; }
    strong { font-weight: 650; }
    
    code { font-family: "Cascadia Code", "Consolas", "Courier New", monospace; font-size: 9.5pt; background: #f0f2f5; padding: 1px 5px; border-radius: 3px; color: #c7254e; }
    pre { background: #1e1e2e; color: #cdd6f4; padding: 14px 18px; border-radius: 6px; overflow-x: auto; font-size: 9pt; line-height: 1.45; page-break-inside: avoid; margin: 12px 0; }
    pre code { background: none; color: inherit; padding: 0; font-size: inherit; }
    
    table { width: 100%; border-collapse: collapse; margin: 14px 0; font-size: 10pt; page-break-inside: avoid; }
    th { background: ${navy}; color: white; font-weight: 600; text-align: left; padding: 8px 12px; }
    td { padding: 7px 12px; border-bottom: 1px solid #e0e3e8; vertical-align: top; }
    tr:nth-child(even) td { background: #f8f9fb; }
    
    blockquote { border-left: 3px solid ${gearBlue}; margin: 14px 0; padding: 10px 16px; background: #eef5fb; color: #333; font-size: 10.5pt; page-break-inside: avoid; }
    
    ul, ol { margin: 8px 0; padding-left: 24px; }
    li { margin-bottom: 4px; }
    
    hr { border: none; border-top: 1px solid #ddd; margin: 28px 0; }
  </style>
</head>
<body>
  <div class="title-page">
    <h1>${title}</h1>
    <div class="subtitle">ORAC-IOS: Integrated Operations & Service Portal</div>
    <div class="company">Orac Systems / Handon Enterprises (Pvt) Ltd<br>Private Pilot — Not Production-Certified</div>
  </div>
  ${parsedHtml}
</body>
</html>`;
}

function combinedCoverHtml() {
  const docList = DOC_SET.map(d => `<li>${d.title}</li>`).join('\n');
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>ORAC-IOS Complete Documentation Set</title>
  <style>
    @page { margin: 0; }
    * { box-sizing: border-box; }
    body {
      font-family: "Segoe UI", -apple-system, BlinkMacSystemFont, Roboto, Helvetica, Arial, sans-serif;
      margin: 0; padding: 0; color: white; background: linear-gradient(135deg, ${navy} 0%, ${dark} 100%);
      min-height: 100vh; display: flex; flex-direction: column; justify-content: center; align-items: center; text-align: center;
    }
    h1 { font-size: 38pt; font-weight: 700; margin: 0 0 8px; }
    .subtitle { font-size: 16pt; color: ${gearBlue}; margin-bottom: 50px; }
    .toc { text-align: left; max-width: 480px; margin: 0 auto; }
    .toc h2 { font-size: 14pt; color: rgba(255,255,255,0.8); margin-bottom: 16px; border-bottom: 1px solid rgba(255,255,255,0.2); padding-bottom: 8px; }
    .toc ol { padding-left: 20px; color: rgba(255,255,255,0.85); font-size: 12pt; line-height: 1.8; }
    .footer { margin-top: 60px; font-size: 10pt; color: rgba(255,255,255,0.5); }
  </style>
</head>
<body>
  <h1>ORAC-IOS</h1>
  <div class="subtitle">Complete Documentation Set</div>
  <div class="toc">
    <h2>Documents Included</h2>
    <ol>${docList}</ol>
  </div>
  <div class="footer">Orac Systems / Handon Enterprises (Pvt) Ltd · 2026<br>Private Pilot — Not Production-Certified</div>
</body>
</html>`;
}

async function main() {
  console.log("=== ORAC-IOS TRUTHFUL PDF Builder ===");
  await mkdir(outDir, { recursive: true });

  const pw = await import("playwright");
  const browser = await pw.chromium.launch({ headless: true });
  const context = await browser.newContext();
  const individualPdfs = [];

  for (const doc of DOC_SET) {
    const srcPath = path.join(refDocs, doc.file);
    if (!existsSync(srcPath)) continue;

    console.log(`Processing: ${doc.file}...`);
    const md = await readFile(srcPath, "utf8");
    const html = markdownToHtml(md, doc.title);
    const tmpHtml = path.join(outDir, `_tmp_${doc.file}.html`);
    await writeFile(tmpHtml, html);

    const page = await context.newPage();
    await page.goto(`file:///${tmpHtml.replace(/\\/g, '/')}`, { waitUntil: "networkidle" });
    const pdfPath = path.join(outDir, doc.file.replace(".md", ".pdf"));
    
    await page.pdf({
      path: pdfPath, format: "A4", printBackground: true, displayHeaderFooter: true,
      headerTemplate: '<div></div>',
      footerTemplate: `<div style="width:100%;font-size:8px;color:#888;padding:0 20mm;display:flex;justify-content:space-between;"><span>ORAC-IOS — ${doc.title}</span><span>Page <span class="pageNumber"></span> of <span class="totalPages"></span></span></div>`,
      margin: { top: '25mm', bottom: '20mm', left: '20mm', right: '20mm' }
    });

    await page.close();
    individualPdfs.push(pdfPath);
    try { await import("node:fs").then(fs => fs.promises.unlink(tmpHtml)); } catch {}
  }

  console.log("Building combined cover...");
  const coverHtml = combinedCoverHtml();
  const coverTmp = path.join(outDir, "_tmp_cover.html");
  await writeFile(coverTmp, coverHtml);
  const coverPage = await context.newPage();
  await coverPage.goto(`file:///${coverTmp.replace(/\\/g, '/')}`, { waitUntil: "networkidle" });
  const coverPdfPath = path.join(outDir, "_cover.pdf");
  await coverPage.pdf({ path: coverPdfPath, format: "A4", printBackground: true, margin: { top: '0', bottom: '0', left: '0', right: '0' } });
  await coverPage.close();
  try { await import("node:fs").then(fs => fs.promises.unlink(coverTmp)); } catch {}
  await browser.close();

  console.log("Merging PDFs...");
  const { PDFDocument } = await import("pdf-lib");
  const combined = await PDFDocument.create();
  
  if (existsSync(coverPdfPath)) {
    const d = await PDFDocument.load(await readFile(coverPdfPath));
    const pages = await combined.copyPages(d, d.getPageIndices());
    pages.forEach(p => combined.addPage(p));
  }
  
  for (const pdf of individualPdfs) {
    if (!existsSync(pdf)) continue;
    const d = await PDFDocument.load(await readFile(pdf));
    const pages = await combined.copyPages(d, d.getPageIndices());
    pages.forEach(p => combined.addPage(p));
  }

  const combinedPath = path.join(outDir, "ORAC_IOS_COMPLETE_DOCUMENTATION_SET.pdf");
  await writeFile(combinedPath, await combined.save());
  console.log("Merged Complete PDF.");
  try { await import("node:fs").then(fs => fs.promises.unlink(coverPdfPath)); } catch {}

  console.log("Rebuilding clean Supervisor ZIP...");
  const stage = path.join(outDir, "_clean_zip_v3");
  await mkdir(path.join(stage, "Screenshots"), { recursive: true });
  
  const coreFiles = [
    "1_START_HERE_LOGIN_DETAILS.html", "ORAC_IOS_THE_PROBLEM_WE_ARE_SOLVING.html",
    "ORAC_IOS_FINAL_EXECUTIVE_PRESENTATION.pptx", "ORAC_IOS_SYSTEM_DOCUMENTATION.pdf",
    "ORAC_IOS_USER_MANUAL.pdf", "ORAC_IOS_SOFTWARE_ARCHITECTURE.pdf",
    "ORAC_IOS_WORKFLOW_AND_DATA_DICTIONARY.pdf", "ORAC_IOS_UX_WIREFRAMES_AND_SCREEN_INVENTORY.pdf",
    "ORAC_IOS_UAT_EVIDENCE_PACK.pdf"
  ];
  const { copyFile } = await import("node:fs/promises");
  
  for (const f of coreFiles) {
    if (existsSync(path.join(outDir, f))) {
      await copyFile(path.join(outDir, f), path.join(stage, f));
    }
  }
  
  const shots = path.join(root, "deliverables", "final-uat", "screenshots");
  if (existsSync(shots)) {
    const files = await import("node:fs/promises").then(fs => fs.readdir(shots));
    for (const f of files.filter(n => !n.startsWith("debug-"))) {
      await copyFile(path.join(shots, f), path.join(stage, "Screenshots", f));
    }
  }

  const zipPath = path.join(outDir, "ORAC_IOS_DOCs.zip");
  if (existsSync(zipPath)) await import("node:fs/promises").then(fs => fs.unlink(zipPath));
  
  execSync(`powershell -Command "Compress-Archive -Path '${stage}\\*' -DestinationPath '${zipPath}' -Force"`, { stdio: "inherit" });
  await import("node:fs/promises").then(fs => fs.rm(stage, { recursive: true, force: true }));
  
  console.log(`\nDONE! File ready: ORAC_IOS_DOCs.zip`);
}

main().catch(err => { console.error("FATAL:", err); process.exit(1); });
