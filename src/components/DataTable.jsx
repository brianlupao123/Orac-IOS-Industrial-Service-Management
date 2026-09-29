import React from "react";

export default function DataTable({ title, count, columns, rows, renderRow, emptyText = "No data", action, toolbar }) {
  return (
    <div className="overflow-hidden rounded-lg border border-gray-100 bg-white shadow-sm">
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
        <div data-evidence="table-empty-state" className="px-5 py-12 flex flex-col items-center justify-center text-center">
          <div className="h-10 w-10 rounded-full bg-gray-50 flex items-center justify-center text-gray-400 mb-3">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" /></svg>
          </div>
          <p className="text-sm text-gray-500 font-medium">{emptyText}</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50/50">
              <tr className="border-b border-gray-100 text-left text-sm font-semibold text-gray-600">
                {columns.map((col, i) => (
                  <th key={i} scope="col" className="px-5 py-3.5 whitespace-nowrap">{col}</th>
                ))}
              </tr>
            </thead>
            {/* Zebra striping on even rows is a scanning aid for dense operational
                tables (Cloudscape/USWDS table guidance); it is layered on top of
                whatever hover/selection classes each row already sets. */}
            <tbody className="bg-white [&>tr:not(:first-child)]:border-t [&>tr:not(:first-child)]:border-orac-border-default [&>tr:nth-child(even)]:bg-orac-surface-muted">
              {rows.map((row, i) => renderRow(row, i))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
