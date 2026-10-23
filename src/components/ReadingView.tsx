import { escapeText, sanitizeInlineHtml, plainFromHtml, contentToParagraphs } from '../utils/chapterParagraphs';
import LiveReadingProgress from './LiveReadingProgress';
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
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
  Play,
  Pause,
  Highlighter,
  StickyNote,
  X,
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
  Image as ImageIcon,
  List, ScrollText, Settings,
} from 'lucide-react';
import { Story, Chapter, Comment, User } from '../types';
import { downloadBook, isDownloaded, removeDownload } from '../utils/offline';
import { getBookProgress, saveBookProgress, getScrollParent, buildParaMeta, bookPercentFromParagraph, chapterParaFraction, paragraphFromChapterFraction } from '../utils/readingProgress';
import { authHeaders } from '../utils/auth';
import { ReaderPrefs, DEFAULT_READER_PREFS, sanitizeReaderPrefs, resolveTheme, fontCss, MARGIN_PX, PARA_GAP_EM } from '../utils/readerPrefs';
import ReaderSettingsSheet from './ReaderSettingsSheet';
import { chapterMinutes, formatMinutes } from '../utils/readingTime';
import { spatializeElement, makeOrbitPanner, type SpatialHandle } from '../utils/spatialAudio';
import { ttsSupported, loadVoices, pickFrenchVoice, speakText, speakNeural, neuralTtsAvailable, unlockNeuralAudio, ttsCancel } from '../utils/tts';
import { trackEvent, flushEvents } from '../utils/telemetry';
import SimilarStories from './SimilarStories';
import { Capacitor } from '@capacitor/core';
import { App as CapacitorApp } from '@capacitor/app';
import { Share } from '@capacitor/share';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Media } from '@capacitor-community/media';

// ── Rendu du contenu de chapitre avec mise en forme inline (gras/italique/
// souligne). Le contenu peut etre du HTML leger (nouveaux chapitres ecrits dans
// l'editeur WYSIWYG) ou du texte simple (anciens chapitres). On NE GARDE que les
// balises inline sures pour eviter toute injection.
interface ReadingViewProps {
  story: Story;
  onBack: () => void;
  currentUser: User;
  onToggleFeatured?: (storyId: string) => void;
  onFollowAuthor: (authorId: string) => void;
  comments: Comment[];
  onAddComment: (chapterId: string, content: string, paragraphIndex?: number | null) => void;
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
  // Ouvre un autre récit en lecture (section « Les lecteurs ont aussi aimé »).
  onSelectStory?: (story: Story) => void;
  // Chapitre d'entrée choisi depuis la fiche d'œuvre (prioritaire sur la reprise).
  initialChapterIndex?: number;
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
  onSelectStory,
  initialChapterIndex,
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
    // Chapitre explicitement choisi sur la fiche d'œuvre : il prime.
    if (typeof initialChapterIndex === 'number' && initialChapterIndex >= 0 && initialChapterIndex < story.chapters.length) {
      return initialChapterIndex;
    }
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

  // Apparence de lecture PERSISTÉE par utilisateur : avant, tout réglage fait
  // en cours de lecture (taille, thème, interligne, police) était PERDU en
  // fermant le livre — il fallait tout re-régler à chaque session.
  const readingPrefsKey = `plume_reading_prefs_${currentUser.id}`;
  const rawSaved = ((): any => { try { return JSON.parse(localStorage.getItem(readingPrefsKey) || '{}') || {}; } catch { return {}; } })();
  // Préférences d'affichage (thème, police, mise en page, défilement…),
  // validées et migrées depuis l'ancien format (fontStyle/lineSpacing/readingTheme).
  const [prefs, setPrefsState] = useState<ReaderPrefs>(() => sanitizeReaderPrefs(rawSaved, {
    ...DEFAULT_READER_PREFS,
    fontSize: prefFontSize,
    theme: prefTheme === 'dark' ? 'oled' : prefTheme === 'dimmed' ? 'graphite' : prefTheme,
    font: prefFontStyle === 'sans' ? 'roboto' : prefFontStyle === 'mono' ? 'firacode' : 'literata',
  }));
  const setPrefs = (patch: Partial<ReaderPrefs>) => setPrefsState((cur) => ({ ...cur, ...patch }));
  const fontSize = prefs.fontSize;
  const T = resolveTheme(prefs.theme);
  // « Livre audio » (synthèse vocale). Activable/désactivable, réglable en vitesse.
  const [audiobookEnabled, setAudiobookEnabled] = useState<boolean>(typeof rawSaved.audiobookEnabled === 'boolean' ? rawSaved.audiobookEnabled : true);
  // Lecteur audio replie en une petite pastille (pour ne pas encombrer l'ecran).
  const [audioMini, setAudioMini] = useState<boolean>(typeof rawSaved.audioMini === 'boolean' ? rawSaved.audioMini : true);
  const [speechRate, setSpeechRate] = useState<number>(Number.isFinite(Number(rawSaved.speechRate)) ? Math.min(2, Math.max(0.5, Number(rawSaved.speechRate))) : 1);
  useEffect(() => {
    try { localStorage.setItem(readingPrefsKey, JSON.stringify({ ...prefs, audiobookEnabled, audioMini, speechRate })); } catch { /* plein */ }
  }, [prefs, audiobookEnabled, audioMini, speechRate, readingPrefsKey]);
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);
  
  // Interactive Custom controls
  const [isImmersive, setIsImmersive] = useState<boolean>(false);
  const [isCinemaMode, setIsCinemaMode] = useState<boolean>(false);
  const [activeParagraphIndex, setActiveParagraphIndex] = useState<number>(0);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isCommentsOpen, setIsCommentsOpen] = useState(false);
  const [isChaptersOpen, setIsChaptersOpen] = useState(false);
  // Commentaires d'un paragraphe précis (null = tout le chapitre).
  const [commentParagraph, setCommentParagraph] = useState<number | null>(null);
  // Paragraphe dont la barre d'actions (♥, citation, surlignage…) est ouverte.
  const [toolsIdx, setToolsIdx] = useState<number | null>(null);
  
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

  // ── ANNOTATIONS PRIVÉES (surlignage + note perso, ancrées au paragraphe) ──
  // Clé = `${chapterId}:${paragraphIndex}`. Chargées une fois pour le récit.
  type Annotation = { id?: string; color?: string | null; note?: string | null };
  const [annotations, setAnnotations] = useState<Record<string, Annotation>>({});
  const [noteEditor, setNoteEditor] = useState<{ idx: number; value: string } | null>(null);
  const HIGHLIGHT_COLOR = '#fbbf24'; // ambre doux
  const annKey = (chapterId: string, idx: number) => `${chapterId}:${idx}`;

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/me/annotations?storyId=${encodeURIComponent(story.id)}`, { headers: authHeaders() })
      .then((r) => (r.ok ? r.json() : []))
      .then((rows: any[]) => {
        if (cancelled || !Array.isArray(rows)) return;
        const map: Record<string, Annotation> = {};
        for (const a of rows) map[annKey(a.chapterId, a.paragraphIndex)] = { id: a.id, color: a.color, note: a.note };
        setAnnotations(map);
      })
      .catch(() => {});
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [story.id]);

  // Enregistre l'annotation d'un paragraphe (surlignage et/ou note). Vide -> supprime.
  const saveAnnotation = (idx: number, next: { color?: string | null; note?: string | null }) => {
    const chapterId = activeChapter.id;
    const key = annKey(chapterId, idx);
    const cur = annotations[key] || {};
    const color = next.color !== undefined ? next.color : (cur.color ?? null);
    const note = next.note !== undefined ? next.note : (cur.note ?? null);
    setAnnotations((prev) => {
      const n = { ...prev };
      if (!color && !note) delete n[key];
      else n[key] = { ...cur, color, note };
      return n;
    });
    fetch('/api/me/annotations', {
      method: 'POST',
      headers: authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ storyId: story.id, chapterId, paragraphIndex: idx, color, note }),
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((row) => { if (row && row.id) setAnnotations((prev) => (prev[key] ? { ...prev, [key]: { ...prev[key], id: row.id } } : prev)); })
      .catch(() => {});
  };
  const toggleHighlight = (idx: number) => {
    const cur = annotations[annKey(activeChapter.id, idx)];
    saveAnnotation(idx, { color: cur?.color ? null : HIGHLIGHT_COLOR });
  };
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
        // SÉQUENTIEL : une rafale de 100 POST simultanés saturait le réseau
        // (et multipliait les doublons si deux appareils migraient en même temps).
        for (const c of local.filter((content) => !map[content]).slice(0, 100)) {
          if (cancelled) break;
          try {
            const r2 = await fetch('/api/me/quotes', { method: 'POST', headers: authHeaders({ 'Content-Type': 'application/json' }), body: JSON.stringify({ content: c }) });
            if (r2.ok) { const q = await r2.json(); if (q) quoteIdsRef.current[q.content] = q.id; }
          } catch { break; }
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
  // Numéro du tome (1, 2…) et rang du chapitre DANS ce tome, pour afficher un
  // libellé lecteur correct « Tome X · Chapitre Y » (au lieu de deux fois
  // « Chapitre »). L'ordre des tomes est celui défini par l'auteur.
  const tomeLabel = React.useMemo(() => {
    if (!activeChapter.tomeId || tomesById.size === 0) return null;
    const sortedTomes = [...(story.tomes || [])].sort((a, b) => a.order - b.order);
    const tomeNumber = sortedTomes.findIndex((t) => t.id === activeChapter.tomeId) + 1;
    const inTome = story.chapters.filter((c) => c.tomeId === activeChapter.tomeId);
    const chapterInTome = inTome.findIndex((c) => c.id === activeChapter.id) + 1;
    if (tomeNumber < 1) return null;
    return { tomeNumber, chapterInTome, title: activeTome?.title || `Tome ${tomeNumber}` };
  }, [activeChapter.id, activeChapter.tomeId, story.tomes, story.chapters, tomesById, activeTome]);

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

  // ── Progression basée sur les PARAGRAPHES ──
  // Nombre de paragraphes par chapitre + cumul : le pourcentage reflète les
  // paragraphes réellement lus (et non les pixels de défilement), et la reprise
  // se fait au paragraphe exact où l'on s'était arrêté.
  const paraMeta = React.useMemo(
    () => buildParaMeta((story.chapters || []).map((ch) => contentToParagraphs(ch.content || '').length)),
    [story.id, story.chapters],
  );
  const paraMetaRef = useRef(paraMeta);
  useEffect(() => { paraMetaRef.current = paraMeta; }, [paraMeta]);

  // Index du paragraphe actuellement en tête de la zone de lecture. MESURE
  // DIRECTE et synchrone : le dernier paragraphe dont le haut est passé
  // au-dessus d'une ligne d'ancrage à ~33 % de la hauteur visible.
  // getBoundingClientRect() est relatif au VIEWPORT → fonctionne que le
  // défilement se fasse sur la fenêtre OU sur un conteneur interne (c'était la
  // faille : selon le cas, l'ancienne détection s'attachait au mauvais élément
  // et l'index restait bloqué à 0). Insensible aux en-têtes de taille variable.
  const lastParaRef = useRef(0);
  const getCurrentParagraphIndex = (): number => {
    // On cible l'article du chapitre AFFICHE directement dans le DOM (pas via une
    // closure sur activeChapter, qui pouvait être périmée dans le gestionnaire de
    // défilement). -1 = mesure impossible (l'appelant utilisera un repli).
    const article = document.querySelector('[id^="chapter-content-"]');
    const nodes = article ? article.querySelectorAll('[data-paragraph-index]') : null;
    if (!nodes || !nodes.length) return -1;
    const anchorY = Math.max(70, (window.innerHeight || 800) * 0.33);
    let idx = 0;
    let anyAbove = false;
    for (let i = 0; i < nodes.length; i++) {
      const el = nodes[i] as HTMLElement;
      if (el.getBoundingClientRect().top <= anchorY) { idx = i; anyAbove = true; }
      else break;
    }
    lastParaRef.current = idx;
    // Si AUCUN paragraphe n'est encore au-dessus de l'ancre alors qu'on a défilé,
    // c'est qu'on est tout en haut → 0 est correct ; sinon on renvoie l'index.
    return anyAbove ? idx : 0;
  };

  // Replace le paragraphe d'index donné près du haut de la zone de lecture.
  // scrollIntoView cible automatiquement le bon conteneur défilable (fenêtre
  // OU div interne), puis on compense l'en-tête pour ne pas le masquer.
  const scrollToParagraph = (idx: number): boolean => {
    if (idx <= 0) return false;
    const node = document.getElementById(`p-idx-${idx}`);
    if (!node) return false;
    node.scrollIntoView({ block: 'start', behavior: 'auto' });
    const scroller = getScrollParent(readerRootRef.current);
    if (scroller) scroller.scrollBy(0, -80); else window.scrollBy(0, -80);
    lastParaRef.current = idx;
    return true;
  };

  // ── Synchronisation SERVEUR de la position de reprise (multi-appareils) ──
  // Envoi débouncé (4 s) du chapitre courant + % de défilement vers
  // /api/chapters/:id/progress (table ReadingProgress, jusqu'ici jamais
  // alimentée par le client). Silencieux hors-ligne : la position locale reste.
  const progressSyncRef = useRef<{ chapterId: string; percent: number; paragraphIndex: number } | null>(null);
  const progressSyncTimerRef = useRef<any>(null);
  const flushProgressSync = React.useCallback(() => {
    const p = progressSyncRef.current;
    progressSyncRef.current = null;
    if (progressSyncTimerRef.current) { clearTimeout(progressSyncTimerRef.current); progressSyncTimerRef.current = null; }
    if (!p || !p.chapterId || p.chapterId === '__empty__') return;
    fetch(`/api/chapters/${p.chapterId}/progress`, {
      method: 'POST',
      headers: authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ progressPercent: p.percent, paragraphIndex: p.paragraphIndex }),
    }).catch(() => { /* hors-ligne : la position locale suffit en attendant */ });
  }, []);
  const scheduleProgressSync = React.useCallback(() => {
    if (progressSyncTimerRef.current) return;
    progressSyncTimerRef.current = setTimeout(() => {
      progressSyncTimerRef.current = null;
      flushProgressSync();
    }, 4000);
  }, [flushProgressSync]);
  // Flush au démontage (fermeture du livre) pour ne pas perdre la dernière position.
  useEffect(() => () => { flushProgressSync(); }, [flushProgressSync]);
  // … et à la fermeture d'onglet / mise en arrière-plan (le cleanup React ne
  // s'exécute pas lors d'un kill) : fetch keepalive, le navigateur termine
  // l'envoi même une fois la page fermée.
  useEffect(() => {
    const flushKeepalive = () => {
      const p = progressSyncRef.current;
      if (!p || !p.chapterId || p.chapterId === '__empty__') return;
      progressSyncRef.current = null;
      try {
        fetch(`/api/chapters/${p.chapterId}/progress`, {
          method: 'POST',
          headers: authHeaders({ 'Content-Type': 'application/json' }),
          body: JSON.stringify({ progressPercent: p.percent, paragraphIndex: p.paragraphIndex }),
          keepalive: true,
        }).catch(() => {});
      } catch { /* ignore */ }
    };
    const onHide = () => { if (document.visibilityState === 'hidden') flushKeepalive(); };
    window.addEventListener('pagehide', flushKeepalive);
    document.addEventListener('visibilitychange', onHide);
    // NATIF (Capacitor) : dans l'APK, `pagehide`/`visibilitychange` ne se
    // déclenchent pas toujours quand l'utilisateur bascule/ferme l'app -> on
    // ecoute l'evenement FIABLE de passage en arriere-plan pour synchroniser la
    // position AVANT que le systeme ne tue l'app (sinon la progression est
    // perdue apres une reinstallation).
    let appStateHandle: { remove: () => void } | null = null;
    if (Capacitor.isNativePlatform()) {
      CapacitorApp.addListener('appStateChange', ({ isActive }) => {
        if (!isActive) flushKeepalive();
      }).then((h) => { appStateHandle = h; }).catch(() => {});
    }
    return () => {
      window.removeEventListener('pagehide', flushKeepalive);
      document.removeEventListener('visibilitychange', onHide);
      appStateHandle?.remove();
    };
  }, []);
  // Chapitres REELLEMENT lus (defilement >= 95 % OU temps de lecture suffisant)
  // pendant cette session : evite de re-signaler le meme chapitre en boucle.
  const fullyReadRef = useRef<Set<string>>(new Set());
  const markChapterFullyRead = (chId: string) => {
    if (isOwnStory || fullyReadRef.current.has(chId)) return;
    fullyReadRef.current.add(chId);
    onChapterFullyRead(story.id, chId);
  };
  // Récit « terminé » : marqué UNE seule fois. Garde partagée (ref) entre le
  // suivi au défilement (95 % du dernier chapitre) ET le repli des chapitres
  // courts non défilables — sinon un livre tenant entièrement à l'écran (récit
  // d'un seul chapitre, ou dernier chapitre court) n'atteignait jamais 95 % et
  // restait indéfiniment « en cours de lecture ». `currentlyReading` lu via ref
  // pour éviter une valeur figée dans les effets à dépendance [story.id].
  const completionMarkedRef = useRef(false);
  const currentlyReadingRef = useRef(currentlyReading);
  currentlyReadingRef.current = currentlyReading;
  useEffect(() => {
    completionMarkedRef.current = completedStories.includes(story.id);
  }, [story.id, completedStories]);
  const markStoryCompletedIfLast = (chapterIdx: number) => {
    if (isOwnStory || completionMarkedRef.current) return;
    if (chapterIdx !== story.chapters.length - 1) return;
    completionMarkedRef.current = true;
    onToggleCompletedStories(story.id);
    if (currentlyReadingRef.current.includes(story.id)) onToggleCurrentlyReading(story.id);
    // Télémétrie (Phase 0) : complétion réelle du récit.
    trackEvent('complete', story.id, { chapterId: story.chapters?.[chapterIdx]?.id, payload: { chapterIndex: chapterIdx } });
  };

  // ── TÉLÉMÉTRIE DE LECTURE (Phase 0) ────────────────────────────────────────
  // On mesure, par chapitre : temps réel passé (dwell), progression maximale
  // atteinte et vitesse (wpm). Ces signaux honnêtes alimenteront le StoryScore.
  const readStartTsRef = useRef<number>(Date.now());
  const maxChapterRatioRef = useRef<number>(0);
  const lastProgressEmitRef = useRef<number>(0);
  const emitReadEnd = (chIdx: number) => {
    if (isOwnStory) return; // pas de télémétrie sur ses propres récits
    const ch = story.chapters?.[chIdx];
    if (!ch || ch.id === '__empty__') return;
    const dwellMs = Math.min(30 * 60 * 1000, Date.now() - readStartTsRef.current); // borné à 30 min (anti-idle)
    const maxRatio = maxChapterRatioRef.current;
    if (dwellMs < 1500 && maxRatio < 0.02) return; // ouverture fugace : on ignore
    const words = Math.round(plainFromHtml(ch.content || '').length / 5);
    const minutes = dwellMs / 60000;
    const wpm = minutes > 0.05 ? Math.round((words * maxRatio) / minutes) : 0;
    trackEvent('read_end', story.id, {
      chapterId: ch.id,
      payload: { percent: Math.round(maxRatio * 100), dwellMs: Math.round(dwellMs), wpm, chapterIndex: chIdx },
    });
  };
  useEffect(() => {
    if (isOwnStory) return;
    const ch = story.chapters?.[activeChapterIndex];
    readStartTsRef.current = Date.now();
    maxChapterRatioRef.current = 0;
    lastProgressEmitRef.current = 0;
    if (ch && ch.id !== '__empty__') {
      trackEvent('read_start', story.id, { chapterId: ch.id, payload: { chapterIndex: activeChapterIndex } });
    }
    const idxAtEnter = activeChapterIndex;
    return () => { emitReadEnd(idxAtEnter); flushEvents(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeChapterIndex, story.id]);
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

    let restoring = false;
    let timer: any = null;
    // Timers de restauration LOCALE : collectés pour être annulés au démontage.
    // Sans cela, fermer le livre en moins de ~700 ms laissait un `apply()`
    // s'exécuter APRÈS démontage et défiler l'écran suivant (accueil/biblio)
    // vers une position arbitraire (saut visible et déroutant).
    const restoreTimers: any[] = [];
    // On accepte TOUS les evenements de defilement : le pourcentage et la
    // position sont mesures a partir des positions des paragraphes du lecteur
    // (relatives au viewport), donc un defilement d'un autre element ne les
    // fausse pas — inutile de deviner « le bon » conteneur (source de bugs).
    const onScroll = () => {
      if (restoring) return;
      if (timer) return;
      timer = setTimeout(() => {
        timer = null;
        const ratio = computeRatio(); // ratio de défilement du chapitre (fiable)
        const meta = paraMetaRef.current;
        const chapParaCount = meta.counts[chapterIdxRef.current] || 1;
        // Paragraphe courant : mesure DIRECTE par position (précise). Si elle
        // n'aboutit pas (-1) OU renvoie 0 alors qu'on a nettement défilé
        // (ratio > 2 %), REPLI sur une estimation depuis le ratio de défilement
        // du chapitre — le pourcentage bouge alors TOUJOURS, quel que soit
        // l'environnement (c'est le ratio qui pilotait déjà la reprise).
        const posPara = getCurrentParagraphIndex();
        const ratioPara = Math.min(chapParaCount - 1, Math.floor(ratio * chapParaCount));
        const curPara = posPara > 0 ? posPara : (ratio > 0.02 ? ratioPara : 0);
        // Pourcentage sur les PARAGRAPHES : (paragraphes des chapitres précédents
        // + paragraphe courant) / total des paragraphes du livre.
        const percent = bookPercentFromParagraph(meta, chapterIdxRef.current, curPara);
        // On sauvegarde la position de reprise AU PARAGRAPHE (y compris auteur).
        saveBookProgress(currentUser.id, story.id, { chapterIndex: chapterIdxRef.current, scrollRatio: ratio, percent, paragraphIndex: curPara });
        // … et on programme l'envoi (débouncé) au serveur de la position DANS le
        // chapitre (fraction de paragraphes) pour reprendre au paragraphe près
        // sur n'importe quel appareil.
        const curCh = story.chapters[chapterIdxRef.current];
        if (curCh && curCh.id !== '__empty__') {
          progressSyncRef.current = { chapterId: curCh.id, percent: chapterParaFraction(curPara, chapParaCount), paragraphIndex: curPara };
          scheduleProgressSync();
        }

        // Télémétrie (Phase 0) : progression max du chapitre + read_progress
        // débité (au plus 1 event / 10 s) pour ne pas inonder le journal.
        if (!isOwnStory && curCh && curCh.id !== '__empty__') {
          if (ratio > maxChapterRatioRef.current) maxChapterRatioRef.current = ratio;
          const nowTs = Date.now();
          if (nowTs - lastProgressEmitRef.current > 10000) {
            lastProgressEmitRef.current = nowTs;
            trackEvent('read_progress', story.id, {
              chapterId: curCh.id,
              payload: { percent: Math.round(ratio * 100), paragraph: curPara, chapterIndex: chapterIdxRef.current },
            });
          }
        }

        // Chapitre courant REELLEMENT lu : defile jusqu'au bout (>= 95 %).
        // C'est ICI (et non a l'ouverture) qu'un chapitre compte comme lu, ce
        // qui fait progresser le pourcentage de lecture de maniere fidele.
        if (ratio >= 0.95) {
          const ch = story.chapters[chapterIdxRef.current];
          if (ch) markChapterFullyRead(ch.id);
          // Completion REELLE : dernier chapitre lu jusqu'a la fin (>= 95 %).
          markStoryCompletedIfLast(chapterIdxRef.current);
        }
      }, 250);
    };
    // Capture-phase sur document : capte le scroll quel que soit le conteneur,
    // mais on filtre ensuite pour ne garder que le défileur de lecture.
    document.addEventListener('scroll', onScroll, true);

    // Reprise de la position au premier affichage de ce livre. On ré-applique
    // plusieurs fois pour absorber le rendu progressif (images, polices) afin
    // d'atterrir EXACTEMENT là où l'on s'était arrêté.
    // Re-schedule after effect cleanup (React StrictMode cancels the first timers).
    {
      const saved = getBookProgress(currentUser.id, story.id);
      const hasPara = saved && typeof saved.paragraphIndex === 'number' && saved.paragraphIndex > 0;
      // Un AUTRE chapitre choisi dans le sommaire : on l'ouvre en haut, la
      // position sauvegardée concerne un autre chapitre.
      const otherChapter = saved && typeof initialChapterIndex === 'number' && initialChapterIndex !== saved.chapterIndex;
      if (saved && !otherChapter && (hasPara || saved.scrollRatio > 0.01)) {
        restoring = true;
        const apply = () => {
          // Reprise AU PARAGRAPHE si connu ; repli sur l'ancien ratio de pixels.
          if (hasPara && scrollToParagraph(saved.paragraphIndex as number)) return;
          const el = getScroller();
          if (el) {
            const max = el.scrollHeight - el.clientHeight;
            if (max > 0) el.scrollTo({ top: max * saved.scrollRatio, behavior: 'auto' });
          } else {
            const wmax = document.documentElement.scrollHeight - window.innerHeight;
            if (wmax > 0) window.scrollTo({ top: wmax * saved.scrollRatio, behavior: 'auto' });
          }
        };
        [120, 350, 700].forEach((d) => restoreTimers.push(setTimeout(apply, d)));
        // Fin de la fenêtre de restauration : on rend la main au suivi réel.
        restoreTimers.push(setTimeout(() => { restoring = false; }, 850));
      }
    }
    return () => {
      document.removeEventListener('scroll', onScroll, true);
      if (timer) clearTimeout(timer);
      restoreTimers.forEach((t) => clearTimeout(t));
    };
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
      if (!scrollable) {
        markChapterFullyRead(chId);
        // Livre tenant entierement a l'ecran : le seuil 95 % ne se declenche
        // jamais. Si c'est le DERNIER chapitre, on marque quand meme le recit
        // termine (sinon il reste bloque « en cours de lecture »).
        markStoryCompletedIfLast(activeChapterIndex);
      }
    }, 8000);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeChapterIndex, story.id]);

  // ── REPRISE MULTI-APPAREILS ──
  // Aucune progression LOCALE pour ce livre (nouvel appareil, réinstallation,
  // PWA vs app) ? On récupère la position SERVEUR (chapitre + % de défilement)
  // et on s'y replace — à la ligne près. Le local, plus précis et plus frais,
  // garde toujours la priorité quand il existe.
  useEffect(() => {
    // Chapitre choisi explicitement sur la fiche d'œuvre : il prime sur toute
    // reprise (locale ou serveur) — sinon on renverrait le lecteur ailleurs.
    if (typeof initialChapterIndex === 'number') return;
    if (getBookProgress(currentUser.id, story.id)) return; // le local prime
    let cancelled = false;
    const timers: any[] = [];
    (async () => {
      try {
        const res = await fetch(`/api/me/progress/${story.id}`, { headers: authHeaders() });
        if (!res.ok || cancelled) return;
        const sp = await res.json();
        if (!sp || !sp.chapterId) return;
        // ANTI-COURSE : si l'utilisateur a commencé à lire pendant la requête
        // (le onScroll a déjà écrit une progression locale), on abandonne — le
        // replacer maintenant provoquerait un saut brutal en pleine lecture.
        if (cancelled || getBookProgress(currentUser.id, story.id)) return;
        const idx = story.chapters.findIndex((c) => c.id === sp.chapterId);
        if (idx < 0) return;
        const ratio = Math.min(1, Math.max(0, (Number(sp.progressPercent) || 0) / 100));
        // Le serveur stocke une fraction de paragraphes DANS le chapitre : on la
        // reconvertit en index de paragraphe pour reprendre au paragraphe près.
        const meta = paraMetaRef.current;
        const chapParaCount = meta.counts[idx] || 1;
        const targetPara = Number.isInteger(sp.paragraphIndex) && sp.paragraphIndex >= 0 ? Math.min(chapParaCount - 1, sp.paragraphIndex) : paragraphFromChapterFraction(ratio, chapParaCount);
        const percent = bookPercentFromParagraph(meta, idx, targetPara);
        // On écrit la position serveur dans le stockage local : les prochaines
        // ouvertures passeront par le chemin de reprise habituel.
        saveBookProgress(currentUser.id, story.id, { chapterIndex: idx, scrollRatio: ratio, percent, paragraphIndex: targetPara });
        setActiveChapterIndex(idx);
        if (targetPara > 0 || ratio > 0.01) {
          // Ré-application en plusieurs passes (rendu progressif du chapitre),
          // comme la restauration locale — timers NETTOYÉS au démontage pour ne
          // pas défiler un autre écran après fermeture du livre.
          const apply = () => {
            if (cancelled) return;
            // Reprise AU PARAGRAPHE si possible ; repli sur l'ancien ratio pixels.
            if (targetPara > 0 && scrollToParagraph(targetPara)) return;
            const el = getScrollParent(readerRootRef.current);
            if (el) {
              const max = el.scrollHeight - el.clientHeight;
              if (max > 0) el.scrollTo({ top: max * ratio, behavior: 'auto' });
            } else {
              const wmax = document.documentElement.scrollHeight - window.innerHeight;
              if (wmax > 0) window.scrollTo({ top: wmax * ratio, behavior: 'auto' });
            }
          };
          [300, 700, 1200].forEach((d) => timers.push(setTimeout(apply, d)));
        }
      } catch { /* hors-ligne : on démarre simplement au début */ }
    })();
    return () => { cancelled = true; timers.forEach((t) => clearTimeout(t)); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [story.id]);

  // Save quotes synchronize (clé scopée par utilisateur)
  useEffect(() => {
    localStorage.setItem(quotesStorageKey, JSON.stringify(savedQuotes));
  }, [savedQuotes, quotesStorageKey]);

  // Références pour gérer le défilement fluide sans conflit avec l'écouteur de scroll
  const isClickScrollingRef = useRef<boolean>(false);
  const clickScrollTimeoutRef = useRef<any>(null);

  // Gérer la sélection manuelle de paragraphe (click)
  const handleParagraphSelect = (pIdx: number) => {
    setToolsIdx((cur) => (cur === pIdx ? null : pIdx));
    setActiveParagraphIndex(pIdx);
    // Livre audio : taper un paragraphe déplace le point de lecture vocale ; si
    // la narration est en cours, elle reprend depuis ce paragraphe.
    speakIdxRef.current = pIdx;
    if (speakingRef.current) speakFrom(pIdx);

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

  // ─────────────────────────────────────────────────────────────────────────
  // « LIVRE AUDIO » : lecture vocale du chapitre, paragraphe par paragraphe.
  // Le paragraphe lu est surligné (activeParagraphIndex) et amené à l'écran.
  // La lecture enchaîne les paragraphes puis passe au chapitre suivant.
  // ─────────────────────────────────────────────────────────────────────────
  const [isSpeaking, setIsSpeaking] = useState<boolean>(false);
  const speakingRef = useRef<boolean>(false);   // true tant que la lecture audio tourne
  const speakIdxRef = useRef<number>(0);          // dernier paragraphe lu (reprise)
  const frVoiceRef = useRef<SpeechSynthesisVoice | null>(null);
  const speechRateRef = useRef<number>(speechRate);
  useEffect(() => { speechRateRef.current = speechRate; }, [speechRate]);
  // Voix neuronale « premium » (ElevenLabs) disponible cote serveur ?
  const [neuralReady, setNeuralReady] = useState<boolean>(false);
  const neuralReadyRef = useRef<boolean>(false);
  useEffect(() => { neuralReadyRef.current = neuralReady; }, [neuralReady]);

  useEffect(() => {
    if (!ttsSupported()) return;
    loadVoices().then((vs) => { frVoiceRef.current = pickFrenchVoice(vs); }).catch(() => {});
    // Sonde la voix neuronale (repli natif si indisponible).
    neuralTtsAvailable().then(setNeuralReady).catch(() => {});
  }, []);

  const stopAudiobook = () => {
    speakingRef.current = false;
    ttsCancel();
    setIsSpeaking(false);
  };

  const speakFrom = (startIdx: number) => {
    if (!ttsSupported() && !neuralReadyRef.current) return;
    ttsCancel();
    speakingRef.current = true;
    setIsSpeaking(true);
    const speakOne = (i: number) => {
      if (!speakingRef.current) return;
      const chapParas = contentToParagraphs(story.chapters?.[chapterIdxRef.current]?.content || '');
      if (i >= chapParas.length) {
        // Fin de chapitre : on enchaîne sur le suivant s'il existe, sinon on s'arrête.
        const nextCh = chapterIdxRef.current + 1;
        if (nextCh < (story.chapters?.length || 0)) {
          setActiveChapterIndex(nextCh);
          setTimeout(() => {
            if (!speakingRef.current) return;
            speakIdxRef.current = 0;
            setActiveParagraphIndex(0);
            scrollToParagraph(0);
            speakOne(0);
          }, 450); // laisser le nouveau chapitre se monter
        } else {
          stopAudiobook();
        }
        return;
      }
      speakIdxRef.current = i;
      setActiveParagraphIndex(i);
      scrollToParagraph(i);
      const advance = () => { if (speakingRef.current) speakOne(i + 1); };
      const nativeSpeak = () => speakText(chapParas[i].text, {
        rate: speechRateRef.current,
        voice: frVoiceRef.current,
        onend: advance,
      });
      if (neuralReadyRef.current) {
        // Voix neuronale « premium » ; repli automatique sur la voix native si
        // ce passage echoue (quota epuise, reseau...).
        speakNeural(chapParas[i].text, {
          rate: speechRateRef.current,
          onend: advance,
          onerror: () => { if (speakingRef.current) nativeSpeak(); },
        });
      } else {
        nativeSpeak();
      }
    };
    speakOne(startIdx);
  };

  const toggleAudiobook = () => {
    if (isSpeaking) {
      // Pause : on garde la position pour reprendre au même paragraphe.
      speakingRef.current = false;
      ttsCancel();
      setIsSpeaking(false);
      return;
    }
    if (!ttsSupported() && !neuralReadyRef.current) {
      alert("La synthèse vocale n'est pas disponible sur cet appareil. Vérifie que la synthèse vocale (Google/Samsung TTS) est installée et activée dans les réglages Android.");
      return;
    }
    // DANS le geste utilisateur : on debloque la lecture audio pour la voix
    // neuronale (sinon play() apres le fetch est muet/bloque sur mobile).
    if (neuralReadyRef.current) unlockNeuralAudio();
    const from = speakIdxRef.current || activeParagraphIndex || 0;
    speakFrom(from);
  };

  // Arrêt de la synthèse quand on quitte le lecteur (démontage).
  useEffect(() => () => { speakingRef.current = false; ttsCancel(); }, []);
  // Si l'utilisateur DÉSACTIVE la fonctionnalité en cours de lecture, on coupe.
  useEffect(() => { if (!audiobookEnabled) stopAudiobook(); }, [audiobookEnabled]);

  // Synchroniser le paragraphe actif avec le défilement de l'écran — dans TOUS
  // les modes de lecture (plus seulement le mode cinéma). Le paragraphe en cours
  // de lecture (le plus proche de la ligne de mire) est ainsi mis en évidence et
  // suivi au défilement, que le mode cinéma soit actif ou non.
  useEffect(() => {
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
  }, [activeChapter.id]);

  // Quand on active le mode cinéma, focaliser le paragraphe actif actuel
  useEffect(() => {
    if (isCinemaMode && activeParagraphIndex !== undefined) {
      const t = setTimeout(() => {
        handleParagraphSelect(activeParagraphIndex);
      }, 150);
      return () => clearTimeout(t);
    }
  }, [isCinemaMode]);

  // ── Progression dans le chapitre + temps restant ─────────────────────────
  const [chapterProgress, setChapterProgress] = useState(0);
  const chapterWords = React.useMemo(
    () => plainFromHtml(activeChapter?.content || '').split(/\s+/).filter(Boolean).length,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [activeChapter?.id, activeChapter?.content],
  );
  const chapterLeftMin = Math.ceil((chapterWords * (1 - chapterProgress)) / 230);
  useEffect(() => {
    // Écoute en phase de capture sur le document : capte le défilement quel que
    // soit le conteneur qui défile réellement (sinon la barre restait à 0 %).
    const onScroll = () => {
      const art = activeChapter ? document.getElementById(`chapter-content-${activeChapter.id}`) : null;
      if (!art) return;
      const r = art.getBoundingClientRect();
      const vh = window.innerHeight;
      const total = Math.max(1, r.height - vh * 0.5);
      setChapterProgress(Math.min(1, Math.max(0, (-r.top + vh * 0.25) / total)));
    };
    document.addEventListener('scroll', onScroll, { capture: true, passive: true });
    window.addEventListener('resize', onScroll);
    onScroll();
    return () => { document.removeEventListener('scroll', onScroll, { capture: true } as any); window.removeEventListener('resize', onScroll); };
  }, [activeChapter?.id]);

  // ── Défilement automatique (vitesse en mots/minute) ──────────────────────
  const [autoScrolling, setAutoScrolling] = useState(false);
  const toggleAutoScroll = () => setAutoScrolling((v) => !v);
  useEffect(() => {
    if (!autoScrolling || !activeChapter) return;
    const scroller = getScrollParent(readerRootRef.current);
    let raf = 0;
    let last = 0;
    let carry = 0;
    const step = (now: number) => {
      const art = document.getElementById(`chapter-content-${activeChapter.id}`);
      if (!last) last = now;
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      if (art) {
        const pxPerWord = chapterWords > 0 ? art.scrollHeight / chapterWords : 4;
        carry += (prefs.autoScrollWpm / 60) * pxPerWord * dt;
        const px = Math.floor(carry);
        carry -= px;
        if (px > 0) { if (scroller) scroller.scrollBy(0, px); else window.scrollBy(0, px); }
        const r = art.getBoundingClientRect();
        if (r.bottom < window.innerHeight * 0.55) {
          if (prefs.autoScrollEnd === 'next' && activeChapterIndex < story.chapters.length - 1) {
            setActiveChapterIndex(activeChapterIndex + 1);
          } else {
            setAutoScrolling(false);
          }
          return;
        }
      }
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    // Le lecteur reprend la main dès qu'il fait défiler lui-même.
    const stop = () => setAutoScrolling(false);
    window.addEventListener('wheel', stop, { passive: true });
    window.addEventListener('touchmove', stop, { passive: true });
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('wheel', stop);
      window.removeEventListener('touchmove', stop);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoScrolling, activeChapter?.id, prefs.autoScrollWpm, prefs.autoScrollEnd]);

  // ── Écran toujours allumé pendant la lecture (Wake Lock API) ─────────────
  useEffect(() => {
    if (!prefs.keepAwake) return;
    let lock: any = null;
    const request = async () => { try { lock = await (navigator as any).wakeLock?.request('screen'); } catch { /* non supporté */ } };
    request();
    const onVis = () => { if (document.visibilityState === 'visible') request(); };
    document.addEventListener('visibilitychange', onVis);
    return () => { document.removeEventListener('visibilitychange', onVis); try { lock?.release(); } catch { /* ignore */ } };
  }, [prefs.keepAwake]);

  // Charge les « j'aime » de passage du chapitre affiché.
  useEffect(() => {
    const chId = activeChapter?.id;
    if (!chId) return;
    let cancelled = false;
    fetch(`/api/passage-likes?chapterId=${encodeURIComponent(chId)}`, { headers: authHeaders() })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!d || cancelled) return;
        const counts: Record<string, number> = {};
        Object.entries(d.counts || {}).forEach(([i, n]) => { counts[`${chId}_p_${i}`] = Number(n); });
        const mine: Record<string, boolean> = {};
        (d.mine || []).forEach((i: number) => { mine[`${chId}_p_${i}`] = true; });
        setPassageLikes(prev => ({ ...prev, ...counts }));
        setLikedPassagesMe(prev => ({ ...prev, ...mine }));
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [activeChapter?.id]);

  useEffect(() => { setCommentParagraph(null); setToolsIdx(null); }, [activeChapter?.id]);

  // Le fond de page suit le thème de lecture (sinon une bande blanche
  // apparaissait sous le texte en thème sombre).
  useEffect(() => {
    // On repeint aussi les conteneurs de l'app (fond blanc par défaut) situés
    // sous la page de lecture, puis on restaure en quittant.
    const touched: { el: HTMLElement; prev: string }[] = [];
    let el: HTMLElement | null = readerRootRef.current?.parentElement || null;
    while (el && el !== document.documentElement) {
      touched.push({ el, prev: el.style.background });
      el.style.background = T.bg;
      el = el.parentElement;
    }
    return () => { touched.forEach(({ el, prev }) => { el.style.background = prev; }); };
  }, [T.bg]);

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
    onAddComment(activeChapter.id, newCommentText, commentParagraph);
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
    // Optimiste, puis valeur serveur (persistée, visible par tous les lecteurs).
    setLikedPassagesMe(prev => ({ ...prev, [key]: !wasLiked }));
    setPassageLikes(prev => ({
      ...prev,
      [key]: Math.max(0, (prev[key] || 0) + (wasLiked ? -1 : 1))
    }));
    fetch('/api/passage-likes/toggle', {
      method: 'POST',
      headers: authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ storyId: story.id, chapterId: activeChapter.id, paragraphIndex: index }),
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!d) return;
        setLikedPassagesMe(prev => ({ ...prev, [key]: !!d.liked }));
        setPassageLikes(prev => ({ ...prev, [key]: d.count }));
      })
      .catch(() => {});
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

  // IMPORTANT : appele DIRECTEMENT depuis le clic (pas de setTimeout), car le
  // partage natif `navigator.share` EXIGE un geste utilisateur : l'envelopper
  // dans un timer le casserait (NotAllowedError) dans l'APK et sur mobile.
  const exportLyricardImage = async () => {
    const previewCanvas = previewCanvasRef.current;
    if (!previewCanvas) return;
    setExportingLyricard(true);
    try {
      drawPlumeCard(previewCanvas);

      const fileName = `plume_citation_${story.title.toLowerCase().replace(/[^a-z0-9]/g, '_')}.png`;

      // ── APPLICATION NATIVE (Android/iOS via Capacitor) ────────────────────
      // On ECRIT le PNG sur l'appareil (Filesystem) puis on l'ENREGISTRE
      // DIRECTEMENT dans la galerie Photos (plugin Media). Repli sur la feuille
      // de partage native si l'enregistrement direct echoue (ancien appareil,
      // permission refusee).
      if (Capacitor.isNativePlatform()) {
        const base64 = previewCanvas.toDataURL('image/png').split(',')[1];
        await Filesystem.writeFile({ path: fileName, data: base64, directory: Directory.Cache });
        const { uri } = await Filesystem.getUri({ path: fileName, directory: Directory.Cache });
        try {
          await Media.savePhoto({ path: uri, fileName, albumIdentifier: undefined });
          alert('PlumeCard enregistrée dans ta galerie 🖼️');
        } catch (mediaErr) {
          console.error('Enregistrement galerie echoue, repli sur le partage:', mediaErr);
          try {
            await Share.share({
              title: 'Ma PlumeCard',
              text: 'Une citation depuis PLUME 🪶',
              url: uri,
              dialogTitle: 'Enregistrer ou partager ma PlumeCard',
            });
          } catch (shareErr: any) {
            const msg = String(shareErr?.message || shareErr || '').toLowerCase();
            if (!msg.includes('cancel') && !msg.includes('abort')) throw shareErr;
          }
        }
        return;
      }

      // Le canvas -> Blob (plus fiable que toDataURL sur mobile).
      const blob: Blob | null = await new Promise((resolve) =>
        previewCanvas.toBlob((b) => resolve(b), 'image/png'),
      );
      if (!blob) throw new Error('canvas vide');

      const file = new File([blob], fileName, { type: 'image/png' });
      const nav: any = typeof navigator !== 'undefined' ? navigator : {};

      // 1) MOBILE (web ET application) : la feuille de PARTAGE native permet
      //    « Enregistrer l'image » / Photos / Fichiers. C'est le seul chemin
      //    fiable dans la WebView de l'APK (le <a download> y est ignore) et
      //    sur navigateur mobile (ou le download data-URL est capricieux).
      if (typeof nav.canShare === 'function' && nav.canShare({ files: [file] })) {
        try {
          await nav.share({ files: [file], title: 'Ma PlumeCard', text: 'Une citation depuis PLUME 🪶' });
          return;
        } catch (shareErr: any) {
          // Annulation volontaire : on n'enchaine pas sur un telechargement.
          if (shareErr?.name === 'AbortError') return;
          // Autre erreur de partage : on tente le telechargement classique.
        }
      }

      // 2) DESKTOP (ou pas de partage de fichiers) : telechargement via
      //    Object URL (plus robuste que la data-URL).
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.download = fileName;
      link.href = url;
      link.rel = 'noopener';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setTimeout(() => URL.revokeObjectURL(url), 15000);
    } catch (err) {
      console.error("Erreur d'exportation de la PlumeCard:", err);
      alert("Impossible d'enregistrer la PlumeCard. Réessaie dans un instant.");
    } finally {
      setExportingLyricard(false);
    }
  };

  // Theme styling definitions (V1 & V2 Adapted)
  // Get metadata block
  const chapterComments = comments.filter(c => c.chapterId === activeChapter.id);
  const paraCommentCounts: Record<number, number> = {};
  chapterComments.forEach((c) => { if (typeof c.paragraphIndex === 'number') paraCommentCounts[c.paragraphIndex] = (paraCommentCounts[c.paragraphIndex] || 0) + 1; });
  // Liste affichée dans le tiroir : un paragraphe précis, ou tout le chapitre.
  const drawerComments = commentParagraph === null ? chapterComments : chapterComments.filter((c) => c.paragraphIndex === commentParagraph);

  return (
    <div ref={readerRootRef} className={`min-h-screen pb-24 transition-colors duration-500 ${T.dark ? 'dark' : ''}`} style={{ background: T.bg, color: T.fg }}>
      {!isImmersive && <div className="max-w-3xl mx-auto px-3"><LiveReadingProgress storyId={story.id} /></div>}
      {/* Filtre lumière bleue (teinte chaude par-dessus tout le lecteur). */}
      {prefs.warmth > 0 && <div aria-hidden="true" className="fixed inset-0 pointer-events-none z-[60]" style={{ background: '#ff9a3c', opacity: prefs.warmth * 0.6, mixBlendMode: 'multiply' }} />}
      
      {/* 1. BARRE DU HAUT (style liseuse) : retour, titre + chapitre, sommaire,
          défilement auto, livre audio, réglages — et la progression du chapitre. */}
      {!isImmersive && (
        <div className="sticky top-0 z-30 px-3 pb-2" style={{ paddingTop: 'max(0.6rem, env(safe-area-inset-top))', background: `linear-gradient(${T.bg} 70%, ${T.bg}00)` }}>
          <div className="max-w-3xl mx-auto flex items-center gap-1 rounded-2xl px-1.5 py-1.5 shadow-sm" style={{ background: T.surface, border: `1px solid ${T.line}` }}>
            <button id="reader-back-btn" onClick={onBack} aria-label="Retour à l’œuvre" className="p-2 rounded-xl" style={{ color: T.fg }}>
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="flex-1 min-w-0 leading-tight">
              <p className="text-[13px] font-bold truncate">{story.title}</p>
              <p className="text-[11px] truncate" style={{ color: T.muted }}>
                {tomeLabel ? `T${tomeLabel.tomeNumber} · ` : ''}Chapitre {activeChapterIndex + 1}
                {chapterLeftMin > 0 ? ` · ${chapterLeftMin} min` : ''}
              </p>
            </div>
            {currentUser.role === 'Administrateur' && onToggleFeatured && (
              <button onClick={() => onToggleFeatured(story.id)} title={story.featured ? 'Retirer de la une' : 'Mettre ce récit en avant'} className="p-2 rounded-xl" style={{ color: story.featured ? '#f59e0b' : T.muted }}>
                <Sparkles className="w-[18px] h-[18px]" />
              </button>
            )}
            <button onClick={() => setIsChaptersOpen(true)} aria-label="Chapitres" title="Chapitres" className="p-2 rounded-xl" style={{ color: T.fg }}>
              <List className="w-[19px] h-[19px]" />
            </button>
            <button onClick={toggleAutoScroll} aria-label={autoScrolling ? 'Arrêter le défilement automatique' : 'Lancer le défilement automatique'} title="Défilement automatique" className="p-2 rounded-xl" style={{ color: autoScrolling ? '#fff' : T.fg, background: autoScrolling ? T.accent : 'transparent' }}>
              <ScrollText className="w-[19px] h-[19px]" />
            </button>
            <button id="reader-download-btn" onClick={toggleDownload} title={downloaded ? 'Téléchargé (hors ligne) — appuyer pour retirer' : 'Télécharger pour lire hors ligne'} className="p-2 rounded-xl" style={{ color: downloaded ? '#10b981' : T.fg }}>
              {downloaded ? <Check className="w-[18px] h-[18px]" /> : <Download className="w-[18px] h-[18px]" />}
            </button>
            <button onClick={() => setIsSettingsOpen(true)} aria-label="Réglages d’affichage" title="Réglages d’affichage" className="p-2 rounded-xl" style={{ color: T.fg }}>
              <Settings className="w-[19px] h-[19px]" />
            </button>
          </div>
          {/* Progression dans le chapitre */}
          <div className="max-w-3xl mx-auto mt-1.5 h-[3px] rounded-full overflow-hidden" style={{ background: T.line }}>
            <div className="h-full rounded-full transition-[width] duration-150" style={{ width: `${Math.round(chapterProgress * 100)}%`, background: T.accent }} />
          </div>
        </div>
      )}

      <ReaderSettingsSheet
        open={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        prefs={prefs}
        setPrefs={setPrefs}
        onReset={() => setPrefsState({ ...DEFAULT_READER_PREFS })}
        theme={T}
        autoScrolling={autoScrolling}
        onToggleAutoScroll={toggleAutoScroll}
        soundscape={activeSoundscape}
        setSoundscape={setActiveSoundscape}
        soundVolume={soundVolume}
        setSoundVolume={setSoundVolume}
        spatialAudioOn={spatialAudioOn}
        setSpatialAudioOn={setSpatialAudioOn}
        cinema={isCinemaMode}
        setCinema={setIsCinemaMode}
        audiobookEnabled={audiobookEnabled}
        setAudiobookEnabled={setAudiobookEnabled}
        speechRate={speechRate}
        setSpeechRate={setSpeechRate}
        onImmersive={() => { setIsSettingsOpen(false); setIsImmersive(true); }}
      />

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

      {/* LECTEUR AUDIO FLOTTANT (« livre audio ») — rendu via un PORTAL sur
          document.body avec un z-index tres eleve pour passer AU-DESSUS de la
          barre de navigation du bas (qui a un z-index extreme). Visible des que
          la fonctionnalite est activee (l'indisponibilite eventuelle de la
          synthese est signalee au moment du clic). */}
      {audiobookEnabled && !isSettingsOpen && !isChaptersOpen && !isCommentsOpen && !noteEditor && createPortal(
        <div className="fixed right-3 z-[2147483000] animate-fade-in select-none" style={{ bottom: 'max(6rem, calc(env(safe-area-inset-bottom) + 5rem))' }}>
          {audioMini ? (
            // REPLIÉ : petite pastille discrète (icône casque) — tap pour rouvrir.
            <button
              onClick={() => setAudioMini(false)}
              aria-label="Ouvrir le livre audio"
              title="Livre audio"
              className={`relative flex items-center justify-center w-11 h-11 rounded-full bg-black/70 backdrop-blur-md text-white shadow-2xl border border-white/15 transition ${isSpeaking ? 'ring-2 ring-purple-500' : ''}`}
            >
              <Headphones className="w-5 h-5 text-purple-300" />
              {isSpeaking && <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-purple-500 animate-pulse" />}
            </button>
          ) : (
            // DÉPLOYÉ : lecteur complet, avec un « × » pour le replier.
            <div className="flex items-center gap-2 pl-2.5 pr-2 py-2 rounded-full bg-black/80 backdrop-blur-md text-white shadow-2xl border border-white/15">
              <button
                onClick={toggleAudiobook}
                aria-label={isSpeaking ? 'Mettre en pause' : 'Écouter le livre'}
                className="flex items-center justify-center w-10 h-10 rounded-full bg-[#7C3AED] hover:bg-[#6D28D9] transition shrink-0"
              >
                {isSpeaking ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 ml-0.5" />}
              </button>
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] font-bold uppercase tracking-wider text-white/80">
                  {isSpeaking ? 'Lecture…' : 'Livre audio'}
                </span>
                {neuralReady && (
                  <span className="text-[8px] font-black px-1 py-0.5 rounded bg-gradient-to-r from-purple-500 to-fuchsia-500 text-white" title="Voix neuronale premium">HD</span>
                )}
                {/* Vitesse de lecture */}
                <select
                  value={speechRate}
                  onChange={(e) => setSpeechRate(Number(e.target.value))}
                  onClick={(e) => e.stopPropagation()}
                  className="bg-white/10 rounded-md text-[11px] font-bold px-1.5 py-1 outline-none cursor-pointer"
                  title="Vitesse de lecture"
                >
                  <option className="text-black" value={0.75}>0.75×</option>
                  <option className="text-black" value={1}>1×</option>
                  <option className="text-black" value={1.25}>1.25×</option>
                  <option className="text-black" value={1.5}>1.5×</option>
                  <option className="text-black" value={2}>2×</option>
                </select>
                {isSpeaking && (
                  <button
                    onClick={stopAudiobook}
                    aria-label="Arrêter"
                    className="flex items-center justify-center w-7 h-7 rounded-full bg-white/10 hover:bg-white/20 transition shrink-0"
                    title="Arrêter la lecture audio"
                  >
                    <VolumeX className="w-3.5 h-3.5" />
                  </button>
                )}
                {/* Replier le lecteur (le rend minuscule sans couper la lecture). */}
                <button
                  onClick={() => setAudioMini(true)}
                  aria-label="Réduire le lecteur audio"
                  className="flex items-center justify-center w-7 h-7 rounded-full bg-white/10 hover:bg-white/20 transition shrink-0"
                  title="Masquer / réduire"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}
        </div>,
        document.body,
      )}

      {/* ÉDITEUR DE NOTE PERSONNELLE (annotation privée d'un paragraphe). */}
      {noteEditor && createPortal(
        <div className="fixed inset-0 z-[2147483000] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setNoteEditor(null)}>
          <div className="w-full max-w-sm bg-white dark:bg-[#0E0E14] rounded-2xl border border-gray-150 dark:border-purple-900/20 shadow-2xl p-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-2 mb-3">
              <StickyNote className="w-4 h-4 text-purple-600" />
              <h3 className="font-black text-sm text-gray-900 dark:text-white">Ma note</h3>
              <span className="text-[10px] text-gray-400">privée</span>
              <button onClick={() => setNoteEditor(null)} className="ml-auto p-1 text-gray-400 hover:text-gray-700 dark:hover:text-white"><X className="w-4 h-4" /></button>
            </div>
            <textarea
              value={noteEditor.value}
              onChange={(e) => setNoteEditor({ ...noteEditor, value: e.target.value })}
              rows={4}
              maxLength={2000}
              autoFocus
              placeholder="Écris ta note sur ce passage… (visible par toi seul)"
              className="w-full bg-gray-50 dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-xl p-3 text-sm outline-none resize-none focus:border-purple-400"
            />
            <div className="flex items-center gap-2 mt-3">
              {annotations[annKey(activeChapter.id, noteEditor.idx)]?.note && (
                <button onClick={() => { saveAnnotation(noteEditor.idx, { note: null }); setNoteEditor(null); }} className="text-[11px] font-bold text-red-500 hover:text-red-600">Supprimer</button>
              )}
              <button onClick={() => { saveAnnotation(noteEditor.idx, { note: noteEditor.value.trim() || null }); setNoteEditor(null); }} className="ml-auto px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-black uppercase tracking-wider transition">Enregistrer</button>
            </div>
          </div>
        </div>,
        document.body,
      )}

      {/* 3. PAGE DE LECTURE : texte pleine largeur, sans cadre (style liseuse). */}
      <div className="max-w-3xl mx-auto py-4 relative" style={{ paddingLeft: MARGIN_PX[prefs.margins], paddingRight: MARGIN_PX[prefs.margins] }}>
        <main className={`transition-all duration-500 ${isImmersive ? 'py-16' : ''}`}>

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


          {/* Chapter headers — direction design : UN seul label (au lieu de trois
              lignes de majuscules mono) + le titre serif mis en avant, et on
              sort lectures/likes du seuil de lecture (ils vivent sur la fiche).
              Il ne reste que ce qui prepare la lecture : reperage + duree. */}
          <div className="text-center mb-10 pb-8" style={{ borderBottom: `1px solid ${T.line}` }}>
            <span className="text-[10px] uppercase font-mono tracking-[0.16em] font-bold block mb-3 leading-none" style={{ color: T.accent }}>
              {tomeLabel
                ? `Tome ${tomeLabel.tomeNumber} · Chapitre ${tomeLabel.chapterInTome}`
                : `Chapitre ${activeChapterIndex + 1} sur ${story.chapters.length}`}
              {' · '}{formatMinutes(chapterMinutes(activeChapter))} de lecture
            </span>
            <h2 className="text-2xl md:text-[1.9rem] font-serif font-semibold tracking-tight mb-3 leading-tight text-balance">
              {activeChapter.title}
            </h2>

            {!isImmersive && (
              <div className="flex items-center justify-center gap-2 text-[11px] select-none" style={{ color: T.muted }}>
                <span>{paragraphs.length} paragraphes</span>
                <span className="opacity-40">·</span>
                <span>{Math.round(plainFromHtml(activeChapter.content).length / 5)} mots</span>
              </div>
            )}
          </div>

          {/* Carte « Lecture audio » en tête de chapitre (comme sur les liseuses). */}
          {audiobookEnabled && !isImmersive && hasChapters && (
            <div className="mb-8 rounded-2xl p-4 flex items-center gap-3" style={{ background: T.surface, border: `1px solid ${T.line}` }}>
              <button
                type="button"
                onClick={toggleAudiobook}
                aria-label={isSpeaking ? 'Mettre en pause' : 'Écouter ce chapitre'}
                className="w-12 h-12 rounded-full flex items-center justify-center text-white shrink-0 shadow-md"
                style={{ background: T.accent }}
              >
                {isSpeaking ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 ml-0.5" />}
              </button>
              <div className="flex-1 min-w-0">
                <p className="text-[11px] font-bold uppercase tracking-wider" style={{ color: T.accent }}>Lecture audio</p>
                <p className="text-[14px] font-semibold leading-tight">{isSpeaking ? 'Lecture en cours…' : 'Écouter ce chapitre'}</p>
                <p className="text-[11px]" style={{ color: T.muted }}>Le texte se surligne au fil de la voix{neuralReady ? ' · voix naturelle' : ''}.</p>
              </div>
              <select
                value={speechRate}
                onChange={(e) => setSpeechRate(Number(e.target.value))}
                aria-label="Vitesse de lecture"
                className="rounded-xl text-[12px] font-bold px-2 py-1.5 outline-none"
                style={{ background: T.bg, color: T.fg, border: `1px solid ${T.line}` }}
              >
                {[0.75, 1, 1.25, 1.5, 2].map((r) => <option key={r} value={r}>{String(r).replace('.', ',')}×</option>)}
              </select>
            </div>
          )}

          {/* CINEMA AND TEXT DISPLAY LAYOUT */}
          <article 
            id={`chapter-content-${activeChapter.id}`}
            className="select-text"
            style={{ fontSize: `${prefs.fontSize}px`, fontFamily: fontCss(prefs.font), lineHeight: prefs.lineHeight, textAlign: prefs.align, hyphens: prefs.align === 'justify' ? 'auto' : 'manual', WebkitHyphens: prefs.align === 'justify' ? 'auto' : 'manual' } as React.CSSProperties}
            lang="fr"
          >
            {paragraphs.map((para, pIdx) => {
              const pText = para.text;
              const capKey = `${activeChapter.id}_p_${pIdx}`;
              const isPFocus = activeParagraphIndex === pIdx;
              const plikes = passageLikes[capKey] || 0;
              const hasLikedPass = likedPassagesMe[capKey];
              const ann = annotations[annKey(activeChapter.id, pIdx)];

              return (
                <div
                  key={pIdx}
                  id={`p-idx-${pIdx}`}
                  data-paragraph-index={pIdx}
                  onClick={() => handleParagraphSelect(pIdx)}
                  style={{
                    marginBottom: `${PARA_GAP_EM[prefs.paraSpacing]}em`,
                    paddingRight: 30,
                    ...(ann?.color ? { backgroundColor: `${ann.color}2e`, boxShadow: `inset 3px 0 0 ${ann.color}`, paddingLeft: 8, borderRadius: 6 } : {}),
                    ...(isSpeaking && isPFocus ? { backgroundColor: `${T.accent}1f`, borderRadius: 6 } : {}),
                  }}
                  className={`relative transition-all duration-500 cursor-pointer ${
                    isCinemaMode ? (isPFocus ? 'opacity-100' : 'opacity-20 blur-[0.4px] select-none') : ''
                  }`}
                >
                  {/* Bulle de commentaires dans la marge (comme sur les liseuses web). */}
                  {!isImmersive && (() => {
                    const n = paraCommentCounts[pIdx] || 0;
                    return (
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); setCommentParagraph(pIdx); setIsCommentsOpen(true); }}
                        aria-label={n ? `Voir les ${n} commentaires de ce paragraphe` : 'Commenter ce paragraphe'}
                        className="absolute right-0 top-1 flex flex-col items-center gap-0.5"
                        style={{ opacity: n ? 1 : (isPFocus ? 0.7 : 0.22) }}
                      >
                        <span className="w-6 h-6 rounded-full flex items-center justify-center" style={{ background: n ? T.accent : T.surface, color: n ? '#fff' : T.muted }}>
                          <MessageCircle className="w-3.5 h-3.5" />
                        </span>
                        {n > 0 && <span className="text-[10px] font-bold leading-none" style={{ color: T.muted }}>{n}</span>}
                      </button>
                    );
                  })()}
                  {/* Indicateur de note perso : petite pastille cliquable. */}
                  {ann?.note && !isImmersive && (
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); setNoteEditor({ idx: pIdx, value: ann.note || '' }); }}
                      className="absolute -left-1.5 top-1 z-10 w-5 h-5 rounded-full bg-purple-600 text-white flex items-center justify-center shadow-md"
                      title="Voir ma note"
                    >
                      <StickyNote className="w-3 h-3" />
                    </button>
                  )}
                  {/* Floating discrete react toolbar next to hovered/focused paragraph */}
                  {!isImmersive && (
                    <div className={`absolute right-8 -bottom-3 z-10 items-center space-x-1.5 bg-white dark:bg-zinc-900 border border-gray-150 dark:border-zinc-800 rounded-full py-1 px-2.5 text-[10px] shadow-md animate-fade-in ${toolsIdx === pIdx ? 'flex' : 'hidden'}`}>
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

                      {/* Surligner ce paragraphe (annotation privée) */}
                      <button
                        onClick={(e) => { e.stopPropagation(); toggleHighlight(pIdx); }}
                        className={`font-black hover:text-amber-500 ${annotations[annKey(activeChapter.id, pIdx)]?.color ? 'text-amber-500' : 'text-gray-400'}`}
                        title="Surligner ce passage (visible par toi seul)"
                      >
                        <Highlighter className="w-3 h-3" />
                      </button>

                      {/* Note personnelle sur ce paragraphe */}
                      <button
                        onClick={(e) => { e.stopPropagation(); setNoteEditor({ idx: pIdx, value: annotations[annKey(activeChapter.id, pIdx)]?.note || '' }); }}
                        className={`font-black hover:text-purple-600 ${annotations[annKey(activeChapter.id, pIdx)]?.note ? 'text-purple-600' : 'text-gray-400'}`}
                        title="Ajouter une note personnelle"
                      >
                        <StickyNote className="w-3 h-3" />
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
                    className="whitespace-pre-wrap break-words"
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

          {/* « Les lecteurs ont aussi aimé » (reco Phase 2) — masquée si vide. */}
          {!isImmersive && !isOwnStory && (
            <SimilarStories storyId={story.id} onSelect={onSelectStory} />
          )}
          {/* Espace libre sous le texte : le lecteur audio flottant ne masque plus les dernières lignes. */}
          {audiobookEnabled && <div aria-hidden="true" style={{ height: 140 }} />}

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

            {/* Repère de position dans l'œuvre : chapitre courant (le pourcentage
                de lecture a été retiré). */}
            <span className="text-xs font-sans font-black uppercase tracking-widest px-4 py-1.5 bg-[#7C3AED]/10 text-[#7C3AED] dark:text-purple-400 rounded-full">
              Chapitre {activeChapterIndex + 1} / {story.chapters.length}
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
        <div className="fixed inset-0 z-50 flex items-end justify-center lg:items-stretch lg:justify-end animate-fade-in text-left">
          <div 
            className="absolute inset-0 bg-black/60 backdrop-blur-xs transition-opacity"
            onClick={() => { setIsCommentsOpen(false); setCommentParagraph(null); }}
          />
          
          <div className="relative w-full max-w-xl bg-white dark:bg-black rounded-t-[2rem] lg:rounded-t-none lg:rounded-l-2xl shadow-2xl border-t lg:border-t-0 lg:border-l border-gray-150 dark:border-purple-900/20 flex flex-col h-[82vh] lg:h-full lg:max-w-md transition-transform animate-slide-up overflow-hidden">
            <div className="w-12 h-1.5 bg-gray-300 dark:bg-purple-950/40 rounded-full mx-auto my-3 pointer-events-none opacity-6 w-full" />

            <div className="px-5 pb-3 border-b border-gray-100 dark:border-purple-900/15 flex items-center justify-between font-sans">
              <div className="text-left">
                <span className="text-[9px] uppercase font-mono tracking-widest text-[#7C3AED] font-bold">{commentParagraph === null ? 'Retour sur ce chapitre' : `Paragraphe ${commentParagraph + 1}`}</span>
                <h3 className="font-serif font-black text-sm text-gray-900 dark:text-white mt-0.5">
                  Commentaires ({drawerComments.length})
                </h3>
                {commentParagraph !== null && (
                  <>
                    <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-1 line-clamp-2 italic max-w-xs">« {plainFromHtml(paragraphs[commentParagraph]?.html || '').slice(0, 140)} »</p>
                    <button onClick={() => setCommentParagraph(null)} className="text-[10px] font-bold text-purple-600 mt-1">Voir tout le chapitre ({chapterComments.length})</button>
                  </>
                )}
              </div>
              
              <button
                id="close-comments-drawer"
                onClick={() => { setIsCommentsOpen(false); setCommentParagraph(null); }}
                className="p-1 text-xs font-black text-gray-550"
              >
                Fermer
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4 pb-20 scrollbar-none">
              {drawerComments.length === 0 ? (
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
                drawerComments.map((com) => (
                  <div key={com.id} className="p-3.5 bg-gray-55 dark:bg-[#0E0E14] rounded-xl border border-gray-100 dark:border-purple-900/15 text-left space-y-2 shadow-xs">
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
        <div className="fixed inset-0 z-50 flex items-end justify-center lg:items-stretch lg:justify-end animate-fade-in text-left">
          <div 
            className="absolute inset-0 bg-black/60 backdrop-blur-xs transition-opacity"
            onClick={() => setIsChaptersOpen(false)}
          />
          
          <div className="relative w-full max-w-xl bg-white dark:bg-black rounded-t-[2rem] lg:rounded-t-none lg:rounded-l-2xl shadow-2xl border-t lg:border-t-0 lg:border-l border-gray-150 dark:border-purple-900/20 flex flex-col h-[70vh] lg:h-full lg:max-w-md transition-transform animate-slide-up overflow-hidden">
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
