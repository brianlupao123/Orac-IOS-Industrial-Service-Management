import React, { useEffect, useMemo, useState } from "react";
import Modal from "./Modal.jsx";
import { dataUrlToBlob, dataUrlBytes, formatBytes, paperEvidenceOf, paperReferenceOf } from "../lib/paperPhoto.js";

// The "paper copy" badge on a Timesheet and the viewer it opens, so an auditor can inspect the photo of
// the signed physical sheet without leaving the page. Read-only: nothing here changes the record.

// A badge that opens the photo when there is one; a plain label when only a paper reference is recorded.
export function PaperEvidenceBadge({ worksheet, onOpen }) {
  const files = paperEvidenceOf(worksheet);
  const ref = paperReferenceOf(worksheet);
  if (!files.length && !ref) return null;
  const label = ref ? `Paper copy · ${ref}` : "Signed paper copy";
  const base = "inline-flex min-h-[32px] items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold";
  if (!files.length) {
    return <span className={`${base} border-gray-200 bg-gray-50 text-gray-600 dark:bg-transparent`} title="A paper reference is recorded but no photo is attached"><span aria-hidden="true">📄</span>{label} (no photo)</span>;
  }
  return (
    <button type="button" onClick={() => onOpen(worksheet)} aria-haspopup="dialog" aria-label={`View the signed paper copy${ref ? `, reference ${ref}` : ""}${files.length > 1 ? `, ${files.length} files` : ""}`}
      className={`${base} border-sky-300 bg-sky-50 text-sky-900 hover:bg-sky-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-orac-blue dark:bg-sky-950/40 dark:text-sky-200`}>
      <span aria-hidden="true">📄</span>{label}{files.length > 1 ? ` (${files.length})` : ""}
    </button>
  );
}

// blob: URL for the current file, released when it changes or the viewer closes.
function useViewableUrl(src) {
  const [url, setUrl] = useState("");
  useEffect(() => {
    if (!src) { setUrl(""); return undefined; }
    if (!src.startsWith("data:")) { setUrl(src); return undefined; }
    const blob = dataUrlToBlob(src);
    if (!blob) { setUrl(""); return undefined; }
    const u = URL.createObjectURL(blob);
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [src]);
  return url;
}

export function PaperEvidenceModal({ worksheet, onClose }) {
  const files = useMemo(() => paperEvidenceOf(worksheet), [worksheet]);
  const [index, setIndex] = useState(0);
  const [zoom, setZoom] = useState(false);
  useEffect(() => { setIndex(0); setZoom(false); }, [worksheet]);
  const file = files[index] || null;
  const url = useViewableUrl(file?.src);
  const ref = paperReferenceOf(worksheet);
  const size = file?.src.startsWith("data:") ? formatBytes(dataUrlBytes(file.src)) : "";
  const fileName = `signed-paper-${worksheet?.id || "timesheet"}${file?.kind === "pdf" ? ".pdf" : ".jpg"}`;

  return (
    <Modal title="Signed paper copy" isOpen={Boolean(worksheet)} onClose={onClose} size="3xl">
      {worksheet && (
        <div className="space-y-3">
          <p className="text-sm text-gray-600">
            Timesheet {worksheet.id}{worksheet.work_date ? ` · ${worksheet.work_date}` : ""}{ref ? ` · Paper reference ${ref}` : ""}
          </p>
          {files.length > 1 && (
            <div className="flex flex-wrap gap-2" role="tablist" aria-label="Attached files">
              {files.map((f, i) => (
                <button key={f.src.slice(0, 64) + i} type="button" role="tab" aria-selected={i === index} onClick={() => { setIndex(i); setZoom(false); }}
                  className={`min-h-[44px] rounded-full px-4 text-sm font-semibold ${i === index ? "bg-gray-900 text-white" : "border border-gray-300 text-gray-700"}`}>{f.name || `File ${i + 1}`}</button>
              ))}
            </div>
          )}
          {!file || !url ? (
            <p role="alert" className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">This file could not be displayed.</p>
          ) : file.kind === "pdf" ? (
            <>
              <object data={url} type="application/pdf" aria-label="Signed paper PDF" className="h-[60vh] w-full rounded-lg border border-gray-200">
                <p className="p-4 text-sm text-gray-600">This device cannot show the PDF here. Use Open or Download below.</p>
              </object>
            </>
          ) : (
            <div className={`rounded-lg border border-gray-200 bg-gray-100 dark:bg-slate-900 ${zoom ? "max-h-[65vh] overflow-auto" : ""}`}>
              <img src={url} alt={`Photo of the signed paper Timesheet${ref ? `, reference ${ref}` : ""}`} className={zoom ? "max-w-none" : "mx-auto max-h-[65vh] w-auto max-w-full object-contain"} style={zoom ? { width: "200%" } : undefined} />
            </div>
          )}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs text-gray-500">{file ? `${file.kind === "pdf" ? "PDF scan" : "Photo"}${size ? ` · ${size}` : ""}` : ""}</p>
            <div className="flex flex-wrap gap-2">
              {file?.kind === "image" && url && (
                <button type="button" onClick={() => setZoom((z) => !z)} aria-pressed={zoom} className="min-h-[44px] rounded-lg border border-gray-300 px-4 text-sm font-semibold text-gray-700 dark:text-orac-text-muted">{zoom ? "Fit to screen" : "Zoom in"}</button>
              )}
              {url && <a href={url} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-[44px] items-center rounded-lg border border-gray-300 px-4 text-sm font-semibold text-gray-700 dark:text-orac-text-muted">Open</a>}
              {url && <a href={url} download={fileName} className="inline-flex min-h-[44px] items-center rounded-lg border border-gray-300 px-4 text-sm font-semibold text-gray-700 dark:text-orac-text-muted">Download</a>}
              <button type="button" onClick={onClose} className="min-h-[44px] rounded-lg bg-orac-blue px-5 text-sm font-semibold text-white">Close</button>
            </div>
          </div>
        </div>
      )}
    </Modal>
  );
}
