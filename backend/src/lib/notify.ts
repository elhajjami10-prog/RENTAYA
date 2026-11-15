import { prisma } from '../db.js';

/**
 * Notifications : en base (centre de notifications de l'app) + push Expo.
 * Email / SMS : branchez votre fournisseur dans sendSms / sendEmail.
 */
export async function notify(userId: string, type: string, title: string, body: string, data?: Record<string, unknown>) {
  const n = await prisma.notification.create({ data: { userId, type, title, body, data: data as never } });
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { pushToken: true, notifyPush: true } });
  if (user?.pushToken && user.notifyPush) {
    fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ to: user.pushToken, title, body, data: { ...data, type } }),
    }).catch(() => {});
  }
  return n;
}

export async function sendSms(phone: string, text: string) {
  // TODO: brancher un fournisseur SMS marocain (ex. via API HTTP) — en dev, on affiche le message.
  console.log(`[SMS → ${phone}] ${text}`);
}

export async function sendEmail(to: string, subject: string, text: string) {
  console.log(`[EMAIL → ${to}] ${subject}\n${text}`);
}

/** Ajoute un message système dans la conversation de la réservation. */
export async function systemMessage(bookingId: string, body: string) {
  const conv = await prisma.conversation.findUnique({ where: { bookingId } });
  if (!conv) return;
  await prisma.message.create({ data: { conversationId: conv.id, body, system: true } });
  await prisma.conversation.update({ where: { id: conv.id }, data: { lastMessageAt: new Date() } });
}
