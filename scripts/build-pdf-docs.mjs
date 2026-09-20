/**
 * build-pdf-docs.mjs
 * 
 * Renders the full ORAC-IOS documentation set (markdown → HTML → PDF)
 * using Playwright for high-fidelity PDF rendering with proper typography,
 * page numbers, table of contents, and Orac brand colors.
 * 
 * Usage: node scripts/build-pdf-docs.mjs
 */

import { readFile, writeFile, readdir, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, "..");
const refDocs = path.join(root, "deliverables", "_ref_docs", "orac-ios-documentation");
const outDir = path.join(root, "deliverables", "final-documents");
const shots = path.join(root, "deliverables", "screenshots");

// Orac brand
const navy = "#004088";
const gearBlue = "#3890D8";
const dark = "#080838";

// Document set - ordered for the combined PDF
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

/**
 * Convert markdown to styled HTML suitable for PDF rendering.
 */
function markdownToHtml(md, title) {
  // Basic markdown → HTML conversion
  let html = md;

  // Escape HTML entities in code blocks first
  const codeBlocks = [];
  html = html.replace(/```(\w*)\n([\s\S]*?)```/g, (_, lang, code) => {
    const idx = codeBlocks.length;
    codeBlocks.push({ lang, code: code.replace(/</g, "&lt;").replace(/>/g, "&gt;") });
    return `%%CODEBLOCK_${idx}%%`;
  });

  // Inline code
  html = html.replace(/`([^`]+)`/g, '<code>$1</code>');

  // Headers
  html = html.replace(/^#### (.+)$/gm, '<h4>$1</h4>');
  html = html.replace(/^### (.+)$/gm, '<h3>$1</h3>');
  html = html.replace(/^## (.+)$/gm, '<h2>$1</h2>');
  html = html.replace(/^# (.+)$/gm, '<h1>$1</h1>');

  // Bold and italic
  html = html.replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>');
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');

  // Horizontal rules
  html = html.replace(/^---$/gm, '<hr>');

  // Tables
  html = html.replace(/^(\|.+\|)\n(\|[\s:-]+\|)\n((?:\|.+\|\n?)+)/gm, (_, header, sep, body) => {
    const headers = header.split('|').filter(c => c.trim()).map(c => `<th>${c.trim()}</th>`).join('');
    const rows = body.trim().split('\n').map(row => {
      const cells = row.split('|').filter(c => c.trim()).map(c => `<td>${c.trim()}</td>`).join('');
      return `<tr>${cells}</tr>`;
    }).join('\n');
    return `<table><thead><tr>${headers}</tr></thead><tbody>${rows}</tbody></table>`;
  });

  // Blockquotes
  html = html.replace(/^> (.+)$/gm, '<blockquote>$1</blockquote>');
  // Merge consecutive blockquotes
  html = html.replace(/<\/blockquote>\n<blockquote>/g, '\n');

  // Unordered lists
  html = html.replace(/^(\s*)[-*] (.+)$/gm, (_, indent, content) => {
    const level = Math.floor(indent.length / 2);
    return `<li class="level-${level}">${content}</li>`;
  });
  // Wrap consecutive <li> elements in <ul>
  html = html.replace(/((?:<li[^>]*>.*<\/li>\n?)+)/g, '<ul>$1</ul>');

  // Ordered lists
  html = html.replace(/^\d+\. (.+)$/gm, '<oli>$1</oli>');
  html = html.replace(/((?:<oli>.*<\/oli>\n?)+)/g, (match) => {
    return '<ol>' + match.replace(/<oli>/g, '<li>').replace(/<\/oli>/g, '</li>') + '</ol>';
  });

  // Links
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');

  // Paragraphs - wrap remaining text blocks
  html = html.replace(/^(?!<[houltbha]|%%CODEBLOCK)(.+)$/gm, '<p>$1</p>');
  // Clean up empty paragraphs
  html = html.replace(/<p>\s*<\/p>/g, '');

  // Restore code blocks
  html = html.replace(/%%CODEBLOCK_(\d+)%%/g, (_, idx) => {
    const { lang, code } = codeBlocks[Number(idx)];
    return `<pre><code class="language-${lang}">${code}</code></pre>`;
  });

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
    @page :first {
      margin-top: 0;
    }
    * { box-sizing: border-box; }
    body {
      font-family: "Segoe UI", -apple-system, BlinkMacSystemFont, Roboto, Helvetica, Arial, sans-serif;
      font-size: 11pt;
      line-height: 1.55;
      color: #1a1a1a;
      max-width: 100%;
      margin: 0;
      padding: 0;
    }
    
    /* Title page */
    .title-page {
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
      min-height: 100vh;
      text-align: center;
      page-break-after: always;
      background: linear-gradient(180deg, ${navy} 0%, ${dark} 100%);
      color: white;
      margin: -25mm -20mm 0 -20mm;
      padding: 60mm 40mm;
    }
    .title-page h1 {
      font-size: 32pt;
      font-weight: 700;
      margin: 0 0 12px;
      color: white;
      border: none;
      padding: 0;
    }
    .title-page .subtitle {
      font-size: 14pt;
      color: ${gearBlue};
      margin-bottom: 40px;
    }
    .title-page .company {
      font-size: 11pt;
      color: rgba(255,255,255,0.7);
      margin-top: auto;
    }

    h1 {
      font-size: 22pt;
      font-weight: 700;
      color: ${navy};
      margin: 32px 0 12px;
      padding-bottom: 6px;
      border-bottom: 2px solid ${gearBlue};
      page-break-after: avoid;
    }
    h2 {
      font-size: 16pt;
      font-weight: 650;
      color: ${navy};
      margin: 28px 0 10px;
      page-break-after: avoid;
    }
    h3 {
      font-size: 13pt;
      font-weight: 600;
      color: ${dark};
      margin: 22px 0 8px;
      page-break-after: avoid;
    }
    h4 {
      font-size: 11.5pt;
      font-weight: 600;
      color: #333;
      margin: 18px 0 6px;
      page-break-after: avoid;
    }
    
    p { margin: 6px 0; }
    
    a { color: ${gearBlue}; text-decoration: none; }
    
    strong { font-weight: 650; }
    
    code {
      font-family: "Cascadia Code", "Consolas", "Courier New", monospace;
      font-size: 9.5pt;
      background: #f0f2f5;
      padding: 1px 5px;
      border-radius: 3px;
      color: #c7254e;
    }
    pre {
      background: #1e1e2e;
      color: #cdd6f4;
      padding: 14px 18px;
      border-radius: 6px;
      overflow-x: auto;
      font-size: 9pt;
      line-height: 1.45;
      page-break-inside: avoid;
      margin: 12px 0;
    }
    pre code {
      background: none;
      color: inherit;
      padding: 0;
      font-size: inherit;
    }
    
    table {
      width: 100%;
      border-collapse: collapse;
      margin: 14px 0;
      font-size: 10pt;
      page-break-inside: avoid;
    }
    th {
      background: ${navy};
      color: white;
      font-weight: 600;
      text-align: left;
      padding: 8px 12px;
    }
    td {
      padding: 7px 12px;
      border-bottom: 1px solid #e0e3e8;
      vertical-align: top;
    }
    tr:nth-child(even) td {
      background: #f8f9fb;
    }
    
    blockquote {
      border-left: 3px solid ${gearBlue};
      margin: 14px 0;
      padding: 10px 16px;
      background: #eef5fb;
      color: #333;
      font-size: 10.5pt;
      page-break-inside: avoid;
    }
    
    ul, ol {
      margin: 8px 0;
      padding-left: 24px;
    }
    li {
      margin-bottom: 4px;
    }
    li.level-1 { margin-left: 20px; }
    li.level-2 { margin-left: 40px; }
    
    hr {
      border: none;
      border-top: 1px solid #ddd;
      margin: 28px 0;
    }
    
    .page-break { page-break-before: always; }
  </style>
</head>
<body>
  <div class="title-page">
    <h1>${title}</h1>
    <div class="subtitle">ORAC-IOS: Integrated Operations & Service Portal</div>
    <div class="company">Orac Systems / Handon Enterprises (Pvt) Ltd<br>Private Pilot — Not Production-Certified</div>
  </div>
  ${html}
</body>
</html>`;
}

/**
 * Generate a cover page HTML for the combined PDF.
 */
function combinedCoverHtml() {
  const docList = DOC_SET.map((d, i) => `<li>${d.title}</li>`).join('\n');
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
      margin: 0; padding: 0; color: white;
      background: linear-gradient(135deg, ${navy} 0%, ${dark} 100%);
      min-height: 100vh;
      display: flex; flex-direction: column; justify-content: center; align-items: center;
      text-align: center;
    }
    h1 { font-size: 38pt; font-weight: 700; margin: 0 0 8px; }
    .subtitle { font-size: 16pt; color: ${gearBlue}; margin-bottom: 50px; }
    .toc { text-align: left; max-width: 480px; margin: 0 auto; }
    .toc h2 { font-size: 14pt; color: rgba(255,255,255,0.8); margin-bottom: 16px; border-bottom: 1px solid rgba(255,255,255,0.2); padding-bottom: 8px; }
    .toc ol { padding-left: 20px; color: rgba(255,255,255,0.85); font-size: 12pt; line-height: 1.8; }
    .toc li { margin-bottom: 4px; }
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
  <div class="footer">
    Orac Systems / Handon Enterprises (Pvt) Ltd · ${new Date().toLocaleDateString('en-ZA')}<br>
    Private Pilot — Not Production-Certified
  </div>
</body>
</html>`;
}

async function main() {
  console.log("=== ORAC-IOS Full Documentation PDF Builder ===\n");

  // Ensure output directory
  await mkdir(outDir, { recursive: true });

  // Try to load Playwright
  let chromium;
  try {
    const pw = await import("playwright");
    chromium = pw.chromium;
  } catch (e) {
    console.error("Playwright not available. Trying to install...");
    execSync("npx playwright install chromium", { stdio: "inherit" });
    const pw = await import("playwright");
    chromium = pw.chromium;
  }

  console.log("Launching browser...");
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();

  const individualPdfs = [];

  // Process each document
  for (const doc of DOC_SET) {
    const srcPath = path.join(refDocs, doc.file);
    if (!existsSync(srcPath)) {
      console.log(`  SKIP: ${doc.file} (not found)`);
      continue;
    }

    console.log(`  Processing: ${doc.file} → PDF...`);
    const md = await readFile(srcPath, "utf8");
    const html = markdownToHtml(md, doc.title);

    // Write temp HTML
    const tmpHtml = path.join(outDir, `_tmp_${doc.file}.html`);
    await writeFile(tmpHtml, html);

    // Render to PDF
    const page = await context.newPage();
    await page.goto(`file:///${tmpHtml.replace(/\\/g, '/')}`, { waitUntil: "networkidle" });

    const pdfName = doc.file.replace(".md", ".pdf");
    const pdfPath = path.join(outDir, pdfName);
    await page.pdf({
      path: pdfPath,
      format: "A4",
      printBackground: true,
      displayHeaderFooter: true,
      headerTemplate: '<div></div>',
      footerTemplate: `<div style="width:100%;font-size:8px;color:#888;padding:0 20mm;display:flex;justify-content:space-between;">
        <span>ORAC-IOS — ${doc.title}</span>
        <span>Page <span class="pageNumber"></span> of <span class="totalPages"></span></span>
      </div>`,
      margin: { top: '25mm', bottom: '20mm', left: '20mm', right: '20mm' },
    });

    await page.close();
    individualPdfs.push(pdfPath);
    console.log(`    Created: ${pdfName}`);

    // Clean up temp
    try { await import("node:fs").then(fs => fs.promises.unlink(tmpHtml)); } catch {}
  }

  // Build combined cover page PDF
  console.log("\n  Building combined cover page...");
  const coverHtml = combinedCoverHtml();
  const coverTmp = path.join(outDir, "_tmp_cover.html");
  await writeFile(coverTmp, coverHtml);
  const coverPage = await context.newPage();
  await coverPage.goto(`file:///${coverTmp.replace(/\\/g, '/')}`, { waitUntil: "networkidle" });
  const coverPdfPath = path.join(outDir, "_cover.pdf");
  await coverPage.pdf({
    path: coverPdfPath,
    format: "A4",
    printBackground: true,
    margin: { top: '0', bottom: '0', left: '0', right: '0' },
  });
  await coverPage.close();
  try { await import("node:fs").then(fs => fs.promises.unlink(coverTmp)); } catch {}

  await browser.close();
  console.log("  Browser closed.\n");

  // Merge PDFs using pdf-lib
  console.log("  Merging into combined PDF...");
  const { PDFDocument } = await import("pdf-lib");
  const combined = await PDFDocument.create();

  // Add cover
  if (existsSync(coverPdfPath)) {
    const coverBytes = await readFile(coverPdfPath);
    const coverDoc = await PDFDocument.load(coverBytes);
    const coverPages = await combined.copyPages(coverDoc, coverDoc.getPageIndices());
    for (const p of coverPages) combined.addPage(p);
  }

  // Add each individual PDF
  for (const pdfPath of individualPdfs) {
    if (!existsSync(pdfPath)) continue;
    const bytes = await readFile(pdfPath);
    const doc = await PDFDocument.load(bytes);
    const pages = await combined.copyPages(doc, doc.getPageIndices());
    for (const p of pages) combined.addPage(p);
  }

  const combinedPath = path.join(outDir, "ORAC_IOS_COMPLETE_DOCUMENTATION_SET.pdf");
  const combinedBytes = await combined.save();
  await writeFile(combinedPath, combinedBytes);
  console.log(`  Created: ORAC_IOS_COMPLETE_DOCUMENTATION_SET.pdf (${(combinedBytes.length / 1024 / 1024).toFixed(1)} MB)\n`);

  // Clean up temp cover
  try { await import("node:fs").then(fs => fs.promises.unlink(coverPdfPath)); } catch {}

  // Rebuild ZIP
  console.log("  Rebuilding final ZIP package...");
  const zipStaging = path.join(outDir, "_zip_staging_v2");
  await mkdir(path.join(zipStaging, "screenshots"), { recursive: true });
  await mkdir(path.join(zipStaging, "individual-pdfs"), { recursive: true });
  await mkdir(path.join(zipStaging, "markdown-source"), { recursive: true });

  // Copy individual PDFs
  for (const pdfPath of individualPdfs) {
    if (existsSync(pdfPath)) {
      const { copyFile } = await import("node:fs/promises");
      await copyFile(pdfPath, path.join(zipStaging, "individual-pdfs", path.basename(pdfPath)));
    }
  }

  // Copy combined PDF
  if (existsSync(combinedPath)) {
    const { copyFile } = await import("node:fs/promises");
    await copyFile(combinedPath, path.join(zipStaging, path.basename(combinedPath)));
  }

  // Copy markdown source
  for (const doc of DOC_SET) {
    const src = path.join(refDocs, doc.file);
    if (existsSync(src)) {
      const { copyFile } = await import("node:fs/promises");
      await copyFile(src, path.join(zipStaging, "markdown-source", doc.file));
    }
  }

  // Copy existing deliverables
  const existingFiles = [
    "ORAC_IOS_FINAL_EXECUTIVE_PRESENTATION.pptx",
    "ORAC_IOS_THE_PROBLEM_WE_ARE_SOLVING.html",
    "1_START_HERE_LOGIN_DETAILS.html",
    "ORAC_IOS_LIVE_UAT_EVIDENCE_RECONCILIATION.md",
  ];
  for (const f of existingFiles) {
    const src = path.join(outDir, f);
    if (existsSync(src)) {
      const { copyFile } = await import("node:fs/promises");
      await copyFile(src, path.join(zipStaging, f));
    }
  }

  // Copy screenshots
  if (existsSync(shots)) {
    const screenshotFiles = (await readdir(shots)).filter(f => !f.startsWith("debug-"));
    for (const f of screenshotFiles) {
      const { copyFile } = await import("node:fs/promises");
      await copyFile(path.join(shots, f), path.join(zipStaging, "screenshots", f));
    }
  }

  // Create ZIP
  const zipPath = path.join(outDir, "ORAC_IOS_FINAL_DELIVERY_PACKAGE.zip");
  if (existsSync(zipPath)) {
    const { unlink } = await import("node:fs/promises");
    await unlink(zipPath);
  }
  execSync(`powershell -Command "Compress-Archive -Path '${zipStaging}\\*' -DestinationPath '${zipPath}' -Force"`, { stdio: "inherit" });

  // Clean up staging
  const { rm } = await import("node:fs/promises");
  await rm(zipStaging, { recursive: true, force: true });

  console.log(`  Created: ORAC_IOS_FINAL_DELIVERY_PACKAGE.zip`);
  console.log(`\n=== COMPLETE ===`);
  console.log(`All files in: ${outDir}`);
  console.log(`\nIndividual PDFs: ${individualPdfs.length}`);
  console.log(`Combined PDF: ORAC_IOS_COMPLETE_DOCUMENTATION_SET.pdf`);
  console.log(`PPTX: ORAC_IOS_FINAL_EXECUTIVE_PRESENTATION.pptx`);
  console.log(`ZIP: ORAC_IOS_FINAL_DELIVERY_PACKAGE.zip`);
}

main().catch(err => {
  console.error("FATAL:", err);
  process.exit(1);
});
