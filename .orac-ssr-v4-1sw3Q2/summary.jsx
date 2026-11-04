
    import React from "react";
    import { renderToStaticMarkup } from "react-dom/server";
    import StatusSummary from "D:\\Projects\\ORAC-WORKSPACE\\2-portal-frontend\\orac-ios-frontend\\src\\components\\StatusSummary.jsx";
    export const html = renderToStaticMarkup(
      <StatusSummary label="Quotes by stage" items={[
        { key: "a", label: "Approved Pending PO", meaning: "Client approved. Waiting for a purchase order.", count: 5, tone: "warning" },
        { key: "s", label: "Sent", meaning: "Sent to the client.", count: 1, tone: "info" },
        { key: "d", label: "Draft", count: 0 },
      ]} />);
    export const empty = renderToStaticMarkup(<StatusSummary items={[]} />);
  