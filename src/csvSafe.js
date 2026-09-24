// CSV cell encoding for client-side report exports.
//
// A quoted cell that begins with = + - @ (or tab / carriage return) is still
// evaluated as a formula by Excel and LibreOffice. Report rows carry free text
// (for example a supervisor's return comment), so string cells with such a
// prefix are neutralised with a leading apostrophe. This matches the server
// export rule in operationalDataController.js (csvCell). Numbers are left
// untouched so negative figures such as a variance stay numeric.
//
// Everything else is deliberately unchanged from the previous inline code:
// objects are JSON-encoded, undefined becomes an empty cell, quotes are doubled.
export function csvCell(value) {
  const text = typeof value === "object" ? JSON.stringify(value) : String(value ?? "");
  const safe = typeof value === "string" && /^[=+\-@\t\r]/.test(text) ? `'${text}` : text;
  return `"${safe.replace(/"/g, '""')}"`;
}
