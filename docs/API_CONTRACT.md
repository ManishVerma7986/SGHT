# SHGT API contract

Base path: `/api/v1`. Protected routes require a verified Privy bearer token.
The backend derives the SHGT user ID from verified Privy identity and does not
accept actor IDs or roles from request bodies.

## Implemented routes

Existing authentication and group-read routes are documented in
[API_DOCUMENTATION.md](./API_DOCUMENTATION.md). They remain authoritative for
identity registration, active memberships, group details, and member
directories.

### Member profile

- `GET /profile/me`
- Requires an authenticated, registered, active SHGT user.
- Returns the authenticated user's `fullName` from `MEMBER_PROFILES`.
- `404`: no profile row; `503`: the profile read is unavailable; malformed
  database results fail with `500`.
- No user ID is accepted from the client. Profile editing is not implemented:
  no approved write package/transaction contract exists.

The frontend dashboard displays this read-only field and clearly identifies
profile editing as unavailable.

### Group creation requests

- `POST /group-workflow/requests`
- Requires a registered, active SHGT user.
- Requires an `Idempotency-Key` header containing a canonical UUID.
- Accepts `groupName` (required, 1-150 chars), `description` (optional, at
  most 500 chars), `village`, `district`, and `state` (optional, each at most
  100 chars), `contactDetails` (optional, at most 254 chars), and
  `proposedGroupSize` (optional positive safe integer).
- `201`: request created; `200`: exact idempotent replay; `400`: invalid
  input; `409`: idempotency key reused with different input; `503`: the
  Oracle workflow adapter is not configured.
- The production default is deliberately fail-closed. It has no persistence
  adapter yet and never uses an in-memory fallback.

- `GET /group-workflow/requests/mine`
- Requires a registered, active SHGT user.
- `200`: requests belonging to the authenticated user; `503`: persistence
  unavailable.

The member workspace displays this history when the API is available. The
current production configuration has no durable repository, so it displays an
unavailable state instead of claiming that a request was saved.

### Platform-admin routes

- `GET /group-workflow/admin/requests`
- `POST /group-workflow/admin/requests/:requestId/decision` with
  `{ "decision": "APPROVED" }` or
  `{ "decision": "REJECTED", "reason": "..." }`.
- `POST /group-workflow/admin/groups/:groupId/activate`
- Require a configured platform-admin resolver based on a trusted
  server-side source. The current default resolver is unconfigured and returns
  `503`; no user-facing role or group-officer claim grants platform authority.
- Approval produces a `DRAFT` group in the workflow prototype. Activation is
  a separate action. Rejection requires a reason. The Oracle package contract
  and durable repository are pending, so these operations cannot persist in
  the current production configuration.

The in-memory workflow repository is test-only and cannot be selected by
application configuration. It requires both `NODE_ENV=test` and explicit
`SHGT_ENABLE_TEST_REPOSITORIES=1`.

## Not implemented

There are no profile edit, membership-request/decision, savings, withdrawal,
payment callback, loan, disbursement, repayment, in-app notification, report,
or financial-administration APIs yet. Existing group creation decision routes
are API scaffolding only: production persistence and the platform-admin
resolver are unavailable.

Backend domain contracts now include balanced integer-minor-unit journal
draft validation, reference-based reconciliation classification, audit event
validation, report filter validation, and provider adapter interfaces. These
are not posting, persistence, provider success, report data, or end-to-end
workflows. Payment, blockchain, notification transports are unconfigured and
fail explicitly. No financial endpoint is enabled.

Their database/package and business-policy dependencies are recorded in
[DATABASE_REQUIREMENTS.md](./DATABASE_REQUIREMENTS.md) and
[BLOCKED_DECISIONS.md](./BLOCKED_DECISIONS.md).
