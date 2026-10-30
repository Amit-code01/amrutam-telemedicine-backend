# Security checklist

## Authentication and authorization

- Argon2id password hashes; passwords are never logged or returned.
- Short-lived HS256 access JWTs; use a high-entropy secret from a secrets manager and rotate by key ID in production.
- Opaque refresh token is stored only as SHA-256 digest; refresh rotation revokes the old record transactionally; logout revokes it.
- TOTP enrollment is available to all roles and TOTP is required after enabled. Setup secret must be delivered over TLS and stored encrypted at rest in production. Recovery and admin reset are not implemented.
- Explicit role middleware and object-level checks prevent cross-patient/doctor consultation access; admin routes require ADMIN.

## Data protection and OWASP controls

Validate body/query/path data with Zod; cap JSON body size; Helmet headers; configured CORS; global rate limiting; safe structured errors; parameterized Prisma access; TLS and encrypted database volumes are deployment requirements. Access, refresh, password, TOTP, prescription and health payloads are redacted or excluded from logs. Audit entries contain identifiers and state changes, not clinical content.

## Checklist before production

- [ ] HTTPS everywhere; database network isolated and encrypted at rest.
- [ ] Store/rotate JWT and TOTP encryption keys through managed secret/KMS; test key rotation.
- [ ] Change local passwords, remove seed accounts, disable public self-registration or add identity verification.
- [ ] Add MFA recovery workflow, email verification and suspicious-login controls.
- [ ] Set CORS to exact production origins; tune per-user/IP rate limits behind trusted proxy configuration.
- [ ] Define consent, retention, deletion, backup encryption, access review and incident response policies.
- [ ] Run dependency scanning, SAST, image scanning, penetration test and audit-log tamper protection.
- [ ] Verify privacy-safe logs, metrics labels, backups and restore exercise.

The current implementation is an assignment baseline, not a certification or claim of perfect security. Application-level MFA secret encryption and recovery flows remain deployment work. CI runs an npm advisory scan for the dependency tree; the current Prisma 6 migration CLI dependency reports high-severity advisories in its `@prisma/config`/`effect` chain. The migration CLI is used in the build/migration container, not on API request paths, but should be upgraded with a compatible Prisma major version before production release.
