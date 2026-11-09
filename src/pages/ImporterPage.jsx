import React, { useCallback, useEffect, useState } from "react";
import PageHeaderBanner from "../components/PageHeaderBanner.jsx";
import DataTable from "../components/DataTable.jsx";
import StatusSummary from "../components/StatusSummary.jsx";
import { ErrorBanner } from "../components/PageStates.jsx";
import { ICONS } from "../components/icons.jsx";
import Button from "../components/ui/Button.jsx";
import Field from "../components/ui/Field.jsx";
import Input from "../components/ui/Input.jsx";
import { imports } from "../api/client.js";
import {
  ENTITY_OPTIONS, commitBlocker, describeJob, downloadName, entityLabel, hasProblems,
  problemRowsCsv, summaryItems, visibleRows
} from "../importer/importerView.js";
import { runCommit, runPreview } from "../importer/importerFlow.js";

// Colour comes only from theme tokens, so the page follows the light and dark themes.
const PANEL = "rounded-lg border border-orac-border-default bg-orac-surface p-5";
const NOTICE = {
  danger: "border-orac-danger-border bg-orac-danger-bg text-orac-danger-text",
  warning: "border-orac-warning-border bg-orac-warning-bg text-orac-warning-text",
  success: "border-orac-success-border bg-orac-success-bg text-orac-success-text",
  info: "border-orac-info-border bg-orac-info-bg text-orac-info-text"
};
const noticeClass = (tone) => `rounded-lg border px-4 py-3 text-base ${NOTICE[tone]}`;

function saveText(filename, text) {
  const url = URL.createObjectURL(new Blob([text], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export default function ImporterPage() {
  const [entity, setEntity] = useState(ENTITY_OPTIONS[0].key);
  const [csvText, setCsvText] = useState("");
  const [fileName, setFileName] = useState("");
  const [preview, setPreview] = useState(null);
  const [onlyProblems, setOnlyProblems] = useState(true);
  const [phrase, setPhrase] = useState("");
  const [count, setCount] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [result, setResult] = useState(null);
  const [jobs, setJobs] = useState([]);
  const [jobsError, setJobsError] = useState("");

  const loadJobs = useCallback(async () => {
    try { setJobs(await imports.list()); setJobsError(""); }
    catch (error) { setJobsError(error.message); }
  }, []);
  useEffect(() => { loadJobs(); }, [loadJobs]);

  const reset = () => { setCsvText(""); setFileName(""); setPreview(null); setPhrase(""); setCount(""); setMessage(""); };
  const chooseEntity = (key) => { setEntity(key); reset(); setResult(null); };

  const downloadTemplate = async () => {
    setMessage("");
    try { const file = await imports.template(entity); saveText(file.filename, file.csv_content); }
    catch (error) { setMessage(error.message); }
  };

  const onFile = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    reset(); setResult(null);
    if (!file) return;
    setBusy(true);
    const outcome = await runPreview({ api: imports, entity, file });
    setBusy(false);
    if (!outcome.ok) { setMessage(outcome.message); return; }
    setFileName(file.name);
    setCsvText(outcome.csvText);
    setPreview(outcome.preview);
    setOnlyProblems(hasProblems(outcome.preview));
  };

  const blocker = commitBlocker({ preview, phrase, count });
  const doCommit = async () => {
    setBusy(true); setMessage("");
    const outcome = await runCommit({ api: imports, entity, csvText, preview, phrase, count });
    setBusy(false);
    if (!outcome.ok) { setMessage(outcome.message); return; }
    setResult(outcome.result);
    reset();
    loadJobs();
  };

  const rows = visibleRows(preview, onlyProblems);
  const option = ENTITY_OPTIONS.find((e) => e.key === entity);

  return (
    <div className="min-w-0 space-y-4">
      <PageHeaderBanner className="min-w-0" eyebrow="Administration" title="Data Import" iconPath={ICONS.document}
        subtitle="Create many Clients or Catalog items from one CSV file. Each row is checked with the same rules as the forms, and nothing is created unless every row passes." />

      <p className={`${noticeClass("info")} md:hidden`} role="note">
        Importing a file needs a larger screen. You can still see past imports below.
      </p>

      <section aria-label="Import a file" className={`hidden space-y-4 md:block ${PANEL}`}>
        <fieldset>
          <legend className="text-base font-semibold text-orac-text-primary">1. What are you importing?</legend>
          <div className="mt-2 flex flex-wrap gap-4">
            {ENTITY_OPTIONS.map((e) => (
              <label key={e.key} className="inline-flex min-h-[44px] items-center gap-2 text-base text-orac-text-primary">
                <Input type="radio" className="!w-auto" name="import-entity" value={e.key} checked={entity === e.key} onChange={() => chooseEntity(e.key)} />
                {e.label}
              </label>
            ))}
          </div>
        </fieldset>

        <div>
          <p className="text-base font-semibold text-orac-text-primary">2. Use the template</p>
          <p className="mt-1 text-base text-orac-text-muted">Columns: {option.columns}. Prices are plain numbers such as 12.50. Save the finished sheet as CSV (comma separated, UTF-8). Nothing in the file is changed on import.</p>
          <Button variant="secondary" onClick={downloadTemplate} className="mt-2">Download template (CSV)</Button>
        </div>

        <Field id="import-file" label="3. Choose the file (CSV, up to 512 KB)" hint="If the file has more rows than one import allows, you are told the limit before anything is created.">
          <Input id="import-file" type="file" accept=".csv,text/csv" onChange={onFile} disabled={busy} />
        </Field>
        <div aria-live="polite" className="text-base">
          {busy && <p className="text-orac-text-secondary">Working...</p>}
        </div>
        {message && <ErrorBanner message={message} />}
      </section>

      {result && (
        <p role="status" className={`${noticeClass("success")} font-semibold`}>
          Import complete: {result.created_count} {entityLabel(result.entity)} created. Job {result.job_id}.
        </p>
      )}

      {preview && (
        <section aria-label="Preview" className="hidden space-y-4 md:block">
          <h2 className="text-base font-semibold text-orac-text-primary">4. Review {fileName}</h2>
          {preview.file_errors.length > 0 && (
            <ul role="alert" className={`space-y-1 ${noticeClass("danger")}`}>
              {preview.file_errors.map((f, i) => <li key={i}>{f.message}</li>)}
            </ul>
          )}
          {preview.already_imported && (
            <p role="alert" className={noticeClass("warning")}>This exact file has already been imported. Change the file to import it again.</p>
          )}
          <StatusSummary items={summaryItems(preview)} label="Import summary" />
          <p className="text-base text-orac-text-secondary">{preview.row_count} rows in the file.</p>
          <div className="flex flex-wrap items-center gap-3">
            <label className="inline-flex min-h-[44px] items-center gap-2 text-base text-orac-text-primary">
              <Input type="checkbox" className="!w-auto" checked={onlyProblems} onChange={(e) => setOnlyProblems(e.target.checked)} />
              Show only rows with problems
            </label>
            {(preview.error_count > 0 || preview.warning_count > 0) && (
              <Button variant="secondary" onClick={() => saveText(downloadName(entity, "problems"), problemRowsCsv(preview))}>Download the problem list (CSV)</Button>
            )}
          </div>
          <DataTable title="Rows" columns={["Row", "Result", "Values", "Problems"]} rows={rows}
            emptyText={onlyProblems ? "No rows with problems." : "No rows."}
            renderRow={(row) => (
              <tr key={row.row}>
                <td className="px-5 py-3.5">{row.row}</td>
                <td className="px-5 py-3.5">{row.status === "ok" ? "Ready" : "Needs fixing"}</td>
                <td className="px-5 py-3.5">{Object.values(row.values).slice(0, 3).join(" | ")}</td>
                <td className="px-5 py-3.5">
                  {[...row.errors, ...row.warnings].map((p, i) => <div key={i}><span className="font-semibold">{p.field || "Row"}:</span> {p.message}</div>)}
                </td>
              </tr>
            )} />

          <div className={`space-y-3 ${PANEL}`}>
            <h2 className="text-base font-semibold text-orac-text-primary">5. Confirm</h2>
            <div className="flex flex-wrap items-end gap-4">
              <Field id="import-phrase" label={`Type ${preview.confirmation_phrase}`}>
                <Input id="import-phrase" value={phrase} onChange={(e) => setPhrase(e.target.value)} autoComplete="off" />
              </Field>
              <Field id="import-count" label="Type the number of rows" className="w-40">
                <Input id="import-count" value={count} onChange={(e) => setCount(e.target.value)} inputMode="numeric" autoComplete="off" />
              </Field>
              <Button disabled={busy || Boolean(blocker)} onClick={doCommit}>Import {preview.row_count} rows</Button>
            </div>
            {blocker && <p className="text-base text-orac-text-muted">{blocker}</p>}
          </div>
        </section>
      )}

      <section aria-label="Past imports" className="space-y-2">
        {jobsError && <ErrorBanner message={jobsError} />}
        <DataTable title="Past imports" columns={["When", "What", "Created", "Warnings", "Possible duplicates", "Created ids"]} rows={jobs.map(describeJob)}
          emptyText="No imports yet."
          renderRow={(job) => (
            <tr key={job.id}>
              <td className="px-5 py-3.5">{job.when}</td>
              <td className="px-5 py-3.5">{job.entity}</td>
              <td className="px-5 py-3.5">{job.created}</td>
              <td className="px-5 py-3.5">{job.warnings}</td>
              <td className="px-5 py-3.5">{job.duplicates}</td>
              <td className="px-5 py-3.5">{job.ids}</td>
            </tr>
          )} />
      </section>
    </div>
  );
}
