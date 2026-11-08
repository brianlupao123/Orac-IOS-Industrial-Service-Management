import React from "react";

export default function Panel({
  header,
  children,
  className = "",
  ...props
}) {
  return (
    <div
      data-ux="panel"
      className={`rounded-xl border border-orac-border-default bg-orac-surface p-6 shadow ${className}`.trim()}
      {...props}
    >
      {header && (
        <div className="mb-4 border-b border-orac-border-default pb-3">
          {header}
        </div>
      )}
      {children}
    </div>
  );
}
