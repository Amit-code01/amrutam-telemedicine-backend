import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../utils/async-handler.js';
import { authenticate, requireRoles } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import { prisma } from '../../database/client.js';
import { searchDoctors, updateDoctor } from './service.js';

export const doctorRoutes = Router();
doctorRoutes.get(
  '/',
  validate(
    z.object({
      query: z.object({
        specialty: z.string().optional(),
        q: z.string().max(100).optional(),
        page: z.coerce.number().int().min(1).default(1),
        pageSize: z.coerce.number().int().min(1).max(100).default(20),
      }),
    }),
  ),
  asyncHandler(async (req, res) =>
    res.json({ data: await searchDoctors(req.validatedData?.query as never) }),
  ),
);
doctorRoutes.get(
  '/:id/availability',
  validate(
    z.object({
      params: z.object({ id: z.uuid() }),
      query: z.object({ from: z.iso.datetime(), to: z.iso.datetime() }),
    }),
  ),
  asyncHandler(async (req, res) => {
    const query = req.query as { from: string; to: string };
    const from = new Date(query.from);
    const to = new Date(query.to);
    if (from >= to || to.getTime() - from.getTime() > 90 * 86400_000)
      return res
        .status(400)
        .json({ error: { code: 'BAD_REQUEST', message: 'Invalid date range (maximum 90 days)' } });
    const doctor = await prisma.doctorProfile.findUnique({ where: { id: req.params.id as string } });
    if (!doctor || !doctor.isVerified)
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Doctor not found' } });
    const data = await prisma.availabilitySlot.findMany({
      where: {
        doctorId: doctor.id,
        isActive: true,
        startsAt: { gte: from, lt: to },
        isBooked: false,
      },
      orderBy: { startsAt: 'asc' },
    });
    res.json({ data });
  }),
);
doctorRoutes.patch(
  '/me',
  authenticate,
  requireRoles('DOCTOR'),
  validate(
    z.object({
      body: z.object({
        fullName: z.string().min(2).max(160).optional(),
        specialty: z.string().max(100).optional(),
        bio: z.string().max(2000).optional(),
        consultationFee: z.number().int().min(0).max(1000000).optional(),
      }),
    }),
  ),
  asyncHandler(async (req, res) =>
    res.json({ data: await updateDoctor(req.identity!.userId, req.body as never) }),
  ),
);
