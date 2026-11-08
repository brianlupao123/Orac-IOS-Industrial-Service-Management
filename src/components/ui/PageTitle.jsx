import React from "react";

export default function PageTitle({
  children,
  className = "",
  ...props
}) {
  return (
    <h1
      data-ux="page-title"
      className={`text-ux-title text-orac-text-primary ${className}`.trim()}
      {...props}
    >
      {children}
    </h1>
  );
}
