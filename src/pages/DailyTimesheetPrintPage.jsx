import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useParams, useSearchParams, useNavigate } from "react-router-dom";
import { openDocument } from "../api/client.js";
import { voidStartIndex } from "../lib/dailyTimesheetLogic.js";

// Visual layout, CSS and the void-row overlay logic below are adapted
// directly from the supplied orac-daily-timesheet.html prototype — treated
// as the authoritative reference per the feature brief — translated into a
// React component bound to a real saved record instead of free-typed inputs.
const SHEET_STYLES = `
:root{--ink:#1c1c1c;--line:#6f7f93;--rule:#8c9aab;--bg:#e9ecf0}
*{box-sizing:border-box}
body{margin:0}
.dts-bar{position:sticky;top:0;z-index:5;display:flex;gap:8px;flex-wrap:wrap;align-items:center;padding:10px 16px;background:#fff;border-bottom:1px solid #ccd3dc;font-size:14px;font-family:Calibri,Carlito,Arial,sans-serif}
.dts-bar button{font:inherit;padding:6px 14px;border:1px solid #98a4b3;background:#f6f8fa;border-radius:4px;cursor:pointer}
.dts-bar button:hover{background:#e8edf3}
.dts-bar span{color:#566;margin-left:auto}
.dts-wrap{overflow-x:auto;padding:16px;background:var(--bg);font-family:Calibri,Carlito,Arial,sans-serif;color:var(--ink)}
.dts-sheet{position:relative;width:210mm;min-height:297mm;margin:0 auto;background:#fff;padding:14mm 13mm 10mm;box-shadow:0 2px 10px rgba(0,0,0,.2);display:flex;flex-direction:column}
.dts-sheet h1{margin:0;text-align:center;font-size:13pt;font-weight:700;text-decoration:underline;letter-spacing:.2px}
.dts-addr{margin:9mm 0 0;text-align:center;font-size:9.5pt;font-weight:700}
.dts-title{margin:8mm 0 7mm;text-align:center;font-size:9.5pt;font-weight:700}
.dts-fields{width:62%}
.dts-f{display:flex;align-items:flex-end;margin-bottom:3.4mm;font-size:9.5pt;font-weight:700}
.dts-f label{white-space:nowrap;margin-right:4px}
.dts-f .val{flex:1;border-bottom:1px dotted #333;font:11pt "Segoe Print","Bradley Hand",cursive;color:#1a3a8a;padding:0 4px;min-height:6mm}
.dts-tbl{position:relative;margin-top:2mm}
.dts-tbl table{width:100%;border-collapse:collapse;table-layout:fixed;border:1.2px solid var(--line)}
.dts-tbl th,.dts-tbl td{border:1px solid var(--line);padding:0;height:6.6mm}
.dts-tbl th{font-size:8pt;font-weight:700;text-align:left;padding:0 3px;color:#2a3442;background:#fafbfc}
.dts-tbl th.c{text-align:center}
.dts-tbl td .val{width:100%;height:100%;display:flex;align-items:center;font:10pt "Segoe Print","Bradley Hand",cursive;color:#1a3a8a;padding:0 3px}
.dts-tbl td.c .val{justify-content:center}
.dts-void{position:absolute;pointer-events:none;display:none}
.dts-void svg{width:100%;height:100%;display:block}
.dts-void line{stroke:var(--line);stroke-width:1.2}
.dts-foot{margin-top:6mm;font-size:9.5pt}
.dts-foot h4{margin:0 0 3mm;font-size:9.5pt;text-decoration:underline;font-weight:700;display:inline-block}
.dts-row{display:grid;grid-template-columns:48mm 1fr 14mm 52mm;align-items:end;margin-bottom:4.5mm}
.dts-row b{font-weight:400;font-size:10.5pt;color:#444}
.dts-row i{font-style:normal;color:#444}
.dts-dots{border-bottom:1px dotted #333;height:7mm;margin:0 3mm 0 1mm;font:11pt "Segoe Print","Bradley Hand",cursive;color:#1a3a8a;display:flex;align-items:center;padding:0 4px}
.dts-note{margin-top:2mm;font-weight:700;font-size:9.5pt}
@page{size:A4 portrait;margin:0}
@media print{
  .dts-bar{display:none}
  .dts-wrap{padding:0;overflow:visible;background:#fff}
  .dts-sheet{box-shadow:none;margin:0;width:210mm}
}
`;

const ROW_COUNT = 24;
const COLS = ["date", "start_time", "end_time", "normal_hours", "ot_15", "ot_20", "description"];
const COL_CLASS = ["", "", "", "c", "c", "c", ""];

function fmtDate(iso) {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  return y && m && d ? `${d}/${m}/${y.slice(2)}` : iso;
}

function cellValue(row, col) {
  if (!row || row.kind === "separator") return col === "date" ? "\u2014" : (col === "description" ? "" : "\u2014");
  if (col === "date") return fmtDate(row.date);
  if (col === "ot_15" || col === "ot_20") return row[col] ?? "";
  return row[col] ?? "";
}

export default function DailyTimesheetPrintPage() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const blank = searchParams.get("blank") === "1";

  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const tblRef = useRef(null);
  const bodyRowRefs = useRef([]);
  const vLRef = useRef(null);
  const vRRef = useRef(null);

  useEffect(() => {
    if (blank) return; // nothing to fetch for a blank-form print
    openDocument("daily_timesheets", id).then(setData).catch((err) => setError(err.message));
  }, [id, blank]);

  const record = data?.record || null;
  const entries = useMemo(() => {
    const rows = blank ? [] : (record?.entries || []);
    const padded = rows.slice(0, ROW_COUNT);
    while (padded.length < ROW_COUNT) padded.push(null);
    return padded;
  }, [record, blank]);

  const voidFrom = blank ? ROW_COUNT : (data?.void_start_index ?? voidStartIndex(record?.entries || []));

  // Positions the two diagonal "void" strike overlays across the unused
  // trailing rows — ported from the prototype's placeVoid(), which measures
  // real DOM rects rather than computing row heights analytically, so a
  // changed row height (e.g. a two-line description) still lines up.
  useLayoutEffect(() => {
    const tbl = tblRef.current;
    const rows = bodyRowRefs.current;
    const vL = vLRef.current;
    const vR = vRRef.current;
    if (!tbl || !vL || !vR || voidFrom >= rows.length || !rows[voidFrom]) {
      if (vL) vL.style.display = "none";
      if (vR) vR.style.display = "none";
      return;
    }
    const tb = tbl.getBoundingClientRect();
    const first = rows[voidFrom].getBoundingClientRect();
    const last = rows[rows.length - 1].getBoundingClientRect();
    const cells = rows[voidFrom].cells || rows[voidFrom].querySelectorAll("td");
    const t = first.top - tb.top;
    const bottom = last.bottom - tb.top;
    const x0 = cells[0].getBoundingClientRect().left - tb.left;
    const x1 = cells[5].getBoundingClientRect().right - tb.left;
    const x2 = cells[6].getBoundingClientRect().left - tb.left;
    const x3 = cells[6].getBoundingClientRect().right - tb.left;
    const put = (el, l, r) => {
      el.style.display = "block";
      el.style.left = `${l}px`;
      el.style.width = `${r - l}px`;
      el.style.top = `${t}px`;
      el.style.height = `${bottom - t}px`;
    };
    put(vL, x0, x1);
    put(vR, x2, x3);
  }, [entries, voidFrom]);

  if (!blank && error) return <div className="p-6 text-red-700">{error}</div>;
  if (!blank && !data) return <div className="p-6 text-gray-500">Loading...</div>;

  const company = data?.company_profile || {};
  const technicianName = record?.name_on_form || data?.technician?.name || "";

  return (
    <>
      <style>{SHEET_STYLES}</style>
      <div className="dts-bar">
        <button onClick={() => navigate(-1)}>Back</button>
        <button onClick={() => window.print()}>Print form</button>
        <span>{blank ? "Blank form" : `Status: ${record?.status || ""}`}</span>
      </div>
      <div className="dts-wrap">
        <div className="dts-sheet">
          <h1>{company.company_name || "ORAC SYSTEMS PVT. LTD."}</h1>
          <p className="dts-addr">{company.address || "32E Kenmark Crescent, Bluffhill Industrial Park, Bluffhill, Harare"}</p>
          <p className="dts-title">DAILY TIME SHEET</p>

          <div className="dts-fields">
            <div className="dts-f"><label>NAME:</label><span className="val">{technicianName}</span></div>
            <div className="dts-f"><label>CATEGORY:</label><span className="val">{record?.category || ""}</span></div>
            <div className="dts-f"><label>DEPARTMENT/SECTION:-</label><span className="val">{record?.department_section || ""}</span></div>
            <div className="dts-f"><label>CELL NUMBER:</label><span className="val">{record?.cell_number || ""}</span></div>
          </div>

          <div className="dts-tbl" ref={tblRef}>
            <table>
              <colgroup>
                <col style={{ width: "13%" }} /><col style={{ width: "11.5%" }} /><col style={{ width: "10%" }} /><col style={{ width: "10%" }} />
                <col style={{ width: "4%" }} /><col style={{ width: "4%" }} /><col style={{ width: "47.5%" }} />
              </colgroup>
              <thead>
                <tr>
                  <th>Date</th><th>Start time</th><th>End time</th><th>Normal</th>
                  <th className="c">1.5</th><th className="c">2.0</th><th>Description of jobs carried out</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((row, i) => (
                  <tr key={i} ref={(el) => { bodyRowRefs.current[i] = el; }}>
                    {COLS.map((col, c) => (
                      <td key={col} className={COL_CLASS[c]}>
                        <span className="val">{cellValue(row, col)}</span>
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="dts-void" ref={vLRef}><svg preserveAspectRatio="none" viewBox="0 0 100 100"><line x1="0" y1="100" x2="100" y2="0" /></svg></div>
            <div className="dts-void" ref={vRRef}><svg preserveAspectRatio="none" viewBox="0 0 100 100"><line x1="0" y1="100" x2="100" y2="0" /></svg></div>
          </div>

          <div className="dts-foot">
            <h4>FOR ORAC SYSTEMS PVT. LTD.</h4>
            <div className="dts-row">
              <b>Employee</b>
              <div style={{ display: "flex", alignItems: "end" }}><i>Sign</i><div className="dts-dots" style={{ flex: 1 }}>{record?.signatures?.employee?.name || ""}</div></div>
              <i style={{ textAlign: "right" }}>Date</i><div className="dts-dots">{record?.signatures?.employee?.date || ""}</div>
            </div>
            <div className="dts-row">
              <b>Site Foreman</b>
              <div style={{ display: "flex", alignItems: "end" }}><i>Sign</i><div className="dts-dots" style={{ flex: 1 }}>{record?.signatures?.site_foreman?.name || ""}</div></div>
              <i style={{ textAlign: "right" }}>Date</i><div className="dts-dots">{record?.signatures?.site_foreman?.date || ""}</div>
            </div>
            <h4 style={{ marginTop: "2mm" }}>FOR CUSTOMER</h4>
            <div className="dts-row">
              <b>Customer representative</b>
              <div style={{ display: "flex", alignItems: "end" }}><i>Sign</i><div className="dts-dots" style={{ flex: 1 }}>{record?.signatures?.customer_representative?.name || ""}</div></div>
              <i style={{ textAlign: "right" }}>Date</i><div className="dts-dots">{record?.signatures?.customer_representative?.date || ""}</div>
            </div>
            <div className="dts-note">Please note: Customer retains a signed copy of his worksheet</div>
          </div>
        </div>
      </div>
    </>
  );
}
