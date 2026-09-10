import React from "react";

/**
 * Reusable data table with header, optional action button, and empty state.
 * Adapted from feedback-ecosystem DashboardComp.jsx table card pattern.
 *
 * @param {object} props
 * @param {string} props.title - Table title
 * @param {string[]} props.columns - Column header labels
 * @param {Array<object>} props.rows - Data rows
 * @param {function} props.renderRow - (row, index) => <tr> element
 * @param {string} [props.emptyText] - Text when no rows
 * @param {React.ReactNode} [props.action] - Optional top-right action (button/link)
 */
export default function DataTable({ title, columns, rows, renderRow, emptyText = "No data", action }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white shadow-sm">
      {(title || action) && (
        <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
          {title && <h3 className="text-sm font-semibold text-orac-slate">{title}</h3>}
          {action && <div>{action}</div>}
        </div>
      )}
      {rows.length === 0 ? (
        <div className="px-4 py-8 text-center text-sm text-gray-400">{emptyText}</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-left text-xs font-medium uppercase tracking-wider text-gray-400">
                {columns.map((col, i) => (
                  <th key={i} className="px-4 py-2.5">{col}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {rows.map((row, i) => renderRow(row, i))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
