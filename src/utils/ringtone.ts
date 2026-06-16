/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Sonnerie d'appel entrant : motif à deux bips répété (Web Audio, sans fichier)
 * + vibration. Best-effort : si la lecture audio est bloquée (politique
 * d'autoplay), la vibration et l'écran d'appel restent les signaux de secours.
 */

let ctx: AudioContext | null = null;
let toneTimer: any = null;
let vibrateTimer: any = null;

function ringOnce(ac: AudioContext) {
  const now = ac.currentTime;
  const beep = (start: number, freq: number, dur: number) => {
    const osc = ac.createOscillator();
    const g = ac.createGain();
    osc.type = 'sine';
    osc.frequency.value = freq;
    g.gain.setValueAtTime(0.0001, now + start);
    g.gain.exponentialRampToValueAtTime(0.25, now + start + 0.03);
    g.gain.setValueAtTime(0.25, now + start + dur - 0.06);
    g.gain.exponentialRampToValueAtTime(0.0001, now + start + dur);
    osc.connect(g);
    g.connect(ac.destination);
    osc.start(now + start);
    osc.stop(now + start + dur + 0.02);
  };
  // Deux bips façon sonnerie classique.
  beep(0, 480, 0.4);
  beep(0.55, 620, 0.4);
}

export function startRingtone(): void {
  stopRingtone();
  try {
    const C = (window as any).AudioContext || (window as any).webkitAudioContext;
    if (C) {
      ctx = new C();
      if (ctx!.state === 'suspended') ctx!.resume().catch(() => {});
      ringOnce(ctx!);
      toneTimer = setInterval(() => { if (ctx) ringOnce(ctx); }, 3000);
    }
  } catch {
    /* audio indisponible : on garde la vibration */
  }
  try {
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      const pattern = [400, 200, 400, 1800];
      navigator.vibrate(pattern);
      vibrateTimer = setInterval(() => navigator.vibrate(pattern), 2800);
    }
  } catch {
    /* vibration indisponible */
  }
}

export function stopRingtone(): void {
  if (toneTimer) { clearInterval(toneTimer); toneTimer = null; }
  if (vibrateTimer) { clearInterval(vibrateTimer); vibrateTimer = null; }
  try { navigator.vibrate?.(0); } catch { /* ignore */ }
  if (ctx) {
    try { ctx.close(); } catch { /* ignore */ }
    ctx = null;
  }
}
