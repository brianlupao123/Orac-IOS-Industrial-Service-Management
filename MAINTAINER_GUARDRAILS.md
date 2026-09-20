# ORAC-IOS Frontend Maintainer Guardrails

## Boundaries

- Do not replace server-side RBAC with frontend hiding.
- Do not create a second dashboard-summary query for the assistant.
- Do not put credentials, tokens, database URLs, or client data in source, screenshots, logs, or `VITE_*` variables.
- Do not claim a deployment, UAT result, or security control is verified without direct evidence.
- Keep **Field Worksheet** (field-work evidence) distinct from **Timesheet** (labour log).

## Brand and Theme

- Product name: **ORAC-IOS: Orac Industrial Operations System**.
- Brand navy: `#004088`; gear blue: `#3890D8`; dark surface: `#080838`.
- First visit loads light mode. Dark mode is only an explicit stored user preference.
- White text buttons use navy, not gear blue.
- Preserve `public/images/orac-systems-logo.png`.

## Required Checks

Run `npm run maintain` before committing. It runs tests, production build, whitespace checks, and guards the product name. For backend-affecting work, run `npm test` in `C:\deploy-backend` too.

## Ownership Map

| Area | Authority |
| --- | --- |
| UI, role navigation, theme, screenshot tooling | This repository |
| Routes, permissions, workflows, financial rules, data scope | `C:\deploy-backend` |
| Live acceptance evidence | `deliverables/final-uat/` and backend UAT log |
| Assistant workflow knowledge | Backend knowledge base and governance documents |
