import React, { useState } from 'react';
import { ArrowLeft, BookOpen, Heart, Eye, Clock, Check, Play, Bookmark } from 'lucide-react';
import { Story, User } from '../types';
import { chapterMinutes, formatMinutes, storyMinutes } from '../utils/readingTime';
import { getBookProgress } from '../utils/readingProgress';
import { generateCoverDataUri } from '../utils/coverImage';

/**
 * FICHE D'ŒUVRE — écran d'entrée d'un récit.
 * Cliquer sur un livre n'envoie plus directement dans le texte : on présente
 * d'abord le SYNOPSIS de l'auteur (qui n'était visible nulle part) et le
 * SOMMAIRE (chapitres, groupés par tome le cas échéant). Le lecteur choisit
 * alors son chapitre — ou reprend là où il s'était arrêté.
 */
export default function StoryDetailView({
  story,
  currentUser,
  onBack,
  onStartReading,
  onViewProfile,
  isFavorited,
  onToggleFavorite,
  readChapters = [],
}: {
  story: Story;
  currentUser: User;
  onBack: () => void;
  onStartReading: (chapterIndex: number) => void;
  onViewProfile?: (userId: string) => void;
  isFavorited?: boolean;
  onToggleFavorite?: (storyId: string) => void;
  readChapters?: string[];
}) {
  const [synopsisOpen, setSynopsisOpen] = useState(false);

  const chapters = (story.chapters || []).filter((c) => c.isPublished !== false);
  const progress = getBookProgress(currentUser.id, story.id);
  const startedIndex = progress && progress.chapterIndex > 0 ? progress.chapterIndex : 0;
  const hasStarted = !!progress && (progress.chapterIndex > 0 || (progress.percent || 0) > 0);
  const genres = (Array.isArray(story.genres) && story.genres.length ? story.genres : [story.genre]).filter(Boolean);

  // Regroupement par tome quand l'œuvre est structurée en volumes.
  const tomes = (story.tomes || []).slice().sort((a, b) => a.order - b.order);
  const useTomes = story.structure === 'tomes' && tomes.length > 0;
  const groups = useTomes
    ? [
        ...tomes.map((t) => ({ key: t.id, title: t.title, items: chapters.filter((c) => c.tomeId === t.id) })),
        { key: '__none__', title: 'Hors tome', items: chapters.filter((c) => !c.tomeId) },
      ].filter((g) => g.items.length > 0)
    : [{ key: '__all__', title: '', items: chapters }];

  const chapterNumber = (chapterId: string) => chapters.findIndex((c) => c.id === chapterId);

  return (
    <div className="min-h-screen bg-white dark:bg-black text-gray-900 dark:text-white pb-28">
      {/* En-tête */}
      <div className="sticky top-0 z-30 bg-white/90 dark:bg-black/90 backdrop-blur-md border-b border-gray-100 dark:border-zinc-900" style={{ paddingTop: 'max(0.5rem, env(safe-area-inset-top))' }}>
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center gap-3">
          <button onClick={onBack} className="flex items-center gap-1 text-xs font-black uppercase tracking-wider text-gray-500 hover:text-purple-600 transition">
            <ArrowLeft className="w-4 h-4" /> Retour
          </button>
          {onToggleFavorite && (
            <button
              onClick={() => onToggleFavorite(story.id)}
              className={`ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-black uppercase tracking-wider transition ${isFavorited ? 'bg-purple-600 text-white' : 'bg-gray-100 dark:bg-zinc-900 text-gray-500'}`}
            >
              <Bookmark className="w-3.5 h-3.5" /> {isFavorited ? 'En favori' : 'Favori'}
            </button>
          )}
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-7">
        {/* Couverture + titre */}
        <div className="flex gap-4">
          <img
            src={story.cover || generateCoverDataUri(story.title)}
            alt={story.title}
            referrerPolicy="no-referrer"
            className="w-28 h-40 rounded-xl object-cover border border-gray-150 dark:border-zinc-800 shadow-md shrink-0"
          />
          <div className="min-w-0 flex-1">
            <h1 className="font-serif text-2xl font-semibold leading-tight tracking-tight text-balance">{story.title}</h1>
            <button
              onClick={() => onViewProfile?.(story.authorId)}
              className="mt-1 text-sm text-gray-500 dark:text-gray-400 hover:text-purple-600 transition"
            >
              Par {story.authorName}
            </button>
            {genres.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {genres.map((g) => (
                  <span key={g} className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-500/12 text-purple-700 dark:text-purple-300">{g}</span>
                ))}
              </div>
            )}
            <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-gray-400">
              <span className="flex items-center gap-1"><BookOpen className="w-3 h-3" />{chapters.length} chapitre{chapters.length > 1 ? 's' : ''}</span>
              <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{formatMinutes(storyMinutes(story))}</span>
              <span className="flex items-center gap-1"><Eye className="w-3 h-3" />{story.reads || 0}</span>
              <span className="flex items-center gap-1"><Heart className="w-3 h-3" />{story.likes || 0}</span>
            </div>
          </div>
        </div>

        {/* Bouton principal : commencer ou reprendre */}
        {chapters.length > 0 && (
          <button
            onClick={() => onStartReading(hasStarted ? startedIndex : 0)}
            className="w-full flex items-center justify-center gap-2 px-5 py-3.5 rounded-2xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-black uppercase tracking-wider shadow-md active:scale-[0.99] transition"
          >
            <Play className="w-4 h-4" />
            {hasStarted ? `Reprendre au chapitre ${startedIndex + 1}` : 'Commencer la lecture'}
          </button>
        )}

        {/* Synopsis */}
        {story.description?.trim() && (
          <section>
            <h2 className="text-[10px] font-black uppercase tracking-[0.14em] text-purple-500 mb-2">Synopsis</h2>
            <p className={`text-sm leading-relaxed text-gray-700 dark:text-gray-300 whitespace-pre-line ${synopsisOpen ? '' : 'line-clamp-6'}`}>
              {story.description}
            </p>
            {story.description.length > 320 && (
              <button onClick={() => setSynopsisOpen((v) => !v)} className="mt-1.5 text-[11px] font-bold text-purple-600 dark:text-purple-400 hover:underline">
                {synopsisOpen ? 'Réduire' : 'Lire la suite'}
              </button>
            )}
          </section>
        )}

        {/* Sommaire : chapitres (groupés par tome si besoin) */}
        <section>
          <h2 className="text-[10px] font-black uppercase tracking-[0.14em] text-purple-500 mb-2">
            {useTomes ? 'Tomes & chapitres' : 'Chapitres'}
          </h2>
          {chapters.length === 0 ? (
            <p className="text-sm text-gray-400 py-6 text-center">Aucun chapitre publié pour l'instant.</p>
          ) : (
            <div className="space-y-4">
              {groups.map((g) => (
                <div key={g.key}>
                  {g.title && (
                    <p className="text-[11px] font-black uppercase tracking-wider text-gray-400 mb-1.5">{g.title}</p>
                  )}
                  <div className="rounded-2xl border border-gray-150 dark:border-zinc-800 divide-y divide-gray-100 dark:divide-zinc-900 overflow-hidden">
                    {g.items.map((ch) => {
                      const idx = chapterNumber(ch.id);
                      const isRead = readChapters.includes(ch.id);
                      const isCurrent = hasStarted && idx === startedIndex;
                      return (
                        <button
                          key={ch.id}
                          onClick={() => onStartReading(idx)}
                          className={`w-full text-left px-4 py-3 flex items-center gap-3 transition hover:bg-purple-500/5 ${isCurrent ? 'bg-purple-500/10' : ''}`}
                        >
                          <span className={`w-6 text-[11px] font-mono shrink-0 ${isRead ? 'text-purple-500' : 'text-gray-400'}`}>
                            {isRead ? <Check className="w-3.5 h-3.5" /> : idx + 1}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block text-sm font-semibold truncate">{ch.title}</span>
                            <span className="block text-[10px] text-gray-400">{formatMinutes(chapterMinutes(ch))} de lecture</span>
                          </span>
                          {isCurrent && <span className="text-[9px] font-black uppercase text-purple-600 shrink-0">En cours</span>}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
