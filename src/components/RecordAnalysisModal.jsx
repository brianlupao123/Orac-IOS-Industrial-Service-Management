import React from "react";
import Modal from "./Modal.jsx";

// Renders only the bounded, server-authored evidence contract. This component
// receives no action callbacks, record data, or arbitrary HTML.
export default function RecordAnalysisModal({ title, analysis, onClose }) {
  return (
    <Modal title={title} isOpen={Boolean(analysis)} onClose={onClose}>
      {analysis && <div className="space-y-4 text-sm text-gray-700" data-evidence="record-analysis">
        <p>This is a read-only, source-backed summary. It does not approve, verify, authorize or change a record.</p>
        <div>
          <h3 className="font-semibold text-orac-slate">Findings</h3>
          {analysis.findings?.length ? <ul className="mt-2 list-disc space-y-1 pl-5">{analysis.findings.map((finding) => <li key={`${finding.kind}:${finding.code}`}>{finding.message}</li>)}</ul> : <p className="mt-2">No findings were returned for this record.</p>}
        </div>
        <div>
          <h3 className="font-semibold text-orac-slate">Recorded evidence</h3>
          {analysis.evidenceRefs?.length ? <ul className="mt-2 list-disc space-y-1 pl-5">{analysis.evidenceRefs.map((ref) => <li key={`${ref.targetType}:${ref.targetId}`}>{ref.stage}: {ref.targetType} {ref.targetId}</li>)}</ul> : <p className="mt-2">No evidence references were returned.</p>}
        </div>
        {analysis.limitations?.length > 0 && <div><h3 className="font-semibold text-orac-slate">Limits of this analysis</h3><ul className="mt-2 list-disc space-y-1 pl-5">{analysis.limitations.map((item) => <li key={item}>{item}</li>)}</ul></div>}
      </div>}
    </Modal>
  );
}
