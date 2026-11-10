# Database package specification

**Status: requirements only; no new Oracle packages are deployed.**

## Existing contracts

The backend uses `SHGT_APP.SHGT_SECURITY_PKG` for setting and clearing the
per-connection user context and resolving the current context user. It calls
`SHGT_APP.AUTH_REGISTRATION_PKG.REGISTER_MEMBER` for registration. The package
bodies and transaction behavior were not visible to the runtime account;
application code must not assume those packages have no internal commits.

The security contract is recorded in
[SHGT_DEV_SECURITY_PACKAGE_CONTRACT.md](./SHGT_DEV_SECURITY_PACKAGE_CONTRACT.md).
The registration invocation and response are documented in
[API_DOCUMENTATION.md](./API_DOCUMENTATION.md).

The authenticated profile read uses the already observed
`MEMBER_PROFILES.USER_ID` and `MEMBER_PROFILES.FULL_NAME` fields and performs
no writes. Profile edits remain disabled; no package signature for profile
updates is known or assumed.

## Required group workflow contract

An owner-authored and DBA-reviewed package is required before durable group
workflow writes can be enabled. Proposed operations:

- `SUBMIT_GROUP_REQUEST`: accepts the verified requester user ID, normalized
  request fields, and idempotency key; returns a public request reference and
  status. Must not create an active group.
- `LIST_OWN_GROUP_REQUESTS`: restricts results to the authenticated requester.
- `LIST_PENDING_GROUP_REQUESTS`: requires package-verified platform-admin
  context.
- `DECIDE_GROUP_REQUEST`: accepts request reference, decision, and required
  rejection reason. Approval creates or associates a `DRAFT` group. Conflicting
  terminal decisions fail; exact retries are idempotent.
- `ACTIVATE_GROUP`: requires explicit platform-admin authorization and a
  separate legal transition from `DRAFT` to `ACTIVE`.
- Administrative grant/revoke operations and audit queries must be specified
  and separately authorized.

Exact Oracle parameter datatypes, output binds, error codes, lock order,
transaction ownership, audit retention, and administrator bootstrap remain
DBA decisions. Do not invent these signatures in a live adapter. The current
production repository raises an explicit unavailable error until the approved
contract and adapter exist.

## Other pending package contracts

- Membership lifecycle and delegated officer authorization.
- Savings state transitions and authoritative journal posting.
- Loan lifecycle, accounting, repayment and disbursement.
- Verified payment recording, refund and reconciliation.
- Durable audit/outbox and idempotency.
- Blockchain-to-ledger reconciliation (likely application orchestration plus
  separately authorized journal calls).

The only accounting authority remains the verified/deployed database posting
package; no application code should directly mutate financial tables.

The application currently validates balanced draft journals and reconciles
two caller-supplied reference sets without persisting or posting either.
Those pure domain operations are not a substitute for these packages.
