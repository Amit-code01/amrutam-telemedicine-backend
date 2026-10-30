import { createHash, randomBytes } from 'node:crypto';
import argon2 from 'argon2';
import { authenticator } from 'otplib';
import { prisma } from '../../database/client.js';
import { env } from '../../config/env.js';
import { createAccessToken } from '../../middleware/auth.js';
import { conflict, forbidden, unauthorized } from '../../utils/errors.js';
import type { Role } from '@prisma/client';

const digest = (token: string) => createHash('sha256').update(token).digest('hex');
const refreshExpiry = () => new Date(Date.now() + env.REFRESH_TOKEN_TTL_DAYS * 86400_000);

async function issueSession(userId: string, role: Role) {
  const refreshToken = randomBytes(48).toString('base64url');
  await prisma.refreshToken.create({
    data: { userId, tokenHash: digest(refreshToken), expiresAt: refreshExpiry() },
  });
  return { accessToken: await createAccessToken({ userId, role }), refreshToken, tokenType: 'Bearer' };
}

export async function register(input: {
  email: string;
  password: string;
  role: 'PATIENT' | 'DOCTOR';
  fullName: string;
  specialty?: string | undefined;
}) {
  if (await prisma.user.findUnique({ where: { email: input.email } }))
    throw conflict('Email is already registered');
  const passwordHash = await argon2.hash(input.password, { type: argon2.argon2id });
  const user = await prisma.$transaction(async (tx) => {
    const created = await tx.user.create({ data: { email: input.email, passwordHash, role: input.role } });
    if (input.role === 'PATIENT')
      await tx.patientProfile.create({ data: { userId: created.id, fullName: input.fullName } });
    else
      await tx.doctorProfile.create({
        data: {
          userId: created.id,
          fullName: input.fullName,
          specialty: input.specialty ?? 'General Medicine',
        },
      });
    return created;
  });
  return {
    user: { id: user.id, email: user.email, role: user.role },
    ...(await issueSession(user.id, user.role)),
  };
}

export async function login(input: { email: string; password: string; mfaCode?: string | undefined }) {
  const user = await prisma.user.findUnique({ where: { email: input.email } });
  if (!user || !user.isActive || !(await argon2.verify(user.passwordHash, input.password)))
    throw unauthorized();
  if (
    user.mfaEnabled &&
    (!user.mfaSecret ||
      !input.mfaCode ||
      !authenticator.verify({ token: input.mfaCode, secret: user.mfaSecret }))
  )
    throw unauthorized();
  return {
    user: { id: user.id, email: user.email, role: user.role },
    ...(await issueSession(user.id, user.role)),
  };
}

export async function rotateRefreshToken(token: string) {
  const old = await prisma.refreshToken.findUnique({
    where: { tokenHash: digest(token) },
    include: { user: true },
  });
  if (!old || old.revokedAt || old.expiresAt <= new Date() || !old.user.isActive) throw unauthorized();
  const nextToken = randomBytes(48).toString('base64url');
  const next = await prisma.$transaction(async (tx) => {
    const result = await tx.refreshToken.updateMany({
      where: { id: old.id, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    if (result.count !== 1) throw unauthorized();
    const replacement = await tx.refreshToken.create({
      data: { userId: old.userId, tokenHash: digest(nextToken), expiresAt: refreshExpiry() },
    });
    await tx.refreshToken.update({ where: { id: old.id }, data: { replacedById: replacement.id } });
    return replacement;
  });
  return {
    accessToken: await createAccessToken({ userId: old.userId, role: old.user.role }),
    refreshToken: nextToken,
    tokenType: 'Bearer',
    refreshExpiresAt: next.expiresAt,
  };
}

export async function logout(token: string): Promise<void> {
  await prisma.refreshToken.updateMany({
    where: { tokenHash: digest(token), revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

export async function beginMfa(userId: string) {
  const secret = authenticator.generateSecret();
  await prisma.user.update({ where: { id: userId }, data: { mfaSecret: secret, mfaEnabled: false } });
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  return { secret, otpauthUrl: authenticator.keyuri(user.email, 'Amrutam Telemedicine', secret) };
}

export async function confirmMfa(userId: string, code: string) {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  if (!user.mfaSecret || !authenticator.verify({ token: code, secret: user.mfaSecret })) throw forbidden();
  await prisma.user.update({ where: { id: userId }, data: { mfaEnabled: true } });
}
