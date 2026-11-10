# Deployment guide

## Current prerequisites

- Configure production Privy and Oracle variables using the established
  deployment secret manager; do not copy production credentials into a
  development environment.
- Set an explicit deployment profile and allowed frontend origin.
- Deploy only with the Oracle-backed services/packages actually provisioned.
  The group workflow currently fails closed without its approved durable
  adapter and admin resolver.
- Payment, blockchain, notification transport, durable audit and report data
  adapters are not configured. Their presence as application contracts does
  not enable production operations.
- Use HTTPS at the reverse proxy; set narrow CORS origins, request limits,
  security headers, health probes, and graceful shutdown timeouts.
- Keep secrets out of images, source control, build arguments, logs, and
  frontend bundles.

## Release status

The app is not production-ready for group creation/approval or financial
operations. No savings, loan, payment, or accounting write endpoints have
been implemented. The profile screen is read-only. Do not enable a test
adapter outside a test process.

Before release, provision and test database package grants, TLS, backups and
restore, monitoring, log redaction, audit retention, rate limits, secret
rotation, incident response, and operational reconciliation.
