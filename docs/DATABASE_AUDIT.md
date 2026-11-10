# Database audit

## Scope and method

No SQL scripts or schema documentation are present in the repository. The audit therefore used read-only Oracle dictionary views through the configured `SHGT_RUNTIME` connection, alongside the SQL and PL/SQL calls in backend source. No DDL or DML was executed. Dictionary visibility is limited to objects exposed to that runtime account; package bodies and inaccessible objects could not be inspected.

The live metadata confirms the following `SHGT_APP` tables:

- Identity and membership: `USERS`, `MEMBER_PROFILES`, `IDENTITY_VERIFICATIONS`, `SHG_GROUPS`, `SHG_MEMBERSHIPS`.
- Savings and accounting: `SAVINGS_ACCOUNTS`, `SAVINGS_TRANSACTIONS`, `SAVINGS_TRANSACTION_AUDIT`, `ACCOUNTING_ACCOUNTS`, `JOURNAL_ENTRIES`, `JOURNAL_LINES`.
- Payments: `PAYMENT_RECORDS`.
- No `LOAN%` tables were visible in the schema inventory.

## Confirmed structures and controls

- `USERS` has `USER_ID`, `PRIVY_USER_ID`, and `ACCOUNT_STATUS`; the status constraint permits `ACTIVE`, `SUSPENDED`, or `CLOSED`. `UQ_USERS_PRIVY` is enabled.
- `MEMBER_PROFILES` contains the member's name and optional contact/profile fields. The unique `UQ_MEMBER_PHONE` index is on `PHONE_NUMBER`; the user association is unique as well.
- `SHG_MEMBERSHIPS` carries user, group, role, status, join/leave dates, and approval metadata. Enabled checks constrain roles, statuses, and dates. Group selection and authorization behavior are not implemented in the current API.
- `SAVINGS_ACCOUNTS` links a membership and accounting account. Enabled checks constrain account status and close date.
- `SAVINGS_TRANSACTIONS` includes type, method, amount, INR currency, status, member-confirmation fields, initiator/approver, and journal reference. Enabled checks require a positive amount; restrict types to deposit/withdrawal and methods to cash/digital; constrain states; require approver fields together and a different approver from initiator; and require a journal reference and approval when posted. Cash deposits have an additional member-confirmation condition before posting.
- The schema permits member confirmation states `PENDING`, `CONFIRMED`, and `DISPUTED`, and verification methods `APP` and `PAPER_RECEIPT`. These are schema values, not a complete authorization or workflow policy.
- `SAVINGS_TRANSACTION_AUDIT` has action/actor metadata and enabled checks. `TRG_SAVINGS_AUDIT_IMMUTABLE` rejects update and delete.
- `JOURNAL_ENTRIES` constrains status to draft/posted/reversed, requires `POSTED_AT` for posted/reversed entries, prevents a journal from reversing itself, and lists savings, loan, interest, adjustment, and reversal transaction types.
- `JOURNAL_LINES` requires each line to have exactly one positive debit or credit. Unique/reference indexes and draft-only line modification protections are present. The complete package-level balancing and reversal implementation was not visible to `SHGT_RUNTIME`.
- `PAYMENT_RECORDS` constrains status to initiated/pending/success/failed/cancelled/refunded, amount to positive, currency to INR, and gateway-verification flag/timestamp combinations. Provider order and payment references are unique per provider. A unique function-based index permits at most one successful, gateway-verified payment record per savings transaction.
- The verification check permits `PAYMENT_STATUS = 'SUCCESS'` while `GATEWAY_VERIFIED = 'N'`; it does not by itself prove every successful status has provider evidence. No backend payment callback or write path exists.
- Relevant primary/unique/foreign-key/check constraints and indexes were enabled. The inspected table IDs use identity columns; no `SHGT_APP` sequences were visible.

## Packages, triggers, and permissions

- `AUTH_REGISTRATION_PKG` and `SHGT_SECURITY_PKG` specifications are visible and valid. Their bodies were not visible through `ALL_SOURCE` as `SHGT_RUNTIME`; they need an approved read-only owner/DBA inspection before their transaction behavior or full implementation can be certified.
- The security package specification exposes `SET_USER_CONTEXT`, `CLEAR_USER_CONTEXT`, and `GET_CURRENT_USER_ID`; the integration test verifies set/clear behavior against the configured Oracle instance.
- `TRG_JOURNAL_STATUS_PROTECTION` permits journal status/timestamp changes only when `JOURNAL_POSTING_PKG.IS_POSTING_AUTHORIZED()` reports an authorized posting operation. The package source and runtime invocation path were not visible to `SHGT_RUNTIME`; no financial DML was attempted.
- `SHGT_RUNTIME` has `SELECT` but no direct `INSERT`, `UPDATE`, or `DELETE` grants on the inspected financial tables. It has `EXECUTE` on the registration and security packages. No direct runtime grant to `JOURNAL_POSTING_PKG` was visible. Do not grant direct financial-table DML to work around this.
- Other enabled triggers protect journal headers, require draft status for journal-line changes, protect accounting metadata after posted usage, and make savings audit rows immutable. No savings state-transition trigger was visible.

## Lifecycle findings

### Savings

Database columns and checks establish several allowed states and posting invariants, but no backend route, savings package, or savings transition trigger is present in the repository or visible runtime metadata. The complete cash/digital verification, membership confirmation, officer authorization, dispute, reconciliation, rejection, and reversal policies cannot be inferred from column names or check constraints. Do not implement savings writes until the approved posting entry point and transition/role rules are supplied. `JOURNAL_POSTING_PKG` must remain the sole posting/reversal authority.

### Payments

`PAYMENT_RECORDS` supports provider/order/payment references, verification metadata, failures, and refunds at the storage level. No provider SDK, callback endpoint, signature verification, retry/idempotency policy, or refund flow exists in the backend. The frontend cannot be trusted to assert payment success. A success write must require independently verified provider evidence.

### Loans

No loan tables or loan API were visible. Journal transaction-type values alone are not a loan subsystem. No loan lifecycle or write path was implemented.

## Database changes

No database changes were proposed or executed. Before a safe implementation, obtain a read-only schema/package export and an approved invocation design for the posting package. The missing business decisions are enumerated in [BLOCKED_DECISIONS.md](./BLOCKED_DECISIONS.md).
