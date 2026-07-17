/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import Cropper from 'react-easy-crop';
import type { Area } from 'react-easy-crop';
import { 
  Plus, 
  BookOpen, 
  BarChart3, 
  Eye, 
  Check, 
  Edit, 
  Trash2, 
  FileText, 
  Sparkles, 
  ChevronRight, 
  Save, 
  Power, 
  LayoutGrid, 
  Megaphone,
  BookMarked,
  Tags,
  Compass,
  CornerDownRight,
  PenTool,
  Heart,
  Users,
  MoreVertical,
  Image as ImageIcon
} from 'lucide-react';
import { Story, Chapter, User, Comment } from '../types';
import ImmersiveEditor from './ImmersiveEditor';
import { GENRES, CATEGORIES, AMBIANCES, FORMATS, LANGUAGES } from '../data';
import { uploadImageToCloudinary } from '../utils/uploadImage';
import { generateCoverDataUri } from '../utils/coverImage';
import { useAndroidBack } from '../utils/backButton';
import { authHeaders } from '../utils/auth';
import { fileToHtml, splitIntoChapters, type ImportedChapter } from '../utils/importDocument';


const createImage = (url: string): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const image = new Image();
    image.addEventListener('load', () => resolve(image));
    image.addEventListener('error', (error) => reject(error));
    image.src = url;
  });

const getCroppedImageFile = async (
  imageSrc: string,
  pixelCrop: Area,
  fileName = 'cover.jpg'
): Promise<File> => {
  const image = await createImage(imageSrc);
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');

  if (!context) {
    throw new Error("Impossible de préparer l'image rognée.");
  }

  canvas.width = pixelCrop.width;
  canvas.height = pixelCrop.height;

  context.drawImage(
    image,
    pixelCrop.x,
    pixelCrop.y,
    pixelCrop.width,
    pixelCrop.height,
    0,
    0,
    pixelCrop.width,
    pixelCrop.height
  );

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error("Impossible de rogner l'image."));
        return;
      }

      resolve(new File([blob], fileName, { type: 'image/jpeg' }));
    }, 'image/jpeg', 0.92);
  });
};

interface WriteViewProps {
  currentUser: User;
  userStories: Story[];
  onCreateStory: (storyData: Partial<Story>) => void;
  onUpdateStory: (storyId: string, updatedStory: Partial<Story>) => void;
  onAddChapter: (storyId: string, chapterData: Partial<Chapter>) => Chapter | void;
  onUpdateChapter: (storyId: string, chapterId: string, updatedChapter: Partial<Chapter>) => void;
  onDeleteChapter: (storyId: string, chapterId: string) => void;
  onDeleteStory: (storyId: string) => void;
  onCreateTome: (storyId: string, title: string) => void;
  onRenameTome: (storyId: string, tomeId: string, title: string) => void;
  onDeleteTome: (storyId: string, tomeId: string) => void;
  onImportChapters: (storyId: string, chapters: { title: string; content: string }[], tomeId?: string | null) => Promise<number>;
  comments: Comment[];
}

type TabType = 'my-books' | 'performance-dashboard';

export default function WriteView({
  currentUser,
  userStories,
  onCreateStory,
  onUpdateStory,
  onAddChapter,
  onUpdateChapter,
  onDeleteChapter,
  onDeleteStory,
  onCreateTome,
  onRenameTome,
  onDeleteTome,
  onImportChapters,
  comments
}: WriteViewProps) {
  const [activeSubTab, setActiveSubTab] = useState<TabType>('my-books');
  const [isCreatingStory, setIsCreatingStory] = useState(false);
  const [selectedStoryToEdit, setSelectedStoryToEdit] = useState<Story | null>(null);
  const [managingStoryChapters, setManagingStoryChapters] = useState<Story | null>(null);
  const [expandedMenuStoryId, setExpandedMenuStoryId] = useState<string | null>(null);
  const [storyToDelete, setStoryToDelete] = useState<Story | null>(null);
  
  // Create / Edit Story Form fields
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [genre, setGenre] = useState(GENRES[0]);
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [ambiance, setAmbiance] = useState(AMBIANCES[0]);
  const [format, setFormat] = useState(FORMATS[0]);
  const [language, setLanguage] = useState(LANGUAGES[0]);
  const [tagsInput, setTagsInput] = useState('');
  const [ageRating, setAgeRating] = useState<'all' | '12' | '16' | '18'>('all');
  const [coverImage, setCoverImage] = useState('');
  const [coverImageSrc, setCoverImageSrc] = useState<string | null>(null);
  const [coverFileName, setCoverFileName] = useState('cover.jpg');
  const [coverCrop, setCoverCrop] = useState({ x: 0, y: 0 });
  const [coverZoom, setCoverZoom] = useState(1);
  const [croppedCoverPixels, setCroppedCoverPixels] = useState<Area | null>(null);
  const [isUploadingCover, setIsUploadingCover] = useState(false);

  // Chapter editing screen (l'éditeur immersif gère titre/contenu en interne).
  const [editingChapterInStory, setEditingChapterInStory] = useState<{ story: Story; chapter: Chapter | null } | null>(null);

  // Bouton retour Android : ferme la surcouche la plus haute de CETTE vue au
  // lieu de renvoyer brutalement à l'accueil (voire de quitter l'app).
  useAndroidBack(() => {
    if (editingChapterInStory) return false; // l'éditeur immersif gère son propre retour
    if (coverImageSrc) { setCoverImageSrc(null); return true; } // modal de rognage
    if (storyToDelete) { setStoryToDelete(null); return true; } // modal de suppression
    if (expandedMenuStoryId) { setExpandedMenuStoryId(null); return true; }
    if (managingStoryChapters) { setManagingStoryChapters(null); return true; }
    if (isCreatingStory || selectedStoryToEdit) {
      // On FERME sans vider le formulaire : un retour accidentel ne détruit pas
      // ce qui a été saisi (rouvrir « Créer » retrouve les champs).
      setIsCreatingStory(false);
      setSelectedStoryToEdit(null);
      return true;
    }
    return false;
  });

  // Statistiques SERVEUR par chapitre (lectures complètes via ChapterRead +
  // taux de complétion) — chargées à l'ouverture de l'onglet Statistiques.
  interface AuthorStatsChapter { id: string; title: string; order: number; opens: number; fullReads: number }
  interface AuthorStatsStory { id: string; title: string; status: string; views: number; readers: number; completion: number; chapters: AuthorStatsChapter[] }
  const [authorStats, setAuthorStats] = useState<AuthorStatsStory[] | null>(null);
  // Saisie du titre d'un nouveau tome (atelier). Fermé par défaut : l'auteur
  // n'y touche que s'il veut structurer son œuvre en volumes.
  const [showTomeInput, setShowTomeInput] = useState(false);
  const [tomeTitleInput, setTomeTitleInput] = useState('');

  // Import d'un document déjà écrit (Word/texte) vers des chapitres.
  const importInputRef = useRef<HTMLInputElement>(null);
  const [importState, setImportState] = useState<'idle' | 'parsing' | 'saving'>('idle');
  const [importError, setImportError] = useState<string | null>(null);
  const [importPreview, setImportPreview] = useState<{ fileName: string; html: string; split: ImportedChapter[] } | null>(null);
  // Tome cible de l'import ('' = hors tome). Réinitialisé à chaque nouvel import.
  const [importTomeId, setImportTomeId] = useState<string>('');

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // permet de ré-importer le même fichier
    if (!file) return;
    if (file.size > 15 * 1024 * 1024) { setImportError('Fichier trop lourd (15 Mo maximum).'); return; }
    setImportError(null);
    setImportState('parsing');
    try {
      const html = await fileToHtml(file);
      const split = splitIntoChapters(html);
      const baseName = file.name.replace(/\.[^.]+$/, '').slice(0, 200);
      setImportTomeId('');
      setImportPreview({ fileName: baseName, html, split });
    } catch (err: any) {
      setImportError(err?.message || "Impossible de lire ce fichier.");
    } finally {
      setImportState('idle');
    }
  };

  const runImport = async (chapters: { title: string; content: string }[], storyId: string) => {
    setImportState('saving');
    try {
      const n = await onImportChapters(storyId, chapters, importTomeId || null);
      setImportPreview(null);
      if (n > 0) {
        setImportError(null);
        alert(n > 1 ? `${n} chapitres importés en brouillon. Relis-les puis publie-les.` : 'Chapitre importé en brouillon. Relis-le puis publie-le.');
      } else {
        setImportError("L'import a échoué (aucun chapitre créé).");
      }
    } finally {
      setImportState('idle');
    }
  };
  useEffect(() => {
    if (activeSubTab !== 'performance-dashboard') return;
    let cancelled = false;
    fetch('/api/me/author-stats', { headers: authHeaders() })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (!cancelled && d && Array.isArray(d.stories)) setAuthorStats(d.stories); })
      .catch(() => { /* hors-ligne : la section serveur reste masquée */ });
    return () => { cancelled = true; };
  }, [activeSubTab]);

  const resetStoryForm = () => {
    setTitle('');
    setDescription('');
    setGenre(GENRES[0]);
    setCategory(CATEGORIES[0]);
    setAmbiance(AMBIANCES[0]);
    setFormat(FORMATS[0]);
    setLanguage(LANGUAGES[0]);
    setTagsInput('');
    setAgeRating('all');
    setCoverImage('');
    setIsCreatingStory(false);
    setSelectedStoryToEdit(null);
  };

  const handleOpenEditStory = (story: Story) => {
    setSelectedStoryToEdit(story);
    setTitle(story.title);
    setDescription(story.description);
    setGenre(story.genre);
    setCategory(story.category || CATEGORIES[0]);
    setAmbiance(story.ambiance || AMBIANCES[0]);
    setFormat(story.format || FORMATS[0]);
    setLanguage(story.language || LANGUAGES[0]);
    setTagsInput(story.tags.join(', '));
    setAgeRating(story.ageRating || 'all');
    setCoverImage(story.cover || '');
    setIsCreatingStory(true);
  };


  const handleCoverUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';

    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert('Veuillez sélectionner une image.');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      alert("L'image ne doit pas dépasser 5 Mo.");
      return;
    }

    const imagePreviewUrl = URL.createObjectURL(file);

    setCoverImageSrc(imagePreviewUrl);
    setCoverFileName(file.name || 'cover.jpg');
    setCoverCrop({ x: 0, y: 0 });
    setCoverZoom(1);
    setCroppedCoverPixels(null);
  };

  const handleCancelCoverCrop = () => {
    if (coverImageSrc) {
      URL.revokeObjectURL(coverImageSrc);
    }

    setCoverImageSrc(null);
    setCoverFileName('cover.jpg');
    setCoverCrop({ x: 0, y: 0 });
    setCoverZoom(1);
    setCroppedCoverPixels(null);
  };

  const handleConfirmCoverCrop = async () => {
    if (!coverImageSrc || !croppedCoverPixels) return;

    try {
      setIsUploadingCover(true);

      const croppedFile = await getCroppedImageFile(
        coverImageSrc,
        croppedCoverPixels,
        coverFileName
      );

      const imageUrl = await uploadImageToCloudinary(croppedFile);
      setCoverImage(imageUrl);
      handleCancelCoverCrop();
    } catch (error: any) {
      console.error('[PLUME] Erreur upload couverture Cloudinary:', error);
      alert(error?.message || "Impossible d'envoyer la couverture. Réessayez.");
    } finally {
      setIsUploadingCover(false);
    }
  };

  const handleRemoveCover = () => {
    setCoverImage('');
  };

  const handleCreateStorySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !description.trim()) return;

    const tagsArray = tagsInput.split(',').map(t => t.trim()).filter(Boolean);

    if (selectedStoryToEdit) {
      onUpdateStory(selectedStoryToEdit.id, {
        title,
        description,
        genre,
        category,
        ambiance,
        format,
        language,
        tags: tagsArray,
        ageRating,
        cover: coverImage || selectedStoryToEdit.cover
      });
    } else {
      // Couverture par défaut GÉNÉRÉE localement (titre + dégradé) plutôt qu'une
      // image aléatoire externe (picsum) qui pouvait ne pas charger.
      const finalCover = coverImage || generateCoverDataUri(title);
      const newStoryId = `story_${Date.now()}`;
      const newStory: Story = {
        id: newStoryId,
        title,
        description,
        authorId: currentUser.id,
        authorName: currentUser.username,
        authorAvatar: currentUser.avatar,
        authorVerified: currentUser.isVerified,
        cover: finalCover,
        genre,
        category,
        ambiance,
        format,
        language,
        likes: 0,
        favoritesCount: 0,
        views: 0,
        reads: 0,
        rating: 0,
        isFlagged: false,
        chapters: [],
        ageRating,
        status: 'Brouillon',
        publishDate: new Date().toISOString().split('T')[0],
        tags: tagsArray
      };

      onCreateStory(newStory);

      // Clean creator values so they are fresh for any future session
      setTitle('');
      setDescription('');
      setGenre(GENRES[0]);
      setCategory(CATEGORIES[0]);
      setAmbiance(AMBIANCES[0]);
      setFormat(FORMATS[0]);
      setLanguage(LANGUAGES[0]);
      setTagsInput('');
      setAgeRating('all');
      setCoverImage('');
      setIsCreatingStory(false);
      setSelectedStoryToEdit(null);

      // Instantly open chapter creator with the newly generated story
      handleOpenChapterEditor(newStory, null);
      return; // bypass automatic resetStoryForm at the end
    }

    resetStoryForm();
  };

  // Ouvre l'éditeur immersif (qui gère lui-même titre/contenu + auto-sauvegarde).
  const handleOpenChapterEditor = (story: Story, chapterToEdit: Chapter | null) => {
    setEditingChapterInStory({ story, chapter: chapterToEdit });
  };

  // Toggle book state Publié vs Brouillon
  const handleToggleStoryPublish = (story: Story) => {
    const isCurrentlyPublished = story.status === 'Publié';
    onUpdateStory(story.id, {
      status: isCurrentlyPublished ? 'Brouillon' : 'Publié'
    });
  };

  // Calculating Author Aggregated metrics
  const totalViews = userStories.reduce((acc, current) => acc + current.views, 0);
  const totalReads = userStories.reduce((acc, current) => acc + current.reads, 0);
  const totalLikes = userStories.reduce((acc, current) => acc + current.likes, 0);
  const readRatio = totalViews > 0 ? Math.round((totalReads / totalViews) * 100) : 0;
  
  // Retrieve comments specifically for this author's books
  const myBookIds = userStories.map(s => s.id);
  const authorWorkComments = comments.filter(c => myBookIds.includes(c.storyId));

  // Libellé lisible du chapitre/œuvre concerné par un commentaire (au lieu de
  // l'ID brut du chapitre).
  const commentLocationLabel = (c: Comment): string => {
    const story = userStories.find(s => s.id === c.storyId);
    if (!story) return 'Œuvre';
    const idx = story.chapters.findIndex(ch => ch.id === c.chapterId);
    if (idx >= 0) {
      const t = story.chapters[idx].title?.trim();
      return t ? `Chapitre ${idx + 1} · ${t}` : `Chapitre ${idx + 1}`;
    }
    return story.title;
  };

  // Auto-find latest version for live updates
  const currentStoryToManage = userStories.find(s => s.id === managingStoryChapters?.id);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {coverImageSrc && (
        <div className="fixed inset-0 z-[120] bg-black/85 backdrop-blur-sm flex items-center justify-center p-4 font-sans">
          <div className="w-full max-w-md bg-white dark:bg-[#0E0E14] rounded-3xl border border-purple-500/20 shadow-2xl overflow-hidden animate-scale-up">
            <div className="px-5 py-4 border-b border-zinc-150 dark:border-zinc-850">
              <h3 className="font-serif font-black text-sm text-zinc-900 dark:text-white">
                Rogner la couverture
              </h3>
              <p className="text-[10px] text-zinc-400 mt-1">
                Ajustez l'image au format couverture verticale avant de valider.
              </p>
            </div>

            <div className="relative h-[520px] max-h-[65vh] bg-black">
              <Cropper
                image={coverImageSrc}
                crop={coverCrop}
                zoom={coverZoom}
                aspect={2 / 3}
                cropShape="rect"
                showGrid={true}
                onCropChange={setCoverCrop}
                onZoomChange={setCoverZoom}
                onCropComplete={(_, croppedAreaPixels) => setCroppedCoverPixels(croppedAreaPixels)}
              />
            </div>

            <div className="p-5 space-y-4">
              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase tracking-wider text-zinc-400">
                  Zoom
                </label>
                <input
                  type="range"
                  min={1}
                  max={3}
                  step={0.1}
                  value={coverZoom}
                  onChange={(e) => setCoverZoom(Number(e.target.value))}
                  className="w-full accent-purple-600"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={handleCancelCoverCrop}
                  disabled={isUploadingCover}
                  className="py-2.5 rounded-xl bg-zinc-100 dark:bg-zinc-850 text-zinc-700 dark:text-zinc-200 text-[10px] font-black uppercase tracking-wider hover:bg-zinc-200 dark:hover:bg-zinc-800 transition disabled:opacity-50"
                >
                  Annuler
                </button>

                <button
                  type="button"
                  onClick={handleConfirmCoverCrop}
                  disabled={isUploadingCover}
                  className="py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-[10px] font-black uppercase tracking-wider transition disabled:opacity-50"
                >
                  {isUploadingCover ? 'Envoi...' : 'Valider'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Chapter editor overlay layout */}
      {editingChapterInStory ? (
        (() => {
          const freshStory = userStories.find((s) => s.id === editingChapterInStory.story.id) || editingChapterInStory.story;
          return (
            <ImmersiveEditor
              key={editingChapterInStory.chapter?.id || 'new'}
              story={freshStory}
              chapter={editingChapterInStory.chapter}
              fontFamily={currentUser.readingFontFamily}
              fontSize={currentUser.readingFontSize}
              onPersistNew={(data) => onAddChapter(editingChapterInStory.story.id, data)}
              onPersistUpdate={(chId, data) => onUpdateChapter(editingChapterInStory.story.id, chId, data)}
              onDelete={(chId) => onDeleteChapter(editingChapterInStory.story.id, chId)}
              onClose={() => setEditingChapterInStory(null)}
              onSwitchChapter={(target) => setEditingChapterInStory({ story: freshStory, chapter: target === 'new' ? null : target })}
            />
          );
        })()
      ) : isCreatingStory ? (
        /* Create or Edit Book / Story Panel overlay screen */
        <div className="bg-white dark:bg-[#0E0E14] border border-[#ecebf6] dark:border-purple-900/20 rounded-2xl p-6 md:p-8 max-w-2xl mx-auto shadow-xl text-left animation-fade-in">
          <div className="border-b border-gray-100 dark:border-gray-800 pb-4 mb-6">
            <h2 className="text-xl font-bold text-gray-850 dark:text-[#F5F5F5] font-sans flex items-center space-x-2">
              <BookOpen className="w-5 h-5 text-purple-600" />
              <span>{selectedStoryToEdit ? "Modifier le projet littéraire" : "Créer un nouveau projet littéraire"}</span>
            </h2>
            <p className="text-xs text-gray-400 mt-1">
              {selectedStoryToEdit ? "Modifiez les caractéristiques fondamentales et le synopsis de votre œuvre." : "Configurez les caractéristiques fondamentales de votre œuvre avant de coucher vos chapitres."}
            </p>
          </div>

          <form onSubmit={handleCreateStorySubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-bold tag uppercase text-gray-500 mb-1.5">Titre de l'histoire</label>
              <input
                id="create-story-title"
                type="text"
                required
                placeholder="Ex. L'Odyssée de Séléné"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-purple-600"
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase text-gray-500 mb-1.5">Description / Synopsis</label>
              <textarea
                id="create-story-description"
                required
                rows={3}
                placeholder="Introduisez les enjeux majeurs, vos protagonistes et le décor général pour appâter le lecteur..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-3 text-sm focus:outline-none focus:ring-1 focus:ring-purple-600 block resize-none"
              />
            </div>

            <div className="bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-800 rounded-2xl p-4">
              <label className="block text-xs font-bold uppercase text-gray-500 mb-3">
                Couverture de l'histoire
              </label>

              <div className="flex items-start gap-4">
                <div className="w-24 aspect-[2/3] rounded-xl overflow-hidden bg-gray-200 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shrink-0">
                  {coverImage ? (
                    <img
                      src={coverImage}
                      alt="Aperçu de la couverture"
                      className="w-full h-full object-cover"
                      referrerPolicy="no-referrer"
                      onError={(e) => {
                        const img = e.currentTarget;
                        img.onerror = null;
                        img.src = generateCoverDataUri(title || 'PLUME');
                      }}
                    />
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center text-gray-400 text-center px-2">
                      <ImageIcon className="w-6 h-6 mb-1" />
                      <span className="text-[9px] font-bold uppercase leading-tight">Aucune image</span>
                    </div>
                  )}
                </div>

                <div className="flex-1 space-y-2">
                  <p className="text-[10px] text-gray-400 leading-relaxed">
                    Ajoutez une vraie image de couverture. Elle sera rognée au format livre puis envoyée sur Cloudinary.
                    Si vous ne choisissez rien, PLUME utilisera une couverture automatique.
                  </p>

                  <div className="flex flex-wrap gap-2">
                    <label
                      htmlFor="story-cover-upload"
                      className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-[10px] font-black uppercase tracking-wider cursor-pointer transition shadow-md"
                    >
                      <ImageIcon className="w-3.5 h-3.5" />
                      {coverImage ? 'Changer la couverture' : 'Importer une couverture'}
                    </label>

                    <input
                      id="story-cover-upload"
                      type="file"
                      accept="image/*"
                      disabled={isUploadingCover}
                      onChange={handleCoverUpload}
                      className="hidden"
                    />

                    {coverImage && (
                      <button
                        type="button"
                        onClick={handleRemoveCover}
                        disabled={isUploadingCover}
                        className="px-3 py-2 rounded-xl bg-gray-200 hover:bg-gray-300 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 text-[10px] font-black uppercase tracking-wider transition"
                      >
                        Retirer
                      </button>
                    )}
                  </div>

                  {isUploadingCover && (
                    <p className="text-[10px] text-purple-600 font-bold">
                      Envoi de la couverture en cours...
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Selector Grid */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold uppercase text-gray-500 mb-1.5">Genre Principal</label>
                <select
                  id="create-story-genre"
                  value={genre}
                  onChange={(e) => setGenre(e.target.value)}
                  className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl px-3 py-2 text-xs focus:outline-none"
                >
                  {GENRES.map(g => <option key={g} value={g}>{g}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-gray-400 mb-1.5">Catégorie</label>
                <select
                  id="create-story-category"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl px-3 py-2 text-xs focus:outline-none"
                >
                  {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-gray-500 mb-1.5 font-sans">Ambiance</label>
                <select
                  id="create-story-ambiance"
                  value={ambiance}
                  onChange={(e) => setAmbiance(e.target.value)}
                  className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl px-3 py-2 text-xs focus:outline-none"
                >
                  {AMBIANCES.map(a => <option key={a} value={a}>{a}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-gray-500 mb-1.5">Format</label>
                <select
                  id="create-story-format"
                  value={format}
                  onChange={(e) => setFormat(e.target.value)}
                  className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl px-3 py-2 text-xs focus:outline-none"
                >
                  {FORMATS.map(f => <option key={f} value={f}>{f}</option>)}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold uppercase text-gray-500 mb-1.5">Langue</label>
                <select
                  id="create-story-language"
                  value={language}
                  onChange={(e) => setLanguage(e.target.value)}
                  className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl px-3 py-2 text-xs focus:outline-none animate-fade-in"
                >
                  {LANGUAGES.map(l => <option key={l} value={l}>{l}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-gray-500 mb-1.5">Tranche d'âge autorisée</label>
                <select
                  id="create-story-age-rating"
                  value={ageRating}
                  onChange={(e) => setAgeRating(e.target.value as any)}
                  className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-805 rounded-xl px-3 py-2 text-xs focus:outline-none"
                >
                  <option value="all">Tout public</option>
                  <option value="12">12 ans +</option>
                  <option value="16">16 ans +</option>
                  <option value="18">18 ans + (Adulte)</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-400 mb-1.5">Tags (séparés par des virgules)</label>
              <input
                id="create-story-tags"
                type="text"
                placeholder="Futuriste, Voyage, Psychologie"
                value={tagsInput}
                onChange={(e) => setTagsInput(e.target.value)}
                className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl px-3 py-2 text-xs focus:outline-none"
              />
            </div>

            <div className="flex items-center justify-end space-x-2 pt-4 border-t border-gray-100 dark:border-gray-800">
              <button
                id="cancel-story-creation"
                type="button"
                onClick={resetStoryForm}
                className="px-4 py-2 rounded-xl text-xs font-medium text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800"
              >
                Annuler
              </button>
              <button
                id="submit-story-btn"
                type="submit"
                className="bg-purple-600 hover:bg-purple-700 text-white rounded-xl px-5 py-2.5 text-xs font-bold transition shadow-md shadow-purple-500/10"
              >
                {selectedStoryToEdit ? "Sauvegarder les modifications" : "Valider et Créer l’œuvre"}
              </button>
            </div>
          </form>
        </div>
      ) : (
        /* Standard Screen: Studio Dashboard switcher or inline chapter manager */
        <div className="space-y-6">
          {managingStoryChapters ? (
            /* INLINE CHAPTER MANAGER IN THE WORKSHOP */
            <div className="bg-white dark:bg-[#0E0E14] border border-gray-150 dark:border-purple-900/20 rounded-2xl p-6 shadow-xs text-left max-w-4xl mx-auto animate-fade-in space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-100 dark:border-zinc-850 pb-4">
                <div>
                  <span className="text-[10px] font-black text-purple-600 dark:text-purple-400 uppercase tracking-widest block">
                    Atelier de rédaction
                  </span>
                  <h2 className="text-xl font-serif font-black text-gray-950 dark:text-white mt-1">
                    {currentStoryToManage ? currentStoryToManage.title : managingStoryChapters.title}
                  </h2>
                </div>
                
                <div className="flex items-center gap-2 flex-wrap">
                  {/* Import d'un document déjà écrit (Word/texte) — évite de retaper. */}
                  <input
                    ref={importInputRef}
                    type="file"
                    accept=".docx,.txt,text/plain"
                    onChange={handleImportFile}
                    className="hidden"
                  />
                  <button
                    id="btn-import-document"
                    onClick={() => importInputRef.current?.click()}
                    disabled={importState !== 'idle'}
                    className="h-9 px-4 rounded-xl border border-purple-500/40 text-purple-700 dark:text-purple-300 hover:bg-purple-50 dark:hover:bg-purple-950/20 text-xs font-bold flex items-center gap-1.5 transition disabled:opacity-50"
                    title="Importer un fichier Word (.docx) ou texte (.txt)"
                  >
                    <FileText className="w-4 h-4" />
                    <span>{importState === 'parsing' ? 'Lecture…' : 'Importer'}</span>
                  </button>
                  <button
                    id="btn-add-chapter-directly"
                    onClick={() => handleOpenChapterEditor(currentStoryToManage || managingStoryChapters, null)}
                    className="h-9 px-4 rounded-xl bg-[#7C3AED] hover:bg-[#6D28D9] text-white text-xs font-bold flex items-center gap-1.5 transition duration-150"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Nouveau Chapitre</span>
                  </button>

                  <button
                    id="btn-back-to-books"
                    onClick={() => setManagingStoryChapters(null)}
                    className="h-9 px-4 rounded-xl border border-gray-200 dark:border-zinc-850 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-zinc-90 w-full sm:w-auto text-xs font-semibold transition duration-150"
                  >
                    Retour
                  </button>
                </div>
              </div>

              {/* Erreur d'import (format non géré, fichier illisible…). */}
              {importError && (
                <div className="rounded-xl border border-red-400/40 bg-red-50 dark:bg-red-950/20 p-3 flex items-start justify-between gap-3">
                  <p className="text-[11px] text-red-600 dark:text-red-300 font-semibold">⚠️ {importError}</p>
                  <button onClick={() => setImportError(null)} className="text-red-400 hover:text-red-600 text-sm leading-none">×</button>
                </div>
              )}

              {/* MODAL de confirmation d'import : 1 chapitre ou découpage détecté. */}
              {importPreview && (() => {
                const story = currentStoryToManage || managingStoryChapters;
                const canSplit = importPreview.split.length >= 2;
                const importingNow = importState === 'saving';
                const storyTomes = [...(story.tomes || [])].sort((a, b) => a.order - b.order);
                return (
                  <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 animate-fade-in">
                    <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => !importingNow && setImportPreview(null)} />
                    <div className="relative w-full max-w-md bg-white dark:bg-zinc-950 border border-gray-150 dark:border-purple-900/25 rounded-2xl p-5 shadow-2xl space-y-4">
                      <div>
                        <h3 className="text-sm font-black text-gray-900 dark:text-white flex items-center gap-2">
                          <FileText className="w-4 h-4 text-purple-600" /> Importer « {importPreview.fileName} »
                        </h3>
                        <p className="text-[11px] text-gray-400 mt-1">
                          Les chapitres sont créés en <b>brouillon</b> : tu les relis et les publies quand tu veux.
                        </p>
                      </div>

                      {/* Tome cible : présent seulement si l'œuvre a des tomes. */}
                      {storyTomes.length > 0 && (
                        <div className="space-y-1">
                          <label className="text-[10px] font-black uppercase tracking-wider text-purple-500">Ranger dans</label>
                          <select
                            value={importTomeId}
                            onChange={(e) => setImportTomeId(e.target.value)}
                            className="w-full h-9 bg-white dark:bg-zinc-950 border border-gray-200 dark:border-zinc-800 text-xs rounded-lg px-2 dark:text-gray-200"
                          >
                            <option value="">Hors tome</option>
                            {storyTomes.map((t) => <option key={t.id} value={t.id}>{t.title}</option>)}
                          </select>
                        </div>
                      )}

                      {canSplit && (
                        <div className="rounded-xl border border-purple-500/25 bg-purple-500/5 p-3">
                          <p className="text-[11px] font-bold text-purple-700 dark:text-purple-300">
                            📚 {importPreview.split.length} sections détectées dans le document.
                          </p>
                          <ul className="mt-1.5 space-y-0.5 max-h-28 overflow-y-auto">
                            {importPreview.split.slice(0, 8).map((c, i) => (
                              <li key={i} className="text-[10px] text-gray-500 dark:text-gray-400 truncate">
                                {i + 1}. {c.title || `Chapitre ${i + 1}`}
                              </li>
                            ))}
                            {importPreview.split.length > 8 && <li className="text-[10px] text-gray-400">…</li>}
                          </ul>
                        </div>
                      )}

                      <div className="flex flex-col gap-2">
                        {canSplit && (
                          <button
                            disabled={importingNow}
                            onClick={() => runImport(importPreview.split, story.id)}
                            className="w-full py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-black uppercase tracking-wider transition disabled:opacity-60"
                          >
                            {importingNow ? 'Import…' : `Découper en ${importPreview.split.length} chapitres`}
                          </button>
                        )}
                        <button
                          disabled={importingNow}
                          onClick={() => runImport([{ title: importPreview.fileName, content: importPreview.html }], story.id)}
                          className={`w-full py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition disabled:opacity-60 ${canSplit ? 'border border-gray-200 dark:border-zinc-800 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-zinc-900' : 'bg-purple-600 hover:bg-purple-700 text-white'}`}
                        >
                          {importingNow ? 'Import…' : 'Importer en 1 seul chapitre'}
                        </button>
                        <button
                          disabled={importingNow}
                          onClick={() => setImportPreview(null)}
                          className="w-full py-1.5 text-[11px] font-bold text-gray-400 hover:text-purple-600 transition"
                        >
                          Annuler
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* GESTION DES TOMES (optionnelle) — structurer l'œuvre en volumes.
                  Invisible dans la lecture tant qu'aucun tome n'est créé. */}
              {(() => {
                const story = currentStoryToManage || managingStoryChapters;
                const tomes = [...(story.tomes || [])].sort((a, b) => a.order - b.order);
                return (
                  <div className="rounded-xl border border-gray-150 dark:border-purple-900/15 bg-gray-55/60 dark:bg-black/40 p-4 space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <h3 className="text-xs font-black text-gray-700 dark:text-gray-200 uppercase tracking-widest flex items-center gap-1.5">
                          <BookMarked className="w-3.5 h-3.5 text-purple-600" /> Tomes {tomes.length > 0 ? `(${tomes.length})` : ''}
                        </h3>
                        <p className="text-[10px] text-gray-400 mt-0.5">Optionnel : regroupe tes chapitres en volumes (Tome 1, Tome 2…).</p>
                      </div>
                      {!showTomeInput && (
                        <button
                          onClick={() => { setShowTomeInput(true); setTomeTitleInput(`Tome ${tomes.length + 1}`); }}
                          className="h-8 px-3 rounded-lg bg-purple-600 hover:bg-purple-700 text-white text-[10.5px] font-bold flex items-center gap-1.5 shrink-0"
                        >
                          <Plus className="w-3.5 h-3.5" /> Ajouter un tome
                        </button>
                      )}
                    </div>
                    {showTomeInput && (
                      <form
                        onSubmit={(e) => { e.preventDefault(); const t = tomeTitleInput.trim(); if (t) onCreateTome(story.id, t); setTomeTitleInput(''); setShowTomeInput(false); }}
                        className="flex items-center gap-2"
                      >
                        <input
                          autoFocus
                          value={tomeTitleInput}
                          onChange={(e) => setTomeTitleInput(e.target.value)}
                          maxLength={200}
                          placeholder="Titre du tome (ex. Tome 1 : L'éveil)"
                          className="flex-1 bg-white dark:bg-zinc-950 border border-gray-200 dark:border-zinc-800 text-xs rounded-lg px-3 py-2 focus:outline-none focus:border-purple-500 dark:text-white"
                        />
                        <button type="submit" className="h-8 px-3 rounded-lg bg-purple-600 hover:bg-purple-700 text-white text-[10.5px] font-bold">Créer</button>
                        <button type="button" onClick={() => { setShowTomeInput(false); setTomeTitleInput(''); }} className="text-gray-400 hover:text-purple-600 text-lg px-1 leading-none">×</button>
                      </form>
                    )}
                    {tomes.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {tomes.map((t) => {
                          const count = story.chapters.filter((c) => c.tomeId === t.id).length;
                          return (
                            <div key={t.id} className="flex items-center gap-1.5 bg-white dark:bg-zinc-950 border border-gray-200 dark:border-zinc-800 rounded-lg px-2.5 py-1.5">
                              <span className="text-[11px] font-bold text-gray-800 dark:text-gray-100">{t.title}</span>
                              <span className="text-[9px] font-mono text-gray-400">{count} ch.</span>
                              <button onClick={() => { const nt = window.prompt('Renommer le tome :', t.title); if (nt && nt.trim()) onRenameTome(story.id, t.id, nt.trim()); }} className="text-gray-400 hover:text-purple-600" title="Renommer"><Edit className="w-3 h-3" /></button>
                              <button onClick={() => { if (window.confirm(`Supprimer « ${t.title} » ? Ses chapitres seront conservés (remis hors tome).`)) onDeleteTome(story.id, t.id); }} className="text-gray-400 hover:text-red-500" title="Supprimer"><Trash2 className="w-3 h-3" /></button>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })()}

              {!(currentStoryToManage || managingStoryChapters).chapters || (currentStoryToManage || managingStoryChapters).chapters.length === 0 ? (
                <div className="text-center py-16 border border-dashed border-gray-200 dark:border-zinc-800 rounded-xl">
                  <BookOpen className="w-10 h-10 text-gray-300 dark:text-zinc-700 mx-auto mb-3" />
                  <h4 className="font-sans font-bold text-sm text-gray-900 dark:text-gray-200">Aucun chapitre encore rédigé</h4>
                  <p className="text-xs text-gray-400 mt-1 max-w-xs mx-auto">Commencez l'écriture du premier chapitre de votre œuvre.</p>
                  <button
                    id="btn-write-first-chapter"
                    onClick={() => handleOpenChapterEditor(currentStoryToManage || managingStoryChapters, null)}
                    className="mt-4 bg-[#7C3AED] hover:bg-[#6D28D9] text-white px-4 py-2 rounded-xl text-xs font-bold transition inline-flex items-center gap-1.5"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Écrire le premier chapitre</span>
                  </button>
                </div>
              ) : (() => {
                const story = currentStoryToManage || managingStoryChapters;
                const tomes = [...(story.tomes || [])].sort((a, b) => a.order - b.order);
                const hasTomes = tomes.length > 0;

                // Une ligne de chapitre (numérotée globalement, comme le lecteur).
                const chapterRow = (chapter: Chapter, idx: number) => (
                  <div
                    key={chapter.id}
                    className="p-4 bg-gray-55 dark:bg-black rounded-xl border border-gray-150 dark:border-purple-900/15 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-left"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="font-mono text-xs font-black w-8 h-8 rounded-lg bg-purple-500/10 text-[#7C3AED] dark:text-purple-400 flex items-center justify-center shrink-0">
                        {idx + 1}
                      </span>
                      <div className="min-w-0">
                        <h4 className="font-sans font-bold text-xs text-gray-950 dark:text-gray-50 truncate">{chapter.title}</h4>
                        <p className="text-[10px] text-gray-450 dark:text-gray-400 font-mono mt-0.5">
                          {chapter.isPublished
                            ? `Publié le ${new Date(chapter.publishDate).toLocaleDateString('fr-FR')} — ${chapter.views || 0} vues`
                            : 'Brouillon — non visible des lecteurs'}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 self-start sm:self-center shrink-0">
                      {hasTomes && (
                        <select
                          value={chapter.tomeId || ''}
                          onChange={(e) => onUpdateChapter(story.id, chapter.id, { tomeId: e.target.value || null })}
                          title="Ranger ce chapitre dans un tome"
                          className="h-8 bg-white dark:bg-zinc-950 border border-gray-200 dark:border-zinc-800 text-[10px] rounded-lg px-1.5 dark:text-gray-200 max-w-[120px]"
                        >
                          <option value="">Hors tome</option>
                          {tomes.map((t) => <option key={t.id} value={t.id}>{t.title}</option>)}
                        </select>
                      )}
                      <button
                        id={`btn-edit-chapter-${chapter.id}`}
                        onClick={() => handleOpenChapterEditor(story, chapter)}
                        className="h-8 px-3 rounded-lg border border-gray-200 dark:border-zinc-800 text-[10.5px] font-bold text-gray-750 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-zinc-800 transition flex items-center gap-1.5"
                      >
                        <Edit className="w-3.5 h-3.5" />
                        <span>Modifier</span>
                      </button>
                    </div>
                  </div>
                );

                // Sans tome : liste plate, strictement identique à avant.
                if (!hasTomes) {
                  return (
                    <div className="space-y-3">
                      <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest">
                        Chapitres rédigés ({story.chapters.length})
                      </h3>
                      <div className="grid grid-cols-1 gap-2.5">
                        {story.chapters.map((chapter, idx) => chapterRow(chapter, idx))}
                      </div>
                    </div>
                  );
                }

                // Avec tomes : chaque tome (dans l'ordre) puis « Hors tome ».
                const groups: { id: string | null; title: string }[] = [
                  ...tomes.map((t) => ({ id: t.id as string | null, title: t.title })),
                  { id: null, title: 'Hors tome' },
                ];
                return (
                  <div className="space-y-5">
                    {groups.map((g) => {
                      const items = story.chapters
                        .map((c, i) => ({ c, i }))
                        .filter(({ c }) => (c.tomeId || null) === g.id);
                      if (items.length === 0) return null;
                      return (
                        <div key={g.id || 'none'} className="space-y-2">
                          <h3 className="text-[11px] font-black text-purple-500 uppercase tracking-widest">
                            {g.title} ({items.length})
                          </h3>
                          <div className="grid grid-cols-1 gap-2.5">
                            {items.map(({ c, i }) => chapterRow(c, i))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })()}
            </div>
          ) : (
            /* STANDARD MASTER VIEWS WITH GRILLS & ALIGNEMENTS */
            <div className="space-y-6">
              {/* COMPACT & ELEGANT HEADER */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-150/80 dark:border-zinc-850 pb-5 text-left">
                <div>
                  <h1 className="text-xl md:text-2xl font-sans font-black tracking-tight text-gray-950 dark:text-white flex items-center space-x-2">
                    <PenTool className="w-5 h-5 text-[#7C3AED]" />
                    <span>Atelier de Création PLUME</span>
                  </h1>
                  <p className="text-xs text-gray-450 dark:text-gray-400 mt-1">Composez vos récits en toute fluidité avec un rendu premium de livre.</p>
                </div>

                <button
                  id="add-story-studio-btn"
                  onClick={() => {
                    setSelectedStoryToEdit(null);
                    setIsCreatingStory(true);
                  }}
                  className="bg-[#7C3AED] hover:bg-[#6D28D9] text-white px-5 py-2.5 rounded-xl text-xs font-bold flex items-center justify-center space-x-1.5 shadow-xs transition duration-200 active:scale-[0.98] shrink-0"
                >
                  <Plus className="w-4 h-4" />
                  <span>Nouvelle Histoire</span>
                </button>
              </div>

              {/* CLASSICAL HIGHLIGHTED TABS */}
              <div className="flex border-b border-gray-150/80 dark:border-zinc-850 pb-px text-left">
                <button
                  id="studio-tab-books"
                  onClick={() => setActiveSubTab('my-books')}
                  className={`pb-3.5 px-2 text-sm font-bold border-b-2 transition-all duration-150 ${
                    activeSubTab === 'my-books'
                      ? 'border-[#7C3AED] text-[#7C3AED] dark:border-purple-400 dark:text-purple-400'
                      : 'border-transparent text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-white'
                  }`}
                >
                  Mes Manuscrits ({userStories.length})
                </button>

                <button
                  id="studio-tab-stats"
                  onClick={() => setActiveSubTab('performance-dashboard')}
                  className={`pb-3.5 px-2 ml-8 text-sm font-bold border-b-2 transition-all duration-150 ${
                    activeSubTab === 'performance-dashboard'
                      ? 'border-[#7C3AED] text-[#7C3AED] dark:border-purple-400 dark:text-purple-400'
                      : 'border-transparent text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-white'
                  }`}
                >
                  Statistiques
                </button>
              </div>

              {/* ROUTER INNER BODY */}
              {activeSubTab === 'performance-dashboard' ? (
                /* STATS VIEW */
                <div className="space-y-6 animate-fade-in text-left">
                  <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
                    
                    {/* Global Reads */}
                    <div className="bg-white dark:bg-[#0E0E14] border border-gray-150 dark:border-purple-900/15 rounded-1.5xl p-4 flex flex-col justify-between min-h-[105px] transition-all hover:border-[#7C3AED]/25 shadow-xs">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">Lectures</span>
                        <Eye className="w-4 h-4 text-[#7C3AED]" />
                      </div>
                      <div>
                        <p className="text-2xl font-black text-gray-955 dark:text-white font-mono leading-none">{totalReads}</p>
                        <p className="text-[9px] text-gray-455 dark:text-gray-400 mt-1.5">Cumul de chapitres lus</p>
                      </div>
                    </div>
 
                    {/* Lecteurs uniques */}
                    <div className="bg-white dark:bg-[#0E0E14] border border-gray-150 dark:border-purple-900/15 rounded-1.5xl p-4 flex flex-col justify-between min-h-[105px] transition-all hover:border-[#7C3AED]/25 shadow-xs">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">Vues</span>
                        <Compass className="w-4 h-4 text-[#7C3AED]" />
                      </div>
                      <div>
                        <p className="text-2xl font-black text-gray-955 dark:text-white font-mono leading-none">{totalViews}</p>
                        <p className="text-[9px] text-gray-455 dark:text-gray-400 mt-1.5">Cumul des visites de fiches</p>
                      </div>
                    </div>

                    {/* Taux de complétion */}
                    <div className="bg-white dark:bg-[#0E0E14] border border-gray-150 dark:border-purple-900/15 rounded-1.5xl p-4 flex flex-col justify-between min-h-[105px] transition-all hover:border-[#7C3AED]/25 shadow-xs">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">Taux de Complétion</span>
                        <span className="text-[9px] bg-purple-500/10 text-[#7C3AED] rounded px-1.5 py-0.5 font-bold font-mono">{readRatio}%</span>
                      </div>
                      <div>
                        <p className="text-2xl font-black text-gray-955 dark:text-white font-mono leading-none">{readRatio}%</p>
                        <p className="text-[9px] text-gray-455 dark:text-gray-400 mt-1.5">Ratio chapitres lus par vue</p>
                      </div>
                    </div>

                    {/* Favoris */}
                    <div className="bg-white dark:bg-[#0E0E14] border border-gray-150 dark:border-purple-900/15 rounded-1.5xl p-4 flex flex-col justify-between min-h-[105px] transition-all hover:border-[#7C3AED]/25 shadow-xs">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">Favoris</span>
                        <BookMarked className="w-4 h-4 text-purple-600" />
                      </div>
                      <div>
                        <p className="text-2xl font-black text-gray-955 dark:text-white font-mono leading-none">
                          {userStories.reduce((acc, st) => acc + (st.favoritesCount || 0), 0)}
                        </p>
                        <p className="text-[9px] text-gray-455 dark:text-gray-400 mt-1.5">Ajouts aux bibliothèques</p>
                      </div>
                    </div>

                    {/* Commentaires */}
                    <div className="bg-white dark:bg-[#0E0E14] border border-gray-150 dark:border-purple-900/15 rounded-1.5xl p-4 flex flex-col justify-between min-h-[105px] transition-all hover:border-[#7C3AED]/25 shadow-xs">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">Commentaires</span>
                        <FileText className="w-4 h-4 text-purple-600" />
                      </div>
                      <div>
                        <p className="text-2xl font-black text-gray-955 dark:text-white font-mono leading-none">{authorWorkComments.length}</p>
                        <p className="text-[9px] text-gray-455 dark:text-gray-400 mt-1.5">Retours de lecteurs</p>
                      </div>
                    </div>

                    {/* Croissance Abonnés */}
                    <div className="bg-white dark:bg-[#0E0E14] border border-gray-150 dark:border-purple-900/15 rounded-1.5xl p-4 flex flex-col justify-between min-h-[105px] transition-all hover:border-[#7C3AED]/25 shadow-xs">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">Abonnés</span>
                        <Users className="w-4 h-4 text-purple-600" />
                      </div>
                      <div>
                        <p className="text-2xl font-black text-gray-955 dark:text-white font-mono leading-none">
                          {currentUser.followers?.length || 0}
                        </p>
                        <p className="text-[9px] text-gray-455 dark:text-gray-400 mt-1.5">Communauté consolidée</p>
                      </div>
                    </div>

                  </div>

                  {/* PARCOURS DE LECTURE PAR CHAPITRE : la donnée que les
                      compteurs bruts ne donnent jamais — OÙ les lecteurs
                      décrochent (lectures COMPLÈTES par chapitre). */}
                  {authorStats && authorStats.some((s) => s.chapters.length > 0) && (
                    <div className="bg-white dark:bg-[#0E0E14] border border-gray-200/50 dark:border-purple-900/20 rounded-2xl p-6 space-y-6">
                      <div>
                        <h3 className="font-bold text-xs text-gray-400 uppercase tracking-wider">Parcours de lecture par chapitre</h3>
                        <p className="text-[10px] text-gray-400 mt-1">
                          Lecteurs ayant lu chaque chapitre <span className="font-bold">en entier</span> — là où la barre chute, c'est là qu'on décroche.
                        </p>
                      </div>
                      {authorStats.filter((s) => s.chapters.length > 0).map((s) => {
                        const maxReads = Math.max(1, ...s.chapters.map((c) => c.fullReads));
                        return (
                          <div key={s.id} className="space-y-2">
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-xs font-bold text-gray-800 dark:text-gray-100 truncate">{s.title}</span>
                              <span className="text-[9px] font-mono text-gray-400 whitespace-nowrap">
                                {s.readers} lecteur{s.readers > 1 ? 's' : ''} · complétion {s.completion}%
                              </span>
                            </div>
                            <div className="space-y-1">
                              {s.chapters.map((c, i) => (
                                <div key={c.id} className="flex items-center gap-2" title={c.title}>
                                  <span className="w-10 text-[9px] font-mono text-gray-400 text-right shrink-0">Ch. {i + 1}</span>
                                  <div className="flex-1 h-2.5 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                                    <div className="h-full bg-purple-600 rounded-full transition-all" style={{ width: `${(c.fullReads / maxReads) * 100}%` }} />
                                  </div>
                                  <span className="w-16 text-[9px] font-mono text-gray-500 dark:text-gray-400 shrink-0 text-right">
                                    {c.fullReads} lecture{c.fullReads > 1 ? 's' : ''}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        );
                      })}
                      <p className="text-[9px] text-gray-400 italic">
                        Compte les lectures complètes (chapitre parcouru jusqu'au bout), pas les simples ouvertures — le suivi démarre à partir d'aujourd'hui.
                      </p>
                    </div>
                  )}

                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                    {/* Visual bar completion */}
                    <div className="lg:col-span-7 bg-white dark:bg-[#0E0E14] border border-gray-200/50 dark:border-purple-900/20 rounded-2xl p-6">
                      <h3 className="font-bold text-xs text-gray-400 mb-4 uppercase tracking-wider">Résonance par manuscrit</h3>
                      
                      {userStories.length === 0 ? (
                        <div className="text-center py-12 text-xs text-gray-400">Aucun manuscrit publié à analyser.</div>
                      ) : (
                        <div className="space-y-6">
                          {userStories.map((st) => {
                            const score = totalReads > 0 ? (st.reads / totalReads) * 100 : 0;
                            return (
                              <div key={st.id} className="space-y-1.5">
                                <div className="flex justify-between text-xs font-semibold">
                                  <span className="text-gray-700 dark:text-gray-200">{st.title}</span>
                                  <span className="text-purple-600 font-mono font-bold">{st.reads} lectures</span>
                                </div>
                                <div className="w-full bg-gray-100 dark:bg-gray-800 h-2 rounded-full overflow-hidden">
                                  <div 
                                    className="bg-purple-600 h-full rounded-full transition-all"
                                    style={{ width: `${Math.max(score, 4)}%` }}
                                  />
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    {/* Micro comments dashboard */}
                    <div className="lg:col-span-5 bg-white dark:bg-[#0E0E14] border border-gray-200/50 dark:border-purple-900/20 rounded-2xl p-6">
                      <h3 className="font-bold text-xs text-gray-400 mb-4 uppercase tracking-wider">Retours constructifs ({authorWorkComments.length})</h3>
                      
                      <div className="space-y-3 max-h-72 overflow-y-auto pr-2">
                        {authorWorkComments.length === 0 ? (
                          <div className="text-center py-12 text-xs text-gray-400">Aucun commentaire direct.</div>
                        ) : (
                          authorWorkComments.map(c => (
                            <div key={c.id} className="p-3 bg-gray-55 dark:bg-zinc-900/40 rounded-xl border border-gray-150 dark:border-[#2a2a3a] text-xs">
                              <div className="flex items-center justify-between mb-1">
                                <span className="font-bold text-gray-800 dark:text-gray-200">{c.username}</span>
                                <span className="text-[9px] text-gray-400 font-mono">{new Date(c.date).toLocaleDateString('fr-FR')}</span>
                              </div>
                              <p className="text-gray-600 dark:text-gray-400 italic">"{c.content}"</p>
                              <div className="mt-2 text-[10px] text-purple-600 dark:text-purple-400 flex items-center space-x-1 font-bold">
                                <CornerDownRight className="w-3.5 h-3.5 shrink-0" />
                                <span className="truncate">{commentLocationLabel(c)}</span>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                /* MANUSCRIPTS VIEW WITH 60% VISUAL COVER RENDER */
                <div className="space-y-6">
                  {userStories.length === 0 ? (
                    <div className="text-center py-16 bg-white dark:bg-[#0E0E14] border border-gray-150 dark:border-purple-900/15 rounded-2xl flex flex-col items-center justify-center px-6">
                      <div className="w-12 h-12 rounded-full bg-purple-500/10 flex items-center justify-center text-purple-600 mb-3 animate-pulse">
                        <BookOpen className="w-6 h-6 hover:scale-105 transition" />
                      </div>
                      <h3 className="font-sans font-black text-sm text-gray-950 dark:text-[#F5F5F5] mb-1">Votre plume attend de s'exercer</h3>
                      <p className="text-xs text-gray-400 max-w-xs mb-4 leading-relaxed text-center">Créez votre tout premier manuscrit et invitez la communauté à vous lire !</p>
                      
                      <button
                        id="add-first-book-studio"
                        onClick={() => {
                          setSelectedStoryToEdit(null);
                          setIsCreatingStory(true);
                        }}
                        className="bg-[#7C3AED] hover:bg-[#6D28D9] text-white rounded-xl px-5 py-2.5 text-xs font-bold transition duration-200 outline-none"
                      >
                        Créer mon premier manuscrit
                      </button>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-left">
                      {userStories.map((story) => {
                        const isSelected = selectedStoryToEdit?.id === story.id;
                        return (
                          <div 
                            key={story.id} 
                            className={`bg-white dark:bg-[#0E0E14] border rounded-2xl p-4.5 flex gap-4 sm:gap-5 transition-all duration-200 ${
                              isSelected 
                                ? 'border-[#7C3AED] ring-4 ring-[#7C3AED]/10' 
                                : 'border-gray-150 dark:border-purple-900/15 hover:border-[#7C3AED]/25 hover:shadow-xs'
                            }`}
                          >
                            {/* LARGE EMBEDDED COVER COMPOSITION (approx. 60% relative size in layout card) */}
                            <div className="w-[44%] h-44 sm:h-52 rounded-xl overflow-hidden bg-gray-50 dark:bg-zinc-900/60 flex-shrink-0 relative border border-gray-150/15 dark:border-zinc-800/10">
                              <img
                                src={story.cover}
                                alt={story.title}
                                className="w-full h-full object-cover transition-transform duration-300 hover:scale-105"
                                referrerPolicy="no-referrer"
                                onError={(e) => {
                                  const img = e.currentTarget;
                                  img.onerror = null;
                                  img.src = generateCoverDataUri(story.title);
                                }}
                              />
                              <div className="absolute top-2 left-2">
                                <span className={`text-[8.5px] px-2 py-0.5 rounded-md font-extrabold uppercase shadow-xs ${
                                  story.status === 'Publié' 
                                    ? 'bg-[#7C3AED] text-white' 
                                    : 'bg-gray-500 text-white'
                                }`}>
                                  {story.status}
                                </span>
                              </div>
                              <div className="absolute top-2 right-2">
                                <span className="text-[8.5px] px-2 py-0.5 rounded-md font-black bg-black/60 text-white shadow-xs backdrop-blur-xs">
                                  {!story.ageRating || story.ageRating === 'all' ? 'Universal' : `${story.ageRating}+`}
                                </span>
                              </div>
                            </div>

                            {/* INFORMATION BODY AND MODULAR BOTTONS (approx. 40% metadata visual area) */}
                            <div className="flex-1 flex flex-col justify-between min-w-0">
                              <div className="space-y-1">
                                <div className="flex items-start justify-between gap-1">
                                  <span className="text-[9px] font-black text-purple-600 dark:text-purple-400 uppercase tracking-widest block truncate">
                                    {story.genre}
                                  </span>
                                  
                                  {/* Three-dot options menu */}
                                  <div className="relative shrink-0">
                                    <button
                                      id={`story-options-${story.id}`}
                                      onClick={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        setExpandedMenuStoryId(expandedMenuStoryId === story.id ? null : story.id);
                                      }}
                                      className="p-1 text-gray-400 hover:text-purple-600 dark:hover:text-purple-400 transition rounded-lg hover:bg-gray-100 dark:hover:bg-zinc-800/65 cursor-pointer"
                                      title="Options de l'œuvre"
                                    >
                                      <MoreVertical className="w-4 h-4" />
                                    </button>
                                    
                                    {expandedMenuStoryId === story.id && (
                                      <>
                                        <div 
                                          className="fixed inset-0 z-30" 
                                          onClick={(e) => {
                                            e.preventDefault();
                                            e.stopPropagation();
                                            setExpandedMenuStoryId(null);
                                          }} 
                                        />
                                        <div 
                                          className="absolute right-0 top-7 w-44 bg-white dark:bg-[#1B1B26] border border-gray-150 dark:border-zinc-800/95 rounded-xl shadow-lg py-1 z-40 animate-fade-in text-left font-sans"
                                          onClick={(e) => e.stopPropagation()}
                                        >
                                          <button
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              setExpandedMenuStoryId(null);
                                              handleOpenEditStory(story);
                                            }}
                                            className="w-full px-3.5 py-2 text-[10.5px] font-bold text-gray-700 dark:text-zinc-200 hover:bg-purple-650/10 hover:text-purple-605 dark:hover:bg-purple-650/15 transition flex items-center gap-2 cursor-pointer"
                                          >
                                            <Edit className="w-3.5 h-3.5 text-zinc-400" />
                                            <span>Modifier l'histoire</span>
                                          </button>
                                          
                                          <button
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              setExpandedMenuStoryId(null);
                                              setManagingStoryChapters(story);
                                            }}
                                            className="w-full px-3.5 py-2 text-[10.5px] font-bold text-gray-700 dark:text-zinc-200 hover:bg-purple-650/10 hover:text-purple-605 dark:hover:bg-purple-650/15 transition flex items-center gap-2 cursor-pointer"
                                          >
                                            <FileText className="w-3.5 h-3.5 text-zinc-400" />
                                            <span>Continuer l'écriture</span>
                                          </button>
                                          
                                          <button
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              setExpandedMenuStoryId(null);
                                              handleToggleStoryPublish(story);
                                            }}
                                            className="w-full px-3.5 py-2 text-[10.5px] font-bold text-gray-700 dark:text-zinc-200 hover:bg-purple-650/10 hover:text-purple-605 dark:hover:bg-purple-650/15 transition flex items-center gap-2 cursor-pointer"
                                          >
                                            <Power className="w-3.5 h-3.5 text-zinc-400" />
                                            <span>{story.status === 'Publié' ? 'Dépublier l\'histoire' : 'Publier l\'histoire'}</span>
                                          </button>
                                          
                                          <div className="border-t border-gray-100 dark:border-zinc-850 my-1" />
                                          
                                          <button
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              setExpandedMenuStoryId(null);
                                              setStoryToDelete(story);
                                            }}
                                            className="w-full px-3.5 py-2 text-[10.5px] font-black text-purple-650 dark:text-purple-400 hover:bg-purple-500/10 transition flex items-center gap-2 cursor-pointer"
                                          >
                                            <Trash2 className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
                                            <span>Supprimer l'histoire</span>
                                          </button>
                                        </div>
                                      </>
                                    )}
                                  </div>
                                </div>
                                
                                <h3 className="font-serif font-black text-xs sm:text-base text-gray-950 dark:text-gray-50 leading-snug line-clamp-2">
                                  {story.title}
                                </h3>
                                
                                <div className="flex items-center gap-1.5 text-[10px] text-gray-450 dark:text-gray-400 font-mono pt-1">
                                  <Eye className="w-3.5 h-3.5 flex-shrink-0" />
                                  <span>{story.reads} lectures</span>
                                </div>
                              </div>

                              <div className="mt-3 pt-3 border-t border-gray-100 dark:border-zinc-900/40 space-y-2">
                                <div className="grid grid-cols-2 gap-2">
                                  <button
                                    id={`edit-story-meta-${story.id}`}
                                    onClick={() => handleOpenEditStory(story)}
                                    className="h-8.5 rounded-xl border border-gray-150 dark:border-zinc-800 text-[11px] font-bold text-gray-805 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-zinc-800 transition duration-150 flex items-center justify-center gap-1.5"
                                    title="Modifier les options du livre"
                                  >
                                    <Edit className="w-3.5 h-3.5 text-gray-500" />
                                    <span>Modifier</span>
                                  </button>

                                  <button
                                    id={`manage-chapters-studio-${story.id}`}
                                    onClick={() => setManagingStoryChapters(story)}
                                    className="h-8.5 bg-purple-500/10 hover:bg-purple-500/15 text-[#7C3AED] dark:text-purple-300 text-[11px] font-bold border border-purple-500/10 rounded-xl transition duration-150 flex items-center justify-center gap-1.5"
                                    title="Gérer les chapitres du livre"
                                  >
                                    <FileText className="w-3.5 h-3.5" />
                                    <span>Chapitres</span>
                                  </button>
                                </div>

                                <button
                                  id={`publish-toggle-${story.id}`}
                                  onClick={() => handleToggleStoryPublish(story)}
                                  className={`w-full h-8 px-2.5 rounded-lg border text-[10px] font-bold transition duration-150 flex items-center justify-center gap-1.5 ${
                                    story.status === 'Publié' 
                                      ? 'bg-purple-600/10 border-purple-500/20 text-purple-600 dark:text-purple-400 hover:bg-purple-500/20' 
                                      : 'bg-zinc-100 dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 text-zinc-550 dark:text-zinc-400 hover:bg-zinc-200/50'
                                  }`}
                                  title={story.status === 'Publié' ? 'Mettre en Brouillon' : 'Publier l’œuvre'}
                                >
                                  <Power className="w-3 h-3" />
                                  <span>{story.status === 'Publié' ? 'Retirer du site' : 'Mettre en ligne'}</span>
                                </button>
                              </div>
                            </div>

                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Dynamic premium confirmation delete modal */}
      {storyToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animation-fade-in font-sans">
          <div className="bg-white dark:bg-black border border-gray-150 dark:border-purple-900/25 rounded-2xl max-w-sm w-full p-6 shadow-2xl relative">
            <div className="text-center space-y-4">
              <div className="w-12 h-12 bg-purple-500/10 text-purple-600 dark:text-purple-400 rounded-full flex items-center justify-center mx-auto mb-2 border border-purple-500/15">
                <Trash2 className="w-5 h-5" />
              </div>
              <h3 className="font-serif font-black text-base text-gray-950 dark:text-gray-50 leading-tight">
                Supprimer "{storyToDelete.title}" ?
              </h3>
              <p className="text-xs text-gray-400 dark:text-zinc-400 leading-relaxed">
                Cette action est irréversible. L'œuvre, ses chapitres parus, ses brouillons associés, ses commentaires et ses statistiques de lecture seront définitivement effacés de la plateforme.
              </p>
              <div className="grid grid-cols-2 gap-3 pt-2">
                <button
                  id="confirm-delete-cancel"
                  onClick={() => setStoryToDelete(null)}
                  className="w-full py-2 bg-gray-100 dark:bg-zinc-850 hover:bg-gray-200 dark:hover:bg-zinc-800 text-gray-705 dark:text-zinc-200 rounded-xl text-[10px] font-black uppercase tracking-wider transition cursor-pointer"
                >
                  Annuler
                </button>
                <button
                  id="confirm-delete-ok"
                  onClick={() => {
                    onDeleteStory(storyToDelete.id);
                    setStoryToDelete(null);
                  }}
                  className="w-full py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-[10px] font-black uppercase tracking-wider transition shadow-lg shadow-purple-500/10 cursor-pointer"
                >
                  Confirmer
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
