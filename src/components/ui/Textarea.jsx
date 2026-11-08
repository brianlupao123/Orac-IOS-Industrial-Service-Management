import React from "react";
import { inputBaseClass } from "./Input.jsx";

const Textarea = React.forwardRef(function Textarea(
  { className = "", rows = 3, ...props },
  ref
) {
  return (
    <textarea
      ref={ref}
      rows={rows}
      data-ux="input"
      className={`${inputBaseClass} ${className}`.trim()}
      {...props}
    />
  );
});

export default Textarea;
