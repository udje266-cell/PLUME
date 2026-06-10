/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { 
  BookOpen, 
  Heart, 
  Star, 
  Share2, 
  TrendingUp, 
  Sparkles, 
  Clock, 
  UserPlus, 
  UserCheck, 
  FileText, 
  Eye, 
  MessageCircle, 
  Compass, 
  Copy, 
  Send, 
  X as CloseIcon,
  Check
} from 'lucide-react';
import { User, Story, Chapter } from '../types';
import { VerifiedBadge } from './VerifiedBadge';
import { recommendStories, hotScore } from '../utils/recommendation';

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
  onViewProfile
}: HomeViewProps) {
  
  const [shareStory, setShareStory] = useState<Story | null>(null);
  const [copied, setCopied] = useState(false);

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
  const displayForYou = useMemo(
    () => recommendStories(stories, currentUser, { limit: 12 }).map((r) => r.story),
    [stories, currentUser],
  );

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
  const authorsList = allUsers.filter(u => u.role === 'Auteur' && u.id !== currentUser.id);

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
      
      {/* Dynamic Header greeting */}
      <header className="pb-4 border-b border-gray-100 dark:border-purple-900/10 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-black tracking-tight text-gray-950 dark:text-white flex items-center space-x-1.5">
            <span>Archipel Plume</span>
            <Sparkles className="w-4 h-4 text-purple-600 fill-purple-600/10" />
          </h1>
          <p className="text-gray-400 text-[10px] uppercase font-bold tracking-wider mt-1">
            Lecteur actif : @{currentUser.username.toLowerCase()}
          </p>
        </div>

        {/* Mini stats pill */}
        <div className="bg-purple-500/10 text-purple-600 dark:text-purple-400 px-3 py-1.5 rounded-xl border border-purple-500/15 text-[10px] font-black uppercase tracking-wider">
          {currentUser.role}
        </div>
      </header>

      {/* SECTION 1: CONTINUER LA LECTURE */}
      <section className="space-y-3">
        <h3 className="font-extrabold text-[10px] uppercase tracking-widest text-[#7C3AED] dark:text-purple-400 flex items-center space-x-1.5">
          <Clock className="w-3.5 h-3.5" />
          <span>Continuer la lecture</span>
        </h3>

        <div className="space-y-3">
          {displayOngoing.slice(0, 2).map((story) => {
            const { percent, lastRead } = getStoryProgressInfo(story);
            return (
              <div 
                key={story.id}
                id={`ongoing-item-${story.id}`}
                onClick={() => onSelectStory(story)}
                className="flex items-center gap-4 p-4 bg-gray-50 dark:bg-[#0E0E14] rounded-2xl border border-gray-100 dark:border-purple-900/15 hover:bg-purple-500/5 dark:hover:bg-purple-950/10 cursor-pointer transition-all duration-300 shadow-sm group relative"
              >
                <img 
                  src={story.cover} 
                  alt={story.title} 
                  className="w-12 h-18 rounded-lg object-cover flex-shrink-0 shadow-sm border border-gray-150/40"
                  referrerPolicy="no-referrer"
                />
                <div className="flex-1 min-w-0">
                  <h4 className="font-serif font-black text-xs text-gray-900 dark:text-white line-clamp-1 truncate group-hover:text-[#7C3AED] dark:group-hover:text-purple-300 transition-colors">
                    {story.title}
                  </h4>
                  <p className="text-[10px] text-gray-400 mt-0.5">
                    Par{' '}
                    <span 
                      onClick={(e) => {
                        e.stopPropagation();
                        if (onViewProfile) {
                          onViewProfile(story.authorId);
                        } else {
                          onOpenDiscussion(story.authorId);
                        }
                      }}
                      className="hover:text-purple-600 dark:hover:text-purple-400 hover:underline cursor-pointer font-bold transition-colors"
                      title="Consulter le profil de l'auteur"
                    >
                      {story.authorName}
                    </span>
                  </p>
                  
                  {/* Progress section */}
                  <div className="flex items-center justify-between text-[9px] uppercase font-bold text-gray-400 mt-2">
                    <span className="text-[#7C3AED] dark:text-purple-400">{percent}% Lu</span>
                    <span>Dernier : {lastRead}</span>
                  </div>

                  <div className="w-full bg-gray-200 dark:bg-zinc-800 h-1 rounded-full mt-1.5 overflow-hidden">
                    <div 
                      className="bg-purple-600 h-full rounded-full transition-all" 
                      style={{ width: `${percent}%` }}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* SECTION 2: POUR TOI (Personalized recommendations based on tags or category) */}
      <section className="space-y-3">
        <h3 className="font-extrabold text-[10px] uppercase tracking-widest text-[#7C3AED] dark:text-purple-400 flex items-center space-x-1.5">
          <Sparkles className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
          <span>Pour toi (Recommandations)</span>
        </h3>

        <div className="flex space-x-3 overflow-x-auto pb-2 scrollbar-none">
          {displayForYou.map((story) => {
            const isFav = favorites.includes(story.id);
            return (
              <div 
                key={story.id} 
                className="w-40 flex-shrink-0 bg-gray-50 dark:bg-[#0E0E14] border border-gray-100 dark:border-purple-900/15 rounded-2xl p-3 flex flex-col justify-between transition-all duration-300 hover:border-purple-500/30 relative"
              >
                {/* Image layout */}
                <div 
                  onClick={() => onSelectStory(story)}
                  className="relative aspect-[2/3] w-full rounded-xl overflow-hidden cursor-pointer group"
                >
                  <img 
                    src={story.cover} 
                    alt={story.title} 
                    className="w-full h-full object-cover group-hover:scale-103 transition-transform" 
                    referrerPolicy="no-referrer"
                  />
                  <div className="absolute top-1 right-1 flex flex-col items-end gap-1">
                    <span className="text-[8px] bg-purple-600 text-white font-bold px-1.5 py-0.5 rounded uppercase shadow-sm">
                      {story.genre.split(' ')[0]}
                    </span>
                    {story.ageRating && story.ageRating !== 'all' && (
                      <span className="text-[7.5px] bg-red-650 text-white font-black px-1.5 py-0.5 rounded shadow-sm">
                        {story.ageRating}+
                      </span>
                    )}
                  </div>
                </div>

                {/* Cover info */}
                <div className="text-left mt-2 space-y-1">
                  <h4 
                    onClick={() => onSelectStory(story)}
                    className="font-serif font-black text-xs text-gray-950 dark:text-gray-50 line-clamp-1 hover:text-purple-600 cursor-pointer"
                  >
                    {story.title}
                  </h4>
                  <p className="text-[10px] text-gray-400 line-clamp-1">
                    Par{' '}
                    <span 
                      onClick={(e) => {
                        e.stopPropagation();
                        if (onViewProfile) {
                          onViewProfile(story.authorId);
                        } else {
                          onOpenDiscussion(story.authorId);
                        }
                      }}
                      className="hover:text-purple-600 dark:hover:text-purple-400 hover:underline cursor-pointer font-bold transition-colors"
                      title="Consulter le profil de l'auteur"
                    >
                      {story.authorName}
                    </span>
                  </p>
                </div>

                {/* Card actions bottom */}
                <div className="flex items-center justify-between mt-3 pt-2 border-t border-gray-100 dark:border-zinc-900">
                  <button
                    id={`home-fav-chk-${story.id}`}
                    onClick={() => onToggleFavorite(story.id)}
                    className={`p-1 rounded-lg border transition cursor-pointer ${
                      isFav 
                        ? 'bg-purple-600/10 text-purple-600 border-purple-500/20' 
                        : 'bg-white dark:bg-black border-gray-200 dark:border-purple-900/25 text-gray-400 hover:text-purple-600 hover:bg-purple-500/5 shadow-xs'
                    }`}
                    title="Favoris / Bibliothèque"
                  >
                    <Star className={`w-3 h-3 ${isFav ? 'fill-purple-600 text-purple-650' : ''}`} />
                  </button>

                  <button
                    id={`home-share-story-${story.id}`}
                    onClick={() => setShareStory(story)}
                    className="p-1.5 rounded-lg text-gray-400 hover:text-purple-600 transition"
                    title="Partager"
                  >
                    <Share2 className="w-3 h-3" />
                  </button>
                </div>

              </div>
            );
          })}
        </div>
      </section>

      {/* SECTION 3: TENDANCES POPULAIRES (Sorted by rating/reads growth) */}
      <section className="space-y-4">
        <div className="flex justify-between items-center pb-1.5 border-b border-gray-100 dark:border-zinc-900">
          <h3 className="font-extrabold text-[10px] uppercase tracking-widest text-gray-900 dark:text-white flex items-center space-x-1.5">
            <TrendingUp className="w-3.5 h-3.5 text-purple-600" />
            <span>Tendances Populaires</span>
          </h3>
          <span className="text-[9px] font-mono text-purple-600 bg-purple-500/10 px-2 py-1 rounded-full uppercase font-bold flex items-center gap-1">
            <TrendingUp className="w-3 h-3 text-purple-600" />
            <span>Croissance active</span>
          </span>
        </div>

        <div className="space-y-3">
          {trendingStories.slice(0, 3).map((story, idx) => (
            <div 
              key={story.id} 
              className="flex items-center gap-4 p-3 bg-white dark:bg-[#0E0E14] border border-gray-100 dark:border-purple-900/15 rounded-2xl transition hover:border-purple-500/25 shadow-xs"
            >
              {/* Cover index display */}
              <div className="font-mono text-base font-black text-gray-300 dark:text-zinc-700 w-6 text-center">
                #{idx + 1}
              </div>

              <img 
                src={story.cover} 
                alt={story.title} 
                className="w-10 h-14 rounded-lg object-cover flex-shrink-0 cursor-pointer"
                onClick={() => onSelectStory(story)}
                referrerPolicy="no-referrer"
              />

              <div className="flex-1 min-w-0 text-left">
                <h4 
                  onClick={() => onSelectStory(story)}
                  className="font-bold text-xs text-gray-900 dark:text-gray-150 line-clamp-1 hover:text-purple-600 hover:underline cursor-pointer"
                >
                  {story.title}
                </h4>
                <p className="text-[10px] text-gray-400">Archipel de {story.genre}</p>
                
                {/* Stats metrics */}
                <div className="flex items-center space-x-3 text-[9px] font-mono text-gray-400 mt-1">
                  <span className="flex items-center space-x-0.5" title="Lectures">
                    <Eye className="w-3 h-3 text-gray-500" />
                    <span>{story.reads}</span>
                  </span>
                  <span className="flex items-center space-x-0.5" title="Likes">
                    <Heart className="w-3 h-3 text-purple-500 fill-purple-500/10" />
                    <span>{story.likes}</span>
                  </span>
                </div>
              </div>

              <button
                id={`trend-share-shortcut-${story.id}`}
                onClick={() => setShareStory(story)}
                className="p-1.5 text-gray-400 hover:text-purple-600"
              >
                <Share2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      </section>

      {/* SECTION 4: LES NOUVEAUTÉS DU JOUR */}
      <section className="space-y-3">
        <h3 className="font-extrabold text-[10px] uppercase tracking-widest text-[#7C3AED] dark:text-purple-400">
          Nouveautés Récentes
        </h3>

        <div className="grid grid-cols-2 gap-3">
          {newsStories.slice(0, 2).map((story) => (
            <div 
              key={story.id} 
              onClick={() => onSelectStory(story)}
              className="p-3.5 bg-[#FCFBFF] dark:bg-[#0E0E14] border border-gray-100 dark:border-purple-900/15 rounded-2xl cursor-pointer text-left group hover:scale-[1.01] transition-transform shadow-xs"
            >
              <img 
                src={story.cover} 
                alt={story.title} 
                className="w-full h-28 object-cover rounded-xl shadow-xs" 
                referrerPolicy="no-referrer"
              />
              <span className="inline-block px-2 py-0.5 bg-green-500/10 text-green-600 rounded text-[8px] font-black uppercase tracking-wider mt-2">
                Nouveau
              </span>
              <h4 className="font-serif font-black text-xs text-gray-900 dark:text-white line-clamp-1 mt-1 shrink-0 group-hover:text-purple-600">
                {story.title}
              </h4>
              <p className="text-[10px] text-gray-400">
                Par{' '}
                <span 
                  onClick={(e) => {
                    e.stopPropagation();
                    if (onViewProfile) {
                      onViewProfile(story.authorId);
                    } else {
                      onOpenDiscussion(story.authorId);
                    }
                  }}
                  className="hover:text-purple-600 dark:hover:text-purple-400 hover:underline cursor-pointer font-bold transition-colors"
                  title="Consulter le profil de l'auteur"
                >
                  {story.authorName}
                </span>
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* SECTION 5: NOUVEAUX AUTEURS ACTIFS */}
      <section className="space-y-3">
        <h3 className="font-extrabold text-[10px] uppercase tracking-widest text-[#7C3AED] dark:text-purple-400">
          Nouveaux Auteurs Vedettes
        </h3>

        <div className="space-y-2">
          {authorsList.map((author) => {
            const isFollowing = currentUser.following.includes(author.id);
            return (
              <div 
                key={author.id} 
                className="flex items-center justify-between p-3.5 bg-gray-50 dark:bg-[#0E0E14] rounded-2xl border border-gray-100 dark:border-purple-900/15 text-left shadow-xs"
              >
                <div 
                  onClick={() => {
                    if (onViewProfile) {
                      onViewProfile(author.id);
                    } else {
                      onOpenDiscussion(author.id);
                    }
                  }}
                  className="flex items-center space-x-3 cursor-pointer group"
                  title="Consulter le profil"
                >
                  <img 
                    src={author.avatar} 
                    alt={author.username} 
                    className="w-10 h-10 rounded-full object-cover ring-2 ring-purple-600/10 group-hover:scale-105 transition duration-150"
                    referrerPolicy="no-referrer"
                  />
                  <div>
                    <div className="flex items-center space-x-1">
                      <span className="text-xs font-bold text-gray-900 dark:text-white group-hover:text-purple-600 dark:group-hover:text-purple-400 group-hover:underline transition-colors">{author.username}</span>
                      {author.isVerified && <VerifiedBadge size="xs" />}
                    </div>
                    <p className="text-[9px] text-gray-400 line-clamp-1">{author.bio || "Plume d'encre"}</p>
                  </div>
                </div>

                <button
                  id={`home-follow-author-${author.id}`}
                  onClick={() => onFollowAuthor(author.id)}
                  className={`h-8 px-3 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all flex items-center space-x-1 shrink-0 ${
                    isFollowing 
                      ? 'bg-gray-100 hover:bg-gray-200 text-gray-805 dark:bg-black dark:text-zinc-300 border border-gray-200/50 dark:border-purple-900/40 hover:bg-purple-950/10' 
                      : 'bg-[#7C3AED] hover:bg-[#6D28D9] text-white'
                  }`}
                >
                  {isFollowing ? (
                    <>
                      <UserCheck className="w-3.5 h-3.5" />
                      <span>Suivi</span>
                    </>
                  ) : (
                    <>
                      <UserPlus className="w-3.5 h-3.5" />
                      <span>Suivre</span>
                    </>
                  )}
                </button>
              </div>
            );
          })}
        </div>
      </section>

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
