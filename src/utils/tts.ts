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

// Index de la meilleure voix FRANÇAISE côté natif (choisie une fois, mise en
// cache). Les voix « réseau » (localService = false) ou « enhanced » sont
// nettement plus naturelles que la voix compacte/locale par défaut, robotique.
let nativeVoiceIndex: number | null = null;

async function ensureNativeVoice(): Promise<void> {
  if (!isNative() || nativeVoiceIndex !== null) return;
  try {
    const { voices } = await TextToSpeech.getSupportedVoices();
    const fr = (voices || [])
      .map((v, i) => ({ v, i }))
      .filter(({ v }) => /^fr/i.test(v.lang || ''));
    if (!fr.length) return;
    const looksHiFi = (name: string) => /network|enhanced|premium|neural|wavenet|natural/i.test(name);
    const looksLoFi = (name: string) => /compact|local|eloquence/i.test(name);
    const pick =
      // 1) Voix « réseau » (haute qualité) française.
      fr.find(({ v }) => v.localService === false) ||
      // 2) Nom évoquant une voix améliorée/neurale.
      fr.find(({ v }) => looksHiFi(v.name || v.voiceURI || '')) ||
      // 3) Éviter explicitement les voix compactes/locales robotiques.
      fr.find(({ v }) => !looksLoFi(v.name || v.voiceURI || '')) ||
      // 4) À défaut, la première voix française disponible.
      fr[0];
    nativeVoiceIndex = pick.i;
  } catch { /* on garde la voix par défaut du système */ }
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
  // En natif : on précharge (et met en cache) la meilleure voix française.
  if (isNative()) { ensureNativeVoice(); return Promise.resolve([]); }
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
  const fr = voices.filter((v) => /^fr/i.test(v.lang || ''));
  if (!fr.length) return null;
  // Préférer les voix de meilleure qualité (Google / réseau / non locales),
  // plus naturelles que les voix locales par défaut.
  return (
    fr.find((v) => /google|network|enhanced|natural|premium/i.test(v.name || '')) ||
    fr.find((v) => (v as any).localService === false) ||
    fr.find((v) => /fr[-_]?fr/i.test(v.lang || '')) ||
    fr[0]
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
    const opt: any = {
      text,
      lang: 'fr-FR',
      rate,
      // Pitch très légèrement adouci : rend la voix un peu moins métallique.
      pitch: 0.95,
      volume: 1.0,
      category: 'playback',
    };
    // Voix française de meilleure qualité si on en a trouvé une.
    if (nativeVoiceIndex !== null) opt.voice = nativeVoiceIndex;
    TextToSpeech.speak(opt).then(finishEnd).catch(finishErr);
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

// ═══════════════════════════════════════════════════════════════════════════
// VOIX NEURONALE (ElevenLabs) via le backend.
// Le serveur (/api/tts) synthetise l'audio avec la cle API (cote serveur) et
// renvoie un mp3 que l'on joue ici. Repli automatique sur la voix native si
// indisponible (pas de cle, quota epuise, reseau).
// ═══════════════════════════════════════════════════════════════════════════

// Élément audio RÉUTILISÉ (débloqué par un geste utilisateur) : sur mobile,
// appeler play() APRÈS un fetch async est souvent bloqué/rendu muet. En
// débloquant un même élément dans le tap puis en réutilisant cet élément, la
// lecture fonctionne.
let sharedAudio: HTMLAudioElement | null = null;
let currentAudio: HTMLAudioElement | null = null;
let neuralAvailable: boolean | null = null; // null = pas encore sonde

// mp3 silencieux minimal (pour débloquer la lecture dans le geste).
const SILENT_MP3 =
  'data:audio/mpeg;base64,SUQzBAAAAAAAI1RTU0UAAAAPAAADTGF2ZjU4LjI5LjEwMAAAAAAAAAAAAAAA//tQxAADB8AhSmxhIIEVCSiJrDCQBTcu3UrAIwUdkRgQbFAZC1CQEwTJ9mjRvBA4UOLD8nKVOWfh+UlK3z/177OXrfOdKl7pyn3Xf//WreyTEFNRTMuOTkuNVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV';

// À appeler DANS un geste utilisateur (le tap ▶️) pour autoriser la lecture
// audio ultérieure (voix neuronale jouée après un fetch async).
export function unlockNeuralAudio(): void {
  try {
    if (!sharedAudio) sharedAudio = new Audio();
    sharedAudio.muted = true;
    sharedAudio.src = SILENT_MP3;
    const p = sharedAudio.play();
    if (p && typeof (p as any).then === 'function') {
      (p as Promise<void>).then(() => {
        try { sharedAudio!.pause(); sharedAudio!.currentTime = 0; sharedAudio!.muted = false; } catch { /* ignore */ }
      }).catch(() => { try { sharedAudio!.muted = false; } catch { /* ignore */ } });
    }
  } catch { /* ignore */ }
}

// Sonde une seule fois : le backend a-t-il une voix neuronale configuree ?
export async function neuralTtsAvailable(): Promise<boolean> {
  if (neuralAvailable !== null) return neuralAvailable;
  try {
    const res = await fetch('/api/tts/health', { headers: { Accept: 'application/json' } });
    if (!res.ok) { neuralAvailable = false; return false; }
    const data = await res.json().catch(() => ({}));
    neuralAvailable = !!data.available;
  } catch {
    neuralAvailable = false;
  }
  return neuralAvailable;
}

// Coupe la voix neuronale pour la session (quota epuise / erreur persistante)
// afin de basculer proprement sur la voix native.
function disableNeuralForSession() { neuralAvailable = false; }

function stopCurrentAudio() {
  if (currentAudio) {
    try { currentAudio.pause(); currentAudio.src = ''; currentAudio.load(); } catch { /* ignore */ }
    currentAudio = null;
  }
}

// Lit UN passage avec la voix neuronale. En cas d'echec -> onerror (l'appelant
// bascule sur la voix native pour ce passage).
export function speakNeural(text: string, opts: SpeakOpts): void {
  let settled = false;
  const finishEnd = () => { if (!settled) { settled = true; opts.onend?.(); } };
  const finishErr = () => { if (!settled) { settled = true; (opts.onerror || opts.onend)?.(); } };
  if (!text || !text.trim()) { finishEnd(); return; }
  const rate = Math.min(2, Math.max(0.5, opts.rate ?? 1));

  fetch('/api/tts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'audio/mpeg' },
    body: JSON.stringify({ text }),
  })
    .then(async (res) => {
      if (!res.ok) {
        // 401/402/429 = cle invalide / quota epuise : on desactive le neuronal
        // pour le reste de la session (repli natif).
        if ([401, 402, 429].includes(res.status)) disableNeuralForSession();
        throw new Error('tts ' + res.status);
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      // On REUTILISE l'element debloque dans le geste (sinon lecture muette).
      if (!sharedAudio) sharedAudio = new Audio();
      const audio = sharedAudio;
      audio.muted = false;
      audio.src = url;
      audio.playbackRate = rate; // ElevenLabs rend a vitesse fixe -> on ajuste ici
      currentAudio = audio;
      const cleanup = () => { try { URL.revokeObjectURL(url); } catch { /* ignore */ } if (currentAudio === audio) currentAudio = null; };
      audio.onended = () => { cleanup(); finishEnd(); };
      audio.onerror = () => { cleanup(); finishErr(); };
      audio.play().catch(() => { cleanup(); finishErr(); });
    })
    .catch(() => finishErr());
}

export function ttsCancel(): void {
  stopCurrentAudio();
  if (isNative()) { try { TextToSpeech.stop(); } catch { /* ignore */ } return; }
  if (webSpeechAvailable()) { try { window.speechSynthesis.cancel(); } catch { /* ignore */ } }
}
