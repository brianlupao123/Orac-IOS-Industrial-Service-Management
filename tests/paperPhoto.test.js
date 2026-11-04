import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  PAPER_PHOTO, MAX_PDF_BYTES, fitWithin, dataUrlBytes, formatBytes, classifyPaperFile, validatePaperFile,
  safePaperSrc, paperEvidenceOf, paperReferenceOf, hasPaperEvidence, dataUrlToBlob, isPdfDataUrl
} from "../src/lib/paperPhoto.js";
import { enqueueTimesheet } from "../src/offlineTimesheetOutbox.js";
import { buildTimesheetPayload, EMPTY_TIMESHEET_FORM } from "../src/lib/timesheetFormLogic.js";

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");
const memoryStorage = () => { const m = new Map(); return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) }; };
const JPEG = "data:image/jpeg;base64,/9j/4AAQSkZJRg==";
const PDF = "data:application/pdf;base64,JVBERi0xLjQ=";

test("the size budget keeps a photo comfortably inside the 1.5 MB mark and the offline outbox limit", () => {
  assert.ok(PAPER_PHOTO.TARGET_CHARS < PAPER_PHOTO.HARD_CHARS);
  assert.ok(PAPER_PHOTO.HARD_CHARS < 1_500_000, "under 1.5 MB");
  // a Timesheet carrying a photo at the hard limit still fits the outbox (1.5 MB per item) with its form data
  const form = { ...EMPTY_TIMESHEET_FORM(), dispatch_card_id: "dc_1", activity: "Work", normal: "8", employee_name: "A", client_request_id: "ts-1", signed_copy_image: "data:image/jpeg;base64," + "A".repeat(PAPER_PHOTO.HARD_CHARS - 30) };
  const r = enqueueTimesheet(memoryStorage(), "u1", { dispatchId: "dc_1", body: buildTimesheetPayload(form, { submit: true }) });
  assert.equal(r.ok, true);
});

test("the compression plan only ever gets smaller and never goes below a readable size", () => {
  const plan = PAPER_PHOTO.PLAN;
  for (let i = 1; i < plan.length; i++) {
    assert.ok(plan[i].maxEdge <= plan[i - 1].maxEdge);
    assert.ok(plan[i].maxEdge < plan[i - 1].maxEdge || plan[i].quality < plan[i - 1].quality, "each step is lighter than the last");
  }
  assert.ok(Math.min(...plan.map((p) => p.maxEdge)) >= 1000);
  assert.ok(Math.min(...plan.map((p) => p.quality)) >= 0.5);
});

test("fitWithin shrinks the long side, keeps the aspect ratio and never enlarges", () => {
  assert.deepEqual(fitWithin(4000, 3000, 1600), { width: 1600, height: 1200 });
  assert.deepEqual(fitWithin(3000, 4000, 1600), { width: 1200, height: 1600 });
  assert.deepEqual(fitWithin(800, 600, 1600), { width: 800, height: 600 });
  assert.deepEqual(fitWithin(0, 600, 1600), { width: 0, height: 0 });
});

test("dataUrlBytes and formatBytes report the real size", () => {
  assert.equal(dataUrlBytes("data:image/jpeg;base64,QUJD"), 3);
  assert.equal(dataUrlBytes("data:image/jpeg;base64,QUI="), 2);
  assert.equal(dataUrlBytes("nonsense"), 0);
  assert.equal(formatBytes(512), "512 B");
  assert.equal(formatBytes(312 * 1024), "312 KB");
  assert.equal(formatBytes(4.2 * 1024 * 1024), "4.2 MB");
});

test("file checks: pictures and PDFs pass, others and oversized PDFs are refused with advice", () => {
  assert.equal(classifyPaperFile({ type: "image/jpeg", name: "a.jpg" }), "image");
  assert.equal(classifyPaperFile({ type: "", name: "scan.PDF" }), "pdf", "Android may leave type empty");
  assert.equal(classifyPaperFile({ type: "", name: "IMG_1.heic" }), "image");
  assert.equal(classifyPaperFile({ type: "text/html", name: "x.html" }), "unsupported");
  assert.equal(validatePaperFile({ type: "image/jpeg", name: "a.jpg", size: 6_000_000 }).ok, true, "big photos are fine: they are shrunk");
  assert.equal(validatePaperFile({ type: "application/pdf", name: "a.pdf", size: 200_000 }).ok, true);
  const big = validatePaperFile({ type: "application/pdf", name: "a.pdf", size: MAX_PDF_BYTES + 1 });
  assert.equal(big.ok, false);
  assert.match(big.error, /Take a photo of the paper instead/);
  assert.equal(validatePaperFile({ type: "application/exe", name: "a.exe", size: 10 }).ok, false);
  assert.equal(validatePaperFile({ type: "image/png", name: "a.png", size: 0 }).ok, false);
  assert.equal(validatePaperFile(null).ok, false);
});

test("a PDF at the size limit still fits in the stored data URL budget", () => {
  const b64Chars = Math.ceil(MAX_PDF_BYTES / 3) * 4;
  assert.ok(b64Chars + "data:application/pdf;base64,".length <= PAPER_PHOTO.HARD_CHARS);
});

test("only safe sources are ever shown; script and foreign schemes are dropped", () => {
  assert.equal(safePaperSrc(JPEG), JPEG);
  assert.equal(safePaperSrc(PDF), PDF);
  assert.equal(safePaperSrc("https://files.example.com/a.jpg"), "https://files.example.com/a.jpg");
  assert.equal(safePaperSrc("/uploads/a.jpg"), "/uploads/a.jpg");
  for (const bad of ["javascript:alert(1)", "data:text/html;base64,PHNjcmlwdD4=", "//evil.example/a.jpg", "file:///etc/passwd", "", null]) assert.equal(safePaperSrc(bad), "", String(bad));
});

test("paperEvidenceOf reads the signed copy and evidence_files, de-duplicated, with the right kind", () => {
  assert.deepEqual(paperEvidenceOf({}), []);
  assert.equal(hasPaperEvidence({ signed_copy_image: JPEG }), true);
  const ws = { signed_copy_image: JPEG, evidence_files: [JPEG, { url: "https://x.test/scan", name: "Scan", content_type: "application/pdf" }, { data_url: PDF, name: "p.pdf" }, "javascript:alert(1)"] };
  const files = paperEvidenceOf(ws);
  assert.equal(files.length, 3, "duplicate and unsafe entries dropped");
  assert.deepEqual(files.map((f) => f.kind), ["image", "pdf", "pdf"]);
  assert.equal(files[0].name, "Signed paper copy");
});

test("the paper reference comes from the record, trimmed", () => {
  assert.equal(paperReferenceOf({ client_paper_reference: " PR-77 " }), "PR-77");
  assert.equal(paperReferenceOf({ evidence_reference: "E-1" }), "E-1");
  assert.equal(paperReferenceOf({}), "");
});

test("dataUrlToBlob round-trips the bytes and rejects junk", () => {
  const blob = dataUrlToBlob("data:image/jpeg;base64,QUJD");
  assert.equal(blob.type, "image/jpeg");
  assert.equal(blob.size, 3);
  assert.equal(dataUrlToBlob("not a data url"), null);
  assert.equal(isPdfDataUrl(PDF), true);
});

test("the form: camera button with capture, a separate upload that accepts PDF, shown for create and edit", () => {
  const field = read("src/components/PaperPhotoField.jsx");
  assert.match(field, /Take Photo of Signed Paper/);
  assert.match(field, /Upload Scan/);
  assert.match(field, /accept="image\/\*" capture="environment"/);
  assert.match(field, /accept="image\/\*,application\/pdf"/);
  assert.match(field, /<img src=\{value\}/, "thumbnail preview");
  const modal = read("src/components/TimesheetFormModal.jsx");
  assert.match(modal, /<PaperPhotoField/);
  assert.doesNotMatch(modal, /MAX_PHOTO_BYTES/, "the old uncompressed 1 MB gate is gone");
  const fieldsetAt = modal.indexOf("Signed paper copy (optional)");
  const signoffAt = modal.indexOf("{!editing && (\n          <fieldset className=\"space-y-3\">\n            <legend className=\"text-sm font-semibold text-gray-500\">Worker sign-off");
  assert.ok(fieldsetAt > 0 && fieldsetAt < signoffAt, "paper copy section sits outside the create-only sign-off block");
});

test("the Timesheet card shows the paper badge and opens the viewer; the draft store still never keeps the photo", () => {
  const page = read("src/pages/WorksheetsPage.jsx");
  assert.match(page, /<PaperEvidenceBadge worksheet=\{ws\} onOpen=\{setPaperView\}/);
  assert.match(page, /<PaperEvidenceModal worksheet=\{paperView\}/);
  const modal = read("src/components/TimesheetFormModal.jsx");
  assert.match(modal, /const \{ signed_copy_image, employee_attest, \.\.\.text \} = form;/);
  const viewer = read("src/components/PaperEvidence.jsx");
  assert.match(viewer, /paperEvidenceOf\(worksheet\)/);
  assert.doesNotMatch(viewer, /dangerouslySetInnerHTML/);
});
