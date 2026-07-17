/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { 
  ArrowLeft, 
  BookOpen, 
  ChevronLeft, 
  ChevronRight, 
  ChevronDown,
  ChevronUp,
  FileText, 
  Heart, 
  Star, 
  MessageCircle, 
  Type, 
  Plus, 
  Trash2,
  BookmarkCheck,
  Check,
  Volume2,
  VolumeX,
  Headphones,
  Sparkles,
  Info,
  Maximize2,
  Minimize2,
  Smile,
  Copy,
  Sliders,
  Compass,
  CornerDownRight,
  Bookmark,
  Download,
  Palette,
  Share2,
  Image as ImageIcon
} from 'lucide-react';
import { Story, Chapter, Comment, User } from '../types';
import { downloadBook, isDownloaded, removeDownload } from '../utils/offline';
import { getBookProgress, saveBookProgress, getScrollParent } from '../utils/readingProgress';
import { authHeaders } from '../utils/auth';
import { chapterMinutes, formatMinutes } from '../utils/readingTime';
import { spatializeElement, makeOrbitPanner, type SpatialHandle } from '../utils/spatialAudio';

// ── Rendu du contenu de chapitre avec mise en forme inline (gras/italique/
// souligne). Le contenu peut etre du HTML leger (nouveaux chapitres ecrits dans
// l'editeur WYSIWYG) ou du texte simple (anciens chapitres). On NE GARDE que les
// balises inline sures pour eviter toute injection.
function escapeText(t: string): string {
  return t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
function sanitizeInlineHtml(html: string): string {
  return html.replace(/<(\/?)([a-zA-Z0-9]+)[^>]*>/g, (_m, slash, tag) => {
    const t = String(tag).toLowerCase();
    return ['b', 'strong', 'i', 'em', 'u', 'br'].includes(t) ? `<${slash}${t}>` : '';
  });
}
function plainFromHtml(html: string): string {
  if (typeof document === 'undefined') return html.replace(/<[^>]+>/g, '');
  const d = document.createElement('div');
  d.innerHTML = html;
  return d.textContent || '';
}
function contentToParagraphs(content: string): { html: string; text: string }[] {
  if (!content) return [];
  const hasHtml = /<\/?(b|strong|i|em|u|div|p|br|span|hr)\b/i.test(content);
  if (!hasHtml) {
    return content.split(/\n\s*\n/).map((t) => t.trim()).filter(Boolean)
      .map((t) => ({ html: escapeText(t).replace(/\n/g, '<br>'), text: t }));
  }
  const s = content
    .replace(/<\/(div|p)>/gi, '\n')
    .replace(/<(div|p)[^>]*>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<hr\s*\/?>/gi, '\n* * *\n');
  return s.split(/\n+/).map((l) => l.trim()).filter(Boolean)
    .map((l) => ({ html: sanitizeInlineHtml(l), text: plainFromHtml(l).trim() }));
}

interface ReadingViewProps {
  story: Story;
  onBack: () => void;
  currentUser: User;
  onToggleFeatured?: (storyId: string) => void;
  onFollowAuthor: (authorId: string) => void;
  comments: Comment[];
  onAddComment: (chapterId: string, content: string) => void;
  onLikeComment: (commentId: string) => void;
  onAddReply: (commentId: string, content: string) => void;
  onDeleteComment: (commentId: string) => void;
  onToggleFavorite: (storyId: string) => void;
  isFavorited: boolean;
  onToggleStoryLike: (storyId: string) => void;
  isLiked: boolean;
  onRateStory: (storyId: string, value: number) => void;
  userRating: number;
  onMarkChapterRead: (storyId: string, chapterId: string) => void;
  onChapterFullyRead: (storyId: string, chapterId: string) => void;
  readChapters: string[];
  onOpenDiscussion: (partnerId: string) => void;
  currentlyReading: string[];
  completedStories: string[];
  readLater: string[];
  onToggleCurrentlyReading: (storyId: string) => void;
  onToggleCompletedStories: (storyId: string) => void;
  onToggleReadLater: (storyId: string) => void;
  onViewProfile?: (userId: string) => void;
}

type ReadingTheme = 'light' | 'sepia' | 'dark' | 'dimmed';
type SoundscapeType = 'none' | 'rain' | 'forest' | 'fireplace' | 'library' | 'ocean' | 'breeze';

// Vrais sons d'ambiance (Mixkit, libres et hotlinkables) — bien plus réalistes
// que la synthèse. Si une URL échoue (hors ligne / erreur réseau), on bascule
// automatiquement sur le synthétiseur de secours.
const REAL_SOUND_URLS: Partial<Record<SoundscapeType, string>> = {
  rain: 'https://assets.mixkit.co/active_storage/sfx/1247/1247-preview.mp3',     // Long rain ambience
  forest: 'https://assets.mixkit.co/active_storage/sfx/2472/2472-preview.mp3',   // Morning birds
  ocean: 'https://assets.mixkit.co/active_storage/sfx/3126/3126-preview.mp3',    // Water flowing ambience loop
  breeze: 'https://assets.mixkit.co/active_storage/sfx/2658/2658-preview.mp3',   // Wind blowing ambience
  library: 'https://assets.mixkit.co/active_storage/sfx/2414/2414-preview.mp3',  // Night forest with insects (ambiance feutrée)
};
type FontStyleType = 'sans' | 'serif' | 'classic' | 'mono';
type LineSpacingType = 'tight' | 'normal' | 'loose';
type PlumeCardBgType = 'sunset' | 'cosmic' | 'emerald' | 'aurora' | 'gold' | 'neon' | 'dark' | 'minimal' | 'custom';
type PlumeCardFontType = 'serif' | 'sans' | 'mono' | 'handwritten' | 'playfair' | 'garamond' | 'cinzel' | 'cursive' | 'poetic' | 'bold';


interface FloatingEmoji {
  id: number;
  emoji: string;
  x: number;
  y: number;
}

// Client-side Web Audio Soundscape Synthesizer
class WebAudioSoundSynth {
  audioCtx: AudioContext | null = null;
  gainNode: GainNode | null = null;
  nodes: AudioNode[] = [];
  intervalId: any = null;
  orbit: { node: AudioNode; stop: () => void } | null = null;

  start(type: string, volume: number) {
    this.stop();
    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContextClass) return;
      this.audioCtx = new AudioContextClass();
      this.gainNode = this.audioCtx.createGain();
      this.gainNode.gain.setValueAtTime(volume, this.audioCtx.currentTime);
      // Spatialisation 3D : la nappe sonore synthétisée tourne autour de
      // l'auditeur (HRTF) pour un rendu immersif au casque, comme le son réel.
      this.orbit = makeOrbitPanner(this.audioCtx);
      this.gainNode.connect(this.orbit.node);
      this.orbit.node.connect(this.audioCtx.destination);

      // Bruit COLORÉ (et non blanc) pour un rendu naturel : le bruit rose (1/f)
      // et le bruit brun (1/f²) imitent la pluie, l'océan et le vent bien plus
      // fidèlement que le bruit blanc, qui « siffle ». Buffers stéréo +
      // décorrélés gauche/droite pour une vraie largeur immersive.
      const createNoiseBuffer = (duration = 2, color: 'white' | 'pink' | 'brown' = 'pink') => {
        if (!this.audioCtx) return null;
        const bSize = Math.floor(this.audioCtx.sampleRate * duration);
        const buf = this.audioCtx.createBuffer(2, bSize, this.audioCtx.sampleRate);
        for (let ch = 0; ch < 2; ch++) {
          const data = buf.getChannelData(ch);
          if (color === 'brown') {
            let last = 0;
            for (let i = 0; i < bSize; i++) {
              const white = Math.random() * 2 - 1;
              last = (last + 0.02 * white) / 1.02;
              data[i] = last * 3.5;
            }
          } else if (color === 'pink') {
            let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
            for (let i = 0; i < bSize; i++) {
              const white = Math.random() * 2 - 1;
              b0 = 0.99886 * b0 + white * 0.0555179;
              b1 = 0.99332 * b1 + white * 0.0750759;
              b2 = 0.96900 * b2 + white * 0.1538520;
              b3 = 0.86650 * b3 + white * 0.3104856;
              b4 = 0.55000 * b4 + white * 0.5329522;
              b5 = -0.7616 * b5 - white * 0.0168980;
              data[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.11;
              b6 = white * 0.115926;
            }
          } else {
            for (let i = 0; i < bSize; i++) data[i] = Math.random() * 2 - 1;
          }
        }
        return buf;
      };

      const setupNoiseSource = (filterFreq: number, filterType: BiquadFilterType = 'lowpass', q = 1, bufferDuration = 2, color: 'white' | 'pink' | 'brown' = 'pink') => {
        if (!this.audioCtx || !this.gainNode) return null;
        const buf = createNoiseBuffer(bufferDuration, color);
        if (!buf) return null;
        const src = this.audioCtx.createBufferSource();
        src.buffer = buf;
        src.loop = true;

        const filter = this.audioCtx.createBiquadFilter();
        filter.type = filterType;
        filter.frequency.setValueAtTime(filterFreq, this.audioCtx.currentTime);
        filter.Q.setValueAtTime(q, this.audioCtx.currentTime);

        src.connect(filter);
        filter.connect(this.gainNode);
        src.start();
        this.nodes.push(src);
        return { src, filter };
      };

      if (type === 'rain') {
        setupNoiseSource(600, 'lowpass', 1, 3);
        
        const crackleInterval = setInterval(() => {
          if (!this.audioCtx || !this.gainNode) return;
          const osc = this.audioCtx.createOscillator();
          const pGain = this.audioCtx.createGain();
          osc.type = 'triangle';
          osc.frequency.setValueAtTime(140 + Math.random() * 500, this.audioCtx.currentTime);
          
          pGain.gain.setValueAtTime(0.015 * Math.random(), this.audioCtx.currentTime);
          pGain.gain.exponentialRampToValueAtTime(0.0001, this.audioCtx.currentTime + 0.04);
          
          osc.connect(pGain);
          pGain.connect(this.gainNode);
          osc.start();
          osc.stop(this.audioCtx.currentTime + 0.05);
        }, 140);
        this.intervalId = crackleInterval;
      } 
      else if (type === 'forest') {
        const air = setupNoiseSource(350, 'lowpass', 1.2, 4);
        if (air) {
          const lfo = this.audioCtx.createOscillator();
          const lfoGain = this.audioCtx.createGain();
          lfo.frequency.setValueAtTime(0.12, this.audioCtx.currentTime);
          lfoGain.gain.setValueAtTime(120, this.audioCtx.currentTime);
          lfo.connect(lfoGain);
          lfoGain.connect(air.filter.frequency);
          lfo.start();
          this.nodes.push(lfo);
        }

        const birdInterval = setInterval(() => {
          if (!this.audioCtx || !this.gainNode) return;
          const t = this.audioCtx.currentTime;
          const osc = this.audioCtx.createOscillator();
          const g = this.audioCtx.createGain();
          osc.type = 'sine';
          
          const baseFreq = 2200 + Math.random() * 1200;
          osc.frequency.setValueAtTime(baseFreq, t);
          osc.frequency.exponentialRampToValueAtTime(baseFreq + 400, t + 0.08);
          osc.frequency.exponentialRampToValueAtTime(baseFreq - 200, t + 0.18);
          
          g.gain.setValueAtTime(0.004 * Math.random(), t);
          g.gain.linearRampToValueAtTime(0.012, t + 0.04);
          g.gain.exponentialRampToValueAtTime(0.0001, t + 0.2);
          
          osc.connect(g);
          g.connect(this.gainNode);
          osc.start();
          osc.stop(t + 0.22);
        }, 3400);
        this.intervalId = birdInterval;
      }
      else if (type === 'fireplace') {
        setupNoiseSource(90, 'lowpass', 1, 2, 'brown');
        
        const woodCrackles = setInterval(() => {
          if (!this.audioCtx || !this.gainNode) return;
          const t = this.audioCtx.currentTime;
          const osc = this.audioCtx.createOscillator();
          const g = this.audioCtx.createGain();
          osc.type = 'triangle';
          osc.frequency.setValueAtTime(7000 + Math.random() * 3500, t);
          
          g.gain.setValueAtTime(0.04 * Math.random(), t);
          g.gain.exponentialRampToValueAtTime(0.0001, t + 0.02);
          
          osc.connect(g);
          g.connect(this.gainNode);
          osc.start();
          osc.stop(t + 0.025);
        }, 180);
        this.intervalId = woodCrackles;
      }
      else if (type === 'library') {
        setupNoiseSource(140, 'lowpass', 0.6, 5);
        
        const libraryTones = setInterval(() => {
          if (!this.audioCtx || !this.gainNode) return;
          if (Math.random() < 0.15) {
            const t = this.audioCtx.currentTime;
            const osc = this.audioCtx.createOscillator();
            const g = this.audioCtx.createGain();
            osc.frequency.setValueAtTime(180 + Math.random() * 60, t);
            g.gain.setValueAtTime(0.005, t);
            g.gain.exponentialRampToValueAtTime(0.0001, t + 1.2);
            osc.connect(g);
            g.connect(this.gainNode);
            osc.start();
            osc.stop(t + 1.3);
          }
        }, 4000);
        this.intervalId = libraryTones;
      }
      else if (type === 'ocean') {
        const wave = setupNoiseSource(500, 'lowpass', 1, 4, 'brown');
        if (wave) {
          const lfo = this.audioCtx.createOscillator();
          const lfoGain = this.audioCtx.createGain();
          lfo.frequency.setValueAtTime(0.1, this.audioCtx.currentTime); // 10 seconds waveform cycle
          lfoGain.gain.setValueAtTime(160, this.audioCtx.currentTime);
          lfo.connect(lfoGain);
          lfoGain.connect(wave.filter.frequency);
          lfo.start();
          this.nodes.push(lfo);
        }
      }
      else if (type === 'breeze') {
        const wind = setupNoiseSource(280, 'lowpass', 1.8, 4);
        if (wind) {
          const lfo = this.audioCtx.createOscillator();
          const lfoGain = this.audioCtx.createGain();
          lfo.frequency.setValueAtTime(0.06, this.audioCtx.currentTime);
          lfoGain.gain.setValueAtTime(140, this.audioCtx.currentTime);
          lfo.connect(lfoGain);
          lfoGain.connect(wind.filter.frequency);
          lfo.start();
          this.nodes.push(lfo);
        }
      }
    } catch (e) {
      console.warn("Could not start Web Audio Synth", e);
    }
  }

  setVolume(volume: number) {
    if (this.gainNode && this.audioCtx) {
      this.gainNode.gain.setValueAtTime(volume, this.audioCtx.currentTime);
    }
  }

  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.nodes.forEach(node => {
      try {
        (node as any).stop();
      } catch (e) {}
    });
    this.nodes = [];
    if (this.orbit) {
      try { this.orbit.stop(); } catch (e) {}
      this.orbit = null;
    }
    if (this.audioCtx) {
      try {
        this.audioCtx.close();
      } catch (e) {}
      this.audioCtx = null;
    }
    this.gainNode = null;
  }
}

export default function ReadingView({
  story,
  onBack,
  currentUser,
  onToggleFeatured,
  onFollowAuthor,
  comments,
  onAddComment,
  onLikeComment,
  onAddReply,
  onDeleteComment,
  onToggleFavorite,
  isFavorited,
  onToggleStoryLike,
  isLiked,
  onRateStory,
  userRating,
  onMarkChapterRead,
  onChapterFullyRead,
  readChapters,
  onOpenDiscussion,
  currentlyReading,
  completedStories,
  readLater,
  onToggleCurrentlyReading,
  onToggleCompletedStories,
  onToggleReadLater,
  onViewProfile
}: ReadingViewProps) {
  
  // Custom States
  // Reprise PAR LIVRE : on restaure le chapitre exact où l'utilisateur s'était
  // arrêté pour CE récit (et non le dernier livre lu, toutes œuvres confondues).
  const [activeChapterIndex, setActiveChapterIndex] = useState<number>(() => {
    try {
      const saved = getBookProgress(currentUser.id, story.id);
      if (saved && saved.chapterIndex >= 0 && saved.chapterIndex < story.chapters.length) {
        return saved.chapterIndex;
      }
    } catch (e) {
      console.error('[ReadingView] Error restoring reading progress:', e);
    }
    return 0;
  });
  // Suivi de la progression de lecture réelle (défilement) pour CE récit.
  const readerRootRef = useRef<HTMLDivElement>(null);
  const restoredScrollRef = useRef(false);
  const [readPercent, setReadPercent] = useState<number>(() => getBookProgress(currentUser.id, story.id)?.percent ?? 0);

  // Téléchargement hors-ligne de ce récit.
  const [downloaded, setDownloaded] = useState<boolean>(() => isDownloaded(story.id));
  const toggleDownload = () => {
    if (downloaded) {
      removeDownload(story.id);
      setDownloaded(false);
    } else {
      const ok = downloadBook(story);
      setDownloaded(ok);
      if (!ok) alert("Le téléchargement a échoué (espace insuffisant ?).");
    }
  };

  // Valeurs initiales issues des PRÉFÉRENCES DE LECTURE du profil (réellement
  // appliquées ici ; l'utilisateur peut toujours ajuster ensuite dans la liseuse).
  const prefFontSize = ((): number => {
    switch (currentUser.readingFontSize) {
      case 'Petit': return 16;
      case 'Grand': return 24;
      case 'Tres Grand': return 30;
      case 'Standard': return 18;
      default: return 18;
    }
  })();
  const prefFontStyle = ((): FontStyleType => {
    switch (currentUser.readingFontFamily) {
      case 'Sans-Serif': return 'sans';
      case 'Monospace': return 'mono';
      case 'Serif': return 'serif';
      default: return 'serif';
    }
  })();
  const prefTheme = ((): ReadingTheme => {
    switch (currentUser.readingTheme) {
      case 'Clair': return 'light';
      case 'Sombre': return 'dark';
      case 'Sépia': return 'sepia';
      default: return 'sepia';
    }
  })();

  const [fontSize, setFontSize] = useState<number>(prefFontSize); // Font Size Slider (14px - 32px)
  const [fontStyle, setFontStyle] = useState<FontStyleType>(prefFontStyle); // Typography presets
  const [lineSpacing, setLineSpacing] = useState<LineSpacingType>('normal');
  const [readingTheme, setReadingTheme] = useState<ReadingTheme>(prefTheme);
  const [isSettingsExpanded, setIsSettingsExpanded] = useState<boolean>(false);
  
  // Interactive Custom controls
  const [isImmersive, setIsImmersive] = useState<boolean>(false);
  const [isCinemaMode, setIsCinemaMode] = useState<boolean>(false);
  const [activeParagraphIndex, setActiveParagraphIndex] = useState<number>(0);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isCommentsOpen, setIsCommentsOpen] = useState(false);
  const [isChaptersOpen, setIsChaptersOpen] = useState(false);
  
  // Soundscape
  const [activeSoundscape, setActiveSoundscape] = useState<SoundscapeType>('none');
  const [soundVolume, setSoundVolume] = useState<number>(0.4);
  const soundSynthRef = useRef<WebAudioSoundSynth | null>(null);
  const audioElRef = useRef<HTMLAudioElement | null>(null);
  const spatialRef = useRef<SpatialHandle | null>(null);
  // Son immersif « 3D » (spatialisation HRTF pour casque/écouteurs).
  const [spatialAudioOn, setSpatialAudioOn] = useState<boolean>(true);

  // Discrete interactions & reactions
  const [passageLikes, setPassageLikes] = useState<Record<string, number>>({});
  const [likedPassagesMe, setLikedPassagesMe] = useState<Record<string, boolean>>({});
  // Citations : clé SCOPÉE PAR UTILISATEUR (l'ancienne clé globale faisait fuir
  // le carnet d'un compte vers l'autre sur le même appareil) + persistance
  // serveur (survit au changement d'appareil, identique app/PWA).
  const quotesStorageKey = `plume_saved_quotes_${currentUser.id}`;
  const [savedQuotes, setSavedQuotes] = useState<string[]>(() => {
    try {
      const scoped = localStorage.getItem(quotesStorageKey);
      if (scoped !== null) return JSON.parse(scoped);
      // Migration douce depuis l'ancienne clé globale.
      const legacy = localStorage.getItem('plume_saved_quotes');
      return legacy ? JSON.parse(legacy) : [];
    } catch {
      return [];
    }
  });
  // content → id serveur, pour pouvoir supprimer une citation côté serveur.
  const quoteIdsRef = useRef<Record<string, string>>({});

  // Hydratation serveur (une fois) : fusionne les citations du compte et pousse
  // celles que le serveur ne connaît pas encore (migration douce).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await fetch('/api/me/quotes', { headers: authHeaders() });
        if (!r.ok || cancelled) return;
        const list = await r.json();
        const map: Record<string, string> = {};
        for (const q of list) map[q.content] = q.id;
        quoteIdsRef.current = map;
        let local: string[] = [];
        try { local = JSON.parse(localStorage.getItem(quotesStorageKey) || localStorage.getItem('plume_saved_quotes') || '[]'); } catch { local = []; }
        for (const c of local.filter((content) => !map[content]).slice(0, 100)) {
          fetch('/api/me/quotes', { method: 'POST', headers: authHeaders({ 'Content-Type': 'application/json' }), body: JSON.stringify({ content: c }) })
            .then((res) => (res.ok ? res.json() : null))
            .then((q) => { if (q) quoteIdsRef.current[q.content] = q.id; })
            .catch(() => {});
        }
        if (!cancelled) setSavedQuotes((prev) => Array.from(new Set([...prev, ...list.map((q: any) => q.content)])));
      } catch { /* hors-ligne : le carnet local reste utilisable */ }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [floatingEmojis, setFloatingEmojis] = useState<FloatingEmoji[]>([]);
  const emojiIdCounter = useRef<number>(0);

  // standard comment states
  const [newCommentText, setNewCommentText] = useState('');
  const [replyText, setReplyText] = useState<{ [key: string]: string }>({});
  const [activeReplyBox, setActiveReplyBox] = useState<string | null>(null);

  // Lyricard states
  const [isLyricardOpen, setIsLyricardOpen] = useState<boolean>(false);
  const [lyricText, setLyricText] = useState<string>('');
  const [lyricBg, setLyricBg] = useState<PlumeCardBgType>('sunset');
  const [lyricFontSize, setLyricFontSize] = useState<number>(22);
  const [lyricFontColor, setLyricFontColor] = useState<string>('#ffffff');
  const [lyricTextStyle, setLyricTextStyle] = useState<PlumeCardFontType>('serif');
  const [lyricCustomBg, setLyricCustomBg] = useState<string | null>(null);
  const [lyricAlign, setLyricAlign] = useState<'left' | 'center' | 'right'>('center');
  const [exportingLyricard, setExportingLyricard] = useState<boolean>(false);
  
  const previewCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const lastSelectedTextRef = useRef<string>('');
  const lyricCustomBgImageRef = useRef<HTMLImageElement | null>(null);

  useEffect(() => {
    if (!isLyricardOpen) return;

    const frame = window.requestAnimationFrame(() => {
      drawPlumeCard(previewCanvasRef.current);
    });

    return () => window.cancelAnimationFrame(frame);
  }, [isLyricardOpen, lyricText, lyricBg, lyricTextStyle, lyricAlign, lyricCustomBg]);

  // Surligner/sélectionner du texte en temps réel
  useEffect(() => {
    const handleSelectionChange = () => {
      const selection = window.getSelection();
      if (selection && selection.rangeCount > 0) {
        const text = selection.toString().trim();
        if (text) {
          lastSelectedTextRef.current = text;
        }
      }
    };

    document.addEventListener('selectionchange', handleSelectionChange);
    return () => {
      document.removeEventListener('selectionchange', handleSelectionChange);
    };
  }, []);

  // Chapitre actif robuste : une œuvre SANS chapitre publié arrive avec
  // `chapters: []` (chapitres brouillons filtrés côté serveur pour les lecteurs).
  // On fournit alors un chapitre de repli pour ne JAMAIS planter (écran de
  // lecture qui ne s'ouvre pas), et on affiche un état vide explicite.
  const hasChapters = Array.isArray(story.chapters) && story.chapters.length > 0;
  const activeChapter: Chapter = story.chapters?.[activeChapterIndex] || story.chapters?.[0] || {
    id: '__empty__', title: '', content: '', publishDate: '', isPublished: false, views: 0, reads: 0,
  };
  const isFollowing = (currentUser.following || []).includes(story.authorId);

  const isOwnStory = story.authorId === currentUser.id;

  // Tomes (optionnels) indexés par id : vide => œuvre à lecture plate, aucun
  // changement visuel. Sert au sommaire groupé et au libellé « Tome X ».
  const tomesById = React.useMemo(() => {
    const m = new Map<string, { title: string; order: number }>();
    (story.tomes || []).forEach((t) => m.set(t.id, { title: t.title, order: t.order }));
    return m;
  }, [story.tomes]);
  const activeTome = activeChapter.tomeId ? tomesById.get(activeChapter.tomeId) : null;

  useEffect(() => {
    if (!isOwnStory && !currentlyReading.includes(story.id) && !completedStories.includes(story.id)) {
      onToggleCurrentlyReading(story.id);
    }
  }, [story.id]);

  // Load sound engine
  useEffect(() => {
    soundSynthRef.current = new WebAudioSoundSynth();
    return () => {
      soundSynthRef.current?.stop();
      spatialRef.current?.stop();
      spatialRef.current = null;
      if (audioElRef.current) { audioElRef.current.pause(); audioElRef.current = null; }
    };
  }, []);

  // Ambiance sonore : vrai audio (Mixkit) si dispo, sinon synthèse. On coupe
  // toujours les sources avant de (re)démarrer. Si la spatialisation 3D est
  // active, le son réel est routé dans Web Audio (HRTF) pour tourner autour de
  // l'auditeur — immersion totale au casque.
  useEffect(() => {
    soundSynthRef.current?.stop();
    spatialRef.current?.stop();
    spatialRef.current = null;
    if (audioElRef.current) { audioElRef.current.pause(); audioElRef.current = null; }

    if (activeSoundscape === 'none') return;

    const url = REAL_SOUND_URLS[activeSoundscape];
    if (url) {
      const a = new Audio();
      // crossOrigin AVANT le src : indispensable pour router le flux dans Web
      // Audio sans le « tainter » (Mixkit renvoie Access-Control-Allow-Origin).
      a.crossOrigin = 'anonymous';
      a.loop = true;
      a.src = url;
      const fallbackToSynth = () => {
        spatialRef.current?.stop();
        spatialRef.current = null;
        if (audioElRef.current === a) audioElRef.current = null;
        soundSynthRef.current?.start(activeSoundscape, soundVolume);
      };
      a.onerror = fallbackToSynth;
      if (spatialAudioOn) {
        const handle = spatializeElement(a, soundVolume);
        if (handle) { spatialRef.current = handle; a.volume = 1; }
        else a.volume = soundVolume; // navigateur sans Web Audio → stéréo simple
      } else {
        a.volume = soundVolume;
      }
      a.play().catch(fallbackToSynth); // hors-ligne / lecture refusée → synthèse
      audioElRef.current = a;
    } else {
      soundSynthRef.current?.start(activeSoundscape, soundVolume);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSoundscape, spatialAudioOn]);

  // Volume : appliqué à la source active (graphe spatial, élément, ou synthé).
  useEffect(() => {
    if (spatialRef.current) spatialRef.current.setVolume(soundVolume);
    else if (audioElRef.current) audioElRef.current.volume = soundVolume;
    soundSynthRef.current?.setVolume(soundVolume);
  }, [soundVolume]);

  // Marque le chapitre lu + (au CHANGEMENT de chapitre seulement) remonte en
  // haut. Au tout premier affichage, on NE remonte PAS : l'effet de reprise
  // ci-dessous restaure la position sauvegardée.
  const firstChapterEffectRef = useRef(true);
  useEffect(() => {
    if (activeChapter && !isOwnStory) {
      onMarkChapterRead(story.id, activeChapter.id);
      // NB : on NE marque PLUS le récit « terminé » juste parce qu'on AFFICHE le
      // dernier chapitre (sinon un livre d'un seul chapitre passait a 100 % /
      // termine des l'ouverture). La completion se fait dans le suivi de scroll
      // ci-dessous, uniquement quand on a REELLEMENT lu jusqu'a la fin.
    }

    setActiveParagraphIndex(0);
    if (firstChapterEffectRef.current) {
      firstChapterEffectRef.current = false;
    } else {
      const el = getScrollParent(readerRootRef.current);
      if (el) el.scrollTo({ top: 0, behavior: 'smooth' });
      else window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [activeChapterIndex, story.id]);

  // Suivi + reprise de la position de défilement réelle pour CE récit.
  const chapterIdxRef = useRef(activeChapterIndex);
  useEffect(() => { chapterIdxRef.current = activeChapterIndex; }, [activeChapterIndex]);
  // Chapitres REELLEMENT lus (defilement >= 95 % OU temps de lecture suffisant)
  // pendant cette session : evite de re-signaler le meme chapitre en boucle.
  const fullyReadRef = useRef<Set<string>>(new Set());
  const markChapterFullyRead = (chId: string) => {
    if (isOwnStory || fullyReadRef.current.has(chId)) return;
    fullyReadRef.current.add(chId);
    onChapterFullyRead(story.id, chId);
  };
  useEffect(() => {
    // Le conteneur réellement défilé pour la lecture (sinon la fenêtre/page).
    const getScroller = (): HTMLElement | null => getScrollParent(readerRootRef.current);

    // Ratio de progression (0..1) DANS le chapitre courant, calculé sur le bon
    // conteneur : on ne devine plus, on mesure le défileur de lecture lui-même.
    const computeRatio = (): number => {
      const el = getScroller();
      if (el) {
        const max = el.scrollHeight - el.clientHeight;
        return max > 0 ? Math.min(1, Math.max(0, el.scrollTop / max)) : 0;
      }
      const docMax = document.documentElement.scrollHeight - window.innerHeight;
      return docMax > 0 ? Math.min(1, Math.max(0, window.scrollY / docMax)) : 0;
    };

    // On n'accepte QUE le défilement du conteneur de lecture (ou de la page).
    // Un défilement d'un autre élément (liste de chapitres, menu, carrousel…)
    // ne doit PAS fausser le pourcentage — c'était la cause du « 100 % » subit.
    const isReaderScrollEvent = (t: EventTarget | null): boolean => {
      const el = getScroller();
      if (el) return t === el;
      return t === document || t === window || t === document.documentElement || t === document.body;
    };

    let restoring = false;
    let timer: any = null;
    // Le recit n'est marque « termine » qu'une fois, quand on a VRAIMENT atteint
    // la fin du dernier chapitre (et pas a l'ouverture).
    let completionMarked = completedStories.includes(story.id);
    const onScroll = (e: Event) => {
      if (restoring) return;
      if (!isReaderScrollEvent(e.target)) return;
      if (timer) return;
      timer = setTimeout(() => {
        timer = null;
        const ratio = computeRatio();
        const total = Math.max(1, story.chapters.length);
        const percent = Math.round(((chapterIdxRef.current + ratio) / total) * 100);
        setReadPercent(percent);
        // On sauvegarde toujours la position de reprise (y compris pour l'auteur).
        saveBookProgress(currentUser.id, story.id, { chapterIndex: chapterIdxRef.current, scrollRatio: ratio, percent });

        // Chapitre courant REELLEMENT lu : defile jusqu'au bout (>= 95 %).
        // C'est ICI (et non a l'ouverture) qu'un chapitre compte comme lu, ce
        // qui fait progresser le pourcentage de lecture de maniere fidele.
        if (ratio >= 0.95) {
          const ch = story.chapters[chapterIdxRef.current];
          if (ch) markChapterFullyRead(ch.id);
        }

        // Completion REELLE : dernier chapitre lu jusqu'a la fin (>= 95 %).
        const isLastChapter = chapterIdxRef.current === story.chapters.length - 1;
        if (!isOwnStory && isLastChapter && ratio >= 0.95 && !completionMarked) {
          completionMarked = true;
          onToggleCompletedStories(story.id);
          if (currentlyReading.includes(story.id)) onToggleCurrentlyReading(story.id);
        }
      }, 250);
    };
    // Capture-phase sur document : capte le scroll quel que soit le conteneur,
    // mais on filtre ensuite pour ne garder que le défileur de lecture.
    document.addEventListener('scroll', onScroll, true);

    // Reprise de la position au premier affichage de ce livre. On ré-applique
    // plusieurs fois pour absorber le rendu progressif (images, polices) afin
    // d'atterrir EXACTEMENT là où l'on s'était arrêté.
    if (!restoredScrollRef.current) {
      restoredScrollRef.current = true;
      const saved = getBookProgress(currentUser.id, story.id);
      if (saved && saved.scrollRatio > 0.01) {
        restoring = true;
        const apply = () => {
          const el = getScroller();
          if (el) {
            const max = el.scrollHeight - el.clientHeight;
            if (max > 0) el.scrollTo({ top: max * saved.scrollRatio, behavior: 'auto' });
          } else {
            const wmax = document.documentElement.scrollHeight - window.innerHeight;
            if (wmax > 0) window.scrollTo({ top: wmax * saved.scrollRatio, behavior: 'auto' });
          }
        };
        [120, 350, 700].forEach((d) => setTimeout(apply, d));
        // Fin de la fenêtre de restauration : on rend la main au suivi réel.
        setTimeout(() => { restoring = false; }, 850);
      }
    }
    return () => { document.removeEventListener('scroll', onScroll, true); if (timer) clearTimeout(timer); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [story.id]);

  // Repli pour les chapitres COURTS qui tiennent entierement a l'ecran : aucun
  // defilement n'est possible, donc le seuil des 95 % ci-dessus ne se declenche
  // jamais. On les compte comme lus apres un temps de lecture raisonnable.
  useEffect(() => {
    if (isOwnStory || !activeChapter) return;
    const chId = activeChapter.id;
    if (fullyReadRef.current.has(chId)) return;
    const t = setTimeout(() => {
      const el = getScrollParent(readerRootRef.current);
      const scrollable = el
        ? el.scrollHeight - el.clientHeight > 24
        : document.documentElement.scrollHeight - window.innerHeight > 24;
      if (!scrollable) markChapterFullyRead(chId);
    }, 8000);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeChapterIndex, story.id]);

  // Save quotes synchronize (clé scopée par utilisateur)
  useEffect(() => {
    localStorage.setItem(quotesStorageKey, JSON.stringify(savedQuotes));
  }, [savedQuotes, quotesStorageKey]);

  // Références pour gérer le défilement fluide sans conflit avec l'écouteur de scroll
  const isClickScrollingRef = useRef<boolean>(false);
  const clickScrollTimeoutRef = useRef<any>(null);

  // Gérer la sélection manuelle de paragraphe (click)
  const handleParagraphSelect = (pIdx: number) => {
    setActiveParagraphIndex(pIdx);
    
    if (clickScrollTimeoutRef.current) {
      clearTimeout(clickScrollTimeoutRef.current);
    }
    isClickScrollingRef.current = true;
    
    const el = document.getElementById(`p-idx-${pIdx}`);
    if (el) {
      const rect = el.getBoundingClientRect();
      const targetY = window.innerHeight * 0.35; // Position cible à 35% de la hauteur de l'écran
      const targetScrollTop = window.scrollY + rect.top - targetY;
      
      window.scrollTo({
        top: targetScrollTop,
        behavior: 'smooth'
      });
    }

    clickScrollTimeoutRef.current = setTimeout(() => {
      isClickScrollingRef.current = false;
    }, 1000); // Temps suffisant pour la fin de la transition de scroll
  };

  // Synchroniser le paragraphe actif avec le défilement de l'écran en mode cinéma
  useEffect(() => {
    if (!isCinemaMode) return;

    const handleScroll = () => {
      if (isClickScrollingRef.current) return;

      const container = document.getElementById(`chapter-content-${activeChapter.id}`);
      if (!container) return;

      const paragraphEls = container.querySelectorAll('[data-paragraph-index]');
      if (!paragraphEls.length) return;

      const targetY = window.innerHeight * 0.35; // Concentre l'attention à 35% du haut

      let closestIdx = 0;
      let minDistance = Infinity;

      for (let i = 0; i < paragraphEls.length; i++) {
        const el = paragraphEls[i] as HTMLElement;
        const index = parseInt(el.getAttribute('data-paragraph-index') || '0', 10);
        const rect = el.getBoundingClientRect();

        // Si le paragraphe chevauche la ligne de mire, c'est celui que l'utilisateur lit
        if (rect.top <= targetY && rect.bottom >= targetY) {
          closestIdx = index;
          break;
        }

        // Sinon, on cherche le paragraphe dont le centre est le plus proche
        const elementCenter = (rect.top + rect.bottom) / 2;
        const distanceToTarget = Math.abs(elementCenter - targetY);
        
        if (distanceToTarget < minDistance) {
          minDistance = distanceToTarget;
          closestIdx = index;
        }
      }

      setActiveParagraphIndex(prev => prev === closestIdx ? prev : closestIdx);
    };

    // Synchronisation calée sur les frames (requestAnimationFrame) → fluide.
    // On écoute À LA FOIS `window` ET le conteneur défilant détecté : selon le
    // contexte, le défilement vient de l'un ou de l'autre. Le surlignage se base
    // sur des coordonnées écran (getBoundingClientRect), donc peu importe lequel
    // défile — l'essentiel est de capter l'événement.
    let rafId: number | null = null;
    const onScroll = () => {
      if (rafId !== null) return;
      rafId = requestAnimationFrame(() => {
        rafId = null;
        handleScroll();
      });
    };

    const scrollEl = getScrollParent(readerRootRef.current);
    const targets: Array<Window | HTMLElement> = [window];
    if (scrollEl && scrollEl !== (document.scrollingElement as any)) targets.push(scrollEl);
    targets.forEach((t) => t.addEventListener('scroll', onScroll, { passive: true } as any));
    handleScroll();

    return () => {
      targets.forEach((t) => t.removeEventListener('scroll', onScroll as any));
      if (rafId !== null) cancelAnimationFrame(rafId);
      if (clickScrollTimeoutRef.current) clearTimeout(clickScrollTimeoutRef.current);
    };
  }, [isCinemaMode, activeChapter.id]);

  // Quand on active le mode cinéma, focaliser le paragraphe actif actuel
  useEffect(() => {
    if (isCinemaMode && activeParagraphIndex !== undefined) {
      const t = setTimeout(() => {
        handleParagraphSelect(activeParagraphIndex);
      }, 150);
      return () => clearTimeout(t);
    }
  }, [isCinemaMode]);

  // Split chapter text into readable paragraphs
  const paragraphs = activeChapter ? contentToParagraphs(activeChapter.content) : [];

  if (!story.chapters || story.chapters.length === 0) {
    return (
      <div className="max-w-3xl mx-auto py-12 px-4 text-center">
        <h2 className="text-xl font-bold mb-4 font-serif">Cette histoire n'a pas encore de chapitre publié.</h2>
        <button 
          onClick={onBack}
          className="px-4 py-2 bg-purple-600 text-white rounded-full text-sm font-medium hover:bg-purple-700 transition-colors inline-flex items-center space-x-2"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Retour</span>
        </button>
      </div>
    );
  }

  // Handle comment submit
  const handleCommentSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCommentText.trim()) return;
    onAddComment(activeChapter.id, newCommentText);
    setNewCommentText('');
  };

  // Handle reply submit
  const handleReplySubmit = (commentId: string) => {
    const text = replyText[commentId];
    if (!text || !text.trim()) return;
    onAddReply(commentId, text);
    setReplyText({ ...replyText, [commentId]: '' });
    setActiveReplyBox(null);
  };

  // Emoji floating launcher
  const launchEmoji = (emoji: string) => {
    const id = ++emojiIdCounter.current;
    const newEmoji: FloatingEmoji = {
      id,
      emoji,
      x: 30 + Math.random() * 40, // percent container width
      y: 90
    };
    setFloatingEmojis(prev => [...prev, newEmoji]);
    
    // Animate up and clean
    setTimeout(() => {
      setFloatingEmojis(prev => prev.filter(e => e.id !== id));
    }, 2000);
  };

  // Saved Passage toggle — miroir serveur : la citation suit le compte (et non
  // l'appareil), et sa suppression se propage partout.
  const toggleSavePassage = (txt: string) => {
    const stripped = txt.replace(/^[#\-\*\s]+/, '').trim();
    if (savedQuotes.includes(stripped)) {
      setSavedQuotes(prev => prev.filter(q => q !== stripped));
      const serverId = quoteIdsRef.current[stripped];
      if (serverId) {
        delete quoteIdsRef.current[stripped];
        fetch(`/api/me/quotes/${serverId}`, { method: 'DELETE', headers: authHeaders() }).catch(() => {});
      }
    } else {
      setSavedQuotes(prev => [...prev, stripped]);
      fetch('/api/me/quotes', {
        method: 'POST',
        headers: authHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ content: stripped, storyId: story.id, chapterId: activeChapter?.id, storyTitle: story.title, author: story.authorName }),
      })
        .then((res) => (res.ok ? res.json() : null))
        .then((q) => { if (q) quoteIdsRef.current[stripped] = q.id; })
        .catch(() => {});
      alert("Citation sauvegardée dans votre carnet personnel !");
    }
  };

  const handleLikePassage = (index: number) => {
    const key = `${activeChapter.id}_p_${index}`;
    const wasLiked = likedPassagesMe[key];
    setLikedPassagesMe(prev => ({ ...prev, [key]: !wasLiked }));
    setPassageLikes(prev => ({
      ...prev,
      [key]: Math.max(0, (prev[key] || 0) + (wasLiked ? -1 : 1))
    }));
  };

  const openLyricardCreator = (txt: string) => {
    const activeSelection = window.getSelection()?.toString().trim();
    const recordedSelection = lastSelectedTextRef.current;
    
    let textToUse = '';
    
    if (activeSelection && activeSelection.length > 0) {
      textToUse = activeSelection;
    } else if (recordedSelection && recordedSelection.length > 0 && txt.includes(recordedSelection)) {
      textToUse = recordedSelection;
    } else {
      textToUse = txt;
    }
    
    const stripped = textToUse.replace(/^[#\-\*\s]+/, '').trim();
    setLyricText(stripped);
    setIsLyricardOpen(true);
  };

  const handleLyricCustomBackgroundUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';

    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert('Veuillez sélectionner une image.');
      return;
    }

    if (file.size > 6 * 1024 * 1024) {
      alert("L'image ne doit pas dépasser 6 Mo.");
      return;
    }

    const reader = new FileReader();

    reader.onload = () => {
      const imageDataUrl = String(reader.result || '');
      const image = new Image();

      image.onload = () => {
        lyricCustomBgImageRef.current = image;
        setLyricCustomBg(imageDataUrl);
        setLyricBg('custom');
      };

      image.onerror = () => {
        alert("Impossible de charger cette image comme fond de PlumeCard.");
      };

      image.src = imageDataUrl;
    };

    reader.readAsDataURL(file);
  };

  // Helper to draw the Plume app logo vector art on canvas
  const drawPlumeLogo = (ctx: CanvasRenderingContext2D, x: number, y: number, scale: number) => {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(scale, scale);

    const plumePinkPurple = ctx.createLinearGradient(0, 100, 100, 0);
    plumePinkPurple.addColorStop(0, '#7C3AED');
    plumePinkPurple.addColorStop(0.35, '#A855F7');
    plumePinkPurple.addColorStop(0.7, '#D946EF');
    plumePinkPurple.addColorStop(1, '#EC4899');

    const plumeDarkQuill = ctx.createLinearGradient(0, 100, 105, 0);
    plumeDarkQuill.addColorStop(0, '#120626');
    plumeDarkQuill.addColorStop(0.5, '#1E103E');
    plumeDarkQuill.addColorStop(1, '#2D1160');

    const silverSpine = ctx.createLinearGradient(0, 0, 100, 100);
    silverSpine.addColorStop(0, 'rgba(255, 255, 255, 0.9)');
    silverSpine.addColorStop(1, 'rgba(236, 236, 241, 0.4)');

    ctx.translate(5, 5); 
    ctx.scale(0.9, 0.9);   

    const p1 = new Path2D("M 12 85 C 13 84, 15 80, 16 75 C 18 64, 25 55, 33 48 C 39 42, 45 40, 50 38 C 45 44, 38 52, 33 65 C 28 75, 23 85, 12 85 Z");
    ctx.fillStyle = plumeDarkQuill;
    ctx.fill(p1);

    const p2 = new Path2D("M 14 83 C 25 80, 35 68, 42 56 C 49 44, 55 30, 54 15 C 50 18, 46 22, 43 25 C 40 18, 35 24, 32 30 C 26 42, 20 62, 14 83 Z");
    ctx.fillStyle = plumePinkPurple;
    ctx.fill(p2);

    const p3 = new Path2D("M 54 15 C 51 24, 46 32, 42 38 T 32 50 C 29 55, 28 64, 25 72");
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 0.75;
    ctx.lineCap = 'round';
    ctx.globalAlpha = 0.3;
    ctx.stroke(p3);
    ctx.globalAlpha = 1.0; 

    const p4 = new Path2D("M 10 90 Q 22 75, 36 52 Q 48 30, 54 12");
    ctx.strokeStyle = silverSpine;
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.stroke(p4);

    const p5 = new Path2D("M 10 90 L 7 93 L 5 95 L 9 92 Z");
    ctx.fillStyle = '#1E1B4B';
    ctx.fill(p5);
    ctx.strokeStyle = '#7C3AED';
    ctx.lineWidth = 0.5;
    ctx.stroke(p5);

    ctx.restore();
  };

  const drawPlumeCard = (canvas: HTMLCanvasElement | null) => {
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, 800, 800);

    const gradient = ctx.createLinearGradient(0, 800, 800, 0);
    let txtColor = '#ffffff';
    let strokeColor = 'rgba(255, 255, 255, 0.15)';
    let watermarkColor = 'rgba(255, 255, 255, 0.6)';
    let titleColor = '#ffffff';

    if (lyricBg === 'custom' && lyricCustomBgImageRef.current) {
      const image = lyricCustomBgImageRef.current;
      const canvasSize = 800;
      const imageRatio = image.width / image.height;
      const canvasRatio = 1;
      let drawWidth = canvasSize;
      let drawHeight = canvasSize;
      let drawX = 0;
      let drawY = 0;

      if (imageRatio > canvasRatio) {
        drawHeight = canvasSize;
        drawWidth = canvasSize * imageRatio;
        drawX = (canvasSize - drawWidth) / 2;
      } else {
        drawWidth = canvasSize;
        drawHeight = canvasSize / imageRatio;
        drawY = (canvasSize - drawHeight) / 2;
      }

      ctx.drawImage(image, drawX, drawY, drawWidth, drawHeight);

      const customOverlay = ctx.createLinearGradient(0, 0, 800, 800);
      customOverlay.addColorStop(0, 'rgba(0, 0, 0, 0.45)');
      customOverlay.addColorStop(0.5, 'rgba(0, 0, 0, 0.22)');
      customOverlay.addColorStop(1, 'rgba(10, 5, 25, 0.72)');
      ctx.fillStyle = customOverlay;
      ctx.fillRect(0, 0, 800, 800);
    } else {
      if (lyricBg === 'sunset') {
        gradient.addColorStop(0, '#ec4899');
        gradient.addColorStop(0.5, '#ef4444');
        gradient.addColorStop(1, '#f59e0b');
      } else if (lyricBg === 'cosmic') {
        gradient.addColorStop(0, '#1e1b4b');
        gradient.addColorStop(0.5, '#581c87');
        gradient.addColorStop(1, '#db2777');
      } else if (lyricBg === 'emerald') {
        gradient.addColorStop(0, '#115e59');
        gradient.addColorStop(0.5, '#059669');
        gradient.addColorStop(1, '#34d399');
      } else if (lyricBg === 'aurora') {
        gradient.addColorStop(0, '#020617');
        gradient.addColorStop(0.5, '#0f172a');
        gradient.addColorStop(1, '#06b6d4');
      } else if (lyricBg === 'gold') {
        gradient.addColorStop(0, '#78350f');
        gradient.addColorStop(0.5, '#d97706');
        gradient.addColorStop(1, '#fbbf24');
      } else if (lyricBg === 'neon') {
        gradient.addColorStop(0, '#3b0764');
        gradient.addColorStop(0.5, '#6d28d9');
        gradient.addColorStop(1, '#c084fc');
      } else if (lyricBg === 'dark') {
        gradient.addColorStop(0, '#09090b');
        gradient.addColorStop(0.5, '#18181b');
        gradient.addColorStop(1, '#27272a');
      } else if (lyricBg === 'minimal') {
        gradient.addColorStop(0, '#f5f5f4');
        gradient.addColorStop(0.5, '#e7e5e4');
        gradient.addColorStop(1, '#d6d3d1');
        txtColor = '#1c1917';
        strokeColor = 'rgba(28, 25, 23, 0.12)';
        watermarkColor = 'rgba(28, 25, 23, 0.55)';
        titleColor = '#292524';
      }

      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, 800, 800);
    }

    ctx.fillStyle = strokeColor;
    ctx.font = '320px serif';
    ctx.textAlign = 'left';
    ctx.fillText('“', 40, 270);

    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(50, 70);
    ctx.lineTo(750, 70);
    ctx.stroke();

    ctx.fillStyle = titleColor;
    ctx.font = '900 13px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('PLUME • CITATION D\'ARCHIPEL', 400, 48);

    let selectedFontFamily = 'Georgia, serif';
    let selectedFontWeight = 'bold';
    let selectedFontItalic = false;

    if (lyricTextStyle === 'sans') selectedFontFamily = '"Inter", Arial, sans-serif';
    else if (lyricTextStyle === 'mono') selectedFontFamily = '"JetBrains Mono", Consolas, monospace';
    else if (lyricTextStyle === 'handwritten') {
      selectedFontFamily = '"Brush Script MT", "Segoe Script", cursive';
      selectedFontItalic = true;
    } else if (lyricTextStyle === 'playfair') {
      selectedFontFamily = '"Playfair Display", Georgia, serif';
      selectedFontWeight = '900';
    } else if (lyricTextStyle === 'garamond') {
      selectedFontFamily = 'Garamond, Baskerville, Georgia, serif';
      selectedFontWeight = '600';
    } else if (lyricTextStyle === 'cinzel') {
      selectedFontFamily = '"Cinzel", "Trajan Pro", "Times New Roman", serif';
      selectedFontWeight = '700';
    } else if (lyricTextStyle === 'cursive') {
      selectedFontFamily = '"Lucida Calligraphy", "Brush Script MT", cursive';
      selectedFontItalic = true;
      selectedFontWeight = '600';
    } else if (lyricTextStyle === 'poetic') {
      selectedFontFamily = '"Cormorant Garamond", Garamond, Georgia, serif';
      selectedFontItalic = true;
      selectedFontWeight = '700';
    } else if (lyricTextStyle === 'bold') {
      selectedFontFamily = 'Impact, "Arial Black", sans-serif';
      selectedFontWeight = '900';
    }

    const quoteWrapped = ` ${lyricText.trim()} `;

    const maxW = 620;
    const maxHeight = 430;

    const wrapText = (context: CanvasRenderingContext2D, text: string, maxWidth: number) => {
      const words = text.split(/\s+/);
      let line = '';
      const lines = [];
      for (let n = 0; n < words.length; n++) {
        let testLine = line + words[n] + ' ';
        let metrics = context.measureText(testLine);
        let testWidth = metrics.width;
        if (testWidth > maxWidth && n > 0) {
          lines.push(line.trim());
          line = words[n] + ' ';
        } else {
          line = testLine;
        }
      }
      lines.push(line.trim());
      return lines;
    };

    let optimalSize = 40;
    let finalLines: string[] = [];
    let lineH = Math.round(optimalSize * 1.5);
    
    while (optimalSize >= 14) {
      ctx.font = `${selectedFontItalic ? 'italic ' : ''}${selectedFontWeight} ${optimalSize}px ${selectedFontFamily}`;
      lineH = Math.round(optimalSize * 1.55);
      finalLines = wrapText(ctx, quoteWrapped, maxW);
      const totalBlockHeight = finalLines.length * lineH;
      if (totalBlockHeight <= maxHeight) {
        break;
      }
      optimalSize -= 1;
    }

    ctx.font = `${selectedFontItalic ? 'italic ' : ''}${selectedFontWeight} ${optimalSize}px ${selectedFontFamily}`;
    ctx.fillStyle = txtColor;
    ctx.textAlign = lyricAlign;

    const totalBlockHeight = finalLines.length * lineH;
    let startY = 385 - (totalBlockHeight / 2) + (lineH / 2);

    finalLines.forEach((l) => {
      let drawX = 400;
      if (lyricAlign === 'left') drawX = 90;
      if (lyricAlign === 'right') drawX = 710;
      ctx.fillText(l, drawX, startY);
      startY += lineH;
    });

    ctx.strokeStyle = strokeColor;
    ctx.beginPath();
    ctx.moveTo(50, 700);
    ctx.lineTo(750, 700);
    ctx.stroke();

    ctx.textAlign = 'left';
    ctx.fillStyle = titleColor;
    ctx.font = 'bold 15px sans-serif';
    let maxTitle = story.title.toUpperCase();
    if (ctx.measureText(maxTitle).width > 420) {
      while (maxTitle.length > 5 && ctx.measureText(maxTitle + '...').width > 420) {
        maxTitle = maxTitle.slice(0, -1);
      }
      maxTitle += '...';
    }
    ctx.fillText(maxTitle, 90, 738);

    ctx.fillStyle = watermarkColor;
    let authorFontSize = 13;
    ctx.font = `italic ${authorFontSize}px sans-serif`;
    let authorText = `Récit par ${story.authorName}`;
    
    while (authorFontSize > 9 && ctx.measureText(authorText).width > 420) {
      authorFontSize -= 0.5;
      ctx.font = `italic ${authorFontSize}px sans-serif`;
    }
    
    if (ctx.measureText(authorText).width > 420) {
      while (authorText.length > 10 && ctx.measureText(authorText + '...').width > 420) {
        authorText = authorText.slice(0, -1);
      }
      authorText += '...';
    }
    ctx.fillText(authorText, 90, 758);

    drawPlumeLogo(ctx, 665, 715, 0.45);
  };

  const exportLyricardImage = () => {
    setExportingLyricard(true);
    setTimeout(() => {
      try {
        const previewCanvas = previewCanvasRef.current;
        if (!previewCanvas) {
          setExportingLyricard(false);
          return;
        }

        drawPlumeCard(previewCanvas);

        const dataUrl = previewCanvas.toDataURL('image/png');
        const link = document.createElement('a');
        link.download = `plume_citation_${story.title.toLowerCase().replace(/[^a-z0-9]/g, '_')}.png`;
        link.href = dataUrl;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      } catch (err) {
        console.error("Erreur d'exportation de la PlumeCard:", err);
      } finally {
        setExportingLyricard(false);
      }
    }, 400);
  };

  // Theme styling definitions (V1 & V2 Adapted)
  const themeClasses: Record<ReadingTheme, string> = {
    light: 'bg-[#FCFBF8] text-[#1F2937] border-[#ecebf6]',
    sepia: 'bg-[#F4ECD8] text-[#433422] border-[#E6D4AF]',
    dimmed: 'bg-[#181824] text-[#E4E4E7] border-[#2c2c3e]',
    dark: 'bg-[#0A0A0F] text-[#E4E4E7] border-[#1C1C28]',
  };

  // Background gradient adaptations based on book atmosphere (story.ambiance)
  const getAmbianceGradient = () => {
    const spaceMap: Record<string, string> = {
      'Sombre': 'from-[#0B0C10] via-[#151722] to-[#0A0A0F]',
      'Lumineux': 'from-[#FCFAF5] via-[#FFFBF5] to-[#FAF6F2]',
      'Mélancolique': 'from-[#F3F4F7] via-[#E9EBF1] to-[#DEE1E8]',
      'Captivant': 'from-[#140E1B] via-[#24172C] to-[#12091A]',
      'Onirique': 'from-[#FAF5FC] via-[#FFF6FC] to-[#FAF2FB]',
      'Mystérieux': 'from-[#090710] via-[#161226] to-[#08050F]'
    };
    
    // Force dark version if theme is dark/dimmed
    if (readingTheme === 'dark' || readingTheme === 'dimmed') {
      if (story.ambiance === 'Lumineux') return 'from-[#0A0A0F] to-[#161722]';
      if (story.ambiance === 'Mélancolique') return 'from-[#141829] to-[#0E101E]';
      return spaceMap[story.ambiance] || 'from-[#0F0F14] to-[#0A0A0F]';
    }
    
    // Light versions
    if (readingTheme === 'light' || readingTheme === 'sepia') {
      if (story.ambiance === 'Sombre') return 'from-[#FAF8F5] to-[#EBE9E4]';
      if (story.ambiance === 'Captivant') return 'from-[#FFF8FC] to-[#F5ECEF]';
      return spaceMap[story.ambiance] || 'from-[#FAF6F0] to-[#FFF9F6]';
    }
    
    return 'from-[#FCFBF8] to-[#FCFBF8]';
  };

  const fontStyleClasses: Record<FontStyleType, string> = {
    sans: 'font-sans',
    serif: 'font-serif tracking-wide',
    classic: 'font-[Georgia] leading-relaxed tracking-normal',
    mono: 'font-mono text-xs scale-[0.98] leading-relaxed'
  };

  const lineSpacingClasses: Record<LineSpacingType, string> = {
    tight: 'leading-normal p-1',
    normal: 'leading-relaxed md:leading-loose p-2.5',
    loose: 'leading-extra-loose md:leading-[2.5rem] p-4'
  };

  // Get metadata block
  const chapterComments = comments.filter(c => c.chapterId === activeChapter.id);

  return (
    <div ref={readerRootRef} className={`min-h-screen pb-24 transition-all duration-700 bg-gradient-to-br ${getAmbianceGradient()} ${readingTheme === 'dark' || readingTheme === 'dimmed' ? 'dark text-[#E4E4E7]' : 'text-[#2C3E50]'}`}>
      
      {/* 1. TOP HEADER NAVIGATION - HIDDEN IN IMMERSIVE MODE */}
      {!isImmersive && (
        <div className="sticky top-0 z-30 border-b bg-white/90 dark:bg-black/90 backdrop-blur-md border-slate-200 dark:border-purple-900/10 py-3.5 shadow-xs transition-all animate-fade-in" style={{ paddingTop: 'max(0.875rem, env(safe-area-inset-top))' }}>
          <div className="max-w-5xl mx-auto px-4 flex items-center justify-between">
            
            {/* Back button */}
            <button
              id="reader-back-btn"
              onClick={onBack}
              className="flex items-center space-x-1.5 text-xs font-black uppercase tracking-wider text-gray-500 hover:text-purple-600 dark:text-gray-400 dark:hover:text-purple-400 cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Quitter</span>
            </button>

            {/* Book metadata dynamic title */}
            <div className="text-center max-w-[160px] sm:max-w-xs truncate">
              <span className="text-[9px] uppercase font-bold tracking-widest text-purple-600 dark:text-purple-450 block font-mono">Lecture</span>
              <h1 className="text-sm font-black font-serif text-gray-900 dark:text-white truncate leading-tight">{story.title}</h1>
            </div>

            {/* Top Toolbar controls */}
            <div className="flex items-center space-x-1.5">

              {/* Mise en avant (administrateur uniquement) */}
              {currentUser.role === 'Administrateur' && onToggleFeatured && (
                <button
                  onClick={() => onToggleFeatured(story.id)}
                  className={`p-2.5 rounded-xl border transition ${
                    story.featured
                      ? 'bg-amber-500/15 border-amber-500/30 text-amber-500'
                      : 'bg-gray-100 dark:bg-zinc-800 text-gray-400 border-gray-200 dark:border-zinc-700 hover:text-amber-500'
                  }`}
                  title={story.featured ? 'Retirer de la une' : 'Mettre ce récit en avant'}
                >
                  <Sparkles className="w-4 h-4" />
                </button>
              )}

              {/* Téléchargement hors-ligne */}
              <button
                id="reader-download-btn"
                onClick={toggleDownload}
                className={`p-2.5 rounded-xl border transition ${
                  downloaded
                    ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-500'
                    : 'bg-gray-100 dark:bg-zinc-800 text-gray-400 border-gray-200 dark:border-zinc-700 hover:text-purple-600'
                }`}
                title={downloaded ? 'Téléchargé (disponible hors ligne) — appuyer pour retirer' : 'Télécharger pour lire hors ligne'}
              >
                {downloaded ? <Check className="w-4 h-4" /> : <Download className="w-4 h-4" />}
              </button>

              {/* Soundscape Control Icon */}
              <span className="relative">
                <button
                  id="active-sound-icon-btn"
                  onClick={() => {
                    if (activeSoundscape !== 'none') {
                      setActiveSoundscape('none');
                    } else {
                      setActiveSoundscape('rain');
                    }
                  }}
                  className={`p-2.5 rounded-xl border transition ${
                    activeSoundscape !== 'none'
                      ? 'bg-blue-500/10 border-blue-500/20 text-blue-500 font-extrabold rotate-3'
                      : 'bg-gray-100 dark:bg-zinc-800 text-gray-400 border-gray-200 dark:border-zinc-700 hover:text-blue-500'
                  }`}
                  title="Ambiance Sonore Tactile"
                >
                  {activeSoundscape !== 'none' ? <Volume2 className="w-4 h-4 animate-bounce" /> : <VolumeX className="w-4 h-4" />}
                </button>
              </span>
              
              {/* Immersion button toggler */}
              <button
                id="toggle-immersive-quick-btn"
                onClick={() => setIsImmersive(true)}
                className="p-2.5 rounded-xl bg-gray-100 dark:bg-zinc-800 text-gray-450 hover:text-purple-600 dark:hover:text-purple-400 border border-gray-200 dark:border-zinc-700 transition cursor-pointer"
                title="Passer en mode immersion totale"
              >
                <Maximize2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 2. FLOATING FLOATING IMMERSIVE CLOSE TOOL - SHOWN EXCLUSIVELY DURING FOCUS/IMMERSIVE MODE */}
      {isImmersive && (
        <div className="fixed top-4 right-4 z-50 animate-fade-in select-none">
          <button
            id="exit-immersive-floating-btn"
            onClick={() => setIsImmersive(false)}
            className="flex items-center space-x-1.5 px-3.5 py-2 rounded-full bg-black/60 hover:bg-black/85 backdrop-blur-md text-white text-xs font-black uppercase tracking-wider transition hover:scale-105 shadow-xl border border-white/10"
          >
            <Minimize2 className="w-3.5 h-3.5" />
            <span>Fermer Immersion</span>
          </button>
        </div>
      )}

      {/* 3. MULTI-LAYER READING BOARD CHASSIS */}
      <div className="max-w-2xl mx-auto px-4 py-6 space-y-6 relative">
        
        {/* UPPER CONTROLS AND CUSTOMIZATION ZONE (HIDDEN DURING IMMERSION) */}
        {!isImmersive && (
          <div className="bg-white/80 dark:bg-zinc-900/40 backdrop-blur-md rounded-2xl border border-gray-150 dark:border-zinc-800/60 shadow-xs animate-fade-in text-left overflow-hidden">
            {/* Collapsible Header */}
            <button
              onClick={() => setIsSettingsExpanded(!isSettingsExpanded)}
              className="w-full flex items-center justify-between p-4 hover:bg-gray-50/50 dark:hover:bg-zinc-850/30 transition-all focus:outline-hidden select-none cursor-pointer"
            >
              <div className="flex flex-wrap items-center gap-2">
                <Sliders className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
                <span className="font-sans font-black text-[10px] text-gray-850 dark:text-gray-200 uppercase tracking-widest">
                  Ambiance & Options de lecture
                </span>
                
                {activeSoundscape !== 'none' && (
                  <span className="bg-purple-500/15 text-purple-600 dark:text-purple-300 text-[8.5px] font-black uppercase px-2 py-0.5 rounded-full animate-pulse font-mono">
                    Ambiance: {activeSoundscape}
                  </span>
                )}
                
                <span className="bg-purple-500/10 text-purple-600 dark:text-purple-300 text-[8.5px] font-bold px-2 py-0.5 rounded font-mono">
                  {fontSize}px
                </span>

                <span className="bg-gray-100 dark:bg-zinc-800 text-gray-500 dark:text-gray-400 text-[8.5px] font-bold px-2 py-0.5 rounded uppercase font-mono">
                  {fontStyle}
                </span>

                {isCinemaMode && (
                  <span className="bg-purple-600/15 text-purple-600 dark:text-purple-400 text-[8.5px] font-black px-2 py-0.5 rounded uppercase">
                    Cinéma
                  </span>
                )}
              </div>
              
              <div className="flex items-center space-x-1.5 text-gray-400 dark:text-gray-500 shrink-0">
                <span className="text-[9px] uppercase font-black tracking-wider hidden sm:inline font-sans">
                  {isSettingsExpanded ? "Réduire" : "Déployer"}
                </span>
                {isSettingsExpanded ? (
                  <ChevronUp className="w-4 h-4 text-purple-650" />
                ) : (
                  <ChevronDown className="w-4 h-4" />
                )}
              </div>
            </button>

            {/* Collapsible Content Body */}
            {isSettingsExpanded && (
              <div className="p-4 pt-2 border-t border-gray-100 dark:border-zinc-800/80 space-y-4 animate-slide-down">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  
                  {/* Soundscape presets panel */}
                  <div className="space-y-2">
                    <span className="text-[10px] uppercase font-mono tracking-widest text-purple-600 dark:text-purple-400 font-bold flex items-center space-x-1">
                      <Volume2 className="w-3.5 h-3.5" />
                      <span>Ambiance Sonore Harmonique</span>
                    </span>
                    <div className="grid grid-cols-3 gap-1 select-none">
                      {[
                        { id: 'none', label: 'Silence' },
                        { id: 'rain', label: '🌧️ Pluie' },
                        { id: 'forest', label: '🌲 Forêt' },
                        { id: 'fireplace', label: '🔥 Foyer' },
                        { id: 'library', label: '🏛️ Salon' },
                        { id: 'ocean', label: '🌊 Océan' },
                        { id: 'breeze', label: '🍃 Vent' },
                      ].map((preset) => (
                        <button
                          key={preset.id}
                          id={`soundscape-select-${preset.id}`}
                          onClick={() => setActiveSoundscape(preset.id as SoundscapeType)}
                          className={`py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wider transition cursor-pointer ${
                            activeSoundscape === preset.id
                              ? 'bg-blue-600 text-white shadow-xs font-black'
                              : 'bg-gray-100 dark:bg-zinc-800 text-gray-500 dark:text-gray-400 hover:text-purple-600'
                          }`}
                        >
                          {preset.label}
                        </button>
                      ))}
                    </div>

                    {activeSoundscape !== 'none' && (
                      <div className="flex items-center space-x-2 pt-1">
                        <span className="text-[9.5px] font-bold text-gray-400">Volume :</span>
                        <input
                          id="sound-volume-slider"
                          type="range"
                          min="0"
                          max="1"
                          step="0.05"
                          value={soundVolume}
                          onChange={(e) => setSoundVolume(parseFloat(e.target.value))}
                          className="flex-1 accent-purple-600 bg-gray-200 h-1 rounded"
                        />
                        <span className="text-[9.5px] font-mono text-gray-400 font-bold font-mono">{~~(soundVolume * 100)}%</span>
                      </div>
                    )}

                    {/* Son immersif 3D (HRTF) — la source tourne autour de soi. */}
                    <button
                      type="button"
                      id="spatial-audio-toggle"
                      onClick={() => setSpatialAudioOn((v) => !v)}
                      className={`w-full flex items-center justify-between gap-2 py-1.5 px-2.5 rounded-lg text-[9px] font-black uppercase tracking-wider transition cursor-pointer mt-1 ${
                        spatialAudioOn
                          ? 'bg-purple-600 text-white shadow-xs'
                          : 'bg-gray-100 dark:bg-zinc-800 text-gray-500 dark:text-gray-400 hover:text-purple-600'
                      }`}
                      title="Son spatialisé pour casque et écouteurs"
                    >
                      <span className="flex items-center gap-1.5">
                        <Headphones className="w-3.5 h-3.5" />
                        <span>Son immersif 3D</span>
                      </span>
                      <span className={`text-[8px] px-1.5 py-0.5 rounded uppercase ${spatialAudioOn ? 'bg-white/25' : 'bg-gray-200 dark:bg-zinc-700'}`}>
                        {spatialAudioOn ? 'Casque' : 'Off'}
                      </span>
                    </button>
                  </div>

                  {/* Advanced Customizations */}
                  <div className="space-y-2">
                    <span className="text-[10px] uppercase font-mono tracking-widest text-[#7C3AED] dark:text-purple-400 font-bold flex items-center space-x-1">
                      <Sliders className="w-3.5 h-3.5" />
                      <span>Personnalisation Avancée</span>
                    </span>
                    
                    {/* Font families */}
                    <div className="flex items-center justify-between gap-1.5 pb-1">
                      <span className="text-[10px] font-bold text-gray-400">Police:</span>
                      <div className="flex gap-1">
                        {(['sans', 'serif', 'classic', 'mono'] as FontStyleType[]).map((f) => (
                          <button
                            key={f}
                            id={`font-family-select-${f}`}
                            onClick={() => setFontStyle(f)}
                            className={`px-2.5 py-1 rounded text-[9px] font-black uppercase tracking-wider transition leading-none cursor-pointer ${
                              fontStyle === f
                                ? 'bg-purple-600 text-white shadow-xs'
                                : 'bg-gray-100 dark:bg-zinc-800 text-gray-500'
                            }`}
                          >
                            {f === 'sans' ? 'Inter' : f === 'serif' ? 'Serif' : f === 'classic' ? 'Georgia' : 'Mono'}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Font Sizing Slider */}
                    <div className="flex items-center space-x-2 pb-1">
                      <span className="text-[10px] font-bold text-gray-400">Taille:</span>
                      <input
                        id="font-size-slider"
                        type="range"
                        min="14"
                        max="32"
                        value={fontSize}
                        onChange={(e) => setFontSize(parseInt(e.target.value))}
                        className="flex-1 accent-purple-600 bg-gray-200 h-1 rounded"
                      />
                      <span className="text-[10px] font-mono text-gray-450 font-bold">{fontSize}px</span>
                    </div>

                    {/* Line spacing heights */}
                    <div className="flex items-center justify-between gap-1.5">
                      <span className="text-[10px] font-bold text-gray-400">Interligne:</span>
                      <div className="flex gap-1">
                        {(['tight', 'normal', 'loose'] as LineSpacingType[]).map((sp) => (
                          <button
                            key={sp}
                            id={`line-spacing-select-${sp}`}
                            onClick={() => setLineSpacing(sp)}
                            className={`px-2.5 py-1 rounded text-[9px] font-black uppercase tracking-wider transition leading-none cursor-pointer ${
                              lineSpacing === sp
                                ? 'bg-purple-600 text-white shadow-xs'
                                : 'bg-gray-100 dark:bg-zinc-800 text-gray-500'
                            }`}
                          >
                            {sp === 'tight' ? 'Étroit' : sp === 'normal' ? 'Normal' : 'Spacieux'}
                          </button>
                        ))}
                      </div>
                    </div>

                  </div>

                </div>

                {/* Quick interactive Mode Activators */}
                <div className="pt-2 border-t border-gray-100 dark:border-zinc-800 flex flex-wrap gap-2 justify-between items-center text-[11px]">
                  {/* Cinema Mode switch box */}
                  <button
                    id="toggle-cinema-mode-btn"
                    onClick={() => setIsCinemaMode(!isCinemaMode)}
                    className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-xl border font-bold transition select-none cursor-pointer ${
                      isCinemaMode
                        ? 'bg-[#7C3AED] text-white border-[#7C3AED] shadow-sm'
                        : 'bg-gray-100 dark:bg-zinc-800/70 border-gray-200 dark:border-zinc-705 text-gray-550'
                    }`}
                    title="Le texte environnant s'estompe pour focaliser votre pensée."
                  >
                    <span>🎬 Mode Cinéma</span>
                    <span className={`text-[9px] py-0.2 px-1 rounded uppercase ${isCinemaMode ? 'bg-white/25' : 'bg-gray-200 dark:bg-zinc-700'}`}>
                      {isCinemaMode ? 'Actif' : 'Désactivé'}
                    </span>
                  </button>

                  {/* Reading Theme Selectors list */}
                  <div className="flex items-center gap-1">
                    <span className="text-[10px] font-bold text-gray-400 mr-1.5">Papier :</span>
                    {(['light', 'sepia', 'dimmed', 'dark'] as const).map((t) => (
                      <button
                        key={t}
                        id={`custom-read-theme-${t}`}
                        onClick={() => setReadingTheme(t)}
                        className={`px-2.5 py-1 text-[9.5px] font-bold uppercase tracking-wider rounded-lg border transition cursor-pointer ${
                          t === 'light' ? 'bg-[#FCFBF8] text-[#1F2937] border-gray-200' :
                          t === 'sepia' ? 'bg-[#F4ECD8] text-[#433422] border-[#E6D4AF]' :
                          t === 'dimmed' ? 'bg-[#181824] text-[#E4E4E7] border-gray-700' :
                          'bg-[#0A0A0F] text-[#E4E4E7] border-gray-800'
                        } ${readingTheme === t ? 'ring-2 ring-purple-600 scale-102 font-black' : 'opacity-75 hover:opacity-100'}`}
                      >
                        {t === 'light' ? 'Jour' : t === 'sepia' ? 'Sépia' : t === 'dimmed' ? 'Dim' : 'Nuit'}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

          </div>
        )}

        {/* 4. MAIN READING PAPER PAD WITH ADVANCED CONFIGURATIONS */}
        <main className={`p-6 md:p-12 rounded-[2.5rem] border shadow-md transition-all duration-700 ${themeClasses[readingTheme]} ${isImmersive ? 'ring-0 border-none bg-transparent shadow-none py-16' : ''}`}>

          {!hasChapters && (
            <div className="text-center py-16 px-4">
              <div className="text-4xl mb-3">📖</div>
              <h2 className="text-lg font-serif font-black mb-2">Aucun chapitre publié</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400 max-w-xs mx-auto">
                {isOwnStory
                  ? "Cette œuvre n'a pas encore de chapitre publié. Ajoute et publie un chapitre depuis l'onglet Écriture."
                  : "Cette œuvre n'a pas encore de chapitre publié. Reviens bientôt !"}
              </p>
            </div>
          )}

          {/* Chapter headers */}
          <div className="text-center mb-10 border-b border-gray-205/40 dark:border-zinc-800 pb-8">
            {activeTome && (
              <span className="text-[10px] uppercase font-mono tracking-widest text-purple-500 font-black block mb-1 leading-none">
                {activeTome.title}
              </span>
            )}
            <span className="text-[10px] uppercase font-mono tracking-widest text-[#7C3AED] dark:text-purple-400 font-extrabold block mb-2 leading-none">
              Récit {story.category} • Chapitre {activeChapterIndex + 1} de {story.chapters.length}
            </span>
            <h2 className="text-2xl md:text-3xl font-serif font-black tracking-tight mb-4 leading-normal">
              {activeChapter.title}
            </h2>
            
            {!isImmersive && (
              <div className="flex items-center justify-center space-x-2 text-[10px] text-gray-450 font-mono select-none">
                <span>Publié le {new Date(activeChapter.publishDate).toLocaleDateString()}</span>
                <span>•</span>
                <span>{paragraphs.length} Paragraphes</span>
                <span>•</span>
                <span>{Math.round(plainFromHtml(activeChapter.content).length / 5)} mots</span>
                <span>•</span>
                <span>{story.reads || 0} lectures</span>
                <span>•</span>
                <span>{story.likes || 0} likes</span>
              </div>
            )}
          </div>

          {/* CINEMA AND TEXT DISPLAY LAYOUT */}
          <article 
            id={`chapter-content-${activeChapter.id}`}
            className={`text-left select-text ${fontStyleClasses[fontStyle]} ${lineSpacingClasses[lineSpacing]}`}
            style={{ fontSize: `${fontSize}px` }}
          >
            {paragraphs.map((para, pIdx) => {
              const pText = para.text;
              const capKey = `${activeChapter.id}_p_${pIdx}`;
              const isPFocus = activeParagraphIndex === pIdx;
              const plikes = passageLikes[capKey] || 0;
              const hasLikedPass = likedPassagesMe[capKey];

              return (
                <div
                  key={pIdx}
                  id={`p-idx-${pIdx}`}
                  data-paragraph-index={pIdx}
                  onClick={() => handleParagraphSelect(pIdx)}
                  className={`relative group rounded-xl transition-all duration-500 cursor-pointer mb-6 ${
                    isCinemaMode 
                      ? (isPFocus 
                        ? 'opacity-100 scale-[1.01] bg-purple-500/5 dark:bg-purple-950/10 p-4 shadow-sm' 
                        : 'opacity-15 blur-[0.4px] hover:opacity-40 select-none scale-[0.98]'
                        )
                      : (isPFocus 
                        ? 'bg-purple-500/5 dark:bg-purple-950/5 border-l-4 border-purple-550/60 p-3.5'
                        : 'hover:bg-gray-100/30 dark:hover:bg-zinc-800/10 p-2 rounded-lg'
                        )
                  }`}
                >
                  {/* Floating discrete react toolbar next to hovered/focused paragraph */}
                  {!isImmersive && (
                    <div className={`absolute right-2 -bottom-2 z-10 items-center space-x-1.5 bg-white dark:bg-zinc-900 border border-gray-150 dark:border-zinc-800 rounded-full py-1 px-2.5 text-[10px] shadow-md animate-fade-in ${isPFocus ? 'flex' : 'hidden group-hover:flex'}`}>
                      {/* Like paragraph line (hidden in Cinema mode) */}
                      {!isCinemaMode && (
                        <>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleLikePassage(pIdx);
                            }}
                            className={`flex items-center space-x-0.5 font-bold transition hover:text-pink-500 ${hasLikedPass ? 'text-pink-500' : 'text-gray-450'}`}
                            title="Aimer ce passage précis"
                          >
                            <Heart className={`w-3 h-3 ${hasLikedPass ? 'fill-pink-500 text-pink-500' : ''}`} />
                            <span>{plikes}</span>
                          </button>

                          <div className="w-px h-3 bg-gray-200 dark:bg-zinc-800" />
                        </>
                      )}
                      
                      {/* Copy / Save Quote */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleSavePassage(pText);
                        }}
                        className={`font-black hover:text-[#7C3AED] ${savedQuotes.includes(pText.replace(/^[#\-\*\s]+/, '').trim()) ? 'text-purple-600' : 'text-gray-400'}`}
                        title="Sauvegarder la citation dans mon carnet"
                      >
                        <Bookmark className="w-3 h-3" />
                      </button>

                      <div className="w-px h-3 bg-gray-200 dark:bg-zinc-800" />

                      {/* Sparkles icon to trigger Lyricard builder creator */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          openLyricardCreator(pText);
                        }}
                        className="text-gray-450 hover:text-purple-600 font-black cursor-pointer"
                        title="Créer une PlumeCard (Lyricard)"
                      >
                        <Sparkles className="w-3 h-3 hover:scale-110 transition-transform" />
                      </button>
                    </div>
                  )}

                  <p
                    className="indent-4 leading-relaxed font-serif whitespace-pre-wrap break-words"
                    dangerouslySetInnerHTML={{ __html: para.html }}
                  />
                  
                  {/* Discreet indicator if this is a highly liked passage */}
                  {!isImmersive && !isCinemaMode && plikes >= 10 && (
                    <span className="text-[8.5px] font-black uppercase tracking-wider text-purple-600 bg-purple-500/10 px-2 py-0.5 rounded-full mt-2 inline-block select-none opacity-85 scale-95 font-sans">
                      💬 Passage très apprécié par {plikes} lecteurs
                    </span>
                  )}
                </div>
              );
            })}
          </article>

          {/* STATIC FLOATING PARTICLE REACTION EMITTER */}
          <div className="relative h-1 select-none pointer-events-none">
            {floatingEmojis.map((fe) => (
              <span
                key={fe.id}
                className="absolute text-2xl animate-float-up pointer-events-none"
                style={{ 
                  left: `${fe.x}%`, 
                  bottom: `0px` 
                }}
              >
                {fe.emoji}
              </span>
            ))}
          </div>

          {/* REACTION PRESETS BAR PANEL (HIDDEN IN IMMERSIVE) */}
          {!isImmersive && (
            <div className="mt-8 pt-5 border-t border-gray-150/60 dark:border-zinc-820 flex flex-col items-center gap-3">
              <span className="text-[10px] text-gray-400 uppercase font-black tracking-widest font-sans">S'exprimer sur la plume</span>
              <div id="discrete-reactions-bar" className="flex items-center space-x-3 bg-gray-100/60 dark:bg-zinc-900/50 border border-gray-150 dark:border-zinc-800/80 p-2 rounded-2xl select-none">
                {[
                  { emoji: '💡', label: 'Inspirant' },
                  { emoji: '🎨', label: 'Poétique' },
                  { emoji: '🔥', label: 'Épique' },
                  { emoji: '✍️', label: 'Génie' },
                  { emoji: '😮', label: 'Surprenant' },
                  { emoji: '❤️', label: 'Passion' }
                ].map((item) => (
                  <button
                    key={item.emoji}
                    id={`reaction-emoji-${item.emoji}`}
                    onClick={() => {
                        launchEmoji(item.emoji);
                    }}
                    className="p-1 px-2.5 rounded-xl hover:bg-white dark:hover:bg-zinc-800 text-lg transition scale-100 hover:scale-120 hover:-rotate-3 active:scale-95 cursor-pointer block text-center"
                    title={item.label}
                  >
                    <span>{item.emoji}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* FIN DE CHAPITRE : le moment d'émotion maximale mérite mieux qu'un
              simple bouton — transition soignée vers la suite, ou célébration
              quand le livre est terminé. */}
          <div className="mt-12 rounded-2xl border border-purple-500/20 bg-gradient-to-br from-purple-50 via-white to-purple-50/40 dark:from-purple-950/25 dark:via-transparent dark:to-purple-950/10 p-5 text-center space-y-3 select-none">
            {activeChapterIndex < story.chapters.length - 1 ? (
              <>
                <p className="text-[10px] font-black uppercase tracking-widest text-purple-500">
                  ✓ Fin du chapitre {activeChapterIndex + 1} sur {story.chapters.length}
                </p>
                <button
                  id="end-of-chapter-next"
                  onClick={() => setActiveChapterIndex(activeChapterIndex + 1)}
                  className="w-full sm:w-auto sm:min-w-[260px] mx-auto px-6 py-3 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-black uppercase tracking-wider shadow-md active:scale-[0.98] transition flex items-center justify-center gap-2"
                >
                  <span className="truncate max-w-[220px]">
                    Chapitre suivant{story.chapters[activeChapterIndex + 1]?.title ? ` : ${story.chapters[activeChapterIndex + 1].title}` : ''}
                  </span>
                  <ChevronRight className="w-4 h-4 flex-shrink-0" />
                </button>
                {!isOwnStory && (
                  <button
                    id="end-of-chapter-like"
                    onClick={() => onToggleStoryLike(story.id)}
                    className={`text-[11px] font-bold transition ${isLiked ? 'text-pink-500' : 'text-gray-400 hover:text-pink-500'}`}
                  >
                    {isLiked ? '❤️ Tu aimes ce livre' : "🤍 J'aime ce livre"}
                  </button>
                )}
              </>
            ) : (
              <>
                <p className="text-3xl leading-none">🎉</p>
                <h4 className="text-sm font-black text-gray-900 dark:text-white">
                  Tu as terminé « {story.title} » !
                </h4>
                <p className="text-[11px] text-gray-500 dark:text-gray-400 max-w-sm mx-auto leading-relaxed">
                  Merci d'avoir lu jusqu'au bout. Un mot ou un cœur pour {story.authorName || "l'auteur"} — c'est ce qui fait écrire la suite.
                </p>
                {!isOwnStory && (
                  <div className="flex items-center justify-center gap-3 pt-1">
                    <button
                      id="end-of-book-like"
                      onClick={() => onToggleStoryLike(story.id)}
                      className={`px-4 py-2 rounded-xl text-[11px] font-black uppercase tracking-wider transition ${isLiked ? 'bg-pink-500/15 text-pink-500' : 'bg-purple-600 hover:bg-purple-700 text-white'}`}
                    >
                      {isLiked ? '❤️ Aimé' : "❤️ J'ai aimé"}
                    </button>
                    <button
                      id="end-of-book-follow"
                      onClick={() => onFollowAuthor(story.authorId)}
                      className="px-4 py-2 rounded-xl border border-purple-500/40 text-purple-600 dark:text-purple-400 text-[11px] font-black uppercase tracking-wider hover:bg-purple-50 dark:hover:bg-purple-950/20 transition"
                    >
                      Suivre {story.authorName || "l'auteur"}
                    </button>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Navigation between chapters */}
          <div className="mt-12 pt-8 border-t border-gray-205/60 dark:border-zinc-800 flex flex-col sm:flex-row items-center justify-between gap-4 select-none">
            <button
              id="prev-chapter-btn"
              disabled={activeChapterIndex === 0}
              onClick={() => setActiveChapterIndex(activeChapterIndex - 1)}
              className={`flex items-center space-x-1 px-4 py-2.5 rounded-xl border border-gray-200 dark:border-zinc-800 text-xs font-black uppercase tracking-wider select-none cursor-pointer ${
                activeChapterIndex === 0 
                  ? 'opacity-40 cursor-not-allowed text-gray-400' 
                  : 'hover:bg-purple-50 dark:hover:bg-purple-950/10 hover:text-purple-600 dark:text-gray-300'
              }`}
            >
              <ChevronLeft className="w-4 h-4" />
              <span>Précédent</span>
            </button>

            <span className="text-xs font-sans font-black uppercase tracking-widest px-4 py-1.5 bg-[#7C3AED]/10 text-[#7C3AED] dark:text-purple-400 rounded-full">
              {Math.min(100, Math.max(0, readPercent))}% de l'œuvre
            </span>

            <button
              id="next-chapter-btn"
              disabled={activeChapterIndex === story.chapters.length - 1}
              onClick={() => setActiveChapterIndex(activeChapterIndex + 1)}
              className={`flex items-center space-x-1 px-4 py-2.5 rounded-xl border border-gray-200 dark:border-zinc-800 text-xs font-black uppercase tracking-wider select-none cursor-pointer ${
                activeChapterIndex === story.chapters.length - 1 
                  ? 'opacity-40 cursor-not-allowed text-gray-400' 
                  : 'hover:bg-purple-50 dark:hover:bg-purple-950/10 hover:text-purple-600 dark:text-gray-300'
              }`}
            >
              <span>Suivant</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* Author follow Card & Engagement buttons (HIDDEN IN IMMERSIVE) */}
          {!isImmersive && (
            <div className="mt-10 p-5 rounded-2xl bg-gray-50/70 dark:bg-zinc-900/40 border border-gray-150 dark:border-[#2a2a3a] flex flex-col sm:flex-row items-center justify-between gap-4">
              
              <div className="flex items-center space-x-3 text-left">
                <img
                  src={story.authorAvatar}
                  alt={story.authorName}
                  onClick={() => onViewProfile ? onViewProfile(story.authorId) : onOpenDiscussion(story.authorId)}
                  className="w-10 h-10 rounded-full object-cover ring-2 ring-purple-600 cursor-pointer hover:scale-105 transition-transform"
                  referrerPolicy="no-referrer"
                  title="Consulter le profil"
                />
                <div>
                  <div className="flex items-center space-x-1">
                    <span 
                      onClick={() => onViewProfile ? onViewProfile(story.authorId) : onOpenDiscussion(story.authorId)}
                      className="font-sans font-black text-xs text-gray-800 dark:text-gray-100 hover:text-purple-600 dark:hover:text-purple-400 hover:underline cursor-pointer transition-colors"
                      title="Consulter le profil"
                    >
                      {story.authorName}
                    </span>
                    {story.authorVerified && (
                      <span className="bg-blue-500 text-white rounded-full p-0.5 text-[8px] font-bold">✓</span>
                    )}
                  </div>
                  <p className="text-[10px] text-gray-450 font-sans font-medium uppercase tracking-wider mt-0.5">Auteur du genre {story.genre}</p>
                </div>
              </div>

              <div className="flex items-center space-x-2 w-full sm:w-auto justify-end">
                <button
                  id="reader-follow-author-btn"
                  onClick={() => onFollowAuthor(story.authorId)}
                  className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all flex items-center space-x-1 ${
                    isFollowing
                      ? 'bg-gray-200 dark:bg-gray-800 text-gray-800 dark:text-gray-300'
                      : 'bg-gradient-to-r from-purple-600 to-violet-850 text-white hover:opacity-90 shadow-sm'
                  }`}
                >
                  {isFollowing ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-purple-600" />
                      <span>Suivi</span>
                    </>
                  ) : (
                    <>
                      <Plus className="w-3.5 h-3.5" />
                      <span>Suivre</span>
                    </>
                  )}
                </button>

                <button
                  id="reader-like-story-btn"
                  onClick={() => onToggleStoryLike(story.id)}
                  className={`px-2.5 py-1.5 rounded-xl border transition-all cursor-pointer flex items-center gap-1 text-[10px] font-black ${
                    isLiked
                      ? 'bg-pink-500/10 text-pink-500 border-pink-500/30'
                      : 'bg-white dark:bg-gray-850 text-gray-400 border-gray-200 dark:border-gray-700 hover:text-pink-500'
                  }`}
                  title={isLiked ? 'Retirer mon like' : 'Aimer cette histoire'}
                >
                  <Heart className={`w-3.5 h-3.5 ${isLiked ? 'fill-pink-500 text-pink-500' : ''}`} />
                  <span>{story.likes || 0}</span>
                </button>

                <button
                  id="reader-fav-story-btn"
                  onClick={() => onToggleFavorite(story.id)}
                  className={`px-2.5 py-1.5 rounded-xl border transition-all cursor-pointer flex items-center gap-1 text-[10px] font-black ${
                    isFavorited
                      ? 'bg-purple-600/10 text-purple-600 border-purple-500/30'
                      : 'bg-white dark:bg-gray-850 text-gray-400 border-gray-200 dark:border-gray-700 hover:text-purple-600'
                  }`}
                  title={isFavorited ? 'Retirer des favoris' : 'Ajouter aux favoris'}
                >
                  <Star className={`w-3.5 h-3.5 ${isFavorited ? 'fill-purple-600 text-purple-650' : ''}`} />
                  <span>{story.favoritesCount || 0}</span>
                </button>

                {/* Notation 1 à 5 (moyenne réelle recalculée côté serveur) */}
                <div id="reader-rating" className="flex items-center gap-0.5 px-2.5 py-1.5 rounded-xl border bg-white dark:bg-gray-850 border-gray-200 dark:border-gray-700" title="Noter cette histoire">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <button
                      key={n}
                      id={`reader-rate-${n}`}
                      onClick={() => onRateStory(story.id, n)}
                      className="cursor-pointer leading-none"
                      title={`Noter ${n}/5`}
                    >
                      <Star className={`w-3.5 h-3.5 ${n <= userRating ? 'fill-amber-400 text-amber-400' : 'text-gray-300 dark:text-gray-600 hover:text-amber-400'}`} />
                    </button>
                  ))}
                  <span className="text-[10px] font-black text-gray-400 ml-1">{(story.rating || 0).toFixed(1)}</span>
                </div>
              </div>

            </div>
          )}

          {/* PERSONAL LIBRARY STATUS CONTROLLER (HIDDEN IN IMMERSIVE) */}
          {!isImmersive && (
            <div className="mt-5 bg-[#7C3AED]/5 border border-[#7C3AED]/10 p-3.5 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-3 text-left">
              <div className="max-w-xs">
                <span className="text-[9px] uppercase font-black text-[#7C3AED] font-sans tracking-widest block">Classement Bibliothèque</span>
                <p className="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5 leading-snug">Ranger cette histoire dans l'un de vos tiroirs d'abonné.</p>
              </div>
              
              <div className="flex flex-wrap items-center gap-1.5 w-full sm:w-auto justify-end select-none">
                <button
                  id="toggle-lib-reading-btn"
                  onClick={() => onToggleCurrentlyReading(story.id)}
                  className={`px-3 py-1.5 rounded-xl text-[10px] font-bold uppercase transition flex items-center space-x-1 ${
                    currentlyReading.includes(story.id)
                      ? 'bg-purple-600 text-white shadow-xs font-black'
                      : 'bg-white dark:bg-gray-805 text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-zinc-800 hover:text-purple-500'
                  }`}
                >
                  <span>📖 En cours</span>
                </button>

                <button
                  id="toggle-lib-completed-btn"
                  onClick={() => onToggleCompletedStories(story.id)}
                  className={`px-3 py-1.5 rounded-xl text-[10px] font-bold uppercase transition flex items-center space-x-1 ${
                    completedStories.includes(story.id)
                      ? 'bg-green-600 text-white shadow-xs font-black'
                      : 'bg-white dark:bg-gray-805 text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-zinc-800 hover:text-green-500'
                  }`}
                >
                  <span>✅ Terminé</span>
                </button>

                <button
                  id="toggle-lib-read-later-btn"
                  onClick={() => onToggleReadLater(story.id)}
                  className={`px-3 py-1.5 rounded-xl text-[10px] font-bold uppercase transition flex items-center space-x-1 ${
                    readLater.includes(story.id)
                      ? 'bg-blue-600 text-white shadow-xs font-black'
                      : 'bg-white dark:bg-gray-855 text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-zinc-800 hover:text-blue-500'
                  }`}
                >
                  <span>⏳ À lire</span>
                </button>
              </div>
            </div>
          )}

          {/* LOWER INTERACTIVE DRAWERS TRIGGER PANEL (HIDDEN IN IMMERSIVE) */}
          {!isImmersive && (
            <div className="mt-5 grid grid-cols-2 gap-3 pt-4 border-t border-gray-150 dark:border-zinc-815">
              <button
                id="drawer-chapters-btn"
                onClick={() => setIsChaptersOpen(true)}
                className="flex items-center justify-center space-x-2 py-3 px-4 bg-gray-50 dark:bg-zinc-900 hover:bg-purple-50 dark:hover:bg-purple-950/15 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-[#2a2a3a] rounded-xl text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer"
              >
                <BookOpen className="w-4 h-4 text-purple-600" />
                <span>Index ({story.chapters.length})</span>
              </button>
              
              <button
                id="drawer-comments-btn"
                onClick={() => setIsCommentsOpen(true)}
                className="flex items-center justify-center space-x-2 py-3 px-4 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-[10px] font-black uppercase tracking-wider transition-all shadow-sm cursor-pointer"
              >
                <MessageCircle className="w-4 h-4 fill-white/10" />
                <span>Commentaires ({chapterComments.length})</span>
              </button>
            </div>
          )}

        </main>

      </div>


      {/* ==================== SCREEN 3: STANDARD COMMENT SHEET DRAWERS ==================== */}
      {isCommentsOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center animate-fade-in text-left">
          <div 
            className="absolute inset-0 bg-black/60 backdrop-blur-xs transition-opacity"
            onClick={() => setIsCommentsOpen(false)}
          />
          
          <div className="relative w-full max-w-xl bg-white dark:bg-black rounded-t-[2rem] shadow-2xl border-t border-gray-150 dark:border-purple-900/20 flex flex-col h-[82vh] transition-transform animate-slide-up overflow-hidden">
            <div className="w-12 h-1.5 bg-gray-300 dark:bg-purple-950/40 rounded-full mx-auto my-3 pointer-events-none opacity-6 w-full" />

            <div className="px-5 pb-3 border-b border-gray-100 dark:border-purple-900/15 flex items-center justify-between font-sans">
              <div className="text-left">
                <span className="text-[9px] uppercase font-mono tracking-widest text-[#7C3AED] font-bold">Retour sur ce chapitre</span>
                <h3 className="font-serif font-black text-sm text-gray-900 dark:text-white mt-0.5">
                  Commentaires ({chapterComments.length})
                </h3>
              </div>
              
              <button
                id="close-comments-drawer"
                onClick={() => setIsCommentsOpen(false)}
                className="p-1 text-xs font-black text-gray-550"
              >
                Fermer
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4 pb-20 scrollbar-none">
              {chapterComments.length === 0 ? (
                <div className="text-center py-16 px-4">
                  <div className="w-12 h-12 rounded-full bg-purple-500/10 flex items-center justify-center mx-auto mb-3">
                    <MessageCircle className="w-6 h-6 text-[#7C3AED]" />
                  </div>
                  <h4 className="font-bold text-xs text-gray-800 dark:text-gray-200">Aucun retour pour l'instant</h4>
                  <p className="text-[11px] text-gray-400 mt-1 max-w-xs mx-auto">
                    Soyez le premier lecteur à partager vos impressions constructives sur la plume de l'auteur.
                  </p>
                </div>
              ) : (
                chapterComments.map((com) => (
                  <div key={com.id} className="p-3.5 bg-gray-55 dark:bg-[#0E0E14] rounded-xl border border-gray-100 dark:border-purple-900/15 text-left space-y-2shadow-xs">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <img
                          src={com.avatar}
                          alt={com.username}
                          onClick={() => {
                            if (onViewProfile) {
                              onViewProfile(com.userId);
                            } else {
                              onOpenDiscussion(com.userId);
                            }
                            setIsCommentsOpen(false);
                          }}
                          className="w-6 h-6 rounded-full object-cover cursor-pointer hover:scale-105 transition-transform"
                          referrerPolicy="no-referrer"
                          title="Consulter le profil"
                        />
                        <span 
                          onClick={() => {
                            if (onViewProfile) {
                              onViewProfile(com.userId);
                            } else {
                              onOpenDiscussion(com.userId);
                            }
                            setIsCommentsOpen(false);
                          }}
                          className="text-xs font-bold text-gray-900 dark:text-white hover:text-purple-600 hover:underline cursor-pointer transition-colors"
                          title="Consulter le profil"
                        >
                          {com.username}
                        </span>
                      </div>
                      <span className="text-[9px] text-gray-400 font-mono">
                        {new Date(com.date).toLocaleDateString()}
                      </span>
                    </div>

                    <p className="text-xs text-gray-650 dark:text-gray-300 whitespace-pre-line leading-relaxed">
                      {com.content}
                    </p>

                    <div className="flex items-center justify-between text-[10px] font-bold text-[#7C3AED] pt-1.5 border-t border-gray-100 dark:border-zinc-800">
                      <button
                        onClick={() => onLikeComment(com.id)}
                        className={`flex items-center space-x-1 hover:text-purple-600 transition-colors ${com.likedByMe ? 'font-black text-pink-500' : ''}`}
                      >
                        <Heart className="w-3.5 h-3.5" />
                        <span>{com.likes} J'aime</span>
                      </button>

                      <div className="flex items-center space-x-3">
                        <button
                          onClick={() => setActiveReplyBox(activeReplyBox === com.id ? null : com.id)}
                          className="hover:underline"
                        >
                          Répondre
                        </button>

                        {(currentUser.id === com.userId || currentUser.id === story.authorId || currentUser.role === 'Administrateur') && (
                          <button
                            onClick={() => onDeleteComment(com.id)}
                            className="text-purple-600 dark:text-purple-400 hover:underline font-bold"
                          >
                            Supprimer
                          </button>
                        )}
                      </div>
                    </div>

                    {com.replies.length > 0 && (
                      <div className="ml-4 pl-3 border-l-2 border-purple-200 dark:border-purple-900/50 space-y-2 mt-2 pt-1">
                        {com.replies.map((rep) => (
                          <div key={rep.id} className="text-left text-[11px] space-y-0.5">
                            <span className="font-bold text-gray-800 dark:text-gray-300">{rep.username}</span>
                            <p className="text-gray-600 dark:text-gray-400">{rep.content}</p>
                          </div>
                        ))}
                      </div>
                    )}

                    {activeReplyBox === com.id && (
                      <div className="flex items-center space-x-2 mt-2 pt-2 border-t border-gray-100 dark:border-zinc-805">
                        <input
                          type="text"
                          placeholder="Écrire une réponse..."
                          value={replyText[com.id] || ''}
                          onChange={(e) => setReplyText({ ...replyText, [com.id]: e.target.value })}
                          className="text-xs bg-white dark:bg-zinc-900 border border-gray-205 rounded-xl px-2.5 py-1.5 focus:outline-none w-full dark:text-white"
                        />
                        <button
                          onClick={() => handleReplySubmit(com.id)}
                          className="bg-purple-600 text-white rounded-xl px-2.5 py-1.5 text-xs font-bold"
                        >
                          Poster
                        </button>
                      </div>
                    )}

                  </div>
                ))
              )}
            </div>

            <form onSubmit={handleCommentSubmit} className="absolute bottom-0 inset-x-0 p-4 bg-gray-50 dark:bg-zinc-950 border-t border-gray-100 dark:border-[#1E1E26]">
              <div className="flex items-end space-x-2 max-w-xl mx-auto">
                <textarea
                  value={newCommentText}
                  onChange={(e) => setNewCommentText(e.target.value)}
                  placeholder="Écrivez votre commentaire..."
                  rows={2}
                  className="flex-1 bg-white dark:bg-[#1B1B26] border border-gray-200 dark:border-zinc-800 rounded-xl p-2.5 text-xs focus:outline-none dark:text-white resize-none"
                />
                <button
                  type="submit"
                  disabled={!newCommentText.trim()}
                  className={`bg-purple-600 text-white text-xs font-black uppercase tracking-wider px-3.5 py-2.5 rounded-xl hover:bg-purple-700 transition flex items-center space-x-1 ${
                    !newCommentText.trim() ? 'opacity-40 cursor-not-allowed' : ''
                  }`}
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Publier</span>
                </button>
              </div>
            </form>

          </div>
        </div>
      )}

      {/* ==================== SCREEN 4: CHAPTERS SUMMARY INDEX ==================== */}
      {isChaptersOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center animate-fade-in text-left">
          <div 
            className="absolute inset-0 bg-black/60 backdrop-blur-xs transition-opacity"
            onClick={() => setIsChaptersOpen(false)}
          />
          
          <div className="relative w-full max-w-xl bg-white dark:bg-black rounded-t-[2rem] shadow-2xl border-t border-gray-150 dark:border-purple-900/20 flex flex-col h-[70vh] transition-transform animate-slide-up overflow-hidden">
            <div className="w-12 h-1.5 bg-gray-300 dark:bg-purple-950/40 rounded-full mx-auto my-3 pointer-events-none opacity-6 w-full" />

            <div className="px-5 pb-3 border-b border-gray-100 dark:border-purple-900/15 flex items-center justify-between">
              <div className="text-left">
                <span className="text-[9px] uppercase font-mono tracking-widest text-purple-600">Sommaire de l'œuvre</span>
                <h3 className="font-serif font-black text-sm text-gray-900 dark:text-white mt-0.5">
                  Chapitres ({story.chapters.length})
                </h3>
              </div>
              
              <button
                onClick={() => setIsChaptersOpen(false)}
                className="p-1 px-3.5 bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 rounded-full text-xs font-black uppercase text-gray-500 cursor-pointer"
              >
                Fermer
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-1.5 pb-12 scrollbar-none">
              {story.chapters.map((ch, idx) => {
                const isSelected = activeChapterIndex === idx;
                const isRead = readChapters.includes(ch.id);
                // En-tête de TOME : inséré au changement de tome entre deux
                // chapitres consécutifs (uniquement si l'œuvre a des tomes).
                const tomeHeader = tomesById.size > 0 && ch.tomeId !== (story.chapters[idx - 1]?.tomeId ?? null)
                  ? (ch.tomeId ? (tomesById.get(ch.tomeId)?.title || 'Tome') : 'Hors tome')
                  : null;
                return (
                  <React.Fragment key={ch.id}>
                  {tomeHeader && (
                    <div className="pt-3 pb-1 px-1 first:pt-0">
                      <span className="text-[10px] font-black uppercase tracking-widest text-purple-500">{tomeHeader}</span>
                    </div>
                  )}
                  <button
                    onClick={() => {
                      setActiveChapterIndex(idx);
                      setIsChaptersOpen(false);
                    }}
                    className={`w-full text-left p-3.5 rounded-xl text-xs font-bold flex items-center justify-between transition-all cursor-pointer ${
                      isSelected 
                        ? 'bg-purple-100 text-purple-800 dark:bg-purple-950/40 dark:text-purple-350 border border-purple-500/35' 
                        : 'text-gray-750 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-zinc-900'
                    }`}
                  >
                    <div className="flex items-center space-x-3 min-w-0 pr-2">
                      <span className="font-mono text-[9px] opacity-50 flex-shrink-0">
                        {String(idx + 1).padStart(2, '0')}
                      </span>
                      <span className="truncate">{ch.title}</span>
                      <span className="text-[8.5px] font-mono text-gray-400 flex-shrink-0">{formatMinutes(chapterMinutes(ch))}</span>
                    </div>
                    {isRead ? (
                      <span className="text-[8px] bg-green-500/10 text-green-505 px-2.5 py-0.5 rounded-full font-black uppercase tracking-wider flex items-center space-x-0.5">
                        <Check className="w-3 h-3 stroke-[3]" />
                        <span>Lu</span>
                      </span>
                    ) : (
                      <span className="text-[9.5px] text-gray-400 font-bold uppercase tracking-wider">Non lu</span>
                    )}
                  </button>
                  </React.Fragment>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ==================== SCREEN 6: EXTRA BEAUTIFUL GENIUS-STYLE LYRICARD MODAL ==================== */}
      {isLyricardOpen && (
        <div className="fixed inset-0 z-55 flex items-center justify-center animate-fade-in p-4 text-left">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-md" onClick={() => setIsLyricardOpen(false)} />
          
          <div className="relative w-full max-w-4xl bg-white dark:bg-zinc-950 border border-gray-150 dark:border-zinc-900 text-gray-900 dark:text-white rounded-[2rem] p-6 md:p-8 shadow-2xl flex flex-col max-h-[92vh] overflow-hidden">
            
            {/* Header title */}
            <div className="flex justify-between items-start mb-6">
              <div>
                <span className="text-[9px] uppercase font-mono tracking-widest text-[#7C3AED] dark:text-purple-400 font-black">Genius Lyricard Studio</span>
                <h3 className="text-sm font-serif font-black flex items-center gap-1.5 text-gray-900 dark:text-white">
                  <Sparkles className="w-4 h-4 text-yellow-500 fill-yellow-500" />
                  <span>Générateur de Citations Plume</span>
                </h3>
              </div>
              <button
                onClick={() => setIsLyricardOpen(false)}
                className="p-1 px-3.5 bg-gray-100 hover:bg-gray-200 dark:bg-zinc-900 hover:text-red-500 rounded-full text-[10px] font-black uppercase text-gray-500 cursor-pointer"
              >
                Fermer
              </button>
            </div>

            {/* Split layout: left preview, right customizer panel */}
            <div className="flex-1 overflow-y-auto grid grid-cols-1 md:grid-cols-2 gap-8 pb-4 scrollbar-none pr-1">
              
              {/* Left Column: Live render card using responsive canvas */}
              <div className="flex flex-col items-center justify-center bg-gray-50 dark:bg-zinc-900/10 p-4 rounded-[1.5rem] border border-gray-105 dark:border-zinc-905 overflow-hidden space-y-3">
                <div className="w-full flex items-center justify-between text-[10px] font-black uppercase tracking-wider text-zinc-400">
                  <span>Aperçu avant téléchargement</span>
                  <button
                    type="button"
                    onClick={() => drawPlumeCard(previewCanvasRef.current)}
                    className="px-2.5 py-1 rounded-lg bg-purple-500/10 text-purple-600 dark:text-purple-300 hover:bg-purple-500/15 transition"
                  >
                    Actualiser
                  </button>
                </div>

                <canvas 
                  ref={previewCanvasRef}
                  width={800}
                  height={800}
                  className="w-full max-w-[360px] aspect-square rounded-2xl shadow-xl border border-gray-105 dark:border-zinc-900 bg-zinc-900 animate-fade-in"
                />
              </div>

              {/* Right Column: Interactive options panel */}
              <div className="space-y-4 text-left flex flex-col justify-between">
                <div className="space-y-4">
                  {/* Text customization box */}
                  <div>
                    <label className="block text-xs font-mono font-black uppercase text-gray-450 dark:text-zinc-500 mb-1.5">
                      Contenu de la citation
                    </label>
                    <textarea
                      value={lyricText}
                      onChange={(e) => setLyricText(e.target.value)}
                      maxLength={350}
                      rows={3}
                      className="w-full text-xs p-3 rounded-xl border border-gray-205 dark:border-zinc-800 bg-gray-50 dark:bg-zinc-900/60 text-gray-800 dark:text-gray-100 font-serif leading-relaxed focus:ring-2 focus:ring-purple-605 outline-none resize-none"
                    />
                  </div>

                  {/* Background Selection option presets */}
                  <div>
                    <label className="text-xs font-mono font-black uppercase text-gray-455 dark:text-zinc-500 mb-2 flex items-center justify-between">
                      <span>Thème visuel</span>
                      <span className="text-[10px] text-purple-600 dark:text-purple-400 font-black uppercase tracking-wider">{lyricBg}</span>
                    </label>
                    <div className="flex flex-wrap gap-2.5 items-center">
                      {[
                        { id: 'sunset', class: 'from-pink-500 via-red-500 to-yellow-500', label: 'Sunset' },
                        { id: 'cosmic', class: 'from-indigo-950 via-purple-900 to-pink-700', label: 'Cosmix' },
                        { id: 'emerald', class: 'from-teal-850 via-emerald-600 to-green-400', label: 'Émeraude' },
                        { id: 'aurora', class: 'from-slate-950 via-teal-950 to-cyan-550', classReal: 'bg-gradient-to-tr from-slate-950 via-[#0B2533] to-[#0A8AA4]', label: 'Aurore' },
                        { id: 'gold', class: 'from-amber-800 via-orange-650 to-yellow-400', label: 'Doré' },
                        { id: 'neon', class: 'from-purple-900 via-violet-800 to-fuchsia-500', label: 'Néon' },
                        { id: 'dark', class: 'from-stone-950 via-zinc-900 to-stone-800', label: 'Obsidian' },
                        { id: 'minimal', class: 'from-stone-50 via-[#EAE6DF] to-stone-200 border border-stone-300', label: 'Minimalist' }
                      ].map((bg) => (
                        <button
                          key={bg.id}
                          onClick={() => setLyricBg(bg.id as PlumeCardBgType)}
                          className={`w-7 h-7 rounded-full bg-gradient-to-tr ${bg.classReal || bg.class} ${lyricBg === bg.id ? 'ring-2 ring-purple-600 dark:ring-purple-400 scale-110 shadow-md' : 'hover:scale-105 hover:opacity-90'} transition-all cursor-pointer`}
                          title={bg.label}
                        />
                      ))}

                      <label
                        htmlFor="plumecard-custom-bg"
                        className={`w-8 h-8 rounded-full border border-dashed flex items-center justify-center cursor-pointer transition-all overflow-hidden ${lyricBg === 'custom' ? 'ring-2 ring-purple-600 scale-110 border-purple-500' : 'border-purple-400/50 hover:scale-105'}`}
                        title="Ajouter votre propre image"
                      >
                        {lyricCustomBg ? (
                          <img src={lyricCustomBg} alt="Fond personnalisé" className="w-full h-full object-cover" />
                        ) : (
                          <ImageIcon className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                        )}
                      </label>

                      <input
                        id="plumecard-custom-bg"
                        type="file"
                        accept="image/*"
                        onChange={handleLyricCustomBackgroundUpload}
                        className="hidden"
                      />
                    </div>
                  </div>

                  {/* Font Style and alignment */}
                  <div className="grid grid-cols-2 gap-3.5">
                    <div>
                      <label className="block text-xs font-mono font-black uppercase text-gray-450 dark:text-zinc-500 mb-1.5">
                        Typographie
                      </label>
                      <div className="flex flex-wrap gap-1 bg-gray-100 dark:bg-zinc-900 p-1 rounded-lg border border-gray-200/60 dark:border-zinc-800 text-[10px] font-bold">
                        {([
                          { id: 'serif', label: 'Serif' },
                          { id: 'playfair', label: 'Playfair' },
                          { id: 'garamond', label: 'Garamond' },
                          { id: 'cinzel', label: 'Cinzel' },
                          { id: 'poetic', label: 'Poétique' },
                          { id: 'handwritten', label: 'Manuscrit' },
                          { id: 'cursive', label: 'Calligraphie' },
                          { id: 'sans', label: 'Moderne' },
                          { id: 'bold', label: 'Impact' },
                          { id: 'mono', label: 'Mono' }
                        ] as { id: PlumeCardFontType; label: string }[]).map((style) => (
                          <button
                            key={style.id}
                            onClick={() => setLyricTextStyle(style.id)}
                            className={`py-1 px-2 rounded-md cursor-pointer text-center text-[9px] ${
                              lyricTextStyle === style.id
                                ? 'bg-white dark:bg-zinc-805 text-purple-600 dark:text-purple-400 shadow-xs font-black'
                                : 'text-gray-500 dark:text-zinc-400 hover:text-purple-600'
                            }`}
                          >
                            {style.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-mono font-black uppercase text-gray-450 dark:text-zinc-500 mb-1.5 font-bold">
                        Alignement
                      </label>
                      <div className="flex bg-gray-100 dark:bg-zinc-900 p-0.5 rounded-lg border border-gray-205/60 dark:border-zinc-805 text-[10px] font-bold">
                        {(['left', 'center', 'right'] as const).map((align) => (
                          <button
                            key={align}
                            onClick={() => setLyricAlign(align)}
                            className={`flex-1 py-1 rounded-md capitalize cursor-pointer ${
                              lyricAlign === align
                                ? 'bg-white dark:bg-zinc-805 text-purple-600 dark:text-purple-400 shadow-xs font-black'
                                : 'text-gray-500 dark:text-zinc-400 font-normal'
                            }`}
                          >
                            {align === 'left' ? 'Gauche' : align === 'right' ? 'Droite' : 'Centré'}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Smart auto adjustment info badge replacing manual slider (Goal 2) */}
                  <div className="bg-purple-500/5 dark:bg-purple-950/20 p-3.5 rounded-2xl border border-purple-100/30 dark:border-purple-900/40 flex items-start space-x-2.5">
                    <Sparkles className="w-4 h-4 text-purple-600 dark:text-purple-400 shrink-0 mt-0.5 fill-purple-500/20" />
                    <div className="space-y-0.5">
                      <span className="text-[10px] uppercase tracking-wider font-mono font-black text-purple-600 dark:text-purple-400 block">
                        MISE EN PAGE INTELLIGENTE
                      </span>
                      <p className="text-[10.5px] text-zinc-550 dark:text-zinc-400 font-medium leading-relaxed">
                        Le système adapte automatiquement la taille de police (de 40px à 14px) et le retour à la ligne pour centrer et emboîter parfaitement votre citation sans débordement.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Main action buttons footer */}
                <div className="pt-4 border-t border-gray-100 dark:border-zinc-900 flex items-center gap-3">
                  <button
                    onClick={exportLyricardImage}
                    disabled={exportingLyricard}
                    className="flex-1 py-3 px-4 bg-purple-600 hover:bg-purple-700 disabled:bg-purple-800 text-white rounded-xl text-xs font-sans font-black uppercase tracking-wider transition-all cursor-pointer flex items-center justify-center space-x-2 shadow-md shadow-purple-500/10"
                  >
                    <Download className="w-4 h-4" />
                    <span>{exportingLyricard ? 'Génération...' : 'Télécharger la PlumeCard'}</span>
                  </button>

                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(`« ${lyricText} »\n— ${story.title.toUpperCase()} (De ${story.authorName})`);
                      alert('Citation copiée au presse-papiers !');
                    }}
                    className="p-3 bg-zinc-150/60 hover:bg-zinc-200/80 dark:bg-zinc-900 dark:hover:bg-zinc-850 border border-transparent dark:border-zinc-800 text-gray-700 dark:text-zinc-200 rounded-xl transition cursor-pointer"
                    title="Copier le texte formaté"
                  >
                    <Copy className="w-4 h-4" />
                  </button>
                </div>
              </div>

            </div>
          </div>
        </div>
      )}

    </div>
  );
}
