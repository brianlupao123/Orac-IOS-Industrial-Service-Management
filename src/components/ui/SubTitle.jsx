import React from "react";

export default function SubTitle({
  children,
  className = "",
  ...props
}) {
  return (
    <h3
      data-ux="sub-title"
      className={`text-ux-sub text-orac-text-primary ${className}`.trim()}
      {...props}
    >
      {children}
    </h3>
  );
}
