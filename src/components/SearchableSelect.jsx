import React, { useEffect, useId, useMemo, useRef, useState } from "react";

// One reusable searchable dropdown for the whole app. Use this instead of
// a plain <select> anywhere the option list is more than ~8 items or comes
// from live data (clients, catalog items, equipment tags, dispatch cards,
// users) so people can type to filter rather than scroll.
//
// options: [{ value, label, hint? }]
// This component only manages selection UI — it does not fetch data. Pass
// it whatever list you already loaded (e.g. from collections.list("clients")).
export default function SearchableSelect({
  options,
  value,
  onChange,
  placeholder = "Search...",
  emptyLabel = "No matches",
  disabled = false,
  id,
  ariaLabel = placeholder
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const containerRef = useRef(null);
  const generatedId = useId();
  const controlId = id || `searchable-select-${generatedId}`;
  const listboxId = `${controlId}-options`;

  const selected = options.find((o) => o.value === value);

  const filtered = useMemo(() => {
    if (!query.trim()) return options;
    const q = query.trim().toLowerCase();
    return options.filter(
      (o) => o.label.toLowerCase().includes(q) || (o.hint || "").toLowerCase().includes(q)
    );
  }, [options, query]);

  useEffect(() => {
    function handleClickOutside(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false);
        setQuery("");
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div ref={containerRef} className="relative">
      <button
        id={controlId}
        type="button"
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listboxId : undefined}
        className="orac-control min-h-11 w-full flex items-center justify-between rounded border border-gray-300 px-3 py-2 text-base font-medium bg-white disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <span className={selected ? "text-orac-slate" : "text-orac-border-strong"}>
          {selected ? selected.label : placeholder}
        </span>
        <span className="text-orac-border-strong text-xs">▾</span>
      </button>

      {open && (
        <div id={listboxId} role="listbox" aria-label={`${ariaLabel} options`} className="absolute z-20 mt-1 w-full rounded-lg border border-gray-200 bg-white shadow-lg">
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                e.stopPropagation();
                if (filtered.length > 0) {
                  onChange(filtered[0].value);
                  setOpen(false);
                  setQuery("");
                }
              } else if (e.key === "Escape") {
                e.preventDefault();
                setOpen(false);
                setQuery("");
              }
            }}
            placeholder="Type to filter..."
            aria-label={`Filter ${ariaLabel}`}
            className="orac-control w-full border-b border-gray-100 px-3 py-2 text-base outline-none"
          />
          <div className="max-h-56 overflow-y-auto">
            {filtered.length === 0 && (
              <p className="px-3 py-2 text-sm text-orac-text-muted">{emptyLabel}</p>
            )}
            {filtered.map((o) => (
              <button
                key={o.value}
                type="button"
                role="option"
                aria-selected={o.value === value}
                onClick={() => {
                  onChange(o.value);
                  setOpen(false);
                  setQuery("");
                }}
                className={`block w-full text-left px-3 py-3 text-base hover:bg-gray-50 ${
                  o.value === value ? "bg-orac-blue/10 text-orac-slate font-medium" : "text-gray-700"
                }`}
              >
                {o.label}
                {o.hint && <span className="block text-xs text-orac-text-muted">{o.hint}</span>}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
