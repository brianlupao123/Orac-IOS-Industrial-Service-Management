import React from "react";

export default function DataTable({ title, columns, rows, renderRow, emptyText = "No data", action }) {
  return (
    <div className="overflow-hidden rounded-lg border border-gray-100 bg-white shadow-sm">
      {(title || action) && (
        <div className="flex items-center justify-between border-b border-gray-50 bg-gray-50/30 px-5 py-4">
          {title && <h3 className="text-base font-semibold text-gray-900">{title}</h3>}
          {action && <div>{action}</div>}
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
                  <th key={i} className="px-5 py-3.5 whitespace-nowrap">{col}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 bg-white">
              {rows.map((row, i) => renderRow(row, i))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
