# Assignment implementation checklist

| Requirement from assignment              | Implementation                                                                                   | Status                                    |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------ | ----------------------------------------- |
| Node, PostgreSQL, modular services       | Express + TypeScript + Prisma modular monolith                                                   | Done                                      |
| Auth and roles                           | Register/login, patient/doctor/admin RBAC, access JWT, refresh rotation/revocation               | Done                                      |
| Security and MFA                         | Argon2id, TOTP enrollment/verification, rate limiting, validation, headers, CORS                 | Done with deployment work remaining       |
| Availability and booking                 | Doctor slots; serializable booking with atomic conditional slot claim                            | Done                                      |
| Idempotent writes                        | Required idempotency key and replay of same booking                                              | Done                                      |
| Consultation lifecycle and prescriptions | Validated status graph; owner-scoped reads; doctor prescription creation                         | Done                                      |
| Search/filtering                         | Verified doctor specialty/name search and pagination                                             | Done                                      |
| Audit/compliance                         | Consultation, prescription and verification audit records; admin list                            | Done                                      |
| Admin analytics                          | Counts and status grouping                                                                       | Done                                      |
| Core data model                          | Users, patient/doctor profiles, slots, consultations, prescriptions, payments, sessions, audit   | Done                                      |
| OpenAPI and Swagger                      | Runtime OpenAPI 3.1 spec and `/docs`                                                             | Done, concise schemas/responses           |
| Architecture and ER diagrams             | Mermaid diagrams in architecture/data model docs                                                 | Done                                      |
| Retry, partitioning, caching, saga, DR   | Documented strategies; no external job broker/cache                                              | Documented                                |
| Observability                            | JSON Pino logs, request IDs, Prometheus counters/histogram, health/readiness                     | Done; tracing guidance documented         |
| Docker, CI, tests                        | Compose PostgreSQL/API/migration service, GitHub workflow, unit and PostgreSQL integration tests | Done; DB tests need PostgreSQL to execute |
| Performance goals                        | Indexed access paths and scale plan                                                              | Not benchmarked; no target claims         |
| Demo video                               | Not generated                                                                                    | User can record from README walkthrough   |

## Scope decisions

No GraphQL, Redis, payment provider, or distributed saga is needed for the specified synchronous core. Payment is a pending record only; any future external payment integration should use an outbox and compensating/refund workflow. PostgreSQL is selected as the single writer for booking correctness.
