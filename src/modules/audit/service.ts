import { Prisma } from '@prisma/client';
import { prisma } from '../../database/client.js';

export async function recordAudit(input: {
  actorId?: string;
  action: string;
  entityType: string;
  entityId?: string;
  requestId?: string;
  metadata?: object;
}): Promise<void> {
  await prisma.auditLog.create({
    data: {
      action: input.action,
      entityType: input.entityType,
      ...(input.actorId ? { actor: { connect: { id: input.actorId } } } : {}),
      ...(input.entityId ? { entityId: input.entityId } : {}),
      ...(input.requestId ? { requestId: input.requestId } : {}),
      ...(input.metadata ? { metadata: input.metadata as Prisma.InputJsonValue } : {}),
    },
  });
}
