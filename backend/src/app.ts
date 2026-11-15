import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import { errorHandler } from './middleware/error.js';
import { UPLOAD_DIR } from './middleware/upload.js';
import auth from './routes/auth.js';
import users from './routes/users.js';
import cars from './routes/cars.js';
import bookings from './routes/bookings.js';
import payments from './routes/payments.js';
import messages from './routes/messages.js';
import account from './routes/account.js';
import pub from './routes/public.js';
import admin from './routes/admin.js';

export function createApp() {
  const app = express();
  app.set('trust proxy', 1);
  app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' }, contentSecurityPolicy: false }));
  app.use(cors());
  app.use(compression());
  app.use(express.json({ limit: '5mb' }));
  if (process.env.NODE_ENV !== 'test') app.use(morgan('dev'));
  app.use('/uploads', express.static(UPLOAD_DIR, { maxAge: '30d' }));
  app.use('/api/auth', rateLimit({ windowMs: 15 * 60_000, limit: 100 }));

  app.get('/api/health', (_req, res) => res.json({ ok: true }));
  app.use('/api/auth', auth);
  app.use('/api/users', users);
  app.use('/api/cars', cars);
  app.use('/api/bookings', bookings);
  app.use('/api/payments', payments);
  app.use('/api/conversations', messages);
  app.use('/api/account', account);
  app.use('/api/public', pub);
  app.use('/api/admin', admin);
  app.use(errorHandler);
  return app;
}
