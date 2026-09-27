import React from "react";
import { Icon, ICONS } from "./icons.jsx";

export default function SessionExpiredBanner() {
  return <div data-evidence="session-expired-banner" className="flex gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-300"><span className="mt-0.5"><Icon path={ICONS.clock} /></span><div><p className="font-semibold">Your session has ended</p><p className="mt-1">Please sign in again to continue securely.</p></div></div>;
}
