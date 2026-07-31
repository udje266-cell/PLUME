// Télémétrie de lecture (Phase 0 du moteur de recommandation).
//
// Objectif : capter le COMPORTEMENT de lecture (progression, temps réel passé,
// vitesse, complétion, abandon) — les signaux honnêtes et coûteux à truquer sur
// lesquels tout le moteur reposera. On accumule les événements et on les envoie
// par PAQUETS (jamais une requête par paragraphe) ; l'envoi passe par le fetch
// patché de l'app (URL backend + jeton d'auth injectés automatiquement).
//
// Règle d'or : la télémétrie ne doit JAMAIS dégrader la lecture. Tout est
// silencieux et non bloquant ; un échec réseau se re-tente au prochain flush.

import { Capacitor } from '@capacitor/core';

export type EventType =
  | 'read_start' | 'read_progress' | 'read_end' | 'complete' | 'abandon'
  | 'vote' | 'favorite' | 'comment' | 'share' | 'follow' | 'quote';

interface QueuedEvent {
  type: EventType;
  storyId: string;
  chapterId?: string;
  sessionId: string;
  payload?: Record<string, number | string>;
}

const MAX_QUEUE = 40;         // au-delà, on force un envoi
const FLUSH_INTERVAL = 15000; // envoi périodique (ms)

let queue: QueuedEvent[] = [];
let timer: ReturnType<typeof setTimeout> | null = null;
let sessionId = '';

function getSessionId(): string {
  if (!sessionId) {
    // Identifiant de session (regroupe les events d'une même séance de lecture).
    sessionId = 's_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
  }
  return sessionId;
}

function schedule() {
  if (timer) return;
  timer = setTimeout(() => { timer = null; flushEvents(); }, FLUSH_INTERVAL);
}

/** Enfile un événement de lecture. Envoi automatique par paquets. */
export function trackEvent(
  type: EventType,
  storyId: string,
  opts: { chapterId?: string; payload?: Record<string, number | string> } = {},
): void {
  if (!storyId) return;
  queue.push({
    type,
    storyId,
    chapterId: opts.chapterId,
    sessionId: getSessionId(),
    payload: { ...(opts.payload || {}), device: Capacitor.isNativePlatform() ? 'app' : 'web' },
  });
  if (queue.length >= MAX_QUEUE) flushEvents();
  else schedule();
}

/** Envoie le lot en attente. Ré-empile en cas d'échec (best-effort). */
export function flushEvents(): void {
  if (!queue.length) return;
  const batch = queue;
  queue = [];
  if (timer) { clearTimeout(timer); timer = null; }
  try {
    // keepalive : permet à la requête d'aboutir même si la page se ferme /
    // l'app passe en arrière-plan pendant l'envoi.
    fetch('/api/events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ events: batch }),
      keepalive: true,
    }).catch(() => { queue = batch.concat(queue); });
  } catch {
    queue = batch.concat(queue);
  }
}

// Envoi de sécurité quand l'utilisateur quitte / met l'app en arrière-plan.
if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flushEvents();
  });
  window.addEventListener('pagehide', () => flushEvents());
}
