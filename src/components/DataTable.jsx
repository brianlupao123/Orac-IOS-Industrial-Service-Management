import React from "react";

const NUMERIC_HEADER_REGEX = /\b(amount|total|value|cost|price|hours|qty|quantity|rate|balance)\b/i;
const ACTION_HEADER_REGEX = /\b(action|actions|manage|controls|operations)\b/i;
const EMPTY_CELL_STRINGS = new Set(["", "\u2014", "-", "--", "n/a", "na", "null", "undefined"]);

/**
 * Checks if a cell value can be reliably established as empty.
 * If emptiness cannot be established with certainty (custom components, badges,
 * icons, buttons, interactive elements, zero numbers), returns false to preserve content.
 */
function isCellEmpty(node) {
  if (node === null || node === undefined) return true;
  // Numbers (including 0, 0.0) are valid business values, never empty
  if (typeof node === "number") return false;
  if (typeof node === "boolean") return false;
  if (typeof node === "string") {
    return EMPTY_CELL_STRINGS.has(node.trim().toLowerCase());
  }
  if (Array.isArray(node)) {
    if (node.length === 0) return true;
    return node.every(isCellEmpty);
  }
  if (React.isValidElement(node)) {
    const type = node.type;
    // Custom components (e.g. StatusBadge, Icon) cannot be assumed empty
    if (typeof type === "function" || typeof type === "object") {
      return false;
    }
    // Interactive or visual HTML elements are never empty
    if (typeof type === "string") {
      const tag = type.toLowerCase();
      if (["button", "svg", "path", "a", "input", "select", "img", "form"].includes(tag)) {
        return false;
      }
    }
    // Elements with accessibility labels or event handlers are intentional content
    if (node.props?.onClick || node.props?.["aria-label"] || node.props?.title) {
      return false;
    }
    // Inspect children if present
    if ("children" in node.props) {
      return isCellEmpty(node.props.children);
    }
    return false;
  }
  // Any other object or unknown structure: preserve it
  return false;
}

export default function DataTable({
  title,
  count,
  columns = [],
  rows = [],
  renderRow,
  emptyText = "No data",
  emptyStateClassName = "px-5 py-12 flex flex-col items-center justify-center text-center",
  action,
  toolbar,
  renderActions,
  actionLabel = "Action",
  hideEmptyColumns = false, // Opt-in only to avoid hiding critical custom components or controls
}) {
  // Pre-render rows to inspect columns and apply consistent cell formatting
  const rawRows = rows.map((row, i) => (renderRow ? renderRow(row, i) : null));

  // Determine which columns to hide only if opt-in hideEmptyColumns is explicitly enabled
  const hiddenColumns = new Set();
  if (hideEmptyColumns && rawRows.length > 0 && columns.length > 1) {
    // Skip auto-hide if any row uses colSpan (would break column alignment)
    let hasColSpan = false;
    for (const r of rawRows) {
      if (React.isValidElement(r)) {
        const cells = React.Children.toArray(r.props.children);
        for (const cell of cells) {
          if (React.isValidElement(cell) && Number(cell.props?.colSpan) > 1) {
            hasColSpan = true;
            break;
          }
        }
      }
      if (hasColSpan) break;
    }

    if (!hasColSpan) {
      // Never hide column 0 (primary identifier) and never hide action columns
      for (let c = 1; c < columns.length; c++) {
        const header = columns[c] || "";
        if (header.trim() === "" || ACTION_HEADER_REGEX.test(header)) {
          continue; // Never hide action or blank-header columns
        }

        let allEmpty = true;
        for (const r of rawRows) {
          if (React.isValidElement(r)) {
            const cells = React.Children.toArray(r.props.children);
            const cell = cells[c];
            if (cell && !isCellEmpty(cell.props?.children)) {
              allEmpty = false;
              break;
            }
          }
        }
        if (allEmpty) hiddenColumns.add(c);
      }
    }
  }

  // Visible columns with numeric alignment flags
  const visibleHeaders = columns
    .map((col, idx) => ({ col, idx, isNumeric: NUMERIC_HEADER_REGEX.test(col) }))
    .filter(({ idx }) => !hiddenColumns.has(idx));

  return (
    <div className="orac-data-table overflow-hidden rounded-lg border border-gray-100 bg-white" style={{ fontSize: "var(--orac-table-font-size, 14px)" }}>
      {(title || action) && (
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-50 bg-gray-50/30 px-5 py-4">
          {title && (
            <h3 className="flex items-center gap-2 text-base font-semibold text-gray-900">
              {title}
              {count !== undefined && (
                <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-semibold text-gray-600">{count}</span>
              )}
            </h3>
          )}
          {action && <div>{action}</div>}
        </div>
      )}
      {/* Optional filter/search row — a caller passes its own inputs here so
          filtering logic stays with the page/role that owns the data, this
          component only provides a consistent bar to put it in. */}
      {toolbar && (
        <div className="flex flex-wrap items-center gap-3 border-b border-gray-50 bg-white px-5 py-3">
          {toolbar}
        </div>
      )}
      {rows.length === 0 ? (
        <div data-evidence="table-empty-state" className={emptyStateClassName}>
          <div className="h-10 w-10 rounded-full bg-gray-50 flex items-center justify-center text-orac-border-strong mb-3">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" /></svg>
          </div>
          <p className="text-sm text-gray-500 font-medium">{emptyText}</p>
        </div>
      ) : (
        <div
          className="orac-table-scroll overflow-x-auto"
          role="region"
          aria-label={title ? `${title} table` : "Data table"}
          tabIndex={0}
        >
          <table className="w-full text-sm">
            <thead className="sticky top-0 z-10 bg-gray-50/50">
              <tr className="border-b border-gray-100 text-left text-sm font-semibold text-gray-600">
                {visibleHeaders.map(({ col, idx, isNumeric }, i) => (
                  <th key={i} scope="col" className={`px-5 py-3.5 whitespace-nowrap ${isNumeric ? "text-right" : ""}`}>
                    {col}
                  </th>
                ))}
                {renderActions && <th scope="col" className="px-5 py-3.5 whitespace-nowrap">{actionLabel}</th>}
              </tr>
            </thead>
            {/* Zebra striping on even rows is a scanning aid for dense operational
                tables (Cloudscape/USWDS table guidance); it is layered on top of
                whatever hover/selection classes each row already sets. */}
            <tbody className="bg-white [&>tr:not(:first-child)]:border-t [&>tr:not(:first-child)]:border-orac-border-default [&>tr:nth-child(even)]:bg-orac-surface-muted">
              {rawRows.map((r, rowIdx) => {
                if (!React.isValidElement(r)) return r;

                const originalCells = React.Children.toArray(r.props.children);

                // Check if this row has colSpan (e.g. subheadings, summary row)
                const hasColSpan = originalCells.some(
                  (c) => React.isValidElement(c) && Number(c.props?.colSpan) > 1
                );
                if (hasColSpan) {
                  // Colspan rows remain structurally untouched to preserve spanning layout
                  return r;
                }

                let visibleIdx = 0;
                const visibleCells = [];

                for (let c = 0; c < originalCells.length; c++) {
                  if (hiddenColumns.has(c)) continue;

                  const cell = originalCells[c];
                  if (!React.isValidElement(cell)) {
                    visibleCells.push(cell);
                    visibleIdx++;
                    continue;
                  }

                  const headerInfo = visibleHeaders[visibleIdx];
                  const isNumeric = headerInfo?.isNumeric;
                  const originalClassName = cell.props?.className || "";

                  // Apply numeric alignment and tabular numbers consistently,
                  // whether columns were hidden or not, without overriding explicit classes.
                  const hasExplicitAlign = /\btext-(left|right|center|justify)\b/.test(originalClassName);
                  const alignmentClass = isNumeric && !hasExplicitAlign ? " text-right" : "";
                  const tabularClass = isNumeric && !originalClassName.includes("tabular-nums")
                    ? " [font-variant-numeric:tabular-nums]"
                    : "";
                  const combinedClass = `${originalClassName}${alignmentClass}${tabularClass}`.trim();

                  visibleCells.push(
                    React.cloneElement(cell, {
                      key: cell.key || `cell-${rowIdx}-${visibleIdx}`,
                      "data-label": cell.props?.["data-label"] || headerInfo?.col || "",
                      className: combinedClass,
                    })
                  );
                  visibleIdx++;
                }

                return React.cloneElement(r, {
                  key: r.key || `row-${rowIdx}`,
                  children: renderActions
                    ? [...visibleCells, <td key="row-action" data-label={actionLabel} className="px-5 py-3.5">{renderActions(rows[rowIdx], rowIdx)}</td>]
                    : visibleCells,
                });
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
