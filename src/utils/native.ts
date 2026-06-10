/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Initialisation spécifique au build natif (Capacitor). No-op en web.
 * - masque le splash screen une fois l'app prête ;
 * - applique le style de la barre d'état ;
 * - marque <html> de la classe `native-app` pour activer la gestion des
 *   safe-areas (encoche / barre d'état / home indicator) via CSS.
 */

import { Capacitor } from '@capacitor/core';

export async function initNative(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;

  document.documentElement.classList.add('native-app');

  try {
    const { StatusBar, Style } = await import('@capacitor/status-bar');
    await StatusBar.setStyle({ style: Style.Dark });
  } catch {
    /* plugin indisponible : on ignore */
  }

  try {
    const { SplashScreen } = await import('@capacitor/splash-screen');
    await SplashScreen.hide();
  } catch {
    /* plugin indisponible : on ignore */
  }

  // Bouton retour physique (Android) : on laisse l'app fermer l'overlay/onglet
  // courant via le handler enregistré ; s'il n'a rien à fermer, on quitte l'app.
  try {
    const { App: CapApp } = await import('@capacitor/app');
    CapApp.addListener('backButton', () => {
      const handled = (window as any).__plumeHandleBack?.() === true;
      if (!handled) CapApp.exitApp();
    });
  } catch {
    /* plugin indisponible : on ignore */
  }
}
