import React, { useEffect, useRef, useState } from "react";
import { formatBytes, isPdfDataUrl, preparePaperFile } from "../lib/paperPhoto.js";

// Attach the signed paper Timesheet: take a photo with the phone camera, or upload a picture / PDF scan.
// Photos are shrunk on the device before anything is stored or sent (see lib/paperPhoto.js), so this works
// on a weak connection. The parent owns the value (a data URL string); this component only produces it.
//
// Two separate inputs on purpose: a file input with `capture` always opens the camera and never offers the
// file picker, so a PDF could not be chosen from it. One button is the camera, the other is the picker.

const btnCls = "inline-flex min-h-[44px] items-center justify-center gap-2 rounded-lg border border-gray-300 bg-white px-4 text-sm font-semibold text-gray-700 disabled:opacity-50 dark:bg-transparent dark:text-orac-text-muted";

export default function PaperPhotoField({ value, onChange, onError, hasExisting = false, disabled = false, idPrefix = "ts-paper" }) {
  const cameraRef = useRef(null);
  const uploadRef = useRef(null);
  const [busy, setBusy] = useState(false);
  const [meta, setMeta] = useState(null);

  // The form was reset or reopened: forget the previous file's details.
  useEffect(() => { if (!value) setMeta(null); }, [value]);

  async function handle(e) {
    const file = e.target.files?.[0];
    e.target.value = ""; // so choosing the same file again (a retake) still fires
    if (!file) return;
    setBusy(true);
    onError?.("");
    await new Promise((r) => setTimeout(r, 0)); // let "Shrinking the photo..." paint before the heavy work
    try {
      const r = await preparePaperFile(file);
      setMeta({ kind: r.kind, name: r.name, bytes: r.bytes, originalBytes: r.originalBytes, width: r.width, height: r.height });
      onChange(r.dataUrl);
    } catch (err) {
      onError?.(err.message || "The file could not be attached.");
    } finally {
      setBusy(false);
    }
  }

  function remove() { setMeta(null); onChange(""); onError?.(""); }

  const attached = Boolean(value);
  const pdf = attached && isPdfDataUrl(value);
  const shrunk = meta && meta.kind === "image" && meta.originalBytes > meta.bytes;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <button type="button" disabled={disabled || busy} onClick={() => cameraRef.current?.click()} className={btnCls}>
          <span aria-hidden="true">📷</span>{attached ? "Retake Photo of Signed Paper" : "Take Photo of Signed Paper"}
        </button>
        <button type="button" disabled={disabled || busy} onClick={() => uploadRef.current?.click()} className={btnCls}>
          <span aria-hidden="true">📎</span>Upload Scan
        </button>
        <input ref={cameraRef} id={`${idPrefix}-camera`} type="file" accept="image/*" capture="environment" onChange={handle} className="hidden" tabIndex={-1} aria-label="Take a photo of the signed paper" />
        <input ref={uploadRef} id={`${idPrefix}-upload`} type="file" accept="image/*,application/pdf" onChange={handle} className="hidden" tabIndex={-1} aria-label="Upload a picture or PDF scan of the signed paper" />
      </div>

      <p role="status" aria-live="polite" className="text-xs text-gray-500">
        {busy ? "Shrinking the photo so it sends quickly..." : attached ? "" : hasExisting ? "A signed copy is already on file. Attach a new one only if it needs replacing." : "Photos are shrunk on this phone before they are sent, so they upload fast even on a weak connection."}
      </p>

      {attached && (
        <div className="flex items-center gap-3 rounded-lg border border-gray-200 bg-gray-50 p-2 dark:bg-transparent">
          {pdf ? (
            <div className="flex h-24 w-20 shrink-0 flex-col items-center justify-center rounded-md border border-gray-200 bg-white text-xs font-semibold text-gray-600 dark:bg-transparent" aria-hidden="true">
              <span className="text-2xl">📄</span>PDF
            </div>
          ) : (
            <img src={value} alt="Preview of the signed paper Timesheet" className="h-24 w-20 shrink-0 rounded-md border border-gray-200 bg-white object-cover" />
          )}
          <div className="min-w-0 flex-1 text-xs text-gray-600">
            <p className="font-semibold text-gray-800 dark:text-slate-100">{pdf ? "PDF scan attached" : "Photo attached"}</p>
            {meta?.name && <p className="truncate">{meta.name}</p>}
            {meta && <p>{formatBytes(meta.bytes)}{shrunk ? ` (was ${formatBytes(meta.originalBytes)})` : ""}{meta.width ? ` · ${meta.width}×${meta.height}` : ""}</p>}
          </div>
          <button type="button" onClick={remove} disabled={disabled || busy} className="min-h-[44px] px-3 text-sm font-semibold text-red-700 disabled:opacity-50">Remove</button>
        </div>
      )}
    </div>
  );
}
