import React from "react";

export const ICONS = {
  building: "M4 21V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v16M2 21h20M8 7h2m-2 4h2m-2 4h2m4-8h2m-2 4h2m-2 4h2",
  clipboard: "M9 5h6m-5-2h4a2 2 0 0 1 2 2v1H8V5a2 2 0 0 1 2-2Zm-4 3h14a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-9a2 2 0 0 1 2-2Z",
  truck: "M3 6h11v10H3V6Zm11 4h4l3 3v3h-7v-6Zm-7 9a2 2 0 1 0 0-4 2 2 0 0 0 0 4Zm10 0a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z",
  money: "M12 3v18M16 7.5c0-1.4-1.8-2.5-4-2.5S8 6.1 8 7.5 9.8 10 12 10s4 1.1 4 2.5-1.8 2.5-4 2.5-4-1.1-4-2.5",
  users: "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2m17-8a4 4 0 0 0-3-6.9M10 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z",
  warning: "M12 3 2 21h20L12 3Zm0 6v4m0 4h.01",
  clock: "M12 7v5l3 2m6-2a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z",
  inventory: "M4 7h16v13H4V7Zm3-3h10v3H7V4Zm1 7h8m-8 4h5",
  report: "M5 3h10l4 4v14H5V3Zm10 0v5h5M9 12h6m-6 4h6",
  check: "m5 12 4 4L19 6",
  document: "M6 3h8l4 4v14H6V3Zm8 0v5h5M9 12h6m-6 4h6",
  dashboard: "M4 4h6v6H4V4Zm10 0h6v6h-6V4ZM4 14h6v6H4v-6Zm10 0h6v6h-6v-6Z"
};

export function Icon({ path, className = "h-5 w-5" }) {
  return <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d={path} /></svg>;
}
