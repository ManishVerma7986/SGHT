# SHGT architecture

## Current components

- `backend/src/server.js` composes the Express application, routes, health checks, and startup entry point.
- `backend/src/config/database.js` owns the Oracle connection pool.
- `backend/src/security/` creates the HMAC assertion and sets or clears the Oracle user context.
- `backend/src/services/authenticated-database.service.js` gives one callback an authenticated connection, clears context before release, and drops a connection when context cleanup fails.
- `backend/src/services/authenticated-transaction.service.js` adds explicit read and caller-owned transaction operations over that authenticated connection lifecycle.
- `backend/src/services/server-lifecycle.service.js` coordinates pool startup, HTTP listen/drain, duplicate shutdown signals, and pool cleanup.
- `backend/src/middleware/` verifies Privy access tokens and resolves the SHGT user account.
- `backend/src/routes/auth.routes.js` implements the current identity and registration APIs.
- `frontend/src/` contains the Privy provider, identity/registration hooks, login and registration screens, and dashboard placeholders.

The backend uses CommonJS and the frontend uses React, Vite, and JavaScript. No savings, payment, loan, repository, or financial controller modules currently exist. They were not scaffolded without confirmed workflows and safe write permissions.

## Request and identity flow

1. The frontend obtains a Privy access token and sends it as a bearer token.
2. `requirePrivyAuth` validates the token with the Privy Node SDK and attaches only the verified `user_id`.
3. `/api/v1/auth/me` resolves the SHGT account by that identifier. The separate `requireShgtUser` middleware also checks `USERS.ACCOUNT_STATUS = 'ACTIVE'`.
4. Protected database work can use `withAuthenticatedConnection`: it sets the Oracle context through `SHGT_SECURITY_PKG`, runs one callback, clears the context, then releases the connection. A context setup or cleanup failure causes the connection to be discarded; multiple failures are preserved in an `AggregateError`.

The current membership middleware checks the SHGT user account status, not a selected `SHG_MEMBERSHIPS` row. Group-scoped authorization remains unresolved; see [BLOCKED_DECISIONS.md](./BLOCKED_DECISIONS.md).

## Transaction ownership

- `withAuthenticatedRead` establishes and clears the authenticated context without calling commit.
- `withAuthenticatedTransaction` commits after its callback resolves and rolls back after callback or commit failure.
- The authenticated-connection service rejects nested authenticated operations so code cannot silently acquire a second connection and take conflicting transaction ownership.
- Do not use the caller-owned transaction wrapper around PL/SQL packages that commit internally, nor with statements configured for autocommit. Package transaction ownership must be inspected and agreed first.
- A `commit()` error has an uncertain outcome: the database may have committed even if the client did not receive confirmation. A rollback is attempted, but cannot undo a commit that already completed. Callers must reconcile by a stable idempotency key before retrying.

The registration route keeps its existing direct package/commit flow because the package body and its transaction behavior are not visible through the runtime account. It was not moved into the generic transaction wrapper.

## Runtime and health checks

Startup awaits pool initialization and HTTP listening. Shutdown is idempotent, drains HTTP traffic, force-closes remaining connections at the deadline, then closes the Oracle pool. Startup, HTTP shutdown, and pool-close errors affect the returned shutdown status.

`/api/v1/health/database` performs a read-only `SELECT 1 FROM DUAL`, always attempts to release the connection, and returns no database account name. JSON parsing is limited to 32 KB; unknown API routes and unhandled errors return sanitized JSON.

## Frontend state

The frontend implements login, registration, identity verification, and passkey linking. Savings, loans, and activity views are explicit unconnected-data placeholders; they do not fabricate balances or transactions. Registration validation is duplicated only to provide immediate form feedback; the backend remains authoritative.

## Evidence and limits

The backend integration tests connected to the configured Oracle instance as `SHGT_RUNTIME` and exercised identity context setup, cleanup, and a read-only transaction commit. Transaction rollback and cleanup failure behavior are covered with unit mocks, not an Oracle DML integration test. See [DATABASE_AUDIT.md](./DATABASE_AUDIT.md) and [IMPLEMENTATION_STATUS.md](./IMPLEMENTATION_STATUS.md).
