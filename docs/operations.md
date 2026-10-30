# Operations

## Local operation

Use Node 22 and Docker Compose. Copy `.env.example`, set a random `JWT_ACCESS_SECRET`, start `docker compose up -d postgres`, install `npm ci`, run `npm run db:generate`, `npm run db:migrate`, then `npm run dev`. `/health` checks process liveness; `/ready` checks PostgreSQL. Swagger is `/docs`; metrics are `/metrics`; JSON logs include request IDs and omit tokens/passwords.

For Compose API deployment, set `JWT_ACCESS_SECRET` in `.env` before `docker compose up --build`. The container applies `prisma migrate deploy`, then starts the API. Development seed is `npm run db:seed`; it creates only `.test` users and future slots, using `SEED_PASSWORD`. Never seed production.

## Migrations, backup and DR

Review migration SQL and test against a production-like copy before release. Deploy additive migrations first, deploy code, backfill in bounded batches, then apply removals later. Take a verified encrypted PostgreSQL backup before migration. Local backup example: `docker compose exec -T postgres pg_dump -U amrutam amrutam > backup.sql`; restore into an isolated database with `psql`. Production should use managed encrypted snapshots plus point-in-time recovery/WAL archiving, a separate account/region copy, documented RPO/RTO, and scheduled restore drills. Never put backup files in source control.

## Logs, metrics and troubleshooting

Prometheus scrape `/metrics` for `http_requests_total` and `http_request_duration_seconds`; route labels are bounded to API modules and never include user or medical identifiers. Pino emits JSON to stdout. Trace a report using `requestId` returned in API errors and logged per request. OpenTelemetry is not wired into the assignment app; production can add the Node SDK with OTLP exporter and trace Prisma/HTTP calls without capturing request bodies.

- `/ready` failing: inspect database URL, PostgreSQL health, network and connection saturation.
- 409 on booking: refresh slot list; another request or same slot may have won.
- Repeated 401 after refresh: old refresh token is single-use; store and use the replacement.
- Slow API: examine histogram, Postgres `EXPLAIN (ANALYZE, BUFFERS)`, lock waits, pool saturation and query counts.
- For performance validation use a local `k6`/`autocannon` workload with realistic read/write mix, burst booking for shared slots, and production-like data volume. Record p50/p95/p99, error rate, CPU, pool wait and DB I/O. Targets have not been measured here.

## Deployment considerations

Run multiple stateless app replicas behind TLS ingress; configure trusted proxies before relying on IP rate limits. Bound Prisma pools across replicas and use a pooler if connection count exceeds database limits. Store secrets in managed secrets, run non-root containers, scan dependencies/images, expose readiness/liveness, set resource limits and alert on error rate, latency, pool saturation, database storage and backup age. Use PostgreSQL as the booking system of record; analytics may use replicas after accounting for replication lag.
