# Integration guide

## Oracle

The Node application uses the existing Oracle pool and authenticated HMAC
context. Existing group reads and registration depend on the verified
production schema/packages. No DDL or DML is part of this application change.

Group workflow persistence must be supplied by an approved package and a
repository adapter. The application currently returns `503` rather than
writing existing tables directly or switching to memory. See
[DATABASE_REQUIREMENTS.md](./DATABASE_REQUIREMENTS.md) and
[DATABASE_PACKAGE_SPECIFICATION.md](./DATABASE_PACKAGE_SPECIFICATION.md).

The self-profile endpoint reads only the known `FULL_NAME` column. Profile
updates, membership decisions, savings, lending, and journal posting remain
disabled until their specific package contracts are approved.

## Privy

The frontend requests an access token from the existing Privy integration.
The backend verifies it and resolves the local SHGT user. APIs must derive
actor IDs from that verified resolution.

## Payment and blockchain adapters

No payment provider or blockchain settlement integration is enabled. The
backend now defines injectable interfaces with explicit unavailable defaults.
Future adapters must provide independently verifiable external evidence,
replay protection, idempotency, status reconciliation, and safe secret
management. Initiation is not evidence of payment or on-chain settlement.
The ledger domain can validate a balanced draft, but only the approved Oracle
posting package may post an entry.

## Notifications

External email, SMS, push, and webhook delivery remain disabled until a
provider, consent policy, templates, retries, and privacy controls are
configured. In-app durable notifications and audit events require Oracle
persistence contracts; current production writes fail closed.
