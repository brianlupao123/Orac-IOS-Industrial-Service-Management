import React from "react";

const SIZES = {
  md: "max-w-md",
  lg: "max-w-lg",
  xl: "max-w-2xl",
};

export default function Modal({ title, isOpen, onClose, children, size = "md" }) {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/40 backdrop-blur-sm p-4">
      <div className={`w-full ${SIZES[size] || SIZES.md} animate-in fade-in zoom-in duration-200 overflow-hidden rounded-xl bg-white shadow-2xl`}>
        <div className="flex items-center justify-between border-b border-gray-100 bg-gray-50/50 px-6 py-4">
          <h3 className="text-lg font-semibold text-orac-slate">{title}</h3>
          <button onClick={onClose} aria-label="Close dialog" className="rounded-md p-1 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-orac-blue/40">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
        <div className="max-h-[80vh] overflow-y-auto p-6">
          {children}
        </div>
      </div>
    </div>
  );
}
