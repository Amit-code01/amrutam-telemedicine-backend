import type { RequestHandler } from 'express';
import type { ZodType } from 'zod';
import { badRequest } from '../utils/errors.js';

export const validate =
  (schema: ZodType): RequestHandler =>
  (req, _res, next) => {
    const result = schema.safeParse({ body: req.body, query: req.query, params: req.params });
    if (!result.success)
      return next(
        badRequest(
          result.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`).join('; '),
        ),
      );
    const parsed = result.data as { body?: unknown; query?: unknown; params?: unknown };
    req.validatedData = { body: parsed.body, query: parsed.query, params: parsed.params };
    if (parsed.body !== undefined) req.body = parsed.body;
    next();
  };
