import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../utils/async-handler.js';
import { authenticate } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import * as service from './service.js';

export const authRoutes = Router();
const registerSchema = z.object({
  body: z.object({
    email: z.email().toLowerCase(),
    password: z.string().min(12).max(128),
    role: z.enum(['PATIENT', 'DOCTOR']),
    fullName: z.string().min(2).max(160),
    specialty: z.string().max(100).optional(),
  }),
});
authRoutes.post(
  '/register',
  validate(registerSchema),
  asyncHandler(async (req, res) =>
    res
      .status(201)
      .json({ data: await service.register(req.body as z.infer<typeof registerSchema>['body']) }),
  ),
);
const loginSchema = z.object({
  body: z.object({
    email: z.email().toLowerCase(),
    password: z.string().min(1),
    mfaCode: z.string().length(6).optional(),
  }),
});
authRoutes.post(
  '/login',
  validate(loginSchema),
  asyncHandler(async (req, res) =>
    res.json({ data: await service.login(req.body as z.infer<typeof loginSchema>['body']) }),
  ),
);
authRoutes.post(
  '/refresh',
  validate(z.object({ body: z.object({ refreshToken: z.string().min(20) }) })),
  asyncHandler(async (req, res) =>
    res.json({ data: await service.rotateRefreshToken(req.body.refreshToken as string) }),
  ),
);
authRoutes.post(
  '/logout',
  authenticate,
  validate(z.object({ body: z.object({ refreshToken: z.string().min(20) }) })),
  asyncHandler(async (req, res) => {
    await service.logout(req.body.refreshToken as string);
    res.status(204).end();
  }),
);
authRoutes.post(
  '/mfa/setup',
  authenticate,
  asyncHandler(async (req, res) => res.json({ data: await service.beginMfa(req.identity!.userId) })),
);
authRoutes.post(
  '/mfa/confirm',
  authenticate,
  validate(z.object({ body: z.object({ code: z.string().length(6) }) })),
  asyncHandler(async (req, res) => {
    await service.confirmMfa(req.identity!.userId, req.body.code as string);
    res.status(204).end();
  }),
);
