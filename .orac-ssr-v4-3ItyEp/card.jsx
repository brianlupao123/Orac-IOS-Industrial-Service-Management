
    import React from "react";
    import { renderToStaticMarkup } from "react-dom/server";
    import IconStatCard from "D:\\Projects\\ORAC-WORKSPACE\\2-portal-frontend\\orac-ios-frontend\\src\\components\\IconStatCard.jsx";
    import { ICONS } from "D:\\Projects\\ORAC-WORKSPACE\\2-portal-frontend\\orac-ios-frontend\\src\\components\\icons.jsx";
    const base = { label: "Blocked Amendments", value: 3, iconPath: ICONS.warning, tone: "red", subtitle: "POs requiring amendment", evidenceTarget: "evidence-kpi-blocked-amendments", onClick: () => {} };
    export const first = renderToStaticMarkup(<IconStatCard {...base} statusFirst />);
    export const plain = renderToStaticMarkup(<IconStatCard {...base} />);
    export const zero = renderToStaticMarkup(<IconStatCard {...base} value={0} statusFirst />);
  