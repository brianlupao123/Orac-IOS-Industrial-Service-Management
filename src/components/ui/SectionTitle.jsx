import React from "react";

export default function SectionTitle({
  children,
  className = "",
  ...props
}) {
  return (
    <h2
      data-ux="section-title"
      className={`text-ux-section text-orac-text-primary ${className}`.trim()}
      {...props}
    >
      {children}
    </h2>
  );
}
