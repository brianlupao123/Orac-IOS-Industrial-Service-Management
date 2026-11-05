# ORAC-IOS Workspace Map

**ORAC-IOS means Orac Industrial Operations System.**

This system is intentionally deployed from two repositories. They form one product, with separate deployment and security boundaries.

| Area | Directory | Owns | Deployment |
| --- | --- | --- | --- |
| Backend API | `C:\deploy-backend` | Authentication, roles, record scope, workflow, audit, invoices, database and assistant responses | Render service `orac-operations-api` |
| Frontend portal | `/workspace/orac-portal` | Pages, dashboards, assistant drawer, branding, accessibility and browser tests | Render service `orac-industrial-service-portal` |
| Submission hub | `/workspace/orac-portal` | Final documents and bundles only | Not deployed |

## Why The Code Is Not Merged

The frontend must not contain database passwords, database logic, role decisions, or workflow enforcement. The backend must not contain browser layout and styling. Keeping these separate prevents the browser from becoming the security authority and lets each Render service deploy independently.

## Safe Change Rules

1. Change server rules in `C:\deploy-backend` only.
2. Change portal design in the frontend repository only.
3. Do not move, copy, or merge repository source folders to prepare a submission.
4. Run `npm run maintain` in the repository you changed before committing.
5. Keep final PDFs, presentation files, screenshots and handover material in the submission hub.

## One Command Check

From `/workspace/orac-portal`, run `./verify-orac-workspace.ps1`. It reports the current commit and working-tree state for both repositories. It changes nothing.
