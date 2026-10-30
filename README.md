# Amrutam Telemedicine Backend

A production-oriented telemedicine backend built with **TypeScript, Express, Prisma, and PostgreSQL** for the Amrutam Backend Developer Assignment.

The system supports patient and doctor workflows, doctor availability, consultation booking, consultation lifecycle management, prescriptions, role-based access control, audit logging, and administrative analytics.

The implementation focuses on reliable booking workflows, secure access to healthcare data, and maintainable backend architecture. PostgreSQL is the source of truth for booking concurrency, while idempotency controls help prevent duplicate consultation creation.

## Key Features

- **Authentication and authorization:** JWT authentication, role-based access control, refresh-token rotation, and TOTP-based MFA support.
- **Doctor discovery:** Search and filter doctors by supported criteria.
- **Availability management:** Doctors can manage their consultation slots.
- **Consultation booking:** Patient booking flow with idempotency and database-backed concurrency handling.
- **Consultation lifecycle:** Manage consultation status transitions and prescription workflows.
- **Auditability:** Audit events for relevant operations, with sensitive health information excluded from audit metadata.
- **Admin functionality:** Administrative routes and analytics.
- **API documentation:** Swagger UI and a raw OpenAPI specification.
- **Automated quality checks:** TypeScript type checking, linting, formatting checks, unit tests, integration tests, and CI.
- **Containerized development:** Docker Compose setup with PostgreSQL and migration support.

## Engineering Highlights

### Reliable consultation booking

Booking is one of the most critical workflows in a telemedicine system. Two patients should not be able to book the same doctor slot, and retrying a request should not create duplicate consultations.

The backend uses:

- PostgreSQL as the authoritative persistence layer.
- Database constraints and transaction-based booking logic.
- Idempotency keys for consultation creation.
- Validation of slot availability before booking.
- Integration tests for booking and access-control behavior.

This approach prioritizes correctness over relying only on application-level checks.

### Security and healthcare data protection

The backend includes:

- Short-lived access JWTs.
- Hashed refresh tokens with rotation and revocation.
- Argon2id password hashing.
- TOTP-based MFA support.
- Role-based access control.
- Request validation and rate limiting.
- Audit logging with sensitive-data exclusions.
- Resource-level access checks.

Production deployment still requires infrastructure-level controls such as HTTPS, encryption at rest, secrets management, backup policies, and security review.

### Maintainable architecture

The project uses a modular monolith architecture. Domain modules separate authentication, users, doctors, availability, consultations, administration, and audit functionality.

This keeps the application straightforward to develop and deploy while providing clear module boundaries for future scaling.

## Technology Stack

| Area | Technologies |
|---|---|
| Runtime | Node.js 22 |
| Language | TypeScript, strict mode |
| API | Express 5, REST |
| Database | PostgreSQL 17 |
| ORM and migrations | Prisma 6 |
| Validation | Zod |
| Authentication | JWT, jose, Argon2id, TOTP MFA |
| Security | Helmet, CORS, rate limiting, RBAC |
| Logging | Pino structured JSON logs |
| Metrics | Prometheus |
| API documentation | Swagger UI, OpenAPI |
| Testing | Vitest, Supertest |
| Infrastructure | Docker, Docker Compose |
| CI | GitHub Actions |

## Architecture and Project Structure

The backend follows a modular monolith architecture with clear separation between domain logic, HTTP routes, middleware, and persistence.

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

## Assignment Coverage

The following summarizes the implementation and documentation based on the current project.

| Assignment requirement | Current coverage |
|---|---|
| Authentication and roles | Implemented |
| Doctor availability | Implemented |
| Consultation booking | Implemented with idempotency and concurrency handling |
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
| Production tracing, alerting, and performance validation | Requires further deployment-level validation |

See `docs/assignment-checklist.md` for the requirement-by-requirement checklist.

## Run Locally

### Prerequisites

- Node.js 22
- Docker and Docker Compose
- npm

### Setup

1. Clone the repository.

   ```bash
   git clone https://github.com/YOUR_USERNAME/amrutam-telemedicine-backend.git
   cd amrutam-telemedicine-backend
   ```

2. Copy the example environment file.

   ```powershell
   Copy-Item .env.example .env
   ```

3. Configure the environment variables. Replace `JWT_ACCESS_SECRET` with a random secret of at least 32 characters. The included database credentials are for local development only.

4. Start PostgreSQL.

   ```bash
   docker compose up -d postgres
   ```

5. Install dependencies and generate the Prisma client.

   ```bash
   npm ci
   npm run db:generate
   ```

6. Apply database migrations.

   ```bash
   npm run db:migrate
   ```

7. Optionally seed development data.

   ```bash
   npm run db:seed
   ```

8. Start the API.

   ```bash
   npm run dev
   ```

### Local Endpoints

| Resource | URL |
|---|---|
| API | `http://localhost:3000` |
| Swagger UI | `http://localhost:3000/docs` |
| OpenAPI specification | `http://localhost:3000/openapi.json` |
| Prometheus metrics | `http://localhost:3000/metrics` |
| Liveness | `http://localhost:3000/health` |
| Readiness | `http://localhost:3000/ready` |

## Docker Setup

To build and start the application using Docker Compose:

```bash
docker compose up --build
```

The Compose configuration runs the migration service before starting the API.

To inspect running services:

```bash
docker compose ps
```

To view API logs:

```bash
docker compose logs -f api
```

To stop the local services:

```bash
docker compose down
```

To reset local development data, use:

```bash
docker compose down -v
```

**Warning:** The `-v` option deletes the local database volume and its data. Do not use it if you need to preserve your database.

## Testing and Quality

The project includes unit tests and integration tests for important backend behavior.

Run the quality checks:

```bash
npm run typecheck
npm run lint
npm run format:check
npm run test:unit
npm run test:integration
npm run build
```

Database-dependent integration tests require a disposable PostgreSQL database and migrations.

PowerShell:

```powershell
$env:RUN_DB_TESTS='1'
npm run test:integration
```

Bash:

```bash
RUN_DB_TESTS=1 npm run test:integration
```

The database-specific suite is skipped unless `RUN_DB_TESTS=1` is set. CI provisions PostgreSQL and enables the integration suite.

Never run integration tests against a production database.

## Example API Flow

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

Use the returned access token as a Bearer token for authenticated requests.

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

The idempotency key identifies the booking request and helps protect against duplicate submissions.

### 4. Manage doctor availability

Doctors can create availability slots using:

```http
POST /api/v1/availability
Authorization: Bearer <doctor-access-token>
Content-Type: application/json
```

The request uses ISO-8601 start and end timestamps.

For the complete endpoint list and request schemas, use Swagger UI at `/docs`.

## Environment Variables

| Variable | Description |
|---|---|
| `DATABASE_URL` | PostgreSQL connection URL |
| `JWT_ACCESS_SECRET` | JWT signing secret |
| `ACCESS_TOKEN_TTL_SECONDS` | Access-token lifetime; default 900 seconds |
| `REFRESH_TOKEN_TTL_DAYS` | Refresh-token lifetime; default 30 days |
| `PORT` | API port; default 3000 |
| `CORS_ORIGIN` | Comma-separated allowed origins |
| `RATE_LIMIT_WINDOW_MS` | Rate-limit window |
| `RATE_LIMIT_MAX` | Maximum requests per window |
| `LOG_LEVEL` | Logging level |
| `NODE_ENV` | Application environment |
| `SEED_PASSWORD` | Development seed password |

Do not commit `.env` files or real credentials. Use `.env.example` for documented placeholder values.

## Documentation

The `docs/` directory contains supporting design and operational documentation.

- `docs/architecture.md` — architecture, booking sequence, transactions, scaling, and disaster recovery.
- `docs/data-model.md` — ER model, database constraints, and indexes.
- `docs/security.md` — security controls and recommendations.
- `docs/threat-model.md` — threat scenarios and mitigations.
- `docs/operations.md` — migrations, backups, metrics, and performance-test guidance.
- `docs/assignment-checklist.md` — assignment requirement mapping.

## Observability

The application uses structured JSON logging through Pino and exposes Prometheus metrics through its metrics endpoint.

Docker logs can be inspected using:

```bash
docker compose logs --tail=100 api
```

Metrics can be inspected at:

```text
http://localhost:3000/metrics
```

Distributed tracing, alerting, and production monitoring require deployment-level configuration and validation. The README does not claim production SLOs have been measured.

## Security and Known Limitations

This project is designed with security and reliability in mind, but a local assignment implementation is not equivalent to a fully audited production healthcare platform.

Production readiness still requires:

- Production secrets management and key rotation.
- HTTPS and encryption at rest.
- Backup and restore validation.
- Alerting and operational dashboards.
- Dependency and container vulnerability scanning.
- MFA recovery and email verification workflows.
- Data retention and deletion policies.
- External security review.
- Load testing against the assignment's performance targets.

Payment is represented as a pending ledger record. A real payment processor or payment API was not specified in the assignment.

The assignment's performance and availability targets are design goals and have not been measured in a production deployment.

## About This Implementation

This project demonstrates backend engineering decisions relevant to a telemedicine platform: secure authentication, role-based access, database-backed booking correctness, idempotent APIs, auditability, automated testing, and modular architecture.

The goal is not just to expose endpoints, but to build a backend that can be understood, tested, operated, and extended safely.
