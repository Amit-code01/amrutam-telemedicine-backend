import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../database/client.js';
import { authenticate } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import { asyncHandler } from '../../utils/async-handler.js';

export const userRoutes = Router();
userRoutes.get(
  '/me',
  authenticate,
  asyncHandler(async (req, res) => {
    const user = await prisma.user.findUniqueOrThrow({
      where: { id: req.identity!.userId },
      select: { id: true, email: true, role: true, createdAt: true, patient: true, doctor: true },
    });
    res.json({ data: user });
  }),
);
userRoutes.patch(
  '/me',
  authenticate,
  validate(
    z.object({
      body: z
        .object({
          fullName: z.string().min(2).max(160).optional(),
          phone: z.string().max(32).optional(),
          dateOfBirth: z.iso.datetime().optional(),
        })
        .refine((value) => Object.keys(value).length > 0),
    }),
  ),
  asyncHandler(async (req, res) => {
    const body = req.body as { fullName?: string; phone?: string; dateOfBirth?: string };
    let data;
    if (req.identity!.role === 'PATIENT')
      data = await prisma.patientProfile.update({
        where: { userId: req.identity!.userId },
        data: { ...body, ...(body.dateOfBirth ? { dateOfBirth: new Date(body.dateOfBirth) } : {}) },
      });
    else if (req.identity!.role === 'DOCTOR')
      data = await prisma.doctorProfile.update({
        where: { userId: req.identity!.userId },
        data: { ...(body.fullName ? { fullName: body.fullName } : {}) },
      });
    else
      return res
        .status(403)
        .json({ error: { code: 'FORBIDDEN', message: 'Admin profile editing is not supported here' } });
    res.json({ data });
  }),
);
