# API documentation

Base path: `/api/v1`. Except for health endpoints, requests require a valid Privy access token:

```http
Authorization: Bearer <Privy access token>
```

The SHGT identity is resolved from verified Privy claims. Clients must not send a user ID to select the authenticated account.

## `GET /api/v1/auth/me`

Returns the SHGT registration state of the authenticated Privy identity.

- `200`: identity verified; `registered: false` if no SHGT account exists, or `registered: true` with the account status.
- `403`: account exists but is not active.
- `401`: missing, empty, or invalid Privy token.
- `503`: Privy verification or SHGT account lookup is unavailable.
- `500`: identity lookup failed.

Example pending-registration response:

```json
{
  "success": true,
  "authenticated": true,
  "registered": false,
  "message": "Privy identity verified. SHGT registration is pending."
}
```

## `POST /api/v1/auth/register`

Creates an SHGT member through `AUTH_REGISTRATION_PKG`; it does not accept a client-supplied identity.

```json
{
  "fullName": "Member Name",
  "phoneNumber": "+919876543210",
  "email": "member@example.com"
}
```

- `fullName`: required string, trimmed length 2-150; control characters are rejected.
- `phoneNumber`: required international number with `+` prefix; spaces, hyphens, and parentheses are normalized before persistence.
- `email`: optional; when nonempty, must pass backend email validation.

Responses:

- `201`: newly registered according to the current route/package contract.
- `200`: the verified identity already has an account; current account status is returned.
- `400`: invalid request data.
- `401`: invalid authentication identity/token.
- `403`: an existing account is inactive.
- `409`: duplicate phone number or conflicting registration.
- `503`: Privy service unavailable.
- `500`: registration or status reconciliation failed.

The frontend reconciles identity after an uncertain registration response. This is not a general financial idempotency mechanism. The real package body was not visible to the runtime account, so the route's live database registration behavior has not been integration-tested.

## Health and unknown routes

- `GET /`: basic service greeting.
- `GET /api/v1/health`: application liveness; no authentication.
- `GET /api/v1/health/database`: read-only database connectivity check; no authentication. It returns no database username.
- Unknown `/api/*` paths return JSON `404`. Malformed or oversized JSON and unexpected errors return sanitized JSON responses.

## Not available

There are no savings, payment, loan, group-membership, or journal-posting HTTP endpoints. The dashboard screens for those domains remain placeholders, not APIs or transaction simulations.
