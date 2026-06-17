/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Editeur d'ecriture IMMERSIF (mobile-first), WYSIWYG :
 *  - zone d'ecriture contentEditable -> gras / italique / souligne VISIBLES en
 *    direct (comme WhatsApp), stockage en HTML leger (<b>/<i>/<u>) ;
 *  - auto-sauvegarde INVISIBLE (debounce + brouillon local + serveur) + bouton
 *    de sauvegarde MANUELLE ; toute sauvegarde lit les valeurs courantes (refs)
 *    pour ne jamais perdre les dernieres modifs a la sortie ;
 *  - mode immersion sans distraction ; navigation entre chapitres par swipe.
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import { ChevronLeft, Check, Loader2, Bold, Italic, Underline, Minus, Undo2, Redo2, Maximize2, List, Trash2, Save, Sparkles, X, AlignLeft, Type, Tag } from 'lucide-react';
import { Story, Chapter } from '../types';

interface ImmersiveEditorProps {
  story: Story;
  chapter: Chapter | null;
  fontFamily?: string;
  fontSize?: string;
  onPersistNew: (data: Partial<Chapter>) => Chapter | void;
  onPersistUpdate: (chapterId: string, data: Partial<Chapter>) => void;
  onDelete?: (chapterId: string) => void;
  onClose: () => void;
  onSwitchChapter: (target: Chapter | 'new') => void;
}

type SaveState = 'idle' | 'dirty' | 'saving' | 'saved';

const DRAFT_KEY = (storyId: string, chId: string) => `plume_chapter_draft_${storyId}_${chId}`;

function plainTextOf(html: string): string {
  const d = document.createElement('div');
  d.innerHTML = html || '';
  return (d.textContent || '').trim();
}

/* ===========================================================================
   MINI-IA D'ECRITURE — Decoupage intelligent d'un texte en paragraphes.
   Moteur local (aucune cle API, fonctionne hors-ligne) : analyse de ponctuation
   francaise, gestion des dialogues (tirets cadratins / guillemets), des
   abreviations et des nombres, regroupement equilibre des phrases et passage a
   la ligne sur les marqueurs de rupture narrative (temps, lieu, opposition).
   =========================================================================== */

const FR_ABBREVIATIONS = new Set([
  'm', 'mm', 'mme', 'mmes', 'mlle', 'mlles', 'mr', 'dr', 'drs', 'pr', 'me', 'mgr',
  'st', 'ste', 'sts', 'stes', 'vs', 'etc', 'cf', 'ex', 'p', 'pp', 'no', 'nos', 'n',
  'art', 'env', 'av', 'bd', 'fbg', 'rte', 'tel', 'fig', 'al', 'ph', 'jc', 'apr',
  'min', 'max', 'rd', 'bis', 'ch', 'vol', 'chap', 'cad', 'qqn', 'qqch', 'vol',
]);

// Marqueurs de RUPTURE : provoquent un nouveau paragraphe quand une phrase debute par eux.
const FR_TRANSITIONS = [
  'soudain', 'tout a coup', "tout d'un coup", 'tout d un coup', 'cependant', 'pourtant',
  'neanmoins', 'toutefois', 'plus tard', 'le lendemain', 'la veille', 'le jour suivant',
  'le surlendemain', 'quelques instants plus tard', 'quelques minutes plus tard',
  'quelques heures plus tard', 'quelques jours plus tard', 'au meme moment', 'au meme instant',
  'pendant ce temps', 'puis', 'ensuite', 'enfin', 'alors', 'aussitot', 'peu apres',
  'le soir', 'le matin', 'la nuit', 'au matin', 'au soir', "c'est alors", 'c est alors',
  'des lors', 'finalement', 'de retour', 'plus loin', 'au loin', 'dehors', 'a l interieur',
  "a l'interieur", 'un instant plus tard', 'une fois', 'apres un moment', 'des le lendemain',
];

function stripDiacritics(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '');
}

function escapeHtml(t: string): string {
  return t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// HTML de la zone editable -> texte brut en PRESERVANT les sauts de ligne
// (chaque <div>/<p>/<br> devient un retour a la ligne).
function htmlToTextWithBreaks(html: string): string {
  const s = (html || '')
    .replace(/<\/(div|p|h[1-6]|li)>/gi, '\n')
    .replace(/<br\s*\/?>(?!$)/gi, '\n')
    .replace(/<[^>]+>/g, '');
  const d = document.createElement('div');
  d.innerHTML = s;
  return (d.textContent || '').replace(/ /g, ' ');
}

function isDialogueLine(s: string): boolean {
  return /^\s*([—–-]\s|[«"])/.test(s);
}

function startsWithTransition(sentence: string): boolean {
  const low = stripDiacritics(sentence.trim().toLowerCase());
  return FR_TRANSITIONS.some((t) => {
    const tt = stripDiacritics(t);
    return low === tt || low.startsWith(tt + ' ') || low.startsWith(tt + ',') || low.startsWith(tt + "'") || low.startsWith(tt + '’');
  });
}

// Decoupe un bloc narratif en phrases (ponctuation FR, gestion abreviations/nombres).
function splitSentences(block: string): string[] {
  const text = block.replace(/\s+/g, ' ').trim();
  if (!text) return [];
  const out: string[] = [];
  let start = 0;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '.' || ch === '!' || ch === '?' || ch === '…') {
      // Protege les decimales (3.14) et les abreviations (M. Dupont, etc.).
      if (ch === '.') {
        const prev = text[i - 1];
        const nx = text[i + 1];
        if (prev && /\d/.test(prev) && nx && /\d/.test(nx)) continue;
        let k = i - 1; let w = '';
        while (k >= 0 && /[A-Za-zÀ-ÿ]/.test(text[k])) { w = text[k] + w; k--; }
        if (w && FR_ABBREVIATIONS.has(stripDiacritics(w.toLowerCase()))) continue;
        if (w.length === 1 && /[A-ZÀ-Þ]/.test(w)) continue; // initiale (« J. »)
      }
      // Absorbe une grappe de ponctuation finale et les guillemets fermants.
      let j = i;
      while (j + 1 < text.length && '.!?…»"\')'.includes(text[j + 1])) j++;
      const sep = text[j + 1];
      if (sep === undefined) { out.push(text.slice(start).trim()); start = text.length; break; }
      if (sep === ' ') {
        const after = text[j + 2];
        if (after && /[A-ZÀ-Þ0-9«—–"'(]/.test(after)) {
          out.push(text.slice(start, j + 1).trim());
          start = j + 2;
          i = j + 1;
        }
      }
    }
  }
  if (start < text.length) out.push(text.slice(start).trim());
  return out.filter(Boolean);
}

// Regroupe des phrases en paragraphes equilibres (~2-4 phrases), nouveau
// paragraphe sur marqueur de rupture ou au-dela d'une longueur confortable.
function groupSentences(sentences: string[]): string[] {
  const paras: string[] = [];
  let buf: string[] = [];
  let chars = 0;
  const flush = () => { if (buf.length) { paras.push(buf.join(' ')); buf = []; chars = 0; } };
  for (const s of sentences) {
    const newTopic = buf.length > 0 && startsWithTransition(s);
    const tooLong = buf.length >= 4 || chars > 320;
    if (newTopic || tooLong) flush();
    buf.push(s);
    chars += s.length + 1;
  }
  flush();
  return paras;
}

// Pipeline complet : respecte les coupures fortes (lignes vides) et les
// dialogues, reforme le reste en paragraphes lisibles.
function segmentIntoParagraphs(input: string): string[] {
  const out: string[] = [];
  const blocks = input.split(/\n\s*\n+/);
  for (const block of blocks) {
    const lines = block.split(/\n/).map((l) => l.trim()).filter(Boolean);
    let narrative: string[] = [];
    const flushNarrative = () => {
      if (!narrative.length) return;
      out.push(...groupSentences(splitSentences(narrative.join(' '))));
      narrative = [];
    };
    for (const line of lines) {
      if (isDialogueLine(line)) { flushNarrative(); out.push(line); }
      else narrative.push(line);
    }
    flushNarrative();
  }
  return out.filter(Boolean);
}

// Paragraphes -> HTML pour la zone editable (un <div> par paragraphe, ligne
// vide entre chacun pour aerer la redaction ; rendu correct cote lecture).
function paragraphsToEditorHtml(paras: string[]): string {
  return paras.map((p) => `<div>${escapeHtml(p)}</div>`).join('<div><br></div>');
}

/* ===========================================================================
   MINI-IA — Nettoyage TYPOGRAPHIQUE & PONCTUATION (francais), deterministe.
   Corrige les espaces, la ponctuation, les majuscules de debut de phrase, les
   apostrophes/points de suspension, sans rien inventer.
   =========================================================================== */
function cleanFrenchTypography(input: string): { text: string; changes: number } {
  const before = input;
  // Travaille ligne par ligne pour preserver les paragraphes.
  const lines = input.replace(/\r/g, '').split('\n');
  const cleanedLines = lines.map((line) => {
    let s = line;
    // Espaces multiples -> un seul ; supprime espaces en bord de ligne.
    s = s.replace(/[ \t]{2,}/g, ' ').replace(/[ \t]+$/g, '').replace(/^[ \t]+/g, '');
    if (!s) return s;
    // Apostrophe droite -> typographique.
    s = s.replace(/'/g, '’');
    // Points de suspension : "..." -> "…" ; ".. " ou ".... " normalises.
    s = s.replace(/\.{3,}/g, '…');
    // Pas d'espace AVANT , . ) … et apostrophe.
    s = s.replace(/\s+([,.\)…])/g, '$1');
    // Un espace APRES une fin de phrase (. ! ? …) collee au mot suivant
    // (sans casser les decimales : le lookahead exige une LETTRE).
    s = s.replace(/([.!?…])(?=[A-Za-zÀ-ÿ«“(])/g, '$1 ');
    // Un espace APRES , ; : ) si colle a un mot.
    s = s.replace(/([,;:\)])(?=[A-Za-zÀ-ÿ«“(])/g, '$1 ');
    // Pas d'espace juste apres une parenthese/guillemet ouvrant.
    s = s.replace(/([(«“])\s+/g, '$1');
    // Espace insecable AVANT ; : ! ? et » (typographie FR), si precede d'un mot.
    s = s.replace(/\s*([;:!?»])/g, ' $1').replace(/ +([;:!?»])/g, ' $1');
    // Espace insecable APRES « ouvrant.
    s = s.replace(/«\s*/g, '« ');
    // Recolle les espaces multiples eventuels reintroduits.
    s = s.replace(/ {2,}/g, ' ').trimEnd();
    return s;
  });
  let text = cleanedLines.join('\n').replace(/\n{3,}/g, '\n\n');

  // Majuscule en debut de phrase (apres . ! ? … et en tout debut).
  text = text.replace(/(^|[.!?…]\s+|\n\s*)([a-zà-ÿ])/g, (_m, p1, p2) => p1 + p2.toUpperCase());

  // Compte approximatif des corrections (difference de caracteres impactes).
  let changes = 0;
  const n = Math.min(before.length, text.length);
  for (let i = 0; i < n; i++) if (before[i] !== text[i]) changes++;
  changes += Math.abs(before.length - text.length);
  return { text, changes };
}

/* ===========================================================================
   MINI-IA — Suggestions de TITRE de chapitre a partir du contenu.
   =========================================================================== */
const FR_STOPWORDS = new Set([
  'le', 'la', 'les', 'un', 'une', 'des', 'de', 'du', 'au', 'aux', 'et', 'ou', 'mais',
  'donc', 'or', 'ni', 'car', 'que', 'qui', 'quoi', 'dont', 'ou', 'a', 'à', 'dans',
  'en', 'par', 'pour', 'sur', 'sous', 'avec', 'sans', 'chez', 'vers', 'entre', 'il',
  'elle', 'ils', 'elles', 'je', 'tu', 'nous', 'vous', 'on', 'se', 'sa', 'son', 'ses',
  'mon', 'ma', 'mes', 'ton', 'ta', 'tes', 'leur', 'leurs', 'ce', 'cet', 'cette', 'ces',
  'est', 'sont', 'etait', 'était', 'etre', 'être', 'avoir', 'avait', 'ne', 'pas', 'plus',
  'tout', 'tous', 'toute', 'toutes', 'comme', 'si', 'y', 'lui', 'me', 'te', 'cela', 'ca', 'ça',
]);

// Lexiques THEMATIQUES : label = mot-titre ; "de" = forme genitive correcte
// (genre/elision gere a la main) ; cues = indices a reperer dans le texte.
const FR_THEMES: { label: string; de: string; cues: string[] }[] = [
  { label: 'Trahison', de: 'de la trahison', cues: ['trahi', 'trahison', 'mensonge', 'mentir', 'traitre', 'traître', 'duperie', 'complot'] },
  { label: 'Vengeance', de: 'de la vengeance', cues: ['vengeance', 'venger', 'represaille', 'représaille', 'punir', 'chatiment', 'châtiment'] },
  { label: 'Amour', de: 'de l’amour', cues: ['amour', 'aimer', 'aimait', 'baiser', 'coeur', 'cœur', 'passion', 'tendresse', 'desir', 'désir', 'amoureux', 'amoureuse'] },
  { label: 'Deuil', de: 'du deuil', cues: ['mort', 'mourir', 'mourut', 'deuil', 'tombe', 'cadavre', 'funeraille', 'funéraille', 'disparu', 'larmes', 'pleurer'] },
  { label: 'Peur', de: 'de la peur', cues: ['peur', 'terreur', 'effroi', 'angoisse', 'cauchemar', 'horreur', 'trembler', 'frayeur', 'panique'] },
  { label: 'Secret', de: 'du secret', cues: ['secret', 'cacher', 'cachait', 'dissimuler', 'mystere', 'mystère', 'enigme', 'énigme', 'verite', 'vérité', 'reveler', 'révéler'] },
  { label: 'Exil', de: 'de l’exil', cues: ['exil', 'fuir', 'fuite', 'depart', 'départ', 'voyage', 'quitter', 'errance', 'frontiere', 'frontière'] },
  { label: 'Guerre', de: 'de la guerre', cues: ['guerre', 'bataille', 'combat', 'soldat', 'armee', 'armée', 'sang', 'epee', 'épée', 'ennemi'] },
  { label: 'Pouvoir', de: 'du pouvoir', cues: ['roi', 'reine', 'trone', 'trône', 'pouvoir', 'couronne', 'royaume', 'empire', 'regner', 'régner'] },
  { label: 'Nuit', de: 'de la nuit', cues: ['nuit', 'ombre', 'tenebre', 'ténèbre', 'obscurite', 'obscurité', 'lune', 'minuit', 'sombre'] },
  { label: 'Espoir', de: 'de l’espoir', cues: ['espoir', 'esperer', 'espérer', 'lumiere', 'lumière', 'aube', 'renaitre', 'renaître', 'avenir', 'reve', 'rêve', 'promesse'] },
  { label: 'Famille', de: 'de la famille', cues: ['pere', 'père', 'mere', 'mère', 'fils', 'frere', 'frère', 'soeur', 'sœur', 'famille', 'enfant', 'heritage', 'héritage'] },
];

function titleCase(w: string): string {
  return w ? w.charAt(0).toUpperCase() + w.slice(1) : w;
}

function suggestChapterTitles(input: string, fallbackIndex: number): string[] {
  const text = input.replace(/\s+/g, ' ').trim();
  if (!text) return [`Chapitre ${fallbackIndex}`];

  const sentences = text.split(/(?<=[.!?…])\s+/).map((s) => s.trim()).filter(Boolean);
  const firstSentence = sentences[0] || text;
  const lastSentence = sentences[sentences.length - 1] || '';

  // --- Mots de contenu ponderes (frequence + bonus 1re / derniere phrase) ---
  const weight = new Map<string, number>();
  const firstLower = firstSentence.toLowerCase();
  const lastLower = lastSentence.toLowerCase();
  for (const raw of text.split(/[^A-Za-zÀ-ÿ]+/)) {
    const w = raw.toLowerCase();
    if (w.length < 4 || FR_STOPWORDS.has(w)) continue;
    let inc = 1;
    if (firstLower.includes(w)) inc += 1;
    if (lastLower.includes(w)) inc += 1;
    weight.set(w, (weight.get(w) || 0) + inc);
  }
  const ranked = [...weight.entries()].sort((a, b) => b[1] - a[1]).map(([w]) => w);

  // --- Noms propres (mot capitalise EN MILIEU de phrase) = personnages / lieux ---
  const properFreq = new Map<string, number>();
  for (const s of sentences) {
    s.split(/\s+/).forEach((tok, i) => {
      const clean = tok.replace(/[^A-Za-zÀ-ÿ’'-]/g, '');
      if (i === 0 || clean.length < 3) return; // ignore le 1er mot (debut de phrase)
      if (/^[A-ZÀ-Þ][a-zà-ÿ’'-]+$/.test(clean) && !FR_STOPWORDS.has(clean.toLowerCase())) {
        properFreq.set(clean, (properFreq.get(clean) || 0) + 1);
      }
    });
  }
  const names = [...properFreq.entries()].sort((a, b) => b[1] - a[1]).map(([w]) => w);

  // --- Theme dominant (comptage d'indices lexicaux) ---
  const lowAll = text.toLowerCase();
  let theme: { label: string; de: string } | null = null;
  let bestScore = 0;
  for (const t of FR_THEMES) {
    let sc = 0;
    for (const cue of t.cues) {
      const m = lowAll.match(new RegExp(`\\b${cue}`, 'g'));
      if (m) sc += m.length;
    }
    if (sc > bestScore) { bestScore = sc; theme = t; }
  }

  const key = ranked[0] ? titleCase(ranked[0]) : '';
  const key2 = ranked[1] ? titleCase(ranked[1]) : '';
  const name = names[0] || '';
  const name2 = names[1] || '';

  // --- Composition via patrons litteraires (grammaticalement surs) ---
  const out: string[] = [];
  if (theme && name) out.push(`${name}, ${theme.label.toLowerCase() === 'amour' ? 'l’heure ' : 'le poids '}${theme.de}`);
  if (theme) out.push(`L’ombre ${theme.de}`);
  if (name) out.push(`Le secret de ${name}`);
  if (theme) out.push(theme.label);
  if (theme) out.push(`Au nom ${theme.de}`);
  if (name && name2) out.push(`${name} & ${name2}`);
  // « Le jour ou … » construit a partir de la 1re phrase.
  const clause = firstSentence.replace(/[.!?…]+$/, '').split(/\s+/).slice(0, 7).join(' ').toLowerCase();
  if (clause.split(' ').length >= 3) out.push(`Le jour où ${clause}`);
  if (key && theme && key.toLowerCase() !== theme.label.toLowerCase()) out.push(`${key} ${theme.de}`);
  if (key && key2) out.push(`${key} et ${key2.toLowerCase()}`);
  if (key) out.push(key);

  const cleaned = out.map((t) => t.trim()).filter((t) => t.length >= 3 && t.length <= 52);
  const uniq = [...new Set(cleaned)].slice(0, 5);
  uniq.push(`Chapitre ${fallbackIndex}`);
  return [...new Set(uniq)].slice(0, 5);
}

function useKeyboardHeight() {
  const [h, setH] = useState(0);
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const onResize = () => {
      const kb = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
      setH(kb > 80 ? kb : 0);
    };
    vv.addEventListener('resize', onResize);
    vv.addEventListener('scroll', onResize);
    onResize();
    return () => { vv.removeEventListener('resize', onResize); vv.removeEventListener('scroll', onResize); };
  }, []);
  return h;
}

export default function ImmersiveEditor({
  story, chapter, fontFamily, fontSize, onPersistNew, onPersistUpdate, onDelete, onClose, onSwitchChapter,
}: ImmersiveEditorProps) {
  const isNew = !chapter;
  const [title, setTitle] = useState(chapter ? chapter.title : `Chapitre ${story.chapters.length + 1} : `);
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const [chromeVisible, setChromeVisible] = useState(true);
  const [showSommaire, setShowSommaire] = useState(false);
  const [wordCount, setWordCount] = useState(() => plainTextOf(chapter?.content || '').split(/\s+/).filter(Boolean).length);

  // Mini-IA : decoupage du texte en paragraphes (apercu avant application).
  const [aiOpen, setAiOpen] = useState(false);
  const [aiMode, setAiMode] = useState<'menu' | 'paragraphs' | 'typo' | 'title'>('menu');
  const [aiParas, setAiParas] = useState<string[]>([]);
  const [aiNote, setAiNote] = useState<string>('');
  const [aiTypo, setAiTypo] = useState<string>('');
  const [aiTitles, setAiTitles] = useState<string[]>([]);

  const editorRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<any>(null);
  const idleRef = useRef<any>(null);
  const createdIdRef = useRef<string | null>(chapter?.id || null);
  const lastSavedRef = useRef<string>(`${chapter?.title || ''} ${chapter?.content || ''}`);

  const keyboardH = useKeyboardHeight();

  // Source de verite du contenu : le HTML de la zone editable (non controlee
  // par React pour eviter les sauts de curseur). Title controle en state.
  const titleRef = useRef(title);
  titleRef.current = title;
  const contentRef = useRef<string>(chapter?.content || '');

  // Initialise la zone editable une seule fois (au montage / changement chapitre).
  useEffect(() => {
    if (editorRef.current) editorRef.current.innerHTML = chapter?.content || '';
    contentRef.current = chapter?.content || '';
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const persist = useCallback((opts?: { force?: boolean }) => {
    const nextTitle = titleRef.current;
    const nextContent = contentRef.current;
    const sig = `${nextTitle} ${nextContent}`;
    if (!(opts && opts.force) && sig === lastSavedRef.current) return;
    if (!createdIdRef.current && !plainTextOf(nextContent)) return; // pas de chapitre fantome

    setSaveState('saving');
    try {
      if (createdIdRef.current) {
        onPersistUpdate(createdIdRef.current, { title: nextTitle.trim() || 'Chapitre', content: nextContent });
      } else {
        const created = onPersistNew({
          title: nextTitle.trim() || `Chapitre ${story.chapters.length + 1}`,
          content: nextContent,
          isPublished: true,
          publishDate: new Date().toISOString(),
          views: 0, reads: 0,
        });
        if (created && (created as Chapter).id) createdIdRef.current = (created as Chapter).id;
      }
      lastSavedRef.current = sig;
      try { localStorage.removeItem(DRAFT_KEY(story.id, createdIdRef.current || 'new')); } catch { /* ignore */ }
      setSaveState('saved');
      window.setTimeout(() => setSaveState((st) => (st === 'saved' ? 'idle' : st)), 1400);
    } catch {
      setSaveState('dirty');
    }
  }, [onPersistNew, onPersistUpdate, story.id, story.chapters.length]);

  const persistRef = useRef(persist);
  persistRef.current = persist;

  const persistNow = useCallback(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    persistRef.current();
  }, []);

  const saveManually = () => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    persistRef.current({ force: true });
  };

  // Planifie une sauvegarde + brouillon local (appele a chaque frappe/edition).
  const scheduleSave = useCallback(() => {
    setSaveState((st) => (st === 'saved' ? st : 'dirty'));
    try { localStorage.setItem(DRAFT_KEY(story.id, createdIdRef.current || 'new'), JSON.stringify({ title: titleRef.current, content: contentRef.current, at: Date.now() })); } catch { /* ignore */ }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => persistRef.current(), 800);
  }, [story.id]);

  // Sauvegarde forcee a l'arriere-plan + FLUSH au demontage (valeurs courantes).
  useEffect(() => {
    const onHide = () => { if (document.visibilityState === 'hidden') persistRef.current(); };
    document.addEventListener('visibilitychange', onHide);
    return () => {
      document.removeEventListener('visibilitychange', onHide);
      if (debounceRef.current) clearTimeout(debounceRef.current);
      persistRef.current();
    };
  }, []);

  const wakeChrome = useCallback(() => {
    setChromeVisible(true);
    if (idleRef.current) clearTimeout(idleRef.current);
    idleRef.current = setTimeout(() => setChromeVisible(false), 2600);
  }, []);
  useEffect(() => { wakeChrome(); return () => { if (idleRef.current) clearTimeout(idleRef.current); }; }, [wakeChrome]);

  // Edition : on lit le HTML courant, met a jour refs + compteur, planifie save.
  const onEditorInput = () => {
    const html = editorRef.current?.innerHTML || '';
    contentRef.current = html;
    setWordCount(plainTextOf(html).split(/\s+/).filter(Boolean).length);
    scheduleSave();
    wakeChrome();
  };

  // Mise en forme WYSIWYG (gras/italique/souligne) via execCommand.
  const applyFormat = (cmd: 'bold' | 'italic' | 'underline') => {
    editorRef.current?.focus();
    try { document.execCommand('styleWithCSS', false, 'false'); } catch { /* ignore */ }
    document.execCommand(cmd, false);
    onEditorInput();
  };
  const insertSeparator = () => {
    editorRef.current?.focus();
    document.execCommand('insertHTML', false, '<div>* * *</div><div><br></div>');
    onEditorInput();
  };
  const doUndo = () => { editorRef.current?.focus(); document.execCommand('undo'); onEditorInput(); };
  const doRedo = () => { editorRef.current?.focus(); document.execCommand('redo'); onEditorInput(); };

  // Mini-IA : ouvre le menu de l'assistant d'ecriture.
  const openAIAssistant = () => { setAiMode('menu'); setAiOpen(true); };

  const currentEditorText = () => htmlToTextWithBreaks(editorRef.current?.innerHTML || '').trim();

  // Decoupage en paragraphes.
  const runAIParagraphs = () => {
    const text = currentEditorText();
    const words = text ? text.split(/\s+/).filter(Boolean).length : 0;
    if (words < 25) {
      setAiParas([]);
      setAiNote("Ecris ou colle d'abord un texte un peu plus long (au moins ~25 mots) pour que l'assistant puisse le decouper.");
    } else {
      const paras = segmentIntoParagraphs(text);
      setAiParas(paras);
      setAiNote(paras.length <= 1
        ? "Le texte forme deja un seul bloc coherent : aucun decoupage supplementaire n'a ete trouve."
        : `${paras.length} paragraphes proposes a partir de ${words} mots.`);
    }
    setAiMode('paragraphs');
  };

  const applyAIParagraphs = () => {
    if (!aiParas.length || !editorRef.current) { setAiOpen(false); return; }
    const html = paragraphsToEditorHtml(aiParas);
    editorRef.current.innerHTML = html;
    contentRef.current = html;
    setWordCount(plainTextOf(html).split(/\s+/).filter(Boolean).length);
    setAiOpen(false);
    scheduleSave();
    wakeChrome();
  };

  // Nettoyage typographique & ponctuation.
  const runAITypo = () => {
    const text = currentEditorText();
    if (!text) {
      setAiTypo('');
      setAiNote("Ecris d'abord un peu de texte a nettoyer.");
    } else {
      const { text: cleaned, changes } = cleanFrenchTypography(text);
      setAiTypo(cleaned);
      setAiNote(changes === 0 ? "Rien a corriger : ta typographie est deja impeccable." : `${changes} correction(s) de ponctuation / espaces / majuscules.`);
    }
    setAiMode('typo');
  };

  const applyAITypo = () => {
    if (!aiTypo || !editorRef.current) { setAiOpen(false); return; }
    const html = paragraphsToEditorHtml(aiTypo.split(/\n\s*\n+/).map((p) => p.trim()).filter(Boolean));
    editorRef.current.innerHTML = html;
    contentRef.current = html;
    setWordCount(plainTextOf(html).split(/\s+/).filter(Boolean).length);
    setAiOpen(false);
    scheduleSave();
    wakeChrome();
  };

  // Suggestions de titre de chapitre.
  const runAITitle = () => {
    const text = currentEditorText();
    const titles = suggestChapterTitles(text, story.chapters.length + (isNew ? 1 : 0) || 1);
    setAiTitles(titles);
    setAiNote(text ? 'Touche une proposition pour l’adopter comme titre.' : "Ecris un peu de texte pour de meilleures suggestions.");
    setAiMode('title');
  };

  const applyAITitle = (t: string) => {
    setTitle(t);
    setAiOpen(false);
    scheduleSave();
    wakeChrome();
  };

  // Navigation entre chapitres (swipe horizontal).
  const idx = isNew ? story.chapters.length : story.chapters.findIndex((c) => c.id === createdIdRef.current);
  const goRelative = (dir: -1 | 1) => {
    persistNow();
    const target = story.chapters[idx + dir];
    if (target) onSwitchChapter(target);
    else if (dir === 1) onSwitchChapter('new');
  };
  const touchX = useRef<number | null>(null);
  const onTouchStart = (e: React.TouchEvent) => { touchX.current = e.touches[0].clientX; };
  const onTouchEnd = (e: React.TouchEvent) => {
    if (touchX.current == null) return;
    const dx = e.changedTouches[0].clientX - touchX.current;
    touchX.current = null;
    const sel = window.getSelection();
    if (sel && !sel.isCollapsed) return; // ne pas naviguer pendant une selection
    if (Math.abs(dx) > window.innerWidth * 0.32) goRelative(dx < 0 ? 1 : -1);
  };

  const familyClass = fontFamily === 'sans' ? 'font-sans' : fontFamily === 'mono' ? 'font-mono' : 'font-serif';
  const sizeStyle = fontSize === 'small' ? '16px' : fontSize === 'large' ? '21px' : '18px';

  return (
    <div className="fixed inset-0 z-[100] bg-[#FBFAF7] dark:bg-[#15130F] flex flex-col" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
      <div className={`shrink-0 px-3 h-12 flex items-center gap-1.5 transition-all duration-200 ${chromeVisible ? 'opacity-100' : 'opacity-0 -translate-y-2 pointer-events-none'}`}>
        <button onClick={() => { persistNow(); onClose(); }} className="p-1.5 -ml-1 text-gray-500 dark:text-gray-300 shrink-0" aria-label="Retour">
          <ChevronLeft className="w-5 h-5" />
        </button>
        <input
          value={title}
          onChange={(e) => { setTitle(e.target.value); scheduleSave(); wakeChrome(); }}
          placeholder="Titre du chapitre"
          className="flex-1 min-w-0 bg-transparent text-sm font-serif font-black text-gray-900 dark:text-gray-100 focus:outline-none truncate"
        />
        <span className="text-gray-400 w-5 flex justify-center shrink-0" title={saveState === 'saving' ? 'Sauvegarde...' : 'A jour'}>
          {saveState === 'saving' ? <Loader2 className="w-4 h-4 animate-spin" />
            : saveState === 'saved' ? <Check className="w-4 h-4 text-emerald-500" />
            : saveState === 'dirty' ? <span className="w-1.5 h-1.5 rounded-full bg-gray-300 dark:bg-zinc-600 block" /> : null}
        </span>
        <button onClick={saveManually} className="flex items-center gap-1 text-[10px] font-black uppercase tracking-wide text-white bg-purple-600 hover:bg-purple-700 px-2.5 py-1.5 rounded-lg shrink-0" aria-label="Enregistrer">
          <Save className="w-3.5 h-3.5" />
        </button>
        <button onClick={() => setShowSommaire(true)} className="p-1.5 text-gray-500 dark:text-gray-300 shrink-0" aria-label="Sommaire"><List className="w-5 h-5" /></button>
      </div>

      <div
        className="flex-1 overflow-y-auto"
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
        onClick={() => { if (!chromeVisible) wakeChrome(); }}
      >
        <div
          ref={editorRef}
          contentEditable
          suppressContentEditableWarning
          onInput={onEditorInput}
          onFocus={wakeChrome}
          data-placeholder="Commence ton chapitre..."
          className={`plume-editor w-full min-h-full bg-transparent focus:outline-none break-words ${familyClass} text-[#1F2421] dark:text-[#E9E5DC]`}
          style={{
            fontSize: sizeStyle,
            lineHeight: 1.7,
            padding: `10px 14px ${Math.max(120, keyboardH + 80)}px 14px`,
            caretColor: '#7C3AED',
            whiteSpace: 'pre-wrap',
            overflowWrap: 'anywhere',
            width: '100%',
            boxSizing: 'border-box',
          }}
        />
      </div>

      <div
        className={`shrink-0 bg-white/95 dark:bg-[#0E0E14]/95 backdrop-blur border-t border-gray-100 dark:border-zinc-800 flex items-center justify-around px-2 transition-opacity ${chromeVisible || keyboardH > 0 ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
        style={{ height: 48, marginBottom: keyboardH, paddingBottom: keyboardH ? 0 : 'env(safe-area-inset-bottom)' }}
      >
        <button onMouseDown={(e) => e.preventDefault()} onClick={() => applyFormat('bold')} className="p-2 text-gray-700 dark:text-gray-200" aria-label="Gras"><Bold className="w-4 h-4" /></button>
        <button onMouseDown={(e) => e.preventDefault()} onClick={() => applyFormat('italic')} className="p-2 text-gray-700 dark:text-gray-200" aria-label="Italique"><Italic className="w-4 h-4" /></button>
        <button onMouseDown={(e) => e.preventDefault()} onClick={() => applyFormat('underline')} className="p-2 text-gray-700 dark:text-gray-200" aria-label="Souligne"><Underline className="w-4 h-4" /></button>
        <button onMouseDown={(e) => e.preventDefault()} onClick={insertSeparator} className="p-2 text-gray-700 dark:text-gray-200" aria-label="Separateur"><Minus className="w-4 h-4" /></button>
        <button onMouseDown={(e) => e.preventDefault()} onClick={doUndo} className="p-2 text-gray-700 dark:text-gray-200" aria-label="Annuler"><Undo2 className="w-4 h-4" /></button>
        <button onMouseDown={(e) => e.preventDefault()} onClick={doRedo} className="p-2 text-gray-700 dark:text-gray-200" aria-label="Retablir"><Redo2 className="w-4 h-4" /></button>
        <button onMouseDown={(e) => e.preventDefault()} onClick={openAIAssistant} className="p-2 text-purple-600" aria-label="Assistant d'ecriture IA" title="Assistant d'ecriture IA"><Sparkles className="w-4 h-4" /></button>
        <button onMouseDown={(e) => e.preventDefault()} onClick={() => { editorRef.current?.blur(); setChromeVisible(false); }} className="p-2 text-purple-600" aria-label="Immersion"><Maximize2 className="w-4 h-4" /></button>
      </div>

      {aiOpen && (
        <div className="fixed inset-0 z-[112] bg-black/50 backdrop-blur-sm flex items-end sm:items-center justify-center p-3" onClick={() => setAiOpen(false)}>
          <div
            className="w-full max-w-xl mx-auto bg-white dark:bg-[#0E0E14] rounded-3xl overflow-hidden flex flex-col max-h-[82vh] shadow-2xl"
            onClick={(e) => e.stopPropagation()}
            style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
          >
            <div className="shrink-0 px-4 py-3 flex items-center gap-2 border-b border-gray-100 dark:border-zinc-800">
              {aiMode !== 'menu' && (
                <button onClick={() => setAiMode('menu')} className="p-1 -ml-1 text-gray-400 hover:text-purple-600 shrink-0" aria-label="Retour"><ChevronLeft className="w-5 h-5" /></button>
              )}
              <span className="w-7 h-7 rounded-xl bg-gradient-to-br from-purple-600 to-fuchsia-500 text-white flex items-center justify-center shrink-0">
                <Sparkles className="w-4 h-4" />
              </span>
              <div className="min-w-0 flex-1">
                <h3 className="text-sm font-serif font-black text-gray-900 dark:text-white leading-none">
                  {aiMode === 'menu' ? "Assistant d’écriture"
                    : aiMode === 'paragraphs' ? 'Découper en paragraphes'
                    : aiMode === 'typo' ? 'Typographie & ponctuation'
                    : 'Titre du chapitre'}
                </h3>
                {aiMode !== 'menu' && <p className="text-[10px] text-gray-400 mt-0.5 truncate">{aiNote}</p>}
              </div>
              <button onClick={() => setAiOpen(false)} className="p-1.5 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 shrink-0" aria-label="Fermer"><X className="w-4 h-4" /></button>
            </div>

            {/* MENU */}
            {aiMode === 'menu' && (
              <div className="p-3 space-y-2">
                <button onClick={runAIParagraphs} className="w-full flex items-center gap-3 p-3 rounded-2xl bg-gray-50 dark:bg-zinc-900 hover:bg-purple-50 dark:hover:bg-zinc-850 text-left transition">
                  <span className="w-9 h-9 rounded-xl bg-purple-500/12 text-purple-600 flex items-center justify-center shrink-0"><AlignLeft className="w-4.5 h-4.5" /></span>
                  <span className="min-w-0">
                    <span className="block text-[13px] font-black text-gray-900 dark:text-white">Découper en paragraphes</span>
                    <span className="block text-[10px] text-gray-400">Aère un long bloc de texte en paragraphes lisibles.</span>
                  </span>
                </button>
                <button onClick={runAITypo} className="w-full flex items-center gap-3 p-3 rounded-2xl bg-gray-50 dark:bg-zinc-900 hover:bg-purple-50 dark:hover:bg-zinc-850 text-left transition">
                  <span className="w-9 h-9 rounded-xl bg-purple-500/12 text-purple-600 flex items-center justify-center shrink-0"><Type className="w-4.5 h-4.5" /></span>
                  <span className="min-w-0">
                    <span className="block text-[13px] font-black text-gray-900 dark:text-white">Typographie & ponctuation</span>
                    <span className="block text-[10px] text-gray-400">Corrige espaces, ponctuation, majuscules, apostrophes.</span>
                  </span>
                </button>
                <button onClick={runAITitle} className="w-full flex items-center gap-3 p-3 rounded-2xl bg-gray-50 dark:bg-zinc-900 hover:bg-purple-50 dark:hover:bg-zinc-850 text-left transition">
                  <span className="w-9 h-9 rounded-xl bg-purple-500/12 text-purple-600 flex items-center justify-center shrink-0"><Tag className="w-4.5 h-4.5" /></span>
                  <span className="min-w-0">
                    <span className="block text-[13px] font-black text-gray-900 dark:text-white">Suggérer un titre</span>
                    <span className="block text-[10px] text-gray-400">Propose des titres de chapitre à partir du contenu.</span>
                  </span>
                </button>
              </div>
            )}

            {/* DECOUPAGE EN PARAGRAPHES */}
            {aiMode === 'paragraphs' && (
              <>
                <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2.5">
                  {aiParas.length === 0 ? (
                    <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed py-6 text-center">{aiNote}</p>
                  ) : (
                    aiParas.map((p, i) => (
                      <div key={i} className="flex gap-2.5">
                        <span className="shrink-0 mt-0.5 w-5 h-5 rounded-full bg-purple-500/12 text-purple-600 dark:text-purple-300 text-[9px] font-black flex items-center justify-center">{i + 1}</span>
                        <p className="flex-1 min-w-0 text-[12.5px] leading-relaxed text-gray-700 dark:text-gray-200 break-words">{p}</p>
                      </div>
                    ))
                  )}
                </div>
                {aiParas.length > 0 && (
                  <div className="shrink-0 px-4 py-3 border-t border-gray-100 dark:border-zinc-800 flex items-center gap-2" style={{ paddingBottom: 'calc(0.75rem + env(safe-area-inset-bottom))' }}>
                    <button onClick={() => setAiMode('menu')} className="flex-1 py-2.5 rounded-xl bg-gray-100 dark:bg-zinc-850 text-gray-700 dark:text-gray-200 text-[10px] font-black uppercase tracking-wider">Retour</button>
                    <button onClick={applyAIParagraphs} className="flex-1 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-[10px] font-black uppercase tracking-wider flex items-center justify-center gap-1.5"><Check className="w-3.5 h-3.5" /> Appliquer</button>
                  </div>
                )}
              </>
            )}

            {/* TYPOGRAPHIE */}
            {aiMode === 'typo' && (
              <>
                <div className="flex-1 overflow-y-auto px-4 py-3">
                  {aiTypo ? (
                    <p className="text-[12.5px] leading-relaxed text-gray-700 dark:text-gray-200 whitespace-pre-wrap break-words">{aiTypo}</p>
                  ) : (
                    <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed py-6 text-center">{aiNote}</p>
                  )}
                </div>
                {aiTypo && (
                  <div className="shrink-0 px-4 py-3 border-t border-gray-100 dark:border-zinc-800 flex items-center gap-2" style={{ paddingBottom: 'calc(0.75rem + env(safe-area-inset-bottom))' }}>
                    <button onClick={() => setAiMode('menu')} className="flex-1 py-2.5 rounded-xl bg-gray-100 dark:bg-zinc-850 text-gray-700 dark:text-gray-200 text-[10px] font-black uppercase tracking-wider">Retour</button>
                    <button onClick={applyAITypo} className="flex-1 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-[10px] font-black uppercase tracking-wider flex items-center justify-center gap-1.5"><Check className="w-3.5 h-3.5" /> Appliquer</button>
                  </div>
                )}
              </>
            )}

            {/* TITRE */}
            {aiMode === 'title' && (
              <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
                {aiTitles.map((t, i) => (
                  <button key={i} onClick={() => applyAITitle(t)} className="w-full flex items-center justify-between gap-3 p-3 rounded-2xl bg-gray-50 dark:bg-zinc-900 hover:bg-purple-50 dark:hover:bg-zinc-850 text-left transition">
                    <span className="text-[13px] font-bold text-gray-900 dark:text-white break-words min-w-0">{t}</span>
                    <Check className="w-4 h-4 text-purple-600 shrink-0" />
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {showSommaire && (
        <div className="fixed inset-0 z-[110] bg-black/40 flex items-end" onClick={() => setShowSommaire(false)}>
          <div className="w-full max-w-xl mx-auto bg-white dark:bg-[#0E0E14] rounded-t-3xl p-4 max-h-[70vh] overflow-y-auto" onClick={(e) => e.stopPropagation()} style={{ paddingBottom: 'calc(1rem + env(safe-area-inset-bottom))' }}>
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-serif font-black text-sm">Chapitres - {wordCount} mots ici</h3>
              {!isNew && onDelete && createdIdRef.current && (
                <button onClick={() => { if (confirm('Supprimer ce chapitre ?')) { onDelete(createdIdRef.current!); onClose(); } }} className="text-red-500 text-xs font-bold flex items-center gap-1"><Trash2 className="w-3.5 h-3.5" />Supprimer</button>
              )}
            </div>
            {story.chapters.map((c, i) => (
              <button key={c.id} onClick={() => { setShowSommaire(false); persistNow(); onSwitchChapter(c); }}
                className={`w-full text-left px-3 py-2.5 rounded-xl mb-1 flex items-center justify-between ${c.id === createdIdRef.current ? 'bg-purple-500/10 text-purple-600' : 'hover:bg-gray-100 dark:hover:bg-zinc-900'}`}>
                <span className="text-xs font-bold truncate">{i + 1}. {c.title || 'Sans titre'}</span>
                <span className="text-[9px] text-gray-400 shrink-0 ml-2">{c.isPublished ? 'Publie' : 'Brouillon'}</span>
              </button>
            ))}
            <button onClick={() => { setShowSommaire(false); persistNow(); onSwitchChapter('new'); }} className="w-full mt-2 py-2.5 rounded-xl bg-purple-600 text-white text-xs font-black uppercase tracking-wider">+ Nouveau chapitre</button>
          </div>
        </div>
      )}
    </div>
  );
}
