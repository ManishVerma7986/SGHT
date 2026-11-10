# Blocked decisions and external prerequisites

These items are intentionally not guessed or implemented.

## Database/package access

1. Provide an approved, read-only view of the `AUTH_REGISTRATION_PKG`, `SHGT_SECURITY_PKG`, and `JOURNAL_POSTING_PKG` bodies and their dependencies. Runtime metadata exposed package specifications but not bodies.
2. Confirm the supported application invocation path for `JOURNAL_POSTING_PKG`. The journal status trigger calls `JOURNAL_POSTING_PKG.IS_POSTING_AUTHORIZED()`, but `SHGT_RUNTIME` has no visible execute grant or application invocation path. Keep direct financial-table DML denied.
3. Confirm whether the registration package owns commits internally. Until confirmed, do not move its call into the generic caller-owned transaction service.

## Membership authorization

Specify whether protected features require:

- an active `USERS` account,
- an active `SHG_MEMBERSHIPS` row,
- a particular group when a member belongs to multiple groups,
- and a role check for officers/approvers.

The current API has no group selection or group-scoped authorization contract.

## Savings workflow

Specify, per cash and digital deposit and withdrawal:

- allowed state transitions and who may make each transition;
- member confirmation and dispute timing, evidence, and correction rules;
- approval roles, separation-of-duties rules, rejection/reversal treatment;
- reconciliation and audit requirements;
- which verified operation invokes the authoritative journal package.

Schema status/check constraints are not a complete transition policy. No savings write route was added.

## Payments

Select an approved provider/service and specify:

- server-side order creation and provider signature/certificate verification;
- callback replay and idempotency-key behavior;
- retry and terminal-failure rules;
- how provider evidence is reconciled with `PAYMENT_RECORDS`;
- refund authority and downstream accounting behavior.

No paid service or dependency was introduced. The frontend must never assert provider success.

## Loans

No loan tables were visible. Product owners must define loan eligibility, approval, interest method, repayment schedule, penalties, restructuring/default behavior, and journal mapping before loan implementation.

## Uncertain transaction outcomes

For each financial operation, define a stable idempotency key and reconciliation query that remain valid after a client timeout or lost commit response. The generic transaction wrapper attempts rollback after a commit error, but cannot reverse a commit already accepted by Oracle. No financial endpoint currently uses this mechanism.
