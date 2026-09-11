import React, { useEffect, useMemo, useRef, useState } from "react";

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
  disabled = false
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const containerRef = useRef(null);

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
        type="button"
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between rounded border border-gray-300 px-3 py-2 text-sm bg-white disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <span className={selected ? "text-orac-slate" : "text-gray-400"}>
          {selected ? selected.label : placeholder}
        </span>
        <span className="text-gray-400 text-xs">▾</span>
      </button>

      {open && (
        <div className="absolute z-20 mt-1 w-full rounded border border-gray-200 bg-white shadow-lg">
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Type to filter..."
            className="w-full border-b border-gray-100 px-3 py-2 text-sm outline-none"
          />
          <div className="max-h-56 overflow-y-auto">
            {filtered.length === 0 && (
              <p className="px-3 py-2 text-sm text-gray-400">{emptyLabel}</p>
            )}
            {filtered.map((o) => (
              <button
                key={o.value}
                type="button"
                onClick={() => {
                  onChange(o.value);
                  setOpen(false);
                  setQuery("");
                }}
                className={`block w-full text-left px-3 py-2 text-sm hover:bg-gray-50 ${
                  o.value === value ? "bg-orac-blue/10 text-orac-slate font-medium" : "text-gray-700"
                }`}
              >
                {o.label}
                {o.hint && <span className="block text-xs text-gray-400">{o.hint}</span>}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
