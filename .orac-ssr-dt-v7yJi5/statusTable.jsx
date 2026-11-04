
    import React from "react";
    import { renderToStaticMarkup } from "react-dom/server";
    import DataTable from "D:\\Projects\\ORAC-WORKSPACE\\2-portal-frontend\\orac-ios-frontend\\src\\components\\DataTable.jsx";
    import StatusBadge from "D:\\Projects\\ORAC-WORKSPACE\\2-portal-frontend\\orac-ios-frontend\\src\\components\\StatusBadge.jsx";

    export default function render() {
      const columns = ["ID", "Status", "Notes"];
      const rows = [
        { id: "101", status: "Approved_Pending_PO", notes: "First row" },
        { id: "102", status: "In_Progress", notes: "Second row" },
      ];
      return renderToStaticMarkup(
        <DataTable
          title="Status Test"
          columns={columns}
          rows={rows}
          hideEmptyColumns={true}
          renderRow={(r) => (
            <tr key={r.id}>
              <td>{r.id}</td>
              <td><StatusBadge status={r.status} /></td>
              <td>{r.notes}</td>
            </tr>
          )}
        />
      );
    }
  