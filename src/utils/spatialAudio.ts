/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Audio spatialisé « 3D » pour la lecture immersive. On fait tourner lentement
 * la source sonore autour de l'auditeur via un PannerNode HRTF : au casque ou
 * aux écouteurs, on a l'impression d'être réellement sur les lieux (la pluie
 * tombe tout autour, les oiseaux passent d'une oreille à l'autre, etc.).
 *
 * NB : le PannerNode HRTF ne produit son effet binaural qu'au casque/écouteurs.
 * Sur haut-parleurs le rendu reste correct (panoramique doux), sans gêne.
 */

// Un seul AudioContext partagé pour le son réel spatialisé (les navigateurs
// limitent fortement le nombre de contextes simultanés).
let sharedCtx: AudioContext | null = null;

function getSharedCtx(): AudioContext | null {
  try {
    const C = (window as any).AudioContext || (window as any).webkitAudioContext;
    if (!C) return null;
    if (!sharedCtx || sharedCtx.state === 'closed') sharedCtx = new C();
    if (sharedCtx.state === 'suspended') sharedCtx.resume().catch(() => {});
    return sharedCtx;
  } catch {
    return null;
  }
}

/** Place le « PannerNode » HRTF d'un contexte donné et l'anime en orbite lente. */
export function makeOrbitPanner(ctx: AudioContext, opts?: { radius?: number; speed?: number }) {
  const radius = opts?.radius ?? 1.9;
  const speed = opts?.speed ?? 0.16; // rad/s → un tour complet ~ 40 s

  const panner = ctx.createPanner();
  panner.panningModel = 'HRTF';
  panner.distanceModel = 'inverse';
  panner.refDistance = 1;
  panner.maxDistance = 100;
  panner.rolloffFactor = 0.5;

  const place = (x: number, y: number, z: number) => {
    const now = ctx.currentTime;
    if ((panner as any).positionX) {
      panner.positionX.setValueAtTime(x, now);
      panner.positionY.setValueAtTime(y, now);
      panner.positionZ.setValueAtTime(z, now);
    } else {
      (panner as any).setPosition(x, y, z);
    }
  };

  const startedAt = ctx.currentTime;
  let raf = 0;
  let stopped = false;
  const tick = () => {
    if (stopped) return;
    const t = ctx.currentTime - startedAt;
    const angle = t * speed;
    place(
      Math.cos(angle) * radius,
      Math.sin(angle * 0.5) * 0.45, // léger mouvement vertical
      Math.sin(angle) * radius,
    );
    raf = requestAnimationFrame(tick);
  };
  // Position initiale (légèrement décalée) puis animation.
  place(radius, 0, 0);
  tick();

  return {
    node: panner,
    stop() {
      stopped = true;
      if (raf) cancelAnimationFrame(raf);
      try { panner.disconnect(); } catch { /* ignore */ }
    },
  };
}

export interface SpatialHandle {
  setVolume(v: number): void;
  stop(): void;
}

/**
 * Spatialise un élément <audio> (son réel Mixkit, CORS autorisé) : la source
 * tourne autour de l'auditeur pour un rendu immersif au casque. En cas d'échec
 * (CORS, navigateur), renvoie null → l'appelant garde la lecture stéréo normale.
 */
export function spatializeElement(el: HTMLAudioElement, volume: number): SpatialHandle | null {
  const ctx = getSharedCtx();
  if (!ctx) return null;
  try {
    const src = ctx.createMediaElementSource(el);
    const gain = ctx.createGain();
    gain.gain.value = volume;
    const orbit = makeOrbitPanner(ctx);

    src.connect(gain);
    gain.connect(orbit.node);
    orbit.node.connect(ctx.destination);

    return {
      setVolume(v: number) { gain.gain.value = v; },
      stop() {
        orbit.stop();
        try { src.disconnect(); } catch { /* ignore */ }
        try { gain.disconnect(); } catch { /* ignore */ }
      },
    };
  } catch {
    // createMediaElementSource échoue si l'élément est déjà routé ou si le
    // contexte est invalide → on laisse l'audio jouer normalement.
    return null;
  }
}
