import React from "react";
import { Link } from "react-router-dom";
import { Icon, ICONS } from "../components/icons.jsx";

export default function AccessDeniedPage() {
  return (
    <section data-evidence="forbidden-state" className="mx-auto flex min-h-[50vh] max-w-xl flex-col items-center justify-center px-6 text-center">
      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-red-50 text-red-700"><Icon path={ICONS.warning} /></span>
      <h1 className="mt-5 text-xl font-semibold text-orac-slate">Access restricted</h1>
      <p className="mt-2 text-sm text-slate-600">Your role does not have access to this area. Return to your dashboard to continue with work in your permitted scope.</p>
      <Link to="/" className="mt-6 rounded-md bg-orac-navy px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800">Return to dashboard</Link>
    </section>
  );
}
