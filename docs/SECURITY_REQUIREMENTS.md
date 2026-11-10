# Security requirements and current status

## Implemented controls

- Privy bearer tokens are verified by the backend. SHGT identity is resolved
  from verified claims; request bodies do not select a user.
- Active SHGT account checks are applied by protected user middleware.
- Oracle HMAC session context is established and cleared around authenticated
  database operations. Unsafe sessions are requested for discard.
- SQL in existing Oracle reads uses binds for values. Schema/table identifiers
  are fixed profile allowlists.
- Group request HTTP routes require authenticated active SHGT users. The
  default group-workflow persistence and platform-admin resolver both fail
  closed with `503`; group officer roles do not imply platform-admin authority.
- Test in-memory repositories require `NODE_ENV=test` plus explicit
  `SHGT_ENABLE_TEST_REPOSITORIES=1`. Production service composition never
  chooses them.
- Group approval creates only `DRAFT`; activation is separate. Rejection
  requires a reason and does not create an active group.
- Admin decisions receive actor identity from injected trusted server-side
  authorization, never from request data.
- The new profile read returns only the authenticated user's known full-name
  field. No profile write route is exposed.
- Payment, blockchain, and external notification adapters validate provider
  responses and have explicit unconfigured implementations that fail rather
  than claim success. These adapters are not connected to production
  composition.
- Financial journal validation uses integer minor units and requires balanced
  debit/credit legs. It creates a `DRAFT` object only; it cannot post to Oracle.

## Required before production workflow enablement

- A durable Oracle workflow package/repository and narrow grants.
- A DBA-controlled platform-admin registry, auditable bootstrap and revocation,
  and production resolver. Until then admin endpoints remain unavailable.
- Per-route authorization, rate limits, audit/outbox persistence, request size
  and abuse controls, security monitoring, and operational incident response.
- Approved business policies for membership, savings, lending, payments,
  repayments, and blockchain reconciliation.
- Durable audit event persistence and atomicity between audited business
  state changes and their audit records. Current in-memory audit storage is
  test-only, and production audit writes fail closed.
- A notification preference/consent model, recipient authorization checks,
  redacted template variables, durable in-app read/unread state, and an
  outbox-based delivery/retry design.
- Review of package bodies, transaction ownership and the Oracle connection
  disposal behavior noted in integration status.

Never enable a test repository in production, trust frontend roles, bypass
Privy verification, log credentials or financial secrets, or grant runtime
direct DML on financial tables as a workaround.
