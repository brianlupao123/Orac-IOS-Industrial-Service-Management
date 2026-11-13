import React from "react";
import BrandMark from "./BrandMark.jsx";

/**
 * Full-screen photo backdrop with one centred card, used by every signed-out
 * account page (sign in, request access, password recovery, authenticator setup).
 * The photo is Orac's own plant image; a navy overlay keeps the card the focus.
 */
export default function AuthShell({ tag, maxWidth = "max-w-[460px]", children }) {
  return (
    <div className="orac-auth-bg min-h-screen font-sans text-orac-text-primary">
      <div className="orac-auth-overlay" aria-hidden="true" />
      <div className="relative z-10 flex min-h-screen flex-col items-center justify-center gap-5 px-4 py-10">
        <div className={`orac-auth-card w-full ${maxWidth}`}>
          <div className="mb-6 flex flex-col items-center text-center">
            <BrandMark size={64} />
            <div className="mt-3 text-ux-section font-extrabold tracking-wide text-orac-text-primary">ORAC SYSTEMS</div>
            {tag && <div className="text-ux-secondary font-semibold uppercase tracking-wider text-orac-accent">{tag}</div>}
          </div>
          {children}
        </div>
        <a href="/" className="orac-auth-back">&larr; Back to Orac-IOS home</a>
      </div>
    </div>
  );
}
