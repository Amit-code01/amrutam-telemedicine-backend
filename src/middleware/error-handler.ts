import type { ErrorRequestHandler } from 'express';
import { ZodError } from 'zod';
import { Prisma } from '@prisma/client';
import { AppError } from '../utils/errors.js';

export const errorHandler: ErrorRequestHandler = (error: unknown, req, res, next) => {
  void next;
  req.log?.error(
    { errorName: error instanceof Error ? error.name : 'UnknownError', requestId: req.id },
    'request failed',
  );
  if (error instanceof AppError)
    return res
      .status(error.statusCode)
      .json({ error: { code: error.code, message: error.message, requestId: req.id } });
  if (error instanceof ZodError)
    return res
      .status(400)
      .json({ error: { code: 'VALIDATION_ERROR', message: 'Invalid request data', requestId: req.id } });
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002')
    return res.status(409).json({
      error: { code: 'CONFLICT', message: 'A record with these details already exists', requestId: req.id },
    });
  return res
    .status(500)
    .json({ error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred', requestId: req.id } });
};
