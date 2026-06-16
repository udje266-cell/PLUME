/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { 
  Search, 
  X, 
  Eye, 
  Heart, 
  MessageCircle, 
  Star, 
  BookOpen, 
  SlidersHorizontal,
  BookmarkCheck,
  Award,
  Bookmark,
  ExternalLink,
  Tag,
  UserCheck,
  UserPlus
} from 'lucide-react';
import { Story, User } from '../types';
import { optimizedImage } from '../utils/imageUrl';
import { displayRole } from '../utils/role';
import { VerifiedBadge } from './VerifiedBadge';

interface ExplorerViewProps {
  stories: Story[];
  users?: User[];
  onSelectStory: (story: Story) => void;
  activeFilter: { type: string; value: string } | null;
  onClearFilter: () => void;
  onOpenDiscussion: (partnerId: string) => void;
  onViewProfile?: (userId: string) => void;
}

type SortOption = 'trending' | 'reads' | 'rating' | 'newest' | 'comments';

// Normalise une chaîne pour une recherche tolérante : minuscules + suppression
// des accents/diacritiques (« Éveil » devient « eveil »), afin que « eveil »
// trouve « Éveil » et que « alice » trouve « Alice ».
const normalizeText = (value: string) =>
  (value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');

interface SavedFilter {
  id: string;
  name: string;
  query: string;
  genre: string;
  sortBy: SortOption;
}

const ALL_SPEC_GENRES = [
  'Science-Fiction',
  'Fantasy',
  'Romance',
  'Thriller & Policier',
  'Horreur',
  'Mystère',
  'Action & Aventure',
  'Historique',
  'Humour',
  'Développement personnel'
];

export default function ExplorerView({
  stories,
  users,
  onSelectStory,
  activeFilter,
  onClearFilter,
  onOpenDiscussion,
  onViewProfile
}: ExplorerViewProps) {
  
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedGenre, setSelectedGenre] = useState<string>('Tous');
  const [sortBy, setSortBy] = useState<SortOption>('trending');
  
  // Saved filters state
  const defaultSavedFilters: SavedFilter[] = [
    { id: '1', name: 'SF Neuve', query: '', genre: 'Science-Fiction', sortBy: 'newest' },
    { id: '2', name: 'Populaires', query: '', genre: 'Tous', sortBy: 'reads' }
  ];
  const [savedFilters, setSavedFilters] = useState<SavedFilter[]>(() => {
    try {
      const saved = localStorage.getItem('plume_saved_explorer_filters');
      return saved ? JSON.parse(saved) : defaultSavedFilters;
    } catch {
      return defaultSavedFilters;
    }
  });
  
  const [filterNameInput, setFilterNameInput] = useState('');
  const [showSaveDialog, setShowSaveDialog] = useState(false);

  // Author modal state
  const [viewedAuthor, setViewedAuthor] = useState<Story | null>(null);

  // Syncer saved filters to storage
  useEffect(() => {
    localStorage.setItem('plume_saved_explorer_filters', JSON.stringify(savedFilters));
  }, [savedFilters]);

  // Hook preset filter selection
  useEffect(() => {
    if (activeFilter) {
      if (activeFilter.type === 'genre') {
        setSelectedGenre(activeFilter.value);
      }
    }
  }, [activeFilter]);

  // Handle Save filter
  const handleSaveFilter = (e: React.FormEvent) => {
    e.preventDefault();
    if (!filterNameInput.trim()) return;

    const newFilter: SavedFilter = {
      id: `filter_${Date.now()}`,
      name: filterNameInput.trim(),
      query: searchQuery,
      genre: selectedGenre,
      sortBy: sortBy
    };

    setSavedFilters([...savedFilters, newFilter]);
    setFilterNameInput('');
    setShowSaveDialog(false);
    alert('Filtre sauvegardé avec succès ! Retrouvez-le en tête de page.');
  };

  const handleApplySavedFilter = (filter: SavedFilter) => {
    setSearchQuery(filter.query);
    setSelectedGenre(filter.genre);
    setSortBy(filter.sortBy);
  };

  const handleDeleteSavedFilter = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSavedFilters(savedFilters.filter(f => f.id !== id));
  };

  // Filter criteria application
  const filteredStories = stories.filter((story) => {
    if (story.isFlagged) return false;
    if (story.status !== 'Publié') return false;

    // Search query check (title, author, tags, description), insensible à la
    // casse ET aux accents.
    const textQuery = normalizeText(searchQuery.trim());
    if (textQuery) {
      const matchTitle = normalizeText(story.title).includes(textQuery);
      const matchAuthor = normalizeText(story.authorName).includes(textQuery);
      const matchDesc = normalizeText(story.description).includes(textQuery);
      const matchTags = story.tags.some(t => normalizeText(t).includes(textQuery));
      const matchGenre = normalizeText(story.genre).includes(textQuery);
      if (!matchTitle && !matchAuthor && !matchDesc && !matchTags && !matchGenre) {
        return false;
      }
    }

    // Genre selector check
    if (selectedGenre !== 'Tous') {
      const gNorm = selectedGenre.toLowerCase();
      const stNorm = story.genre.toLowerCase();
      if (!stNorm.includes(gNorm) && !gNorm.includes(stNorm)) return false;
    }

    // Lateral parent filter sync
    if (activeFilter && selectedGenre === 'Tous') {
      const { type, value } = activeFilter;
      if (type === 'genre' && !story.genre.toLowerCase().includes(value.toLowerCase())) return false;
      if (type === 'category' && story.category !== value) return false;
      if (type === 'ambiance' && story.ambiance !== value) return false;
      if (type === 'format' && story.format !== value) return false;
    }

    return true;
  });

  // Apply Sorting
  const sortedStories = [...filteredStories].sort((a, b) => {
    if (sortBy === 'reads') {
      return b.reads - a.reads;
    }
    if (sortBy === 'rating') {
      return b.rating - a.rating;
    }
    if (sortBy === 'newest') {
      return new Date(b.publishDate).getTime() - new Date(a.publishDate).getTime();
    }
    if (sortBy === 'comments') {
      // Sort by simulated or real chapters / comments count
      const countA = a.chapters.length * 4 + a.likes + a.id.charCodeAt(0);
      const countB = b.chapters.length * 4 + b.likes + b.id.charCodeAt(0);
      return countB - countA;
    }
    // Default 'trending'
    return (b.rating * b.reads) - (a.rating * a.reads);
  });

  // Profils correspondants : on ne les affiche que lorsqu'une recherche texte
  // est saisie (sinon on listerait tout le monde). Recherche sur le pseudo, la
  // bio et les genres favoris, insensible à la casse et aux accents.
  const profileQuery = normalizeText(searchQuery.trim());
  const matchedUsers = profileQuery
    ? (users || []).filter((u) => {
        if (u.isFlagged) return false;
        if (normalizeText(u.username).includes(profileQuery)) return true;
        if (u.bio && normalizeText(u.bio).includes(profileQuery)) return true;
        return (u.favoriteGenres || []).some((g) => normalizeText(g).includes(profileQuery));
      }).slice(0, 12)
    : [];

  return (
    <div className="max-w-xl mx-auto px-4 py-6 space-y-6 animate-fade-in text-left select-none pb-32">
      
      {/* 1. Header Banner */}
      <div className="pb-4 border-b border-gray-100 dark:border-purple-900/15">
        <h2 className="font-sans font-black text-lg tracking-tight text-gray-950 dark:text-white flex items-center space-x-2">
          <BookOpen className="w-5 h-5 text-purple-600" />
          <span>Explorer l'Archipel</span>
        </h2>
        <p className="text-[11px] text-gray-400 mt-1">
          Barre de recherche intelligente, genres précis et sauvegarde de filtres.
        </p>
      </div>

      {/* 2. Saved filters row */}
      {savedFilters.length > 0 && (
        <div className="space-y-2">
          <span className="text-[9px] font-black uppercase text-[#7C3AED] dark:text-purple-400 tracking-wider">Mes filtres sauvegardés</span>
          <div className="flex flex-wrap gap-1.5">
            {savedFilters.map((f) => (
              <span 
                key={f.id} 
                onClick={() => handleApplySavedFilter(f)}
                className="inline-flex items-center space-x-1 px-3 py-1.5 bg-purple-500/10 hover:bg-purple-500/15 border border-purple-500/20 text-purple-600 dark:text-purple-300 rounded-xl text-[10px] font-bold cursor-pointer transition-all"
              >
                <Bookmark className="w-3 h-3 fill-purple-600/10" />
                <span>{f.name}</span>
                <button
                  id={`del-saved-filter-${f.id}`}
                  onClick={(e) => handleDeleteSavedFilter(f.id, e)}
                  className="p-0.5 rounded-full hover:bg-purple-500/20 text-purple-600 hover:text-purple-400 ml-1 font-bold"
                  title="Supprimer ce filtre"
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* 3. Search block */}
      <div className="space-y-3 bg-gray-50 dark:bg-[#0E0E14] border border-gray-150 dark:border-purple-900/20 p-4 rounded-2xl shadow-sm">
        
        {/* Search input bar */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            id="explorer-search-field"
            type="text"
            placeholder="Rechercher un titre, un profil, un mot-clé, un tag..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-white dark:bg-black border border-gray-150 dark:border-purple-900/25 rounded-xl pl-9 pr-8 py-2.5 text-xs focus:outline-none focus:ring-1 focus:ring-purple-600 text-gray-900 dark:text-white"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5 rounded-full hover:bg-gray-150 text-gray-400"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Dropdown selectors for exact Genres */}
        <div className="flex items-center gap-2 pt-1 pb-1">
          <div className="flex-1 min-w-0">
            <label className="block text-[10px] font-black uppercase text-gray-400 mb-1 font-sans">Genre littéraire</label>
            <select
              id="explorer-genre-dropdown"
              value={selectedGenre}
              onChange={(e) => setSelectedGenre(e.target.value)}
              className="w-full bg-white dark:bg-black border border-gray-150 dark:border-purple-900/25 text-[11px] rounded-xl px-2.5 py-1.5 focus:outline-none text-gray-800 dark:text-gray-100"
            >
              <option value="Tous">Tous les genres</option>
              {ALL_SPEC_GENRES.map(g => <option key={g} value={g}>{g}</option>)}
            </select>
          </div>

          <div className="flex-1 min-w-0">
            <label className="block text-[10px] font-black uppercase text-gray-400 mb-1 font-sans">Trier l'ordre</label>
            <select
              id="explorer-sort-dropdown"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortOption)}
              className="w-full bg-white dark:bg-black border border-gray-150 dark:border-purple-900/25 text-[11px] rounded-xl px-2.5 py-1.5 focus:outline-none text-gray-800 dark:text-gray-100"
            >
              <option value="trending">Tendances</option>
              <option value="reads">Plus populaires</option>
              <option value="rating">Mieux notées</option>
              <option value="newest">Plus récentes</option>
              <option value="comments">Plus commentées</option>
            </select>
          </div>
        </div>

        {/* Actions row: Save filter button */}
        <div className="pt-2 border-t border-gray-100 dark:border-zinc-850/50 flex justify-between items-center">
          <span className="text-[10px] font-mono text-gray-400">
            {filteredStories.length} résultats filtrés
          </span>
          
          {!showSaveDialog ? (
            <button
              id="show-save-filter-btn"
              onClick={() => setShowSaveDialog(true)}
              className="px-3 py-1 bg-white hover:bg-gray-100 dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-lg text-[10px] font-black uppercase tracking-wider text-gray-600 dark:text-gray-300 flex items-center space-x-1 transition"
            >
              <BookmarkCheck className="w-3.5 h-3.5" />
              <span>Sauvegarder ce filtre</span>
            </button>
          ) : (
            <form onSubmit={handleSaveFilter} className="flex items-center space-x-1.5 w-full max-w-xs justify-end">
              <input
                id="save-filter-input"
                type="text"
                placeholder="Nom (Ex. Thrillers Sombre)"
                value={filterNameInput}
                onChange={(e) => setFilterNameInput(e.target.value)}
                className="bg-white dark:bg-zinc-950 border border-gray-200 dark:border-zinc-800 text-[10px] rounded p-1.5 focus:outline-none w-36 dark:text-white"
                required
              />
              <button
                type="submit"
                id="save-filter-submit"
                className="bg-purple-600 hover:bg-purple-700 text-white rounded px-2 py-1.5 text-[10px] font-bold"
              >
                Ok
              </button>
              <button
                type="button"
                id="save-filter-cancel"
                onClick={() => setShowSaveDialog(false)}
                className="text-gray-400 font-bold px-1.5 hover:text-purple-600 text-sm"
              >
                ×
              </button>
            </form>
          )}
        </div>

      </div>

      {/* 3.5 Matching profiles (only when a text search is active) */}
      {matchedUsers.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-1.5 px-1">
            <UserCheck className="w-3.5 h-3.5 text-purple-500" />
            <h3 className="text-[11px] font-black uppercase tracking-wider text-gray-500 dark:text-gray-400">
              Profils ({matchedUsers.length})
            </h3>
          </div>
          <div className="space-y-2">
            {matchedUsers.map((u) => (
              <div
                key={u.id}
                id={`search-profile-${u.id}`}
                onClick={() => onViewProfile?.(u.id)}
                className="flex items-center gap-3 bg-gray-50 dark:bg-[#0E0E14] rounded-2xl border border-gray-150/50 dark:border-purple-900/15 p-2.5 hover:shadow-md transition cursor-pointer"
              >
                <img
                  src={optimizedImage(u.avatar, 64, { square: true })}
                  alt={u.username}
                  className="w-10 h-10 rounded-full object-cover bg-zinc-200 dark:bg-zinc-800 flex-shrink-0"
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1">
                    <span className="text-xs font-bold text-gray-900 dark:text-white truncate">{u.username}</span>
                    {u.isVerified && <VerifiedBadge size="xs" className="flex-shrink-0" />}
                  </div>
                  <p className="text-[11px] text-gray-400 truncate">{u.bio || displayRole(u.role)}</p>
                </div>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onOpenDiscussion(u.id);
                  }}
                  className="flex-shrink-0 p-2 rounded-full text-purple-600 hover:bg-purple-50 dark:hover:bg-purple-900/20 transition"
                  title="Envoyer un message"
                >
                  <MessageCircle className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 4. Results List / Grid */}
      {sortedStories.length === 0 && matchedUsers.length === 0 ? (
        <div className="py-16 text-center bg-gray-50/50 dark:bg-[#0E0E14] border border-gray-150/40 dark:border-purple-900/15 rounded-2xl">
          <SlidersHorizontal className="w-10 h-10 mx-auto text-purple-400 stroke-1" />
          <h4 className="font-bold text-xs text-gray-700 dark:text-gray-300 mt-2">Aucun résultat trouvé</h4>
          <p className="text-[11px] text-gray-400 mt-1 max-w-xs mx-auto text-center">
            Modifiez la recherche, changez de genre ou désactivez les filtres pour découvrir de nouvelles œuvres.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 pb-8">
          {sortedStories.map((story) => (
            <div
              key={story.id}
              id={`search-story-${story.id}`}
              className="bg-gray-50 dark:bg-[#0E0E14] rounded-2xl border border-gray-150/50 dark:border-purple-900/15 overflow-hidden flex flex-col justify-between hover:shadow-md transition-all group"
            >
              {/* Aspect 2:3 Cover container with responsive tags */}
              <div 
                onClick={() => onSelectStory(story)}
                className="relative aspect-[2/3] w-full bg-zinc-100 dark:bg-zinc-900 cursor-pointer overflow-hidden"
              >
                <img 
                  src={optimizedImage(story.cover, 240)} 
                  alt={story.title} 
                  className="w-full h-full object-cover group-hover:scale-[1.01] transition-transform" 
                  referrerPolicy="no-referrer"
                />

                {/* Floating genre pill */}
                <div className="absolute top-2 left-2">
                  <span className="text-[8px] px-2 py-0.5 font-bold uppercase rounded-md bg-purple-600 text-white text-center shadow-sm">
                    {story.genre.split(' ')[0]}
                  </span>
                </div>

                {story.ageRating && story.ageRating !== 'all' && (
                  <div className="absolute top-2 right-2">
                    <span className="text-[8px] px-2 py-0.5 font-black uppercase rounded-md bg-purple-950/90 text-white text-center shadow-sm border border-purple-500/25">
                      {story.ageRating}+
                    </span>
                  </div>
                )}

                {/* Cover dark overlay */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-transparent to-transparent opacity-90" />

                {/* Statistics Overlay at cover bottom */}
                <div className="absolute bottom-2 left-2 right-2 text-left text-white flex items-center justify-between font-mono text-[9px]">
                  <span className="flex items-center space-x-0.5">
                    <Eye className="w-3 h-3 text-gray-300" />
                    <span>{story.reads}</span>
                  </span>
                  <span className="flex items-center space-x-0.5">
                    <Heart className="w-3 h-3 text-purple-500 fill-purple-500" />
                    <span>{story.likes}</span>
                  </span>
                  <span className="flex items-center space-x-0.5">
                    <MessageCircle className="w-3 h-3 text-purple-400 fill-transparent" />
                    <span>{story.chapters.length * 3 + (story.likes % 4)}</span>
                  </span>
                </div>
              </div>

              {/* Title & Author Info Section */}
              <div className="p-3 text-left space-y-1">
                <h4 
                  onClick={() => onSelectStory(story)}
                  className="font-serif font-black text-xs text-gray-900 dark:text-white line-clamp-1 hover:text-purple-600 hover:underline cursor-pointer"
                >
                  {story.title}
                </h4>
                
                {/* Author consultation clickable button (Satisfies: Consulter un auteur) */}
                <div className="flex items-center space-x-1.5 w-fit">
                  <img 
                    src={optimizedImage(story.authorAvatar, 48, { square: true })} 
                    alt={story.authorName} 
                    onClick={() => setViewedAuthor(story)}
                    className="w-4 h-4 rounded-full object-cover ring-1 ring-purple-600/20 cursor-pointer hover:scale-110 transition-transform" 
                    referrerPolicy="no-referrer"
                    title="Consulter cet auteur"
                  />
                  <span 
                    onClick={() => {
                      if (onViewProfile) {
                        onViewProfile(story.authorId);
                      } else {
                        onOpenDiscussion(story.authorId);
                      }
                    }}
                    className="text-[10px] text-gray-400 line-clamp-1 italic hover:text-[#7C3AED] hover:underline cursor-pointer transition-colors font-semibold"
                    title="Consulter le profil de l'auteur"
                  >
                    Par {story.authorName}
                  </span>
                </div>
              </div>

            </div>
          ))}
        </div>
      )}

      {/* AUTHOR INFOS OVERLAY MODAL */}
      {viewedAuthor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center animate-fade-in select-none">
          <div 
            className="absolute inset-0 bg-black/60 backdrop-blur-xs" 
            onClick={() => setViewedAuthor(null)} 
          />

          <div className="relative w-full max-w-xs bg-white dark:bg-black rounded-2xl border border-gray-150 dark:border-purple-900/25 shadow-2xl animate-scale-up p-5 text-center space-y-4">
            <button 
              id="close-author-modal"
              onClick={() => setViewedAuthor(null)}
              className="absolute top-2.5 right-2.5 p-1 rounded-full hover:bg-gray-100 dark:hover:bg-zinc-900 text-gray-400"
            >
              <X className="w-4 h-4" />
            </button>

            <img 
              src={optimizedImage(viewedAuthor.authorAvatar, 96, { square: true })} 
              alt={viewedAuthor.authorName} 
              className="w-16 h-16 rounded-full object-cover ring-4 ring-purple-600/10 mx-auto"
              referrerPolicy="no-referrer"
            />

            <div>
              <h3 className="font-sans font-black text-sm text-gray-950 dark:text-white flex items-center justify-center space-x-1">
                <span>{viewedAuthor.authorName}</span>
                {viewedAuthor.authorVerified && <VerifiedBadge size="sm" />}
              </h3>
              <span className="text-[10px] py-0.5 px-2 rounded bg-purple-500/10 text-purple-600 font-bold inline-block uppercase mt-1">Auteur Plume</span>
            </div>

            <p className="text-xs text-gray-500 dark:text-gray-400 leading-normal italic">
              « Créateur et écrivain fantastique des mots d'autrefois et d'aujourd'hui. Écrit principalement du {viewedAuthor.genre}. »
            </p>

            <div className="pt-2 border-t border-gray-100 dark:border-zinc-900 flex justify-center space-x-2">
              {onViewProfile && (
                <button
                  id="view-profile-btn"
                  onClick={() => {
                    onViewProfile(viewedAuthor.authorId);
                    setViewedAuthor(null);
                  }}
                  className="px-3.5 py-2 bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-900 dark:hover:bg-zinc-850 text-gray-850 dark:text-zinc-200 text-[10px] font-black uppercase tracking-wider rounded-xl transition duration-150 border border-transparent dark:border-purple-900/10"
                >
                  Profil
                </button>
              )}
              <button
                id="author-dialog-msg-btn"
                onClick={() => {
                  onOpenDiscussion(viewedAuthor.authorId);
                  setViewedAuthor(null);
                }}
                className="px-3.5 py-2 bg-purple-600 hover:bg-purple-700 text-white text-[10px] font-black uppercase tracking-wider rounded-xl transition duration-150 shadow-md shadow-purple-500/10"
              >
                Message
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
