# Amrutam Telemedicine Backend

TypeScript/Express modular monolith implementing the assignment's patient and doctor lifecycle, MFA-capable JWT auth, doctor search and slots, idempotent consultation booking, status transitions, prescriptions, admin analytics, audit logging, PostgreSQL migrations, metrics, and API docs. PostgreSQL is the source of truth for booking concurrency. No paid services are required locally.

## Requirements and checklist

The attached assignment asks for core auth and roles; doctor availability and booking; consultation and prescriptions; search; compliance/audit; admin analytics; PostgreSQL; idempotency and concurrency; API/ER diagrams; scaling, retries, partitioning, transaction/saga and DR strategy; OWASP, MFA, encryption and dependency scanning; Docker, CI, observability, tests and docs. These are tracked in `docs/assignment-checklist.md`. Payment is represented as a pending ledger record only; no gateway or payment API was specified.

## Stack and structure

- Node.js 22, TypeScript strict mode, Express 5, Prisma 6, PostgreSQL 17
- Zod validation, Argon2id, jose JWTs, rotating opaque refresh tokens, TOTP MFA, Helmet/CORS/rate limiting
- Pino JSON logs, Prometheus metrics, Swagger UI, Vitest/Supertest
- `src/modules/{auth,users,doctors,availability,consultations,admin,audit}` contains domain flows; `src/middleware` handles auth, validation and errors; Prisma owns persistence and migrations.

## Run locally

1. Install Node.js 22 and Docker Compose.
2. Copy `.env.example` to `.env`; replace `JWT_ACCESS_SECRET` with a random value of at least 32 characters. The included database password is for local development only.
3. Start PostgreSQL: `docker compose up -d postgres`.
4. Install packages: `npm ci` (first run creates `package-lock.json`).
5. Apply schema: `npm run db:generate` then `npm run db:migrate`.
6. Optionally seed: `npm run db:seed`; development password comes from `SEED_PASSWORD` and seed creates `admin@example.test`, `patient@example.test`, `doctor@example.test`.
7. Run `npm run dev`. API: `http://localhost:3000`; Swagger: `/docs`; raw spec: `/openapi.json`; metrics: `/metrics`; liveness/readiness: `/health`, `/ready`.

### Create a local ADMIN without touching demo accounts

The general demo seed also touches the doctor seed profile. To create only a new admin, start the local database and apply migrations as above, then run this PowerShell block. It prompts for a password without echoing it, passes the values only to the current process, and clears them afterward. The script refuses production mode, non-local database hosts, and any email that already exists.

```powershell
$adminEmail = Read-Host 'New local admin email'
$adminSecurePassword = Read-Host 'New local admin password (12-128 characters)' -AsSecureString
$adminPasswordPointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($adminSecurePassword)
try {
  $env:ADMIN_BOOTSTRAP_EMAIL = $adminEmail
  $env:ADMIN_BOOTSTRAP_PASSWORD = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($adminPasswordPointer)
  npm run db:admin:create
} finally {
  [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($adminPasswordPointer)
  Remove-Item Env:ADMIN_BOOTSTRAP_EMAIL, Env:ADMIN_BOOTSTRAP_PASSWORD -ErrorAction SilentlyContinue
  Remove-Variable adminEmail, adminSecurePassword, adminPasswordPointer -ErrorAction SilentlyContinue
}
```

Then open Swagger at `http://localhost:3000/docs`, call `POST /api/v1/auth/login` with the email and password you just entered, and authorize Swagger with the returned `data.accessToken` as a Bearer token. The bootstrap script does not print or persist the password, and it does not modify existing users.

Full Docker run: set `JWT_ACCESS_SECRET` in `.env` then `docker compose up --build`. Compose runs a one-shot migration service before the API starts. To reset only local dev data: `docker compose down -v` (this deletes the local database volume).

## Tests and quality

`npm run typecheck`, `npm run lint`, `npm run format:check`, `npm run test:unit`, `npm run test:integration`, `npm run build`. To run the PostgreSQL concurrency and access-control tests, set `RUN_DB_TESTS=1`, point `DATABASE_URL` at a disposable database, and run `npx prisma migrate deploy` first. PowerShell: `$env:RUN_DB_TESTS='1'; npm run test:integration`. Bash: `RUN_DB_TESTS=1 npm run test:integration`. The DB-specific suite is skipped when that opt-in variable is absent; never point tests at production. CI provisions PostgreSQL and enables the suite.

## Example flow

Register: `curl -X POST localhost:3000/api/v1/auth/register -H 'content-type: application/json' -d '{"email":"patient@example.test","password":"ChangeThisPassword123!","role":"PATIENT","fullName":"Test Patient"}'`. Use returned `accessToken` as `Authorization: Bearer ...`. Search: `GET /api/v1/doctors?specialty=General%20Medicine`. A patient books with `POST /api/v1/consultations`, an `Idempotency-Key: <unique-key>` header, and `{ "slotId": "..." }`. A doctor adds a slot with `POST /api/v1/availability` and ISO-8601 start/end values.

## Environment variables

`DATABASE_URL` PostgreSQL URL; `JWT_ACCESS_SECRET` signing secret; `ACCESS_TOKEN_TTL_SECONDS` default 900; `REFRESH_TOKEN_TTL_DAYS` default 30; `PORT` default 3000; `CORS_ORIGIN` comma-separated allowed origins; `RATE_LIMIT_WINDOW_MS` and `RATE_LIMIT_MAX`; `LOG_LEVEL`; `NODE_ENV`; `SEED_PASSWORD` only used by the dev seed.

## Security and known limitations

Access JWTs are short-lived; refresh tokens are random, stored only as hashes, and rotate with revocation. MFA enrollment uses TOTP and must be tested with a standard authenticator app. HTTPS and encryption at rest must be provided by deployment infrastructure. Do not log health information. Access control is checked at resource retrieval. Audit metadata deliberately excludes prescription content. Production deployment still needs secrets management/key rotation, backups, alerting, dependency scanning, MFA recovery, email verification, retention policy, and an external security review. API currently does not include a real payment processor. Performance/availability targets are design targets and have not been measured.

## Documentation

- `docs/architecture.md`: architecture, booking sequence, transactions, scaling and DR
- `docs/data-model.md`: ER model, constraints and indexes
- `docs/security.md`, `docs/threat-model.md`, `docs/operations.md`
- `docs/assignment-checklist.md`: requirement-to-implementation status

See `docs/operations.md` for migration, backup, metrics, and performance test guidance.
