// Préférences d'affichage du lecteur (thèmes, polices, mise en page).
// Inspiré des liseuses web modernes : 8 thèmes, 13 polices dont une police
// adaptée à la dyslexie, réglages fins de mise en page et défilement auto.

export type ReaderThemeKey = 'system' | 'light' | 'oled' | 'sepia' | 'green' | 'rose' | 'slate' | 'graphite';

export interface ReaderTheme {
  key: ReaderThemeKey;
  label: string;
  bg: string;       // fond de page
  fg: string;       // texte
  muted: string;    // texte secondaire
  line: string;     // séparateurs / bordures
  surface: string;  // cartes, barres
  accent: string;   // couleur d'accent (progression, sélection)
  dark: boolean;
}

export const READER_THEMES: Record<Exclude<ReaderThemeKey, 'system'>, ReaderTheme> = {
  light:    { key: 'light',    label: 'Clair',    bg: '#FFFFFF', fg: '#1F2328', muted: '#6B7280', line: '#E5E7EB', surface: '#F6F6F8', accent: '#7C3AED', dark: false },
  oled:     { key: 'oled',     label: 'OLED',     bg: '#000000', fg: '#D4D4D8', muted: '#8B8B94', line: '#1F1F23', surface: '#0E0E10', accent: '#A78BFA', dark: true },
  sepia:    { key: 'sepia',    label: 'Sépia',    bg: '#F8EFE0', fg: '#4A3A28', muted: '#7D6A52', line: '#E7D8BE', surface: '#F1E4CD', accent: '#9A5B13', dark: false },
  green:    { key: 'green',    label: 'Vert',     bg: '#E8F0E6', fg: '#1F3A27', muted: '#4F6B57', line: '#CFDDCB', surface: '#DCE8D8', accent: '#2F7A45', dark: false },
  rose:     { key: 'rose',     label: 'Rose',     bg: '#FCEFF1', fg: '#4A2030', muted: '#85566A', line: '#F2D5DC', surface: '#F7E1E6', accent: '#C2185B', dark: false },
  slate:    { key: 'slate',    label: 'Ardoise',  bg: '#0F1B2D', fg: '#CBD5E1', muted: '#8A9BB3', line: '#1E2D44', surface: '#14233A', accent: '#60A5FA', dark: true },
  graphite: { key: 'graphite', label: 'Graphite', bg: '#232325', fg: '#D6D6D6', muted: '#9A9AA0', line: '#333336', surface: '#2B2B2E', accent: '#F87171', dark: true },
};

export const THEME_ORDER: ReaderThemeKey[] = ['system', 'light', 'oled', 'sepia', 'green', 'rose', 'slate', 'graphite'];

export function resolveTheme(key: ReaderThemeKey): ReaderTheme {
  if (key !== 'system') return READER_THEMES[key];
  let dark = false;
  try {
    dark = document.documentElement.classList.contains('dark')
      || (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches);
  } catch { /* SSR / tests */ }
  return { ...(dark ? READER_THEMES.oled : READER_THEMES.light), key: 'system', label: 'Système' };
}

export type ReaderFontKey =
  | 'plume' | 'literata' | 'merriweather' | 'lora' | 'garamond' | 'baskerville' | 'bitter'
  | 'playfair' | 'archivo' | 'roboto' | 'montserrat' | 'firacode' | 'opendyslexic';

export const READER_FONTS: { key: ReaderFontKey; label: string; css: string }[] = [
  { key: 'plume',        label: 'PLUME',         css: '"Source Serif 4", Georgia, serif' },
  { key: 'literata',     label: 'Literata',      css: '"Literata", Georgia, serif' },
  { key: 'merriweather', label: 'Merriweather',  css: '"Merriweather", Georgia, serif' },
  { key: 'lora',         label: 'Lora',          css: '"Lora", Georgia, serif' },
  { key: 'garamond',     label: 'Garamond',      css: '"EB Garamond", Garamond, serif' },
  { key: 'baskerville',  label: 'Baskerville',   css: '"Libre Baskerville", Baskerville, serif' },
  { key: 'bitter',       label: 'Bitter',        css: '"Bitter", Georgia, serif' },
  { key: 'playfair',     label: 'Playfair',      css: '"Playfair Display", Georgia, serif' },
  { key: 'archivo',      label: 'Archivo',       css: '"Archivo", system-ui, sans-serif' },
  { key: 'roboto',       label: 'Roboto',        css: '"Roboto", system-ui, sans-serif' },
  { key: 'montserrat',   label: 'Montserrat',    css: '"Montserrat", system-ui, sans-serif' },
  { key: 'firacode',     label: 'Fira Code',     css: '"Fira Code", ui-monospace, monospace' },
  { key: 'opendyslexic', label: 'OpenDyslexic',  css: '"OpenDyslexic", system-ui, sans-serif' },
];

export const fontCss = (key: ReaderFontKey) => (READER_FONTS.find((f) => f.key === key) || READER_FONTS[0]).css;

export interface ReaderPrefs {
  fontSize: number;          // 14 – 32 px
  theme: ReaderThemeKey;
  font: ReaderFontKey;
  lineHeight: number;        // 1.3 – 2.4
  align: 'left' | 'justify';
  margins: 'narrow' | 'normal' | 'wide';
  paraSpacing: 'compact' | 'normal' | 'airy';
  autoScrollWpm: number;     // 100 – 600
  autoScrollEnd: 'next' | 'stop';
  keepAwake: boolean;
  warmth: number;            // 0 – 0.45 (filtre lumière bleue)
}

export const DEFAULT_READER_PREFS: ReaderPrefs = {
  fontSize: 18,
  theme: 'sepia',
  font: 'literata',
  lineHeight: 1.8,
  align: 'left',
  margins: 'normal',
  paraSpacing: 'normal',
  autoScrollWpm: 250,
  autoScrollEnd: 'next',
  keepAwake: true,
  warmth: 0,
};

export const MARGIN_PX: Record<ReaderPrefs['margins'], number> = { narrow: 14, normal: 22, wide: 36 };
export const PARA_GAP_EM: Record<ReaderPrefs['paraSpacing'], number> = { compact: 0.55, normal: 1.1, airy: 1.7 };

const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));

// Lecture + validation (valeurs corrompues ignorées) + migration de l'ancien format.
export function sanitizeReaderPrefs(raw: any, fallback: ReaderPrefs = DEFAULT_READER_PREFS): ReaderPrefs {
  const out: ReaderPrefs = { ...fallback };
  if (!raw || typeof raw !== 'object') return out;
  const fs = Number(raw.fontSize);
  if (Number.isFinite(fs)) out.fontSize = clamp(Math.round(fs), 14, 32);
  const legacyTheme: Record<string, ReaderThemeKey> = { dark: 'oled', dimmed: 'graphite' };
  const th = legacyTheme[raw.readingTheme] || raw.theme || raw.readingTheme;
  if (THEME_ORDER.includes(th)) out.theme = th;
  const legacyFont: Record<string, ReaderFontKey> = { serif: 'plume', sans: 'roboto', classic: 'baskerville', mono: 'firacode' };
  const fk = raw.font || legacyFont[raw.fontStyle];
  if (READER_FONTS.some((f) => f.key === fk)) out.font = fk;
  const legacyLh: Record<string, number> = { tight: 1.5, normal: 1.8, loose: 2.1, compact: 1.5, relaxed: 2.1 };
  const lh = Number(raw.lineHeight ?? legacyLh[raw.lineSpacing]);
  if (Number.isFinite(lh)) out.lineHeight = clamp(Math.round(lh * 10) / 10, 1.3, 2.4);
  if (raw.align === 'left' || raw.align === 'justify') out.align = raw.align;
  if (['narrow', 'normal', 'wide'].includes(raw.margins)) out.margins = raw.margins;
  if (['compact', 'normal', 'airy'].includes(raw.paraSpacing)) out.paraSpacing = raw.paraSpacing;
  const w = Number(raw.autoScrollWpm);
  if (Number.isFinite(w)) out.autoScrollWpm = clamp(Math.round(w / 10) * 10, 100, 600);
  if (raw.autoScrollEnd === 'next' || raw.autoScrollEnd === 'stop') out.autoScrollEnd = raw.autoScrollEnd;
  if (typeof raw.keepAwake === 'boolean') out.keepAwake = raw.keepAwake;
  const wa = Number(raw.warmth);
  if (Number.isFinite(wa)) out.warmth = clamp(wa, 0, 0.45);
  return out;
}
