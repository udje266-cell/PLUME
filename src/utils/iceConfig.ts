/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Configuration ICE (STUN/TURN) des appels WebRTC, récupérée auprès du serveur
 * (/api/webrtc/ice) : le serveur la pilote par variables d'environnement, donc
 * un vrai compte TURN peut être branché SANS reconstruire l'application.
 * Repli local (STUN Google + OpenRelay) si le serveur est injoignable.
 */

import { authHeaders } from './auth';

const FALLBACK_ICE: RTCIceServer[] = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'turn:openrelay.metered.ca:80', username: 'openrelayproject', credential: 'openrelayproject' },
  { urls: 'turn:openrelay.metered.ca:443', username: 'openrelayproject', credential: 'openrelayproject' },
  { urls: 'turn:openrelay.metered.ca:443?transport=tcp', username: 'openrelayproject', credential: 'openrelayproject' },
];

let cached: RTCIceServer[] | null = null;
let inFlight: Promise<RTCIceServer[]> | null = null;

/** Serveurs ICE à utiliser pour un appel (cache mémoire ; jamais bloquant > 4 s). */
export async function getIceServers(): Promise<RTCIceServer[]> {
  if (cached) return cached;
  if (!inFlight) {
    inFlight = (async () => {
      try {
        const ctrl = new AbortController();
        const t = setTimeout(() => ctrl.abort(), 4000);
        const res = await fetch('/api/webrtc/ice', { headers: authHeaders(), signal: ctrl.signal });
        clearTimeout(t);
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data.iceServers) && data.iceServers.length) {
            cached = data.iceServers as RTCIceServer[];
            return cached;
          }
        }
      } catch { /* serveur injoignable : repli local */ }
      // ÉCHEC : on renvoie le repli SANS le mettre en cache, et on libère
      // inFlight — le prochain appel retentera le serveur (sinon un premier
      // échec au démarrage figeait le repli pour toute la session, et le vrai
      // TURN configuré n'était plus jamais interrogé).
      inFlight = null;
      return FALLBACK_ICE;
    })();
  }
  return inFlight;
}
