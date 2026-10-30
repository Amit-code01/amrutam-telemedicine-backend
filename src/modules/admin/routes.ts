import { Router } from 'express';
import { prisma } from '../../database/client.js';
import { authenticate, requireRoles } from '../../middleware/auth.js';
import { asyncHandler } from '../../utils/async-handler.js';
import { validate } from '../../middleware/validate.js';
import { z } from 'zod';

export const adminRoutes = Router();
adminRoutes.use(authenticate, requireRoles('ADMIN'));
adminRoutes.get(
  '/analytics',
  asyncHandler(async (_req, res) => {
    const [users, doctors, consultations, statusCounts] = await prisma.$transaction([
      prisma.user.count(),
      prisma.doctorProfile.count(),
      prisma.consultation.count(),
      prisma.consultation.groupBy({ by: ['status'], orderBy: { status: 'asc' }, _count: { _all: true } }),
    ]);
    res.json({
      data: {
        users,
        doctors,
        consultations,
        consultationsByStatus: Object.fromEntries(
          statusCounts.map((row) => [
            row.status,
            row._count && typeof row._count === 'object' ? (row._count._all ?? 0) : 0,
          ]),
        ),
      },
    });
  }),
);
adminRoutes.get(
  '/audit-logs',
  asyncHandler(async (req, res) => {
    const page = Math.max(1, Number(req.query.page) || 1);
    const pageSize = Math.min(100, Math.max(1, Number(req.query.pageSize) || 50));
    const [items, total] = await prisma.$transaction([
      prisma.auditLog.findMany({
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.auditLog.count(),
    ]);
    res.json({ data: { items, page, pageSize, total } });
  }),
);
adminRoutes.patch(
  '/doctors/:id/verification',
  validate(z.object({ params: z.object({ id: z.uuid() }), body: z.object({ verified: z.boolean() }) })),
  asyncHandler(async (req, res) => {
    const verified = req.body?.verified;
    const data = await prisma.$transaction(async (tx) => {
      const doctor = await tx.doctorProfile.update({
        where: { id: req.params.id as string },
        data: { isVerified: verified },
      });
      await tx.auditLog.create({
        data: {
          actor: { connect: { id: req.identity!.userId } },
          action: verified ? 'DOCTOR_VERIFIED' : 'DOCTOR_UNVERIFIED',
          entityType: 'DoctorProfile',
          entityId: doctor.id,
          requestId: String(req.id),
        },
      });
      return doctor;
    });
    res.json({ data: { id: data.id, isVerified: data.isVerified } });
  }),
);
