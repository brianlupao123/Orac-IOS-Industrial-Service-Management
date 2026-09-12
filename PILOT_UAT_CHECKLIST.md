# Orac-IOS Private Pilot UAT Checklist

Record the tester, date, deployed commit, result, and evidence for each check. Do not record passwords, tokens, database URLs, or client confidential data.

## Deployment

- [ ] Render deployment shows the intended Git commit and a successful build.
- [ ] Direct navigation to `/`, `/reports`, `/inventory`, and `/worksheets` loads the portal shell without a static-host 404.
- [ ] Browser console contains no application error during the tested workflow.

## Role Access

- [ ] Sales can open Reports and sees Pipeline only.
- [ ] Finance can open Reports and sees PO Compliance, Invoice Ready, and Variance only.
- [ ] Operations can open Reports and sees PO Compliance, Dispatch, Worksheets, and Variance only.
- [ ] Supervisor can open Reports and sees Dispatch and Worksheets only.
- [ ] Technician and Client Viewer cannot open Reports.
- [ ] Management can open Inventory and perform permitted management actions.

## Workflow Controls

- [ ] A quote cannot move from Draft directly to Invoiced.
- [ ] An invoice remains blocked without a verified PO.
- [ ] An invoice remains blocked without a supervisor-approved worksheet.
- [ ] An urgent dispatch remains traceable and requires PO verification before invoicing.

## Inventory

- [ ] A signed negative Adjustment reduces stock when backend authorization allows it.
- [ ] In and Out movements still require a positive quantity in the browser.
- [ ] A movement that would create unauthorized negative stock is rejected by the backend.

## Session and Documents

- [ ] A 401 clears the session and returns the user to login.
- [ ] A 403 displays an authorization error without logging out the valid user.
- [ ] Authorized users can open their permitted quote, job-card, worksheet, and invoice document views.
- [ ] Client Viewer cannot access another client's data or documents.

## Sign-off

Tester:

Date:

Deployed frontend commit:

Deployed backend commit:

Result: Pass / Fail / Follow-up required

Evidence or follow-up tickets:
