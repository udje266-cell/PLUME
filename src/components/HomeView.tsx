/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useEffect } from 'react';
import { 
  BookOpen,
  Download,
  Trash2, 
  Heart, 
  Star, 
  Share2, 
  TrendingUp, 
  Sparkles, 
  Clock, 
  UserPlus,
  Users,
  UserCheck, 
  FileText, 
  Eye, 
  MessageCircle, 
  Compass,
  Copy,
  Search,
  PenTool,
  Send,
  X as CloseIcon,
  Check
} from 'lucide-react';
import { User, Story, Chapter } from '../types';
import { getDownloadedBooks, removeDownload } from '../utils/offline';
import { optimizedImage } from '../utils/imageUrl';
import { Skeleton } from './Skeleton';
import { VerifiedBadge } from './VerifiedBadge';
import { recommendStories, hotScore, weightsForDiscovery, explorationRatioForDiscovery, ScoredStory } from '../utils/recommendation';
import { authHeaders } from '../utils/auth';

/** Formate un compteur de façon compacte : 1234 → « 1,2 k », 1500000 → « 1,5 M ». */
function formatStat(n: number): string {
  const v = Number(n) || 0;
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1).replace('.', ',').replace(',0', '')} M`;
  if (v >= 1_000) return `${(v / 1_000).toFixed(1).replace('.', ',').replace(',0', '')} k`;
  return String(v);
}

interface HomeViewProps {
  currentUser: User;
  allUsers: User[];
  stories: Story[];
  favorites: string[];
  readChapters: string[];
  lastReadProgress: { storyId: string; chapterId: string } | null;
  onSelectStory: (story: Story) => void;
  onToggleFavorite: (storyId: string) => void;
  onFollowAuthor: (authorId: string) => void;
  onOpenDiscussion: (partnerId: string) => void;
  onViewProfile?: (userId: string) => void;
  onOpenLibrary?: (query?: string) => void; // ouvre la Bibliothèque (ex-Explorer)
  onStartWriting?: () => void;               // ouvre l'écriture / création
}

export default function HomeView({
  currentUser,
  allUsers,
  stories,
  favorites,
  readChapters,
  lastReadProgress,
  onSelectStory,
  onToggleFavorite,
  onFollowAuthor,
  onOpenDiscussion,
  onViewProfile,
  onOpenLibrary,
  onStartWriting
}: HomeViewProps) {

  const [shareStory, setShareStory] = useState<Story | null>(null);
  const [copied, setCopied] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [discoverTab, setDiscoverTab] = useState<'tendances' | 'nouveautes' | 'recommandes'>('tendances');

  // Livres téléchargés (disponibles hors ligne). Se met à jour quand on
  // télécharge / retire un livre ailleurs dans l'app.
  const [offlineBooks, setOfflineBooks] = useState<Story[]>(() => getDownloadedBooks());
  useEffect(() => {
    const refresh = () => setOfflineBooks(getDownloadedBooks());
    window.addEventListener('plume-offline-changed', refresh);
    return () => window.removeEventListener('plume-offline-changed', refresh);
  }, []);

  // Suggestions de personnes aux goûts proches (PLUME = aussi pour se faire des amis).
  const [suggestedPeople, setSuggestedPeople] = useState<(User & { sharedGenres?: string[] })[]>([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(true);
  useEffect(() => {
    let cancelled = false;
    setLoadingSuggestions(true);
    fetch('/api/suggestions/people', { headers: authHeaders() })
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => { if (!cancelled && Array.isArray(data)) setSuggestedPeople(data); })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoadingSuggestions(false); });
    return () => { cancelled = true; };
    // Recalcule quand l'utilisateur change ou suit/défollow (following évolue).
  }, [currentUser.id, (currentUser.following || []).length]);

  // Curseur « découverte ↔ pertinence » du fil « Pour toi » (0 = pertinence, 1 =
  // découverte). Persisté par utilisateur pour respecter le choix du lecteur.
  const discoveryStorageKey = `plume_feed_discovery_${currentUser.id}`;
  const [discovery, setDiscovery] = useState<number>(() => {
    try {
      const v = parseFloat(localStorage.getItem(discoveryStorageKey) || '');
      return isNaN(v) ? 0.5 : Math.min(1, Math.max(0, v));
    } catch {
      return 0.5;
    }
  });
  const updateDiscovery = (value: number) => {
    setDiscovery(value);
    try {
      localStorage.setItem(discoveryStorageKey, String(value));
    } catch {
      /* stockage indisponible : on garde juste l'état en mémoire */
    }
  };

  // Filter out published and safe stories
  const publishedStories = stories.filter(s => s.status === 'Publié' && !s.isFlagged);

  // 1. "Continuer la lecture" calculations
  // Get all stories that have at least one read chapter OR matched in lastReadProgress
  const ongoingStories = publishedStories.filter(story => {
    const hasReadChapter = story.chapters.some(ch => readChapters.includes(ch.id));
    const isLastRead = lastReadProgress?.storyId === story.id;
    return hasReadChapter || isLastRead;
  });

  // Fallback to avoid empty screen on a pristine environment
  const displayOngoing = ongoingStories.length > 0 
    ? ongoingStories 
    : publishedStories.slice(0, 1); // fallback to suggest the first available book

  // Calculate read progress percentages and last read dates
  const getStoryProgressInfo = (story: Story) => {
    const storyChs = story.chapters;
    if (storyChs.length === 0) return { percent: 0, lastRead: 'Non commencé' };
    
    const readCount = storyChs.filter(ch => readChapters.includes(ch.id)).length;
    const percent = Math.round((readCount / storyChs.length) * 100);

    // On ne dispose pas d'horodatage de lecture par histoire : on affiche donc
    // un libellé d'état réel plutôt qu'une fausse date.
    const isLastRead = lastReadProgress?.storyId === story.id;
    let lastRead: string;
    if (isLastRead) lastRead = "À l'instant";
    else if (readCount > 0) lastRead = 'En cours';
    else lastRead = 'À découvrir';

    return { percent, lastRead };
  };

  // 2. "Pour toi" — diffusion personnalisée via l'algorithme de recommandation
  // (affinité de goût + signal social + qualité lissée + popularité à déclin
  // temporel + coup de pouce aux nouveautés + exploration). Cf. utils/recommendation.
  // Récits déjà lus (≥1 chapitre lu) ou en favori : on ne les re-pousse pas dans
  // « Pour toi », qui sert à faire découvrir de nouveaux récits.
  const excludeStoryIds = useMemo(() => {
    const readChapterSet = new Set(readChapters);
    const ids = new Set<string>(favorites);
    for (const story of stories) {
      if (story.chapters.some((ch) => readChapterSet.has(ch.id))) ids.add(story.id);
    }
    return Array.from(ids);
  }, [stories, favorites, readChapters]);

  // Fil « Pour toi » calculé localement (instantané, fonctionne hors-ligne).
  const localForYou = useMemo(
    () => recommendStories(stories, currentUser, {
      weights: weightsForDiscovery(discovery),
      explorationRatio: explorationRatioForDiscovery(discovery),
      excludeStoryIds,
      limit: 12,
    }),
    [stories, currentUser, discovery, excludeStoryIds],
  );

  // Le serveur expose le MÊME algorithme sur tout le catalogue (incl. signaux
  // sociaux/collaboratifs complets) via /api/feed. On l'utilise s'il répond,
  // avec repli transparent sur le calcul local en cas d'échec/chargement.
  const [serverForYou, setServerForYou] = useState<ScoredStory[] | null>(null);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/feed?discovery=${discovery}&limit=12`, { headers: authHeaders() });
        if (!res.ok) throw new Error(`feed ${res.status}`);
        const data = await res.json();
        if (!cancelled && Array.isArray(data.items)) {
          setServerForYou(data.items as ScoredStory[]);
        }
      } catch {
        if (!cancelled) setServerForYou(null); // repli sur le local
      }
    })();
    return () => { cancelled = true; };
  }, [discovery, currentUser.id]);

  const displayForYou = serverForYou ?? localForYou;

  // 3. "Tendances populaires" — popularité AVEC déclin temporel (style HN/Reddit)
  // pour faire tourner le contenu au lieu de figer les vieux hits en tête.
  const trendingStories = useMemo(() => {
    const now = Date.now();
    return publishedStories.slice().sort((a, b) => hotScore(b, now, 1.5) - hotScore(a, now, 1.5));
  }, [publishedStories]);

  // 4. "Nouveautés"
  const newsStories = publishedStories.slice()
    .sort((a, b) => new Date(b.publishDate).getTime() - new Date(a.publishDate).getTime());

  // 5. "Nouveaux auteurs" (comptes de rôle Auteur récemment actifs)
  const authorsList = allUsers.filter(u => u && u.role === 'Auteur' && u.id !== currentUser.id);

  // Header quick share links
  const handleCopyLink = (story: Story) => {
    navigator.clipboard.writeText(`https://plume.app/recits/${story.id}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const shareServices = [
    { name: 'WhatsApp', color: 'bg-[#25D366]', action: () => alert('Partagé sur WhatsApp !') },
    { name: 'Facebook', color: 'bg-[#1877F2]', action: () => alert('Partagé sur Facebook !') },
    { name: 'X / Twitter', color: 'bg-[#0F1419]', action: () => alert('Partagé sur X !') },
    { name: 'Telegram', color: 'bg-[#0088cc]', action: () => alert('Partagé sur Telegram !') },
  ];

  return (
    <div className="px-4 py-4 space-y-6 animate-fade-in text-left select-none pb-28">
      
      {/* En-tête : titre + recherche DIRECTE (livres + comptes) sur l'accueil. */}
      <header className="space-y-3 pb-1">
        <h1 className="text-xl font-black tracking-tight text-gray-950 dark:text-white flex items-center space-x-1.5">
          <Sparkles className="w-5 h-5 text-purple-600 fill-purple-600/15" />
          <span>Archipel Plume</span>
        </h1>
        <form
          onSubmit={(e) => e.preventDefault()}
          className="relative"
        >
          <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            placeholder="Rechercher un livre, un auteur, un genre…"
            className="w-full bg-gray-100 dark:bg-zinc-900 border border-transparent focus:border-purple-500/40 rounded-2xl pl-10 pr-9 py-3 text-xs text-gray-800 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-purple-500/30 transition"
          />
          {searchText && (
            <button
              type="button"
              onClick={() => setSearchText('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              aria-label="Effacer"
            >
              <CloseIcon className="w-4 h-4" />
            </button>
          )}
        </form>
      </header>

      {/* RÉSULTATS DE RECHERCHE (livres + comptes) — remplacent le fil tant
          qu'une requête est saisie. */}
      {(() => {
        const q = searchText.trim().toLowerCase();
        if (!q) return null;
        const bookResults = publishedStories.filter((s) =>
          s.title.toLowerCase().includes(q) ||
          (s.authorName || '').toLowerCase().includes(q) ||
          (s.genre || '').toLowerCase().includes(q) ||
          (s.category || '').toLowerCase().includes(q) ||
          (s.tags || []).some((t) => String(t).toLowerCase().includes(q))
        ).slice(0, 30);
        const userResults = allUsers.filter((u) =>
          u && u.id !== currentUser.id &&
          ((u.username || '').toLowerCase().includes(q) || (u.bio || '').toLowerCase().includes(q))
        ).slice(0, 30);

        return (
          <div className="space-y-5 animate-fade-in">
            {/* Comptes */}
            {userResults.length > 0 && (
              <section className="space-y-2">
                <h3 className="font-extrabold text-[10px] uppercase tracking-widest text-purple-600 dark:text-purple-400 flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5" /> Comptes ({userResults.length})
                </h3>
                <div className="space-y-1.5">
                  {userResults.map((u) => (
                    <button
                      key={u.id}
                      onClick={() => onViewProfile?.(u.id)}
                      className="w-full flex items-center gap-3 p-2.5 rounded-2xl bg-gray-50 dark:bg-[#0E0E14] border border-gray-100 dark:border-purple-900/15 hover:border-purple-500/30 transition text-left"
                    >
                      <img
                        src={optimizedImage(u.avatar, 64, { square: true }) || ('https://api.dicebear.com/7.x/initials/svg?seed=' + encodeURIComponent(u.username))}
                        alt={u.username}
                        className="w-10 h-10 rounded-full object-cover shrink-0"
                        referrerPolicy="no-referrer"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-black text-gray-900 dark:text-white truncate flex items-center gap-1">
                          {u.username}
                          {u.isVerified && <VerifiedBadge size="sm" />}
                        </p>
                        <p className="text-[10px] text-gray-400 truncate">{u.bio || 'Membre de la communauté'}</p>
                      </div>
                    </button>
                  ))}
                </div>
              </section>
            )}

            {/* Livres */}
            {bookResults.length > 0 && (
              <section className="space-y-2">
                <h3 className="font-extrabold text-[10px] uppercase tracking-widest text-purple-600 dark:text-purple-400 flex items-center gap-1.5">
                  <BookOpen className="w-3.5 h-3.5" /> Livres ({bookResults.length})
                </h3>
                <div className="space-y-1.5">
                  {bookResults.map((s) => (
                    <button
                      key={s.id}
                      onClick={() => onSelectStory(s)}
                      className="w-full flex items-center gap-3 p-2.5 rounded-2xl bg-gray-50 dark:bg-[#0E0E14] border border-gray-100 dark:border-purple-900/15 hover:border-purple-500/30 transition text-left"
                    >
                      <img src={optimizedImage(s.cover, 120)} alt={s.title} className="w-10 h-14 rounded-lg object-cover shrink-0" referrerPolicy="no-referrer" />
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-serif font-black text-gray-900 dark:text-white truncate">{s.title}</p>
                        <p className="text-[10px] text-gray-400 truncate">Par {s.authorName} · {s.genre}</p>
                      </div>
                    </button>
                  ))}
                </div>
              </section>
            )}

            {bookResults.length === 0 && userResults.length === 0 && (
              <p className="text-center text-sm text-gray-400 py-12">Aucun résultat pour « {searchText.trim()} ».</p>
            )}
          </div>
        );
      })()}

      {/* Le fil d'accueil complet n'apparaît que HORS recherche. */}
      {!searchText.trim() && (
      <div className="space-y-6">

      {/* SECTION: À LA UNE (mises en avant par l'administration) */}
      {(() => {
        const featuredStories = stories.filter((s) => s && s.featured && s.status === 'Publié');
        const featuredUsers = allUsers.filter((u) => u && u.featured && u.id !== currentUser.id);
        if (!featuredStories.length && !featuredUsers.length) return null;
        return (
          <section className="space-y-3">
            <div className="flex justify-between items-center pb-1.5 border-b border-amber-200/40 dark:border-amber-900/20">
              <h3 className="font-extrabold text-[10px] uppercase tracking-widest text-amber-600 dark:text-amber-400 flex items-center space-x-1.5">
                <Sparkles className="w-3.5 h-3.5 fill-amber-500/20" />
                <span>À la une</span>
              </h3>
              <span className="text-[9px] font-mono text-amber-600 bg-amber-500/10 px-2 py-1 rounded-full uppercase font-bold">Sélection</span>
            </div>

            {featuredStories.length > 0 && (
              <div className="flex space-x-3 overflow-x-auto pb-2 scrollbar-none">
                {featuredStories.map((story) => (
                  <div key={story.id} className="w-40 flex-shrink-0">
                    <div onClick={() => onSelectStory(story)} className="relative aspect-[2/3] w-full rounded-xl overflow-hidden cursor-pointer ring-2 ring-amber-400/40">
                      <img src={optimizedImage(story.cover, 220)} alt={story.title} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                      <span className="absolute top-1 left-1 text-[8px] bg-amber-500 text-white font-black px-1.5 py-0.5 rounded uppercase shadow flex items-center gap-0.5"><Sparkles className="w-2.5 h-2.5" />À la une</span>
                    </div>
                    <h4 onClick={() => onSelectStory(story)} className="mt-1.5 text-xs font-black text-gray-950 dark:text-gray-50 line-clamp-1 cursor-pointer hover:text-purple-600">{story.title}</h4>
                    <p className="text-[10px] text-gray-400 line-clamp-1">Par {story.authorName}</p>
                  </div>
                ))}
              </div>
            )}

            {featuredUsers.length > 0 && (
              <div className="flex space-x-3 overflow-x-auto pb-2 scrollbar-none">
                {featuredUsers.map((u) => (
                  <div key={u.id} onClick={() => onViewProfile?.(u.id)} className="w-24 flex-shrink-0 flex flex-col items-center text-center cursor-pointer">
                    <div className="relative">
                      <img src={optimizedImage(u.avatar, 64, { square: true }) || ('https://api.dicebear.com/7.x/initials/svg?seed=' + encodeURIComponent(u.username))} alt={u.username} className="w-16 h-16 rounded-full object-cover ring-2 ring-amber-400/50" referrerPolicy="no-referrer" />
                      <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 text-[7px] bg-amber-500 text-white font-black px-1.5 py-0.5 rounded-full uppercase shadow">À la une</span>
                    </div>
                    <span className="mt-2 text-[11px] font-black text-gray-950 dark:text-gray-50 truncate w-full">{u.username}</span>
                  </div>
                ))}
              </div>
            )}
          </section>
        );
      })()}

      {/* SECTION: LIVRES TÉLÉCHARGÉS (disponibles hors ligne) */}
      {offlineBooks.length > 0 && (
        <section className="space-y-3">
          <h3 className="font-extrabold text-[10px] uppercase tracking-widest text-emerald-600 dark:text-emerald-400 flex items-center space-x-1.5">
            <Download className="w-3.5 h-3.5" />
            <span>Disponibles hors ligne ({offlineBooks.length})</span>
          </h3>
          <div className="flex space-x-3 overflow-x-auto pb-2 scrollbar-none">
            {offlineBooks.map((book) => (
              <div key={book.id} className="w-32 flex-shrink-0 relative">
                <div
                  onClick={() => onSelectStory(book)}
                  className="aspect-[2/3] w-full rounded-xl overflow-hidden cursor-pointer bg-gray-100 dark:bg-zinc-900 border border-emerald-500/20 relative group"
                >
                  {book.cover && (
                    <img src={optimizedImage(book.cover, 220)} alt={book.title} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                  )}
                  <span className="absolute top-1 left-1 text-[7px] bg-emerald-600 text-white font-black px-1.5 py-0.5 rounded uppercase shadow">Hors ligne</span>
                  <button
                    onClick={(e) => { e.stopPropagation(); removeDownload(book.id); }}
                    className="absolute top-1 right-1 p-1 rounded-lg bg-black/50 text-white hover:bg-red-600 transition"
                    title="Retirer le téléchargement"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
                <h4 onClick={() => onSelectStory(book)} className="mt-1.5 text-[11px] font-black text-gray-950 dark:text-gray-50 line-clamp-1 cursor-pointer hover:text-purple-600">{book.title}</h4>
                <p className="text-[9px] text-gray-400 line-clamp-1">{book.authorName}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* SECTION 1: CONTINUER LA LECTURE (cartes horizontales facon maquette) */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-extrabold text-[11px] uppercase tracking-widest text-gray-900 dark:text-white flex items-center gap-1.5">
            <Clock className="w-4 h-4 text-purple-600" />
            <span>Continuer la lecture</span>
          </h3>
        </div>

        <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-none -mx-4 px-4">
          {displayOngoing.slice(0, 6).map((story) => {
            const { percent } = getStoryProgressInfo(story);
            const readCh = story.chapters.filter((ch) => readChapters.includes(ch.id)).length;
            return (
              <div key={story.id} className="w-36 flex-shrink-0 bg-gray-50 dark:bg-[#0E0E14] border border-gray-100 dark:border-purple-900/15 rounded-2xl p-2.5 flex flex-col">
                <div onClick={() => onSelectStory(story)} className="relative aspect-[2/3] w-full rounded-xl overflow-hidden cursor-pointer">
                  <img src={optimizedImage(story.cover, 220)} alt={story.title} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                  <div className="absolute inset-x-0 bottom-0 h-1.5 bg-black/30">
                    <div className="h-full bg-purple-500" style={{ width: `${percent}%` }} />
                  </div>
                </div>
                <h4 className="mt-2 font-serif font-black text-[11px] text-gray-900 dark:text-white line-clamp-1">{story.title}</h4>
                <p className="text-[9px] text-gray-400 line-clamp-1">{story.authorName}</p>
                <p className="text-[9px] font-bold text-purple-600 dark:text-purple-400 mt-0.5">Chapitre {Math.max(1, readCh)} · {percent}%</p>
                <button
                  onClick={() => onSelectStory(story)}
                  className="mt-2 w-full flex items-center justify-center gap-1 bg-purple-600 hover:bg-purple-700 text-white text-[9px] font-black uppercase tracking-wider py-1.5 rounded-lg transition"
                >
                  <BookOpen className="w-3 h-3" /> Reprendre
                </button>
              </div>
            );
          })}
        </div>
      </section>

      {/* SECTION : REPRENEZ VOTRE ÉCRITURE (auteurs) */}
      {currentUser.role !== 'Lecteur' && (() => {
        const myStories = stories.filter((s) => s.authorId === currentUser.id);
        const latest = myStories.slice().sort((a, b) => new Date(b.publishDate).getTime() - new Date(a.publishDate).getTime())[0];
        return (
          <section className="rounded-2xl p-4 bg-gradient-to-br from-purple-600/10 to-fuchsia-600/5 border border-purple-500/20 flex items-center gap-4">
            {latest ? (
              <>
                <img src={optimizedImage(latest.cover, 120)} alt={latest.title} className="w-14 h-20 rounded-lg object-cover flex-shrink-0 shadow" referrerPolicy="no-referrer" />
                <div className="flex-1 min-w-0">
                  <p className="text-[9px] font-black uppercase tracking-widest text-purple-600 dark:text-purple-400">Reprenez votre écriture</p>
                  <h4 className="text-sm font-serif font-black text-gray-900 dark:text-white line-clamp-1 mt-0.5">{latest.title}</h4>
                  <p className="text-[10px] text-gray-400">{latest.chapters?.length || 0} chapitre{(latest.chapters?.length || 0) > 1 ? 's' : ''}</p>
                  <button onClick={() => onStartWriting?.()} className="mt-2 inline-flex items-center gap-1.5 bg-purple-600 hover:bg-purple-700 text-white text-[10px] font-black uppercase tracking-wider px-3 py-1.5 rounded-lg transition">
                    <PenTool className="w-3 h-3" /> Écrire
                  </button>
                </div>
              </>
            ) : (
              <div className="flex-1">
                <p className="text-[9px] font-black uppercase tracking-widest text-purple-600 dark:text-purple-400">Une histoire à raconter ?</p>
                <h4 className="text-sm font-serif font-black text-gray-900 dark:text-white mt-0.5">Commence ton premier livre</h4>
                <button onClick={() => onStartWriting?.()} className="mt-2 inline-flex items-center gap-1.5 bg-purple-600 hover:bg-purple-700 text-white text-[10px] font-black uppercase tracking-wider px-3 py-1.5 rounded-lg transition">
                  <PenTool className="w-3 h-3" /> Créer un livre
                </button>
              </div>
            )}
          </section>
        );
      })()}

      {/* SECTION 2: DECOUVRIR (onglets Tendances / Nouveautes / Recommandes) */}
      <section className="space-y-3">
        <h3 className="font-extrabold text-[11px] uppercase tracking-widest text-gray-900 dark:text-white flex items-center gap-1.5">
          <Compass className="w-4 h-4 text-purple-600" />
          <span>Découvrir</span>
        </h3>

        <div className="flex gap-2 text-[10px] font-black uppercase tracking-wide">
          {([['tendances','Tendances'],['nouveautes','Nouveautés'],['recommandes','Recommandés']] as const).map(([id,label]) => (
            <button
              key={id}
              onClick={() => setDiscoverTab(id)}
              className={`px-3 py-1.5 rounded-full transition ${discoverTab === id ? 'bg-purple-600 text-white shadow-sm' : 'bg-gray-100 dark:bg-zinc-900 text-gray-500'}`}
            >
              {label}
            </button>
          ))}
        </div>

        {(() => {
          const list = discoverTab === 'tendances'
            ? trendingStories
            : discoverTab === 'nouveautes'
              ? newsStories
              : displayForYou.map((d) => d.story);
          return (
            <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-none -mx-4 px-4">
              {list.slice(0, 12).map((story, i) => (
                <div key={story.id} className="w-28 flex-shrink-0">
                  <div onClick={() => onSelectStory(story)} className="relative aspect-[2/3] w-full rounded-xl overflow-hidden cursor-pointer">
                    <img src={optimizedImage(story.cover, 180)} alt={story.title} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                    <span className="absolute top-1 left-1 w-5 h-5 rounded-full bg-black/70 text-white text-[10px] font-black flex items-center justify-center">{i + 1}</span>
                  </div>
                  <h4 onClick={() => onSelectStory(story)} className="mt-1.5 text-[10px] font-black text-gray-900 dark:text-white line-clamp-1 cursor-pointer">{story.title}</h4>
                  <p className="text-[9px] text-gray-400 line-clamp-1">{story.authorName}</p>
                </div>
              ))}
              {list.length === 0 && <p className="text-xs text-gray-400 py-6">Rien pour le moment.</p>}
            </div>
          );
        })()}
      </section>

      {/* SECTION 3: EVENEMENTS & COMMUNAUTE */}
      <section className="space-y-3">
        <h3 className="font-extrabold text-[11px] uppercase tracking-widest text-gray-900 dark:text-white flex items-center gap-1.5">
          <Users className="w-4 h-4 text-purple-600" />
          <span>Événements & communauté</span>
        </h3>
        <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-none -mx-4 px-4">
          {[
            { t: 'Le défi des 7 jours', d: 'Écris un peu chaque jour', g: 'from-purple-600 to-fuchsia-600' },
            { t: "Plume d'or 2024", d: 'Le concours de la communauté', g: 'from-amber-500 to-orange-600' },
            { t: "Sélection de l'équipe", d: 'Les coups de cœur du moment', g: 'from-emerald-500 to-teal-600' },
          ].map((e, i) => (
            <div key={i} className={`w-52 flex-shrink-0 rounded-2xl p-4 text-white bg-gradient-to-br ${e.g} flex flex-col justify-end h-28 shadow-md`}>
              <p className="text-sm font-serif font-black leading-tight">{e.t}</p>
              <p className="text-[10px] opacity-90">{e.d}</p>
            </div>
          ))}
        </div>
      </section>

      </div>
      )}

      {/* SHARING MODAL - TIKTOK / SOCIAL SHARING SIMULATION */}
      {shareStory && (
        <div className="fixed inset-0 z-50 flex items-end justify-center animate-fade-in select-none">
          <div 
            className="absolute inset-0 bg-black/60 backdrop-blur-xs" 
            onClick={() => setShareStory(null)} 
          />

          <div className="relative w-full max-w-xl bg-white dark:bg-black rounded-t-[2rem] border-t border-gray-150 dark:border-purple-905/20 shadow-[0_-10px_40px_rgba(0,0,0,0.3)] animate-slide-up flex flex-col p-6 space-y-5">
            
            {/* Top little handle grip indicator */}
            <div className="w-10 h-1 bg-gray-300 dark:bg-zinc-800 rounded-full mx-auto" />

            <div className="flex justify-between items-center border-b border-gray-100 dark:border-zinc-900 pb-3">
              <div className="text-left">
                <span className="text-[8px] tracking-wider uppercase font-bold text-purple-600 block">Partager le manuscrit</span>
                <p className="font-serif font-black text-xs text-gray-900 dark:text-white line-clamp-1">{shareStory.title}</p>
              </div>
              <button 
                id="close-home-share-modal"
                onClick={() => setShareStory(null)}
                className="p-1 rounded-full bg-gray-50 hover:bg-gray-100 dark:bg-zinc-900"
              >
                <CloseIcon className="w-4 h-4 text-gray-500" />
              </button>
            </div>

            {/* Simulated target Share networks */}
            <div className="grid grid-cols-4 gap-2 pt-1.5 select-none text-center">
              {shareServices.map((srv) => (
                <button
                  key={srv.name}
                  id={`share-srv-${srv.name.toLowerCase().replace(/\s+/g, '-')}`}
                  onClick={() => {
                    srv.action();
                    setShareStory(null);
                  }}
                  className="flex flex-col items-center justify-center space-y-1.5 cursor-pointer"
                >
                  <div className={`w-10 h-10 rounded-full ${srv.color} text-white flex items-center justify-center shadow-xs hover:opacity-90`}>
                    <Send className="w-4 h-4 rotate-[-35deg]" />
                  </div>
                  <span className="text-[9px] text-gray-400 font-bold uppercase">{srv.name.split(' ')[0]}</span>
                </button>
              ))}
            </div>

            {/* Quick manual copy link action */}
            <div className="pt-3 border-t border-gray-100 dark:border-zinc-900 flex items-center space-x-2">
              <div className="flex-1 bg-gray-50 dark:bg-zinc-950 p-2.5 rounded-xl text-[11px] text-gray-500 font-mono truncate select-all">
                https://plume.app/recits/{shareStory.id}
              </div>
              <button
                id="home-copy-link-btn"
                onClick={() => handleCopyLink(shareStory)}
                className="h-9 px-4 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold flex items-center space-x-1.5 transition duration-200"
              >
                {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? 'Copié' : 'Copier'}</span>
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
