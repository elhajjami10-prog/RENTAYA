import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config.js';
import { prisma } from '../db.js';
import type { User } from '@prisma/client';
import { HttpError } from './error.js';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: User;
    }
  }
}

export function signToken(userId: string) {
  return jwt.sign({ sub: userId }, config.jwtSecret, { expiresIn: '30d' });
}

async function resolveUser(req: Request) {
  const h = req.headers.authorization;
  const token = h?.startsWith('Bearer ') ? h.slice(7) : (req.query.token as string | undefined);
  if (!token) return null;
  try {
    const payload = jwt.verify(token, config.jwtSecret) as { sub: string };
    return await prisma.user.findUnique({ where: { id: payload.sub } });
  } catch {
    return null;
  }
}

export async function optionalAuth(req: Request, _res: Response, next: NextFunction) {
  const u = await resolveUser(req);
  if (u && !u.suspended) req.user = u;
  next();
}

export async function requireAuth(req: Request, _res: Response, next: NextFunction) {
  const u = await resolveUser(req);
  if (!u) return next(new HttpError(401, 'UNAUTHORIZED'));
  if (u.suspended) return next(new HttpError(403, 'ACCOUNT_SUSPENDED'));
  req.user = u;
  next();
}

export function requireAdmin(req: Request, _res: Response, next: NextFunction) {
  if (req.user?.role !== 'ADMIN') return next(new HttpError(403, 'ADMIN_ONLY'));
  next();
}

/** Utilisateur authentifié (à utiliser après requireAuth). */
export const me = (req: Request) => req.user as User;
