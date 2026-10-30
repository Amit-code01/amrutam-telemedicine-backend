import { Prisma } from '@prisma/client';
import { prisma } from '../../database/client.js';
import { badRequest, conflict } from '../../utils/errors.js';

export async function addSlot(userId: string, input: { startsAt: Date; endsAt: Date; timezone: string }) {
  if (
    input.startsAt <= new Date() ||
    input.endsAt <= input.startsAt ||
    input.endsAt.getTime() - input.startsAt.getTime() > 4 * 3600_000
  )
    throw badRequest('Slot must be in the future and no longer than four hours');
  try {
    return await prisma.$transaction(
      async (tx) => {
        const doctor = await tx.doctorProfile.findUniqueOrThrow({ where: { userId } });
        const overlap = await tx.availabilitySlot.findFirst({
          where: {
            doctorId: doctor.id,
            isActive: true,
            startsAt: { lt: input.endsAt },
            endsAt: { gt: input.startsAt },
          },
        });
        if (overlap) throw badRequest('Availability slots cannot overlap');
        const slot = await tx.availabilitySlot.create({ data: { ...input, doctorId: doctor.id } });
        await tx.auditLog.create({
          data: {
            actor: { connect: { id: userId } },
            action: 'AVAILABILITY_SLOT_CREATED',
            entityType: 'AvailabilitySlot',
            entityId: slot.id,
          },
        });
        return slot;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2034')
      throw conflict('Availability changed concurrently; refresh and retry');
    throw error;
  }
}

export async function listSlots(doctorId: string, from: Date, to: Date) {
  return prisma.availabilitySlot.findMany({
    where: {
      doctorId,
      isActive: true,
      startsAt: { gte: from, lt: to },
      isBooked: false,
    },
    orderBy: { startsAt: 'asc' },
  });
}
