import React, { useEffect, useMemo, useState } from "react";
import { useParams, useSearchParams, useNavigate } from "react-router-dom";
import { openDocument } from "../api/client.js";
import { computeRowTotals, computeLogTotals } from "../lib/contractorLogLogic.js";

// Visual layout/CSS adapted directly from the supplied
// orac-contractors-log-sheet.html prototype.
const SHEET_STYLES = `
:root{--ink:#1c1c1c;--line:#5f6f84;--bg:#e9ecf0;--hand:#1a3a8a}
*{box-sizing:border-box}
body{margin:0}
.cls-bar{position:sticky;top:0;z-index:5;display:flex;gap:8px;flex-wrap:wrap;align-items:center;padding:10px 16px;background:#fff;border-bottom:1px solid #ccd3dc;font-size:14px;font-family:Calibri,Carlito,Arial,sans-serif}
.cls-bar button{font:inherit;padding:6px 14px;border:1px solid #98a4b3;background:#f6f8fa;border-radius:4px;cursor:pointer}
.cls-bar span{color:#566;margin-left:auto}
.cls-wrap{overflow-x:auto;padding:16px;background:var(--bg);font-family:Calibri,Carlito,Arial,sans-serif;color:var(--ink)}
.cls-sheet{width:297mm;min-height:210mm;margin:0 auto;background:#fff;padding:11mm 13mm 9mm;box-shadow:0 2px 10px rgba(0,0,0,.2);display:flex;flex-direction:column}
.cls-sheet h1{margin:0;text-align:center;font-size:15pt;font-weight:700;text-decoration:underline}
.cls-sheet h2{margin:1.5mm 0 5mm;text-align:center;font-size:10.5pt;font-weight:700}
.cls-grid{display:grid;grid-template-columns:1fr 1fr 1fr;column-gap:10mm}
.cls-f{display:flex;align-items:flex-end;margin-bottom:2.6mm;font-size:9.5pt;font-weight:700}
.cls-f.full{grid-column:1/-1}
.cls-f label{white-space:nowrap;margin-right:4px}
.cls-f .val{flex:1;min-width:0;border-bottom:1px dotted #333;font:11pt "Segoe Print","Bradley Hand",cursive;color:var(--hand);min-height:6mm;padding:0 4px}
.cls-table{width:100%;border-collapse:collapse;table-layout:fixed;border:1.2px solid var(--line);margin-top:1mm}
.cls-table th,.cls-table td{border:1px solid var(--line);padding:0;height:8mm}
.cls-table th{font-size:7.8pt;font-weight:700;text-align:center;padding:1px 2px;background:#fafbfc;height:11mm;line-height:1.1}
.cls-table th.l{text-align:left;padding-left:3px}
.cls-table td .val{width:100%;height:100%;display:flex;align-items:center;font:10pt "Segoe Print","Bradley Hand",cursive;color:var(--hand);padding:0 3px}
.cls-table td.c .val{justify-content:center}
.cls-table td.calc .val{font-weight:700;color:#222;font-family:Calibri,Carlito,Arial,sans-serif;background:#f7f8fa;justify-content:center}
.cls-tot td{background:#f1f3f6;font-weight:700;font-size:9.5pt}
.cls-tot td.lab{padding-left:4px}
.cls-foot{margin-top:auto;font-size:9.5pt}
.cls-fr{display:grid;grid-template-columns:auto 1fr auto 1fr auto 42mm;align-items:end;gap:0 3mm;margin-top:5mm}
.cls-fr b{font-weight:700}
.cls-fr .d{border-bottom:1px dotted #333;height:7mm;font:11pt "Segoe Print","Bradley Hand",cursive;color:var(--hand);display:flex;align-items:center;padding:0 4px}
@page{size:A4 landscape;margin:0}
@media print{.cls-bar{display:none}.cls-wrap{padding:0;overflow:visible;background:#fff}.cls-sheet{box-shadow:none;margin:0}}
`;

const ROW_COUNT = 12;

export default function ContractorLogPrintPage() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const blank = searchParams.get("blank") === "1";

  const [data, setData] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (blank) return;
    openDocument("contractor_log_sheets", id).then(setData).catch((err) => setError(err.message));
  }, [id, blank]);

  const record = data?.record || null;
  const rows = useMemo(() => {
    const source = blank ? [] : (record?.rows || []);
    const padded = source.slice(0, ROW_COUNT);
    while (padded.length < ROW_COUNT) padded.push(null);
    return padded;
  }, [record, blank]);

  const totals = blank ? null : (data?.totals || computeLogTotals(record?.rows || []));

  if (!blank && error) return <div className="p-6 text-red-700">{error}</div>;
  if (!blank && !data) return <div className="p-6 text-gray-500">Loading...</div>;

  const company = data?.company_profile || {};

  return (
    <>
      <style>{SHEET_STYLES}</style>
      <div className="cls-bar">
        <button onClick={() => navigate(-1)}>Back</button>
        <button onClick={() => window.print()}>Print form</button>
        <span>{blank ? "Blank form" : `Status: ${record?.status || ""}`}</span>
      </div>
      <div className="cls-wrap">
        <div className="cls-sheet">
          <h1>LOG SHEET</h1>
          <h2>CONTRACTORS WORK SPECIFICATION FORM{company.company_name ? ` — ${company.company_name}` : ""}</h2>

          <div className="cls-grid">
            <div className="cls-f"><label>Name of Contractor:</label><span className="val">{record?.contractor_name || ""}</span></div>
            <div className="cls-f"><label>Department:-</label><span className="val">{record?.department_section || ""}</span></div>
            <div className="cls-f"><label>Section:</label><span className="val">{record?.section || ""}</span></div>
            <div className="cls-f"><label>Order No.:</label><span className="val">{record?.order_no || ""}</span></div>
            <div className="cls-f"><label>Date:</label><span className="val">{record?.log_date || ""}</span></div>
            <div></div>
            <div className="cls-f full"><label>Work description:</label><span className="val">{record?.work_description || ""}</span></div>
          </div>

          <table className="cls-table">
            <colgroup>
              <col style={{ width: "19%" }} /><col style={{ width: "7%" }} /><col style={{ width: "8%" }} /><col style={{ width: "7%" }} />
              <col style={{ width: "8%" }} /><col style={{ width: "8%" }} /><col style={{ width: "8%" }} /><col style={{ width: "8%" }} /><col style={{ width: "8%" }} /><col style={{ width: "19%" }} />
            </colgroup>
            <thead>
              <tr>
                <th className="l">Name</th><th>Artisan</th><th>Assistant</th><th>Normal</th>
                <th>Overtime<br />1.5</th><th>Overtime<br />2.0</th><th>Total<br />Hours</th><th>Total OT<br />Hrs</th><th>Total<br />Hrs</th><th className="l">Comments</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => {
                const rowTotals = row ? computeRowTotals(row) : { total_hours: "", total_ot_hours: "", total_payable_hours: "" };
                return (
                  <tr key={i}>
                    <td className="l"><span className="val">{row?.worker_name || ""}</span></td>
                    <td className="c"><span className="val">{row?.grade === "Artisan" ? "\u2713" : ""}</span></td>
                    <td className="c"><span className="val">{row?.grade === "Assistant" ? "\u2713" : ""}</span></td>
                    <td className="c"><span className="val">{row?.normal ?? ""}</span></td>
                    <td className="c"><span className="val">{row?.ot_15 ?? ""}</span></td>
                    <td className="c"><span className="val">{row?.ot_20 ?? ""}</span></td>
                    <td className="calc"><span className="val">{rowTotals.total_hours ?? ""}</span></td>
                    <td className="calc"><span className="val">{rowTotals.total_ot_hours ?? ""}</span></td>
                    <td className="calc"><span className="val">{rowTotals.total_payable_hours ?? ""}</span></td>
                    <td className="l"><span className="val">{row?.comments || ""}</span></td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="cls-tot">
                <td className="lab" colSpan={3}>Total Hrs</td>
                <td className="c">{totals ? totals.normal || "" : ""}</td>
                <td className="c">{totals ? totals.ot_15 || "" : ""}</td>
                <td className="c">{totals ? totals.ot_20 || "" : ""}</td>
                <td className="c">{totals ? totals.total_hours || "" : ""}</td>
                <td className="c">{totals ? totals.total_ot_hours || "" : ""}</td>
                <td className="c">{totals ? totals.total_payable_hours || "" : ""}</td>
                <td></td>
              </tr>
            </tfoot>
          </table>

          <div className="cls-foot">
            <div className="cls-fr">
              <b>Supervisor's Name:</b><div className="d">{record?.signatures?.supervisor?.name || ""}</div>
              <b>Supervisor's Signature:</b><div className="d"></div>
              <b>Date:</b><div className="d">{record?.signatures?.supervisor?.date || ""}</div>
            </div>
            <div className="cls-fr">
              <b>Foreman's Name:</b><div className="d">{record?.signatures?.foreman?.name || ""}</div>
              <b>Foreman's Signature:</b><div className="d"></div>
              <b>Date:</b><div className="d">{record?.signatures?.foreman?.date || ""}</div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
