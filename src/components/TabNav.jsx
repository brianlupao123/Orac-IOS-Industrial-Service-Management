import React from "react";

/**
 * Accessible segmented tab navigation.
 *
 * Implements the WAI-ARIA Tabs pattern (role="tablist"/"tab"/"tabpanel",
 * aria-selected, roving tabIndex, Left/Right arrow-key movement) and is
 * styled as a compact segmented control rather than an underline strip, per
 * the operational-console benchmark:
 *   - Cloudscape Tabs: https://cloudscape.design/components/tabs
 *   - Cloudscape accessibility guidance (semantic markup + ARIA):
 *     https://cloudscape.design/foundation/core-principles/accessibility
 *   - USWDS typography (16px body, sentence case, no decorative caps):
 *     https://designsystem.digital.gov/components/typography/
 *
 * Shared across role pages so every tab strip in the app gets the same
 * accessible behaviour and visual treatment instead of a one-off per page.
 */
export default function TabNav({ tabs, activeId, onChange, label = "Sections" }) {
  function focusTab(id) {
    const el = document.getElementById(`tab-${id}`);
    if (el) el.focus();
  }

  function handleKeyDown(e, idx) {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft" && e.key !== "Home" && e.key !== "End") return;
    e.preventDefault();
    let nextIdx = idx;
    if (e.key === "ArrowRight") nextIdx = (idx + 1) % tabs.length;
    if (e.key === "ArrowLeft") nextIdx = (idx - 1 + tabs.length) % tabs.length;
    if (e.key === "Home") nextIdx = 0;
    if (e.key === "End") nextIdx = tabs.length - 1;
    const next = tabs[nextIdx];
    onChange(next.id);
    // Move focus after the DOM updates the selected tab.
    requestAnimationFrame(() => focusTab(next.id));
  }

  return (
    <div
      role="tablist"
      aria-label={label}
      className="flex w-full gap-1 overflow-x-auto rounded-lg border border-orac-border-default bg-orac-surface-muted p-1"
    >
      {tabs.map((tab, idx) => {
        const selected = tab.id === activeId;
        return (
          <button
            key={tab.id}
            id={`tab-${tab.id}`}
            role="tab"
            type="button"
            aria-selected={selected}
            aria-controls={`panel-${tab.id}`}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(tab.id)}
            onKeyDown={(e) => handleKeyDown(e, idx)}
            className={`orac-control whitespace-nowrap rounded-md px-4 text-base font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-orac-focus-ring ${
              selected
                ? "bg-orac-surface text-orac-accent shadow-sm ring-1 ring-orac-blue/40"
                : "text-orac-text-secondary hover:bg-orac-surface/70 hover:text-orac-text-primary"
            }`}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}
