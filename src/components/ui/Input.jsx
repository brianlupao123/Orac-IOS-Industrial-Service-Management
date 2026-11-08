import React from "react";

export const inputBaseClass =
  "w-full min-h-[44px] min-[900px]:min-h-[40px] px-3.5 py-2 rounded-lg " +
  "text-ux-body text-orac-text-primary placeholder:text-orac-text-muted " +
  "border border-orac-border-strong bg-orac-canvas transition-colors " +
  "focus:outline-none focus:border-orac-accent focus:ring-2 focus:ring-orac-focus-ring/30 " +
  "disabled:bg-orac-surface-muted disabled:opacity-70 disabled:cursor-not-allowed " +
  "aria-[invalid=true]:border-orac-danger-text";

const Input = React.forwardRef(function Input(
  { className = "", type = "text", ...props },
  ref
) {
  return (
    <input
      ref={ref}
      type={type}
      data-ux="input"
      className={`${inputBaseClass} ${className}`.trim()}
      {...props}
    />
  );
});

export default Input;
