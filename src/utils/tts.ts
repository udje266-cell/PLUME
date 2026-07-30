// « Livre audio » : synthèse vocale.
//
//  • Sur mobile (APK Capacitor), on utilise le moteur TTS NATIF Android/iOS via
//    le plugin @capacitor-community/text-to-speech. C'est indispensable : le
//    WebView Android (surtout Samsung) N'EXPOSE PAS l'API Web Speech du
//    navigateur — window.speechSynthesis y est absent/inopérant.
//  • Sur le web, on utilise l'API Web Speech (SpeechSynthesis) du navigateur.
//
// On lit le texte paragraphe par paragraphe : le composant de lecture surligne
// et fait défiler le paragraphe courant, puis enchaîne via le callback onend.

import { Capacitor } from '@capacitor/core';
import { TextToSpeech } from '@capacitor-community/text-to-speech';

function isNative(): boolean {
  try { return Capacitor.isNativePlatform(); } catch { return false; }
}

function webSpeechAvailable(): boolean {
  return (
    typeof window !== 'undefined' &&
    'speechSynthesis' in window &&
    typeof (window as any).SpeechSynthesisUtterance !== 'undefined'
  );
}

// Disponible dès qu'on est en natif (plugin) OU que le navigateur supporte
// l'API Web Speech.
export function ttsSupported(): boolean {
  return isNative() || webSpeechAvailable();
}

// Les voix web sont chargées de façon ASYNCHRONE : getVoices() peut d'abord
// renvoyer une liste vide, remplie ensuite via l'événement `voiceschanged`.
// (Non nécessaire en natif : le moteur système gère la langue lui-même.)
export function loadVoices(): Promise<SpeechSynthesisVoice[]> {
  if (!webSpeechAvailable()) return Promise.resolve([]);
  const synth = window.speechSynthesis;
  const immediate = synth.getVoices();
  if (immediate && immediate.length) return Promise.resolve(immediate);
  return new Promise((resolve) => {
    let done = false;
    const finish = () => { if (done) return; done = true; resolve(synth.getVoices()); };
    try { synth.addEventListener('voiceschanged', finish); } catch { /* vieux WebView */ }
    setTimeout(finish, 1200);
  });
}

export function pickFrenchVoice(voices: SpeechSynthesisVoice[]): SpeechSynthesisVoice | null {
  if (!voices || !voices.length) return null;
  return (
    voices.find((v) => /fr[-_]?fr/i.test(v.lang)) ||
    voices.find((v) => /^fr/i.test(v.lang)) ||
    null
  );
}

interface SpeakOpts {
  rate?: number;
  voice?: SpeechSynthesisVoice | null;
  onend?: () => void;
  onerror?: () => void;
}

// Lit UN passage. Garantit qu'au plus un des callbacks (onend / onerror) est
// appelé, pour éviter un double avancement de paragraphe.
export function speakText(text: string, opts: SpeakOpts): void {
  let settled = false;
  const finishEnd = () => { if (!settled) { settled = true; opts.onend?.(); } };
  const finishErr = () => { if (!settled) { settled = true; (opts.onerror || opts.onend)?.(); } };
  if (!text || !text.trim()) { finishEnd(); return; }
  const rate = Math.min(2, Math.max(0.5, opts.rate ?? 1));

  // ── NATIF (Android/iOS) : moteur TTS système via le plugin. ──────────────
  if (isNative()) {
    TextToSpeech.speak({
      text,
      lang: 'fr-FR',
      rate,
      pitch: 1.0,
      volume: 1.0,
      category: 'playback',
    }).then(finishEnd).catch(finishErr);
    return;
  }

  // ── WEB : API Web Speech du navigateur. ──────────────────────────────────
  if (!webSpeechAvailable()) { finishEnd(); return; }
  try {
    const u = new SpeechSynthesisUtterance(text);
    u.rate = rate;
    u.lang = 'fr-FR';
    if (opts.voice) u.voice = opts.voice;
    u.onend = finishEnd;
    u.onerror = finishErr;
    window.speechSynthesis.speak(u);
  } catch {
    finishErr();
  }
}

export function ttsCancel(): void {
  if (isNative()) { try { TextToSpeech.stop(); } catch { /* ignore */ } return; }
  if (webSpeechAvailable()) { try { window.speechSynthesis.cancel(); } catch { /* ignore */ } }
}
