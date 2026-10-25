
    import React from "react";
    import { renderToStaticMarkup } from "react-dom/server";
    import { KioskReviewRow } from "D:\\Projects\\ORAC-WORKSPACE\\2-portal-frontend\\orac-ios-frontend\\src\\components\\KioskReviewPanel.jsx";
    export default function render(row, role) { return renderToStaticMarkup(<ul><KioskReviewRow row={row} role={role} /></ul>); }
  