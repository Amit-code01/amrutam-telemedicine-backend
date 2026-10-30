import { Router } from 'express';
import { ConsultationStatus } from '@prisma/client';
import { z } from 'zod';
import { authenticate, requireRoles } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import { asyncHandler } from '../../utils/async-handler.js';
import { prisma } from '../../database/client.js';
import * as service from './service.js';

export const consultationRoutes = Router();
consultationRoutes.use(authenticate);
consultationRoutes.post(
  '/',
  requireRoles('PATIENT'),
  validate(z.object({ body: z.object({ slotId: z.uuid(), reason: z.string().max(1000).optional() }) })),
  asyncHandler(async (req, res) => {
    const key = req.header('idempotency-key');
    if (!key || key.length > 128)
      return res.status(400).json({
        error: { code: 'BAD_REQUEST', message: 'Idempotency-Key header is required (max 128 characters)' },
      });
    res.status(201).json({
      data: await service.bookConsultation({
        patientUserId: req.identity!.userId,
        slotId: req.body.slotId as string,
        reason: req.body.reason as string | undefined,
        idempotencyKey: key,
        requestId: String(req.id),
      }),
    });
  }),
);
consultationRoutes.get(
  '/',
  asyncHandler(async (req, res) => {
    const page = Math.max(1, Number(req.query.page) || 1);
    const pageSize = Math.min(100, Math.max(1, Number(req.query.pageSize) || 20));
    const user = req.identity!;
    const where =
      user.role === 'PATIENT'
        ? { patient: { userId: user.userId } }
        : user.role === 'DOCTOR'
          ? { doctor: { userId: user.userId } }
          : {};
    const [items, total] = await prisma.$transaction([
      prisma.consultation.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.consultation.count({ where }),
    ]);
    res.json({ data: { items, page, pageSize, total } });
  }),
);
consultationRoutes.get(
  '/:id',
  validate(z.object({ params: z.object({ id: z.uuid() }) })),
  asyncHandler(async (req, res) =>
    res.json({
      data: await service.getConsultation(req.identity!.userId, req.identity!.role, req.params.id as string),
    }),
  ),
);
consultationRoutes.patch(
  '/:id/status',
  requireRoles('DOCTOR', 'PATIENT', 'ADMIN'),
  validate(
    z.object({ params: z.object({ id: z.uuid() }), body: z.object({ status: z.enum(ConsultationStatus) }) }),
  ),
  asyncHandler(async (req, res) =>
    res.json({
      data: await service.changeStatus({
        consultationId: req.params.id as string,
        actorUserId: req.identity!.userId,
        role: req.identity!.role,
        next: req.body.status as ConsultationStatus,
        requestId: String(req.id),
      }),
    }),
  ),
);
consultationRoutes.post(
  '/:id/prescriptions',
  requireRoles('DOCTOR'),
  validate(
    z.object({
      params: z.object({ id: z.uuid() }),
      body: z.object({ content: z.record(z.string(), z.unknown()) }),
    }),
  ),
  asyncHandler(async (req, res) =>
    res.status(201).json({
      data: await service.createPrescription({
        consultationId: req.params.id as string,
        doctorUserId: req.identity!.userId,
        content: req.body.content as object,
        requestId: String(req.id),
      }),
    }),
  ),
);
consultationRoutes.get(
  '/:id/prescriptions',
  validate(z.object({ params: z.object({ id: z.uuid() }) })),
  asyncHandler(async (req, res) => {
    await service.getConsultation(req.identity!.userId, req.identity!.role, req.params.id as string);
    const data = await prisma.prescription.findUnique({ where: { consultationId: req.params.id as string } });
    res.json({ data });
  }),
);
