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
  density = "normal",
  compact = false,
}) {
  const isCompact = compact || density === "compact";
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
    <div
      data-ux="table"
      className="orac-data-table overflow-hidden rounded-lg border border-orac-border-default bg-orac-surface"
      style={{ fontSize: isCompact ? "var(--orac-table-font-size-compact, 14px)" : "var(--orac-table-font-size, 16px)" }}
    >
      {(title || action) && (
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-orac-border-default bg-orac-surface-subtle px-5 py-4">
          {title && (
            <h3 className="flex items-center gap-2 text-ux-section text-orac-text-primary">
              {title}
              {count !== undefined && (
                <span className="rounded-full bg-orac-surface-muted px-2 py-0.5 text-xs font-semibold text-orac-text-secondary">{count}</span>
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
        <div className="flex flex-wrap items-center gap-3 border-b border-orac-border-default bg-orac-surface px-5 py-3">
          {toolbar}
        </div>
      )}
      {rows.length === 0 ? (
        <div data-evidence="table-empty-state" className={emptyStateClassName}>
          <div className="h-10 w-10 rounded-full bg-orac-surface-muted flex items-center justify-center text-orac-border-strong mb-3">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" /></svg>
          </div>
          <p className="text-sm text-orac-text-muted font-medium">{emptyText}</p>
        </div>
      ) : (
        <div
          className="orac-table-scroll overflow-x-auto shadow-[inset_6px_0_6px_-6px_rgba(15,23,42,0.12),inset_-6px_0_6px_-6px_rgba(15,23,42,0.12)]"
          role="region"
          aria-label={title ? `${title} table` : "Data table"}
          tabIndex={0}
        >
          <table className={`w-full max-sm:block sm:table ${isCompact ? "text-sm" : "text-base"}`}>
            <thead className="sticky top-0 z-10 bg-orac-surface-muted max-sm:sr-only sm:table-header-group">
              <tr className="border-b border-orac-border-default text-left text-ux-secondary font-semibold text-orac-text-secondary">
                {visibleHeaders.map(({ col, idx, isNumeric }, i) => (
                  <th key={i} scope="col" className={`px-6 py-3 whitespace-nowrap ${isNumeric ? "text-right" : ""}`}>
                    {col}
                  </th>
                ))}
                {renderActions && <th scope="col" className="px-6 py-3 whitespace-nowrap">{actionLabel}</th>}
              </tr>
            </thead>
            {/* White rows with a 1px border; hover tint row scanning aid; no zebra striping (matches mock). */}
            <tbody className="bg-orac-surface max-sm:block sm:table-row-group sm:[&>tr:not(:first-child)]:border-t sm:[&>tr:not(:first-child)]:border-orac-border-default [&>tr:hover]:bg-orac-row-hover">
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
                  const col0Class = visibleIdx === 0 ? " max-sm:whitespace-nowrap" : "";
                  const mobileCellClass = " max-sm:block max-sm:w-full max-sm:py-1 max-sm:px-0";
                  const combinedClass = `${originalClassName}${alignmentClass}${tabularClass}${col0Class}${mobileCellClass}`.trim();

                  visibleCells.push(
                    React.cloneElement(cell, {
                      key: cell.key || `cell-${rowIdx}-${visibleIdx}`,
                      "data-label": cell.props?.["data-label"] || headerInfo?.col || "",
                      className: combinedClass,
                    })
                  );
                  visibleIdx++;
                }

                const origRowClass = r.props?.className || "";
                const isDangerRow = /\b(bg-red|danger|is-danger)\b/.test(origRowClass);
                const dangerRowClass = isDangerRow
                  ? " !bg-orac-danger-bg shadow-[inset_3px_0_0_var(--orac-danger-border)]"
                  : "";
                const combinedRowClass = `${origRowClass}${dangerRowClass} max-sm:block max-sm:border-b max-sm:border-orac-border-default max-sm:p-4`.trim();

                return React.cloneElement(r, {
                  key: r.key || `row-${rowIdx}`,
                  className: combinedRowClass,
                  children: renderActions
                    ? [...visibleCells, <td key="row-action" data-label={actionLabel} className="px-6 py-3 whitespace-nowrap min-h-[44px] sm:min-h-0 max-sm:block max-sm:w-full max-sm:py-1 max-sm:px-0">{renderActions(rows[rowIdx], rowIdx)}</td>]
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
