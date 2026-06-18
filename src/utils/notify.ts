/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Couche NOTIFICATIONS de PLUME (PWA + web) :
 *  - sons distincts par type (synthétisés, aucun fichier audio à charger) ;
 *  - réglages utilisateur (activer/désactiver, volume, par type) ;
 *  - badge de non-lus : titre d'onglet « (3) PLUME », pastille de favicon,
 *    et badge d'icône d'app (Badging API) sur PWA installée ;
 *  - notification système discrète quand l'onglet est en arrière-plan.
 */

export type NotifType = 'message' | 'reply' | 'groupInvite' | 'achievement';

export interface NotifSettings {
  enabled: boolean;          // sons activés globalement
  volume: number;            // 0..1
  types: Record<NotifType, boolean>;
}

const SETTINGS_KEY = 'plume_notif_sound';

const DEFAULTS: NotifSettings = {
  enabled: true,
  volume: 0.6,
  types: { message: true, reply: true, groupInvite: true, achievement: true },
};

export function getNotifSettings(): NotifSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return { ...DEFAULTS };
    const p = JSON.parse(raw);
    return {
      enabled: p.enabled !== false,
      volume: typeof p.volume === 'number' ? Math.min(1, Math.max(0, p.volume)) : DEFAULTS.volume,
      types: { ...DEFAULTS.types, ...(p.types || {}) },
    };
  } catch {
    return { ...DEFAULTS };
  }
}

export function saveNotifSettings(s: NotifSettings): void {
  try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(s)); } catch { /* ignore */ }
}

/* --------- Préférences PAR CATÉGORIE : recevoir ou non l'alerte (son + bannière
   système + toast). Distinct des sons : ici on décide si la notification est
   émise du tout, pour chaque type d'activité. Persisté localement. ----------- */

export type NotifCategory =
  | 'newChapters'   // nouveaux chapitres d'auteurs suivis
  | 'comments'      // commentaires reçus sur mes histoires
  | 'replies'       // réponses à mes commentaires
  | 'followers'     // nouveaux abonnés
  | 'achievements'  // accomplissements débloqués
  | 'dms';          // messages privés

export type NotifCategories = Record<NotifCategory, boolean>;

const CATEGORIES_KEY = 'plume_notif_categories';

const CATEGORY_DEFAULTS: NotifCategories = {
  newChapters: true,
  comments: true,
  replies: true,
  followers: true,
  achievements: true,
  dms: true,
};

export function getNotifCategories(): NotifCategories {
  try {
    const raw = localStorage.getItem(CATEGORIES_KEY);
    if (!raw) return { ...CATEGORY_DEFAULTS };
    const p = JSON.parse(raw);
    return { ...CATEGORY_DEFAULTS, ...(p || {}) };
  } catch {
    return { ...CATEGORY_DEFAULTS };
  }
}

export function saveNotifCategories(c: NotifCategories): void {
  try { localStorage.setItem(CATEGORIES_KEY, JSON.stringify(c)); } catch { /* ignore */ }
}

/** Une catégorie d'alerte est-elle activée par l'utilisateur ? (défaut : oui) */
export function isNotifCategoryEnabled(cat: NotifCategory): boolean {
  return getNotifCategories()[cat] !== false;
}

/* ----------------------------- Sons synthétisés ----------------------------- */

let audioCtx: AudioContext | null = null;
function ctx(): AudioContext | null {
  try {
    if (!audioCtx) {
      const AC = (window.AudioContext || (window as any).webkitAudioContext);
      if (!AC) return null;
      audioCtx = new AC();
    }
    if (audioCtx.state === 'suspended') audioCtx.resume().catch(() => {});
    return audioCtx;
  } catch {
    return null;
  }
}

// Réveille le contexte audio au premier geste (politique navigateur).
let primed = false;
export function primeAudio(): void {
  if (primed) return;
  primed = true;
  const unlock = () => { ctx(); window.removeEventListener('pointerdown', unlock); window.removeEventListener('keydown', unlock); };
  window.addEventListener('pointerdown', unlock, { once: true });
  window.addEventListener('keydown', unlock, { once: true });
}

// Une note simple (sinus/triangle) avec enveloppe douce.
function note(ac: AudioContext, freq: number, start: number, dur: number, gain: number, type: OscillatorType = 'sine') {
  const osc = ac.createOscillator();
  const g = ac.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, ac.currentTime + start);
  g.gain.setValueAtTime(0, ac.currentTime + start);
  g.gain.linearRampToValueAtTime(gain, ac.currentTime + start + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + start + dur);
  osc.connect(g).connect(ac.destination);
  osc.start(ac.currentTime + start);
  osc.stop(ac.currentTime + start + dur + 0.02);
}

// Mélodies courtes et élégantes, distinctes par type.
const MELODIES: Record<NotifType, { f: number; t: number; d: number; type?: OscillatorType }[]> = {
  // Message privé : deux notes douces qui montent.
  message: [
    { f: 880, t: 0, d: 0.16 },
    { f: 1174.7, t: 0.1, d: 0.2 },
  ],
  // Réponse à un commentaire : une note unique, ronde.
  reply: [
    { f: 659.3, t: 0, d: 0.22, type: 'triangle' },
  ],
  // Invitation à un groupe de lecture : petit accord ascendant.
  groupInvite: [
    { f: 587.3, t: 0, d: 0.16 },
    { f: 740, t: 0.09, d: 0.16 },
    { f: 880, t: 0.18, d: 0.24 },
  ],
  // Succès débloqué : arpège brillant.
  achievement: [
    { f: 523.3, t: 0, d: 0.14, type: 'triangle' },
    { f: 659.3, t: 0.1, d: 0.14, type: 'triangle' },
    { f: 784, t: 0.2, d: 0.14, type: 'triangle' },
    { f: 1046.5, t: 0.3, d: 0.32, type: 'triangle' },
  ],
};

export function playNotificationSound(type: NotifType, force = false): void {
  const s = getNotifSettings();
  if (!force && (!s.enabled || !s.types[type])) return;
  const ac = ctx();
  if (!ac) return;
  const vol = Math.max(0.05, Math.min(1, s.volume)) * 0.5;
  for (const n of MELODIES[type]) note(ac, n.f, n.t, n.d, vol, n.type || 'sine');
}

/* --------------------- Badge de non-lus (onglet / icône) -------------------- */

const BASE_TITLE = 'PLUME';
let faviconBase: HTMLImageElement | null = null;

function ensureFaviconBase(): HTMLImageElement {
  if (!faviconBase) {
    faviconBase = new Image();
    faviconBase.crossOrigin = 'anonymous';
    faviconBase.src = '/plume-icon.png';
  }
  return faviconBase;
}

function drawFavicon(count: number): void {
  try {
    const size = 64;
    const canvas = document.createElement('canvas');
    canvas.width = size; canvas.height = size;
    const c = canvas.getContext('2d');
    if (!c) return;
    const img = ensureFaviconBase();
    const paint = () => {
      c.clearRect(0, 0, size, size);
      try { c.drawImage(img, 0, 0, size, size); } catch { /* image pas prête */ }
      if (count > 0) {
        const r = 22;
        c.beginPath();
        c.arc(size - r + 4, r - 4, r, 0, Math.PI * 2);
        c.fillStyle = '#ef4444';
        c.fill();
        c.fillStyle = '#fff';
        c.font = 'bold 34px sans-serif';
        c.textAlign = 'center';
        c.textBaseline = 'middle';
        c.fillText(count > 9 ? '9+' : String(count), size - r + 4, r - 2);
      }
      let link = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
      if (!link) { link = document.createElement('link'); link.rel = 'icon'; document.head.appendChild(link); }
      link.type = 'image/png';
      link.href = canvas.toDataURL('image/png');
    };
    if (img.complete && img.naturalWidth) paint();
    else img.onload = paint;
  } catch { /* ignore */ }
}

/** Met à jour le titre d'onglet, la pastille de favicon et le badge d'icône PWA. */
export function setUnreadBadge(count: number): void {
  const n = Math.max(0, Math.floor(count || 0));
  document.title = n > 0 ? `(${n > 99 ? '99+' : n}) ${BASE_TITLE}` : BASE_TITLE;
  drawFavicon(n);
  try {
    if ('setAppBadge' in navigator) {
      n > 0 ? (navigator as any).setAppBadge(n).catch(() => {}) : (navigator as any).clearAppBadge().catch(() => {});
    }
  } catch { /* ignore */ }
}

/* ----------------- Notification système (arrière-plan, discrète) ------------ */

export function notificationPermission(): NotificationPermission {
  try { return ('Notification' in window) ? Notification.permission : 'denied'; } catch { return 'denied'; }
}

export async function requestNotificationPermission(): Promise<NotificationPermission> {
  try {
    if (!('Notification' in window)) return 'denied';
    if (Notification.permission === 'granted' || Notification.permission === 'denied') return Notification.permission;
    return await Notification.requestPermission();
  } catch {
    return 'denied';
  }
}

interface AppNotifPayload {
  title: string;
  body: string;
  conversationId?: string;
  groupId?: string;
}

/**
 * Affiche une notification système UNIQUEMENT si l'onglet n'est pas au premier
 * plan (sinon l'app gère déjà l'affichage en interne — plus discret). Le clic
 * ouvre la conversation concernée.
 */
export async function showAppNotification(type: NotifType, payload: AppNotifPayload): Promise<void> {
  try {
    if (document.visibilityState === 'visible') return;
    if (notificationPermission() !== 'granted') return;
    const data = { conversationId: payload.conversationId || '', groupId: payload.groupId || '', type };
    const options: NotificationOptions = {
      body: payload.body,
      icon: '/app-icon.png',
      badge: '/app-icon.png',
      tag: payload.conversationId || payload.groupId || type,
      data,
    } as any;

    // Préfère le Service Worker (notification persistante + clic géré par le SW).
    if ('serviceWorker' in navigator) {
      const reg = await navigator.serviceWorker.getRegistration();
      if (reg) { await reg.showNotification(payload.title, options); return; }
    }
    const n = new Notification(payload.title, options);
    n.onclick = () => {
      window.focus();
      window.dispatchEvent(new CustomEvent('plume:push-open', { detail: data }));
      n.close();
    };
  } catch { /* ignore */ }
}
