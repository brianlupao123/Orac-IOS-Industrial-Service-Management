/** @type {import("tailwindcss").Config} */
export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        orac: {
          navy: "#00488C",
          cyan: "#2FA2E3",
          dark: "#0B0F19",
          blue: "#00488C",
          gear: "#2FA2E3",
          slate: "#00488C",
          ink: "#0B0F19",
          // Semantic, theme-aware tokens (see src/index.css for values in
          // each theme). Prefer these over the fixed brand shades above,
          // and over raw gray/slate/status Tailwind colors, in any new or
          // edited JSX (Chats 2-5) so pages no longer depend on the
          // dark-mode override bridge. Fixed brand shades above are kept
          // only for existing usages already covered by that bridge.
          canvas: "var(--orac-canvas)",
          page: "var(--orac-page)",
          surface: "var(--orac-surface)",
          "surface-subtle": "var(--orac-surface-subtle)",
          "surface-muted": "var(--orac-surface-muted)",
          "row-hover": "var(--orac-row-hover)",
          "row-alt": "var(--orac-row-alt)",
          "text-primary": "var(--orac-text-primary)",
          "text-secondary": "var(--orac-text-secondary)",
          "text-muted": "var(--orac-text-muted)",
          "border-default": "var(--orac-border)",
          "border-strong": "var(--orac-border-strong)",
          accent: "var(--orac-accent)",
          "accent-strong": "var(--orac-accent-strong)",
          "focus-ring": "var(--orac-focus-ring)",
          "success-text": "var(--orac-success-text)",
          "success-bg": "var(--orac-success-bg)",
          "success-border": "var(--orac-success-border)",
          "danger-text": "var(--orac-danger-text)",
          "danger-bg": "var(--orac-danger-bg)",
          "danger-border": "var(--orac-danger-border)",
          "warning-text": "var(--orac-warning-text)",
          "warning-bg": "var(--orac-warning-bg)",
          "warning-border": "var(--orac-warning-border)",
          "info-text": "var(--orac-info-text)",
          "info-bg": "var(--orac-info-bg)",
          "info-border": "var(--orac-info-border)"
        }
      }
    }
  },
  plugins: []
};
