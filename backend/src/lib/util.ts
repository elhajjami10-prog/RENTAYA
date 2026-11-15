import crypto from 'node:crypto';
import type { User } from '@prisma/client';

export const genRef = (prefix: string) =>
  `${prefix}-${new Date().toISOString().slice(2, 10).replace(/-/g, '')}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;

export const genCode = (len = 8) => crypto.randomBytes(len).toString('base64url').replace(/[-_]/g, '').slice(0, len).toUpperCase();

/** Profil public (aucune donnée sensible). */
export const publicUser = (u: User) => ({
  id: u.id,
  firstName: u.firstName,
  lastName: u.lastName ? u.lastName[0] + '.' : '',
  avatarUrl: u.avatarUrl,
  bio: u.bio,
  city: u.city,
  isPro: u.isPro,
  companyName: u.companyName,
  verified: u.verificationStatus === 'VERIFIED',
  phoneVerified: u.phoneVerified,
  ratingAvg: u.ratingAvg,
  ratingCount: u.ratingCount,
  responseRate: u.responseRate,
  responseTimeMin: u.responseTimeMin,
  language: u.language,
  createdAt: u.createdAt,
});

/** Profil privé (propriétaire du compte). */
export const privateUser = (u: User) => {
  const { passwordHash, phoneOtp, phoneOtpExpires, resetToken, resetTokenExpires, ...rest } = u;
  void passwordHash; void phoneOtp; void phoneOtpExpires; void resetToken; void resetTokenExpires;
  return rest;
};

export const parseDate = (s: unknown) => {
  const d = new Date(String(s));
  return isNaN(d.getTime()) ? null : d;
};

/** Distance en km (formule de haversine). */
export function distanceKm(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

export const ACTIVE_BOOKING_STATUSES = ['REQUESTED', 'PENDING_PAYMENT', 'CONFIRMED', 'IN_PROGRESS'] as const;
/** Statuts qui bloquent le calendrier du véhicule (une simple demande ne bloque pas). */
export const BLOCKING_STATUSES = ['PENDING_PAYMENT', 'CONFIRMED', 'IN_PROGRESS'] as const;
