/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Notifications push (Firebase Cloud Messaging) — pour recevoir des alertes
 * même quand l'application est FERMÉE.
 *
 * Activation : définir la variable d'environnement `FIREBASE_SERVICE_ACCOUNT`
 * avec le JSON du compte de service Firebase (en une seule ligne), ou
 * `GOOGLE_APPLICATION_CREDENTIALS` pointant vers le fichier. Sans configuration,
 * tout est un NO-OP silencieux : l'app fonctionne normalement, sans push.
 */

import { prisma } from './prisma';

let messagingPromise: Promise<any | null> | null = null;

async function getMessaging(): Promise<any | null> {
  if (messagingPromise) return messagingPromise;
  messagingPromise = (async () => {
    try {
      const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
      const hasAppCreds = !!process.env.GOOGLE_APPLICATION_CREDENTIALS;
      if (!raw && !hasAppCreds) {
        console.log('[PUSH] FCM non configuré (FIREBASE_SERVICE_ACCOUNT absent) — push désactivé.');
        return null;
      }
      const { initializeApp, cert, applicationDefault, getApps } = await import('firebase-admin/app');
      const { getMessaging } = await import('firebase-admin/messaging');
      const credential = raw ? cert(JSON.parse(raw)) : applicationDefault();
      if (!getApps().length) {
        initializeApp({ credential });
      }
      console.log('[PUSH] Firebase Admin initialisé — notifications push actives.');
      return getMessaging();
    } catch (error) {
      console.error('[PUSH] Échec de l’initialisation Firebase Admin :', error);
      return null;
    }
  })();
  return messagingPromise;
}

export interface PushPayload {
  title: string;
  body: string;
  data?: Record<string, string>;
}

/**
 * Envoie une notification push à TOUS les appareils d'un utilisateur. Best-effort,
 * jamais bloquant. Les jetons invalides sont purgés automatiquement.
 */
export async function sendPushToUser(userId: string, payload: PushPayload): Promise<void> {
  try {
    const messaging = await getMessaging();
    if (!messaging || !userId) return;

    const devices = await prisma.deviceToken.findMany({ where: { userId }, select: { token: true } });
    if (!devices.length) return;
    const tokens = devices.map((d) => d.token);

    const res = await messaging.sendEachForMulticast({
      tokens,
      notification: { title: payload.title, body: payload.body },
      data: payload.data || {},
      android: { priority: 'high', notification: { sound: 'default', channelId: 'plume_default' } },
    });

    // Purge les jetons devenus invalides (app désinstallée, etc.).
    const stale: string[] = [];
    res.responses.forEach((r: any, i: number) => {
      if (!r.success) {
        const code = r.error?.code || '';
        if (code.includes('registration-token-not-registered') || code.includes('invalid-argument')) {
          stale.push(tokens[i]);
        }
      }
    });
    if (stale.length) {
      await prisma.deviceToken.deleteMany({ where: { token: { in: stale } } }).catch(() => {});
    }
  } catch (error) {
    console.error('[PUSH] Erreur d’envoi :', error);
  }
}
