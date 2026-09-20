import fs from "node:fs/promises";
import { readFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { Presentation, PresentationFile } from "file:///C:/Users/BRIAN%20LUPAO/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/@oai/artifact-tool/dist/artifact_tool.mjs";
import { PDFDocument, StandardFonts, rgb } from "file:///C:/Users/BRIAN%20LUPAO/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/pdf-lib/dist/pdf-lib.esm.js";

const workspaceDir = process.cwd();
const skillDir = "C:\\Users\\BRIAN LUPAO\\.codex\\plugins\\cache\\openai-primary-runtime\\presentations\\26.909.11809\\skills\\presentations";
const runtimePython = "C:\\Users\\BRIAN LUPAO\\.cache\\codex-runtimes\\codex-primary-runtime\\dependencies\\python\\python.exe";
const outputDir = path.join(workspaceDir, "deliverables", "final-documents");
const buildDir = path.join(workspaceDir, ".orac-document-build");
const shotsDir = path.join(workspaceDir, "deliverables", "final-uat", "screenshots");
const logoPath = path.join(workspaceDir, "public", "images", "orac-systems-logo.png");
const NAVY = "#004088";
const GEAR = "#3890D8";
const INK = "#0A1B35";
const PALE = "#EFF7FC";
const roles = [
  ["Admin", "admin", "PASS WITH CONSOLE ERRORS", 5],
  ["Management", "management", "PASS WITH CONSOLE ERRORS", 4],
  ["Sales", "sales", "PASS", 4],
  ["Finance", "finance", "PASS", 4],
  ["Operations", "operations", "PASS", 4],
  ["Supervisor", "supervisor", "PASS", 4],
  ["Technician", "technician", "PASS", 4],
  ["Client Viewer", "client-viewer", "PASS", 4]
];

await fs.mkdir(outputDir, { recursive: true });
await fs.mkdir(buildDir, { recursive: true });
const { resolvePresentationFont, finalizePresentation } = await import(pathToFileURL(path.join(skillDir, "container_tools", "artifact_tool_utils.mjs")).href);
const font = resolvePresentationFont();
const image = async (p) => new Uint8Array(await fs.readFile(p));
const logo = await image(logoPath);

function textbox(slide, text, left, top, width, height, size, color = INK, options = {}) {
  const shape = slide.shapes.add({ geometry: "textbox", position: { left, top, width, height }, fill: "none", line: { fill: "none", width: 0 } });
  shape.text = text;
  shape.text.style = { typeface: font, fontSize: size, color, bold: Boolean(options.bold), autoFit: "shrink" };
  return shape;
}
function header(slide, title, subtitle = "") {
  slide.background.fill = "#FFFFFF";
  slide.shapes.add({ geometry: "rect", position: { left: 0, top: 0, width: 1280, height: 14 }, fill: NAVY, line: { fill: NAVY, width: 0 } });
  slide.images.add({ blob: logo, contentType: "image/png", alt: "Orac Systems logo", fit: "contain", position: { left: 64, top: 34, width: 58, height: 58 } });
  textbox(slide, "ORAC-IOS", 136, 42, 200, 28, 20, NAVY, { bold: true });
  textbox(slide, title, 64, 118, 900, 55, 34, INK, { bold: true });
  if (subtitle) textbox(slide, subtitle, 66, 178, 1040, 32, 18, "#45627D");
  textbox(slide, "Orac Industrial Operations System", 930, 47, 290, 24, 14, "#45627D");
}
function addScreenshot(slide, file, left, top, width, height, label) {
  slide.images.add({ blob: new Uint8Array(readFileSync(path.join(shotsDir, file))), contentType: "image/png", alt: label, fit: "contain", position: { left, top, width, height }, geometry: "roundRect", borderRadius: 8 });
}
function addFooter(slide, number) { textbox(slide, `Local UAT capture 14 September 2026   |   ${number}`, 64, 680, 1140, 20, 12, "#61748A"); }

const deck = Presentation.create({ slideSize: { width: 1280, height: 720 } });
let slide = deck.slides.add();
slide.background.fill = NAVY;
slide.images.add({ blob: logo, contentType: "image/png", alt: "Orac Systems logo", fit: "contain", position: { left: 84, top: 78, width: 140, height: 140 } });
textbox(slide, "ORAC-IOS", 84, 260, 830, 80, 54, "#FFFFFF", { bold: true });
textbox(slide, "Orac Industrial Operations System", 86, 350, 650, 38, 27, "#BFE5FF" );
textbox(slide, "Final system overview and local UAT evidence", 86, 413, 700, 30, 21, "#FFFFFF");
textbox(slide, "Orac Systems / Handon Enterprises (Pvt) Ltd", 86, 618, 700, 26, 17, "#BFE5FF");

slide = deck.slides.add(); header(slide, "Operational record from quote to invoice", "ORAC-IOS connects the commercial, field and financial record for industrial service work.");
const stages = ["Quote", "Purchase order", "Dispatch", "Worksheet", "Invoice", "Pastel export"];
stages.forEach((s, i) => { const x = 72 + i * 196; slide.shapes.add({ geometry: "roundRect", position: { left: x, top: 300, width: 164, height: 98 }, fill: i % 2 ? PALE : "#FFFFFF", line: { fill: GEAR, width: 1 } }); textbox(slide, `${i + 1}`, x + 18, 321, 26, 28, 21, NAVY, { bold: true }); textbox(slide, s, x + 18, 355, 130, 28, 17, INK, { bold: true }); });
textbox(slide, "Each transition is permission-gated and produces an audit trail. Urgent dispatch and purchase-order amendment controls remain separate invoice guards.", 72, 470, 1040, 55, 21, INK);
addFooter(slide, 2);

slide = deck.slides.add(); header(slide, "Role controls and data scope", "The backend remains the authority for role permission and record scope.");
const controls = ["Admin and Management receive oversight access.", "Sales is limited to commercial work and no dispatch, worksheet, PO or invoice summary counts.", "Supervisor and Technician receive review and assignment scope.", "Client Viewer receives its own client record only."];
controls.forEach((t, i) => textbox(slide, t, 90, 270 + i * 68, 900, 38, 21, INK));
addScreenshot(slide, "technician-dashboard.png", 895, 255, 300, 290, "Technician scoped dashboard");
addFooter(slide, 3);

slide = deck.slides.add(); header(slide, "Governed dashboard assistant", "The assistant is a providerless, role-scoped feature. It uses verified dashboard data and workflow knowledge only.");
addScreenshot(slide, "finance-assistant-answer.png", 66, 242, 548, 365, "Finance assistant answer");
addScreenshot(slide, "finance-evidence-highlight.png", 654, 242, 548, 365, "Finance evidence highlight");
textbox(slide, "Answers use Finding, Evidence and Next action. Evidence buttons take the user to the dashboard metric that supports the answer.", 70, 615, 1080, 32, 18, INK);
addFooter(slide, 4);

slide = deck.slides.add(); header(slide, "Local UAT evidence summary", "Captured through the local application on 14 September 2026 using the shared demo credentials.");
roles.forEach(([role, , status, count], i) => { const col = i % 2; const row = Math.floor(i / 2); const x = 82 + col * 570; const y = 245 + row * 90; slide.shapes.add({ geometry: "rect", position: { left: x, top: y, width: 520, height: 64 }, fill: status === "PASS" ? "#ECFDF5" : "#FFF8E6", line: { fill: status === "PASS" ? "#7DD3A8" : "#F3C75F", width: 1 } }); textbox(slide, role, x + 18, y + 16, 180, 25, 18, INK, { bold: true }); textbox(slide, status, x + 205, y + 16, 225, 25, 15, status === "PASS" ? "#12694D" : "#9A6200", { bold: true }); textbox(slide, `${count} captures`, x + 435, y + 16, 75, 25, 14, "#45627D" ); });
textbox(slide, "Admin and Management captured all required states but emitted console errors. Their screenshots are retained; the console messages require follow-up before live sign-off.", 82, 620, 1060, 38, 17, "#7A4E00");
addFooter(slide, 5);

for (const [role, stem, status] of roles) {
  slide = deck.slides.add(); header(slide, `${role} local UAT capture`, `${status}  |  Actual screenshots captured by the automated local UAT run`);
  addScreenshot(slide, `${stem}-dashboard.png`, 66, 235, 540, 360, `${role} dashboard`);
  addScreenshot(slide, `${stem}-assistant-answer.png`, 656, 235, 540, 360, `${role} assistant answer`);
  textbox(slide, "The assistant reads the same role-scoped dashboard context presented to this user. Evidence references remain constrained to visible and permitted data.", 68, 610, 1090, 32, 17, INK);
  addFooter(slide, deck.slides.length);
}

const candidate = path.join(buildDir, "orac-ios-final-presentation-candidate.pptx");
const finalDeck = path.join(outputDir, "ORAC_IOS_FINAL_PRESENTATION.pptx");
await (await PresentationFile.exportPptx(deck)).save(candidate);
await finalizePresentation({ workspaceDir, candidatePath: candidate, finalPath: finalDeck, pythonExecutable: runtimePython, integrityValidatorPath: path.join(skillDir, "container_tools", "inspect_presentation_package_integrity.py"), layoutValidatorPath: path.join(skillDir, "container_tools", "inspect_presentation_layout_geometry.py"), layoutArgs: ["--expected-slide-size-emu", "12192000,6858000", "--validate-heading-fit"], requiredNativeTableOwnerSlides: [], fontPolicy: { basis: "design", families: [font] }, verifyArtifactToolImport: true, receiptPath: path.join(buildDir, "presentation-validation.json") });

const evidenceMd = `# ORAC-IOS Local UAT Evidence Reconciliation\n\n**Capture date:** 14 September 2026  \n**Environment:** local frontend and local backend  \n**Evidence source:** 33 screenshot files captured by the automated local UAT run. A later invalid-credential run overwrote the original report only; it did not remove the successful screenshots.\n\n## Result\n\n| Role | Capture status | Screenshots | Note |\n| --- | --- | ---: | --- |\n${roles.map(([role,,status,count]) => `| ${role} | ${status} | ${count} | ${status === "PASS" ? "Dashboard, assistant response and evidence interaction captured." : "Screenshots captured; inspect console messages before live sign-off."} |`).join("\n")}\n\n## Scope\n\nThis is local demonstration evidence. It does not replace live Render UAT. The live release gate still requires deployed commit confirmation, live browser verification, and triage of any console errors.\n`;
await fs.writeFile(path.join(outputDir, "ORAC_IOS_LOCAL_UAT_EVIDENCE_RECONCILIATION.md"), evidenceMd);

async function makePdf(file, title, pages) {
  const pdf = await PDFDocument.create(); const bold = await pdf.embedFont(StandardFonts.HelveticaBold); const regular = await pdf.embedFont(StandardFonts.Helvetica);
  for (const p of pages) { const page = pdf.addPage([842, 595]); page.drawRectangle({ x: 0, y: 0, width: 842, height: 595, color: rgb(1, 1, 1) }); page.drawRectangle({ x: 0, y: 565, width: 842, height: 30, color: rgb(0, 0.25, 0.53) }); page.drawText(title, { x: 42, y: 530, size: 23, font: bold, color: rgb(0.04, 0.11, 0.21) }); let y = 488; for (const line of p.lines) { page.drawText(line, { x: 48, y, size: line.startsWith("#") ? 16 : 12, font: line.startsWith("#") ? bold : regular, color: rgb(0.04, 0.11, 0.21), maxWidth: 740, lineHeight: 17 }); y -= line.startsWith("#") ? 35 : 26; } if (p.imageFile) { const bytes = await fs.readFile(path.join(shotsDir, p.imageFile)); const embedded = await pdf.embedPng(bytes); const dims = embedded.scaleToFit(710, 340); page.drawImage(embedded, { x: 66, y: 58, width: dims.width, height: dims.height }); } page.drawText("ORAC-IOS  |  Orac Industrial Operations System", { x: 48, y: 20, size: 9, font: regular, color: rgb(0.38, 0.45, 0.54) }); }
  await fs.writeFile(path.join(outputDir, file), await pdf.save());
}
await makePdf("ORAC_IOS_UAT_EVIDENCE_PACK.pdf", "ORAC-IOS Local UAT Evidence", [{ lines: ["# Evidence scope", "33 screenshots were captured through the automated local UAT run on 14 September 2026.", "Six roles passed cleanly. Admin and Management completed capture with console-error warnings.", "This pack presents local evidence only. Live Render verification remains a release gate."], imageFile: "finance-evidence-highlight.png" }, ...roles.map(([role, stem, status, count]) => ({ lines: [`# ${role}`, `Status: ${status}`, `Captured screenshots: ${count}`, "Dashboard assistant response shown below."], imageFile: `${stem}-assistant-answer.png` }))]);
await makePdf("ORAC_IOS_SYSTEM_HANDOVER.pdf", "ORAC-IOS System Handover", [
  { lines: ["# System definition", "ORAC-IOS means Orac Industrial Operations System.", "It records the industrial service lifecycle from quote through purchase order, dispatch, worksheet, invoice and Pastel export.", "The frontend provides the portal. The backend enforces access, state transitions, financial guards, audit logging and scoped assistant data."] },
  { lines: ["# Maintenance controls", "Read MAINTAINER_GUARDRAILS.md before changing permissions, workflow, invoices, assistant behavior or database configuration.", "Run npm run maintain in frontend and backend before commit.", "The client must never replace server-side RBAC or row-level scope.", "Do not add secrets, client data or credentials to source, screenshots or logs."] },
  { lines: ["# Current assistant", "All eight roles have a providerless dashboard assistant.", "It returns deterministic, role-scoped answers from the dashboard summary and workflow knowledge.", "Evidence buttons point to supporting dashboard metrics.", "Provider integration remains a separately governed future decision."] },
  { lines: ["# Release evidence", "Backend automated suite: 71 passing tests reported before final packaging.", "Frontend test and production build passed before final packaging.", "Local UAT captures cover all eight roles. Admin and Management console warnings require triage.", "Live Render UAT must be captured separately before production sign-off."] }
]);
console.log(`Created: ${finalDeck}`);
console.log(`Created: ${path.join(outputDir, "ORAC_IOS_UAT_EVIDENCE_PACK.pdf")}`);
console.log(`Created: ${path.join(outputDir, "ORAC_IOS_SYSTEM_HANDOVER.pdf")}`);
