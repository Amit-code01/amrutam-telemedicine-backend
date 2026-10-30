# Amrutam Telemedicine Backend

A TypeScript-based REST API for a telemedicine platform, built for the **Amrutam Backend Developer Assignment**. The backend supports patient and doctor workflows, consultation booking, prescription management, administrative operations, and security-focused access controls.

**Repository:** [Amit-code01/amrutam-telemedicine-backend](https://github.com/Amit-code01/amrutam-telemedicine-backend)  
**Demo video:** [Watch the API walkthrough](https://drive.google.com/file/d/1VONWAJkY9fwbYhtEUNp15S_nUNod-7x0/view?usp=sharing)

> This is an assignment implementation. See [Security and limitations](#security-and-limitations) for production deployment considerations.

## Contents

- [Features](#features)
- [Technology stack](#technology-stack)
- [Architecture](#architecture)
- [Run locally](#run-locally)
- [Run with Docker Compose](#run-with-docker-compose)
- [API documentation and endpoints](#api-documentation-and-endpoints)
- [Example workflow](#example-workflow)
- [Testing and quality checks](#testing-and-quality-checks)
- [Environment variables](#environment-variables)
- [Assignment coverage](#assignment-coverage)
- [Observability](#observability)
- [Documentation](#documentation)
- [Security and limitations](#security-and-limitations)

## Features

### Authentication and access control
- JWT-based authentication with short-lived access tokens.
- Refresh-token rotation and revocation; refresh tokens are stored as hashes.
- Argon2id password hashing.
- Role-based access control for patient, doctor, and administrator workflows.
- TOTP-based multi-factor authentication support.
- Request validation, rate limiting, and resource-level access checks.

### Doctor discovery and availability
- Search and filter doctors using supported criteria.
- Doctors can create and manage consultation availability slots.

### Consultation management
- Patient consultation booking.
- Idempotency keys to help prevent duplicate bookings on retries.
- Database-backed booking correctness and concurrency handling.
- Consultation status lifecycle management.
- Prescription workflows.

### Administration and audit
- Administrative routes and analytics.
- Audit events for relevant operations.
- Sensitive health information is excluded from audit metadata.

### Developer experience
- Swagger UI and an OpenAPI specification.
- Docker Compose development environment with PostgreSQL and migration support.
- Structured JSON logs and Prometheus metrics.
- Unit and integration test suites with CI configuration.

## Technology stack

| Area | Technology |
|---|---|
| Runtime | Node.js 22 |
| Language | TypeScript (strict mode) |
| API framework | Express 5 |
| Database | PostgreSQL 17 |
| ORM and migrations | Prisma 6 |
| Validation | Zod |
| Authentication | JWT (`jose`), Argon2id, TOTP MFA |
| Security middleware | Helmet, CORS, rate limiting, RBAC |
| Logging | Pino |
| Metrics | Prometheus |
| API documentation | Swagger UI, OpenAPI |
| Tests | Vitest, Supertest |
| Local infrastructure | Docker, Docker Compose |
| CI | GitHub Actions |

## Architecture

The application follows a **modular monolith** approach. Domain modules organize the application while middleware handles shared HTTP concerns and Prisma manages persistence.

```text
src/
├── config/
├── database/
├── middleware/
├── modules/
│   ├── auth/
│   ├── users/
│   ├── doctors/
│   ├── availability/
│   ├── consultations/
│   ├── admin/
│   └── audit/
├── observability/
├── utils/
├── app.ts
├── openapi.ts
└── server.ts

prisma/
├── migrations/
├── schema.prisma
├── seed.ts
└── create-admin.ts

tests/
├── integration/
└── unit/

docs/
├── architecture.md
├── assignment-checklist.md
├── data-model.md
├── operations.md
├── security.md
└── threat-model.md
```

### Booking reliability

Consultation booking is a critical workflow: the same doctor slot should not be booked more than once, and retrying a request should not create duplicate consultations. The implementation uses PostgreSQL as the authoritative persistence layer, database constraints and transaction-based logic, slot availability validation, and idempotency keys. Integration tests cover booking and access-control behavior.

## Run locally

### Prerequisites

- Node.js 22
- npm
- Docker with Docker Compose

### 1. Clone the repository

```bash
git clone https://github.com/Amit-code01/amrutam-telemedicine-backend.git
cd amrutam-telemedicine-backend
```

### 2. Configure environment variables

Copy the example file:

**PowerShell**
```powershell
Copy-Item .env.example .env
```

**macOS/Linux**
```bash
cp .env.example .env
```

Open `.env` and set `JWT_ACCESS_SECRET` to a random secret of at least 32 characters. Any credentials included in `.env.example` are for local development only. Do not use them in a deployed environment.

### 3. Start PostgreSQL

```bash
docker compose up -d postgres
```

### 4. Install dependencies and generate Prisma Client

```bash
npm ci
npm run db:generate
```

### 5. Apply database migrations

```bash
npm run db:migrate
```

### 6. (Optional) Seed development data

```bash
npm run db:seed
```

The development seed uses `SEED_PASSWORD` and creates the demo accounts `admin@example.test`, `patient@example.test`, and `doctor@example.test`. Use only local development credentials.

### 7. Start the API

```bash
npm run dev
```

The API is available at `http://localhost:3000`.

## Run with Docker Compose

To build and start the stack, including the migration service:

```bash
docker compose up --build
```

Useful commands:

```bash
# Show running services
docker compose ps

# Follow API logs
docker compose logs -f api

# Stop services
docker compose down
```

To reset local development data:

```bash
docker compose down -v
```

**Warning:** `docker compose down -v` removes the database volume and deletes its data. Do not run it if you need to preserve local records.

## API documentation and endpoints

When the API is running:

| Resource | URL |
|---|---|
| API base | `http://localhost:3000` |
| Swagger UI | `http://localhost:3000/docs` |
| OpenAPI JSON | `http://localhost:3000/openapi.json` |
| Prometheus metrics | `http://localhost:3000/metrics` |
| Liveness check | `http://localhost:3000/health` |
| Readiness check | `http://localhost:3000/ready` |

Use Swagger UI for the full route list, request schemas, and response formats.

## Example workflow

The following illustrates the main patient workflow. Exact required fields and response shapes are documented in Swagger.

### 1. Register a patient

```http
POST /api/v1/auth/register
Content-Type: application/json
```

```json
{
  "email": "patient@example.test",
  "password": "ChangeThisPassword123!",
  "role": "PATIENT",
  "fullName": "Test Patient"
}
```

Use a unique email and a development-only password. After registration, log in through `POST /api/v1/auth/login` and use the returned access token as a Bearer token.

### 2. Search doctors

```http
GET /api/v1/doctors?specialty=General%20Medicine
```

### 3. Book a consultation

```http
POST /api/v1/consultations
Authorization: Bearer <access-token>
Idempotency-Key: <unique-key>
Content-Type: application/json
```

```json
{
  "slotId": "<available-slot-id>"
}
```

Send a unique idempotency key for each intended booking operation. Reuse the same key when retrying the same request.

### 4. Manage doctor availability

A doctor can create an availability slot using:

```http
POST /api/v1/availability
Authorization: Bearer <doctor-access-token>
Content-Type: application/json
```

The request uses ISO-8601 start and end timestamps. Refer to Swagger for the complete schema.

## Testing and quality checks

Run the configured checks:

```bash
npm run typecheck
npm run lint
npm run format:check
npm run test:unit
npm run test:integration
npm run build
```

Database-dependent integration tests require a disposable PostgreSQL database with migrations applied. The database-specific suite is opt-in using `RUN_DB_TESTS=1`.

**PowerShell**
```powershell
$env:RUN_DB_TESTS = '1'
npm run test:integration
```

**macOS/Linux**
```bash
RUN_DB_TESTS=1 npm run test:integration
```

Never run integration tests against a production database. CI provisions PostgreSQL and enables the integration suite.

### Create a local administrator

The repository includes a guarded administrator bootstrap script. Start the local database and apply migrations first. In PowerShell:

```powershell
$adminEmail = Read-Host 'New local admin email'
$adminSecurePassword = Read-Host 'New local admin password (12-128 characters)' -AsSecureString
$adminPasswordPointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($adminSecurePassword)

try {
  $env:ADMIN_BOOTSTRAP_EMAIL = $adminEmail
  $env:ADMIN_BOOTSTRAP_PASSWORD = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($adminPasswordPointer)
  npm run db:admin:create
}
finally {
  [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($adminPasswordPointer)
  Remove-Item Env:ADMIN_BOOTSTRAP_EMAIL, Env:ADMIN_BOOTSTRAP_PASSWORD -ErrorAction SilentlyContinue
  Remove-Variable adminEmail, adminSecurePassword, adminPasswordPointer -ErrorAction SilentlyContinue
}
```

The script is intended for local development and is designed to refuse production mode, non-local database hosts, and existing email addresses.

## Environment variables

Configure these in `.env`. The `.env.example` file is the reference for local setup.

| Variable | Description |
|---|---|
| `DATABASE_URL` | PostgreSQL connection URL |
| `JWT_ACCESS_SECRET` | JWT signing secret; use a random secret of at least 32 characters |
| `ACCESS_TOKEN_TTL_SECONDS` | Access-token lifetime; default is 900 seconds |
| `REFRESH_TOKEN_TTL_DAYS` | Refresh-token lifetime; default is 30 days |
| `PORT` | API port; default is 3000 |
| `CORS_ORIGIN` | Comma-separated allowed origins |
| `RATE_LIMIT_WINDOW_MS` | Rate-limit window |
| `RATE_LIMIT_MAX` | Maximum requests within the rate-limit window |
| `LOG_LEVEL` | Logging level |
| `NODE_ENV` | Application environment |
| `SEED_PASSWORD` | Password used by the development seed |

Do not commit `.env` files, private keys, tokens, or real credentials.

## Assignment coverage

This table summarizes the implementation and supporting documentation represented in this repository.

| Requirement | Coverage |
|---|---|
| Authentication and roles | Implemented |
| Doctor availability | Implemented |
| Consultation booking | Implemented with idempotency and database-backed concurrency handling |
| Consultation lifecycle | Implemented |
| Prescriptions | Implemented |
| Doctor search and filtering | Implemented |
| Audit logging | Implemented |
| Admin analytics | Implemented |
| PostgreSQL data model and migrations | Implemented |
| API documentation | Swagger UI and OpenAPI |
| Automated tests and CI | Configured |
| Dockerized development | Configured |
| Architecture, ER model, and scaling design | Documented |
| Security and threat model | Documented |
| Metrics and structured logging | Implemented |
| Production tracing, alerting, and performance validation | Requires deployment-level validation |

See [`docs/assignment-checklist.md`](docs/assignment-checklist.md) for the requirement-by-requirement checklist.

## Observability

The application uses Pino for structured JSON logging and exposes Prometheus metrics at `/metrics`.

```bash
# Inspect API logs
docker compose logs --tail=100 api
```

Distributed tracing, alerting, and production monitoring require deployment-level configuration and validation.

## Documentation

The `docs/` directory contains additional design and operational material:

- [`docs/architecture.md`](docs/architecture.md) — architecture, booking sequence, transactions, scaling, and disaster recovery.
- [`docs/data-model.md`](docs/data-model.md) — ER model, database constraints, and indexes.
- [`docs/security.md`](docs/security.md) — security controls and recommendations.
- [`docs/threat-model.md`](docs/threat-model.md) — threat scenarios and mitigations.
- [`docs/operations.md`](docs/operations.md) — migrations, backups, metrics, and performance-test guidance.
- [`docs/assignment-checklist.md`](docs/assignment-checklist.md) — assignment requirement mapping.

## Security and limitations

This project demonstrates security and reliability practices for a telemedicine backend, but an assignment implementation is not equivalent to a fully audited production healthcare platform.

Production deployment still requires appropriate infrastructure and operational controls, including:

- HTTPS and encryption at rest.
- Production secrets management and key rotation.
- Backup and restore validation.
- Alerting and operational dashboards.
- Dependency and container vulnerability scanning.
- MFA recovery and email verification workflows.
- Data retention and deletion policies.
- External security review.
- Load testing and validation of performance and availability targets.

The application does not include a real payment processor. Payment is represented as a pending ledger record because a payment gateway or payment API was not specified. Performance and availability targets are design goals and have not been measured in a production deployment.

---

## About

This implementation demonstrates backend engineering practices relevant to a telemedicine platform: secure authentication, role-based access, database-backed booking correctness, idempotent APIs, auditability, automated testing, and modular architecture.

Built for the **Amrutam Pharmaceuticals Pvt. Ltd. Backend Developer Assignment**.
