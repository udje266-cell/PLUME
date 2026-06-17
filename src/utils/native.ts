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

/**
 * Aligne le style de la barre d'etat (heure / wifi / batterie) sur le theme :
 * - mode clair : icones SOMBRES (Style.Light) ;
 * - mode sombre : icones CLAIRES (Style.Dark).
 * No-op hors natif. Appelable a chaque changement de theme.
 */
export async function applyStatusBarTheme(dark: boolean): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  try {
    const { StatusBar, Style } = await import('@capacitor/status-bar');
    // La WebView ne passe PLUS sous la barre d'etat : Android reserve l'espace
    // -> plus aucun chevauchement avec l'heure / wifi / batterie.
    await StatusBar.setOverlaysWebView({ overlay: false });
    await StatusBar.setStyle({ style: dark ? Style.Dark : Style.Light });
    await StatusBar.setBackgroundColor({ color: dark ? '#000000' : '#FFFFFF' });
  } catch {
    /* plugin indisponible : on ignore */
  }
}

export async function initNative(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;

  document.documentElement.classList.add('native-app');

  // Style de la barre d'etat selon le theme courant (icones sombres sur fond
  // clair, icones claires sur fond sombre).
  await applyStatusBarTheme(document.documentElement.classList.contains('dark'));

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
