import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import pino from 'pino';
import { pinoHttp } from 'pino-http';
import swaggerUi from 'swagger-ui-express';
import { randomUUID } from 'node:crypto';
import { env } from './config/env.js';
import { prisma } from './database/client.js';
import { registry, requestDuration, requestsTotal } from './observability/metrics.js';
import { openapi } from './openapi.js';
import { authRoutes } from './modules/auth/routes.js';
import { userRoutes } from './modules/users/routes.js';
import { doctorRoutes } from './modules/doctors/routes.js';
import { availabilityRoutes } from './modules/availability/routes.js';
import { consultationRoutes } from './modules/consultations/routes.js';
import { adminRoutes } from './modules/admin/routes.js';
import { errorHandler } from './middleware/error-handler.js';

export const logger = pino({
  level: env.LOG_LEVEL,
  redact: [
    'req.headers.authorization',
    'req.body.password',
    'req.body.refreshToken',
    'res.headers["set-cookie"]',
  ],
});
export function createApp() {
  const app = express();
  app.disable('x-powered-by');
  app.use(helmet());
  app.use(cors({ origin: env.CORS_ORIGIN.split(',').map((value) => value.trim()), credentials: true }));
  app.use(express.json({ limit: '32kb' }));
  app.use(
    pinoHttp({
      logger,
      genReqId: (req) => req.headers['x-request-id']?.toString().slice(0, 100) || randomUUID(),
      customLogLevel: (_req, res, error) => (error || res.statusCode >= 500 ? 'error' : 'info'),
    }),
  );
  app.use(
    rateLimit({
      windowMs: env.RATE_LIMIT_WINDOW_MS,
      limit: env.RATE_LIMIT_MAX,
      standardHeaders: 'draft-8',
      legacyHeaders: false,
    }),
  );
  app.use((req, res, next) => {
    const routePrefixes = [
      '/api/v1/auth',
      '/api/v1/users',
      '/api/v1/doctors',
      '/api/v1/availability',
      '/api/v1/consultations',
      '/api/v1/admin',
    ];
    const route =
      routePrefixes.find((prefix) => req.path === prefix || req.path.startsWith(`${prefix}/`)) ??
      (['/health', '/ready', '/metrics', '/docs', '/openapi.json'].includes(req.path)
        ? req.path
        : 'unmatched');
    const end = requestDuration.startTimer({ method: req.method, route });
    res.on('finish', () => {
      requestsTotal.inc({ method: req.method, route, status: res.statusCode });
      end();
    });
    next();
  });
  app.get('/health', (_req, res) => res.json({ status: 'ok' }));
  app.get('/ready', async (_req, res) => {
    try {
      await prisma.$queryRaw`SELECT 1`;
      res.json({ status: 'ready' });
    } catch {
      res.status(503).json({ status: 'not_ready' });
    }
  });
  app.get('/metrics', async (_req, res) => {
    res.setHeader('Content-Type', registry.contentType);
    res.end(await registry.metrics());
  });
  app.use('/docs', swaggerUi.serve, swaggerUi.setup(openapi));
  app.get('/openapi.json', (_req, res) => res.json(openapi));
  app.use(
    '/api/v1/auth',
    rateLimit({ windowMs: 15 * 60_000, limit: 20, standardHeaders: 'draft-8', legacyHeaders: false }),
    authRoutes,
  );
  app.use('/api/v1/users', userRoutes);
  app.use('/api/v1/doctors', doctorRoutes);
  app.use('/api/v1/availability', availabilityRoutes);
  app.use('/api/v1/consultations', consultationRoutes);
  app.use('/api/v1/admin', adminRoutes);
  app.use((_req, res) => res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Route not found' } }));
  app.use(errorHandler);
  return app;
}
