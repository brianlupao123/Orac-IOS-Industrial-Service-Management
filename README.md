# ORAC-IOS Frontend

**ORAC-IOS means Orac Industrial Operations System.** It is the React/Vite web client for Orac Systems' controlled industrial-service workflow:

`Lead -> Quote -> Purchase Order -> Dispatch -> Field Worksheet -> Invoice -> Pastel Export`

This repository owns portal UI, role navigation, branding, theme, and UAT screenshot tooling. The API, permissions, workflow transitions, financial rules, and data scope are owned by `C:\deploy-backend`.

## Start Here

1. Read [MAINTAINER_GUARDRAILS.md](MAINTAINER_GUARDRAILS.md).
2. Read [the backend handover](C:/deploy-backend/ORAC_IOS_SYSTEM_HANDOVER.md).
3. Run `npm run maintain` before every commit, push, deployment, or external-code integration.

## Commands

```powershell
npm ci
npm test
npm run build
npm run maintain
```

`npm run finalize:handover` captures real deployed role screenshots only when temporary `ORAC_<ROLE>_EMAIL` and `ORAC_<ROLE>_PASSWORD` variables are supplied. Credentials are never stored in the repository.

## Deployment and Evidence

- Render static-site build: `npm ci && npm run build`
- Publish directory: `dist`
- `VITE_API_BASE_URL` must be the HTTPS API URL ending in `/api`.
- Do not put passwords, JWT secrets, database URLs, or private keys in source, screenshots, or `VITE_*` values.
- A passing build is not live verification. A feature is live-verified only after Render confirms its commit and browser UAT records the actual role, action, result, and screenshot.
