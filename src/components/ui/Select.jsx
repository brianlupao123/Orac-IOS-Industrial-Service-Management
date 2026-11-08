import React from "react";
import { inputBaseClass } from "./Input.jsx";

const Select = React.forwardRef(function Select(
  { className = "", children, ...props },
  ref
) {
  return (
    <select
      ref={ref}
      data-ux="input"
      className={`${inputBaseClass} ${className}`.trim()}
      {...props}
    >
      {children}
    </select>
  );
});

export default Select;
