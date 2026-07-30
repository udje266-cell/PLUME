// « Livre audio » : synthèse vocale basée sur l'API Web Speech (SpeechSynthesis).
// Disponible dans le WebView Android (Chromium) comme sur le web, sans aucune
// dépendance native. On lit le texte paragraphe par paragraphe (le composant de
// lecture surligne et fait défiler le paragraphe courant en cascade via onend).

export function ttsSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    'speechSynthesis' in window &&
    typeof (window as any).SpeechSynthesisUtterance !== 'undefined'
  );
}

// Les voix sont chargées de façon ASYNCHRONE par le navigateur : au premier
// appel getVoices() peut renvoyer une liste vide, remplie ensuite via
// l'événement `voiceschanged`. On attend donc (avec repli sur un délai court).
export function loadVoices(): Promise<SpeechSynthesisVoice[]> {
  if (!ttsSupported()) return Promise.resolve([]);
  const synth = window.speechSynthesis;
  const immediate = synth.getVoices();
  if (immediate && immediate.length) return Promise.resolve(immediate);
  return new Promise((resolve) => {
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      resolve(synth.getVoices());
    };
    try { synth.addEventListener('voiceschanged', finish); } catch { /* vieux WebView */ }
    // Repli : certains WebView ne déclenchent jamais l'événement.
    setTimeout(finish, 1200);
  });
}

// Choix d'une voix française (fr-FR de préférence, sinon n'importe quel fr-*).
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
  const finishEnd = () => { if (!settled) { settled = true; opts.onend?.(); } };
  const finishErr = () => { if (!settled) { settled = true; (opts.onerror || opts.onend)?.(); } };
  let settled = false;
  if (!ttsSupported() || !text || !text.trim()) { finishEnd(); return; }
  try {
    const u = new SpeechSynthesisUtterance(text);
    u.rate = Math.min(2, Math.max(0.5, opts.rate ?? 1));
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
  if (!ttsSupported()) return;
  try { window.speechSynthesis.cancel(); } catch { /* ignore */ }
}
