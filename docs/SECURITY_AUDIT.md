# Security audit

## Implemented controls

- Both current auth routes require the Privy token middleware. The SHGT identity is taken from verified token claims, never from request data.
- SQL in identity lookup and registration uses bind variables.
- Registration validates full name, normalized international phone number, and optional email before opening a database connection. Database uniqueness remains authoritative.
- Privy verification failures distinguish invalid credentials from service outages; database-facing route responses do not return Oracle error details.
- Oracle user context is HMAC-authenticated and cleared before connection release. A connection is dropped if context cleanup fails. Nested authenticated connection use is rejected.
- `SHGT_RUNTIME` has read-only grants on inspected financial tables, and no direct financial-table DML grants were found. Posting must use an approved package path.
- CORS is restricted to the configured frontend origin (defaulting to the local development origin); Helmet is enabled.
- The database health endpoint no longer returns the database username. Unhandled JSON/API errors are sanitized, and unknown API routes use a generic JSON response.

## Findings and remaining risk

| Finding | Status | Impact |
|---|---|---|
| Database health previously exposed the connected database account name. | Fixed: it now returns only connection health. | Avoids unnecessary disclosure of runtime account details. |
| `requireShgtUser` checks `USERS.ACCOUNT_STATUS`, not an active group membership row. | Not changed: no group-selection policy or financial route exists. | Do not treat this middleware alone as group-scoped authorization. Define the required membership/role scope first. |
| There are no savings/payment/loan APIs, provider callback verification, or financial idempotency keys. | Not implemented. | Financial writes must not be added based on frontend claims or guessed workflow rules. |
| Runtime metadata does not expose package bodies or an executable posting grant/path. The journal trigger references `JOURNAL_POSTING_PKG`. | Requires DBA/security-owner confirmation. | Do not create a replacement posting mechanism or grant direct financial-table DML. |
| A transaction commit can succeed at Oracle while its response is lost. | Documented; no generic idempotency store/key was added. | Reconcile by a stable business idempotency key before retrying uncertain financial operations. |

No SQL injection, unbound SQL input, or credential exposure was found in the implemented API routes. The available endpoint set is limited to identity, registration, and health; this is not a certification of unavailable database package bodies or financial workflows.
