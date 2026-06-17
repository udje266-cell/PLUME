/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Initialisation PWA (web uniquement — no-op dans l'APK Capacitor natif) :
 *  - enregistrement du Service Worker (notifications push + cache léger) ;
 *  - capture de l'invite d'installation (« Ajouter à l'écran d'accueil ») ;
 *  - abonnement Web Push (si une clé VAPID publique est fournie par le serveur).
 */

import { Capacitor } from '@capacitor/core';
import { authHeaders } from './auth';

let deferredPrompt: any = null;
let swReg: ServiceWorkerRegistration | null = null;
const installListeners = new Set<(can: boolean) => void>();

export function isNativeApp(): boolean {
  try { return Capacitor.isNativePlatform(); } catch { return false; }
}

export function isStandalone(): boolean {
  try {
    return window.matchMedia('(display-mode: standalone)').matches
      || (navigator as any).standalone === true;
  } catch { return false; }
}

export function isIos(): boolean {
  return /iphone|ipad|ipod/i.test(navigator.userAgent)
    || (navigator.platform === 'MacIntel' && (navigator as any).maxTouchPoints > 1);
}

export function canInstall(): boolean {
  return !!deferredPrompt;
}

export function onInstallAvailability(cb: (can: boolean) => void): () => void {
  installListeners.add(cb);
  cb(canInstall());
  return () => installListeners.delete(cb);
}
function emitInstall() { installListeners.forEach((cb) => cb(canInstall())); }

/** Déclenche l'invite native d'installation (Android / desktop). */
export async function promptInstall(): Promise<boolean> {
  if (!deferredPrompt) return false;
  const p = deferredPrompt;
  deferredPrompt = null;
  emitInstall();
  try {
    p.prompt();
    const choice = await p.userChoice;
    return choice?.outcome === 'accepted';
  } catch {
    return false;
  }
}

function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(b64);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return arr;
}

/** Abonne le navigateur aux Web Push si le serveur fournit une clé VAPID. */
export async function subscribeWebPush(): Promise<void> {
  try {
    if (!swReg || !('PushManager' in window)) return;
    if (Notification.permission !== 'granted') return;
    const res = await fetch('/api/push/vapid');
    if (!res.ok) return;
    const { key } = await res.json();
    if (!key) return; // Web Push non configuré côté serveur : on s'arrête (sans erreur).

    const existing = await swReg.pushManager.getSubscription();
    const sub = existing || await swReg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(key),
    });
    await fetch('/api/devices/register', {
      method: 'POST',
      headers: authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ token: JSON.stringify(sub), platform: 'web' }),
    });
  } catch (e) {
    console.warn('[PWA] Web Push indisponible :', e);
  }
}

/** Initialise la PWA. À appeler une fois au démarrage (web uniquement). */
export async function initPWA(): Promise<void> {
  if (isNativeApp()) return; // l'APK gère déjà push & install nativement
  if (!('serviceWorker' in navigator)) return;

  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    emitInstall();
  });
  window.addEventListener('appinstalled', () => { deferredPrompt = null; emitInstall(); });

  // Relaye les clics de notification (gérés par le SW) vers l'app.
  navigator.serviceWorker.addEventListener('message', (event) => {
    const d = event.data || {};
    if (d.type === 'plume-open-chat') {
      window.dispatchEvent(new CustomEvent('plume:push-open', {
        detail: { conversationId: d.conversationId || '', groupId: d.groupId || '' },
      }));
    }
  });

  try {
    swReg = await navigator.serviceWorker.register('/sw.js');
  } catch (e) {
    console.warn('[PWA] Service Worker non enregistré :', e);
  }
}

/** Tente l'abonnement Web Push après que l'utilisateur a accordé la permission. */
export async function ensureWebPush(): Promise<void> {
  if (isNativeApp()) return;
  if (!swReg) {
    try { swReg = await navigator.serviceWorker.ready; } catch { return; }
  }
  await subscribeWebPush();
}
