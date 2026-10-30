import { ConsultationStatus, Prisma } from '@prisma/client';
import { prisma } from '../../database/client.js';
import { badRequest, conflict, forbidden, notFound } from '../../utils/errors.js';

const transitions: Record<ConsultationStatus, ConsultationStatus[]> = {
  BOOKED: ['CONFIRMED', 'CANCELLED'],
  CONFIRMED: ['IN_PROGRESS', 'CANCELLED', 'NO_SHOW'],
  IN_PROGRESS: ['COMPLETED'],
  COMPLETED: [],
  CANCELLED: [],
  NO_SHOW: [],
};
export function canTransition(from: ConsultationStatus, to: ConsultationStatus) {
  return transitions[from].includes(to);
}

export async function bookConsultation(input: {
  patientUserId: string;
  slotId: string;
  reason?: string | undefined;
  idempotencyKey: string;
  requestId?: string;
}) {
  const patient = await prisma.patientProfile.findUnique({ where: { userId: input.patientUserId } });
  if (!patient) throw forbidden();
  try {
    return await prisma.$transaction(
      async (tx) => {
        const existing = await tx.consultation.findUnique({
          where: { idempotencyKey: input.idempotencyKey },
        });
        if (existing) {
          if (existing.patientId !== patient.id || existing.slotId !== input.slotId)
            throw conflict('Idempotency key was already used for a different booking');
          return existing;
        }
        const slot = await tx.availabilitySlot.findUnique({
          where: { id: input.slotId },
          include: { doctor: { select: { isVerified: true } } },
        });
        if (
          !slot ||
          !slot.doctor.isVerified ||
          !slot.isActive ||
          slot.isBooked ||
          slot.startsAt <= new Date()
        )
          throw conflict('This availability slot is no longer bookable');
        const claimed = await tx.availabilitySlot.updateMany({
          where: { id: slot.id, isActive: true, isBooked: false, startsAt: { gt: new Date() } },
          data: { isBooked: true },
        });
        if (claimed.count !== 1) {
          const replay = await tx.consultation.findUnique({
            where: { idempotencyKey: input.idempotencyKey },
          });
          if (replay && replay.patientId === patient.id && replay.slotId === input.slotId) return replay;
          if (replay) throw conflict('Idempotency key was already used for a different booking');
          throw conflict('This availability slot is no longer bookable');
        }
        const booking = await tx.consultation.create({
          data: {
            patientId: patient.id,
            doctorId: slot.doctorId,
            slotId: slot.id,
            idempotencyKey: input.idempotencyKey,
            ...(input.reason ? { reason: input.reason } : {}),
          },
        });
        await tx.payment.create({
          data: {
            consultationId: booking.id,
            amount: (await tx.doctorProfile.findUniqueOrThrow({ where: { id: slot.doctorId } }))
              .consultationFee,
            status: 'PENDING',
          },
        });
        await tx.auditLog.create({
          data: {
            actor: { connect: { id: input.patientUserId } },
            action: 'CONSULTATION_BOOKED',
            entityType: 'Consultation',
            entityId: booking.id,
            ...(input.requestId ? { requestId: input.requestId } : {}),
          },
        });
        return booking;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      const replay = await prisma.consultation.findUnique({
        where: { idempotencyKey: input.idempotencyKey },
      });
      if (replay && replay.patientId === patient.id && replay.slotId === input.slotId) return replay;
      if (replay) throw conflict('Idempotency key was already used for a different booking');
      throw conflict('This slot was booked concurrently; refresh availability');
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2034') {
      const replay = await prisma.consultation.findUnique({
        where: { idempotencyKey: input.idempotencyKey },
      });
      if (replay && replay.patientId === patient.id && replay.slotId === input.slotId) return replay;
      throw conflict('This slot was booked concurrently; refresh availability');
    }
    throw error;
  }
}

export async function changeStatus(input: {
  consultationId: string;
  actorUserId: string;
  role: 'DOCTOR' | 'PATIENT' | 'ADMIN';
  next: ConsultationStatus;
  requestId?: string;
}) {
  return prisma.$transaction(async (tx) => {
    const current = await tx.consultation.findUnique({
      where: { id: input.consultationId },
      include: { doctor: true, patient: true },
    });
    if (!current) throw notFound('Consultation not found');
    const authorized =
      input.role === 'ADMIN' ||
      (input.role === 'DOCTOR' && current.doctor.userId === input.actorUserId) ||
      (input.role === 'PATIENT' &&
        current.patient.userId === input.actorUserId &&
        input.next === 'CANCELLED');
    if (!authorized) throw forbidden();
    if (!canTransition(current.status, input.next))
      throw badRequest(`Cannot transition consultation from ${current.status} to ${input.next}`);
    if (input.next === 'CANCELLED' && current.slotId)
      await tx.availabilitySlot.update({ where: { id: current.slotId }, data: { isBooked: false } });
    const updated = await tx.consultation.update({
      where: { id: current.id },
      data: { status: input.next, ...(input.next === 'CANCELLED' ? { cancelledAt: new Date() } : {}) },
    });
    await tx.auditLog.create({
      data: {
        actor: { connect: { id: input.actorUserId } },
        action: `CONSULTATION_${input.next}`,
        entityType: 'Consultation',
        entityId: current.id,
        ...(input.requestId ? { requestId: input.requestId } : {}),
        metadata: { from: current.status, to: input.next },
      },
    });
    return updated;
  });
}

export async function getConsultation(userId: string, role: string, id: string) {
  const record = await prisma.consultation.findUnique({
    where: { id },
    include: { patient: true, doctor: true, slot: true, prescription: true },
  });
  if (!record) throw notFound('Consultation not found');
  const patientAccess = role === 'PATIENT' && record.patient.userId === userId;
  const doctorAccess = role === 'DOCTOR' && record.doctor.userId === userId;
  if (!patientAccess && !doctorAccess && role !== 'ADMIN') throw forbidden();
  return record;
}

export async function createPrescription(input: {
  consultationId: string;
  doctorUserId: string;
  content: object;
  requestId?: string;
}) {
  return prisma.$transaction(async (tx) => {
    const consultation = await tx.consultation.findUnique({
      where: { id: input.consultationId },
      include: { doctor: true },
    });
    if (
      !consultation ||
      consultation.doctor.userId !== input.doctorUserId ||
      !['IN_PROGRESS', 'COMPLETED'].includes(consultation.status)
    )
      throw forbidden();
    const prescription = await tx.prescription.create({
      data: { consultationId: input.consultationId, content: input.content as Prisma.InputJsonValue },
    });
    await tx.auditLog.create({
      data: {
        actor: { connect: { id: input.doctorUserId } },
        action: 'PRESCRIPTION_CREATED',
        entityType: 'Prescription',
        entityId: prescription.id,
        ...(input.requestId ? { requestId: input.requestId } : {}),
      },
    });
    return prescription;
  });
}
