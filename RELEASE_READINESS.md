# ORAC-IOS Local Release Readiness

Date: 2026-10-27  
Status: locally verified; not deployed.

## Checkpointed repositories

| Component | Local branch | Latest local checkpoint | Remote state |
| --- | --- | --- | --- |
| Portal frontend | `codex/v5-signature-frontend` | `1fb55fa Require credit note in settlement UAT` | 25 commits ahead; not pushed |
| Authoritative backend | `codex/fix-fictional-pilot-json-store` | `ea02778 Align billing regression expectations` | 14 commits ahead; not pushed |

Both working trees were clean when this record was created.

## Verified local evidence

- Portal regression suite: 482 passed, 0 failed.
- Portal production build: passed.
- Responsive portal visual audit: dashboard and Finance pages passed at desktop (1440 px), tablet (1024 px), and mobile (390 px), without page-level horizontal overflow and with a 16 px base type size.
- Phase 5 fictional settlement UAT: payment reversal, independent credit-note issue, and the resulting balance trail were verified.
- Finance settlement trace: USD 800.00 invoice total, USD 100.00 issued credit note, USD 0.00 received after the reversed receipt, USD 700.00 outstanding.
- Backend full regression: 1,253 passed, 0 failed, 4 skipped.

## Before a real deployment

1. Obtain accounting approval for the production VAT configuration; the 15% value remains a development/test fixture.
2. Obtain a single approved branding asset before adding a logo to controlled PDF output.
3. Conduct an independent screenshot review plus a real-device keyboard and screen-reader smoke test.
4. Review deployment configuration, runtime secrets, CORS origins, TLS, backups, and rollback procedure in the target hosting environment.
5. Explicitly authorize push and deployment only after the above gates are accepted.

## Protected boundaries

- No public-site deployment or public-site code change is included here.
- V5 invoice routes and feature flags remain isolated/dark unless separately authorized.
- No production database, migration, credential, remote push, or deployment was performed as part of this local readiness work.
