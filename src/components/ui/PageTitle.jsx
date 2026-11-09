import React from "react";

export default function PageTitle({
  children,
  className = "",
  ...props
}) {
  return (
    <h1
      data-ux="page-title"
      className={`text-ux-title text-orac-accent ${className}`.trim()}
      {...props}
    >
      {children}
    </h1>
  );
}
