/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * File d'attente d'actions HORS-LIGNE. Quand le réseau est absent (ou qu'une
 * requête de synchronisation échoue), on met l'action de côté ; elle est rejouée
 * automatiquement au retour de la connexion. Réservée aux actions IDEMPOTENTES
 * (like/unlike, favori, suivi, « lu », note) → un rejeu ne crée pas de doublon.
 */

import { authHeaders } from './auth';

export interface QueuedAction {
  id: string;
  method: 'POST' | 'PUT' | 'DELETE';
  path: string;
  body?: any;
  /** Clé de dédoublonnage : les actions de même clé fusionnent (la dernière gagne). */
  key?: string;
  ts: number;
}

const STORAGE_KEY = 'plume_offline_queue_v1';
const MAX_ITEMS = 300;

function read(): QueuedAction[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

function write(q: QueuedAction[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(q.slice(-MAX_ITEMS)));
  } catch {
    /* stockage indisponible */
  }
}

export function queueLength(): number {
  return read().length;
}

/** Ajoute une action à la file (fusion par `key` : la dernière intention gagne). */
export function enqueueAction(a: Omit<QueuedAction, 'id' | 'ts'>): void {
  const q = read();
  const next = a.key ? q.filter((x) => x.key !== a.key) : q;
  next.push({
    ...a,
    id: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    ts: Date.now(),
  });
  write(next);
  notify();
}

const listeners = new Set<(n: number) => void>();
export function onQueueChange(fn: (n: number) => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
function notify() {
  const n = queueLength();
  listeners.forEach((fn) => { try { fn(n); } catch { /* ignore */ } });
}

let flushing = false;

/**
 * Rejoue la file dans l'ordre. S'arrête (et conserve la file) à la première
 * erreur réseau/serveur (5xx) pour réessayer plus tard ; abandonne une action
 * sur erreur client définitive (4xx hors 408/429) afin d'éviter une boucle.
 */
export async function flushQueue(): Promise<void> {
  if (flushing) return;
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return;
  if (read().length === 0) return;
  flushing = true;
  try {
    // Boucle FIFO : on relit la file à chaque tour (elle peut changer).
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const q = read();
      if (q.length === 0) break;
      const a = q[0];
      let done = false;
      let stop = false;
      try {
        const res = await fetch(a.path, {
          method: a.method,
          headers: authHeaders(a.body ? { 'Content-Type': 'application/json' } : {}),
          body: a.body ? JSON.stringify(a.body) : undefined,
        });
        if (res.ok || res.status === 404 || res.status === 409) {
          done = true; // succès, ou déjà appliqué/idempotent → on retire
        } else if (res.status >= 400 && res.status < 500 && res.status !== 408 && res.status !== 429) {
          done = true; // erreur client définitive → on abandonne (pas de boucle)
        } else {
          stop = true; // 5xx / 408 / 429 → on réessaiera plus tard
        }
      } catch {
        stop = true; // réseau indisponible → on réessaiera plus tard
      }
      if (done) {
        write(read().filter((x) => x.id !== a.id));
        notify();
      }
      if (stop) break;
    }
  } finally {
    flushing = false;
  }
}
