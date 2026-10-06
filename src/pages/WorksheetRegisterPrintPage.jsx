import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { openDocument } from "../api/client.js";
import { displayCells, groupRows, formatDateShort, formatDateFull, formatTotal, statusLabel, SUB_LABEL, sourceRows, sourceLabel } from "../lib/worksheetRegisterLogic.js";

// Landscape A3 print of the Worksheet (the monthly register), modelled on the supplied Excel layout.
// Hours only: no money columns, because no controlled rate source exists yet. The last page lists every
// source record id so the printed register can be traced back to the signed Timesheets.
const STYLES = `
*{box-sizing:border-box} body{margin:0;font-family:Calibri,Carlito,Arial,sans-serif;color:#1c1c1c}
.wk-bar{display:flex;gap:8px;align-items:center;padding:8px 14px;border-bottom:1px solid #ccd3dc;background:#fff}
.wk-bar button{font:inherit;padding:5px 14px;border:1px solid #98a4b3;background:#f6f8fa;border-radius:4px;cursor:pointer}
.wk-page{padding:10mm} .wk-page h1{margin:0 0 2mm;font-size:14pt} .wk-meta{font-size:9pt;margin-bottom:4mm;color:#333}
table.wk{border-collapse:collapse;font-size:7pt;width:100%}
table.wk th,table.wk td{border:1px solid #6f7f93;padding:1px 2px;text-align:center;height:5mm}
table.wk th{background:#f2f4f7;font-weight:700} table.wk td.name,table.wk th.name{text-align:left;white-space:nowrap;min-width:34mm}
table.wk tr.grp td{background:#e8edf3;font-weight:700;text-align:left} table.wk tr.tot td{background:#f2f4f7;font-weight:700} table.wk th.off{background:#fff3d6}
.wk-sign{display:grid;grid-template-columns:1fr 1fr 1fr;gap:12mm;margin-top:10mm;font-size:9pt} .wk-sign div{border-top:1px dotted #333;padding-top:2px}
.wk-note{margin-top:5mm;font-size:8pt;color:#555} .wk-src{margin-top:8mm;font-size:7pt;page-break-before:always} .wk-src table{border-collapse:collapse} .wk-src td,.wk-src th{border:1px solid #999;padding:1px 4px;text-align:left}
@page{size:A3 landscape;margin:8mm} @media print{.wk-bar{display:none}}
`;

export default function WorksheetRegisterPrintPage() {
  const { id } = useParams();
  const [data, setData] = useState(null); const [error, setError] = useState("");
  useEffect(() => { openDocument("worksheet_registers", id).then(setData).catch((e) => setError(e.message)); }, [id]);
  const record = data?.record; const company = data?.company_profile;
  if (error) return <div style={{ padding: 20 }}>{error}</div>;
  if (!record) return <div style={{ padding: 20 }}>Loading...</div>;
  const dates = record.grid.dates; const totals = record.grid.totals;
  const nameOf = (k) => record.roster.find((r) => r.key === k)?.display_name || k;
  return (
    <>
      <style>{STYLES}</style>
      <div className="wk-bar"><button onClick={() => window.print()}>Print</button><span>{record.reference} · {statusLabel(record.status)}</span></div>
      <div className="wk-page">
        <h1>{record.title}</h1>
        <div className="wk-meta">{company?.legal_name || company?.company_name || ""} · {record.client_name} / {record.scope.project_title} · Period {formatDateFull(record.period.start)} to {formatDateFull(record.period.end)} · {record.reference} · {statusLabel(record.status)}</div>
        <table className="wk">
          <thead>
            <tr><th rowSpan={2} className="name">Employee</th>{dates.map((d) => <th key={d.date} colSpan={2} className={d.day_type !== "weekday" ? "off" : ""}>{d.weekday}<br />{formatDateShort(d.date)}</th>)}<th colSpan={4}>Total hours</th><th rowSpan={2}>Carry-over</th></tr>
            <tr>{dates.map((d) => displayCells(d, null).cells.map((c) => <th key={`${d.date}${c.bucket}`}>{SUB_LABEL[c.bucket]}</th>))}<th>N</th><th>1.5</th><th>2.0</th><th>All</th></tr>
          </thead>
          <tbody>
            {groupRows(record.grid.rows).map((g) => (
              <React.Fragment key={g.group || "_"}>
                {g.group && <tr className="grp"><td colSpan={dates.length * 2 + 6}>{g.group}</td></tr>}
                {g.rows.map((r) => (
                  <tr key={r.roster_key}>
                    <td className="name">{r.display_name}</td>
                    {dates.map((d) => { const v = displayCells(d, r.cells[d.date]); return v.cells.map((c, i) => <td key={`${d.date}${c.bucket}`}>{c.text}{i === 1 ? v.hidden.map((h) => ` ${SUB_LABEL[h.bucket]}:${h.text}`).join("") : ""}</td>); })}
                    <td>{formatTotal(r.totals.normal)}</td><td>{formatTotal(r.totals.ot_15)}</td><td>{formatTotal(r.totals.ot_20)}</td><td><b>{formatTotal(r.totals.total_hours)}</b></td>
                    <td>{r.carry_over ? formatTotal(r.carry_over.normal + r.carry_over.ot_15 + r.carry_over.ot_20) : ""}</td>
                  </tr>
                ))}
              </React.Fragment>
            ))}
            <tr className="tot"><td className="name">Total hours</td>{dates.map((d) => displayCells(d, totals.by_date[d.date]).cells.map((c) => <td key={`${d.date}${c.bucket}`}>{c.text}</td>))}<td>{formatTotal(totals.grand.normal)}</td><td>{formatTotal(totals.grand.ot_15)}</td><td>{formatTotal(totals.grand.ot_20)}</td><td>{formatTotal(totals.grand.total_hours)}</td><td>{formatTotal(totals.carry_over.total_hours)}</td></tr>
          </tbody>
        </table>
        <div className="wk-sign"><div>Generated by: {record.built_by_name || ""}</div><div>Submitted by: {record.submitted_by_name || ""}</div><div>Approved by: {record.approved_by_name || ""}{record.approved_at ? ` · ${formatDateFull(record.approved_at.slice(0, 10))}` : ""}</div></div>
        <div className="wk-note">Generated from approved Timesheets; no hours were entered by hand. Hours only; no amounts are shown. Open exceptions at print time: {record.exception_counts.blocking} must fix, {record.exception_counts.warning_unacknowledged} unacknowledged.</div>
        <div className="wk-src">
          <b>Source records</b>
          <table><thead><tr><th>Employee</th><th>Date</th><th>Source</th><th>Record id</th></tr></thead>
            <tbody>{sourceRows(record.lines).map((s) => <tr key={`${s.roster_key}${s.date}${s.record_id}${s.row_index}`}><td>{nameOf(s.roster_key)}</td><td>{s.date}{s.carry_over ? " (carry-over)" : ""}</td><td>{sourceLabel(s.source_type)}</td><td>{s.record_id}</td></tr>)}</tbody></table>
        </div>
      </div>
    </>
  );
}
