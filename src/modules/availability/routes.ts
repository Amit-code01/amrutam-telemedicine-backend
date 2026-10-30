import { Router } from 'express';
import { z } from 'zod';
import { authenticate, requireRoles } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import { asyncHandler } from '../../utils/async-handler.js';
import { prisma } from '../../database/client.js';
import { addSlot } from './service.js';

export const availabilityRoutes = Router();
availabilityRoutes.post(
  '/',
  authenticate,
  requireRoles('DOCTOR'),
  validate(
    z.object({
      body: z.object({
        startsAt: z.iso.datetime().transform((v) => new Date(v)),
        endsAt: z.iso.datetime().transform((v) => new Date(v)),
        timezone: z
          .string()
          .min(1)
          .max(64)
          .default('UTC')
          .refine((zone) => {
            try {
              new Intl.DateTimeFormat('en-US', { timeZone: zone });
              return true;
            } catch {
              return false;
            }
          }, 'Unknown IANA time zone'),
      }),
    }),
  ),
  asyncHandler(async (req, res) =>
    res.status(201).json({ data: await addSlot(req.identity!.userId, req.body as never) }),
  ),
);
availabilityRoutes.delete(
  '/:id',
  authenticate,
  requireRoles('DOCTOR'),
  validate(z.object({ params: z.object({ id: z.uuid() }) })),
  asyncHandler(async (req, res) => {
    const doctor = await prisma.doctorProfile.findUniqueOrThrow({ where: { userId: req.identity!.userId } });
    const updated = await prisma.$transaction(async (tx) => {
      const result = await tx.availabilitySlot.updateMany({
        where: { id: req.params.id as string, doctorId: doctor.id, isBooked: false },
        data: { isActive: false },
      });
      if (result.count)
        await tx.auditLog.create({
          data: {
            actor: { connect: { id: req.identity!.userId } },
            action: 'AVAILABILITY_SLOT_DEACTIVATED',
            entityType: 'AvailabilitySlot',
            entityId: req.params.id as string,
            requestId: String(req.id),
          },
        });
      return result.count;
    });
    if (!updated)
      return res
        .status(409)
        .json({ error: { code: 'CONFLICT', message: 'Slot is missing or already booked' } });
    res.status(204).end();
  }),
);
