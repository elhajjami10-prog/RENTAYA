import type { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';

export class HttpError extends Error {
  constructor(public status: number, public code: string, message?: string) {
    super(message || code);
  }
}

export const badRequest = (code: string, msg?: string) => new HttpError(400, code, msg);
export const notFound = (code = 'NOT_FOUND') => new HttpError(404, code);
export const forbidden = (code = 'FORBIDDEN') => new HttpError(403, code);

/** Enveloppe un handler async pour transmettre les erreurs à Express. */
export const ah =
  (fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>) =>
  (req: Request, res: Response, next: NextFunction) =>
    fn(req, res, next).catch(next);

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof ZodError) {
    return res.status(400).json({ error: 'VALIDATION_ERROR', details: err.flatten() });
  }
  if (err instanceof HttpError) {
    return res.status(err.status).json({ error: err.code, message: err.message });
  }
  console.error(err);
  res.status(500).json({ error: 'SERVER_ERROR' });
}
