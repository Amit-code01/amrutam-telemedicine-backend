import { createHash, randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { Role } from '@prisma/client';
import { createApp } from '../../src/app.js';
import { createAccessToken } from '../../src/middleware/auth.js';
import { prisma } from '../../src/database/client.js';
import { rotateRefreshToken } from '../../src/modules/auth/service.js';

describe('PostgreSQL booking invariants', () => {
  const app = createApp();
  const suffix = randomUUID();
  const patientEmail = `patient-${suffix}@example.test`;
  const otherEmail = `other-${suffix}@example.test`;
  const doctorEmail = `doctor-${suffix}@example.test`;
  let patientId = '';
  let otherPatientId = '';
  let doctorUserId = '';
  let patientProfileId = '';
  let otherProfileId = '';
  let doctorProfileId = '';
  let slotOne = '';
  let slotTwo = '';
  let patientToken = '';
  let otherToken = '';
  let databaseAvailable = false;

  beforeAll(async () => {
    if (process.env.RUN_DB_TESTS !== '1') return;
    await prisma.$connect();
    databaseAvailable = true;
    const [patient, other, doctor] = await Promise.all([
      prisma.user.create({ data: { email: patientEmail, passwordHash: 'test', role: Role.PATIENT } }),
      prisma.user.create({ data: { email: otherEmail, passwordHash: 'test', role: Role.PATIENT } }),
      prisma.user.create({ data: { email: doctorEmail, passwordHash: 'test', role: Role.DOCTOR } }),
    ]);
    patientId = patient.id;
    otherPatientId = other.id;
    doctorUserId = doctor.id;
    const [patientProfile, otherProfile, doctorProfile] = await Promise.all([
      prisma.patientProfile.create({ data: { userId: patient.id, fullName: 'Test Patient' } }),
      prisma.patientProfile.create({ data: { userId: other.id, fullName: 'Other Patient' } }),
      prisma.doctorProfile.create({
        data: { userId: doctor.id, fullName: 'Test Doctor', specialty: 'General Medicine', isVerified: true },
      }),
    ]);
    patientProfileId = patientProfile.id;
    otherProfileId = otherProfile.id;
    doctorProfileId = doctorProfile.id;
    const start = new Date(Date.now() + 7 * 86400_000);
    start.setUTCMinutes(0, 0, 0);
    const slots = await Promise.all(
      [0, 1].map((index) =>
        prisma.availabilitySlot.create({
          data: {
            doctorId: doctorProfile.id,
            startsAt: new Date(start.getTime() + index * 3600_000),
            endsAt: new Date(start.getTime() + (index + 0.5) * 3600_000),
          },
        }),
      ),
    );
    slotOne = slots[0]!.id;
    slotTwo = slots[1]!.id;
    patientToken = await createAccessToken({ userId: patient.id, role: Role.PATIENT });
    otherToken = await createAccessToken({ userId: other.id, role: Role.PATIENT });
  });

  afterAll(async () => {
    if (!databaseAvailable) return;
    const ids = [patientProfileId, otherProfileId].filter(Boolean);
    if (ids.length) await prisma.consultation.deleteMany({ where: { patientId: { in: ids } } });
    if (doctorProfileId) {
      await prisma.consultation.deleteMany({ where: { doctorId: doctorProfileId } });
      await prisma.availabilitySlot.deleteMany({ where: { doctorId: doctorProfileId } });
      await prisma.doctorProfile.deleteMany({ where: { id: doctorProfileId } });
    }
    await prisma.patientProfile.deleteMany({ where: { id: { in: ids } } });
    await prisma.user.deleteMany({
      where: { id: { in: [patientId, otherPatientId, doctorUserId].filter(Boolean) } },
    });
    await prisma.$disconnect();
  });

  it('replays the same idempotency key and rejects key reuse for a different slot', async ({ skip }) => {
    if (!databaseAvailable) skip();
    const key = `same-${suffix}`;
    const requests = await Promise.all([
      request(app)
        .post('/api/v1/consultations')
        .set('authorization', `Bearer ${patientToken}`)
        .set('Idempotency-Key', key)
        .send({ slotId: slotOne }),
      request(app)
        .post('/api/v1/consultations')
        .set('authorization', `Bearer ${patientToken}`)
        .set('Idempotency-Key', key)
        .send({ slotId: slotOne }),
    ]);
    expect(requests.map((result) => result.status)).toEqual([201, 201]);
    expect(requests[1]!.body.data.id).toBe(requests[0]!.body.data.id);
    await request(app)
      .post('/api/v1/consultations')
      .set('authorization', `Bearer ${patientToken}`)
      .set('Idempotency-Key', key)
      .send({ slotId: slotTwo })
      .expect(409);
  });

  it('allows only one of two simultaneous requests to book a slot', async ({ skip }) => {
    if (!databaseAvailable) skip();
    const results = await Promise.all([
      request(app)
        .post('/api/v1/consultations')
        .set('authorization', `Bearer ${patientToken}`)
        .set('Idempotency-Key', `race-a-${suffix}`)
        .send({ slotId: slotTwo }),
      request(app)
        .post('/api/v1/consultations')
        .set('authorization', `Bearer ${patientToken}`)
        .set('Idempotency-Key', `race-b-${suffix}`)
        .send({ slotId: slotTwo }),
    ]);
    expect(results.map((result) => result.status).sort()).toEqual([201, 409]);
  });

  it('denies access to another patient and releases canceled slot for rebooking', async ({ skip }) => {
    if (!databaseAvailable) skip();
    const consultation = await prisma.consultation.findFirstOrThrow({ where: { slotId: slotOne } });
    await request(app)
      .get(`/api/v1/consultations/${consultation.id}`)
      .set('authorization', `Bearer ${otherToken}`)
      .expect(403);
    await request(app)
      .patch(`/api/v1/consultations/${consultation.id}/status`)
      .set('authorization', `Bearer ${patientToken}`)
      .send({ status: 'CANCELLED' })
      .expect(200);
    const replacement = await request(app)
      .post('/api/v1/consultations')
      .set('authorization', `Bearer ${otherToken}`)
      .set('Idempotency-Key', `rebook-${suffix}`)
      .send({ slotId: slotOne })
      .expect(201);
    expect(replacement.body.data.status).toBe('BOOKED');
  });

  it('rejects expired and revoked refresh tokens', async ({ skip }) => {
    if (!databaseAvailable) skip();
    const expiredToken = `expired-${suffix}`;
    const revokedToken = `revoked-${suffix}`;
    const tokenHash = (token: string) => createHash('sha256').update(token).digest('hex');
    await prisma.refreshToken.createMany({
      data: [
        { userId: patientId, tokenHash: tokenHash(expiredToken), expiresAt: new Date(Date.now() - 1000) },
        {
          userId: patientId,
          tokenHash: tokenHash(revokedToken),
          expiresAt: new Date(Date.now() + 60_000),
          revokedAt: new Date(),
        },
      ],
    });
    await expect(rotateRefreshToken(expiredToken)).rejects.toMatchObject({ statusCode: 401 });
    await expect(rotateRefreshToken(revokedToken)).rejects.toMatchObject({ statusCode: 401 });
  });
});
