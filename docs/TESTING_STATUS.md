# Testing status

## Current validation

Run the frontend suite with `node --test` from `frontend`; run lint and build
with `npm run lint` and `npm run build`.

Run backend tests with `npm test` from `backend`. Unit tests use injected
dependencies and do not require a live Oracle database. Oracle integration
tests require `SHGT_RUN_DEV_ORACLE_INTEGRATION=1` and
`SHGT_DEPLOYMENT_PROFILE=development`; they remain skipped by default.

Latest verified results:

- Backend: 244 tests, 240 passed, 4 skipped, 0 failed.
- Frontend: 20 passed, 0 failed.
- Frontend lint and production build passed.
- The Vite build emits a non-fatal `node:worker_threads` browser-externalization
  warning from a transitive `viem` dependency.

## Group workflow prototype

Automated tests cover request validation, requester-derived identity,
idempotency replay/conflict, required rejection reason, admin authorization
fail-closed behavior, approval to DRAFT, separate activation, and prohibition
of accidental test-repository use outside explicit test mode.

These are application-layer tests against an isolated in-memory test adapter.
They do not prove Oracle persistence, transaction atomicity, cross-process
idempotency, or deployment authorization.

## Application contracts added

Targeted unit coverage verifies the self-profile read query/response,
balanced integer-minor-unit journal drafts, reconciliation classifications,
audit event shape and fail-closed durable persistence, report filter bounds,
and provider response/event validation. Provider tests use injected test
doubles; they contact no external service and post no state.

The 2026-11-11 backend suite skipped all four Oracle integration tests. No
Oracle connection or SQL execution occurred during this continuation.

## Deferred coverage

No production Oracle group workflow package exists to integration-test.
Profile editing, membership workflows, financial state machines, payment
callbacks, notification delivery, reports, blockchain settlement, load
testing, penetration testing, and deployment smoke tests remain pending.
