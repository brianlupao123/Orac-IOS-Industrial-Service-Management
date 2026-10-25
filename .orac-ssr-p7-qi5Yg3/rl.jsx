
    import React from "react";
    import { renderToStaticMarkup } from "react-dom/server";
    import { MemoryRouter } from "react-router-dom";
    import RecordLink from "D:\\Projects\\ORAC-WORKSPACE\\2-portal-frontend\\orac-ios-frontend\\src\\components\\RecordLink.jsx";
    const r = (role, props) => renderToStaticMarkup(<MemoryRouter><RecordLink user={{ role }} {...props} /></MemoryRouter>);
    export const admin = r("Admin", { path: "/quotations", param: "quote", id: "q-1", what: "quote", name: "Q-1001" });
    export const finance = r("Finance", { path: "/quotations", param: "quote", id: "q-1", what: "quote", name: "Q-1001" });
    export const financePo = r("Finance", { path: "/finance", param: "po", id: "po-9", what: "purchase order", name: "PO-77" });
    export const jobCard = r("Management", { path: "/job-cards", param: "id", id: "job-1", what: "job card", name: "JOB-1" });
    export const invoiceReadiness = r("Finance", { path: "/invoice-readiness", param: "id", id: "job-1", what: "invoice readiness", name: "JOB-1" });
    export const tech = r("Technician", { path: "/finance", param: "po", id: "po-9", what: "purchase order", name: "PO-77" });
    export const noId = r("Admin", { path: "/quotations", param: "quote", id: "", what: "quote", name: "x" });
  