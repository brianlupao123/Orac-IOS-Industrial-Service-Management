import React from "react";

const SIZES = {
  40: "w-10 h-10",
  44: "w-11 h-11",
  48: "w-12 h-12",
  64: "w-16 h-16",
  80: "w-20 h-20",
};

export default function BrandMark({
  size = 40,
  alt = "Orac Systems",
  className = "",
  ...props
}) {
  const sizeClass = SIZES[size] || "w-10 h-10";

  return (
    <div
      data-ux="brandmark"
      className={`inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-white shadow-sm ${sizeClass} ${className}`.trim()}
      {...props}
    >
      <img
        src="/images/orac-systems-logo.png"
        alt={alt}
        width={size}
        height={size}
        className="h-full w-full object-contain p-1"
      />
    </div>
  );
}
