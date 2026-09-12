# Orac-IOS Named-Capability Verification Report

Date: 2026-09-12

This report applies the named-capability checklist to current source and
current automated checks. `VERIFIED` means the evidence listed below was
observed. Runtime items requiring Render, Neon, or a role-by-role browser
session remain `NOT VERIFIED` until that evidence exists.

## Evidence Snapshot

- Frontend repository: `brianlupao123/Orac-IOS-Industrial-Service-Management`
- Frontend latest pushed commit: `b2a4bed` (the last functional security
  change is `bcb0c7e`; `b2a4bed` adds this evidence report).
- Backend repository: `brianlupao123/orac-portal-api`
- Backend latest pushed commit: `3884dd7`.
- Frontend build: `npm run build` passed on 2026-09-12.
- Backend suite: `npm test` passed, 31/31 tests, on 2026-09-12.
- Backend syntax: `node --check server.js` passed as part of the backend check.
- Live API health: `GET https://orac-operations-api.onrender.com/healthz` returned
  `200` with `success: true`, `status: ok`, and `store_driver: postgres` on
  2026-09-12.
- Live frontend reachability: the public root returned `200`; direct
  navigation to `/login` returned `404`, so the Render SPA rewrite must be
  enabled in the service dashboard before direct links are considered ready.

## Current Capability Status

| Capability | Status | Current evidence |
|---|---|---|
| Public landing route source | PARTIAL | Frontend `src/App.jsx` imports `LandingPage` and routes `/` to it; commit `3475e7b`. Render deployment confirmation is pending. |
| Public lead API source | PARTIAL | Frontend `src/api/client.js` exports `leads.create`; backend `src/router.js:36` registers `POST /leads`; backend `src/controllers/coreController.js:89-106` creates and stores a lead. Live submission is pending. |
| Password hash verification | VERIFIED (source) | Backend `src/controllers/authController.js:20` uses bcrypt comparison against `user.password_hash`. Deliberately wrong-password live test is pending. |
| Global 401 client-session clearing | VERIFIED (source) | Frontend `src/api/client.js:37` exports the session-expiry listener; `src/App.jsx:29` subscribes and clears the active user. Browser UAT is pending. |
| State-machine controls | VERIFIED (automated) | `npm test` passed tests rejecting Draft-to-Invoiced, blocking invoice before PO, blocking amendment-required invoices, and blocking invoice without supervisor-approved worksheet. |
| Urgent dispatch reason guard | PARTIAL | Backend `src/stateMachine.js:59-60` rejects urgent pre-PO dispatch without `urgent_reason`; an explicit automated regression test is not in the standard passing suite. |
| Mining asset CRUD source | PARTIAL | Frontend `src/api/client.js:243-249` exposes mine-site, plant, section, and tag methods; backend routes/controllers exist. Form and role UAT is pending. |
| Supplier CRUD source | PARTIAL | Frontend `src/api/client.js:209-212` exposes supplier create/update; backend router imports and registers supplier handlers. Live CRUD UAT is pending. |
| Inventory sign and negative-stock controls | VERIFIED (automated) | Backend `tests/inventoryController.test.js` covers signed adjustments, stock-out sign normalization, insufficient-stock rejection, Management override denial, and Admin override authorization. |
| Structured reports and CSV source | PARTIAL | Frontend `src/pages/ReportsPage.jsx:43-97` handles structured Pipeline, PO Compliance, and Worksheet responses and CSV export. Six-tab UAT and spreadsheet validation are pending. |
| Document authorization | VERIFIED (automated) | `npm test` passed quote, worksheet, job-card, invoice amendment, and Client Viewer document-scope tests. Browser document rendering UAT is pending. |
| Notifications | VERIFIED (automated) | `npm test` passed worksheet submission, PO amendment, visibility, idempotency, mark-read, and oversight notification tests. Live notification UAT is pending. |
| PostgreSQL production guard | VERIFIED (source) | Backend `src/config.js:37,48-61` selects `STORE_DRIVER`, requires Postgres in production, and requires `DATABASE_URL` for Postgres. Neon persistence and backup verification are pending. |
| Health endpoint | VERIFIED (live) | `GET /healthz` on the deployed API returned HTTP 200 with `success`, `status`, and `store_driver` fields. |
| AI assistant in deployed frontend | VERIFIED (source) | Canonical local workspace contains `AiAssistant.jsx`; deployed frontend source does not. No real backend-supported assistant exists. |
| Quick Access source and local bundle | VERIFIED | Commit `bcb0c7e` removes the browser-side auto-login path. A successful build followed by a source/bundle marker scan found no Quick Access implementation markers. Render deployment confirmation is pending. |
| Monorepo migration | NOT IMPLEMENTED | The frontend and backend remain separate deployment repositories; migration has not started. |
| Repository reconciliation | PARTIAL | Deployment repositories are authoritative for their respective services. Historical canonical/deployment differences still need a file-by-file resolution record. |

## Automated Test Evidence

The 31 passing standard tests included:

- document authorization and Client Viewer isolation;
- notification creation, visibility, and mark-read behavior;
- JWT configuration safeguards;
- illegal quote transition rejection;
- PO, amendment, and supervisor-worksheet invoice blocks;
- Sales and Client Viewer permission rejection.
- signed inventory adjustments and negative-stock authorization.

## Blocking Follow-ups

1. In Render Static Site > Redirects/Rewrites, add or confirm `/*` ->
   `/index.html` with action `Rewrite`, then verify direct `/login` returns
   HTTP 200. The repository `render.yaml` already contains this rule, but the
   live service did not apply it during this check.
2. Confirm Render has deployed frontend commit `04ce2a4` after the rewrite
   configuration is saved.
3. Run role-by-role UAT without recording credentials or client data.
4. Verify Neon persistence and establish a documented backup/export procedure.
5. Create the reconciliation table before starting monorepo migration.
