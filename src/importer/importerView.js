// Pure helpers for the Data Import page. No React, no network, no browser APIs.
// The server decides everything; these only describe what the server returned.

export const MAX_FILE_BYTES = 512 * 1024;
export const MAX_ROWS = 1000;

export const ENTITY_OPTIONS = Object.freeze([
  { key: "clients", label: "Clients", phrase: "IMPORT_CLIENTS", columns: "name, client_type, contact_person, email" },
  { key: "catalog_items", label: "Catalog items", phrase: "IMPORT_CATALOG_ITEMS", columns: "item_code, item_name, unit_price, category, unit_of_measure, material_grade, dimensions" }
]);

export const entityLabel = (key) => ENTITY_OPTIONS.find((e) => e.key === key)?.label || key;

// Returns a message when the chosen file cannot be sent, or "" when it can.
export function fileProblem(file) {
  if (!file) return "Choose a CSV file first.";
  const name = String(file.name || "").toLowerCase();
  if (!name.endsWith(".csv")) return "Only .csv files can be imported. Save the sheet as CSV (comma separated) first.";
  if (file.size > MAX_FILE_BYTES) return "The file is larger than 512 KB.";
  if (file.size === 0) return "The file is empty.";
  return "";
}

// Categorical summary: the name and meaning lead, the count is secondary.
export function summaryItems(preview) {
  const rows = preview?.rows || [];
  const warnings = preview?.warning_count || 0;
  const bad = (preview?.error_count || 0);
  const ok = preview?.ok_count || 0;
  const duplicates = preview?.duplicate_count || 0;
  const items = [
    { key: "ready", label: "Ready", meaning: "Rows that passed every check.", count: ok, tone: ok ? "success" : "neutral" },
    { key: "fix", label: "Needs fixing", meaning: "Rows or file problems that block the import. Nothing is created until they are fixed.", count: bad, tone: bad ? "danger" : "neutral" },
    { key: "warn", label: "Warnings", meaning: "Notes that do not block the import, such as spaces at the start or end.", count: warnings, tone: warnings ? "warning" : "neutral" }
  ];
  // Only shown when there is something to check. Repeats never block the import, so the card says so.
  if (duplicates > 0) {
    items.push({ key: "duplicates", label: "Possible duplicates", meaning: "Names or item codes repeated in this file or already in the system. They are still imported, so check them first.", count: duplicates, tone: "warning" });
  }
  return items.map((item) => ({ ...item, rows: rows.length }));
}

export const hasProblems = (preview) => (preview?.error_count || 0) > 0;

export function visibleRows(preview, onlyProblems) {
  const rows = preview?.rows || [];
  return onlyProblems ? rows.filter((r) => r.status === "error" || r.warnings.length > 0) : rows;
}

const neutralise = (value) => {
  const text = String(value ?? "");
  return /^[=+\-@]/.test(text) ? `'${text}` : text;
};
const csvCell = (value) => {
  const text = neutralise(value);
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

// CSV of the rows that have errors or warnings: row number, column, code, message.
export function problemRowsCsv(preview) {
  const lines = ["row,column,code,message"];
  for (const file of preview?.file_errors || []) lines.push(["", "", file.code, file.message].map(csvCell).join(","));
  for (const row of preview?.rows || []) {
    for (const item of [...row.errors, ...row.warnings]) {
      lines.push([row.row, item.field, item.code, item.message].map(csvCell).join(","));
    }
  }
  return `${lines.join("\r\n")}\r\n`;
}

// Why the Import button is still disabled, or "" when it may be pressed.
export function commitBlocker({ preview, phrase, count }) {
  if (!preview) return "Preview the file first.";
  if (preview.already_imported) return "This exact file has already been imported.";
  if (!preview.can_commit) return "Fix the problems listed above, then preview again.";
  if (phrase !== preview.confirmation_phrase) return `Type ${preview.confirmation_phrase} exactly.`;
  if (String(count).trim() !== String(preview.row_count)) return "Type the number of rows in the file.";
  return "";
}

export function commitBody({ csvText, preview, phrase, count }) {
  return { csv_content: csvText, confirmation: phrase, expected_row_count: Number(String(count).trim()), file_sha256: preview.file_sha256 };
}

export function describeJob(job) {
  const when = job.created_at ? new Date(job.created_at).toISOString().replace("T", " ").slice(0, 16) + " UTC" : "";
  return {
    id: job.id,
    when,
    entity: entityLabel(job.entity),
    created: job.created_count,
    warnings: job.warnings_count || 0,
    duplicates: job.duplicate_warnings_count || 0,
    ids: job.ids_available ? "Kept" : "Cleared after 90 days"
  };
}

export function downloadName(entity, kind) {
  return kind === "template" ? `${entity}-import-template.csv` : `${entity}-import-problems.csv`;
}
