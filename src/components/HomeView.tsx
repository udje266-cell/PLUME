/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useEffect } from 'react';
import { BookOpen, Download, Trash2, Heart, Star, Clock, Users, Eye, Compass, Copy, Search, X as CloseIcon, Check, ChevronRight, MoreHorizontal } from 'lucide-react';
import { User, Story } from '../types';
import { getDownloadedBooks, removeDownload } from '../utils/offline';
import { optimizedImage } from '../utils/imageUrl';
import { VerifiedBadge } from './VerifiedBadge';
import { recommendStories, hotScore, weightsForDiscovery, explorationRatioForDiscovery, ScoredStory } from '../utils/recommendation';
import { authHeaders } from '../utils/auth';
import { storyShareUrl, shareStoryNative, openShareIntent, ShareNetwork } from '../utils/share';
import { WhatsAppIcon, FacebookIcon, XTwitterIcon, TelegramIcon } from './BrandIcons';
import { localGreeting } from '../utils/greeting';
import { getBookProgress } from '../utils/readingProgress';
import { generateCoverDataUri } from '../utils/coverImage';

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
  onViewProfile,
  onOpenLibrary,
}: HomeViewProps) {

  const [shareStory, setShareStory] = useState<Story | null>(null);
  const [copied, setCopied] = useState(false);
  const [searchText, setSearchText] = useState('');

  // Livres téléchargés (disponibles hors ligne). Se met à jour quand on
  // télécharge / retire un livre ailleurs dans l'app.
  const [offlineBooks, setOfflineBooks] = useState<Story[]>(() => getDownloadedBooks());
  useEffect(() => {
    const refresh = () => setOfflineBooks(getDownloadedBooks());
    window.addEventListener('plume-offline-changed', refresh);
    return () => window.removeEventListener('plume-offline-changed', refresh);
  }, []);

  const discovery = useMemo(() => {
    try {
      const value = Number.parseFloat(localStorage.getItem(`plume_feed_discovery_${currentUser.id}`) || '');
      return Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : 0.5;
    } catch { return 0.5; }
  }, [currentUser.id]);

  // Repli d'image : une couverture morte (URL cassee) est remplacee par une
  // couverture generee localement (titre + degrade) au lieu d'une icone cassee.
  const onCoverError = (title: string) => (e: React.SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget;
    if (img.dataset.fallback) return; // pas de boucle si le repli echouait aussi
    img.dataset.fallback = '1';
    img.src = generateCoverDataUri(title || 'PLUME');
  };

  // Filter out published and safe stories
  const publishedStories = stories.filter(s => s.status === 'Publié' && !s.isFlagged);

  // Keep the card current when progress changes in this window or another tab.
  const [, refreshProgress] = useState(0);
  useEffect(() => {
    const refresh = () => refreshProgress(value => value + 1);
    const onStorage = (event: StorageEvent) => {
      if (!event.key || event.key === `plume_book_progress_${currentUser.id}`) refresh();
    };
    const onProgress = (event: Event) => {
      if ((event as CustomEvent).detail?.userId === currentUser.id) refresh();
    };
    window.addEventListener('storage', onStorage);
    window.addEventListener('plume:book-progress', onProgress);
    return () => { window.removeEventListener('storage', onStorage); window.removeEventListener('plume:book-progress', onProgress); };
  }, [currentUser.id]);

  // Resume from the actual saved position, not the number of chapters opened.
  const resumeInfo = (() => {
    const savedStories = publishedStories.map(story => ({ story, progress: getBookProgress(currentUser.id, story.id) }))
      .filter(item => item.progress && item.progress.percent < 100 && item.story.chapters.length)
      .sort((a, b) => new Date(b.progress!.updatedAt).getTime() - new Date(a.progress!.updatedAt).getTime());
    const recent = savedStories[0];
    const story = recent?.story || publishedStories.find(s => s.id === lastReadProgress?.storyId);
    if (!story?.chapters.length) return null;
    if (!recent && (getBookProgress(currentUser.id, story.id)?.percent ?? 0) >= 100) return null;
    const chapterIndex = recent ? Math.min(story.chapters.length - 1, Math.max(0, recent.progress!.chapterIndex))
      : Math.max(0, story.chapters.findIndex(c => c.id === lastReadProgress?.chapterId));
    return { story, chapterIndex, percent: recent?.progress?.percent ?? 0 };
  })();

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

  // Texte d'accroche partagé avec le récit.
  const shareTextFor = (story: Story) => `« ${story.title} » de ${story.authorName} sur PLUME`;

  // Copie le VRAI lien profond du récit (atteignable, ouvre le récit dans l'app).
  const handleCopyLink = (story: Story) => {
    navigator.clipboard.writeText(storyShareUrl(story.id)).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Point d'entrée du partage : feuille système native si disponible (mobile/PWA),
  // sinon ouverture de la fenêtre de partage (liens d'intention réels + copie).
  const handleShareStory = async (story: Story) => {
    const ok = await shareStoryNative({
      title: story.title,
      text: shareTextFor(story),
      url: storyShareUrl(story.id),
    });
    if (!ok) setShareStory(story);
  };

  // Réseaux de partage : liens d'intention RÉELS (plus aucune simulation).
  // Chaque réseau porte son VRAI logo (SVG monochrome sur le rond de marque).
  const shareServices: { name: string; network: ShareNetwork; color: string; Icon: React.FC<{ className?: string }> }[] = [
    { name: 'WhatsApp', network: 'whatsapp', color: 'bg-[#25D366]', Icon: WhatsAppIcon },
    { name: 'Facebook', network: 'facebook', color: 'bg-[#1877F2]', Icon: FacebookIcon },
    { name: 'X / Twitter', network: 'twitter', color: 'bg-black', Icon: XTwitterIcon },
    { name: 'Telegram', network: 'telegram', color: 'bg-[#26A5E4]', Icon: TelegramIcon },
  ];

  const [greeting, setGreeting] = useState(() => localGreeting());
  const [genreFilter, setGenreFilter] = useState('Tout');
  const [resumeMenu, setResumeMenu] = useState(false);
  useEffect(() => {
    const refresh = () => setGreeting(localGreeting());
    const timer = window.setInterval(refresh, 15_000);
    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', refresh);
    return () => { clearInterval(timer); window.removeEventListener('focus', refresh); document.removeEventListener('visibilitychange', refresh); };
  }, []);
  const featuredStory = publishedStories.find(s => s.featured) || trendingStories[0];
  const genres = ['Tout', ...Array.from(new Set(publishedStories.flatMap(s => s.genres?.length ? s.genres : [s.genre]).filter(Boolean))).slice(0, 6)];
  const recommended = displayForYou.map(item => item.story).filter(s => s.status === 'Publié' && !s.isFlagged);
  const candidates = recommended.length ? recommended : trendingStories;
  const rankedCatalog = [...candidates, ...trendingStories.filter(story => !candidates.some(candidate => candidate.id === story.id))];
  const forYou = genreFilter === 'Tout' ? candidates : rankedCatalog.filter(s => [s.genre, ...(s.genres || [])].includes(genreFilter));
  const visibleBooks = forYou.slice(0, 9);
  const cover = (story: Story, width = 360) => optimizedImage(story.cover, width) || generateCoverDataUri(story.title);

  return (
    <div className="home-redesign mx-auto w-full max-w-6xl px-[18px] pt-2 pb-8 text-left text-[#191329] dark:text-zinc-100 sm:px-7 lg:px-10 lg:pt-7">
      <header className="mb-4">
        <h1 className="font-serif text-[clamp(21px,5.1vw,32px)] font-bold tracking-[-0.035em] leading-tight">
          {greeting.message}, <span className="break-words">@{currentUser.username.replace(/^@/, '')}</span> <span className="whitespace-nowrap">{greeting.emoji}</span>
        </h1>
        <p className="mt-1 text-[14px] sm:text-base text-zinc-500 dark:text-zinc-400">Une nouvelle histoire vous attend.</p>
        <form role="search" onSubmit={e => { e.preventDefault(); if (searchText.trim()) onOpenLibrary?.(searchText.trim()); }} className="relative mt-3">
          <Search className="pointer-events-none absolute left-3.5 top-3 h-5 w-5 text-zinc-400" />
          <input type="search" aria-label="Rechercher un livre ou un auteur" value={searchText} onChange={e => setSearchText(e.target.value)} placeholder="Un livre, un auteur, un univers…" className="h-11 w-full rounded-[18px] bg-[#f3f3f7] dark:bg-zinc-900 pl-11 pr-4 text-[13px] placeholder:text-zinc-400 outline-none focus:ring-2 focus:ring-purple-500/50" />
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


      {!searchText.trim() && <div className="space-y-4 sm:space-y-7">
        {resumeInfo && <section id="resume-reading-card" aria-label="Reprendre ma lecture">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-[15px] font-bold sm:text-lg"><Clock className="h-5 w-5 text-purple-600" />Reprendre ma lecture</h2>
            <button aria-label="Voir ma bibliothèque" onClick={() => onViewProfile?.(currentUser.id)} className="p-1"><ChevronRight className="h-5 w-5 text-zinc-500" /></button>
          </div>
          <div className="relative flex items-center gap-3 rounded-[19px] bg-[#f6f0fd] dark:bg-purple-950/30 p-3 sm:gap-5 sm:p-4">
            <button onClick={() => onSelectStory(resumeInfo.story)} aria-label={`Reprendre ${resumeInfo.story.title}`} className="shrink-0">
              <img src={cover(resumeInfo.story, 180)} alt={resumeInfo.story.title} onError={onCoverError(resumeInfo.story.title)} className="h-[82px] w-[58px] rounded-lg object-cover shadow-sm sm:h-28 sm:w-20" />
            </button>
            <div className="min-w-0 flex-1 self-center">
              <h3 className="line-clamp-2 pr-5 font-serif text-base font-bold leading-tight sm:text-xl">{resumeInfo.story.title}</h3>
              <p className="mt-1 truncate text-xs text-zinc-500">{resumeInfo.story.authorName}</p>
              <p className="mt-2 text-[11px] sm:text-xs">Chapitre {resumeInfo.chapterIndex + 1} <span className="px-1">·</span> {Math.round(resumeInfo.percent)} %</p>
              <div role="progressbar" aria-label="Progression de lecture" aria-valuenow={Math.round(resumeInfo.percent)} aria-valuemin={0} aria-valuemax={100} className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-purple-200/60 dark:bg-purple-900">
                <div className="h-full rounded-full bg-gradient-to-r from-purple-600 to-fuchsia-500" style={{ width: `${resumeInfo.percent}%` }} />
              </div>
            </div>
            <button onClick={() => onSelectStory(resumeInfo.story)} className="mt-5 flex shrink-0 items-center gap-1.5 rounded-xl bg-gradient-to-r from-purple-600 to-[#a600f5] px-3 py-3 text-[11px] font-semibold text-white shadow-sm hover:brightness-110 sm:px-5 sm:text-sm"><BookOpen className="h-4 w-4" />Reprendre</button>
            <button aria-label="Options de la lecture" aria-expanded={resumeMenu} onClick={() => setResumeMenu(!resumeMenu)} className="absolute right-3 top-2 p-1 text-zinc-400"><MoreHorizontal className="h-5 w-5" /></button>
            {resumeMenu && <><button aria-label="Fermer les options" className="fixed inset-0 z-10 cursor-default" onClick={() => setResumeMenu(false)} /><div className="absolute right-3 top-10 z-20 rounded-xl border border-zinc-100 bg-white p-1.5 text-xs shadow-xl dark:border-zinc-800 dark:bg-zinc-900">
              <button className="block w-full rounded-lg p-2 text-left hover:bg-purple-50 dark:hover:bg-zinc-800" onClick={() => { onToggleFavorite(resumeInfo.story.id); setResumeMenu(false); }}>{favorites.includes(resumeInfo.story.id) ? 'Retirer des favoris' : 'Ajouter aux favoris'}</button>
              <button className="block w-full rounded-lg p-2 text-left hover:bg-purple-50 dark:hover:bg-zinc-800" onClick={() => { void handleShareStory(resumeInfo.story); setResumeMenu(false); }}>Partager ce récit</button>
            </div></>}
          </div>
        </section>}

        {featuredStory && <section aria-label="À la une">
          <h2 className="mb-2 flex items-center gap-2 text-[15px] font-bold sm:text-lg"><Star className="h-5 w-5 fill-purple-600 text-purple-600" />À la une</h2>
          <div className="relative isolate flex min-h-[174px] overflow-hidden rounded-[19px] bg-[#221034] shadow-md sm:min-h-[260px] lg:min-h-[320px]">
            <img src={cover(featuredStory, 1200)} alt="" aria-hidden="true" className="absolute inset-0 -z-20 h-full w-full scale-110 object-cover opacity-60 blur-[2px]" onError={onCoverError(featuredStory.title)} />
            <div className="absolute inset-0 -z-10 bg-gradient-to-r from-[#190d30] via-[#29103a]/80 to-purple-800/10" />
            <div className="relative z-10 flex w-[61%] flex-col items-start justify-center px-4 py-5 sm:px-7 sm:py-8 lg:px-10">
              <p className="mb-2 text-[8px] font-medium uppercase tracking-[0.16em] text-purple-200 sm:text-[11px]">Votre prochaine obsession</p>
              <h3 className="line-clamp-3 font-serif text-[clamp(24px,6vw,46px)] font-bold leading-[1.02] tracking-[-0.025em] text-white">{featuredStory.title}</h3>
              <p className="mt-2 line-clamp-1 text-[11px] text-purple-100 sm:text-sm">{[featuredStory.genre, ...(featuredStory.tags || []).slice(0, 1)].filter(Boolean).join(' · ')}</p>
              <button onClick={() => onSelectStory(featuredStory)} className="mt-4 flex items-center gap-1.5 rounded-full bg-[#f6efff] px-4 py-2 text-xs font-bold text-purple-800 transition hover:bg-white sm:mt-6 sm:px-5 sm:py-3 sm:text-sm">Découvrir <ChevronRight className="h-4 w-4" /></button>
            </div>
            <div className="pointer-events-none absolute bottom-[8%] right-[5%] top-[9%] w-[33%]" style={{ perspective: '800px' }}>
              <img src={cover(featuredStory, 500)} alt={`Couverture de ${featuredStory.title}`} onError={onCoverError(featuredStory.title)} className="h-full w-full rounded-r-lg border-l-[3px] border-white/20 object-cover shadow-[8px_12px_20px_#0009]" style={{ transform: 'rotateY(-15deg) rotate(7deg)' }} />
            </div>
          </div>
        </section>}

        <section aria-label="Pour vous">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-[15px] font-bold sm:text-lg"><Compass className="h-5 w-5 text-purple-600" />Pour vous</h2>
            <button onClick={() => onOpenLibrary?.()} className="flex items-center gap-1 text-xs font-medium text-purple-700 dark:text-purple-400">Tout voir<ChevronRight className="h-4 w-4" /></button>
          </div>
          <div aria-label="Filtrer par genre" className="mb-3 flex gap-2 overflow-x-auto pb-0.5 scrollbar-none">
            {genres.map(genre => <button key={genre} aria-pressed={genreFilter === genre} onClick={() => setGenreFilter(genre)} className={`shrink-0 rounded-full px-5 py-1.5 text-[11px] font-medium transition ${genreFilter === genre ? 'bg-gradient-to-r from-purple-600 to-[#a600f5] text-white' : 'bg-[#f3f3f7] text-zinc-500 dark:bg-zinc-900 dark:text-zinc-400'}`}>{genre}</button>)}
          </div>
          {visibleBooks.length ? <div className="grid grid-cols-3 gap-x-3 gap-y-5 sm:gap-x-5 lg:grid-cols-5">
            {visibleBooks.map(story => <article key={story.id} className="min-w-0">
              <button onClick={() => onSelectStory(story)} className="block w-full text-left transition hover:-translate-y-1" aria-label={`Découvrir ${story.title}`}>
                <img src={cover(story)} alt={story.title} onError={onCoverError(story.title)} loading="lazy" className="aspect-[0.78] w-full rounded-[10px] bg-zinc-100 object-cover shadow-sm dark:bg-zinc-900" />
                <h3 className="mt-1.5 line-clamp-2 font-serif text-[12px] font-bold leading-snug sm:text-base">{story.title}</h3>
              </button>
              <button onClick={() => onViewProfile?.(story.authorId)} className="mt-0.5 block max-w-full truncate text-left text-[10px] text-zinc-400 hover:text-purple-600 sm:text-xs">{story.authorName}</button>
              <div className="mt-1.5 flex items-center gap-2 text-[9px] text-zinc-400 sm:gap-3 sm:text-xs"><span className="flex items-center gap-1"><Eye className="h-3 w-3" />{formatStat(story.reads || story.views || 0)}</span><span className="flex items-center gap-1"><Heart className="h-3 w-3" />{formatStat(story.likes || 0)}</span></div>
            </article>)}
          </div> : <div className="rounded-2xl bg-purple-50/60 p-6 text-center text-sm text-zinc-500 dark:bg-purple-950/20">{publishedStories.length ? 'Aucun récit dans ce genre pour le moment.' : 'Les premières histoires arrivent bientôt. Votre prochain coup de cœur vous attend ici.'}</div>}
        </section>
      {/* SECTION: LIVRES TÉLÉCHARGÉS (disponibles hors ligne) */}
      {offlineBooks.length > 0 && (
        <section className="space-y-3">
          <h3 className="font-extrabold text-[10px] uppercase tracking-widest text-emerald-600 dark:text-emerald-400 flex items-center space-x-1.5">
            <Download className="w-3.5 h-3.5" />
            <span>Disponibles hors ligne ({offlineBooks.length})</span>
          </h3>
          <div className="flex space-x-3 overflow-x-auto pb-2 scrollbar-none lg:grid lg:grid-cols-5 lg:gap-4 lg:space-x-0 lg:overflow-visible">
            {offlineBooks.map((book) => (
              <div key={book.id} className="w-32 flex-shrink-0 lg:w-auto relative">
                <div
                  onClick={() => onSelectStory(book)}
                  className="aspect-[2/3] w-full rounded-xl overflow-hidden cursor-pointer bg-gray-100 dark:bg-zinc-900 border border-emerald-500/20 relative group"
                >
                  {book.cover && (
                    <img src={optimizedImage(book.cover, 220)} alt={book.title} onError={onCoverError(book.title)} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
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

      </div>}
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

            {/* Réseaux de partage : liens d'intention réels */}
            <div className="grid grid-cols-4 gap-2 pt-1.5 select-none text-center">
              {shareServices.map((srv) => (
                <button
                  key={srv.name}
                  id={`share-srv-${srv.name.toLowerCase().replace(/\s+/g, '-')}`}
                  onClick={() => {
                    openShareIntent(srv.network, { url: storyShareUrl(shareStory.id), text: shareTextFor(shareStory) });
                    setShareStory(null);
                  }}
                  className="flex flex-col items-center justify-center space-y-1.5 cursor-pointer"
                >
                  <div className={`w-11 h-11 rounded-full ${srv.color} text-white flex items-center justify-center shadow-sm hover:opacity-90 transition`}>
                    <srv.Icon className="w-5 h-5" />
                  </div>
                  <span className="text-[9px] text-gray-500 dark:text-gray-400 font-bold uppercase">{srv.name.split(' ')[0]}</span>
                </button>
              ))}
            </div>

            {/* Copie manuelle du lien réel */}
            <div className="pt-3 border-t border-gray-100 dark:border-zinc-900 flex items-center space-x-2">
              <div className="flex-1 bg-gray-50 dark:bg-zinc-950 p-2.5 rounded-xl text-[11px] text-gray-500 font-mono truncate select-all">
                {storyShareUrl(shareStory.id)}
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
