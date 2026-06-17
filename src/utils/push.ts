/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Notifications push natives (FCM) côté client. No-op en web : seules les
 * plateformes natives (Capacitor/APK) enregistrent un jeton d'appareil et
 * reçoivent des notifications même application FERMÉE.
 *
 * Nécessite Firebase configuré côté Android (google-services.json) et côté
 * serveur (FIREBASE_SERVICE_ACCOUNT). Sans cela, l'enregistrement échoue
 * silencieusement et l'app continue de fonctionner normalement.
 */

import { Capacitor } from '@capacitor/core';
import { authHeaders } from './auth';

let registered = false;

export async function initPushNotifications(): Promise<void> {
  if (registered || !Capacitor.isNativePlatform()) return;
  registered = true;
  try {
    const { PushNotifications } = await import('@capacitor/push-notifications');

    // Demande la permission (Android 13+ exige POST_NOTIFICATIONS).
    let perm = await PushNotifications.checkPermissions();
    if (perm.receive === 'prompt' || perm.receive === 'prompt-with-rationale') {
      perm = await PushNotifications.requestPermissions();
    }
    if (perm.receive !== 'granted') {
      console.log('[PUSH] Permission refusée — pas de notifications push.');
      return;
    }

    // Jeton FCM reçu → on l'envoie au serveur.
    await PushNotifications.addListener('registration', async (token) => {
      try {
        await fetch('/api/devices/register', {
          method: 'POST',
          headers: authHeaders({ 'Content-Type': 'application/json' }),
          body: JSON.stringify({ token: token.value, platform: Capacitor.getPlatform() }),
        });
        console.log('[PUSH] Appareil enregistré pour les notifications.');
      } catch (e) {
        console.error('[PUSH] Échec de l’envoi du jeton au serveur :', e);
      }
    });

    await PushNotifications.addListener('registrationError', (err) => {
      console.error('[PUSH] Erreur d’enregistrement FCM :', err);
    });

    // Tap sur une notification (app fermée/en arriere-plan) → on demande a l'app
    // d'ouvrir la conversation / le groupe concerne.
    await PushNotifications.addListener('pushNotificationActionPerformed', (action) => {
      const data = (action?.notification?.data || {}) as Record<string, string>;
      window.dispatchEvent(new CustomEvent('plume:push-open', { detail: data }));
    });

    // Lance l'enregistrement auprès de FCM.
    await PushNotifications.register();
  } catch (error) {
    console.error('[PUSH] Initialisation impossible :', error);
  }
}
