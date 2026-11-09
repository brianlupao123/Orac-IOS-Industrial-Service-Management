import React from "react";

const BASE_STYLES =
  "border-2 font-bold text-ux-label transition-colors " +
  "focus:outline-none focus-visible:ring-2 focus-visible:ring-orac-focus-ring focus-visible:ring-offset-2 " +
  "active:translate-y-[1px] disabled:opacity-50 disabled:cursor-not-allowed";

const VARIANTS = {
  primary:
    "border-orac-accent-strong bg-orac-accent-strong text-white shadow-sm hover:brightness-95",
  secondary:
    "border-orac-accent bg-orac-surface text-orac-accent hover:bg-orac-surface-muted",
  danger:
    "border-orac-danger-text bg-orac-surface text-orac-danger-text hover:bg-orac-danger-bg",
  ghost:
    "border-transparent bg-transparent text-orac-accent hover:bg-orac-surface-muted hover:underline",
  link:
    "border-transparent bg-transparent text-orac-accent hover:underline px-2 min-h-[44px] min-[900px]:min-h-[32px] inline-flex items-center",
};

const SIZES = {
  md: "min-h-[44px] px-[22px] rounded-lg inline-flex items-center justify-center",
  sm: "min-h-[40px] px-4 rounded-lg inline-flex items-center justify-center",
};

const Button = React.forwardRef(function Button(
  {
    type = "button",
    variant = "secondary",
    size = "md",
    loading = false,
    disabled = false,
    className = "",
    children,
    ...props
  },
  ref
) {
  const isLink = variant === "link";
  const sizeClass = isLink ? "" : SIZES[size] || SIZES.md;
  const variantClass = VARIANTS[variant] || VARIANTS.secondary;

  return (
    <button
      ref={ref}
      type={type}
      data-ux="button"
      data-variant={variant}
      data-size={size}
      disabled={disabled || loading}
      aria-busy={loading ? "true" : undefined}
      className={`${BASE_STYLES} ${variantClass} ${sizeClass} ${className}`.trim()}
      {...props}
    >
      {loading && (
        <span
          aria-hidden="true"
          className="mr-2 h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-current border-r-transparent"
        />
      )}
      {children}
    </button>
  );
});

export default Button;
