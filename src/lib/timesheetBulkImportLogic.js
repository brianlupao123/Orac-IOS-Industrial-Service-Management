// Pure logic for Bulk Timesheet Import (Spreadsheet / CSV / TSV / Semicolon)
// Zero JSX, zero DOM, fully testable with node --test.

export const BULK_DRAFT_KEY = (userId) => `orac_draft_bulk_timesheets_${userId || "anon"}`;

// Helper: strictly parses and validates real calendar dates (prevents 2026-02-30 or garbage)
export function parseAndValidateDate(raw) {
  if (!raw || typeof raw !== "string") return { valid: false, date: "" };
  let trimmed = raw.trim();
  if (trimmed.includes("T")) trimmed = trimmed.split("T")[0];

  let y, m, d;
  if (/^\d{4}[/-]\d{1,2}[/-]\d{1,2}$/.test(trimmed)) {
    const parts = trimmed.split(/[/-]/).map(Number);
    y = parts[0]; m = parts[1]; d = parts[2];
  } else if (/^\d{1,2}[/.-]\d{1,2}[/.-]\d{4}$/.test(trimmed)) {
    const parts = trimmed.split(/[/.-]/).map(Number);
    d = parts[0]; m = parts[1]; y = parts[2];
  } else {
    return { valid: false, date: "" };
  }

  if (m < 1 || m > 12 || d < 1 || d > 31 || y < 2000 || y > 2100) {
    return { valid: false, date: "" };
  }

  const testDate = new Date(Date.UTC(y, m - 1, d));
  if (testDate.getUTCFullYear() !== y || testDate.getUTCMonth() !== m - 1 || testDate.getUTCDate() !== d) {
    return { valid: false, date: "" };
  }

  const iso = `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  return { valid: true, date: iso };
}

// Helper: parse hours with decimal comma support and strict validation
export function parseHours(val, delimiter) {
  if (val === undefined || val === null || val === "") return { ok: true, hours: 0 };
  let str = String(val).trim();
  if ((delimiter === ";" || delimiter === "\t") && str.includes(",") && !str.includes(".")) {
    str = str.replace(",", ".");
  }
  str = str.replace(/hrs?$/i, "").trim();
  const num = Number(str);
  if (Number.isNaN(num)) return { ok: false, hours: 0, error: `Invalid number: "${val}"` };
  if (num < 0) return { ok: false, hours: num, error: "Hours cannot be negative" };
  if (num > 24) return { ok: false, hours: num, error: "Hours cannot exceed 24h" };
  return { ok: true, hours: num };
}

// RFC-4180 quote-aware character parser across the entire input string
// Handles multi-line quoted cells, escaped double quotes (""), and auto-detects delimiter.
export function parseDelimitedText(text) {
  if (!text || !text.trim()) return [];
  const clean = text.replace(/^\uFEFF/, "").trim();
  if (!clean) return [];

  // 1. Determine delimiter from the first physical line
  let firstLine = clean;
  const firstNewline = clean.search(/\r?\n/);
  if (firstNewline >= 0) {
    firstLine = clean.slice(0, firstNewline);
  }

  let delimiter = ",";
  if (firstLine.includes("\t")) delimiter = "\t";
  else if (firstLine.includes(";") && !firstLine.includes(",")) delimiter = ";";

  // 2. Character-by-character RFC-4180 parsing over the entire text
  const rawRecords = [];
  let currentFields = [];
  let currentField = "";
  let inQuotes = false;
  let recordStartIdx = 0;
  let currentLine = 1;
  let quoteStartLine = 1;

  for (let i = 0; i < clean.length; i++) {
    const char = clean[i];

    if (char === "\n") {
      currentLine++;
    }

    if (char === '"') {
      if (inQuotes && clean[i + 1] === '"') {
        currentField += '"';
        i++; // skip escaped quote
      } else {
        if (!inQuotes) {
          quoteStartLine = currentLine;
        }
        inQuotes = !inQuotes;
      }
    } else if (char === delimiter && !inQuotes) {
      currentFields.push(currentField.trim());
      currentField = "";
    } else if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && clean[i + 1] === "\n") {
        i++; // skip CRLF
        currentLine++;
      }
      currentFields.push(currentField.trim());
      currentField = "";
      // Record complete if at least one field has non-whitespace content
      if (currentFields.some((f) => f.length > 0)) {
        const rawSlice = clean.slice(recordStartIdx, i + 1).trim();
        rawRecords.push({ fields: currentFields, rawText: rawSlice });
      }
      currentFields = [];
      recordStartIdx = i + 1;
    } else {
      currentField += char;
    }
  }

  // Final field and record
  currentFields.push(currentField.trim());
  if (currentFields.some((f) => f.length > 0)) {
    const rawSlice = clean.slice(recordStartIdx).trim();
    rawRecords.push({ fields: currentFields, rawText: rawSlice });
  }

  const unclosedQuoteError = inQuotes ? `Unclosed quote in CSV input starting on line ${quoteStartLine}` : null;

  if (rawRecords.length === 0) {
    if (unclosedQuoteError) {
      return [{
        rowId: 1,
        rawText: clean,
        date: "",
        isDateValid: false,
        workerName: "",
        trade: "",
        jobRef: "",
        normal: 0,
        ot15: 0,
        ot20: 0,
        activity: "",
        parseErrors: [unclosedQuoteError],
        headerRawText: ""
      }];
    }
    return [];
  }

  // 3. Header Detection
  // Word boundary regex for known headers (avoids matching "motor" -> "ot")
  const headerTokenRegex = /\b(date|technician|worker|artisan|national\s*id|natid|nationalid|id\s*number|id_number|idno|nat_id|trade|discipline|job|dispatch|normal|regular|hours|activity|description|overtime|ot15|ot20)\b/i;

  const firstRecord = rawRecords[0];
  const col0IsDate = parseAndValidateDate(firstRecord.fields[0] || "").valid;

  // A row with a valid calendar date in column 0 is NEVER a header row!
  let isHeader = false;
  if (!col0IsDate) {
    // Count how many fields match known header keywords
    const matchingHeaderCols = firstRecord.fields.filter((c) => headerTokenRegex.test(c)).length;
    // Considered a header if at least 2 columns match header keywords, or col0 is literally "date"
    isHeader = matchingHeaderCols >= 2 || /^\s*date\s*$/i.test(firstRecord.fields[0] || "");
  }

  let headers = [];
  let dataRecords = rawRecords;
  let headerRawText = "";

  if (isHeader) {
    headerRawText = firstRecord.rawText;
    headers = firstRecord.fields.map((h) => h.toLowerCase());
    dataRecords = rawRecords.slice(1);
  }

  const findCol = (terms, defaultIdx) => {
    if (!headers.length) return defaultIdx;
    const idx = headers.findIndex((h) => terms.some((t) => {
      // Use regex or substring for header column match
      return h.toLowerCase().includes(t.toLowerCase());
    }));
    return idx >= 0 ? idx : defaultIdx;
  };

  const colDate = findCol(["date", "day"], 0);
  const colWorker = findCol(["technician", "worker", "artisan", "name"], 1);
  const colNationalId = findCol(["national_id", "national id", "nationalid", "natid", "id number", "id_number", "idno", "nat_id"], -1);
  const colTrade = findCol(["trade", "discipline"], 2);
  const colJob = findCol(["job", "dispatch", "dc"], 3);
  const colNormal = findCol(["normal", "regular", "std", "basic", "hours"], 4);
  const colOt15 = findCol(["1.5", "ot15", "ot 1.5", "sat"], 5);
  const colOt20 = findCol(["2.0", "ot20", "ot 2.0", "sun", "double"], 6);
  const colActivity = findCol(["activity", "description", "scope", "task"], 7);

  return dataRecords.map((rec, idx) => {
    const cols = rec.fields;
    const rawDate = cols[colDate] || "";
    const dateParsed = parseAndValidateDate(rawDate);

    const workerName = cols[colWorker] || "";
    const nationalId = colNationalId >= 0 ? (cols[colNationalId] || "").trim() : "";
    const trade = cols[colTrade] || "";
    const jobRef = cols[colJob] || "";

    const parsedNormal = parseHours(cols[colNormal], delimiter);
    const parsedOt15 = parseHours(cols[colOt15], delimiter);
    const parsedOt20 = parseHours(cols[colOt20], delimiter);

    const activity = cols[colActivity] || cols.slice(colActivity).join(" ") || "General field engineering operations";

    const rowErrors = [];
    if (!dateParsed.valid) rowErrors.push(`Invalid date "${rawDate}" (YYYY-MM-DD or DD/MM/YYYY required)`);
    if (!parsedNormal.ok) rowErrors.push(parsedNormal.error);
    if (!parsedOt15.ok) rowErrors.push(parsedOt15.error);
    if (!parsedOt20.ok) rowErrors.push(parsedOt20.error);
    if (idx === dataRecords.length - 1 && unclosedQuoteError) {
      rowErrors.push(unclosedQuoteError);
    }

    return {
      rowId: idx + 1,
      rawText: rec.rawText,
      date: dateParsed.valid ? dateParsed.date : rawDate,
      isDateValid: dateParsed.valid,
      workerName: workerName.trim(),
      nationalId,
      trade: trade.trim(),
      jobRef: jobRef.trim(),
      normal: parsedNormal.hours,
      ot15: parsedOt15.hours,
      ot20: parsedOt20.hours,
      activity: activity.trim(),
      parseErrors: rowErrors,
      headerRawText
    };
  });
}

// Exact matching for active technician profiles (no loose substring or trade fallback)
// Normalized whitespace matching and ambiguous name detection with National ID disambiguation
export function matchTechnician(row, technicians) {
  if (!row.workerName && !row.nationalId) return null;
  const activeTechs = (technicians || []).filter((t) => t.is_active !== false);

  // 1. If explicit nationalId column was supplied, match by it first (takes precedence to disambiguate)
  if (row.nationalId) {
    const cleanNatCol = String(row.nationalId).trim().replace(/[-\s]/g, "").toLowerCase();
    if (cleanNatCol) {
      const byCol = activeTechs.find((t) => {
        if (!t.national_id) return false;
        const cleanTId = t.national_id.replace(/[-\s]/g, "").toLowerCase();
        return cleanTId === cleanNatCol;
      });
      if (byCol) return byCol;
    }
  }

  const cleanInput = (row.workerName || "").trim().toLowerCase().replace(/\s+/g, " ");

  // 2. Match by exact national ID typed in workerName if supplied (ignores dashes and spaces)
  if (cleanInput) {
    const byId = activeTechs.find((t) => {
      if (!t.national_id) return false;
      const cleanId = t.national_id.replace(/[-\s]/g, "").toLowerCase();
      return cleanId === cleanInput.replace(/[-\s]/g, "");
    });
    if (byId) return byId;
  }

  // 3. Match by exact normalized full name
  const matches = activeTechs.filter((t) => {
    const full1 = (t.name || "").trim().toLowerCase().replace(/\s+/g, " ");
    const full2 = `${t.first_name || ""} ${t.last_name || ""}`.trim().toLowerCase().replace(/\s+/g, " ");
    return (full1 && full1 === cleanInput) || (full2 && full2 === cleanInput);
  });

  if (matches.length > 1) {
    return { ambiguous: true, count: matches.length, matches };
  }
  if (matches.length === 1) {
    return matches[0];
  }

  return null;
}

// Compute a stable fingerprint from row contents for idempotency key tracking across partial retries
export function computeRowFingerprint(item) {
  if (!item) return "";
  const worker = (item.matchedTech?.id || item.workerName || "").trim().toLowerCase().replace(/\s+/g, " ");
  const natId = (item.nationalId || item.matchedTech?.national_id || "").trim().toLowerCase().replace(/[-\s]/g, "");
  const date = (item.date || "").trim();
  const dispatch = (item.resolvedDispatchId || item.jobRef || "").trim().toLowerCase();
  const normal = Number(item.normal || 0).toFixed(2);
  const ot15 = Number(item.ot15 || 0).toFixed(2);
  const ot20 = Number(item.ot20 || 0).toFixed(2);
  const activity = (item.activity || "").trim().toLowerCase().replace(/\s+/g, " ");
  return `${worker}|${natId}|${date}|${dispatch}|${normal}|${ot15}|${ot20}|${activity}`;
}

// Comprehensive batch validator enforcing intra-batch integrity
export function validateImportBatch(parsedRows, technicians, dispatches, defaultDispatchId, options = {}) {
  const { allowExternalContractors = false } = options;
  const seenEntries = new Map(); // workerKey|date|dispatchId -> rowId
  const cumulativeHours = new Map(); // workerKey|date -> number

  const prepped = (parsedRows || []).map((row) => {
    const tech = matchTechnician(row, technicians);
    let resolvedDispatchId = defaultDispatchId || "";
    let dispatchFound = true;

    if (row.jobRef) {
      const refClean = row.jobRef.trim().toLowerCase();
      const found = (dispatches || []).find((d) => {
        const dNum = (d.dispatch_number || "").trim().toLowerCase();
        const dId = (d.id || "").trim().toLowerCase();
        return dNum === refClean || dId === refClean;
      });
      if (found) {
        resolvedDispatchId = found.id;
      } else {
        resolvedDispatchId = "";
        dispatchFound = false;
      }
    }

    const totalHours = (row.normal || 0) + (row.ot15 || 0) + (row.ot20 || 0);
    const workerKey = tech?.id || (row.workerName ? row.workerName.trim().toLowerCase().replace(/\s+/g, " ") : `row_${row.rowId}`);

    return {
      ...row,
      matchedTech: tech,
      resolvedDispatchId,
      dispatchFound,
      totalHours,
      workerKey
    };
  });

  // Accumulate daily hours per worker on each valid calendar date
  for (const item of prepped) {
    if (item.workerName && item.date && item.isDateValid) {
      const dailyKey = `${item.workerKey}|${item.date}`;
      cumulativeHours.set(dailyKey, (cumulativeHours.get(dailyKey) || 0) + item.totalHours);
    }
  }

  return prepped.map((item) => {
    const errors = [...(item.parseErrors || [])];
    const warnings = [];

    if (!item.workerName) {
      errors.push("Missing technician name");
    }

    if (item.jobRef && !item.dispatchFound) {
      errors.push(`Dispatch card "${item.jobRef}" not found`);
    } else if (!item.resolvedDispatchId) {
      errors.push("No default dispatch card selected");
    }

    if (item.totalHours <= 0) {
      errors.push("Zero hours logged");
    } else if (item.totalHours > 24) {
      errors.push(`Total hours (${item.totalHours}h) exceeds maximum 24h per day`);
    }

    // Technician match checks
    if (item.matchedTech?.ambiguous) {
      errors.push(`Multiple active technicians (${item.matchedTech.count}) named "${item.workerName}". Provide National ID in CSV to disambiguate.`);
    } else if (!item.matchedTech && item.workerName) {
      if (!allowExternalContractors) {
        errors.push(`Technician "${item.workerName}" not found in active registry. Enable "Allow external contractor rows" to import as contractor.`);
      } else {
        warnings.push(`Technician "${item.workerName}" not found in registry; importing as external contractor.`);
      }
    }

    // Batch duplicate check: same worker, date, and dispatch
    if (item.workerName && item.date && item.resolvedDispatchId) {
      const entryKey = `${item.workerKey}|${item.date}|${item.resolvedDispatchId}`;
      if (seenEntries.has(entryKey)) {
        errors.push(`Duplicate entry in batch for "${item.workerName}" on ${item.date} under this dispatch (matches row ${seenEntries.get(entryKey)})`);
      } else {
        seenEntries.set(entryKey, item.rowId);
      }
    }

    // Cumulative daily hours check across batch
    if (item.workerName && item.date && item.isDateValid) {
      const dailyKey = `${item.workerKey}|${item.date}`;
      const dailyTotal = cumulativeHours.get(dailyKey) || 0;
      if (dailyTotal > 24 && item.totalHours <= 24) {
        errors.push(`Cumulative daily hours (${dailyTotal}h) for "${item.workerName}" on ${item.date} exceed 24h limit`);
      }
    }

    return {
      ...item,
      errors,
      warnings,
      isValid: errors.length === 0
    };
  });
}

// Reconstruct raw text of failed rows after a partial failure
export function reconstructFailedText(validatedRows, failedRowIds) {
  const failedSet = new Set(failedRowIds);
  const failedRows = validatedRows.filter((r) => failedSet.has(r.rowId));
  if (failedRows.length === 0) return "";

  const header = failedRows[0]?.headerRawText;
  const rowLines = failedRows.map((r) => r.rawText);

  if (header) {
    return [header, ...rowLines].join("\n");
  }
  return rowLines.join("\n");
}
