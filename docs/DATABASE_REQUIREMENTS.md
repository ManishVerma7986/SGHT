# Database requirements

## Existing verified foundation

See [DATABASE_AUDIT.md](./DATABASE_AUDIT.md) for audited object names,
constraints, indexes, package visibility, and runtime privileges. No SQL is
executed by application-layer tests. The production backend fails closed when
an application workflow adapter is unavailable.

Verified group fields currently available in `SHGT_APP.SHG_GROUPS` include
`GROUP_ID`, `GROUP_CODE`, `GROUP_NAME`, `VILLAGE`, `DISTRICT`, `STATE`,
`PIN_CODE`, `FORMATION_DATE`, and `GROUP_STATUS`. The existing status check
permits `DRAFT`, `ACTIVE`, `SUSPENDED`, and `CLOSED`. Existing membership
fields include user/group references, role, status, join/leave dates, and
approver metadata. These tables do not store group-creation descriptions,
proposed size/contact details, request status, rejection reasons, or platform
administrator authority.

The existing application query contract supports a self-only profile read of
`MEMBER_PROFILES.FULL_NAME` by the authenticated `USER_ID`. The new profile
endpoint only reads this verified field. It does not expose contact fields
whose exact columns were not confirmed here, and it does not edit profile
data.

## Required durable group workflow objects

The following are requirements, not deployed objects:

- A group-request record containing a public request identifier, verified
  requester user ID, normalized submitted fields, request status, creation
  timestamp, decision actor/time, rejection reason, and idempotency key/hash.
- A unique idempotency constraint scoped to requester; same key/same
  normalized payload replays the original request, while same key/different
  payload conflicts.
- A platform administrator registry and audited bootstrap/revocation
  mechanism. The runtime cannot nominate itself or submit an actor ID.
- A workflow package with definer-rights authorization, row locking,
  state-transition checks, request/decision audit, and explicit transaction
  ownership.
- Approval must create a `DRAFT` group only. A separate authorized activation
  transition changes it to `ACTIVE`. Rejected requests never create or
  activate a group. `CLOSED` is not a rejection status.
- Group request storage needs columns for description and proposed details;
  no existing group column should be repurposed for these.
- Runtime receives narrow `EXECUTE` on the approved workflow package; no
  direct DML on workflow/group/membership tables is required.
- Database concurrency and audit requirements are detailed in
  [SHGT_GROUP_WORKFLOW_DATABASE_PROPOSAL_REVISED.md](./SHGT_GROUP_WORKFLOW_DATABASE_PROPOSAL_REVISED.md).

## Future modules

Before delivery, the DBA must provide reviewed schemas, constraints, indexes,
package specifications, owner grants, runtime execute grants, transaction
ownership, and error-code contracts for:

- Profile contact/address edits and profile image storage.
- Membership request/approval/rejection/withdrawal and officer delegation.
- Savings account/contribution/withdrawal transitions and journal posting.
- Loan applications, decisions, schedules, disbursements, and repayments.
- Payment initiation, verified provider evidence, callbacks, refunds, and
  reconciliation.
- Durable idempotency, audit, in-app notifications, report queries, and
  outbox/job state.
- Blockchain settlement references and Oracle reconciliation.

No loan tables or group workflow package were present in audited metadata.
Financial posting must remain under the approved journal package.

Application-only contracts currently added do not need or authorize Oracle
changes: integer-minor-unit balanced journal-draft validation, append-only
audit event shape, report-filter validation, and external/ledger
reconciliation classification. A durable audit/outbox/reconciliation adapter
and approved database transaction boundaries are still required.
