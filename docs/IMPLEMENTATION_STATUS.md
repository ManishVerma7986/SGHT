# Implementation status

Status reflects repository code and tests as of 2026-11-10.

## Implemented and tested

- Privy token verification and account identity lookup.
- Registration request validation, unique-phone error mapping, and route-level unit tests. The route uses the existing package name and signature but its live package body behavior was not verified.
- HMAC Oracle context set/clear and cleanup on pooled connections; the existing configured-Oracle integration test passed.
- Authenticated connection cleanup, connection discard on cleanup failure, explicit read/transaction wrappers, error preservation, and rejection of nested authenticated operations.
- Server startup coordination, listening failure handling, duplicate shutdown protection, HTTP draining/forced close, and pool cleanup.
- Login loading/error feedback, registration name validation, dashboard mobile sign-out, navigation accessibility state, wallet availability indicator, and clearer unconnected activity copy.
- Safe database health output and sanitized unknown/error API responses.

## Implemented but not integration-tested

- Transaction rollback, rollback failure, commit failure, and cleanup failure paths are unit-tested with connection mocks. No DML integration test was run.
- HTTP lifecycle error/deadline paths use fake servers; no deployed-process signal test was run.
- Frontend behavior was checked by lint and production build; no browser automation or accessibility audit is configured.

## Not implemented

- Savings deposits/withdrawals, member confirmation, officer approval, disputes, reconciliation, and reversal APIs.
- Provider order creation, callback signature verification, payment retries/refunds, or payment reconciliation.
- Loan application, underwriting, repayment, interest, penalties, or loan reporting APIs.
- Group-scoped membership/role authorization endpoints.
- A persistent idempotency-key store for uncertain financial commits.

## Validation

- Backend: `Set-Location backend; npm.cmd test` - 53 tests passed, including configured-Oracle identity/context integration.
- Frontend: `Set-Location frontend; npm.cmd run lint` - passed.
- Frontend: `Set-Location frontend; npm.cmd run build` - passed. Vite reports a dependency warning about `node:worker_threads` being externalized for browser compatibility; it does not fail the build.
- Live HTTP smoke check: application health, Oracle health, sanitized response fields, unknown API `404`, malformed JSON `400`, and graceful pool/server shutdown all passed against the configured Oracle instance.
- Oracle changes: none. Read-only dictionary metadata was inspected; no DDL/DML was run.

See [DATABASE_AUDIT.md](./DATABASE_AUDIT.md), [SECURITY_AUDIT.md](./SECURITY_AUDIT.md), and [BLOCKED_DECISIONS.md](./BLOCKED_DECISIONS.md).
