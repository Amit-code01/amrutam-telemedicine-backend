import { jwtVerify, SignJWT } from 'jose';
import type { RequestHandler } from 'express';
import { env } from '../config/env.js';
import { forbidden, unauthorized } from '../utils/errors.js';
import type { Role } from '@prisma/client';

const key = new TextEncoder().encode(env.JWT_ACCESS_SECRET);
export type Identity = { userId: string; role: Role };
declare global {
  // Express does not expose a typed slot for Zod's parsed request shape.
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      identity?: Identity;
      validatedData?: { body: unknown; query: unknown; params: unknown };
    }
  }
}

export async function createAccessToken(identity: Identity): Promise<string> {
  return new SignJWT({ role: identity.role })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(identity.userId)
    .setIssuedAt()
    .setExpirationTime(`${env.ACCESS_TOKEN_TTL_SECONDS}s`)
    .sign(key);
}

export const authenticate: RequestHandler = (req, _res, next) => {
  const authorization = req.header('authorization');
  if (!authorization?.startsWith('Bearer ')) return next(unauthorized());
  void jwtVerify(authorization.slice(7), key)
    .then(({ payload }) => {
      if (typeof payload.sub !== 'string' || typeof payload.role !== 'string') return next(unauthorized());
      req.identity = { userId: payload.sub, role: payload.role as Role };
      next();
    })
    .catch(() => next(unauthorized()));
};

export const requireRoles =
  (...roles: Role[]): RequestHandler =>
  (req, _res, next) => {
    if (!req.identity) return next(unauthorized());
    if (!roles.includes(req.identity.role)) return next(forbidden());
    next();
  };
