// Signed-paper photo helpers (Phase 4: camera scanner and paper attachment).
//
// Everything that decides WHAT is accepted is a pure function here so it can be unit tested without a
// browser. Only compressImageFile() touches canvas / createImageBitmap.
//
// Size budget, in characters of the final data URL (that is what is stored on the device and sent):
//   TARGET  ~600 KB  what we aim for: a few seconds on a 3G connection
//   HARD   ~1.2 MB   never exceeded. The offline outbox refuses any Timesheet over 1.5 MB in total
//                    (offlineTimesheetOutbox.js), so a photo under HARD always fits with its form data.
// Re-encoding through a canvas also drops EXIF metadata (GPS position, device model) from the photo.

export const PAPER_PHOTO = Object.freeze({
  TARGET_CHARS: 600_000,
  HARD_CHARS: 1_200_000,
  MAX_SOURCE_BYTES: 30_000_000,
  // Tried in order until one is small enough. Paper text stays readable down to ~1000 px.
  PLAN: Object.freeze([
    { maxEdge: 1600, quality: 0.8 },
    { maxEdge: 1600, quality: 0.65 },
    { maxEdge: 1400, quality: 0.65 },
    { maxEdge: 1200, quality: 0.6 },
    { maxEdge: 1000, quality: 0.55 }
  ])
});

// A PDF cannot be re-compressed in the browser, so it is held to the same hard ceiling as the photo
// (base64 adds a third, hence the 3/4).
export const MAX_PDF_BYTES = Math.floor(PAPER_PHOTO.HARD_CHARS * 3 / 4) - 1_000;

const IMAGE_EXT = /\.(jpe?g|png|webp|gif|bmp|heic|heif)$/i;
const PDF_EXT = /\.pdf$/i;

export function formatBytes(bytes) {
  if (!Number.isFinite(bytes) || bytes < 0) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// Size of the binary behind a base64 data URL.
export function dataUrlBytes(dataUrl) {
  const s = String(dataUrl || "");
  const comma = s.indexOf(",");
  if (comma < 0) return 0;
  const b64 = s.slice(comma + 1);
  const pad = b64.endsWith("==") ? 2 : b64.endsWith("=") ? 1 : 0;
  return Math.max(0, Math.floor(b64.length * 3 / 4) - pad);
}

// Scale to fit inside maxEdge on the longest side. Never enlarges.
export function fitWithin(width, height, maxEdge) {
  const w = Number(width), h = Number(height);
  if (!(w > 0) || !(h > 0)) return { width: 0, height: 0 };
  const scale = Math.min(1, maxEdge / Math.max(w, h));
  return { width: Math.max(1, Math.round(w * scale)), height: Math.max(1, Math.round(h * scale)) };
}

export function isPdfDataUrl(src) { return /^data:application\/pdf[;,]/i.test(String(src || "")); }
export function isImageDataUrl(src) { return /^data:image\/[a-z0-9.+-]+[;,]/i.test(String(src || "")); }

// What kind of file did the phone hand us? Some Android browsers leave `type` empty, so fall back to the name.
export function classifyPaperFile(file) {
  const type = String(file?.type || "").toLowerCase();
  const name = String(file?.name || "");
  if (type === "application/pdf" || (!type && PDF_EXT.test(name))) return "pdf";
  if (type.startsWith("image/") || (!type && IMAGE_EXT.test(name))) return "image";
  return "unsupported";
}

// Early, friendly refusal before any work is done. The server still validates the file it receives.
export function validatePaperFile(file) {
  if (!file) return { ok: false, error: "No file was chosen." };
  const kind = classifyPaperFile(file);
  if (kind === "unsupported") return { ok: false, error: "That file type is not supported. Take a photo, or choose a picture or a PDF." };
  if (!(file.size > 0)) return { ok: false, error: "That file is empty. Try taking the photo again." };
  if (kind === "pdf" && file.size > MAX_PDF_BYTES) {
    return { ok: false, error: `This PDF is ${formatBytes(file.size)}. A PDF over ${formatBytes(MAX_PDF_BYTES)} is too heavy to send on a slow connection. Take a photo of the paper instead, or scan it at a lower quality.` };
  }
  if (kind === "image" && file.size > PAPER_PHOTO.MAX_SOURCE_BYTES) {
    return { ok: false, error: `This picture is ${formatBytes(file.size)}, which is too large to process on this device. Take a new photo with the camera.` };
  }
  return { ok: true, kind };
}

// ---- Reading the evidence back off a Timesheet -------------------------------------------------

// Only data: images/PDFs and http(s) or same-site paths are ever shown. Anything else (javascript:,
// file:, blob: from elsewhere) is dropped, so a bad value on a record cannot run script in the viewer.
export function safePaperSrc(src) {
  const s = String(src || "").trim();
  if (!s) return "";
  if (isImageDataUrl(s) || isPdfDataUrl(s)) return s;
  if (/^https?:\/\//i.test(s) || (s.startsWith("/") && !s.startsWith("//"))) return s;
  return "";
}

function kindOf(src, hint = "") {
  if (isPdfDataUrl(src) || /pdf/i.test(hint) || /\.pdf($|\?)/i.test(src)) return "pdf";
  return "image";
}

// Every picture or PDF attached to a Timesheet as paper evidence, in one shape:
//   { src, kind: "image" | "pdf", name }
// `signed_copy_image` is what the Timesheet form sends today; `evidence_files` / `signed_copy_url` are
// accepted too so the viewer keeps working if the server returns links instead of the inline image.
export function paperEvidenceOf(ws) {
  const out = [];
  const seen = new Set();
  const add = (raw, name = "", hint = "") => {
    const src = safePaperSrc(raw);
    if (!src || seen.has(src)) return;
    seen.add(src);
    out.push({ src, kind: kindOf(src, hint), name: String(name || "").trim() });
  };
  add(ws?.signed_copy_image, "Signed paper copy");
  add(ws?.signed_copy_url, "Signed paper copy");
  for (const f of Array.isArray(ws?.evidence_files) ? ws.evidence_files : []) {
    if (typeof f === "string") add(f);
    else if (f && typeof f === "object") add(f.data_url || f.url || f.data, f.name || f.filename, f.content_type || f.mime_type || f.type);
  }
  return out;
}

export function paperReferenceOf(ws) {
  return String(ws?.client_paper_reference || ws?.paper_reference || ws?.evidence_reference || "").trim();
}

export const hasPaperEvidence = (ws) => paperEvidenceOf(ws).length > 0;

// ---- Browser only ------------------------------------------------------------------------------

async function decode(file) {
  if (typeof createImageBitmap === "function") {
    try {
      const bmp = await createImageBitmap(file, { imageOrientation: "from-image" });
      return { source: bmp, width: bmp.width, height: bmp.height, close: () => bmp.close?.() };
    } catch { /* fall through to <img> */ }
  }
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error("decode"));
      el.src = url;
    });
    return { source: img, width: img.naturalWidth, height: img.naturalHeight, close: () => URL.revokeObjectURL(url) };
  } catch (err) {
    URL.revokeObjectURL(url);
    throw err;
  }
}

// Shrinks a photo to a light JPEG. Resolves { dataUrl, width, height, bytes, originalBytes }.
// Rejects with an Error whose message is safe to show the worker.
export async function compressImageFile(file, { plan = PAPER_PHOTO.PLAN, target = PAPER_PHOTO.TARGET_CHARS, hard = PAPER_PHOTO.HARD_CHARS } = {}) {
  let img;
  try { img = await decode(file); }
  catch { throw new Error("This picture could not be read. If it is an iPhone HEIC photo, take a new photo with the camera instead."); }
  try {
    if (!(img.width > 0 && img.height > 0)) throw new Error("This picture has no content. Try taking the photo again.");
    let best = null;
    for (const step of plan) {
      const { width, height } = fitWithin(img.width, img.height, step.maxEdge);
      const canvas = document.createElement("canvas");
      canvas.width = width; canvas.height = height;
      const ctx = canvas.getContext("2d");
      ctx.fillStyle = "#ffffff"; // JPEG has no transparency
      ctx.fillRect(0, 0, width, height);
      ctx.drawImage(img.source, 0, 0, width, height);
      const dataUrl = canvas.toDataURL("image/jpeg", step.quality);
      best = { dataUrl, width, height };
      if (dataUrl.length <= target) break;
    }
    if (!best || best.dataUrl.length > hard) throw new Error("This photo is still too large after shrinking it. Take it again closer to the paper, in plain light.");
    return { ...best, bytes: dataUrlBytes(best.dataUrl), originalBytes: file.size };
  } finally {
    img.close();
  }
}

export function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("The file could not be read."));
    reader.readAsDataURL(file);
  });
}

// One call for the form: validate, shrink (images) or pass through (PDF), return what to store.
export async function preparePaperFile(file) {
  const check = validatePaperFile(file);
  if (!check.ok) throw new Error(check.error);
  if (check.kind === "pdf") {
    const dataUrl = await readFileAsDataUrl(file);
    const forced = dataUrl.startsWith("data:application/pdf") ? dataUrl : `data:application/pdf;base64,${dataUrl.split(",")[1] || ""}`;
    return { dataUrl: forced, kind: "pdf", name: file.name || "scan.pdf", bytes: file.size, originalBytes: file.size };
  }
  const r = await compressImageFile(file);
  return { ...r, kind: "image", name: file.name || "photo.jpg" };
}

// data: URL -> Blob. Browsers refuse to open a data: PDF in a new tab, but a blob: URL opens fine.
export function dataUrlToBlob(dataUrl) {
  const s = String(dataUrl || "");
  const m = /^data:([^;,]*)((?:;[^;,]*)*),(.*)$/s.exec(s);
  if (!m) return null;
  const mime = m[1] || "application/octet-stream";
  const isB64 = /;base64/i.test(m[2]);
  try {
    if (!isB64) return new Blob([decodeURIComponent(m[3])], { type: mime });
    const bin = atob(m[3]);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new Blob([bytes], { type: mime });
  } catch { return null; }
}
