import 'dotenv/config';
import argon2 from 'argon2';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Admin bootstrap is disabled when NODE_ENV=production');
  }

  const databaseUrl = process.env.DATABASE_URL;
  const email = process.env.ADMIN_BOOTSTRAP_EMAIL?.trim().toLowerCase();
  const password = process.env.ADMIN_BOOTSTRAP_PASSWORD;
  if (!databaseUrl || !email || !password) {
    throw new Error('Set DATABASE_URL, ADMIN_BOOTSTRAP_EMAIL, and ADMIN_BOOTSTRAP_PASSWORD');
  }
  if (password.length < 12 || password.length > 128) {
    throw new Error('Admin password must be between 12 and 128 characters');
  }

  const databaseHost = new URL(databaseUrl).hostname.toLowerCase();
  if (!['localhost', '127.0.0.1', '::1', '[::1]', 'postgres'].includes(databaseHost)) {
    throw new Error('Admin bootstrap only runs against a local PostgreSQL host');
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error('ADMIN_BOOTSTRAP_EMAIL must be a valid email address');
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    throw new Error('That email already exists; no account was changed. Choose a new local admin email.');
  }

  const passwordHash = await argon2.hash(password, { type: argon2.argon2id });
  await prisma.user.create({ data: { email, passwordHash, role: 'ADMIN' } });
  console.info(`Created local ADMIN account for ${email}. Password was not displayed.`);
}

try {
  await main();
} finally {
  await prisma.$disconnect();
}
