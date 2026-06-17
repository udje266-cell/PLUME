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

/* --------------------------- Web Push (PWA / navigateur) --------------------- */
// Activé si VAPID_PUBLIC_KEY + VAPID_PRIVATE_KEY sont définis. Génère une paire
// avec : npx web-push generate-vapid-keys
let webpushLib: any = null;
let webpushReady = false;
async function getWebPush(): Promise<any | null> {
  if (webpushReady) return webpushLib;
  webpushReady = true;
  try {
    const pub = process.env.VAPID_PUBLIC_KEY;
    const priv = process.env.VAPID_PRIVATE_KEY;
    if (!pub || !priv) {
      console.log('[PUSH] Web Push non configuré (VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY absents).');
      return null;
    }
    const mod = await import('web-push');
    const wp = (mod as any).default || mod;
    wp.setVapidDetails(process.env.VAPID_SUBJECT || 'mailto:contact@plume.app', pub, priv);
    webpushLib = wp;
    console.log('[PUSH] Web Push (VAPID) actif — notifications navigateur / iOS PWA.');
    return wp;
  } catch (error) {
    console.error('[PUSH] Échec init Web Push :', error);
    return null;
  }
}

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
  if (!userId) return;
  const devices = await prisma.deviceToken.findMany({ where: { userId }, select: { token: true, platform: true } }).catch(() => [] as any[]);
  if (!devices.length) return;

  const webSubs = devices.filter((d: any) => d.platform === 'web');
  const fcmTokens = devices.filter((d: any) => d.platform !== 'web').map((d: any) => d.token);

  // 1) Web Push (PWA navigateur / iOS) — payload JSON lu par le Service Worker.
  if (webSubs.length) {
    try {
      const wp = await getWebPush();
      if (wp) {
        const body = JSON.stringify({
          title: payload.title,
          body: payload.body,
          conversationId: payload.data?.conversationId || '',
          groupId: payload.data?.groupId || '',
          type: payload.data?.type || '',
        });
        const stale: string[] = [];
        await Promise.all(webSubs.map(async (d: any) => {
          try {
            await wp.sendNotification(JSON.parse(d.token), body, { TTL: 600 });
          } catch (err: any) {
            if (err?.statusCode === 404 || err?.statusCode === 410) stale.push(d.token);
          }
        }));
        if (stale.length) await prisma.deviceToken.deleteMany({ where: { token: { in: stale } } }).catch(() => {});
      }
    } catch (error) {
      console.error('[PUSH] Web Push erreur :', error);
    }
  }

  // 2) FCM (Android natif) — inchangé.
  if (!fcmTokens.length) return;
  try {
    const messaging = await getMessaging();
    if (!messaging) return;
    const tokens = fcmTokens;

    // Les notifications de MESSAGE sont envoyées en DATA-ONLY : ainsi le service
    // natif Android (PlumeMessagingService) est invoqué même app fermée et peut
    // construire une notification avec les actions « Répondre » et « Marquer
    // comme lu ». Les autres notifications utilisent le payload `notification`
    // standard (affiché directement par le système).
    const data: Record<string, string> = { ...(payload.data || {}), title: payload.title, body: payload.body };
    const isMessage = data.category === 'message';
    const message: any = {
      tokens,
      data,
      android: { priority: 'high' as const },
    };
    if (!isMessage) {
      message.notification = { title: payload.title, body: payload.body };
      message.android.notification = { sound: 'default', channelId: 'plume_default' };
    }
    const res = await messaging.sendEachForMulticast(message);

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
