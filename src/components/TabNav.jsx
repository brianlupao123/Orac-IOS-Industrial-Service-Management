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
      data-ux="tab-nav"
      className="orac-tab-nav flex w-full gap-1 overflow-x-auto border-b border-orac-border-default shadow-[inset_6px_0_6px_-6px_rgba(15,23,42,0.12),inset_-6px_0_6px_-6px_rgba(15,23,42,0.12)]"
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
            className={`orac-control min-h-[44px] whitespace-nowrap px-4 py-2.5 text-ux-body font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-orac-focus-ring ${
              selected
                ? "border-b-[3px] border-orac-accent text-orac-primary-text"
                : "border-b-[3px] border-transparent text-orac-text-secondary hover:text-orac-text-primary"
            }`}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}
