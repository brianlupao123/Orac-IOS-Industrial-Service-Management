import React from "react";
import { entrySourceOf, ENTRY_SOURCE_BADGE, paperReferenceOf, ENTRY_SOURCE } from "../lib/paperEntryLogic.js";

const TONE = {
  green: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300",
  blue: "bg-sky-100 text-sky-800 dark:bg-sky-950/40 dark:text-sky-300"
};

// Origin badge for one Timesheet row. Presentational only.
export default function EntrySourceBadge({ worksheet }) {
  const source = entrySourceOf(worksheet);
  const meta = ENTRY_SOURCE_BADGE[source];
  const ref = source === ENTRY_SOURCE.PAPER ? paperReferenceOf(worksheet) : "";
  return (
    <span
      data-evidence="entry-source-badge"
      title={meta.hint}
      className={`inline-flex w-fit items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${TONE[meta.tone]}`}
    >
      <span aria-hidden="true">{meta.icon}</span>
      <span>{meta.label}</span>
      {ref && <span className="font-normal opacity-80">· {ref}</span>}
    </span>
  );
}
