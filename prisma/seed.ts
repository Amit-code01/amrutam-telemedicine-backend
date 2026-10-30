import 'dotenv/config';
import argon2 from 'argon2';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const password = process.env.SEED_PASSWORD;
if (!password || password.length < 12)
  throw new Error('Set SEED_PASSWORD to a development-only password of at least 12 characters');
const passwordHash = await argon2.hash(password, { type: argon2.argon2id });

async function upsertUser(email: string, role: 'ADMIN' | 'PATIENT' | 'DOCTOR', fullName: string) {
  const user = await prisma.user.upsert({
    where: { email },
    update: {},
    create: { email, role, passwordHash },
  });
  if (role === 'ADMIN') return user;
  if (role === 'PATIENT')
    await prisma.patientProfile.upsert({
      where: { userId: user.id },
      update: {},
      create: { userId: user.id, fullName },
    });
  if (role === 'DOCTOR')
    await prisma.doctorProfile.upsert({
      where: { userId: user.id },
      update: { isVerified: true },
      create: {
        userId: user.id,
        fullName,
        specialty: 'General Medicine',
        bio: 'Development seed doctor',
        isVerified: true,
      },
    });
  return user;
}

try {
  const admin = await upsertUser('admin@example.test', 'ADMIN', 'Development Admin');
  const patient = await upsertUser('patient@example.test', 'PATIENT', 'Development Patient');
  const doctorUser = await upsertUser('doctor@example.test', 'DOCTOR', 'Development Doctor');
  const doctor = await prisma.doctorProfile.findUniqueOrThrow({ where: { userId: doctorUser.id } });
  const startsAt = new Date(Date.now() + 48 * 60 * 60 * 1000);
  startsAt.setUTCMinutes(0, 0, 0);
  const endsAt = new Date(startsAt.getTime() + 30 * 60 * 1000);
  await prisma.availabilitySlot.upsert({
    where: { doctorId_startsAt_endsAt: { doctorId: doctor.id, startsAt, endsAt } },
    update: { isActive: true },
    create: { doctorId: doctor.id, startsAt, endsAt, timezone: 'UTC' },
  });
  console.info(
    `Development seed ready: ${admin.email}, ${patient.email}, ${doctorUser.email}. Use SEED_PASSWORD from your local environment.`,
  );
} finally {
  await prisma.$disconnect();
}
