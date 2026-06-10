/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import Cropper from 'react-easy-crop';
import type { Area } from 'react-easy-crop';
import { 
  User as UserIcon, 
  Settings, 
  Mail, 
  Calendar, 
  Sparkles, 
  PenTool, 
  BookOpen, 
  CheckCircle, 
  Plus, 
  Users, 
  Trash2,
  BookmarkCheck,
  ShieldAlert,
  Grid,
  Heart,
  Power,
  Save,
  Check,
  Star,
  Eye,
  ChevronLeft,
  BookMarked,
  Sliders,
  Edit,
  Trash,
  Trophy,
  Award,
  Image as ImageIcon,
  MoreVertical,
  ChevronRight,
  FileText,
  Lock,
  KeyRound,
  X
} from 'lucide-react';
import { VerifiedBadge } from './VerifiedBadge';
import { User, UserRole, Story, Chapter } from '../types';
import { GENRES } from '../data';
import { uploadImageToCloudinary } from '../utils/uploadImage';
import { authHeaders } from '../utils/auth';
import {
  getUserStats,
  generateReaderAchievements,
  generateAuthorAchievements,
  countAndEvaluateCertification,
  getAchievementEnigma,
  UserStats,
  Achievement
} from '../utils/achievements';

interface ProfileViewProps {
  currentUser: User;
  authorCertification?: { authorPercent: number; authorUnlocked: number } | null;
  viewedUser?: User | null;
  onBackToMyProfile?: () => void;
  onUpdateProfile: (updatedFields: Partial<User>) => void;
  onUpdateAndVerifyUserStats?: (updateFn: (stats: UserStats) => void) => void;
  stories: Story[];
  favorites: string[]; // List of story IDs
  onRemoveFavorite: (storyId: string) => void;
  onAddChapter: (storyId: string, chapterData: Partial<Chapter>) => void;
  onUpdateChapter: (storyId: string, chapterId: string, updatedChapter: Partial<Chapter>) => void;
  onDeleteChapter: (storyId: string, chapterId: string) => void;
  onUpdateStory: (storyId: string, updatedStory: Partial<Story>) => void;
  onDeleteStory: (storyId: string) => void;
  currentlyReading: string[];
  completedStories: string[];
  readLater: string[];
  onToggleCurrentlyReading: (storyId: string) => void;
  onToggleCompletedStories: (storyId: string) => void;
  onToggleReadLater: (storyId: string) => void;
  onLogout?: () => void;
  onSelectStory?: (story: Story) => void;
  onFollowAuthor?: (authorId: string) => void;
  onOpenDiscussion?: (userId: string) => void;
  friendIds?: string[];
  onViewProfile?: (userId: string) => void;
  allUsers?: User[];
}

const createVisualBannerPreset = (scene: 'library' | 'forest' | 'city' | 'cosmos') => {
  const scenes: Record<typeof scene, string> = {
    library: `
      <svg xmlns="http://www.w3.org/2000/svg" width="1200" height="400" viewBox="0 0 1200 400">
        <defs>
          <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stop-color="#09090b"/><stop offset="45%" stop-color="#3b0764"/><stop offset="100%" stop-color="#111827"/>
          </linearGradient>
          <radialGradient id="lamp" cx="78%" cy="14%" r="60%">
            <stop offset="0%" stop-color="#f5d0fe" stop-opacity="0.38"/><stop offset="100%" stop-color="#7c3aed" stop-opacity="0"/>
          </radialGradient>
        </defs>
        <rect width="1200" height="400" fill="url(#bg)"/>
        <rect width="1200" height="400" fill="url(#lamp)"/>
        <rect x="0" y="308" width="1200" height="92" fill="#020617" opacity="0.52"/>
        <g opacity="0.95">
          <rect x="70" y="86" width="110" height="226" rx="10" fill="#2e1065"/><rect x="88" y="110" width="18" height="176" fill="#a78bfa" opacity="0.7"/><rect x="115" y="104" width="28" height="182" fill="#f5f3ff" opacity="0.22"/><rect x="152" y="122" width="16" height="164" fill="#c084fc" opacity="0.75"/>
          <rect x="210" y="62" width="132" height="250" rx="12" fill="#1e1b4b"/><rect x="232" y="90" width="20" height="196" fill="#ddd6fe" opacity="0.36"/><rect x="266" y="80" width="35" height="206" fill="#7c3aed" opacity="0.72"/><rect x="313" y="104" width="14" height="182" fill="#faf5ff" opacity="0.35"/>
          <rect x="382" y="114" width="98" height="198" rx="10" fill="#581c87"/><rect x="404" y="136" width="18" height="150" fill="#c4b5fd" opacity="0.63"/><rect x="438" y="132" width="24" height="154" fill="#f5f3ff" opacity="0.2"/>
          <rect x="520" y="82" width="120" height="230" rx="10" fill="#2e1065"/><rect x="545" y="108" width="24" height="178" fill="#a78bfa" opacity="0.5"/><rect x="586" y="100" width="34" height="186" fill="#f5f3ff" opacity="0.22"/>
        </g>
        <g opacity="0.85">
          <ellipse cx="930" cy="315" rx="190" ry="32" fill="#000" opacity="0.35"/>
          <path d="M802 286 C866 210 980 210 1052 286 Z" fill="#f5f3ff" opacity="0.88"/>
          <path d="M836 282 C884 238 965 238 1018 282 Z" fill="#7c3aed" opacity="0.62"/>
          <path d="M802 286 C880 318 974 318 1052 286" fill="none" stroke="#111827" stroke-width="10" opacity="0.35"/>
          <circle cx="930" cy="126" r="52" fill="#f5d0fe" opacity="0.18"/>
        </g>
        <path d="M0 330 C200 285 380 365 570 320 S955 260 1200 324 V400 H0 Z" fill="#000" opacity="0.32"/>
      </svg>
    `,
    forest: `
      <svg xmlns="http://www.w3.org/2000/svg" width="1200" height="400" viewBox="0 0 1200 400">
        <defs>
          <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#1e1b4b"/><stop offset="55%" stop-color="#4c1d95"/><stop offset="100%" stop-color="#020617"/></linearGradient>
          <radialGradient id="moon" cx="18%" cy="22%" r="35%"><stop offset="0%" stop-color="#f8fafc" stop-opacity="0.62"/><stop offset="100%" stop-color="#f8fafc" stop-opacity="0"/></radialGradient>
        </defs>
        <rect width="1200" height="400" fill="url(#bg)"/>
        <rect width="1200" height="400" fill="url(#moon)"/>
        <circle cx="210" cy="82" r="44" fill="#f8fafc" opacity="0.82"/>
        <circle cx="238" cy="70" r="44" fill="#1e1b4b" opacity="0.72"/>
        <g opacity="0.95">
          <path d="M80 340 L150 120 L225 340 Z" fill="#111827"/><path d="M160 340 L250 72 L345 340 Z" fill="#18181b"/><path d="M310 340 L410 95 L515 340 Z" fill="#111827"/>
          <path d="M470 340 L595 42 L720 340 Z" fill="#0f172a"/><path d="M690 340 L800 110 L910 340 Z" fill="#18181b"/><path d="M850 340 L980 70 L1115 340 Z" fill="#111827"/>
        </g>
        <g opacity="0.42"><path d="M0 300 C160 250 275 320 420 280 S650 235 800 284 S1040 340 1200 270 V400 H0 Z" fill="#a78bfa"/></g>
        <path d="M0 338 C210 300 350 377 560 332 S940 292 1200 345 V400 H0 Z" fill="#020617" opacity="0.72"/>
      </svg>
    `,
    city: `
      <svg xmlns="http://www.w3.org/2000/svg" width="1200" height="400" viewBox="0 0 1200 400">
        <defs>
          <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#020617"/><stop offset="50%" stop-color="#581c87"/><stop offset="100%" stop-color="#111827"/></linearGradient>
          <radialGradient id="neon" cx="72%" cy="22%" r="55%"><stop offset="0%" stop-color="#c084fc" stop-opacity="0.58"/><stop offset="100%" stop-color="#c084fc" stop-opacity="0"/></radialGradient>
        </defs>
        <rect width="1200" height="400" fill="url(#bg)"/><rect width="1200" height="400" fill="url(#neon)"/>
        <g opacity="0.9">
          <rect x="70" y="180" width="90" height="170" fill="#0f172a"/><rect x="190" y="120" width="120" height="230" fill="#111827"/><rect x="350" y="160" width="80" height="190" fill="#020617"/><rect x="470" y="95" width="150" height="255" fill="#111827"/><rect x="660" y="150" width="105" height="200" fill="#020617"/><rect x="810" y="105" width="130" height="245" fill="#111827"/><rect x="980" y="175" width="110" height="175" fill="#0f172a"/>
        </g>
        <g fill="#e9d5ff" opacity="0.58">
          <rect x="95" y="205" width="14" height="24"/><rect x="125" y="246" width="14" height="24"/><rect x="218" y="148" width="16" height="28"/><rect x="258" y="205" width="16" height="28"/><rect x="500" y="128" width="18" height="30"/><rect x="550" y="184" width="18" height="30"/><rect x="690" y="184" width="18" height="30"/><rect x="852" y="135" width="18" height="30"/><rect x="900" y="204" width="18" height="30"/><rect x="1010" y="205" width="18" height="30"/>
        </g>
        <path d="M0 310 C180 275 335 345 510 305 S870 265 1200 318 V400 H0 Z" fill="#000" opacity="0.44"/>
        <path d="M0 350 H1200" stroke="#a78bfa" stroke-width="3" opacity="0.45"/>
      </svg>
    `,
    cosmos: `
      <svg xmlns="http://www.w3.org/2000/svg" width="1200" height="400" viewBox="0 0 1200 400">
        <defs>
          <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#020617"/><stop offset="45%" stop-color="#312e81"/><stop offset="100%" stop-color="#000000"/></linearGradient>
          <radialGradient id="nebula" cx="53%" cy="40%" r="60%"><stop offset="0%" stop-color="#a78bfa" stop-opacity="0.52"/><stop offset="100%" stop-color="#7c3aed" stop-opacity="0"/></radialGradient>
        </defs>
        <rect width="1200" height="400" fill="url(#bg)"/><rect width="1200" height="400" fill="url(#nebula)"/>
        <g fill="#fff" opacity="0.8"><circle cx="92" cy="78" r="2"/><circle cx="180" cy="155" r="1.5"/><circle cx="345" cy="68" r="2"/><circle cx="500" cy="135" r="1.8"/><circle cx="735" cy="70" r="2"/><circle cx="900" cy="150" r="1.5"/><circle cx="1040" cy="84" r="2"/><circle cx="1120" cy="210" r="1.6"/></g>
        <ellipse cx="610" cy="210" rx="255" ry="82" fill="none" stroke="#ddd6fe" stroke-width="5" opacity="0.34" transform="rotate(-9 610 210)"/>
        <circle cx="610" cy="210" r="88" fill="#7c3aed" opacity="0.45"/><circle cx="575" cy="176" r="42" fill="#f5d0fe" opacity="0.22"/>
        <path d="M0 327 C230 282 370 360 575 315 S930 265 1200 332 V400 H0 Z" fill="#000" opacity="0.55"/>
      </svg>
    `,
  };

  const svg = scenes[scene].replace(/\s+/g, ' ').trim();

  if (typeof window !== 'undefined' && typeof window.btoa === 'function') {
    return `data:image/svg+xml;base64,${window.btoa(svg)}`;
  }

  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
};

const BANNER_PRESETS = [
  createVisualBannerPreset('library'),
  createVisualBannerPreset('forest'),
  createVisualBannerPreset('city'),
  createVisualBannerPreset('cosmos'),
];

const getProfileBannerStorageKey = (userId: string) => `plume_banner_${userId}`;

const getSafeProfileBanner = (userId: string) => {
  const savedBanner = localStorage.getItem(getProfileBannerStorageKey(userId));

  // Les anciens presets Unsplash peuvent ne rien afficher selon le réseau/CORS.
  // On les remplace automatiquement par un preset interne qui fonctionne hors ligne.
  if (!savedBanner || savedBanner.includes('images.unsplash.com')) {
    return BANNER_PRESETS[1];
  }

  return savedBanner;
};


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
  fileName = 'avatar.jpg'
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


export default function ProfileView({
  currentUser,
  authorCertification,
  viewedUser,
  onBackToMyProfile,
  onUpdateProfile,
  onUpdateAndVerifyUserStats,
  stories,
  favorites,
  onRemoveFavorite,
  onAddChapter,
  onUpdateChapter,
  onDeleteChapter,
  onUpdateStory,
  onDeleteStory,
  currentlyReading,
  completedStories,
  readLater,
  onToggleCurrentlyReading,
  onToggleCompletedStories,
  onToggleReadLater,
  onLogout,
  onSelectStory,
  onFollowAuthor,
  onOpenDiscussion,
  onViewProfile,
  allUsers = [],
  friendIds,
}: ProfileViewProps) {
  
const freshCurrentUser = allUsers?.find((u) => u.id === currentUser.id) || currentUser;

const freshViewedUser = viewedUser
  ? allUsers?.find((u) => u.id === viewedUser.id) || viewedUser
  : null;

const isOwnProfile = !freshViewedUser || freshViewedUser.id === freshCurrentUser.id;
const user = freshViewedUser || freshCurrentUser;

  const carouselRef = React.useRef<HTMLDivElement>(null);

  const scrollCarousel = (direction: 'left' | 'right') => {
    if (carouselRef.current) {
      const scrollAmount = direction === 'left' ? -240 : 240;
      carouselRef.current.scrollBy({ left: scrollAmount, behavior: 'smooth' });
    }
  };

  const [activeSubTab, setActiveSubTab] = useState<'writings' | 'favorites'>('writings');
  const [isEditingBio, setIsEditingBio] = useState(false);
  const [bioText, setBioText] = useState(user.bio);
  const [selectedGenre, setSelectedGenre] = useState(GENRES[0]);
  const [isBannerPickerOpen, setIsBannerPickerOpen] = useState(false);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [avatarImageSrc, setAvatarImageSrc] = useState<string | null>(null);
  const [avatarFileName, setAvatarFileName] = useState('avatar.jpg');
  const [avatarCrop, setAvatarCrop] = useState({ x: 0, y: 0 });
  const [avatarZoom, setAvatarZoom] = useState(1);
  const [croppedAvatarPixels, setCroppedAvatarPixels] = useState<Area | null>(null);

  const [isUploadingBanner, setIsUploadingBanner] = useState(false);
  const [bannerImageSrc, setBannerImageSrc] = useState<string | null>(null);
  const [bannerFileName, setBannerFileName] = useState('banner.jpg');
  const [bannerCrop, setBannerCrop] = useState({ x: 0, y: 0 });
  const [bannerZoom, setBannerZoom] = useState(1);
  const [croppedBannerPixels, setCroppedBannerPixels] = useState<Area | null>(null);

  // Suggestion carousel horizontal scroll index tracker to support chevrons
  const [suggestScrollIndex, setSuggestScrollIndex] = useState(0);

  // Report Modal states
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [reportTarget, setReportTarget] = useState<'account' | 'story'>('account');
  const [reportedStory, setReportedStory] = useState<Story | null>(null);
  const [selectedReportReason, setSelectedReportReason] = useState('Spam');
  const [customReportDetails, setCustomReportDetails] = useState('');
  const [activeUserListModal, setActiveUserListModal] = useState<
  | 'followers'
  | 'following'
  | 'friends'
  | 'mentions'
  | 'private_followers'
  | 'private_following'
  | null
>(null);

  // Local toggles and editable parameters for TikTok settings
  const [activeSettingsTab, setActiveSettingsTab] = useState<'account' | 'privacy' | 'reading' | 'write' | 'notifications' | 'security' | 'about'>('account');
  const [selectedSettingsSection, setSelectedSettingsSection] = useState<'account' | 'privacy' | 'reading' | 'write' | 'notifications' | 'security' | 'about' | null>(null);
  const [localEmail, setLocalEmail] = useState(currentUser.email);
  const [localUsername, setLocalUsername] = useState(currentUser.username);
  const [localBio, setLocalBio] = useState(currentUser.bio || '');
  const [localPassword, setLocalPassword] = useState('********');
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [isSavingPassword, setIsSavingPassword] = useState(false);

  const handleChangePassword = async () => {
    if (!currentPassword || !newPassword) {
      alert('Veuillez renseigner votre mot de passe actuel et le nouveau.');
      return;
    }
    if (newPassword !== confirmNewPassword) {
      alert('Les mots de passe ne correspondent pas !');
      return;
    }
    if (newPassword.length < 8 || !/[a-zA-Z]/.test(newPassword) || !/\d/.test(newPassword)) {
      alert('Le mot de passe doit contenir au moins 8 caractères, dont une lettre et un chiffre.');
      return;
    }
    setIsSavingPassword(true);
    try {
      const res = await fetch('/api/auth/change-password', {
        method: 'POST',
        // Auth via token mémoire (en-tête) et/ou cookie httpOnly.
        headers: authHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert(payload.error || 'Échec de la mise à jour du mot de passe.');
        return;
      }
      setCurrentPassword('');
      setNewPassword('');
      setConfirmNewPassword('');
      setIsChangingPassword(false);
      setShowStatusToast('Mot de passe sécurisé !');
      setTimeout(() => setShowStatusToast(null), 3000);
    } catch (e) {
      console.error('[PLUME] Erreur changement de mot de passe :', e);
      alert("Une erreur réseau s'est produite. Veuillez réessayer.");
    } finally {
      setIsSavingPassword(false);
    }
  };
  const [showStatusToast, setShowStatusToast] = useState<string | null>(null);

  // Notification toggles
  const [notifNewChapters, setNotifNewChapters] = useState(true);
  const [notifComments, setNotifComments] = useState(true);
  const [notifReplies, setNotifReplies] = useState(true);
  const [notifAbonnes, setNotifAbonnes] = useState(true);
  const [notifTrophies, setNotifTrophies] = useState(true);
  const [notifDMs, setNotifDMs] = useState(true);

  // Help topic sending state
  const [helpProblemText, setHelpProblemText] = useState('');
  const [expandedLegalSection, setExpandedLegalSection] = useState<'terms' | 'policy' | 'help' | null>(null);

  const handleSendReport = () => {
    const finalReason = selectedReportReason + (customReportDetails.trim() ? ` - Précisions: ${customReportDetails.trim()}` : '');
    
    if (reportTarget === 'account') {
      fetch(`/api/users/${user.id}/report`, {
        method: 'POST',
        // Auth via token mémoire (en-tête) et/ou cookie httpOnly.
        headers: authHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ reason: finalReason })
      })
      .then(async (res) => {
        if (!res.ok) throw new Error('Échec du signalement');
        alert(`Le compte de @${user.username} a été signalé avec succès pour : "${selectedReportReason}". Les curateurs administratifs vont examiner les faits.`);
        setIsReportModalOpen(false);
        setCustomReportDetails('');
      })
      .catch(e => {
        console.error('[PLUME] Erreur lors de l\'envoi du signalement de compte:', e);
        alert("Oups ! Une erreur réseau s'est produite lors de l'enregistrement du signalement.");
      });
    } else if (reportTarget === 'story' && reportedStory) {
      onUpdateStory(reportedStory.id, {
        isFlagged: true,
        flagReason: finalReason
      });
      
      alert(`L'œuvre "${reportedStory.title}" a été signalée avec succès pour : "${selectedReportReason}". Notre équipe éditoriale va réinterpréter la conformité de ce grimoire.`);
      setIsReportModalOpen(false);
      setReportedStory(null);
      setCustomReportDetails('');
    }
  };
  
  const [profileBanner, setProfileBanner] = useState(() => {
    return getSafeProfileBanner(user.id);
  });

  // Keep state updated, when viewed user or bio changes
  React.useEffect(() => {
    setBioText(user.bio);
    setProfileBanner(getSafeProfileBanner(user.id));
  }, [user.id, user.bio]);

  // State handles for story context menus & modals
  const [expandedMenuStoryId, setExpandedMenuStoryId] = useState<string | null>(null);
  
  // Animation states for opening book cover with 3D flip page turns
  const [animatingStory, setAnimatingStory] = useState<Story | null>(null);
  const [isBookOpening, setIsBookOpening] = useState(false);

  const triggerBookOpenAnimation = (story: Story) => {
    setAnimatingStory(story);
    setIsBookOpening(false);
    // Small delay to trigger 3D perspective rotation
    setTimeout(() => {
      setIsBookOpening(true);
    }, 50);

    // Swap to detail or reading view after the 3D book has elegantly opened
    setTimeout(() => {
      if (story.authorId === currentUser.id) {
        setSelectedStoryToManage(story);
      } else {
        onSelectStory?.(story);
      }
      setAnimatingStory(null);
      setIsBookOpening(false);
    }, 1200);
  };

  const [storyToDelete, setStoryToDelete] = useState<Story | null>(null);
  const [showAllAchievements, setShowAllAchievements] = useState(false);
  const [achievementsTab, setAchievementsTab] = useState<'reader' | 'author' | 'simulator'>('reader');
  const [achievementsSearch, setAchievementsSearch] = useState('');
  // Badge sélectionné pour afficher son énigme (clic sur n'importe quel trophée,
  // y compris les badges cachés qui conservent leur apparence « ??? »).
  const [selectedAchievement, setSelectedAchievement] = useState<Achievement | null>(null);
  const [simulateAdminView, setSimulateAdminView] = useState(false);

  // Settings Panel States
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [selectedRoleType, setSelectedRoleType] = useState<UserRole>(currentUser.role);
  const [showRoleChangeConfirm, setShowRoleChangeConfirm] = useState(false);
  
  // Custom metadata editor for ProfileView
  const [editingStoryMeta, setEditingStoryMeta] = useState<Story | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [editGenre, setEditGenre] = useState('');
  const [editCategory, setEditCategory] = useState('');
  const [editAmbiance, setEditAmbiance] = useState('');
  const [editFormat, setEditFormat] = useState('');
  const [editAgeRating, setEditAgeRating] = useState<'all' | '12' | '16' | '18'>('all');
  const [editTags, setEditTags] = useState('');

  const handleOpenEditStoryMeta = (story: Story) => {
    setEditingStoryMeta(story);
    setEditTitle(story.title);
    setEditDesc(story.description);
    setEditGenre(story.genre);
    setEditCategory(story.category || 'Roman');
    setEditAmbiance(story.ambiance || 'Mystérieux');
    setEditFormat(story.format || 'Roman Fleuve');
    setEditAgeRating(story.ageRating || 'all');
    setEditTags((story.tags || []).join(', '));
  };

  const handleSaveStoryMetaSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingStoryMeta || !editTitle.trim() || !editDesc.trim()) return;

    const tagsArray = editTags.split(',').map(t => t.trim()).filter(Boolean);

    onUpdateStory(editingStoryMeta.id, {
      title: editTitle,
      description: editDesc,
      genre: editGenre,
      category: editCategory,
      ambiance: editAmbiance,
      format: editFormat,
      ageRating: editAgeRating,
      tags: tagsArray
    });

    setEditingStoryMeta(null);
  };

  // Library tab filter
  const [libFilter, setLibFilter] = useState<'all' | 'in_progress' | 'completed' | 'favorites' | 'read_later'>('all');

  // Selected story for detail drawer & chapters management
  const [selectedStoryToManage, setSelectedStoryToManage] = useState<Story | null>(null);

  // Chapter editing screen overlay
  const [editingChapterInStory, setEditingChapterInStory] = useState<{ story: Story; chapter: Chapter | null } | null>(null);
  const [chapterTitle, setChapterTitle] = useState('');
  const [chapterContent, setChapterContent] = useState('');

  const handleSaveBio = () => {
    onUpdateProfile({ bio: bioText });
    setIsEditingBio(false);
  };

  const handleAddGenre = () => {
    if (currentUser.favoriteGenres.includes(selectedGenre)) return;
    onUpdateProfile({
      favoriteGenres: [...currentUser.favoriteGenres, selectedGenre]
    });
  };

  const handleRemoveGenre = (genre: string) => {
    onUpdateProfile({
      favoriteGenres: currentUser.favoriteGenres.filter(g => g !== genre)
    });
  };

  const handleSelectBanner = (url: string) => {
    if (!isOwnProfile) {
      return;
    }

    setProfileBanner(url);
    localStorage.setItem(getProfileBannerStorageKey(currentUser.id), url);
    setIsBannerPickerOpen(false);
  };

  const handleBannerUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!isOwnProfile) {
      return;
    }

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

    setBannerImageSrc(imagePreviewUrl);
    setBannerFileName(file.name || 'banner.jpg');
    setBannerCrop({ x: 0, y: 0 });
    setBannerZoom(1);
    setCroppedBannerPixels(null);
    setIsBannerPickerOpen(false);
  };

  const handleCancelBannerCrop = () => {
    if (bannerImageSrc) {
      URL.revokeObjectURL(bannerImageSrc);
    }

    setBannerImageSrc(null);
    setBannerFileName('banner.jpg');
    setBannerCrop({ x: 0, y: 0 });
    setBannerZoom(1);
    setCroppedBannerPixels(null);
  };

  const handleConfirmBannerCrop = async () => {
    if (!isOwnProfile) {
      return;
    }

    if (!bannerImageSrc || !croppedBannerPixels) return;

    try {
      setIsUploadingBanner(true);

      const croppedFile = await getCroppedImageFile(
        bannerImageSrc,
        croppedBannerPixels,
        bannerFileName
      );

      const imageUrl = await uploadImageToCloudinary(croppedFile);

      setProfileBanner(imageUrl);
      localStorage.setItem(getProfileBannerStorageKey(currentUser.id), imageUrl);

      setShowStatusToast('Bannière mise à jour avec succès !');
      setTimeout(() => setShowStatusToast(null), 3000);
      handleCancelBannerCrop();
    } catch (error) {
      console.error('[PLUME] Erreur upload bannière Cloudinary:', error);
      alert("Impossible d'envoyer la bannière. Vérifiez Cloudinary ou la taille du fichier.");
    } finally {
      setIsUploadingBanner(false);
    }
  };

  const handleAvatarUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
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

    setAvatarImageSrc(imagePreviewUrl);
    setAvatarFileName(file.name || 'avatar.jpg');
    setAvatarCrop({ x: 0, y: 0 });
    setAvatarZoom(1);
    setCroppedAvatarPixels(null);
  };

  const handleCancelAvatarCrop = () => {
    if (avatarImageSrc) {
      URL.revokeObjectURL(avatarImageSrc);
    }

    setAvatarImageSrc(null);
    setAvatarFileName('avatar.jpg');
    setAvatarCrop({ x: 0, y: 0 });
    setAvatarZoom(1);
    setCroppedAvatarPixels(null);
  };

  const handleConfirmAvatarCrop = async () => {
    if (!avatarImageSrc || !croppedAvatarPixels) return;

    try {
      setIsUploadingAvatar(true);

      const croppedFile = await getCroppedImageFile(
        avatarImageSrc,
        croppedAvatarPixels,
        avatarFileName
      );

      const imageUrl = await uploadImageToCloudinary(croppedFile);

      onUpdateProfile({
        avatar: imageUrl,
      });

      setShowStatusToast('Avatar mis à jour avec succès !');
      setTimeout(() => setShowStatusToast(null), 3000);
      handleCancelAvatarCrop();
    } catch (error) {
      console.error('[PLUME] Erreur upload avatar Cloudinary:', error);
      alert("Impossible d'envoyer l'image. Vérifiez Cloudinary ou la taille du fichier.");
    } finally {
      setIsUploadingAvatar(false);
    }
  };

  // Compile personal writings
  const writtenStories = stories.filter(s => s.authorId === user.id);

  const renderSingleBook = (story: Story, globalIndex: number, isDraft: boolean) => {
    // Determine context menu position to prevent overflow/clipping on mobile edges
    const colIndex = globalIndex % 3;
    let menuPositionClass = "absolute right-0 top-7 w-44 bg-white dark:bg-[#1B1B26] border border-gray-150 dark:border-zinc-800 rounded-xl shadow-lg py-1 z-50 animate-fade-in text-left font-sans origin-top-right";
    if (colIndex === 0) {
      menuPositionClass = "absolute left-0 top-7 w-44 bg-white dark:bg-[#1B1B26] border border-gray-150 dark:border-zinc-800 rounded-xl shadow-lg py-1 z-50 animate-fade-in text-left font-sans origin-top-left";
    } else if (colIndex === 1) {
      menuPositionClass = "absolute left-1/2 -translate-x-1/2 top-7 w-44 bg-white dark:bg-[#1B1B26] border border-gray-150 dark:border-zinc-800 rounded-xl shadow-lg py-1 z-50 animate-fade-in text-left font-sans origin-top";
    }

    return (
      <div
        key={story.id}
        id={`${isDraft ? 'drf' : 'pub'}-grid-item-${story.id}`}
        onClick={() => triggerBookOpenAnimation(story)}
        className={`relative flex flex-col items-center group cursor-pointer animate-fade-in ${
          expandedMenuStoryId === story.id ? 'z-30' : 'z-10'
        }`}
      >
        <div className="relative aspect-[2/3] w-full bg-zinc-100 dark:bg-zinc-900 rounded-r-lg shrink-0 shadow-[4px_10px_16px_rgba(0,0,0,0.22)] transition duration-250 group-hover:-translate-y-2 group-hover:shadow-[8px_16px_24px_rgba(0,0,0,0.38)] border-l-[3.5px] border-black/25 dark:border-purple-650/30">
          {/* Main image clipping container */}
          <div className="absolute inset-0 rounded-r-lg overflow-hidden">
            <img 
              src={story.cover} 
              alt={story.title} 
              className="w-full h-full object-cover"
              referrerPolicy="no-referrer"
            />
            {/* Ambient page edges / physical gradients */}
            <div className="absolute inset-y-0 left-0 w-2.5 bg-gradient-to-r from-black/25 via-white/10 to-transparent pointer-events-none" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent pointer-events-none" />
          </div>
          
          {/* Embedded options trigger */}
          <div className="absolute top-1.5 right-1.5 z-20">
            <button
              id={`profile-opt-btn-${story.id}`}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setExpandedMenuStoryId(expandedMenuStoryId === story.id ? null : story.id);
              }}
              className="w-6 h-6 rounded-lg bg-black/60 hover:bg-black/85 text-white flex items-center justify-center transition border border-white/10 backdrop-blur-xs cursor-pointer shadow-sm active:scale-95"
              title="Options de l'histoire"
            >
              <MoreVertical className="w-3.5 h-3.5" />
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
                  className={menuPositionClass}
                  onClick={(e) => e.stopPropagation()}
                >
                  {isOwnProfile ? (
                    <>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setExpandedMenuStoryId(null);
                          handleOpenEditStoryMeta(story);
                        }}
                        className="w-full px-3.5 py-2 text-[10.5px] font-bold text-gray-700 dark:text-zinc-200 hover:bg-[#7C3AED]/10 hover:text-[#7C3AED] dark:hover:bg-[#7C3AED]/15 transition flex items-center gap-2 cursor-pointer"
                      >
                        <Edit className="w-3.5 h-3.5 text-zinc-400" />
                        <span>Modifier l'histoire</span>
                      </button>
                      
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setExpandedMenuStoryId(null);
                          triggerBookOpenAnimation(story);
                        }}
                        className="w-full px-3.5 py-2 text-[10.5px] font-bold text-gray-700 dark:text-zinc-200 hover:bg-[#7C3AED]/10 hover:text-[#7C3AED] dark:hover:bg-[#7C3AED]/15 transition flex items-center gap-2 cursor-pointer"
                      >
                        <FileText className="w-3.5 h-3.5 text-zinc-400" />
                        <span>Continuer l'écriture</span>
                      </button>
                      
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setExpandedMenuStoryId(null);
                          const nextStatus = story.status === 'Publié' ? 'Brouillon' : 'Publié';
                          onUpdateStory(story.id, { status: nextStatus });
                        }}
                        className="w-full px-3.5 py-2 text-[10.5px] font-bold text-gray-700 dark:text-zinc-200 hover:bg-[#7C3AED]/10 hover:text-[#7C3AED] dark:hover:bg-[#7C3AED]/15 transition flex items-center gap-2 cursor-pointer"
                      >
                        <Power className="w-3.5 h-3.5 text-zinc-400" />
                        <span>{story.status === 'Publié' ? "Dépublier l'histoire" : "Publier l'histoire"}</span>
                      </button>
                      
                      <div className="border-t border-gray-100 dark:border-zinc-850 my-1" />
                      
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setExpandedMenuStoryId(null);
                          setStoryToDelete(story);
                        }}
                        className="w-full px-3.5 py-2 text-[10.5px] font-black text-red-600 hover:bg-red-500/10 transition flex items-center gap-2 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5 text-red-500" />
                        <span>Supprimer l'histoire</span>
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setExpandedMenuStoryId(null);
                          triggerBookOpenAnimation(story);
                        }}
                        className="w-full px-3.5 py-2 text-[10.5px] font-bold text-gray-700 dark:text-zinc-200 hover:bg-[#7C3AED]/10 hover:text-[#7C3AED] dark:hover:bg-[#7C3AED]/15 transition flex items-center gap-2 cursor-pointer"
                      >
                        <BookOpen className="w-3.5 h-3.5 text-purple-500" />
                        <span>Lire l'histoire</span>
                      </button>

                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setExpandedMenuStoryId(null);
                          setReportTarget('story');
                          setReportedStory(story);
                          setIsReportModalOpen(true);
                        }}
                        className="w-full px-3.5 py-2 text-[10.5px] font-black text-red-600 hover:bg-red-500/10 transition flex items-center gap-2 cursor-pointer"
                      >
                        <ShieldAlert className="w-3.5 h-3.5 text-red-500" />
                        <span>Signaler l'histoire</span>
                      </button>
                    </>
                  )}
                </div>
              </>
            )}
          </div>
        </div>

        {/* Story Metadata Title Footer & labels */}
        <div className="mt-2 text-center w-full min-w-0 font-sans">
          <p className="text-[10px] font-serif font-black text-zinc-800 dark:text-zinc-100 truncate leading-tight group-hover:text-purple-600 transition">
            {story.title}
          </p>
          
          {isDraft ? (
            <div className="flex items-center justify-center space-x-1 text-[8px] font-mono text-zinc-400 dark:text-zinc-500 mt-1">
              <span className="bg-zinc-155 dark:bg-zinc-850 px-1.5 py-0.5 rounded font-bold uppercase tracking-wider">Brouillon</span>
            </div>
          ) : (
            <div className="flex items-center justify-center space-x-1.5 text-[8px] font-mono text-zinc-450 dark:text-zinc-500 mt-1">
              <span className="flex items-center">
                <Eye className="w-2.5 h-2.5 mr-0.5" />
                {story.views}
              </span>
              <span>•</span>
              <span className="flex items-center">
                <Heart className="w-2.5 h-2.5 text-pink-500 fill-pink-500 mr-0.5" />
                {story.likes}
              </span>
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderStoriesGrid = (filteredStories: Story[], isDraft: boolean) => {
    const showBookshelf = writtenStories.length > 7;

    if (showBookshelf) {
      // Chunk filtered stories into rows of 3 to render physical library shelves
      const rows: Story[][] = [];
      for (let i = 0; i < filteredStories.length; i += 3) {
        rows.push(filteredStories.slice(i, i + 3));
      }

      return (
        <div className="flex flex-col gap-y-12 w-full pt-4 pb-6 px-1.5">
          {rows.map((rowStories, rowIndex) => (
            <div key={rowIndex} className="relative w-full">
              {/* Shelf row content */}
              <div className="grid grid-cols-3 gap-x-4 px-2 relative z-10">
                {rowStories.map((story, indexInRow) => {
                  const globalIndex = rowIndex * 3 + indexInRow;
                  return renderSingleBook(story, globalIndex, isDraft);
                })}
              </div>
              
              {/* Wood Shelf element centered nicely under the books base */}
              <div className="absolute bottom-[-11px] left-0 right-0 h-4 bg-gradient-to-b from-[#8C5D3A] via-[#A27B5C] to-[#5C3A21] dark:from-[#2a1b11] dark:via-[#3d2719] dark:to-[#170e0a] rounded-sm shadow-[0_6px_15px_rgba(0,0,0,0.5)] border-t border-[#DDB892]/20 dark:border-[#5C2E16]/30 z-0">
                {/* Fine wood accent highlight */}
                <div className="absolute inset-x-0 top-0 h-[2px] bg-white/20 dark:bg-white/5" />
                {/* Under depth shadow within the shelf */}
                <div className="absolute inset-x-0 bottom-0 h-1 bg-black/20" />
              </div>
              {/* Drop ambient shadow underneath the shelf */}
              <div className="absolute bottom-[-19px] left-3 right-3 h-2 bg-black/30 dark:bg-black/60 blur-[4.5px] rounded-full z-[-1]" />
            </div>
          ))}
        </div>
      );
    } else {
      // Standard layout when there are <= 7 books under management
      return (
        <div className="grid grid-cols-3 gap-x-4 gap-y-10 relative z-10">
          {filteredStories.map((story, globalIndex) => renderSingleBook(story, globalIndex, isDraft))}
        </div>
      );
    }
  };

  // Total likes & views across all written stories
  const totalLikes = writtenStories.reduce((acc, curr) => acc + curr.likes, 0);
  const totalViews = writtenStories.reduce((acc, curr) => acc + curr.views, 0);
  const totalReads = writtenStories.reduce((acc, curr) => acc + curr.reads, 0);

  // Amis : liste serveur pour le profil connecté, sinon intersection follow mutuel.
  const followersList = user.followers || [];
  const followingList = user.following || [];
  const friendsList = isOwnProfile && friendIds
    ? friendIds
    : followingList.filter(id => followersList.includes(id));
  const friendsCount = friendsList.length;

  // Privacy rules for public visibility of stats categories
  const canSeeFollowing = isOwnProfile || !!user.showFollowing;
  const canSeeFollowers = isOwnProfile || !!user.showFollowers;
  const canSeeFriends = isOwnProfile || !!user.showFriends;
  const canSeeMentions = isOwnProfile || !!user.showMentions;

  // Filtered Library Stories
  const getLibraryStories = () => {
    switch (libFilter) {
      case 'in_progress':
        return stories.filter(s => currentlyReading.includes(s.id));
      case 'completed':
        return stories.filter(s => completedStories.includes(s.id));
      case 'favorites':
        return stories.filter(s => favorites.includes(s.id));
      case 'read_later':
        return stories.filter(s => readLater.includes(s.id));
      default:
        // Union of all library aspects
        return stories.filter(s => 
          favorites.includes(s.id) || 
          currentlyReading.includes(s.id) || 
          completedStories.includes(s.id) || 
          readLater.includes(s.id)
        );
    }
  };

  const libraryStories = getLibraryStories();

  // Toggle book state Publié vs Brouillon
  const handleToggleStoryPublish = (story: Story) => {
    const isCurrentlyPublished = story.status === 'Publié';
    const nextStatus = isCurrentlyPublished ? 'Brouillon' : 'Publié';
    onUpdateStory(story.id, {
      status: nextStatus
    });
    // Sync local selected object representation
    setSelectedStoryToManage({
      ...story,
      status: nextStatus
    });
  };

  // Turn chapter form draft into reality
  const handleOpenChapterEditor = (story: Story, chapterToEdit: Chapter | null) => {
    setEditingChapterInStory({ story, chapter: chapterToEdit });
    setChapterTitle(chapterToEdit ? chapterToEdit.title : `Chapitre ${story.chapters.length + 1} : `);
    setChapterContent(chapterToEdit ? chapterToEdit.content : '');
  };

  const handleSaveChapter = () => {
    if (!editingChapterInStory || !chapterTitle.trim() || !chapterContent.trim()) return;

    const { story, chapter } = editingChapterInStory;

    if (chapter) {
      onUpdateChapter(story.id, chapter.id, {
        title: chapterTitle,
        content: chapterContent
      });

      if (selectedStoryToManage && selectedStoryToManage.id === story.id) {
        setSelectedStoryToManage({
          ...selectedStoryToManage,
          chapters: selectedStoryToManage.chapters.map(ch => 
            ch.id === chapter.id ? { ...ch, title: chapterTitle, content: chapterContent } : ch
          )
        });
      }
    } else {
      const newChId = `chapter_${Date.now()}`;
      const newCh: Chapter = {
        id: newChId,
        title: chapterTitle,
        content: chapterContent,
        isPublished: true,
        publishDate: new Date().toISOString(),
        views: 0,
        reads: 0
      };

      onAddChapter(story.id, newCh);

      if (selectedStoryToManage && selectedStoryToManage.id === story.id) {
        setSelectedStoryToManage({
          ...selectedStoryToManage,
          chapters: [...selectedStoryToManage.chapters, newCh]
        });
      }
    }

    setEditingChapterInStory(null);
  };

  const getAge = (dateStr?: string) => {
    if (!dateStr) return null;
    const birth = new Date(dateStr);
    const now = new Date();
    let age = now.getFullYear() - birth.getFullYear();
    const m = now.getMonth() - birth.getMonth();
    if (m < 0 || (m === 0 && now.getDate() < birth.getDate())) {
      age--;
    }
    return age;
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 space-y-8 animate-fade-in text-left relative min-h-screen pb-32">
      
      {avatarImageSrc && (
        <div className="fixed inset-0 z-[120] bg-black/85 backdrop-blur-sm flex items-center justify-center p-4 font-sans">
          <div className="w-full max-w-md bg-white dark:bg-[#0E0E14] rounded-3xl border border-purple-500/20 shadow-2xl overflow-hidden animate-scale-up">
            <div className="px-5 py-4 border-b border-zinc-150 dark:border-zinc-850">
              <h3 className="font-serif font-black text-sm text-zinc-900 dark:text-white">
                Rogner l'avatar
              </h3>
              <p className="text-[10px] text-zinc-400 mt-1">
                Déplacez l'image et ajustez le zoom avant de valider.
              </p>
            </div>

            <div className="relative h-80 bg-black">
              <Cropper
                image={avatarImageSrc}
                crop={avatarCrop}
                zoom={avatarZoom}
                aspect={1}
                cropShape="round"
                showGrid={false}
                onCropChange={setAvatarCrop}
                onZoomChange={setAvatarZoom}
                onCropComplete={(_, croppedAreaPixels) => setCroppedAvatarPixels(croppedAreaPixels)}
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
                  value={avatarZoom}
                  onChange={(e) => setAvatarZoom(Number(e.target.value))}
                  className="w-full accent-purple-600"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={handleCancelAvatarCrop}
                  disabled={isUploadingAvatar}
                  className="py-2.5 rounded-xl bg-zinc-100 dark:bg-zinc-850 text-zinc-700 dark:text-zinc-200 text-[10px] font-black uppercase tracking-wider hover:bg-zinc-200 dark:hover:bg-zinc-800 transition disabled:opacity-50"
                >
                  Annuler
                </button>

                <button
                  type="button"
                  onClick={handleConfirmAvatarCrop}
                  disabled={isUploadingAvatar}
                  className="py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-[10px] font-black uppercase tracking-wider transition disabled:opacity-50"
                >
                  {isUploadingAvatar ? 'Envoi...' : 'Valider'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {bannerImageSrc && (
        <div className="fixed inset-0 z-[120] bg-black/85 backdrop-blur-sm flex items-center justify-center p-4 font-sans">
          <div className="w-full max-w-xl bg-white dark:bg-[#0E0E14] rounded-3xl border border-purple-500/20 shadow-2xl overflow-hidden animate-scale-up">
            <div className="px-5 py-4 border-b border-zinc-150 dark:border-zinc-850">
              <h3 className="font-serif font-black text-sm text-zinc-900 dark:text-white">
                Rogner la bannière
              </h3>
              <p className="text-[10px] text-zinc-400 mt-1">
                Déplacez l'image et ajustez le zoom pour obtenir une bannière horizontale.
              </p>
            </div>

            <div className="relative h-72 bg-black">
              <Cropper
                image={bannerImageSrc}
                crop={bannerCrop}
                zoom={bannerZoom}
                aspect={16 / 5}
                cropShape="rect"
                showGrid={true}
                onCropChange={setBannerCrop}
                onZoomChange={setBannerZoom}
                onCropComplete={(_, croppedAreaPixels) => setCroppedBannerPixels(croppedAreaPixels)}
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
                  value={bannerZoom}
                  onChange={(e) => setBannerZoom(Number(e.target.value))}
                  className="w-full accent-purple-600"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={handleCancelBannerCrop}
                  disabled={isUploadingBanner}
                  className="py-2.5 rounded-xl bg-zinc-100 dark:bg-zinc-850 text-zinc-700 dark:text-zinc-200 text-[10px] font-black uppercase tracking-wider hover:bg-zinc-200 dark:hover:bg-zinc-800 transition disabled:opacity-50"
                >
                  Annuler
                </button>

                <button
                  type="button"
                  onClick={handleConfirmBannerCrop}
                  disabled={isUploadingBanner}
                  className="py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-[10px] font-black uppercase tracking-wider transition disabled:opacity-50"
                >
                  {isUploadingBanner ? 'Envoi...' : 'Valider'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 1. EDITABLE PROFILE BANNER */}
      <div className="relative h-48 rounded-3xl overflow-hidden shadow-lg select-none group border border-purple-100 dark:border-zinc-800">
        <img 
          src={profileBanner} 
          alt="Bannière d'auteur" 
          className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-102"
          onError={() => setProfileBanner(BANNER_PRESETS[0])}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/25 to-transparent" />
        
        {/* Paramètres Button — UNIQUEMENT sur son propre profil. */}
        {isOwnProfile && (
          <button
            id="profile-settings-btn"
            onClick={() => {
              setSelectedRoleType(currentUser.role);
              setIsSettingsOpen(true);
            }}
            className="absolute top-4 right-4 bg-black/50 hover:bg-black/80 text-white rounded-xl p-2.5 transition backdrop-blur-md cursor-pointer shadow-md border border-white/5 active:scale-95 z-20"
            title="Paramètres de profil"
          >
            <Settings className="w-4 h-4 text-purple-200" />
          </button>
        )}

        {/* Banner selector activator button */}
        {isOwnProfile && (
          <button
            id="banner-picker-toggle"
            onClick={() => setIsBannerPickerOpen(!isBannerPickerOpen)}
            className="absolute top-4 right-16 bg-black/50 hover:bg-black/70 text-white rounded-xl p-2.5 text-xs flex items-center space-x-1 transition backdrop-blur-md whitespace-nowrap cursor-pointer shadow-md border border-white/5 z-20"
          >
            <ImageIcon className="w-4 h-4 text-purple-200 shrink-0" />
            <span className="text-[10px] uppercase font-bold tracking-wider hidden sm:inline">Changer de Décor</span>
          </button>
        )}

        {isOwnProfile && isBannerPickerOpen && (
          <div className="absolute top-16 right-4 bg-white dark:bg-[#1B1B26] border border-gray-150 dark:border-zinc-800 rounded-2xl p-3 z-50 flex space-x-2 shadow-2xl animate-fade-in">
            <label
              htmlFor="banner-upload"
              className="w-14 h-14 rounded-xl overflow-hidden border border-dashed border-purple-500/50 hover:border-purple-600 transition hover:scale-105 shadow-sm flex flex-col items-center justify-center cursor-pointer bg-purple-500/5 text-purple-600 dark:text-purple-300"
              title="Importer une bannière"
            >
              {isUploadingBanner ? (
                <span className="text-[9px] font-black animate-pulse">...</span>
              ) : (
                <>
                  <ImageIcon className="w-4 h-4" />
                  <span className="text-[7px] font-black uppercase mt-1">Image</span>
                </>
              )}
            </label>

            <input
              id="banner-upload"
              type="file"
              accept="image/*"
              disabled={isUploadingBanner}
              onChange={handleBannerUpload}
              className="hidden"
            />

            {BANNER_PRESETS.map((preset, idx) => (
              <button
                key={preset}
                id={`preset-banner-btn-${idx}`}
                onClick={() => handleSelectBanner(preset)}
                className="w-14 h-14 rounded-xl overflow-hidden border border-gray-200 hover:border-purple-600 transition hover:scale-105 shadow-sm"
              >
                <img
                  src={preset}
                  alt={`Bannière prédéfinie ${idx + 1}`}
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    e.currentTarget.style.display = 'none';
                  }}
                />
              </button>
            ))}
          </div>
        )}

        {/* Floating verification badge */}
        <div className="absolute bottom-4 left-5 flex items-center space-x-1.5 bg-purple-900/95 text-white font-extrabold text-[9px] px-3 py-1.5 rounded-lg uppercase tracking-wider select-none shadow-md backdrop-blur-xs">
          <BookMarked className="w-3.5 h-3.5 text-purple-300 animate-pulse" />
          <span>Curateur Littéraire</span>
        </div>
      </div>

      {/* 2. OVERLAPPING AVATAR HERO COMPOSITION */}
      <div className="flex flex-col items-center justify-center text-center space-y-4 -mt-20 sticky z-10">
        <div className="relative">
          <div className="absolute inset-0 rounded-full bg-gradient-to-tr from-purple-900 via-purple-600 to-black p-[3.5px] shadow-lg">
            <div className="w-full h-full rounded-full bg-white dark:bg-black" />
          </div>

          <img
            src={user.avatar}
            alt={user.username}
            className="w-28 h-28 rounded-full object-cover relative z-10 p-[5px] bg-white dark:bg-black shadow-md mx-auto"
            referrerPolicy="no-referrer"
          />

          {isOwnProfile && (
            <>
              <label
                htmlFor="avatar-upload"
                className="absolute bottom-1 right-1 z-20 w-8 h-8 rounded-full bg-purple-600 hover:bg-purple-700 text-white flex items-center justify-center cursor-pointer shadow-lg border-2 border-white dark:border-black transition"
                title="Changer l'avatar"
              >
                {isUploadingAvatar ? (
                  <span className="text-[9px] font-black animate-pulse">...</span>
                ) : (
                  <ImageIcon className="w-4 h-4" />
                )}
              </label>

              <input
                id="avatar-upload"
                type="file"
                accept="image/*"
                disabled={isUploadingAvatar}
                onChange={handleAvatarUpload}
                className="hidden"
              />
            </>
          )}
        </div>

        {/* Display name, birthday and gender */}
        <div className="flex flex-col items-center">
          <h3 className="text-2xl font-serif font-black text-gray-900 dark:text-white flex items-center gap-1.5 justify-center">
            {user.username}
            {user.isVerified && <VerifiedBadge size="md" />}
          </h3>
          
          <p className="text-[10px] text-zinc-400 font-mono tracking-widest uppercase mt-1">
            PLUME ID: <span className="font-bold text-purple-600">@{user.id}</span>
            {user.gender && (
              <span className="mx-2 text-zinc-300 dark:text-zinc-700">•</span>
            )}
            {user.gender && (
              <span className="font-sans font-bold text-zinc-650 dark:text-zinc-300 bg-zinc-100 dark:bg-zinc-850 px-2 py-0.5 rounded-md inline-block uppercase text-[8px]">{user.gender}</span>
            )}
          </p>

          {/* Mention de popularité globale */}
          <div className="mt-2.5 flex items-center justify-center">
            <span className="px-3 py-1 rounded-full text-[9px] font-bold uppercase tracking-wider bg-purple-500/10 text-purple-700 dark:text-purple-300 border border-purple-550/15 flex items-center gap-1">
              {totalViews >= 2000 ? "Popularité : Légendaire ✨" :
               totalViews >= 1000 ? "Popularité : Très apprécié 🌟" :
               totalViews >= 500 ? "Popularité : En plein essor 📈" :
               "Popularité : Nouvelle Plume 🌱"}
            </span>
          </div>
        </div>

        {/* INTERACTION ACTIONS FOR OTHER PROFILES */}
        {!isOwnProfile && (
          <div className="flex items-center justify-center gap-2.5 w-full max-w-sm mx-auto pt-1.5 select-none font-sans">
            {/* BUTTON 1: SUIVRE / NE PLUS SUIVRE */}
            <button
              id={`profile-follow-action-${user.id}`}
              onClick={() => onFollowAuthor?.(user.id)}
              className={`flex-1 py-2.5 px-4 rounded-xl text-xs font-black uppercase tracking-wider transition-all duration-200 cursor-pointer flex items-center justify-center space-x-1.5 shadow ${
                currentUser.following.includes(user.id)
                  ? 'bg-zinc-800 dark:bg-zinc-200 text-white dark:text-zinc-950 hover:bg-zinc-900'
                  : 'bg-purple-600 hover:bg-purple-700 text-white hover:scale-[1.02] active:scale-95'
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              <span>
                {currentUser.following.includes(user.id) ? 'Ne plus suivre' : 'Suivre'}
              </span>
            </button>

            {/* BUTTON 2: MESSAGE */}
            <button
              id={`profile-message-action-${user.id}`}
              onClick={() => onOpenDiscussion?.(user.id)}
              className="flex-1 py-2.5 px-4 bg-white dark:bg-black text-purple-600 dark:text-purple-400 border border-purple-500/30 hover:border-purple-650 hover:bg-purple-500/5 rounded-xl text-xs font-black uppercase tracking-wider transition duration-200 cursor-pointer flex items-center justify-center space-x-1.5 shadow-sm"
            >
              <Mail className="w-3.5 h-3.5" />
              <span>Message</span>
            </button>

            {/* BUTTON 3: SIGNALER */}
            <button
              id={`profile-report-toggle-${user.id}`}
              onClick={() => {
                setReportTarget('account');
                setIsReportModalOpen(true);
              }}
              className="py-2.5 px-3 bg-red-500/10 text-red-650 dark:text-red-400 hover:bg-red-500/20 hover:text-red-700 border border-red-500/20 hover:border-red-500/40 rounded-xl text-xs font-black transition duration-200 cursor-pointer flex items-center justify-center"
              title="Signaler ce profil"
            >
              <ShieldAlert className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* 3. LITERARY CABINET STATS GRID (Four compact columns on one row: Suivis | Abonnés | Amis | Mentions) */}
        <div className="flex items-center justify-around py-2.5 w-full bg-zinc-50 dark:bg-zinc-900/35 border border-purple-500/10 dark:border-zinc-850/60 rounded-2xl shadow-sm px-1.5 sm:px-3 select-none flex-nowrap overflow-hidden">
          {/* Suivis */}
          <button
            id={`profile-stat-following-${user.id}`}
            onClick={() => setActiveUserListModal('following')}
            className="flex-1 flex flex-col items-center justify-center p-1 sm:p-2 rounded-xl hover:bg-purple-500/5 dark:hover:bg-purple-950/10 transition cursor-pointer group min-w-0"
          >
            <span className="font-serif text-sm sm:text-base md:text-lg font-black text-purple-600 dark:text-purple-400 leading-tight group-hover:scale-105 transition truncate">
              {canSeeFollowing ? user.following.length : <Lock className="w-3 h-3 text-zinc-400 dark:text-zinc-500 inline-block mb-0.5" />}
            </span>
            <span className="text-zinc-500 dark:text-zinc-400 text-[7px] sm:text-[8px] md:text-[8.5px] uppercase font-bold tracking-wider sm:tracking-widest mt-0.5 truncate">Suivis</span>
          </button>

          <div className="border-r border-purple-100 dark:border-zinc-850 h-5 my-auto shrink-0" />

          {/* Abonnés */}
          <button
            id={`profile-stat-followers-${user.id}`}
            onClick={() => setActiveUserListModal('followers')}
            className="flex-1 flex flex-col items-center justify-center p-1 sm:p-2 rounded-xl hover:bg-purple-500/5 dark:hover:bg-purple-950/10 transition cursor-pointer group min-w-0"
          >
            <span className="font-serif text-sm sm:text-base md:text-lg font-black text-purple-600 dark:text-purple-400 leading-tight group-hover:scale-105 transition truncate">
              {canSeeFollowers ? (user.followers?.length || 0) : <Lock className="w-3 h-3 text-zinc-400 dark:text-zinc-500 inline-block mb-0.5" />}
            </span>
            <span className="text-zinc-500 dark:text-zinc-400 text-[7px] sm:text-[8px] md:text-[8.5px] uppercase font-bold tracking-wider sm:tracking-widest mt-0.5 truncate">Abonnés</span>
          </button>

          <div className="border-r border-purple-100 dark:border-zinc-850 h-5 my-auto shrink-0" />

          {/* Amis */}
          <button
            id={`profile-stat-friends-${user.id}`}
            onClick={() => setActiveUserListModal('friends')}
            className="flex-1 flex flex-col items-center justify-center p-1 sm:p-2 rounded-xl hover:bg-purple-500/5 dark:hover:bg-purple-950/10 transition cursor-pointer group min-w-0"
          >
            <span className="font-serif text-sm sm:text-base md:text-lg font-black text-purple-600 dark:text-purple-400 leading-tight group-hover:scale-105 transition truncate">
              {canSeeFriends ? friendsCount : <Lock className="w-3 h-3 text-zinc-400 dark:text-zinc-500 inline-block mb-0.5" />}
            </span>
            <span className="text-zinc-500 dark:text-zinc-400 text-[7px] sm:text-[8px] md:text-[8.5px] uppercase font-bold tracking-wider sm:tracking-widest mt-0.5 truncate">Amis</span>
          </button>

          <div className="border-r border-purple-100 dark:border-zinc-850 h-5 my-auto shrink-0" />

          {/* Mentions */}
          <button
            id={`profile-stat-mentions-${user.id}`}
            onClick={() => setActiveUserListModal('mentions')}
            className="flex-1 flex flex-col items-center justify-center p-1 sm:p-2 rounded-xl hover:bg-purple-500/5 dark:hover:bg-purple-950/10 transition cursor-pointer group min-w-0"
          >
            <span className="font-serif text-sm sm:text-base md:text-lg font-black text-purple-600 dark:text-purple-400 leading-tight group-hover:scale-105 transition truncate">
              {canSeeMentions ? totalLikes : <Lock className="w-3 h-3 text-zinc-400 dark:text-zinc-500 inline-block mb-0.5" />}
            </span>
            <span className="text-zinc-500 dark:text-zinc-400 text-[7px] sm:text-[8px] md:text-[8.5px] uppercase font-bold tracking-wider sm:tracking-widest mt-0.5 truncate">Mentions</span>
          </button>
        </div>

        {/* LIVRES LUS ET LIVRES ÉCRITS DISPLAY */}
        {(() => {
          const userStatsObj = getUserStats(user.id, user.role, user.username);
          const booksReadCount = userStatsObj.completedReadCycles;
          const booksWrittenCount = writtenStories.length;

          const isLecteurAccount = user.role === 'Lecteur';
          const isAuteurAccount = user.role === 'Auteur';
          // Les administrateurs affichent à la fois lectures et écritures.
          const isMixedAccount = user.role === 'Administrateur';

          const displaysRead = (isLecteurAccount || isMixedAccount) && (user.showBooksRead ?? false);
          const displaysWritten = (isAuteurAccount || isMixedAccount) && (user.showBooksWritten ?? false);

          if (!displaysRead && !displaysWritten) return null;

          return (
            <div className="w-full bg-white dark:bg-[#0E0E14] border border-purple-500/10 dark:border-purple-900/15 p-4 rounded-2xl text-left space-y-3 shadow-xs select-none animation-fade-in">
              <div className="flex items-center space-x-2 text-[10px] font-mono font-black uppercase text-zinc-450 dark:text-zinc-500 tracking-wider">
                <BookOpen className="w-3.5 h-3.5 text-purple-600 animate-pulse" />
                <span>Activité Littéraire</span>
              </div>
              
              <div className={`grid ${displaysRead && displaysWritten ? 'grid-cols-2' : 'grid-cols-1'} gap-3`}>
                {displaysRead && (
                  <div className="bg-zinc-50 dark:bg-zinc-900/35 border border-purple-500/5 dark:border-zinc-850/60 p-3 rounded-2xl text-center flex flex-col justify-center">
                    <span className="text-[9px] text-zinc-400 dark:text-zinc-500 uppercase font-black tracking-widest leading-none">Livres lus</span>
                    <span className="font-serif text-lg font-black text-purple-600 dark:text-purple-400 mt-1">
                      {booksReadCount}
                    </span>
                  </div>
                )}
                {displaysWritten && (
                  <div className="bg-zinc-50 dark:bg-zinc-900/35 border border-purple-500/5 dark:border-zinc-850/60 p-3 rounded-2xl text-center flex flex-col justify-center">
                    <span className="text-[9px] text-zinc-400 dark:text-zinc-500 uppercase font-black tracking-widest leading-none">Livres écrits</span>
                    <span className="font-serif text-lg font-black text-purple-600 dark:text-purple-400 mt-1">
                      {booksWrittenCount}
                    </span>
                  </div>
                )}
              </div>
            </div>
          );
        })()}

        {/* 4. BIOGRAPHY PARCHMENT BOX */}
        <div className="relative w-full bg-white dark:bg-zinc-900/15 p-5 rounded-2xl border border-purple-500/15 dark:border-zinc-800/80 shadow-xs text-left space-y-4">
          <div className="absolute top-3.5 right-3.5">
            {isOwnProfile && !isEditingBio && (
              <button
                id="tiktok-modifier-profil-btn"
                onClick={() => {
                  setBioText(user.bio);
                  setIsEditingBio(true);
                }}
                className="p-1 px-2.5 bg-zinc-150 hover:bg-zinc-200 dark:bg-zinc-850 dark:hover:bg-zinc-800 text-zinc-650 dark:text-zinc-400 rounded-lg text-[9px] font-black uppercase tracking-wider transition duration-250 cursor-pointer flex items-center gap-1 border border-zinc-200 dark:border-zinc-850"
              >
                <Edit className="w-3 h-3" />
                Dossier
              </button>
            )}
          </div>

          <div className="flex items-center space-x-2 text-[10px] font-bold uppercase text-zinc-500 tracking-wider">
            <PenTool className="w-4 h-4 text-purple-600" />
            <span>BIOGRAPHIE</span>
          </div>

          {!isEditingBio ? (
            <p className="text-xs text-zinc-650 dark:text-zinc-300 italic font-serif leading-relaxed px-1">
              {currentUser.bio || "Aucune biographie rédigée. Évoquez votre univers littéraire et invitez vos futurs lecteurs dans vos songes !"}
            </p>
          ) : (
            <div className="space-y-4 pt-1 shadow-inner rounded-xl p-2 bg-zinc-50 dark:bg-zinc-950/40">
              <textarea
                id="tiktok-bio-textarea"
                value={bioText}
                onChange={(e) => setBioText(e.target.value)}
                rows={3}
                placeholder="Racontez votre passion d'écriture et de lecture..."
                className="w-full bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-xs rounded-xl p-3 focus:outline-none focus:ring-1 focus:ring-purple-600 dark:text-white"
              />
              
              <div className="space-y-2 pt-1">
                <label className="block text-[10px] font-black uppercase text-zinc-400 font-sans tracking-widest">Mes Genres de prédilection</label>
                <div className="flex flex-wrap gap-1 bg-white dark:bg-zinc-900 p-2 rounded-xl border border-zinc-200 dark:border-zinc-850">
                  {currentUser.favoriteGenres.length === 0 && (
                    <span className="text-[10px] text-zinc-400 italic">Aucun genre à l'affiche.</span>
                  )}
                  {currentUser.favoriteGenres.map(g => (
                    <span key={g} className="px-2 py-0.5 rounded bg-purple-500/10 text-purple-750 dark:text-purple-300 text-[9px] font-bold border border-purple-500/10 flex items-center space-x-1">
                      <span>{g}</span>
                      <button
                        id={`remove-fav-genre-${g.replace(/\s+/g, '-')}`}
                        onClick={() => handleRemoveGenre(g)}
                        className="text-red-400 hover:text-red-500 font-bold px-0.5 animate-pulse"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>

                <div className="flex items-center space-x-1.5 pt-1">
                  <select
                    id="genre-picker-profile"
                    value={selectedGenre}
                    onChange={(e) => setSelectedGenre(e.target.value)}
                    className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-[10px] rounded px-2.5 py-1 focus:outline-none text-zinc-800 dark:text-zinc-100"
                  >
                    {GENRES.map(g => <option key={g} value={g}>{g}</option>)}
                  </select>
                  <button
                    id="add-genre-btn"
                    onClick={handleAddGenre}
                    className="bg-purple-600 hover:bg-purple-750 text-white rounded px-3 py-1 text-[10px] font-bold transform transition active:scale-95 cursor-pointer"
                  >
                    Ajouter
                  </button>
                </div>
              </div>

              <div className="flex justify-end space-x-2 pt-2 border-t border-zinc-200/50 dark:border-zinc-800">
                <button
                  id="cancel-bio-btn"
                  onClick={() => {
                    setBioText(currentUser.bio);
                    setIsEditingBio(false);
                  }}
                  className="px-3 py-1 bg-zinc-100 dark:bg-zinc-850 text-zinc-650 text-[10px] rounded-lg font-bold cursor-pointer"
                >
                  Annuler
                </button>
                <button
                  id="save-bio-btn"
                  onClick={handleSaveBio}
                  className="px-4 py-1 bg-purple-600 hover:bg-purple-700 text-white text-[10px] rounded-lg font-bold transition cursor-pointer"
                >
                  Sauvegarder
                </button>
              </div>
            </div>
          )}

          {!isEditingBio && currentUser.favoriteGenres.length > 0 && (
            <div className="flex flex-wrap gap-1 pt-1.5 border-t border-zinc-100 dark:border-zinc-800/60 font-sans">
              {currentUser.favoriteGenres.map(g => (
                <span key={g} className="text-[9px] font-bold bg-purple-500/10 text-purple-750 dark:text-purple-300 border border-purple-500/15 px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                  {g}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* COMPACT & ELEGANT ACCOMPLISHMENTS CARD DISPLAY */}
      {(() => {
        const uStats = getUserStats(currentUser.id, currentUser.role, currentUser.username);
        const rAchievements = generateReaderAchievements(uStats);
        const aAchievements = generateAuthorAchievements(uStats);
        
        const unlockedR = rAchievements.filter(a => a.isUnlocked).length;
        // La certification d'auteur est calculée par le serveur (source du badge) :
        // on l'utilise si disponible pour rester cohérent, sinon repli local.
        const unlockedA = authorCertification ? authorCertification.authorUnlocked : aAchievements.filter(a => a.isUnlocked).length;

        const pctR = Math.round((unlockedR / 125) * 100);
        const pctA = authorCertification ? authorCertification.authorPercent : Math.round((unlockedA / 100) * 100);

        const isReader = currentUser.role === 'Lecteur';
        const isAuthor = currentUser.role === 'Auteur';
        const isMixedOrAdmin = !isReader && !isAuthor;

        const totalObtained = isReader ? unlockedR : isAuthor ? unlockedA : (unlockedR + unlockedA);
        const totalPossible = isReader ? 125 : isAuthor ? 100 : 225;

        return (
          <div className="bg-white dark:bg-[#0E0E14] border border-purple-500/10 dark:border-purple-900/15 p-4 rounded-2xl space-y-4 font-sans text-left shadow-lg">
            <div className="flex justify-between items-center pb-2 border-b border-zinc-100 dark:border-zinc-800">
              <div className="flex items-center space-x-2">
                <Trophy className="w-4 h-4 text-purple-600 fill-purple-600/5 shrink-0" />
                <span className="font-bold text-[10px] uppercase tracking-wider text-zinc-700 dark:text-zinc-300">Mon Palmarès Littéraire</span>
              </div>
              <span className="text-[10px] font-mono font-black text-purple-600 dark:text-purple-300 bg-purple-500/10 px-2.5 py-0.5 rounded-full">
                {totalObtained} / {totalPossible} Obtenus
              </span>
            </div>

            {/* Grid of progress indicators */}
            <div className={`grid grid-cols-1 ${isMixedOrAdmin ? 'md:grid-cols-2' : ''} gap-4`}>
              {/* Reader Progression */}
              {(isReader || isMixedOrAdmin) && (
                <div className="space-y-1.5">
                  <div className="flex justify-between text-[11px] font-bold">
                    <span className="text-gray-900 dark:text-gray-100 flex items-center gap-1">
                      <BookOpen className="w-3.5 h-3.5 text-purple-500 shrink-0" />
                      <span>Progression Lecteur</span>
                    </span>
                    <span className="text-purple-600 dark:text-purple-400 font-mono">{unlockedR} / 125 ({pctR}%)</span>
                  </div>
                  <div className="w-full bg-zinc-100 dark:bg-zinc-850 h-2 rounded-full overflow-hidden border border-zinc-200/40 dark:border-zinc-800/20">
                    <div 
                      className="bg-purple-600 h-full rounded-full transition-all duration-500" 
                      style={{ width: `${Math.min(100, pctR)}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-[9px] text-zinc-400">
                    <span>Certification : 80% débloqués (100)</span>
                    <span>{pctR >= 80 ? '✓ Requis atteint' : `Encore ${Math.max(0, 100 - unlockedR)}`}</span>
                  </div>
                </div>
              )}

              {/* Author Progression */}
              {(isAuthor || isMixedOrAdmin) && (
                <div className="space-y-1.5">
                  <div className="flex justify-between text-[11px] font-bold">
                    <span className="text-gray-900 dark:text-gray-100 flex items-center gap-1">
                      <PenTool className="w-3.5 h-3.5 text-purple-500 shrink-0" />
                      <span>Progression Auteur</span>
                    </span>
                    <span className="text-purple-600 dark:text-purple-400 font-mono">{unlockedA} / 100 ({pctA}%)</span>
                  </div>
                  <div className="w-full bg-zinc-100 dark:bg-zinc-850 h-2 rounded-full overflow-hidden border border-zinc-200/40 dark:border-zinc-800/20">
                    <div 
                      className="bg-purple-600 h-full rounded-full transition-all duration-500" 
                      style={{ width: `${Math.min(100, pctA)}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-[9px] text-zinc-400">
                    <span>Certification : 80% débloqués (80)</span>
                    <span>{pctA >= 80 ? '✓ Requis atteint' : `Encore ${Math.max(0, 80 - unlockedA)}`}</span>
                  </div>
                </div>
              )}
            </div>

            {/* Certification and Actions bar */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-center pt-2 border-t border-zinc-100 dark:border-zinc-850/50">
              <div className="flex items-center space-x-2 text-[10px] text-zinc-500">
                <Award className="w-4 h-4 text-purple-500 shrink-0" />
                <span>
                  {currentUser.isVerified ? (
                    <span className="text-blue-500 font-bold bg-blue-500/10 px-2 py-0.5 rounded-full border border-blue-500/15 flex items-center gap-1.5">
                      <VerifiedBadge size="xs" /> Verified (Authenticité littéraire de l'archipel)
                    </span>
                  ) : currentUser.role === 'Auteur' ? (
                    <span className="text-zinc-500 bg-zinc-100 dark:bg-zinc-900 px-2 py-0.5 rounded-full">
                      Progression vers la certification ({pctA}% / 80%)
                    </span>
                  ) : (
                    <span className="text-zinc-500 bg-zinc-100 dark:bg-zinc-900 px-2 py-0.5 rounded-full">
                      Accomplissements actifs · certification réservée aux auteurs
                    </span>
                  )}
                </span>
              </div>

              <div className="flex justify-end">
                <button
                  id="profile-see-all-achievements"
                  onClick={() => {
                    const primaryTab = currentUser.role === 'Auteur' ? 'author' : 'reader';
                    setAchievementsTab(primaryTab);
                    setShowAllAchievements(true);
                  }}
                  className="w-full sm:w-auto px-4 py-2 border border-purple-500/20 bg-zinc-50 hover:bg-purple-600 hover:text-white dark:bg-zinc-900 dark:hover:bg-purple-600 text-purple-600 dark:text-purple-300 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all duration-200 flex items-center justify-center gap-1 cursor-pointer focus:outline-none"
                >
                  <span>Gérer & voir tout</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* 5. TABS NAVIGATION WITH HIGHLY LITERARY MOOD */}
      <div className="grid grid-cols-2 border-b border-zinc-200 dark:border-zinc-800 select-none bg-zinc-50 dark:bg-zinc-900/10 p-1 rounded-2xl">
        <button
          id="profile-tab-writings"
          onClick={() => setActiveSubTab('writings')}
          className={`py-3 rounded-xl flex flex-col items-center justify-center transition-all cursor-pointer ${
            activeSubTab === 'writings'
              ? 'bg-purple-600 text-white font-black shadow-md'
              : 'text-zinc-500 hover:text-purple-600 dark:hover:text-purple-400'
          }`}
        >
          <BookMarked className="w-4 h-4" />
          <span className="text-[9px] uppercase font-bold mt-1">Écritoire ({writtenStories.length})</span>
        </button>

        <button
          id="profile-tab-favorites"
          onClick={() => setActiveSubTab('favorites')}
          className={`py-3 rounded-xl flex flex-col items-center justify-center transition-all cursor-pointer ${
            activeSubTab === 'favorites'
              ? 'bg-purple-600 text-white font-black shadow-md'
              : 'text-zinc-500 hover:text-purple-600 dark:hover:text-purple-400'
          }`}
        >
          <BookOpen className="w-4 h-4" />
          <span className="text-[9px] uppercase font-bold mt-1">Étagère de Lectures</span>
        </button>
      </div>

      {/* 6. COZY BOOKSHELVES TAB CONTENTS */}
      <div className="space-y-4 pt-1">
        
        {/* TAB 1: Mon Cabinet d'Écriture */}
        {activeSubTab === 'writings' && (
          <div className="space-y-8 animate-fade-in text-left">
            {writtenStories.length === 0 ? (
              <div className="text-center py-16 px-4 bg-zinc-50/50 dark:bg-zinc-900/20 border border-zinc-200/50 dark:border-zinc-800 rounded-3xl">
                <PenTool className="w-10 h-10 mx-auto text-purple-600 stroke-1" />
                <h4 className="font-serif font-bold text-xs text-zinc-700 dark:text-zinc-300 mt-2">Écritoire encore vide</h4>
                <p className="text-[11px] text-zinc-400 mt-1 max-w-xs mx-auto">
                  Allez sur l'Atelier "Écrire" pour enfanter votre première épopée !
                </p>
              </div>
            ) : (
              <div className="space-y-8 text-left">
                
                {/* SHELF 1: Published Writings */}
                <div className="space-y-3">
                  <div className="flex items-center space-x-1.5 border-b border-purple-500/15 pb-2">
                    <span className="h-2 w-2 rounded-full bg-[#7C3AED] block animate-pulse" />
                    <h4 className="font-serif font-black text-sm text-zinc-800 dark:text-neutral-200">
                      Récits Publiés & Parus ({writtenStories.filter(s => s.status === 'Publié').length})
                    </h4>
                  </div>
                  <p className="text-[10px] text-zinc-400 italic font-sans leading-relaxed">
                    Œuvres parues à la vue du public. Cliquez sur l'une d'elles pour administrer les chapitres parus.
                  </p>

                  {writtenStories.filter(s => s.status === 'Publié').length === 0 ? (
                    <div className="py-8 bg-zinc-100/50 dark:bg-black/20 text-center rounded-2xl border border-dashed border-zinc-200 dark:border-purple-900/15">
                      <span className="text-xs text-zinc-400 italic">Aucun livre n'a encore été mis sous presse.</span>
                    </div>
                  ) : (
                    <div className="relative pt-6 pb-2 px-6 bg-zinc-50/50 dark:bg-zinc-950/10 border border-purple-500/15 dark:border-zinc-900 rounded-2xl shadow-sm">
                      {renderStoriesGrid(writtenStories.filter(s => s.status === 'Publié'), false)}

                      {/* GLASS/METALLIC VIOLET BACKDROP shelf (only if not showing wood shelf) */}
                      {writtenStories.length <= 7 && (
                        <div className="w-full h-2.5 bg-gradient-to-r from-purple-900 via-purple-650 to-purple-900 border-t border-purple-400/50 rounded-b-lg shadow-[0_4px_12px_rgba(124,58,237,0.3)] mt-6 -mx-4 relative z-0" />
                      )}
                    </div>
                  )}
                </div>

                {/* SHELF 2: Drafts & In-development Writings */}
                <div className="space-y-3">
                  <div className="flex items-center space-x-1.5 border-b border-purple-500/15 pb-2">
                    <span className="h-2 w-2 rounded-full bg-purple-600 block animate-pulse" />
                    <h4 className="font-serif font-black text-sm text-zinc-800 dark:text-zinc-200">
                      Atelier des Brouillons en Gestation ({writtenStories.filter(s => s.status === 'Brouillon').length})
                    </h4>
                  </div>
                  <p className="text-[10px] text-zinc-400 italic font-sans leading-relaxed">
                    Textes secrets et manuscrits en cours d’écriture ou de peaufinage avant publication finale.
                  </p>

                  {writtenStories.filter(s => s.status === 'Brouillon').length === 0 ? (
                    <div className="py-8 bg-zinc-100/50 dark:bg-zinc-950/20 text-center rounded-2xl border border-dashed border-zinc-200 dark:border-zinc-850">
                      <span className="text-xs text-zinc-400 italic">Aucune œuvre secrète en préparation actuellement.</span>
                    </div>
                  ) : (
                    <div className="relative pt-6 pb-2 px-6 bg-zinc-50/50 dark:bg-zinc-950/10 border border-purple-500/15 dark:border-zinc-900 rounded-2xl shadow-sm">
                      {renderStoriesGrid(writtenStories.filter(s => s.status === 'Brouillon'), true)}

                      {/* GLASS/METALLIC VIOLET BACKDROP shelf (only if not showing wood shelf) */}
                      {writtenStories.length <= 7 && (
                        <div className="w-full h-2.5 bg-gradient-to-r from-purple-900 via-purple-650 to-purple-900 border-t border-purple-400/50 rounded-b-lg shadow-[0_4px_12px_rgba(124,58,237,0.3)] mt-6 -mx-4 relative z-0" />
                      )}
                    </div>
                  )}
                </div>

              </div>
            )}
          </div>
        )}

        {/* TAB 2: Bibliothèque de Favoris / Cabinet de Lecture */}
        {activeSubTab === 'favorites' && (
          <div className="space-y-6 animate-fade-in text-left">
            
            {/* Elegant headers filters */}
            <div className="flex flex-wrap gap-1.5 p-1 bg-zinc-100 dark:bg-zinc-900 rounded-2xl border border-zinc-200/50 dark:border-zinc-805 select-none">
              {(['all', 'in_progress', 'completed', 'favorites', 'read_later'] as const).map((filter) => (
                <button
                  key={filter}
                  id={`lib-filter-${filter}`}
                  onClick={() => setLibFilter(filter)}
                  className={`flex-1 text-center py-2 rounded-xl text-[9.5px] font-black uppercase tracking-wider transition-all cursor-pointer ${
                    libFilter === filter
                      ? 'bg-purple-600 text-white shadow font-bold'
                      : 'text-zinc-500 dark:text-zinc-400 hover:text-purple-600 dark:hover:text-purple-450'
                  }`}
                >
                  {filter === 'all' ? 'Tout' :
                   filter === 'in_progress' ? 'En Cours' :
                   filter === 'completed' ? 'Terminés' :
                   filter === 'favorites' ? 'Mes Favoris' : 'À Parcourir'}
                </button>
              ))}
            </div>

            {libraryStories.length === 0 ? (
              <div className="text-center py-16 px-4 bg-zinc-50/50 dark:bg-zinc-900/20 border border-zinc-200/50 dark:border-zinc-800 rounded-3xl">
                <BookOpen className="w-10 h-10 mx-auto text-zinc-400 stroke-1" />
                <h4 className="font-serif font-bold text-xs text-zinc-700 dark:text-zinc-300 mt-2">Étagère inoccupée</h4>
                <p className="text-[11px] text-zinc-400 mt-1 max-w-xs mx-auto">
                  Marquez vos ouvrages favoris et ajustez votre état de lecture pour peupler cette section de l'archipel !
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                <p className="text-[10px] text-zinc-400 italic">
                  Chroniquez vos temps de lecture. Cliquez sur un livre pour l'étiqueter ou l'organiser dans vos étagères personnelles.
                </p>

                {/* PHYSICAL BOOKS DISPLAY GRID */}
                <div className="relative pt-6 pb-2 px-6 bg-zinc-50/50 dark:bg-zinc-950/10 border border-purple-500/15 dark:border-zinc-900 rounded-3xl shadow-sm">
                  <div className="grid grid-cols-3 gap-x-4 gap-y-12 relative z-10">
                    {libraryStories.map((story) => {
                      const isInProgress = currentlyReading.includes(story.id);
                      const isCompleted = completedStories.includes(story.id);
                      const isReadLater = readLater.includes(story.id);
                      const isFav = favorites.includes(story.id);

                      return (
                        <div
                          key={story.id}
                          onClick={() => triggerBookOpenAnimation(story)}
                          className="relative flex flex-col items-center group cursor-pointer"
                        >
                          {/* Standing Book Cover */}
                          <div className="relative aspect-[2/3] w-full bg-zinc-100 dark:bg-zinc-900 rounded-r-lg overflow-hidden shrink-0 shadow-[4px_10px_16px_rgba(0,0,0,0.22)] transition duration-250 group-hover:-translate-y-2 group-hover:shadow-[8px_16px_24px_rgba(0,0,0,0.38)] border-l-[3.5px] border-black/25">
                            <img 
                              src={story.cover} 
                              alt={story.title} 
                              className="w-full h-full object-cover"
                              referrerPolicy="no-referrer"
                            />
                            <div className="absolute inset-y-0 left-0 w-2.5 bg-gradient-to-r from-black/25 via-white/10 to-transparent pointer-events-none" />
                            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent pointer-events-none" />

                            {/* Minimal shelf flag markers */}
                            <div className="absolute top-1 right-1 flex flex-col gap-0.5 items-end">
                              {isFav && (
                                <span className="bg-purple-600/90 text-white rounded p-1 text-[7px] leading-none shrink-0 shadow flex items-center justify-center" title="Favori">
                                  <Star className="w-1.5 h-1.5 fill-white text-white" />
                                </span>
                              )}
                              {isInProgress && <span className="bg-purple-700/90 text-white rounded px-1 py-0.5 text-[6px] font-bold uppercase leading-none tracking-wider shrink-0 shadow">LECTURE</span>}
                              {isCompleted && <span className="bg-emerald-600/90 text-white rounded px-1 py-0.5 text-[6px] font-bold uppercase leading-none tracking-wider shrink-0 shadow">VU</span>}
                            </div>
                          </div>

                          {/* Metadata & Mini shelf action controls */}
                          <div className="mt-2 text-center w-full min-w-0">
                            <p className="text-[10px] font-serif font-black text-zinc-800 dark:text-zinc-100 truncate leading-tight">
                              {story.title}
                            </p>
                            <p className="text-[8px] text-zinc-400 truncate leading-tight mt-0.5">Par {story.authorName}</p>
                            
                            {/* Fast status switcher triggers */}
                            <div className="flex items-center justify-center gap-1 mt-2 p-1 bg-zinc-100 dark:bg-zinc-950/40 rounded-lg border border-purple-500/5 dark:border-zinc-800">
                              <button
                                id={`lib-toggle-progress-${story.id}`}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onToggleCurrentlyReading(story.id);
                                  if (isCompleted) onToggleCompletedStories(story.id);
                                }}
                                className={`p-1 rounded text-[7px] font-black transition cursor-pointer ${
                                  isInProgress ? 'bg-purple-600 text-white animate-pulse' : 'text-zinc-400 hover:text-purple-550'
                                }`}
                                title="En cours"
                              >
                                <BookOpen className="w-2.5 h-2.5" />
                              </button>
                              <button
                                id={`lib-toggle-completed-${story.id}`}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onToggleCompletedStories(story.id);
                                  if (isInProgress) onToggleCurrentlyReading(story.id);
                                }}
                                className={`p-1 rounded text-[7px] font-black transition cursor-pointer ${
                                  isCompleted ? 'bg-emerald-600 text-white' : 'text-zinc-400 hover:text-emerald-550'
                                }`}
                                title="Terminée"
                              >
                                <Check className="w-2.5 h-2.5" />
                              </button>
                              <button
                                id={`lib-toggle-later-${story.id}`}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onToggleReadLater(story.id);
                                }}
                                className={`p-1 rounded text-[7px] font-black transition cursor-pointer ${
                                  isReadLater ? 'bg-purple-900 text-white' : 'text-zinc-400 hover:text-purple-400'
                                }`}
                                title="À lire plus tard"
                              >
                                <BookmarkCheck className="w-2.5 h-2.5" />
                              </button>
                              <button
                                id={`lib-delete-item-${story.id}`}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (isFav) onRemoveFavorite(story.id);
                                  if (isInProgress) onToggleCurrentlyReading(story.id);
                                  if (isCompleted) onToggleCompletedStories(story.id);
                                  if (isReadLater) onToggleReadLater(story.id);
                                }}
                                className="p-1 rounded text-zinc-400 hover:text-red-500 transition-colors cursor-pointer"
                                title="Retirer"
                              >
                                <Trash2 className="w-2.5 h-2.5" />
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* GLASS/METALLIC VIOLET BACKDROP shelf */}
                  <div className="w-full h-2.5 bg-gradient-to-r from-purple-900 via-purple-650 to-purple-900 border-t border-purple-400/50 rounded-b-lg shadow-[0_4px_12px_rgba(124,58,237,0.3)] mt-6 -mx-4 relative z-0" />
                </div>
              </div>
            )}
          </div>
        )}

        {/* 8. CAROUSEL DES PROFILS SUGGÉRÉS DE DÉCOUVERTE */}
        {(() => {
          const suggestedUsers = allUsers.filter(u => u.id !== currentUser.id && u.id !== user.id);
          if (suggestedUsers.length === 0) return null;

          return (
            <div className="pt-6 border-t border-purple-550/10 dark:border-zinc-850/80 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Sparkles className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                  <h4 className="font-serif font-black text-sm text-gray-900 dark:text-white uppercase tracking-wide">
                    Profils susceptibles de vous intéresser
                  </h4>
                </div>
                
                {/* Carousel navigation arrows */}
                <div className="flex items-center space-x-1 font-sans">
                  <button
                    id="suggest-scroll-prev"
                    onClick={() => scrollCarousel('left')}
                    className="p-1 px-1.5 bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg text-zinc-500 dark:text-zinc-400 hover:text-purple-600 dark:hover:text-purple-400 transition cursor-pointer"
                    title="Précédent"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button
                    id="suggest-scroll-next"
                    onClick={() => scrollCarousel('right')}
                    className="p-1 px-1.5 bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg text-zinc-500 dark:text-zinc-400 hover:text-purple-600 dark:hover:text-purple-400 transition cursor-pointer"
                    title="Suivant"
                  >
                    <ChevronLeft className="w-4 h-4 rotate-180" />
                  </button>
                </div>
              </div>

              <div 
                ref={carouselRef}
                className="flex items-center space-x-3.5 overflow-x-auto scrollbar-none scroll-smooth pb-1"
              >
                {suggestedUsers.map(su => {
                  const followsSu = currentUser.following.includes(su.id);
                  return (
                    <div
                      key={su.id}
                      id={`suggested-user-card-${su.id}`}
                      onClick={() => onViewProfile?.(su.id)}
                      className="flex-none w-[175px] bg-zinc-50 dark:bg-zinc-900/35 border border-purple-500/5 hover:border-purple-500/20 dark:border-zinc-850 dark:hover:border-zinc-700/60 p-4 rounded-xl flex flex-col items-center text-center space-y-3 shadow-xs hover:shadow-md transition duration-200 cursor-pointer group"
                    >
                      <img 
                        src={su.avatar} 
                        alt={su.username} 
                        className="w-12 h-12 rounded-full object-cover border-2 border-purple-500/10"
                        referrerPolicy="no-referrer"
                      />

                      <div className="min-w-0 w-full font-sans">
                        <p className="text-[11px] font-sans font-black text-zinc-800 dark:text-zinc-100 truncate leading-tight group-hover:text-purple-500 transition">
                          {su.username}
                        </p>
                        <p className="text-[8.5px] text-zinc-400 font-mono truncate leading-tight mt-0.5">
                          @{su.id}
                        </p>
                      </div>

                      <div className="text-[8px] font-mono font-bold tracking-wider text-purple-750 dark:text-purple-400 bg-purple-500/5 dark:bg-purple-950/10 border border-purple-500/10 px-2 py-0.5 rounded uppercase">
                        {su.role || 'Auteur'}
                      </div>

                      <button
                        id={`suggested-follow-${su.id}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          onFollowAuthor?.(su.id);
                        }}
                        className={`w-full py-1.5 px-2 rounded-lg text-[9px] font-black uppercase tracking-wider transition cursor-pointer flex items-center justify-center space-x-1 ${
                          followsSu
                            ? 'bg-zinc-200 dark:bg-zinc-850 text-zinc-650 dark:text-zinc-300 hover:bg-zinc-250'
                            : 'bg-purple-600 hover:bg-purple-750 text-white hover:scale-105'
                        }`}
                      >
                        <span>{followsSu ? 'Abonné ✓' : 'Suivre'}</span>
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })()}

        {/* 9. SIGNALEMENT ETHIQUE MODAL POPUP */}
        {isReportModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center animate-fade-in select-none p-4">
            <div 
              className="absolute inset-0 bg-black/75 backdrop-blur-sm"
              onClick={() => {
                setIsReportModalOpen(false);
                setReportedStory(null);
              }}
            />

            <div className="relative w-full max-w-sm bg-white dark:bg-[#0E0E14] rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.5)] border border-gray-150 dark:border-purple-950/40 p-5 space-y-4 animate-scale-up text-left z-10 font-sans">
              <div className="flex items-center space-x-2 text-rose-500">
                <ShieldAlert className="w-5 h-5 animate-pulse" />
                <h4 className="font-serif font-black text-sm text-gray-100 dark:text-white uppercase tracking-wider">
                  Rapport de signalement
                </h4>
              </div>

              <p className="text-[11px] text-zinc-500 leading-relaxed font-serif">
                {reportTarget === 'account' 
                  ? `Vous initiez un signalement du compte de @${user.username}. Notre équipe de modération étudiera ce dossier sous 24h.`
                  : `Vous signalez l'œuvre "${reportedStory?.title}" créée par @${user.username} pour infraction aux valeurs éditoriales.`}
              </p>

              {/* Select motif */}
              <div className="space-y-1.5">
                <label className="block text-[10px] uppercase font-black tracking-wider text-zinc-400 font-sans">
                  Motif principal de signalement
                </label>
                
                <select
                  id="report-reason-select"
                  value={selectedReportReason}
                  onChange={(e) => setSelectedReportReason(e.target.value)}
                  className="w-full bg-zinc-50 dark:bg-[#15151D] border border-zinc-250 dark:border-zinc-800 rounded-xl p-2.5 text-xs text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-purple-600 font-bold"
                >
                  {reportTarget === 'account' ? (
                    <>
                      <option value="Spam">Spam (Publicité abusive)</option>
                      <option value="Harcèlement">Harcèlement ou malveillance</option>
                      <option value="Usurpation d'identité">Usurpation d'identité</option>
                      <option value="Contenu inapproprié">Contenu inapproprié</option>
                      <option value="Contenu illégal">Contenu illégal</option>
                      <option value="Autre">Autre motif de comportement</option>
                    </>
                  ) : (
                    <>
                      <option value="Contenu offensant">Contenu offensant / Haineux</option>
                      <option value="Plagiat">Plagiat (Droits d'auteur)</option>
                      <option value="Spam">Spam ou publicité clandestine</option>
                      <option value="Contenu interdit">Contenu interdit ou choquant</option>
                      <option value="Autre">Autre infraction éditoriale</option>
                    </>
                  )}
                </select>
              </div>

              {/* Supplementary description text area */}
              <div className="space-y-1.5">
                <label className="block text-[10px] uppercase font-black tracking-wider text-zinc-400 font-sans">
                  Précisions additionnelles (optionnel)
                </label>
                <textarea
                  id="report-precision-textarea"
                  value={customReportDetails}
                  onChange={(e) => setCustomReportDetails(e.target.value)}
                  rows={3}
                  placeholder="Décrivez avec précision les indices ou liens contredisant la charte d'utilisation..."
                  className="w-full bg-zinc-50 dark:bg-[#15151D] border border-zinc-250 dark:border-zinc-800 rounded-xl p-3 text-xs focus:outline-none focus:ring-1 focus:ring-purple-600 text-gray-900 dark:text-white"
                />
              </div>

              {/* Submit actions */}
              <div className="flex items-center space-x-2 pt-1 font-sans">
                <button
                  id="report-submit-btn"
                  onClick={handleSendReport}
                  className="flex-1 py-2.5 bg-red-650 hover:bg-red-700 text-white rounded-xl text-xs font-black uppercase tracking-wider transition cursor-pointer text-center"
                >
                  Soumettre le signalement
                </button>
                
                <button
                  id="report-cancel-btn"
                  onClick={() => {
                    setIsReportModalOpen(false);
                    setReportedStory(null);
                    setCustomReportDetails('');
                  }}
                  className="py-2.5 px-4 bg-zinc-150 dark:bg-zinc-850 hover:bg-zinc-200 dark:hover:bg-zinc-800 text-zinc-650 dark:text-zinc-300 rounded-xl text-xs font-black uppercase tracking-wider transition cursor-pointer"
                >
                  Annuler
                </button>
              </div>
            </div>
          </div>
        )}

      </div>

      {/* 3D BOOK OPENING IMMERSIVE ANIMATION LAYER */}
      {animatingStory && (
        <div 
          className={`fixed inset-0 z-50 flex items-center justify-center transition-all duration-[1200ms] ease-in-out font-sans ${
            isBookOpening ? 'bg-black/97 backdrop-blur-2xl' : 'bg-black/80 backdrop-blur-md'
          }`}
        >
          <div className="flex flex-col items-center justify-center space-y-7 px-6 text-center overflow-hidden">
            {/* 3D Perspective Scene with scale zoom transition */}
            <div 
              className="w-[150px] h-[225px] relative transition-all duration-[1150ms] ease-in-out" 
              style={{ 
                perspective: '1200px',
                transform: isBookOpening ? 'scale(4.2) translateZ(150px)' : 'scale(1) translateZ(0px)',
                opacity: isBookOpening ? 0 : 1
              }}
            >
              {/* Inside Page Block (behind cover) */}
              <div 
                className="absolute inset-0 bg-white dark:bg-zinc-100 rounded-r shadow-md border-y border-r border-zinc-200 dark:border-zinc-300 flex flex-col justify-between p-4 text-center transition-transform duration-1000 ease-out select-none"
                style={{ 
                  transform: 'rotateY(-12deg) translateZ(-1px)',
                  transformOrigin: 'left'
                }}
              >
                <div className="space-y-1 mt-6">
                  <p className="font-serif text-[11px] font-black italic text-zinc-800 leading-tight">
                    {animatingStory.title}
                  </p>
                  <div className="w-8 h-[1px] bg-purple-300 mx-auto my-1.5" />
                  <span className="text-[7.5px] text-purple-600 font-mono tracking-widest uppercase font-black">Chapitre I</span>
                </div>
                <div className="text-[7px] text-zinc-400 font-serif italic mb-2">
                  La Plume et l'Ancre
                </div>
              </div>

              {/* Front Cover (swings open to the left) */}
              <div 
                className="absolute inset-0 rounded-r shadow-xl origin-left transition-transform duration-1000 ease-out overflow-hidden select-none"
                style={{ 
                  transform: isBookOpening ? 'rotateY(-155deg)' : 'rotateY(0deg)',
                  backfaceVisibility: 'hidden',
                  zIndex: 20
                }}
               >
                <img 
                  src={animatingStory.cover} 
                  alt={animatingStory.title} 
                  className="w-full h-full object-cover" 
                  referrerPolicy="no-referrer"
                />
                {/* Book spine shadows & fine highlights */}
                <div className="absolute inset-y-0 left-0 w-3 bg-gradient-to-r from-black/45 to-transparent pointer-events-none" />
                <div className="absolute inset-y-0 left-3 w-[0.1px] bg-white/20 pointer-events-none" />
              </div>

              {/* Spine/Back cover block */}
              <div 
                className="absolute inset-0 bg-zinc-800 dark:bg-zinc-950 rounded-r shadow-2xl origin-left"
                style={{ 
                  transform: 'rotateY(-6deg) translateZ(-3px)',
                  zIndex: 5
                }}
              >
                <div className="absolute inset-y-0 left-0 w-2 h-full bg-zinc-900 border-r border-white/5 pointer-events-none" />
              </div>
            </div>

            {/* Title text and elegant spinner which fades and shifts on open */}
            <div 
              className="space-y-2 transition-all duration-[1000ms] ease-in-out"
              style={{
                opacity: isBookOpening ? 0 : 1,
                transform: isBookOpening ? 'scale(0.9) translateY(15px)' : 'scale(1) translateY(0px)'
              }}
            >
              <h4 className="font-serif font-black text-white text-base tracking-wide max-w-sm">
                {animatingStory.title}
              </h4>
              <p className="text-[9px] font-mono uppercase tracking-widest text-purple-400 font-bold flex items-center justify-center gap-2">
                <span className="w-1.5 h-1.5 bg-purple-500 rounded-full animate-ping" />
                Ouverture du grimoire...
              </p>
            </div>
          </div>
        </div>
      )}

      {/* 7. BOTTOM SHEET DRAWER: GESTIONNAIRE DE L'HISTOIRE ET CHAPITRES */}
      {selectedStoryToManage && (
        <div className="fixed inset-0 z-50 flex items-end justify-center animate-fade-in select-none">
          {/* Backdrop blurring mask */}
          <div 
            className="absolute inset-0 bg-black/60 backdrop-blur-xs transition-opacity"
            onClick={() => setSelectedStoryToManage(null)}
          />

          {/* Sheet chassis layout */}
          <div className="relative w-full max-w-xl bg-white dark:bg-[#0E0E14] rounded-t-[2rem] shadow-[0_-12px_45px_rgba(0,0,0,0.4)] border-t border-gray-150 dark:border-purple-900/20 flex flex-col h-[85vh] transition-transform animate-slide-up overflow-hidden">
            
            {/* Top rounded grip marker */}
            <div className="w-12 h-1.5 bg-gray-300 dark:bg-zinc-800 rounded-full mx-auto my-3 opacity-60" />

            {/* Header portion */}
            <div className="px-5 pb-3 border-b border-gray-100 dark:border-zinc-900 flex items-center justify-between">
              <div className="text-left min-w-0 pr-3">
                <span className="text-[10px] uppercase font-mono tracking-wider font-extrabold text-purple-600 dark:text-purple-400">Régie de manuscrit</span>
                <h3 className="font-serif font-black text-sm text-gray-900 dark:text-white truncate mt-0.5">
                  {selectedStoryToManage.title}
                </h3>
              </div>

              <button
                id="close-manage-drawer"
                onClick={() => setSelectedStoryToManage(null)}
                className="p-1.5 bg-gray-100 hover:bg-gray-200 dark:bg-zinc-900 dark:hover:bg-zinc-850 rounded-full text-gray-500 hover:text-purple-600 transition cursor-pointer"
              >
                <ChevronLeft className="w-5 h-5 -rotate-90" />
              </button>
            </div>

            {/* Scrollable contents box */}
            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5 scrollbar-none text-left">
              
              {/* Cover mini thumbnail & Synopsis overview */}
              <div className="p-4 bg-gray-50 dark:bg-zinc-900/40 rounded-2xl border border-gray-150 dark:border-zinc-850/60 flex gap-4">
                <img 
                  src={selectedStoryToManage.cover} 
                  alt={selectedStoryToManage.title} 
                  className="w-16 h-24 rounded-lg object-cover flex-shrink-0"
                  referrerPolicy="no-referrer"
                />
                
                <div className="min-w-0 flex flex-col justify-between">
                  <div>
                    <span className="text-[8px] px-2 py-0.5 font-black uppercase rounded-full bg-purple-500/15 text-purple-600 dark:text-purple-300 border border-purple-500/5">
                      {selectedStoryToManage.genre}
                    </span>
                    <p className="text-[11px] text-gray-500 dark:text-gray-400 line-clamp-3 leading-normal mt-2">
                      {selectedStoryToManage.description}
                    </p>
                  </div>

                  <div className="flex items-center space-x-2 pt-2">
                    <button
                      id={`profile-publish-toggle-${selectedStoryToManage.id}`}
                      onClick={() => handleToggleStoryPublish(selectedStoryToManage)}
                      className={`flex items-center space-x-1.5 px-3 py-1 border rounded-lg text-[9px] font-black uppercase tracking-wider transition cursor-pointer ${
                        selectedStoryToManage.status === 'Publié' 
                          ? 'bg-purple-600/10 border-purple-500/20 text-purple-600 hover:bg-purple-650/15' 
                          : 'bg-zinc-500/10 border-zinc-500/20 text-zinc-500 hover:bg-zinc-550/15'
                      }`}
                    >
                      <Power className="w-3 h-3" />
                      <span>{selectedStoryToManage.status === 'Publié' ? 'Brouillon' : 'Publier'}</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Title Chapter block */}
              <div className="space-y-3">
                <div className="flex justify-between items-center pb-2 border-b border-gray-100 dark:border-zinc-900">
                  <h4 className="font-extrabold text-[10px] uppercase tracking-widest text-[#7C3AED] dark:text-purple-400">
                    Chapitres Parus ({selectedStoryToManage.chapters.length})
                  </h4>

                  {/* HIGH VISIBILITY EXCLUSIVE BUTTON TO ADD A NEW CHAPTER */}
                  <button
                    id="profile-add-chapter-btn"
                    onClick={() => handleOpenChapterEditor(selectedStoryToManage, null)}
                    className="flex items-center space-x-1 text-purple-600 hover:text-purple-700 dark:text-purple-400 font-black text-[10px] uppercase tracking-wider bg-purple-500/10 hover:bg-purple-500/15 px-3 py-1.5 rounded-xl transition cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Publier un autre chapitre</span>
                  </button>
                </div>

                {selectedStoryToManage.chapters.length === 0 ? (
                  <div className="text-center py-8">
                    <p className="text-xs text-gray-400">Aucun chapitre n'a encore été publié sur cet ouvrage.</p>
                    <button
                      id="profile-first-chapter-btn"
                      onClick={() => handleOpenChapterEditor(selectedStoryToManage, null)}
                      className="mt-3 bg-purple-600 text-white rounded-lg px-4 py-2 text-[10px] font-black uppercase tracking-wider transition hover:bg-purple-700"
                    >
                      Composer le premier chapitre
                    </button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {selectedStoryToManage.chapters.map((ch, idx) => (
                      <div 
                        key={ch.id} 
                        className="flex items-center justify-between p-3.5 bg-gray-50 dark:bg-zinc-900/40 rounded-xl border border-gray-100 dark:border-zinc-850/50"
                      >
                        <div className="flex items-center space-x-3 text-left">
                          <span className="text-[10px] font-mono font-black bg-[#7C3AED]/15 text-[#7C3AED] dark:text-purple-400 w-6 h-6 rounded-full flex items-center justify-center">
                            {idx + 1}
                          </span>
                          <div>
                            <p className="text-xs font-bold text-gray-800 dark:text-gray-100 line-clamp-1">{ch.title}</p>
                            <p className="text-[9px] text-gray-400 mt-0.5">Paru le {new Date(ch.publishDate).toLocaleDateString()} • {Math.round(ch.content.length / 5)} mots</p>
                          </div>
                        </div>

                        <button
                          id={`profile-edit-ch-${ch.id}`}
                          onClick={() => handleOpenChapterEditor(selectedStoryToManage, ch)}
                          className="px-3 py-1.5 bg-white hover:bg-gray-100 dark:bg-zinc-900 dark:hover:bg-zinc-800 rounded-lg text-[9px] font-extrabold uppercase tracking-wider text-gray-600 dark:text-gray-300 border border-gray-150 dark:border-zinc-800 transition shadow-2xs"
                        >
                          Éditer
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

            </div>

          </div>
        </div>
      )}

      {/* 8. CHAPTER COMPOSER OVERLAY LAYOUT (Gives the premium document composer vibe!) */}
      {editingChapterInStory && (
        <div className="fixed inset-0 z-[100] bg-white dark:bg-[#0F0F14] flex flex-col animate-fade-in text-left">
          {/* Editor Header */}
          <div className="px-5 py-4 border-b border-gray-100 dark:border-zinc-850/80 flex items-center justify-between">
            <div>
              <span className="text-[10px] font-black text-purple-600 dark:text-purple-400 uppercase tracking-widest block">
                {editingChapterInStory.story.title}
              </span>
              <h2 className="text-base font-extrabold text-gray-900 dark:text-white font-sans">
                {editingChapterInStory.chapter ? 'Réviser le texte' : 'Publier un chapitre'}
              </h2>
            </div>
            
            <button
              id="exit-ch-composer"
              onClick={() => setEditingChapterInStory(null)}
              className="px-4 py-2 text-[10px] font-black uppercase tracking-wider text-gray-500 hover:text-purple-600 border border-gray-200 dark:border-zinc-800 rounded-xl transition"
            >
              Fermer
            </button>
          </div>

          {/* Composer Forms fields */}
          <div className="flex-1 overflow-y-auto px-5 py-6 space-y-5 max-w-2xl mx-auto w-full pb-20">
            <div>
              <label className="block text-[10px] font-black uppercase tracking-widest text-[#7C3AED] dark:text-purple-400 mb-2">
                Titre du Chapitre
              </label>
              <input
                id="chapter-title-profile-input"
                type="text"
                value={chapterTitle}
                onChange={(e) => setChapterTitle(e.target.value)}
                placeholder="Ex. Chapitre 5 : Les Voiles Célestes"
                className="w-full bg-gray-50 dark:bg-zinc-900 border border-gray-150 dark:border-zinc-805 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-1 focus:ring-purple-600 text-gray-900 dark:text-white font-bold"
              />
            </div>

            <div className="flex flex-col flex-1 h-[55vh]">
              <div className="flex items-center justify-between mb-2">
                <label className="block text-[10px] font-black uppercase tracking-widest text-[#7C3AED] dark:text-purple-400">
                  Contenu du Récit
                </label>
                <span className="text-[9px] text-gray-400 font-mono">Pratique : séparez vos paragraphes pour l'archipel de lecteurs.</span>
              </div>
              
              <textarea
                id="chapter-content-profile-textarea"
                value={chapterContent}
                onChange={(e) => setChapterContent(e.target.value)}
                placeholder="Coucher votre odyssée ici..."
                className="w-full flex-1 font-serif bg-gray-55 dark:bg-zinc-900 border border-gray-150 dark:border-zinc-805 rounded-xl p-4 text-[#1F2937] dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-purple-600 leading-relaxed resize-none text-[15px]"
              />
            </div>

            {/* Action deck */}
            <div className="flex items-center justify-between pt-4 border-t border-gray-100 dark:border-zinc-850/60">
              
              {editingChapterInStory.chapter ? (
                <button
                  id="profile-delete-chapter-btn"
                  onClick={() => {
                    if (confirm("Détruire définitivement ce chapitre ?")) {
                      onDeleteChapter(editingChapterInStory.story.id, editingChapterInStory.chapter!.id);
                      
                      // Also remove from local sheet presentation list
                      if (selectedStoryToManage) {
                        setSelectedStoryToManage({
                          ...selectedStoryToManage,
                          chapters: selectedStoryToManage.chapters.filter(ch => ch.id !== editingChapterInStory.chapter!.id)
                        });
                      }
                      
                      setEditingChapterInStory(null);
                    }
                  }}
                  className="flex items-center space-x-1.5 text-[10px] font-black uppercase tracking-wider text-red-500 hover:text-red-700 bg-red-500/10 px-4 py-3 rounded-xl transition"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>Détruire</span>
                </button>
              ) : (
                <div />
              )}

              <div className="flex items-center justify-end space-x-2">
                <button
                  id="profile-cancel-ch-editor"
                  type="button"
                  onClick={() => setEditingChapterInStory(null)}
                  className="px-5 py-3 rounded-xl text-[10px] font-black uppercase tracking-wider text-gray-600 dark:text-gray-300 bg-gray-50 dark:bg-zinc-900 hover:bg-gray-100 dark:hover:bg-zinc-850 transition"
                >
                  Annuler
                </button>
                <button
                  id="profile-save-chapter-btn"
                  onClick={handleSaveChapter}
                  disabled={!chapterTitle.trim() || !chapterContent.trim()}
                  className={`flex items-center space-x-1.5 bg-purple-600 text-white rounded-xl px-5 py-3 text-[10px] font-black uppercase tracking-wider hover:bg-purple-700 transition ${
                    (!chapterTitle.trim() || !chapterContent.trim()) ? 'opacity-40 cursor-not-allowed' : ''
                  }`}
                >
                  <Save className="w-4 h-4" />
                  <span>Sauvegarder et publier</span>
                </button>
              </div>

            </div>

          </div>
        </div>
      )}

      {/* 9. DETAILED ACCOMPLISHMENTS VIEW OVERLAY */}
      {showAllAchievements && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animation-fade-in font-sans"
          onClick={() => { setShowAllAchievements(false); setAchievementsSearch(''); }}
        >
          <div
            className="bg-white dark:bg-[#0E0E14] border border-zinc-200 dark:border-zinc-800 rounded-3xl max-w-2xl w-full p-6 shadow-2xl relative flex flex-col max-h-[90vh]"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => {
                setShowAllAchievements(false);
                setAchievementsSearch('');
              }}
              className="absolute top-5 right-5 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 text-lg transition font-black cursor-pointer focus:outline-none"
              title="Fermer"
            >
              ✕
            </button>

            {/* Header section with Trophy logo */}
            <div className="flex items-start space-x-3 pb-4 border-b border-zinc-150 dark:border-zinc-850">
              <div className="p-3 bg-purple-500/10 text-purple-600 dark:text-purple-400 rounded-2xl shrink-0">
                <Trophy className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-serif font-black text-lg text-zinc-900 dark:text-zinc-50 leading-tight">
                  Palmarès des Accomplissements de l'Archipel
                </h3>
                <p className="text-[11px] text-zinc-450 dark:text-zinc-400 leading-snug mt-1">
                  Débloquez des insignes pour certifier votre activité de lecture ou d'écriture de l’archipel PLUME.
                </p>
              </div>
            </div>

            {/* Subtabs navigation & Search */}
            <div className="mt-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-3 border-b border-zinc-150 dark:border-zinc-850">
              <div className="flex bg-zinc-100 dark:bg-zinc-900 p-1 rounded-xl text-[10px] font-bold self-start sm:self-auto uppercase tracking-wide">
                {currentUser.role !== 'Auteur' && (
                  <button
                    onClick={() => {
                      setAchievementsTab('reader');
                      setAchievementsSearch('');
                    }}
                    className={`px-3 py-1.5 rounded-lg transition-all focus:outline-none cursor-pointer ${
                      achievementsTab === 'reader'
                        ? 'bg-purple-605 text-white shadow-xs'
                        : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-300'
                    }`}
                  >
                    Lecteur (125)
                  </button>
                )}
                {currentUser.role !== 'Lecteur' && (
                  <button
                    onClick={() => {
                      setAchievementsTab('author');
                      setAchievementsSearch('');
                    }}
                    className={`px-3 py-1.5 rounded-lg transition-all focus:outline-none cursor-pointer ${
                      achievementsTab === 'author'
                        ? 'bg-purple-605 text-white shadow-xs'
                        : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-300'
                    }`}
                  >
                    Auteur (100)
                  </button>
                )}
                <button
                  onClick={() => {
                    setAchievementsTab('simulator');
                    setAchievementsSearch('');
                  }}
                  className={`px-3 py-1.5 rounded-lg transition-all focus:outline-none cursor-pointer flex items-center gap-1 ${
                    achievementsTab === 'simulator'
                      ? 'bg-purple-605 text-white shadow-xs'
                      : 'text-purple-600 dark:text-purple-400 hover:bg-purple-500/5'
                  }`}
                >
                  <Sliders className="w-3 h-3" />
                  <span>Simulateur d'activité</span>
                </button>
              </div>

              {/* Simple search bar (only for search filters on list tabs) */}
              {achievementsTab !== 'simulator' && (
                <div className="relative w-full sm:w-48">
                  <input
                    type="text"
                    placeholder="Rechercher..."
                    value={achievementsSearch}
                    onChange={(e) => setAchievementsSearch(e.target.value)}
                    className="w-full pl-7 pr-3 py-1.5 bg-zinc-100 dark:bg-zinc-905 border border-zinc-200/50 dark:border-zinc-800/80 rounded-xl text-xs text-zinc-800 dark:text-zinc-200 placeholder-zinc-400 focus:outline-none focus:border-purple-500"
                  />
                  <div className="absolute left-2.5 top-2.5 text-zinc-400">
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                  </div>
                </div>
              )}
            </div>

            {/* Main Interactive Content container */}
            <div className="flex-1 overflow-y-auto py-4 space-y-4 pr-1 min-h-[250px]">
              
              {achievementsTab === 'simulator' && (
                <div className="space-y-4">
                  <div className="bg-purple-500/5 p-4 rounded-2xl border border-purple-500/10 space-y-1.5">
                    <span className="font-extrabold text-[12px] uppercase text-purple-605 dark:text-purple-350 block">Console Interactive d'Activités</span>
                    <p className="text-[11px] text-zinc-500 dark:text-zinc-400 leading-relaxed">
                      L'application débloque automatiquement les trophées en arrière-plan suite à vos actions sur le site (lecture, écriture, etc.). Afin de faciliter l'évaluation complète des <strong>225 succès</strong>, utilisez les boutons de simulation ci-dessous pour modifier vos statistiques et observer les déblocages automatiques ainsi que le changement de certification.
                    </p>
                  </div>

                  {/* Simulator buttons categoried */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* Reader simulators */}
                    <div className="p-3 bg-zinc-50 dark:bg-zinc-900/45 rounded-xl border border-zinc-100 dark:border-zinc-850 space-y-2 text-left">
                      <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block border-b border-zinc-200 dark:border-zinc-800 pb-1">Lecteur</span>
                      <div className="grid grid-cols-2 gap-1.5 pt-1">
                        <button
                          onClick={() => {
                            if (onUpdateAndVerifyUserStats) {
                              onUpdateAndVerifyUserStats(st => { st.chaptersRead += 1; });
                            }
                          }}
                          className="px-2.5 py-1.5 bg-white dark:bg-zinc-850 hover:bg-purple-500/10 dark:hover:bg-purple-950/20 text-zinc-700 dark:text-zinc-300 rounded-lg text-[10px] font-semibold border border-zinc-200 dark:border-zinc-800 transition cursor-pointer"
                        >
                          +1 Chapitre lu
                        </button>
                        <button
                          onClick={() => {
                            if (onUpdateAndVerifyUserStats) {
                              onUpdateAndVerifyUserStats(st => { st.chaptersRead += 10; });
                            }
                          }}
                          className="px-2.5 py-1.5 bg-white dark:bg-zinc-850 hover:bg-purple-500/10 dark:hover:bg-purple-950/20 text-zinc-700 dark:text-zinc-300 rounded-lg text-[10px] font-semibold border border-zinc-200 dark:border-zinc-800 transition cursor-pointer"
                        >
                          +10 Chapitres lus
                        </button>
                        <button
                          onClick={() => {
                            if (onUpdateAndVerifyUserStats) {
                              onUpdateAndVerifyUserStats(st => { st.commentsPosted += 1; });
                            }
                          }}
                          className="px-2.5 py-1.5 bg-white dark:bg-zinc-850 hover:bg-purple-500/10 dark:hover:bg-purple-950/20 text-zinc-700 dark:text-zinc-300 rounded-lg text-[10px] font-semibold border border-zinc-200 dark:border-zinc-800 transition cursor-pointer"
                        >
                          +1 Commentaire
                        </button>
                        <button
                          onClick={() => {
                            if (onUpdateAndVerifyUserStats) {
                              onUpdateAndVerifyUserStats(st => { st.favoritesAdded += 1; });
                            }
                          }}
                          className="px-2.5 py-1.5 bg-white dark:bg-zinc-850 hover:bg-purple-500/10 dark:hover:bg-purple-950/20 text-zinc-700 dark:text-zinc-300 rounded-lg text-[10px] font-semibold border border-zinc-200 dark:border-zinc-800 transition cursor-pointer"
                        >
                          +1 Favori
                        </button>
                        <button
                          onClick={() => {
                            if (onUpdateAndVerifyUserStats) {
                              onUpdateAndVerifyUserStats(st => { st.completedReadCycles += 1; });
                            }
                          }}
                          className="px-2.5 py-1.5 bg-white dark:bg-zinc-850 hover:bg-purple-500/10 dark:hover:bg-purple-950/20 text-zinc-700 dark:text-zinc-300 rounded-lg text-[10px] font-semibold border border-zinc-200 dark:border-zinc-800 transition cursor-pointer col-span-2"
                        >
                          +1 Cycle de lecture complet
                        </button>
                      </div>
                    </div>

                    {/* Author simulators */}
                    <div className="p-3 bg-zinc-50 dark:bg-zinc-900/45 rounded-xl border border-zinc-100 dark:border-zinc-850 space-y-2 text-left">
                      <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block border-b border-zinc-200 dark:border-zinc-800 pb-1">Écrivain & Auteur</span>
                      <div className="grid grid-cols-2 gap-1.5 pt-1">
                        <button
                          onClick={() => {
                            if (onUpdateAndVerifyUserStats) {
                              onUpdateAndVerifyUserStats(st => { st.storiesCreated += 1; });
                            }
                          }}
                          className="px-2.5 py-1.5 bg-white dark:bg-zinc-850 hover:bg-purple-500/10 dark:hover:bg-purple-950/20 text-zinc-700 dark:text-zinc-300 rounded-lg text-[10px] font-semibold border border-zinc-200 dark:border-zinc-800 transition cursor-pointer"
                        >
                          +1 Récit créé
                        </button>
                        <button
                          onClick={() => {
                            if (onUpdateAndVerifyUserStats) {
                              onUpdateAndVerifyUserStats(st => { st.chaptersPublished += 1; });
                            }
                          }}
                          className="px-2.5 py-1.5 bg-white dark:bg-zinc-850 hover:bg-purple-500/10 dark:hover:bg-purple-950/20 text-zinc-700 dark:text-zinc-300 rounded-lg text-[10px] font-semibold border border-zinc-200 dark:border-zinc-800 transition cursor-pointer"
                        >
                          +1 Chapitre publié
                        </button>
                        <button
                          onClick={() => {
                            if (onUpdateAndVerifyUserStats) {
                              onUpdateAndVerifyUserStats(st => { st.wordsWritten += 1000; });
                            }
                          }}
                          className="px-2.5 py-1.5 bg-white dark:bg-zinc-850 hover:bg-purple-500/10 dark:hover:bg-purple-950/20 text-zinc-700 dark:text-zinc-300 rounded-lg text-[10px] font-semibold border border-zinc-200 dark:border-zinc-800 transition cursor-pointer"
                        >
                          +1000 Mots rédigés
                        </button>
                        <button
                          onClick={() => {
                            if (onUpdateAndVerifyUserStats) {
                              onUpdateAndVerifyUserStats(st => { st.wordsWritten += 50000; });
                            }
                          }}
                          className="px-2.5 py-1.5 bg-white dark:bg-zinc-850 hover:bg-purple-500/10 dark:hover:bg-purple-950/20 text-zinc-700 dark:text-zinc-300 rounded-lg text-[10px] font-semibold border border-zinc-200 dark:border-zinc-800 transition cursor-pointer"
                        >
                          +50 000 Mots (Roman)
                        </button>
                        <button
                          onClick={() => {
                            if (onUpdateAndVerifyUserStats) {
                              onUpdateAndVerifyUserStats(st => { st.decorChanges += 1; });
                            }
                          }}
                          className="px-2.5 py-1.5 bg-white dark:bg-zinc-850 hover:bg-purple-500/10 dark:hover:bg-purple-950/20 text-zinc-700 dark:text-zinc-300 rounded-lg text-[10px] font-semibold border border-zinc-200 dark:border-zinc-800 transition cursor-pointer col-span-2"
                        >
                          +1 Personnalisation décors (Bannière)
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Bypasses & Quick achievements triggers */}
                  <div className="p-3.5 bg-zinc-50 dark:bg-zinc-900/40 rounded-2xl border border-zinc-200/60 dark:border-zinc-800/80 space-y-3">
                    <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block border-b border-zinc-200 dark:border-zinc-800 pb-1 text-left">Déblocage express & Utilitaires</span>
                    
                    <div className="flex flex-wrap gap-2 text-left">
                      <button
                        onClick={() => {
                          if (onUpdateAndVerifyUserStats) {
                            // Set stats that bypass 80% of reader (100 unlocked minimum)
                            onUpdateAndVerifyUserStats(st => {
                              st.chaptersRead = 120; // unlocks multiple read counts
                              st.commentsPosted = 100; // comments
                              st.favoritesAdded = 55; // favorites
                              st.completedReadCycles = 50; // cycles
                              st.decorChanges = 25; // customizations
                              // Bypasses immediately!
                            });
                          }
                        }}
                        className="px-3 py-2 bg-gradient-to-r from-purple-700 to-indigo-700 text-white rounded-xl text-[10.5px] font-bold hover:opacity-90 shadow-sm cursor-pointer transition"
                      >
                        ⚡ Débloquer Lecteur à 85% (Certifiable)
                      </button>

                      <button
                        onClick={() => {
                          if (onUpdateAndVerifyUserStats) {
                            // Set stats that bypass 80% of authors (80 unlocked minimum)
                            onUpdateAndVerifyUserStats(st => {
                              st.storiesCreated = 40; // stories
                              st.chaptersPublished = 85; // chapters
                              st.wordsWritten = 280000; // words count
                              st.decorChanges = 25; // customizations
                              // Bypasses immediately!
                            });
                          }
                        }}
                        className="px-3 py-2 bg-gradient-to-r from-purple-700 to-indigo-700 text-white rounded-xl text-[10.5px] font-bold hover:opacity-90 shadow-sm cursor-pointer transition"
                      >
                        ⚡ Débloquer Auteur à 85% (Certifiable)
                      </button>

                      <button
                        onClick={() => {
                          if (onUpdateAndVerifyUserStats) {
                            // Sets all stats to zero
                            onUpdateAndVerifyUserStats(st => {
                              st.chaptersRead = 0;
                              st.commentsPosted = 0;
                              st.favoritesAdded = 0;
                              st.completedReadCycles = 0;
                              st.storiesCreated = 0;
                              st.chaptersPublished = 0;
                              st.wordsWritten = 0;
                              st.decorChanges = 0;
                            });
                          }
                        }}
                        className="px-3 py-2 bg-zinc-200 hover:bg-purple-600 hover:text-white dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 rounded-xl text-[10.5px] font-bold cursor-pointer transition"
                      >
                        Réinitialiser à zéro
                      </button>
                    </div>
                  </div>

                  {/* Simulation of parameters display */}
                  <div className="flex items-center space-x-2 bg-zinc-50 dark:bg-zinc-900 p-3 rounded-lg border border-zinc-200/40 dark:border-zinc-800/20">
                    <input
                      type="checkbox"
                      id="simulate-admin"
                      checked={simulateAdminView}
                      onChange={(e) => setSimulateAdminView(e.target.checked)}
                      className="w-4 h-4 rounded text-purple-600 border-zinc-300 focus:ring-purple-500"
                    />
                    <label htmlFor="simulate-admin" className="text-xs text-zinc-650 dark:text-zinc-300 font-bold cursor-pointer select-none">
                      Simuler la Vue Administrateur (pour révéler la section confidentielle de certification)
                    </label>
                  </div>
                </div>
              )}

              {achievementsTab !== 'simulator' && (() => {
                const isReaderMode = achievementsTab === 'reader';
                const list = isReaderMode 
                  ? generateReaderAchievements(getUserStats(currentUser.id, currentUser.role, currentUser.username), currentUser.id)
                  : generateAuthorAchievements(getUserStats(currentUser.id, currentUser.role, currentUser.username), currentUser.id);
                
                const unlockedList = list.filter(a => a.isUnlocked);
                const pct = list.length ? Math.round((unlockedList.length / list.length) * 100) : 0;
                const remainingCount = list.length - unlockedList.length;

                // Automatic certification threshold checks
                const requiredToCertify = isReaderMode ? 100 : 80;
                // En mode auteur, le statut « certifié » suit le badge serveur
                // (source de vérité), pas le seuil calculé localement.
                const isCertified = isReaderMode ? unlockedList.length >= requiredToCertify : currentUser.isVerified;

                // Calculate rarity distributions
                const countByRarity = (r: 'commun' | 'rare' | 'epic' | 'mythic') => {
                  const sublist = list.filter(a => a.rarity === r);
                  const total = sublist.length;
                  const unlocked = sublist.filter(a => a.isUnlocked).length;
                  const percent = total ? Math.round((unlocked / total) * 100) : 0;
                  return { unlocked, total, percent };
                };

                const communStats = countByRarity('commun');
                const rareStats = countByRarity('rare');
                const epicStats = countByRarity('epic');
                const mythicStats = countByRarity('mythic');

                // Get recently obtained trophies
                const recentTrophies = [...unlockedList].reverse().slice(0, 3);

                // apply filter search
                const query = achievementsSearch.toLowerCase().trim();
                const filteredList = list.filter(ach => {
                  if (!query) return true;
                  // If simple & locked, they are hidden/mysterious, so search matches only if unlocked as we can't reveal details.
                  const showReal = ach.isUnlocked || ach.difficulty === 'difficile';
                  if (!showReal) return false;
                  return ach.title.toLowerCase().includes(query) || ach.realDesc.toLowerCase().includes(query);
                });

                return (
                  <div className="space-y-4 text-left">
                    {/* Dashboard Metrics Header */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Percent and quick check */}
                      <div className="p-4 bg-zinc-50 dark:bg-zinc-900 rounded-3xl border border-zinc-200/50 dark:border-zinc-800 flex items-center justify-between">
                        <div className="space-y-1">
                          <span className="text-[10px] uppercase tracking-wider font-extrabold text-zinc-400">Progression globale</span>
                          <div className="flex items-baseline space-x-1">
                            <span className="text-3xl font-serif font-black text-black dark:text-white leading-none">{pct}%</span>
                            <span className="text-xs text-purple-500 font-mono font-bold">({unlockedList.length} / {list.length})</span>
                          </div>
                          <p className="text-[10px] text-zinc-500">
                            {unlockedList.length} obtenu{unlockedList.length > 1 ? 's' : ''} • {remainingCount} restant{remainingCount > 1 ? 's' : ''}
                          </p>
                        </div>
                        {/* Circle progress overlay */}
                        <div className="relative w-14 h-14 shrink-0 flex items-center justify-center font-mono text-xs font-black text-purple-600 dark:text-purple-400 bg-purple-500/5 rounded-full border border-purple-500/10">
                          {pct}%
                        </div>
                      </div>

                      {/* Certification and Badge style */}
                      <div className="p-4 bg-zinc-50 dark:bg-zinc-900 rounded-3xl border border-zinc-200/50 dark:border-zinc-800 flex flex-col justify-center">
                        {isReaderMode ? (
                          <div className="space-y-1">
                            <span className="text-xs font-serif font-black text-purple-600 dark:text-purple-400 flex items-center">
                              📚 Accomplissements de lecture
                            </span>
                            <p className="text-[10px] text-zinc-500 leading-snug">
                              La certification d'authenticité est réservée aux auteurs ; vos trophées de lecture restent suivis ici.
                            </p>
                          </div>
                        ) : isCertified ? (
                          <div className="space-y-1">
                            <span className="text-xs font-serif font-black text-purple-600 dark:text-purple-400 flex items-center">
                              ✓ Auteur Certifié
                            </span>
                            <p className="text-[10px] text-zinc-500 leading-snug">
                              Cet auteur a débloqué au moins 80% des accomplissements auteur.
                            </p>
                          </div>
                        ) : (
                          <div className="space-y-1">
                            <span className="text-xs font-serif font-black text-zinc-400 flex items-center">
                              🔒 Non certifié
                            </span>
                            <p className="text-[10px] text-zinc-500 leading-snug">
                              Requis : {requiredToCertify} accomplissements (80/100). Encore {Math.max(0, requiredToCertify - unlockedList.length)} à débloquer.
                            </p>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Rarity distribution panel */}
                    <div className="p-4 bg-zinc-50 dark:bg-[#0E0E14] rounded-3xl border border-zinc-200/50 dark:border-purple-900/15 space-y-3">
                      <span className="text-[10px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-widest block border-b border-zinc-200 dark:border-zinc-800 pb-1">
                        Répartition par rareté
                      </span>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                        <div className="p-2.5 bg-zinc-100 dark:bg-black rounded-2xl border border-zinc-200/50 dark:border-purple-900/15 text-center">
                          <span className="text-[8.5px] uppercase font-bold text-zinc-400 dark:text-zinc-500">Commun (60%)</span>
                          <div className="text-xs font-mono font-black text-zinc-800 dark:text-zinc-100 mt-1">
                            {communStats.unlocked} / {communStats.total}
                          </div>
                          <span className="text-[8.5px] font-mono text-purple-500/90">({communStats.percent}%)</span>
                        </div>
                        <div className="p-2.5 bg-purple-500/5 rounded-2xl border border-purple-500/10 text-center">
                          <span className="text-[8.5px] uppercase font-bold text-purple-400">Rare</span>
                          <div className="text-xs font-mono font-black text-purple-600 dark:text-purple-350 mt-1">
                            {rareStats.unlocked} / {rareStats.total}
                          </div>
                          <span className="text-[8.5px] font-mono text-purple-500/90">({rareStats.percent}%)</span>
                        </div>
                        <div className="p-2.5 bg-purple-650/10 rounded-2xl border border-purple-650/20 text-center">
                          <span className="text-[8.5px] uppercase font-bold text-purple-300">Épique</span>
                          <div className="text-xs font-mono font-black text-purple-500 dark:text-purple-200 mt-1">
                            {epicStats.unlocked} / {epicStats.total}
                          </div>
                          <span className="text-[8.5px] font-mono text-purple-500/90">({epicStats.percent}%)</span>
                        </div>
                        <div className="p-2.5 bg-black rounded-2xl border border-purple-500/30 text-center">
                          <span className="text-[8.5px] uppercase font-extrabold text-white">Mythique</span>
                          <div className="text-xs font-mono font-black text-purple-450 dark:text-purple-400 mt-1 animate-pulse">
                            {mythicStats.unlocked} / {mythicStats.total}
                          </div>
                          <span className="text-[8.5px] font-mono text-purple-500">({mythicStats.percent}%)</span>
                        </div>
                      </div>
                    </div>

                    {/* Recently obtained achievements (Derniers Trophées obtenus) */}
                    {recentTrophies.length > 0 && (
                      <div className="p-4 bg-zinc-50 dark:bg-[#0E0E14] rounded-3xl border border-zinc-200/40 dark:border-purple-900/15 space-y-2">
                        <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">
                          Derniers trophées débloqués
                        </span>
                        <div className="flex flex-col sm:flex-row gap-2">
                          {recentTrophies.map(t => {
                            let rarityBadge = "Commun";
                            let cardStyle = "bg-zinc-100 dark:bg-black text-zinc-450 dark:text-zinc-500 border-zinc-200 dark:border-purple-900/15";
                            if (t.rarity === 'rare') {
                              rarityBadge = "Rare";
                              cardStyle = "bg-purple-500/5 text-purple-600 dark:text-purple-400 border-purple-500/10";
                            } else if (t.rarity === 'epic') {
                              rarityBadge = "Épique";
                              cardStyle = "bg-purple-600 text-white border-purple-600";
                            } else if (t.rarity === 'mythic') {
                              rarityBadge = "Mythique";
                              cardStyle = "bg-black text-purple-400 border-purple-500/45 shadow-sm";
                            }
                            
                            return (
                              <div key={t.id} className={`flex-1 p-2.5 rounded-2xl border flex items-center justify-between text-xs font-sans ${cardStyle}`}>
                                <div className="space-y-0.5 min-w-0">
                                  <div className="flex items-center space-x-1.5 min-w-0">
                                    <span className="font-serif font-black truncate">{t.title}</span>
                                    <span className="text-[7.5px] uppercase font-bold shrink-0 opacity-80">{rarityBadge}</span>
                                  </div>
                                  <p className="text-[8.5px] opacity-75 truncate">{t.realDesc}</p>
                                </div>
                                <span className="text-[8.5px] px-1.5 py-0.5 rounded-md font-mono bg-black/10 dark:bg-white/10 shrink-0 font-bold ml-1">
                                  🏆
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Results count indicator */}
                    {query && (
                      <p className="text-[10px] text-zinc-400 pl-1">
                        Recherche ({achievementsSearch}) : {filteredList.length} accomplissements trouvés
                      </p>
                    )}

                    {/* Grille de trophées et d'accomplissements */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                      {filteredList.map((ach) => {
                        const isUnlocked = ach.isUnlocked;
                        const isSimple = ach.difficulty === 'facile';
                        
                        // If easy & Locked: it is a hidden/mysterious achievement!
                        // Reste caché (« ??? ») mais devient cliquable pour révéler son énigme.
                        if (isSimple && !isUnlocked) {
                          return (
                            <button
                              type="button"
                              key={ach.id}
                              onClick={() => setSelectedAchievement(ach)}
                              title="Cliquer pour révéler l'énigme"
                              className="p-3 rounded-2xl bg-zinc-50/70 dark:bg-[#0E0E14] border border-dashed border-zinc-200 dark:border-purple-900/15 opacity-70 hover:opacity-100 hover:border-purple-400/40 flex items-center space-x-3 text-left font-sans transition-all duration-300 cursor-pointer w-full"
                            >
                              <div className="p-2.5 bg-zinc-150 dark:bg-black text-zinc-450 dark:text-zinc-500 rounded-2xl shrink-0 border border-zinc-200/20">
                                <Lock className="w-4 h-4 text-zinc-400" />
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center justify-between">
                                  <span className="text-xs font-serif font-black text-zinc-400 tracking-wide">???</span>
                                  <span className="text-[7.5px] bg-zinc-100 dark:bg-zinc-850 text-zinc-400 px-1.5 py-0.5 rounded-full font-bold uppercase tracking-wider">Commun</span>
                                </div>
                                <p className="text-[9.5px] text-purple-500 dark:text-purple-400 leading-normal mt-0.5 flex items-center gap-1">
                                  <KeyRound className="w-2.5 h-2.5 shrink-0" />
                                  Énigme à découvrir
                                </p>
                              </div>
                            </button>
                          );
                        }

                        // If difficult & Locked: shown as mysterious but name/presence is revealed!
                        if (!isSimple && !isUnlocked) {
                          let rarityBadge = "Rare";
                          let colorStyle = "bg-purple-500/5 text-purple-600 dark:text-purple-400 border-purple-500/10";
                          if (ach.rarity === 'epic') {
                            rarityBadge = "Épique";
                            colorStyle = "bg-purple-650/5 text-purple-500 border-purple-650/10";
                          } else if (ach.rarity === 'mythic') {
                            rarityBadge = "Mythique";
                            colorStyle = "bg-black/35 text-white border-purple-500/20 shadow-xs";
                          }

                          return (
                            <button
                              type="button"
                              key={ach.id}
                              onClick={() => setSelectedAchievement(ach)}
                              title="Cliquer pour révéler l'énigme"
                              className={`p-3 rounded-2xl border flex items-center space-x-3 text-left font-sans transition-all duration-300 hover:scale-[1.01] cursor-pointer w-full ${colorStyle}`}
                            >
                              <div className="p-2.5 bg-purple-500/10 rounded-2xl shrink-0">
                                <Lock className="w-4 h-4" />
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center justify-between">
                                  <span className="text-xs font-serif font-black tracking-wide line-clamp-1">{ach.title}</span>
                                  <span className="text-[7.5px] bg-black/10 dark:bg-white/10 px-1.5 py-0.5 rounded-full font-bold uppercase tracking-wider">{rarityBadge}</span>
                                </div>
                                <p className="text-[9.5px] leading-normal mt-0.5 opacity-90 italic pr-2 flex items-center gap-1">
                                  <KeyRound className="w-2.5 h-2.5 shrink-0" />
                                  Énigme à découvrir
                                </p>
                              </div>
                            </button>
                          );
                        }

                        // Unlocked achievements: Full detailed gorgeous layout!
                        let rarityBadge = "Commun";
                        let cardStyle = "bg-zinc-50 dark:bg-[#0E0E14] border-zinc-250 dark:border-purple-900/15 text-zinc-850 dark:text-zinc-100";
                        let glowClass = "";
                        let iconClass = "bg-zinc-150 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300";

                        if (ach.rarity === 'rare') {
                          rarityBadge = "Rare";
                          cardStyle = "bg-purple-500/5 border-purple-500/20 dark:bg-purple-950/10 text-zinc-900 dark:text-zinc-50";
                          iconClass = "bg-purple-500/15 text-purple-600 dark:text-purple-300";
                        } else if (ach.rarity === 'epic') {
                          rarityBadge = "Épique";
                          cardStyle = "bg-gradient-to-br from-[#1c1236]/90 to-[#221040]/90 text-white border-[#3c1566]";
                          glowClass = "shadow-lg shadow-purple-950/25";
                          iconClass = "bg-purple-600 text-white";
                        } else if (ach.rarity === 'mythic') {
                          rarityBadge = "Mythique";
                          cardStyle = "bg-black text-white border-purple-500/40 relative overflow-hidden";
                          glowClass = "shadow-2xl shadow-purple-950/50 border-l-4 border-l-purple-500";
                          iconClass = "bg-purple-500 text-white animate-pulse";
                        }

                        return (
                          <button
                            type="button"
                            key={ach.id}
                            onClick={() => setSelectedAchievement(ach)}
                            title="Cliquer pour revoir le détail"
                            className={`p-3 rounded-2xl border flex items-center space-x-3 text-left font-sans transition hover:scale-[1.01] duration-150 cursor-pointer w-full ${cardStyle} ${glowClass}`}
                          >
                            <div className={`p-2.5 rounded-2xl shrink-0 shadow-xs ${iconClass}`}>
                              {achievementsTab === 'author' ? <PenTool className="w-4 h-4" /> : <BookOpen className="w-4 h-4" />}
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center justify-between gap-1">
                                <span className="text-xs font-serif font-black tracking-wide leading-none">{ach.title}</span>
                                <span className={`text-[7px] font-mono font-black px-1.5 py-0.5 rounded-full uppercase tracking-wider shrink-0 bg-black/10 text-zinc-700 dark:text-zinc-300 border border-black/10`}>
                                  {rarityBadge}
                                </span>
                              </div>
                              <p className="text-[9.5px] leading-relaxed mt-1 opacity-90">{ach.realDesc}</p>
                              {ach.unlockedDate && (
                                <p className="text-[8.5px] text-zinc-400 font-mono mt-0.5">
                                  Obtenu le {ach.unlockedDate}
                                </p>
                              )}
                            </div>
                          </button>
                        );
                      })}

                      {filteredList.length === 0 && (
                        <div className="col-span-2 py-8 text-center text-zinc-400 text-xs">
                          Aucun accomplissement ne correspond à votre recherche.
                        </div>
                      )}
                    </div>
                  </div>
                );
              })()}

            </div>

            {/* CONFIDENTIAL ADMINISTRATOR FLAG SECTION */}
            {(() => {
              const isAdminView = currentUser.role === 'Administrateur' || simulateAdminView;
              if (!isAdminView) return null;

              return (
                <div className="mt-4 p-4 bg-purple-950/20 border border-purple-500/25 rounded-2xl space-y-2 text-left">
                  <div className="flex items-center space-x-1.5 text-purple-305 dark:text-purple-300 font-bold text-xs uppercase tracking-wider">
                    <Award className="w-4 h-4 text-purple-400" />
                    <span>Statut de Certification (Réservé à l'Administration)</span>
                    {simulateAdminView && ! (currentUser.role === 'Administrateur') && (
                      <span className="text-[8px] bg-amber-500/10 text-amber-500 font-mono px-1.5 py-0.5 rounded-full border border-amber-500/20 uppercase font-black">
                        Simulé
                      </span>
                    )}
                  </div>
                  <div className="text-[10.5px] text-zinc-300 space-y-1 leading-normal">
                    <p>
                      Auteur de lecture analysé : <strong className="text-white font-black">{currentUser.username}</strong> ({currentUser.role})
                    </p>
                    <p>
                      Conformité de certification automatique :{' '}
                      {currentUser.isVerified ? (
                        <span className="text-purple-400 font-bold bg-[#A78BFA]/10 px-2 py-0.5 rounded-full text-[9px] uppercase border border-purple-500/20">
                          ✓ CERTIFIÉ AUTOMATIQUEMENT
                        </span>
                      ) : currentUser.role === 'Auteur' ? (
                        <span className="text-gray-400 font-bold bg-black/40 px-2 py-0.5 rounded-full text-[9px] uppercase border border-purple-900/20">
                          NON CERTIFIÉ (seuil de 80% des accomplissements auteur non atteint)
                        </span>
                      ) : (
                        <span className="text-gray-400 font-bold bg-black/40 px-2 py-0.5 rounded-full text-[9px] uppercase border border-purple-900/20">
                          NON APPLICABLE (certification réservée aux auteurs)
                        </span>
                      )}
                    </p>
                    {currentUser.role === 'Auteur' && (
                      <p className="text-purple-400 text-[10px] bg-purple-950/20 p-2 rounded-lg border border-purple-900/25 mt-1">
                        ✓ Les comptes Auteur bénéficient de la certification automatique dès le franchissement du seuil de 80% des trophées d'Écriture.
                      </p>
                    )}
                  </div>
                </div>
              );
            })()}

            {/* Bottom Actions footer */}
            <div className="mt-5 pt-3 border-t border-zinc-150 dark:border-zinc-850 flex items-center justify-end font-sans">
              <button
                onClick={() => {
                  setShowAllAchievements(false);
                  setAchievementsSearch('');
                }}
                className="px-5 py-2 bg-purple-650 hover:bg-purple-750 text-white rounded-xl text-xs font-black uppercase tracking-wider shadow-md cursor-pointer transition focus:outline-none"
              >
                Fermer l'espace
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 9bis. ÉNIGME D'UN BADGE (clic sur n'importe quel trophée) */}
      {selectedAchievement && (() => {
        const ach = selectedAchievement;
        const enigma = getAchievementEnigma(ach);
        const isUnlocked = ach.isUnlocked;
        const isHidden = ach.difficulty === 'facile' && !isUnlocked; // badge caché
        const rarityLabel = ach.rarity === 'mythic' ? 'Mythique'
          : ach.rarity === 'epic' ? 'Épique'
          : ach.rarity === 'rare' ? 'Rare' : 'Commun';
        // Pour un badge caché, on n'affiche jamais son vrai titre.
        const displayTitle = isUnlocked || ach.difficulty === 'difficile' ? ach.title : '??? — Badge mystère';

        return (
          <div
            className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in font-sans"
            onClick={() => setSelectedAchievement(null)}
          >
            <div
              className="bg-white dark:bg-[#15151F] border border-gray-150 dark:border-zinc-800 rounded-3xl max-w-sm w-full p-6 shadow-2xl relative text-left"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                type="button"
                onClick={() => setSelectedAchievement(null)}
                className="absolute top-3.5 right-3.5 p-1.5 rounded-full text-zinc-400 hover:text-purple-600 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition"
                title="Fermer"
              >
                <X className="w-4 h-4" />
              </button>

              <div className="flex items-center gap-2.5 mb-3">
                <div className={`p-2.5 rounded-2xl shrink-0 ${isUnlocked ? 'bg-purple-600 text-white' : 'bg-purple-500/10 text-purple-600 dark:text-purple-400'}`}>
                  {isUnlocked ? <Trophy className="w-5 h-5" /> : <KeyRound className="w-5 h-5" />}
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] uppercase tracking-widest font-black text-purple-500">
                    {isUnlocked ? 'Trophée débloqué' : 'Énigme'}
                  </p>
                  <h3 className="text-sm font-serif font-black text-zinc-900 dark:text-white leading-tight line-clamp-2">
                    {displayTitle}
                  </h3>
                </div>
              </div>

              <span className="inline-block text-[8px] bg-purple-500/10 text-purple-600 dark:text-purple-300 px-2 py-0.5 rounded-full font-black uppercase tracking-wider mb-3">
                {rarityLabel}{isHidden ? ' • Caché' : ''}
              </span>

              {isUnlocked ? (
                <div className="space-y-2">
                  <p className="text-xs text-zinc-700 dark:text-zinc-200 leading-relaxed">{ach.realDesc}</p>
                  {ach.unlockedDate && (
                    <p className="text-[10px] text-zinc-400 font-mono">Obtenu le {ach.unlockedDate}</p>
                  )}
                </div>
              ) : (
                <div className="space-y-3">
                  {/* L'énigme : citation poétique */}
                  <blockquote className="text-[13px] font-serif italic text-zinc-800 dark:text-zinc-100 leading-relaxed border-l-2 border-purple-500/50 pl-3">
                    {enigma.riddle}
                  </blockquote>
                  {/* L'indice d'action qui aide à progresser */}
                  <div className="flex items-start gap-2 bg-purple-500/5 border border-purple-500/15 rounded-xl p-3">
                    <Sparkles className="w-3.5 h-3.5 text-purple-500 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-[9px] uppercase tracking-wider font-black text-purple-500 mb-0.5">Indice</p>
                      <p className="text-[11px] text-zinc-700 dark:text-zinc-200 leading-snug">{enigma.hint}</p>
                    </div>
                  </div>
                  {isHidden && (
                    <p className="text-[9.5px] text-zinc-400 italic leading-snug">
                      Ce badge reste secret : sa nature exacte ne se révélera qu'une fois débloqué.
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>
        );
      })()}

      {/* 10. EDIT STORY METADATA OVERLAY MODAL */}
      {editingStoryMeta && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animation-fade-in font-sans">
          <div className="bg-white dark:bg-[#15151F] border border-gray-150 dark:border-zinc-800 rounded-2xl max-w-md w-full p-6 shadow-2xl relative text-left">
            <button
              onClick={() => setEditingStoryMeta(null)}
              className="absolute top-4 right-4 text-zinc-400 hover:text-zinc-655 dark:hover:text-zinc-200 text-base transition font-black cursor-pointer"
            >
              ✕
            </button>
            <div className="space-y-4">
              <div className="flex items-center space-x-2 pb-2 border-b border-zinc-100 dark:border-zinc-850/50">
                <Edit className="w-4 h-4 text-purple-600" />
                <h3 className="font-serif font-black text-sm text-gray-950 dark:text-gray-50 leading-tight">
                  Modifier les métadonnées de l'œuvre
                </h3>
              </div>

              <form onSubmit={handleSaveStoryMetaSubmit} className="space-y-3.5 max-h-[420px] overflow-y-auto pr-1">
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-450 mb-1">Titre de l'histoire</label>
                  <input
                    type="text"
                    required
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    className="w-full bg-gray-50 dark:bg-zinc-900 border border-gray-250 dark:border-zinc-800 rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-purple-600 text-gray-950 dark:text-zinc-100"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-450 mb-1">Synopsis / Description</label>
                  <textarea
                    required
                    rows={3}
                    value={editDesc}
                    onChange={(e) => setEditDesc(e.target.value)}
                    className="w-full bg-gray-50 dark:bg-zinc-900 border border-gray-255 dark:border-zinc-800 rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-purple-600 resize-none text-gray-950 dark:text-zinc-100"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-450 mb-1">Genre</label>
                    <select
                      value={editGenre}
                      onChange={(e) => setEditGenre(e.target.value)}
                      className="w-full bg-gray-50 dark:bg-zinc-900 border border-gray-255 dark:border-zinc-800 rounded-xl px-2 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-purple-600 text-gray-950 dark:text-zinc-100"
                    >
                      {GENRES.map(g => (
                        <option key={g} value={g}>{g}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-450 mb-1">Classification d'âge</label>
                    <select
                      value={editAgeRating}
                      onChange={(e) => setEditAgeRating(e.target.value as any)}
                      className="w-full bg-gray-50 dark:bg-zinc-900 border border-gray-255 dark:border-zinc-800 rounded-xl px-2 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-purple-600 text-gray-950 dark:text-zinc-100"
                    >
                      <option value="all">Tout Public</option>
                      <option value="12">12 Ans & Plus</option>
                      <option value="16">Ado Averti (16+)</option>
                      <option value="18">Strict (+18)</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-455 mb-1">Mots-clés / Tags (séparés par une virgule)</label>
                  <input
                    type="text"
                    placeholder="Ex: Cyberpunk, Romancé, Enquête"
                    value={editTags}
                    onChange={(e) => setEditTags(e.target.value)}
                    className="w-full bg-gray-50 dark:bg-zinc-900 border border-gray-250 dark:border-zinc-800 rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-purple-600 text-gray-950 dark:text-zinc-100"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3 pt-3 border-t border-zinc-100 dark:border-zinc-850">
                  <button
                    type="button"
                    onClick={() => setEditingStoryMeta(null)}
                    className="w-full py-2 bg-gray-100 dark:bg-zinc-855 hover:bg-gray-200 dark:hover:bg-zinc-800 text-gray-700 dark:text-zinc-200 rounded-xl text-[10px] font-black uppercase tracking-wider transition cursor-pointer"
                  >
                    Annuler
                  </button>
                  <button
                    type="submit"
                    className="w-full py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-[10px] font-black uppercase tracking-wider transition cursor-pointer shadow-md shadow-purple-500/10"
                  >
                    Enregistrer
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* 11. STORY METADATA DELETE CONFIRMATION OVERLAY MODAL */}
      {storyToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animation-fade-in font-sans">
          <div className="bg-white dark:bg-[#15151F] border border-gray-150 dark:border-zinc-800 rounded-2xl max-w-sm w-full p-6 shadow-2xl relative text-center">
            <div className="space-y-4">
              <div className="w-12 h-12 bg-red-500/10 text-red-500 rounded-full flex items-center justify-center mx-auto mb-2 animate-pulse">
                <Trash2 className="w-5 h-5" />
              </div>
              <h3 className="font-serif font-black text-base text-gray-950 dark:text-gray-50 leading-tight">
                Supprimer "{storyToDelete.title}" ?
              </h3>
              <p className="text-xs text-gray-400 dark:text-zinc-400 leading-relaxed font-sans">
                Cette action est irréversible. L'œuvre, ses chapitres parus, ses brouillons associés, ses commentaires et ses statistiques de lecture seront définitivement effacés de la plateforme.
              </p>
              <div className="grid grid-cols-2 gap-3 pt-2 font-sans">
                <button
                  id="profile-delete-cancel"
                  onClick={() => setStoryToDelete(null)}
                  className="w-full py-2 bg-gray-100 dark:bg-zinc-850 hover:bg-gray-200 dark:hover:bg-zinc-800 text-gray-750 dark:text-zinc-200 rounded-xl text-[10px] font-black uppercase tracking-wider transition cursor-pointer"
                >
                  Annuler
                </button>
                <button
                  id="profile-delete-ok"
                  onClick={() => {
                    onDeleteStory(storyToDelete.id);
                    setStoryToDelete(null);
                  }}
                  className="w-full py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-[10px] font-black uppercase tracking-wider transition shadow-lg shadow-red-500/10 cursor-pointer"
                >
                  Confirmer
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 12. PLUME SETTINGS OVERLAY MODAL */}
      {isSettingsOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/85 backdrop-blur-sm animation-fade-in font-sans select-none">
          <div className="bg-white dark:bg-[#0E0E14] border border-gray-200 dark:border-purple-950/40 rounded-2xl max-w-xl w-full h-[85vh] sm:h-[620px] shadow-[0_24px_70px_rgba(0,0,0,0.65)] relative flex flex-col overflow-hidden text-left">
            
            {selectedSettingsSection === null ? (
              /* =========================================================================
                 SETTINGS ROOT: MAIN VERTICAL LIST VIEW
                 ========================================================================= */
              <>
                {/* Header */}
                <div className="px-5 py-4 border-b border-gray-150 dark:border-zinc-850 flex items-center justify-between shrink-0">
                  <div className="flex items-center space-x-2 text-purple-605 font-bold">
                    <Settings className="w-4 h-4 text-purple-600 stroke-[2.5]" />
                    <span className="font-serif font-black text-xs uppercase tracking-wider text-gray-900 dark:text-gray-100">
                      Paramètres
                    </span>
                  </div>
                  <button
                    onClick={() => setIsSettingsOpen(false)}
                    className="p-1 text-zinc-400 hover:text-black dark:hover:text-white transition font-black text-xs cursor-pointer"
                    title="Fermer les paramètres"
                  >
                    ✕
                  </button>
                </div>

                {/* Status Toast Notification banner inside Settings */}
                {showStatusToast && (
                  <div className="mx-5 mt-4 px-4 py-2 bg-purple-600 text-white text-[10px] uppercase font-black tracking-wider rounded-xl shadow-md border border-purple-500/25 flex items-center justify-between animate-fade-in">
                    <span>{showStatusToast}</span>
                    <button onClick={() => setShowStatusToast(null)} className="font-black text-white ml-2 text-xs">✕</button>
                  </div>
                )}

                {/* Vertical list layout details */}
                <div className="flex-1 overflow-y-auto p-5 select-none space-y-3">
                  <p className="text-[10px] text-zinc-500 font-serif leading-relaxed mb-4">
                    Gérez vos préférences de navigation, confidentialité, d'éditeur auteur et de sécurité de session.
                  </p>

                  {[
                    { id: 'account', name: 'Compte', icon: UserIcon, desc: 'Identité principale et statistiques littéraires privées' },
                    { id: 'privacy', name: 'Confidentialité', icon: Lock, desc: 'Profil privé, abonnés et visibilité de vos lectures/écritures' },
                    ...(currentUser.role !== 'Auteur' ? [{ id: 'reading', name: 'Lecture', icon: BookOpen, desc: 'Ajustement de texte, polices de contes et thèmes' }] : []),
                    ...(currentUser.role !== 'Lecteur' ? [{ id: 'write', name: 'Écriture', icon: PenTool, desc: 'Configurations auteur, brouillons et dossiers' }] : []),
                    { id: 'notifications', name: 'Notifications', icon: Sparkles, desc: 'Paramètres d’alertes de chapitre et de suivis' },
                    { id: 'security', name: 'Sécurité', icon: CheckCircle, desc: 'Changement de mot de passe et connexions' },
                    { id: 'about', name: 'À propos', icon: Sliders, desc: 'Politiques de confidentialité et assistance' }
                  ].map((tab) => {
                    const IconComponent = tab.icon;
                    return (
                      <button
                        key={tab.id}
                        id={`settings-item-${tab.id}`}
                        onClick={() => {
                          setSelectedSettingsSection(tab.id as any);
                          setActiveSettingsTab(tab.id as any);
                        }}
                        className="w-full flex items-center justify-between p-3.5 bg-zinc-50 dark:bg-[#08080C] border border-gray-150 dark:border-zinc-850 hover:border-purple-605/30 hover:bg-purple-600/5 dark:hover:bg-purple-950/10 rounded-2xl transition-all duration-200 cursor-pointer text-left group"
                      >
                        <div className="flex items-center space-x-3">
                          <div className="p-2 bg-white dark:bg-zinc-950 border border-zinc-150 dark:border-zinc-850/50 rounded-lg text-purple-600 dark:text-purple-400 shrink-0 group-hover:bg-purple-600 group-hover:text-white transition duration-200">
                            <IconComponent className="w-4 h-4 stroke-[2]" />
                          </div>
                          <div>
                            <span className="block text-[11.5px] font-bold text-gray-900 dark:text-gray-100 group-hover:text-purple-600 dark:group-hover:text-purple-400 transition">
                              {tab.name}
                            </span>
                            <span className="block text-[8.5px] text-zinc-455 mt-0.5 leading-snug">
                              {tab.desc}
                            </span>
                          </div>
                        </div>
                        <ChevronRight className="w-4 h-4 text-zinc-405 group-hover:text-purple-600 group-hover:translate-x-0.5 transition duration-200 shrink-0" />
                      </button>
                    );
                  })}

                  <div className="flex flex-col items-center justify-center pt-6 mt-4 border-t border-gray-150 dark:border-zinc-850/50 text-center text-zinc-400 dark:text-zinc-500 select-none">
                    <span className="text-[8px] font-mono tracking-widest uppercase font-black">PLUME MOBILE v1.4.0</span>
                    <span className="text-[8px] font-serif italic mt-1 pb-2">Écritures & Lectures • Violet & Blanc & Noir</span>
                  </div>
                </div>

                {/* Footer close option */}
                <div className="px-5 py-3 border-t border-gray-150 dark:border-zinc-850 flex items-center justify-end bg-gray-50 dark:bg-[#08080C] shrink-0 font-sans">
                  <button
                    onClick={() => setIsSettingsOpen(false)}
                    className="w-full sm:w-auto py-2 px-5 bg-gray-150 dark:bg-zinc-900 hover:bg-gray-200 dark:hover:bg-zinc-800 text-gray-800 dark:text-zinc-200 border border-gray-200 dark:border-zinc-805 rounded-xl text-[10px] font-black uppercase tracking-wider transition cursor-pointer text-center"
                  >
                    Fermer
                  </button>
                </div>
              </>
            ) : (
              /* =========================================================================
                 SETTINGS DETAIL: EXPANDED DETAILED CATEGORY VIEW
                 ========================================================================= */
              <>
                {/* Header inside detailed view */}
                <div className="px-5 py-4 border-b border-gray-150 dark:border-zinc-850 flex items-center justify-between shrink-0">
                  <button
                    onClick={() => setSelectedSettingsSection(null)}
                    className="p-1 px-2.5 text-purple-605 dark:text-purple-400 hover:bg-purple-600/10 transition cursor-pointer flex items-center gap-1.5 border border-purple-500/15 rounded-xl text-[10px] font-black uppercase tracking-wide"
                    title="Retour"
                  >
                    <ChevronLeft className="w-4 h-4 stroke-[2.5]" />
                    <span>Retour</span>
                  </button>

                  <h3 className="font-serif font-black text-xs uppercase tracking-wider text-purple-655 dark:text-purple-400">
                    {activeSettingsTab === 'account' && "Mon Compte"}
                    {activeSettingsTab === 'privacy' && "Confidentialité"}
                    {activeSettingsTab === 'reading' && "Préférences de Lecture"}
                    {activeSettingsTab === 'write' && "Configuration d'Écriture"}
                    {activeSettingsTab === 'notifications' && "Alertes & Cloches"}
                    {activeSettingsTab === 'security' && "Sécurité du Compte"}
                    {activeSettingsTab === 'about' && "Aide & À propos"}
                  </h3>

                  <button
                    onClick={() => setIsSettingsOpen(false)}
                    className="p-1 text-zinc-400 hover:text-black dark:hover:text-white transition font-black text-xs cursor-pointer"
                    title="Fermer les paramètres"
                  >
                    ✕
                  </button>
                </div>

                {/* Status Toast Notification banner inside Settings */}
                {showStatusToast && (
                  <div className="mx-5 mt-4 px-4 py-2 bg-purple-600 text-white text-[10px] uppercase font-black tracking-wider rounded-xl shadow-md border border-purple-500/25 flex items-center justify-between animate-fade-in font-sans">
                    <span>{showStatusToast}</span>
                    <button onClick={() => setShowStatusToast(null)} className="font-black text-white ml-2 text-xs">✕</button>
                  </div>
                )}

                {/* Scrollable contents */}
                <div className="flex-1 overflow-y-auto p-5 select-none space-y-6">

                  {/* =========================================================================
                      TAB: ACCOUNT
                      ========================================================================= */}
                  {activeSettingsTab === 'account' && (
                    <div className="space-y-5 animate-scale-up">
                      <p className="text-[10px] text-zinc-400 font-serif leading-relaxed">
                      Configurez l'identité principale et déterminez le mode d'interaction de votre compte sur Plume.
                    </p>

                    {/* Section: Modifier le profil */}
                    <div className="space-y-4 bg-zinc-50 dark:bg-zinc-900/20 border border-purple-500/5 p-4 rounded-2xl shadow-sm">
                      <h4 className="text-[10px] font-black uppercase text-zinc-700 dark:text-zinc-300 tracking-wider">
                        Modifier le profil
                      </h4>
                      <div className="space-y-3">
                        <div className="space-y-1">
                          <label className="text-[9px] uppercase font-black tracking-wider text-zinc-400">Nom d'utilisateur</label>
                          <input 
                            type="text"
                            value={localUsername}
                            onChange={(e) => setLocalUsername(e.target.value)}
                            onBlur={() => {
                              if (localUsername.trim() !== currentUser.username) {
                                onUpdateProfile({ username: localUsername });
                                setShowStatusToast("Nom d'utilisateur mis à jour !");
                                setTimeout(() => setShowStatusToast(null), 3500);
                              }
                            }}
                            className="w-full bg-white dark:bg-zinc-950 border border-gray-200 dark:border-zinc-850 text-gray-900 dark:text-white px-3 py-2 rounded-xl text-xs focus:border-purple-600 focus:outline-none font-medium"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[9px] uppercase font-black tracking-wider text-zinc-400">Biographie (Présentation)</label>
                          <textarea 
                            value={localBio}
                            onChange={(e) => setLocalBio(e.target.value)}
                            onBlur={() => {
                              if (localBio !== (currentUser.bio || '')) {
                                onUpdateProfile({ bio: localBio });
                                setShowStatusToast("Biographie mise à jour !");
                                setTimeout(() => setShowStatusToast(null), 3500);
                              }
                            }}
                            rows={3}
                            className="w-full bg-white dark:bg-zinc-950 border border-gray-200 dark:border-zinc-850 text-gray-900 dark:text-white px-3 py-2 rounded-xl text-xs focus:border-purple-600 focus:outline-none font-medium leading-relaxed"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Section: Mail Update */}
                    <div className="space-y-3 bg-zinc-50 dark:bg-zinc-900/20 border border-purple-500/5 p-4 rounded-2xl">
                      <h4 className="text-[10px] font-black uppercase text-zinc-700 dark:text-zinc-300 tracking-wider">
                        Adresse E-mail
                      </h4>
                      <input 
                        type="email"
                        value={localEmail}
                        onChange={(e) => setLocalEmail(e.target.value)}
                        onBlur={() => {
                          if (localEmail.trim() !== currentUser.email && localEmail.includes('@')) {
                            onUpdateProfile({ email: localEmail });
                            setShowStatusToast("E-mail enregistré avec succès !");
                            setTimeout(() => setShowStatusToast(null), 3500);
                          }
                        }}
                        className="w-full bg-white dark:bg-zinc-950 border border-gray-200 dark:border-zinc-850 text-gray-900 dark:text-white px-3 py-2 rounded-xl text-xs focus:border-purple-600 focus:outline-none font-medium"
                      />
                    </div>

                    {/* Section: Type de compte */}
                    <div className="space-y-3 bg-zinc-50 dark:bg-zinc-900/20 border border-purple-500/5 p-4 rounded-2xl">
                      <h4 className="text-[10px] font-black uppercase text-purple-600 dark:text-purple-400 tracking-wider">
                        Type de compte
                      </h4>

                      {currentUser.hasChangedRole ? (
                        <div className="p-3 bg-purple-500/5 dark:bg-[#06060A] border border-purple-500/10 rounded-xl space-y-1">
                          <p className="text-[11px] text-gray-900 dark:text-zinc-300 font-medium leading-tight">
                            Vous avez déjà utilisé votre unique modification.
                          </p>
                          <p className="text-[9px] text-zinc-400">
                            Chaque compte Plume est verrouillé sur son type définitif (actuellement : {currentUser.role}) pour préserver l'équilibre de sa bibliographie.
                          </p>
                        </div>
                      ) : currentUser.role === 'Administrateur' ? (
                        <div className="p-3 bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-850 rounded-xl">
                          <p className="text-[10px] text-zinc-400">
                            En tant qu'Administrateur, votre statut global est obligatoire.
                          </p>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          <p className="text-[10px] text-zinc-450 leading-relaxed">
                            Pour optimiser votre interface, déterminez votre spécialité de compte. <strong className="text-purple-600 dark:text-purple-400">Cette action n'est réalisable qu'une seule fois !</strong>
                          </p>

                          <div className="space-y-2">
                            {[
                              { id: 'Lecteur', name: 'Lecteur', desc: 'Découvrir en lecture et rédiger des commentaires.' },
                              { id: 'Auteur', name: 'Auteur', desc: 'Composer et publier des récits officiels.' }
                            ].map((item) => {
                              const isSelected = selectedRoleType === item.id;
                              return (
                                <button
                                  key={item.id}
                                  onClick={() => setSelectedRoleType(item.id as UserRole)}
                                  className={`w-full text-left p-3 rounded-xl border transition-all cursor-pointer ${
                                    isSelected
                                      ? 'bg-purple-600/5 dark:bg-purple-900/10 border-purple-605 text-gray-950 dark:text-white'
                                      : 'bg-white dark:bg-zinc-950 border-gray-150 dark:border-zinc-850 text-gray-600 dark:text-zinc-400 hover:bg-gray-50'
                                  }`}
                                >
                                  <div className="flex items-center justify-between">
                                    <span className="font-bold text-[10.5px]">{item.name}</span>
                                    {isSelected && <Check className="w-3.5 h-3.5 text-purple-605" />}
                                  </div>
                                  <p className="text-[9px] text-zinc-450 dark:text-zinc-500 mt-0.5 leading-snug">
                                    {item.desc}
                                  </p>
                                </button>
                              );
                            })}

                            {selectedRoleType !== currentUser.role && (
                              <button
                                onClick={() => setShowRoleChangeConfirm(true)}
                                className="w-full mt-2 py-2 bg-purple-600 hover:bg-purple-750 text-white rounded-xl text-[10px] font-black uppercase tracking-wider transition shadow-md cursor-pointer"
                              >
                                Confirmer la modification unique
                              </button>
                            )}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* PRIVATE AUDIENCE STATS (Moved from public profile) */}
                    <div className="w-full bg-gradient-to-br from-purple-900/10 via-purple-950/15 to-black/30 p-4 rounded-2xl border border-purple-650/20 text-left space-y-3 font-sans">
                      <div className="flex items-center space-x-2 text-[10px] font-black uppercase text-purple-400 tracking-wider">
                        <Sliders className="w-4 h-4 text-purple-400 stroke-2" />
                        <span>📈 Mes Statistiques Littéraires Privées</span>
                      </div>
                      
                      <p className="text-[9.5px] text-zinc-400 leading-relaxed font-serif">
                        Ces indices d'audience confidentiels ne sont visibles que par vous sous vos paramètres pour guider le perfectionnement de vos récits.
                      </p>

                      <div className="grid grid-cols-4 gap-2 text-center pt-1">
                        <div className="p-2.5 bg-black/45 rounded-xl border border-white/5">
                          <span className="text-[8px] block text-zinc-400 uppercase font-bold tracking-wider">Vues</span>
                          <span className="font-mono text-sm font-black text-purple-400 block mt-1">{totalViews}</span>
                          <span className="text-[7px] text-zinc-500 block leading-tight mt-0.5">Visites</span>
                        </div>

                        <div className="p-2.5 bg-black/45 rounded-xl border border-white/5">
                          <span className="text-[8px] block text-zinc-400 uppercase font-bold tracking-wider">Lectures</span>
                          <span className="font-mono text-sm font-black text-emerald-400 block mt-1">{totalReads}</span>
                          <span className="text-[7px] text-zinc-500 block leading-tight mt-0.5">Finition</span>
                        </div>

                        <div className="p-2.5 bg-black/45 rounded-xl border border-white/5">
                          <span className="text-[8px] block text-zinc-400 uppercase font-bold tracking-wider">Mentions</span>
                          <span className="font-mono text-sm font-black text-rose-400 block mt-1">{totalLikes}</span>
                          <span className="text-[7px] text-zinc-500 block leading-tight mt-0.5">Votes</span>
                        </div>

                        <div className="p-2.5 bg-black/45 rounded-xl border border-white/5">
                          <span className="text-[8px] block text-zinc-400 uppercase font-bold tracking-wider">Fidélité</span>
                          <span className="font-mono text-sm font-black text-indigo-400 block mt-1">
                            {totalViews > 0 ? ((totalReads / totalViews) * 100).toFixed(1) : "0.0"}%
                          </span>
                          <span className="text-[7px] text-zinc-500 block leading-tight mt-0.5">Complétion</span>
                        </div>
                      </div>
                    </div>

                    {/* Section: Supprimer le compte */}
                    <div className="p-4 bg-red-500/5 id-deletesection border border-red-500/10 rounded-2xl flex items-center justify-between">
                      <div className="space-y-0.5">
                        <span className="text-[10px] font-black uppercase text-red-500 tracking-wider block">Zone dangereuse</span>
                        <span className="text-[9px] text-zinc-450 block font-medium">Cette action effacera définitivement toutes vos données Plume.</span>
                      </div>
                      <button
                        onClick={async () => {
                          const confirmDelete = window.confirm("ATTENTION : Êtes-vous absolument sûr de vouloir supprimer définitivement votre compte Plume ? Cette opération est irréversible.");
                          if (!confirmDelete) return;
                          try {
                            const res = await fetch(`/api/users/${currentUser.id}`, {
                              method: 'DELETE',
                              headers: authHeaders(),
                            });
                            if (!res.ok && res.status !== 204) {
                              const data = await res.json().catch(() => ({}));
                              throw new Error(data.error || `Erreur ${res.status}`);
                            }
                            setIsSettingsOpen(false);
                            onLogout?.();
                            alert("Votre compte et toutes vos données ont été supprimés définitivement. Au revoir !");
                          } catch (err: any) {
                            alert(`La suppression a échoué : ${err.message || 'erreur serveur'}. Réessayez plus tard.`);
                          }
                        }}
                        className="py-2 px-3 bg-red-650 hover:bg-red-750 text-white rounded-xl text-[9px] font-black uppercase tracking-widest transition cursor-pointer"
                      >
                        Supprimer
                      </button>
                    </div>

                    {/* Liens légaux (requis stores) */}
                    <div className="flex items-center justify-center gap-3 pt-1 text-[9px] text-zinc-400">
                      <a href="/privacy.html" target="_blank" rel="noreferrer" className="hover:text-purple-500 underline">Confidentialité</a>
                      <span>·</span>
                      <a href="/terms.html" target="_blank" rel="noreferrer" className="hover:text-purple-500 underline">Conditions d'utilisation</a>
                    </div>
                  </div>
                )}


                {/* =========================================================================
                    TAB: PRIVACY
                    ========================================================================= */}
                {activeSettingsTab === 'privacy' && (
                  <div className="space-y-4 animate-scale-up">
                    <p className="text-[10px] text-zinc-400 font-serif leading-relaxed">
                      Prenez le contrôle de ce que les autres utilisateurs de Plume voient de votre activité sociale.
                    </p>

                    <div className="bg-zinc-50 dark:bg-zinc-900/20 border border-purple-500/5 p-4 rounded-2xl shadow-sm space-y-4">
                      
                      {/* Profil Privé */}
                      <div className="flex items-center justify-between pb-3 border-b border-gray-100 dark:border-zinc-850">
                        <div className="space-y-0.5 pr-4">
                          <label className="text-[11px] font-bold text-gray-900 dark:text-white block">Profil privé</label>
                          <span className="text-[9px] text-zinc-455 block">Seuls les abonnés approuvés pourront voir vos commentaires et favoris.</span>
                        </div>
                        <input 
                          type="checkbox" 
                          checked={currentUser.privateProfile ?? false}
                          onChange={(e) => {
                            onUpdateProfile({ privateProfile: e.target.checked });
                            setShowStatusToast(e.target.checked ? "Profil passé en Privé !" : "Profil de nouveau Public !");
                            setTimeout(() => setShowStatusToast(null), 2550);
                          }}
                          className="w-4 h-4 text-purple-650 rounded border-gray-300 focus:ring-purple-500 cursor-pointer"
                        />
                      </div>

                      {/* Afficher mes abonnés */}
                      <div className="flex items-center justify-between pb-3 border-b border-gray-100 dark:border-zinc-850">
                        <div className="space-y-0.5 pr-4">
                          <label className="text-[11px] font-bold text-gray-900 dark:text-white block">Afficher mes abonnés</label>
                          <span className="text-[9px] text-zinc-455 block">Permettre aux autres utilisateurs de voir la liste de mes abonnés. (Privé par défaut)</span>
                        </div>
                        <input 
                          type="checkbox" 
                          checked={currentUser.showFollowers ?? false}
                          onChange={(e) => {
                            onUpdateProfile({ showFollowers: e.target.checked });
                            setShowStatusToast(e.target.checked ? "Abonnés visibles publiquement !" : "Abonnés masqués (Privés) !");
                            setTimeout(() => setShowStatusToast(null), 2550);
                          }}
                          className="w-4 h-4 text-purple-650 rounded border-gray-300 focus:ring-purple-500 cursor-pointer"
                        />
                      </div>

                      {/* Afficher mes suivis */}
                      <div className="flex items-center justify-between pb-3 border-b border-gray-100 dark:border-zinc-850">
                        <div className="space-y-0.5 pr-4">
                          <label className="text-[11px] font-bold text-gray-900 dark:text-white block">Afficher mes suivis</label>
                          <span className="text-[9px] text-zinc-455 block">Permettre aux autres utilisateurs de parcourir mes abonnements d'auteurs. (Privé par défaut)</span>
                        </div>
                        <input 
                          type="checkbox" 
                          checked={currentUser.showFollowing ?? false}
                          onChange={(e) => {
                            onUpdateProfile({ showFollowing: e.target.checked });
                            setShowStatusToast(e.target.checked ? "Suivis visibles publiquement !" : "Suivis masqués (Privés) !");
                            setTimeout(() => setShowStatusToast(null), 2550);
                          }}
                          className="w-4 h-4 text-purple-650 rounded border-gray-300 focus:ring-purple-500 cursor-pointer"
                        />
                      </div>

                      {/* Afficher mes amis */}
                      <div className="flex items-center justify-between pb-3 border-b border-gray-100 dark:border-zinc-850">
                        <div className="space-y-0.5 pr-4">
                          <label className="text-[11px] font-bold text-gray-900 dark:text-white block">Afficher mes amis</label>
                          <span className="text-[9px] text-zinc-455 block">Permettre aux autres utilisateurs de voir la liste de mes amis. (Privé par défaut)</span>
                        </div>
                        <input 
                          type="checkbox" 
                          checked={currentUser.showFriends ?? false}
                          onChange={(e) => {
                            onUpdateProfile({ showFriends: e.target.checked });
                            setShowStatusToast(e.target.checked ? "Amis visibles publiquement !" : "Amis masqués (Privés) !");
                            setTimeout(() => setShowStatusToast(null), 2550);
                          }}
                          className="w-4 h-4 text-purple-650 rounded border-gray-300 focus:ring-purple-500 cursor-pointer"
                        />
                      </div>

                      {/* Afficher mes mentions */}
                      <div className="flex items-center justify-between pb-3 border-b border-gray-100 dark:border-zinc-850">
                        <div className="space-y-0.5 pr-4">
                          <label className="text-[11px] font-bold text-gray-900 dark:text-white block">Afficher mes mentions</label>
                          <span className="text-[9px] text-zinc-455 block">Permettre aux autres utilisateurs de voir mes mentions reçues. (Privé par défaut)</span>
                        </div>
                        <input 
                          type="checkbox" 
                          checked={currentUser.showMentions ?? false}
                          onChange={(e) => {
                            onUpdateProfile({ showMentions: e.target.checked });
                            setShowStatusToast(e.target.checked ? "Mentions visibles publiquement !" : "Mentions masquées (Privées) !");
                            setTimeout(() => setShowStatusToast(null), 2550);
                          }}
                          className="w-4 h-4 text-purple-650 rounded border-gray-300 focus:ring-purple-500 cursor-pointer"
                        />
                      </div>

                      {/* Afficher le nombre de livres lus */}
                      <div className="flex items-center justify-between pb-3 border-b border-gray-100 dark:border-zinc-850">
                        <div className="space-y-0.5 pr-4">
                          <label className="text-[11px] font-bold text-gray-900 dark:text-white block">Afficher le nombre de livres lus</label>
                          <span className="text-[9px] text-zinc-455 block">Afficher publiquement sur votre profil le nombre de livres que vous avez terminés. (Privé par défaut)</span>
                        </div>
                        <input 
                          type="checkbox" 
                          checked={currentUser.showBooksRead ?? false}
                          onChange={(e) => {
                            onUpdateProfile({ showBooksRead: e.target.checked });
                            setShowStatusToast(e.target.checked ? "Affichage du livre lus activé !" : "Affichage du livre lus désactivé !");
                            setTimeout(() => setShowStatusToast(null), 2550);
                          }}
                          className="w-4 h-4 text-purple-650 rounded border-gray-300 focus:ring-purple-500 cursor-pointer"
                        />
                      </div>

                      {/* Afficher le nombre de livres écrits */}
                      <div className="flex items-center justify-between pb-3 border-b border-gray-100 dark:border-zinc-850">
                        <div className="space-y-0.5 pr-4">
                          <label className="text-[11px] font-bold text-gray-900 dark:text-white block">Afficher le nombre de livres écrits</label>
                          <span className="text-[9px] text-zinc-455 block">Afficher publiquement sur votre profil le nombre d'œuvres littéraires créées. (Privé par défaut)</span>
                        </div>
                        <input 
                          type="checkbox" 
                          checked={currentUser.showBooksWritten ?? false}
                          onChange={(e) => {
                            onUpdateProfile({ showBooksWritten: e.target.checked });
                            setShowStatusToast(e.target.checked ? "Affichage du livre écrits activé !" : "Affichage du livre écrits désactivé !");
                            setTimeout(() => setShowStatusToast(null), 2550);
                          }}
                          className="w-4 h-4 text-purple-650 rounded border-gray-300 focus:ring-purple-500 cursor-pointer"
                        />
                      </div>

                      {/* Messages Privés */}
                      <div className="flex items-center justify-between pb-3 border-b border-gray-100 dark:border-zinc-855">
                        <div className="space-y-0.5 pr-4">
                          <label className="text-[11px] font-bold text-gray-900 dark:text-white block">Autoriser les messages privés</label>
                          <span className="text-[9px] text-zinc-455 block">Permettre aux visiteurs d'engager une discussion par messagerie interne.</span>
                        </div>
                        <input 
                          type="checkbox" 
                          checked={currentUser.allowMessages ?? true}
                          onChange={(e) => {
                            onUpdateProfile({ allowMessages: e.target.checked });
                            setShowStatusToast(e.target.checked ? "Messages privés activés !" : "Messages privés restreints !");
                            setTimeout(() => setShowStatusToast(null), 2550);
                          }}
                          className="w-4 h-4 text-purple-650 rounded border-gray-300 focus:ring-purple-500 cursor-pointer"
                        />
                      </div>

                      {/* Qui peut me suivre */}
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest block font-mono">Qui peut me suivre</label>
                        <select 
                          value={currentUser.whoCanFollow ?? 'all'}
                          onChange={(e) => {
                            onUpdateProfile({ whoCanFollow: e.target.value });
                            setShowStatusToast("Préférences de suivi sauvegardées !");
                            setTimeout(() => setShowStatusToast(null), 2550);
                          }}
                          className="w-full bg-white dark:bg-zinc-950 border border-gray-200 dark:border-zinc-850 text-xs px-3 py-2 rounded-xl text-zinc-850 dark:text-zinc-200 focus:outline-none focus:border-purple-600"
                        >
                          <option value="all">Tout le monde</option>
                          <option value="none">Personne (Bloquer les nouveaux abonnements)</option>
                        </select>
                      </div>

                      {/* Qui peut commenter */}
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest block font-mono">Qui peut commenter mes histoires</label>
                        <select 
                          value={currentUser.whoCanComment ?? 'all'}
                          onChange={(e) => {
                            onUpdateProfile({ whoCanComment: e.target.value });
                            setShowStatusToast("Préférences de commentaires sauvegardées !");
                            setTimeout(() => setShowStatusToast(null), 2550);
                          }}
                          className="w-full bg-white dark:bg-zinc-950 border border-gray-200 dark:border-zinc-850 text-xs px-3 py-2 rounded-xl text-zinc-850 dark:text-zinc-200 focus:outline-none focus:border-purple-600"
                        >
                          <option value="all">Tout le monde, lecteurs connectés</option>
                          <option value="followers">Mes abonnés uniquement</option>
                          <option value="none">Personne (Désactiver l'espace commentaire)</option>
                        </select>
                      </div>

                      {/* Comptes Bloqués */}
                      <div className="pt-2">
                        <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest block mb-1 font-mono">Comptes bloqués</label>
                        <p className="text-[9.5px] text-zinc-400 italic">Aucun utilisateur n'est actuellement inscrit dans votre liste de blocage.</p>
                      </div>
                    </div>
                  </div>
                )}


                {/* =========================================================================
                    TAB: READING
                    ========================================================================= */}
                {activeSettingsTab === 'reading' && (
                  <div className="space-y-4 animate-scale-up">
                    <p className="text-[10px] text-zinc-400 font-serif leading-relaxed">
                      Réglez les variables de rendu pour vos séances de lecture de nuit ou de grand soleil.
                    </p>

                    <div className="bg-zinc-50 dark:bg-zinc-900/20 border border-purple-500/5 p-4 rounded-2xl space-y-4">
                      
                      {/* Thème de lecture du texte */}
                      <div className="space-y-1.5 flex-col flex">
                        <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider block font-mono">Thème de rendu liseuse</label>
                        <div className="grid grid-cols-3 gap-2">
                          {['Clair', 'Sombre', 'Sépia'].map((themeName) => {
                            const isSel = (currentUser.readingTheme ?? 'Sombre') === themeName;
                            return (
                              <button
                                key={themeName}
                                onClick={() => {
                                  onUpdateProfile({ readingTheme: themeName });
                                  setShowStatusToast(`Thème liseuse défini sur ${themeName}`);
                                  setTimeout(() => setShowStatusToast(null), 2500);
                                }}
                                className={`py-1.5 px-3 rounded-xl text-[10px] uppercase tracking-wide font-black border transition cursor-pointer ${
                                  isSel 
                                    ? 'bg-purple-600 text-white border-purple-600' 
                                    : 'bg-white dark:bg-zinc-950 text-gray-700 dark:text-zinc-300 border-gray-150 dark:border-zinc-850 hover:bg-gray-100'
                                }`}
                              >
                                {themeName}
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      {/* Taille du texte */}
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider block font-mono">Taille de police</label>
                        <select 
                          value={currentUser.readingFontSize ?? 'Standard'}
                          onChange={(e) => {
                            onUpdateProfile({ readingFontSize: e.target.value });
                          }}
                          className="w-full bg-white dark:bg-zinc-950 border border-gray-200 dark:border-zinc-850 text-xs px-3 py-2 rounded-xl focus:outline-none"
                        >
                          <option value="Petit">Petite (12px)</option>
                          <option value="Standard">Standard (15px)</option>
                          <option value="Grand">Grande (18px)</option>
                          <option value="Tres Grand">Très Grande (22px)</option>
                        </select>
                      </div>

                      {/* Police de lecture */}
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider block font-mono">Famille typographique</label>
                        <select 
                          value={currentUser.readingFontFamily ?? 'Sans-Serif'}
                          onChange={(e) => {
                            onUpdateProfile({ readingFontFamily: e.target.value });
                          }}
                          className="w-full bg-white dark:bg-zinc-950 border border-gray-200 dark:border-zinc-850 text-xs px-3 py-2 rounded-xl focus:outline-none"
                        >
                          <option value="Sans-Serif">Sans-Serif (Inter - Moderne)</option>
                          <option value="Serif">Serif (Playfair - Littéraire)</option>
                          <option value="Monospace">Monospace (JetBrains - Technique)</option>
                        </select>
                      </div>

                      {/* Mode Plein Écran */}
                      <div className="flex items-center justify-between pt-1.5 pb-2 border-b border-gray-100 dark:border-zinc-850">
                        <label className="text-[11px] font-bold text-gray-900 dark:text-white block">Cacher la barre d'onglets (Plein écran)</label>
                        <input 
                          type="checkbox" 
                          checked={currentUser.readingFullscreen ?? false}
                          onChange={(e) => {
                            onUpdateProfile({ readingFullscreen: e.target.checked });
                          }}
                          className="w-4 h-4 text-purple-650 rounded cursor-pointer"
                        />
                      </div>

                      {/* Historique de lecture */}
                      <div className="space-y-2 pt-2">
                        <div className="flex items-center justify-between">
                          <label className="text-[10px] font-bold text-zinc-550 uppercase tracking-wider block font-mono">Historique de lecture</label>
                          <button
                            onClick={() => {
                              alert("L'historique des livres consultés a été vidé.");
                              setShowStatusToast("Historique de lecture nettoyé !");
                              setTimeout(() => setShowStatusToast(null), 2500);
                            }}
                            className="text-[9px] uppercase font-black text-purple-600 hover:text-purple-750 font-serif cursor-pointer"
                          >
                            Effacer tout l’historique
                          </button>
                        </div>
                        <p className="text-[9.5px] text-zinc-400 italic">Dernier ouvrage lu : "Les Échos du Cosmos" (Chapitre 1)</p>
                      </div>
                    </div>
                  </div>
                )}


                {/* =========================================================================
                    TAB: WRITE
                    ========================================================================= */}
                {activeSettingsTab === 'write' && (
                  <div className="space-y-4 animate-scale-up">
                    <p className="text-[10px] text-zinc-400 font-serif leading-relaxed">
                      Paramètres du pupitre créateur d'histoire. Paramétrez les automatismes de composition.
                    </p>

                    <div className="bg-zinc-50 dark:bg-zinc-900/20 border border-purple-500/5 p-4 rounded-2xl space-y-4">
                      
                      {/* Brouillons en cours */}
                      <div className="flex items-center justify-between pb-3 border-b border-gray-100 dark:border-zinc-850">
                        <div className="space-y-0.5">
                          <label className="text-[11px] font-bold text-gray-900 dark:text-white block">Statut des Brouillons</label>
                          <span className="text-[9px] text-zinc-455 block">Réseau d'oeuvres archivées ou non-publiées.</span>
                        </div>
                        <span className="text-[10px] bg-purple-500/10 text-purple-600 px-2 py-0.5 rounded-full font-bold">
                          1 brouillon sauvegardé
                        </span>
                      </div>

                      {/* Sauvegarde automatique */}
                      <div className="flex items-center justify-between pb-3 border-b border-gray-100 dark:border-zinc-850">
                        <div className="space-y-0.5">
                          <label className="text-[11px] font-bold text-gray-900 dark:text-white block">Sauvegarde automatique cloud</label>
                          <span className="text-[9px] text-zinc-455 block font-medium">Enregistrer automatiquement vos chapitres toutes les 35 secondes d'activité.</span>
                        </div>
                        <input 
                          type="checkbox" 
                          checked={currentUser.autoSaveEnabled ?? true}
                          onChange={(e) => {
                            onUpdateProfile({ autoSaveEnabled: e.target.checked });
                            setShowStatusToast(e.target.checked ? "Sauvegarde auto activée !" : "Sauvegarde auto désactivée !");
                            setTimeout(() => setShowStatusToast(null), 2500);
                          }}
                          className="w-4 h-4 text-purple-650 rounded cursor-pointer"
                        />
                      </div>

                      {/* Confirmation suppression */}
                      <div className="flex items-center justify-between pb-3 border-b border-gray-100 dark:border-zinc-850">
                        <div className="space-y-0.5">
                          <label className="text-[11px] font-bold text-gray-900 dark:text-white block">Confirmation avant suppression</label>
                          <span className="text-[9px] text-zinc-455 block font-medium">Exiger une double validation authentifiée avant de supprimer vos chapitres ou histoires.</span>
                        </div>
                        <input 
                          type="checkbox" 
                          checked={currentUser.confirmDeleteStory ?? true}
                          onChange={(e) => {
                            onUpdateProfile({ confirmDeleteStory: e.target.checked });
                          }}
                          className="w-4 h-4 text-purple-650 rounded cursor-pointer"
                        />
                      </div>

                      {/* Gestion rapide des Histoires */}
                      <div className="space-y-1.5 pt-1">
                        <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider block font-mono">Vue globale du pupitre</span>
                        <div className="grid grid-cols-2 gap-2 text-center">
                          <div className="p-3 bg-white dark:bg-zinc-950 rounded-xl border border-gray-150 dark:border-zinc-850">
                            <span className="block text-lg font-serif font-black text-purple-600 leading-tight">
                              {stories.filter(s => s.authorId === currentUser.id && s.status === 'Publié').length}
                            </span>
                            <span className="text-[8.5px] text-zinc-400 uppercase font-bold">Publiées</span>
                          </div>
                          <div className="p-3 bg-white dark:bg-zinc-950 rounded-xl border border-gray-150 dark:border-zinc-850">
                            <span className="block text-lg font-serif font-black text-purple-600 leading-tight">
                              {stories.filter(s => s.authorId === currentUser.id && s.status === 'Brouillon').length}
                            </span>
                            <span className="text-[8.5px] text-zinc-400 uppercase font-bold font-serif">Brouillons</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}


                {/* =========================================================================
                    TAB: NOTIFICATIONS
                    ========================================================================= */}
                {activeSettingsTab === 'notifications' && (
                  <div className="space-y-4 animate-scale-up">
                    <p className="text-[10px] text-zinc-400 font-serif leading-relaxed">
                      Paramétrez l'arrivée des alertes instantanées pour votre compte.
                    </p>

                    <div className="bg-zinc-50 dark:bg-zinc-900/20 border border-purple-500/5 p-4 rounded-2xl space-y-4">
                      
                      {/* Auteurs suivis */}
                      <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                          <label className="text-[11.5px] font-bold text-gray-900 dark:text-white block">Nouveaux chapitres d'auteurs suivis</label>
                          <span className="text-[9px] text-zinc-455 block">Recevoir une alerte lors d'un nouveau chapitre.</span>
                        </div>
                        <input 
                          type="checkbox" 
                          checked={notifNewChapters}
                          onChange={(e) => setNotifNewChapters(e.target.checked)}
                          className="w-4 h-4 text-purple-650 rounded cursor-pointer"
                        />
                      </div>

                      {/* Commentaires */}
                      <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                          <label className="text-[11.5px] font-bold text-gray-900 dark:text-white block">Commentaires reçus</label>
                          <span className="text-[9px] text-zinc-455 block">Recevoir une notification pour tout commentaire de votre histoire.</span>
                        </div>
                        <input 
                          type="checkbox" 
                          checked={notifComments}
                          onChange={(e) => setNotifComments(e.target.checked)}
                          className="w-4 h-4 text-purple-650 rounded cursor-pointer"
                        />
                      </div>

                      {/* Réponses */}
                      <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                          <label className="text-[11.5px] font-bold text-gray-905 dark:text-white block">Réponses aux commentaires</label>
                          <span className="text-[9px] text-zinc-455 block text-medium">Alerte quand quelqu'un répond sous votre fil de discussion.</span>
                        </div>
                        <input 
                          type="checkbox" 
                          checked={notifReplies}
                          onChange={(e) => setNotifReplies(e.target.checked)}
                          className="w-4 h-4 text-purple-650 rounded cursor-pointer"
                        />
                      </div>

                      {/* Abonnés */}
                      <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                          <label className="text-[11.5px] font-bold text-gray-905 dark:text-white block">Nouveaux abonnés</label>
                          <span className="text-[9px] text-zinc-455 block text-medium">Recevoir des encouragements quand un nouveau lecteur vous suit.</span>
                        </div>
                        <input 
                          type="checkbox" 
                          checked={notifAbonnes}
                          onChange={(e) => setNotifAbonnes(e.target.checked)}
                          className="w-4 h-4 text-purple-650 rounded cursor-pointer"
                        />
                      </div>

                      {/* Accomplissements */}
                      <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                          <label className="text-[11.5px] font-bold text-gray-905 dark:text-white block">Accomplissements débloqués</label>
                          <span className="text-[9px] text-zinc-455 block text-medium">Fêter de nouveaux insignes ou accomplissements débloqués.</span>
                        </div>
                        <input 
                          type="checkbox" 
                          checked={notifTrophies}
                          onChange={(e) => setNotifTrophies(e.target.checked)}
                          className="w-4 h-4 text-purple-650 rounded cursor-pointer"
                        />
                      </div>

                      {/* Messages privés */}
                      <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                          <label className="text-[11.5px] font-bold text-gray-905 dark:text-white block">Messages privés</label>
                          <span className="text-[9px] text-zinc-455 block text-medium">Alerte enveloppe lorsqu'un nouveau message d'écrivain est reçu.</span>
                        </div>
                        <input 
                          type="checkbox" 
                          checked={notifDMs}
                          onChange={(e) => setNotifDMs(e.target.checked)}
                          className="w-4 h-4 text-purple-650 rounded cursor-pointer"
                        />
                      </div>
                    </div>
                  </div>
                )}


                {/* =========================================================================
                    TAB: SECURITY
                    ========================================================================= */}
                {activeSettingsTab === 'security' && (
                  <div className="space-y-4 animate-scale-up">
                    <p className="text-[10px] text-zinc-400 font-serif leading-relaxed">
                      Garantir l'antidote face aux intrusions de mot de passe frauduleuses.
                    </p>

                    <div className="bg-zinc-50 dark:bg-zinc-900/20 border border-purple-500/5 p-4 rounded-2xl space-y-4">
                      
                      {/* Connexions Actives */}
                      <div className="space-y-2">
                        <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider block font-mono">Sessions de Connexion Actives</label>
                        <div className="space-y-1.5 font-mono text-[9px] leading-tight text-zinc-500">
                          <div className="flex items-center justify-between p-2 bg-white dark:bg-zinc-950 rounded-lg border border-purple-500/10">
                            <span>📱 iPhone 15 Pro • Paris (Session courante)</span>
                            <span className="text-purple-650 font-bold uppercase text-[7.5px]">Actif</span>
                          </div>
                          <div className="flex items-center justify-between p-2 bg-white dark:bg-zinc-950/40 rounded-lg border border-gray-150 dark:border-zinc-850">
                            <span>💻 MacBook Pro • Lyon (Dernière synchro)</span>
                            <span className="text-zinc-400">Il y a 2h</span>
                          </div>
                        </div>
                      </div>

                      {/* Mot De Passe */}
                      <div className="space-y-2.5 pt-2 border-t border-gray-100 dark:border-zinc-850">
                        <label className="text-[11.5px] font-bold text-gray-900 dark:text-white block font-sans">Changer le mot de passe</label>
                        {isChangingPassword ? (
                          <div className="space-y-2">
                            <input
                              type="password"
                              autoComplete="current-password"
                              placeholder="Mot de passe actuel"
                              value={currentPassword}
                              onChange={(e) => setCurrentPassword(e.target.value)}
                              className="w-full bg-white dark:bg-zinc-950 border border-gray-250 dark:border-zinc-850 text-xs px-3 py-1.5 rounded-xl text-zinc-800 dark:text-zinc-200"
                            />
                            <input
                              type="password"
                              autoComplete="new-password"
                              placeholder="Nouveau mot de passe"
                              value={newPassword}
                              onChange={(e) => setNewPassword(e.target.value)}
                              className="w-full bg-white dark:bg-zinc-950 border border-gray-250 dark:border-zinc-850 text-xs px-3 py-1.5 rounded-xl text-zinc-800 dark:text-zinc-200"
                            />
                            <input
                              type="password"
                              autoComplete="new-password"
                              placeholder="Confirmer le nouveau mot de passe"
                              value={confirmNewPassword}
                              onChange={(e) => setConfirmNewPassword(e.target.value)}
                              className="w-full bg-white dark:bg-zinc-950 border border-gray-250 dark:border-zinc-850 text-xs px-3 py-1.5 rounded-xl text-zinc-800 dark:text-zinc-200"
                            />
                            <div className="flex space-x-2 pt-1 font-sans">
                              <button
                                disabled={isSavingPassword}
                                onClick={handleChangePassword}
                                className="py-1 px-3 bg-purple-600 hover:bg-purple-750 text-white rounded-lg text-[9px] font-black uppercase transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                              >
                                {isSavingPassword ? 'Enregistrement…' : 'Enregistrer'}
                              </button>
                              <button
                                onClick={() => {
                                  setCurrentPassword('');
                                  setNewPassword('');
                                  setConfirmNewPassword('');
                                  setIsChangingPassword(false);
                                }}
                                className="py-1 px-3 bg-zinc-150 dark:bg-zinc-850 text-zinc-650 dark:text-zinc-300 rounded-lg text-[9px] font-bold uppercase transition cursor-pointer"
                              >
                                Annuler
                              </button>
                            </div>
                          </div>
                        ) : (
                          <button
                            onClick={() => setIsChangingPassword(true)}
                            className="py-1.5 px-3 bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 text-gray-750 dark:text-zinc-300 rounded-xl text-[10px] font-bold transition cursor-pointer"
                          >
                            Modifier le mot de passe...
                          </button>
                        )}
                      </div>

                      {/* E-mail activé */}
                      <div className="flex items-center justify-between pt-2 border-t border-gray-100 dark:border-zinc-850">
                        <label className="text-[11.5px] font-bold text-gray-900 dark:text-white block font-sans">Statut d'authentification</label>
                        <span className="text-[9.5px] bg-purple-100 dark:bg-purple-900/40 text-purple-655 dark:text-purple-400 font-bold px-2.5 py-0.5 rounded-full font-sans">
                          Compte Vérifié ✓
                        </span>
                      </div>

                      {/* Blocage */}
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-zinc-550 uppercase tracking-wider block font-mono">Comptes signalés ou bloqués</label>
                        <p className="text-[9.5px] text-zinc-450 leading-relaxed font-serif">Historique vierge. Plume applique une conduite stricte et bienveillante.</p>
                      </div>
                    </div>
                  </div>
                )}


                {/* =========================================================================
                    TAB: ABOUT
                    ========================================================================= */}
                {activeSettingsTab === 'about' && (
                  <div className="space-y-4 animate-scale-up">
                    <p className="text-[10px] text-zinc-400 font-serif leading-relaxed">
                      Mentions légales, assistance et fiches d'aide de l'application Plume.
                    </p>

                    <div className="bg-zinc-50 dark:bg-zinc-900/20 border border-purple-500/5 p-4 rounded-2xl space-y-4">
                      
                      {/* Conditions d'utilisation */}
                      <div className="space-y-1 pb-3 border-b border-gray-100 dark:border-zinc-850">
                        <div className="flex items-center justify-between">
                          <label className="text-[11.5px] font-bold text-gray-900 dark:text-white block">Conditions Générales d'Utilisation</label>
                          <button
                            onClick={() => setExpandedLegalSection(expandedLegalSection === 'terms' ? null : 'terms')}
                            className="text-purple-600 dark:text-purple-400 text-[10px] font-black uppercase cursor-pointer"
                          >
                            {expandedLegalSection === 'terms' ? 'Cacher' : 'Consulter'}
                          </button>
                        </div>
                        {expandedLegalSection === 'terms' && (
                          <p className="text-[9px] text-zinc-500 pt-1 leading-relaxed text-justify bg-white dark:bg-zinc-950 p-2.5 rounded-lg border border-purple-550/10">
                            Bienvenue sur Plume. En utilisant notre service de distribution d'histoires littéraires, vous acceptez de ne pas distribuer de plagiat, de respecter le droit d'auteur des créateurs et d'agir avec correction et courtoisie dans les fils de critique. Toute œuvre enfreignant nos règles éditoriales sera modérée sans préavis.
                          </p>
                        )}
                      </div>

                      {/* Politique de confidentialité */}
                      <div className="space-y-1 pb-3 border-b border-gray-100 dark:border-zinc-850">
                        <div className="flex items-center justify-between">
                          <label className="text-[11.5px] font-bold text-gray-900 dark:text-white block">Politique de Confidentialité</label>
                          <button
                            onClick={() => setExpandedLegalSection(expandedLegalSection === 'policy' ? null : 'policy')}
                            className="text-purple-600 dark:text-purple-400 text-[10px] font-black uppercase cursor-pointer"
                          >
                            {expandedLegalSection === 'policy' ? 'Cacher' : 'Consulter'}
                          </button>
                        </div>
                        {expandedLegalSection === 'policy' && (
                          <p className="text-[9px] text-zinc-500 pt-1 leading-relaxed text-justify bg-white dark:bg-zinc-950 p-2.5 rounded-lg border border-purple-550/10">
                            Plume se conforme scrupuleusement au Règlement Général sur la Protection des Données (RGPD). Vos listes d'abonnés et d'abonnements sont privées par défaut. Vos messages échangés en interne sont chiffrés en transit. Vous conservez la propriété exclusive de toutes les trames et chapitres textuels rédigés sur l'appareil.
                          </p>
                        )}
                      </div>

                      {/* Signaler un problème */}
                      <div className="space-y-2 pb-1 border-b border-gray-100 dark:border-zinc-850 flex flex-col items-start gap-1">
                        <label className="text-[11.5px] font-bold text-gray-905 dark:text-white block font-sans">Signaler un problème technique</label>
                        <textarea 
                          placeholder="Décrivez le problème rencontré sur l'interface..."
                          value={helpProblemText}
                          onChange={(e) => setHelpProblemText(e.target.value)}
                          rows={2}
                          className="w-full bg-white dark:bg-zinc-950 border border-gray-250 dark:border-zinc-850 text-xs px-2.5 py-2 rounded-xl text-zinc-800 dark:text-zinc-200 outline-none focus:border-purple-600"
                        />
                        <button
                          onClick={() => {
                            if (helpProblemText.trim()) {
                              alert("Merci pour votre rapport ! Plume va analyser ce dysfonctionnement de l'application.");
                              setHelpProblemText('');
                              setShowStatusToast("Rapport envoyé avec succès !");
                              setTimeout(() => setShowStatusToast(null), 3500);
                            } else {
                              alert("Veuillez saisir une explication avant d'envoyer.");
                            }
                          }}
                          className="py-1 px-3 bg-purple-600 hover:bg-purple-750 text-white rounded-lg text-[9px] font-black uppercase transition cursor-pointer"
                        >
                          Envoyer au support
                        </button>
                      </div>

                      {/* Rubrique d'Aide */}
                      <div className="space-y-1">
                        <div className="flex items-center justify-between">
                          <label className="text-[11.5px] font-bold text-gray-909 dark:text-white block">Foire Aux Questions (Aide)</label>
                          <button
                            onClick={() => setExpandedLegalSection(expandedLegalSection === 'help' ? null : 'help')}
                            className="text-purple-600 dark:text-purple-400 text-[10px] font-black uppercase cursor-pointer"
                          >
                            {expandedLegalSection === 'help' ? 'Cacher' : 'Consulter'}
                          </button>
                        </div>
                        {expandedLegalSection === 'help' && (
                          <div className="space-y-2 pt-1 font-serif text-[9px] text-zinc-550 bg-white dark:bg-zinc-950 p-2.5 rounded-lg border border-purple-550/10">
                            <p><strong>Q : Comment puis-je ajouter un livre ?</strong><br/>R : Accédez à l'onglet "Écriture" (si votre compte est Auteur) et cliquez sur l'icône de plume.</p>
                            <p><strong>Q : Les lecteurs voient-ils qui je suis ?</strong><br/>R : Oui, mais vous pouvez rendre votre profil privé ou masquer vos abonnés dans l'onglet "Confidentialité".</p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="px-5 py-3 border-t border-gray-100 dark:border-zinc-850 flex items-center justify-between bg-gray-50 dark:bg-[#08080C] shrink-0 font-sans">
                {selectedSettingsSection !== null ? (
                  <button
                    onClick={() => setSelectedSettingsSection(null)}
                    className="py-2 px-4 bg-purple-600 hover:bg-purple-750 text-white rounded-xl text-[10px] font-black uppercase tracking-wider transition cursor-pointer"
                  >
                    Retour aux rubriques
                  </button>
                ) : (
                  <div />
                )}
                <button
                  onClick={() => setIsSettingsOpen(false)}
                  className="w-full sm:w-auto py-2 px-5 bg-gray-150 dark:bg-zinc-900 hover:bg-gray-200 dark:hover:bg-zinc-800 text-gray-800 dark:text-zinc-200 border border-gray-200 dark:border-zinc-800 rounded-xl text-[10px] font-black uppercase tracking-wider transition cursor-pointer text-center"
                >
                  Fermer
                </button>
              </div>
            </>
          )}
          </div>
        </div>
      )}

      {/* 13. SETTINGS ACCOUNT TYPE CHANGE CONFIRMATION OVERLAY */}
      {showRoleChangeConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animation-fade-in font-sans">
          <div className="bg-white dark:bg-black border border-gray-200 dark:border-purple-900/25 rounded-2xl max-w-sm w-full p-6 shadow-2xl relative text-center">
            <div className="space-y-4">
              <div className="w-12 h-12 bg-purple-500/10 text-purple-600 rounded-full flex items-center justify-center mx-auto mb-2">
                <Settings className="w-5 h-5" />
              </div>
              <h3 className="font-serif font-black text-base text-gray-950 dark:text-gray-50 leading-tight">
                Confirmer la modification ?
              </h3>
              <p className="text-xs text-gray-500 dark:text-zinc-400 leading-relaxed font-sans">
                Cette modification ne pourra être faite qu'une <span className="font-extrabold text-purple-600 dark:text-purple-400">seule et unique fois</span> par compte. 
                Une fois confirmé, votre type de compte sera définitivement réglé sur <span className="font-bold underline text-gray-900 dark:text-white">
                  {selectedRoleType}
                </span>.
              </p>
              <div className="grid grid-cols-2 gap-3 pt-2 font-sans text-[10px]">
                <button
                  id="settings-confirm-cancel"
                  onClick={() => setShowRoleChangeConfirm(false)}
                  className="py-2.5 bg-gray-50 dark:bg-zinc-900 hover:bg-gray-100 dark:hover:bg-zinc-800 text-gray-700 dark:text-zinc-200 border border-gray-200 dark:border-zinc-800 rounded-xl font-black uppercase tracking-wider transition cursor-pointer"
                >
                  Annuler
                </button>
                <button
                  id="settings-confirm-ok"
                  onClick={() => {
                    onUpdateProfile({ 
                      role: selectedRoleType,
                      hasChangedRole: true 
                    });
                    setShowRoleChangeConfirm(false);
                    setIsSettingsOpen(false);
                  }}
                  className="py-2.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl font-black uppercase tracking-wider transition shadow-lg shadow-purple-500/15 cursor-pointer"
                >
                  Confirmer
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 14. SOCIAL LIST MODAL POPUP (Abonnés, Suivis, Amis, Mentions) */}
      {activeUserListModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/85 backdrop-blur-sm animation-fade-in font-sans select-none"
          onClick={() => setActiveUserListModal(null)}
        >
          <div
            className="bg-white dark:bg-[#0E0E14] border border-gray-200 dark:border-purple-950/40 rounded-2xl max-w-sm w-full h-[380px] shadow-[0_24px_70px_rgba(0,0,0,0.65)] relative flex flex-col overflow-hidden text-left animate-scale-up"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="px-5 py-4 border-b border-gray-150 dark:border-zinc-850 flex items-center justify-between shrink-0">
              <span className="font-serif font-black text-xs uppercase tracking-wider text-purple-605 dark:text-purple-400">
                {activeUserListModal === 'following' && 'Suivis'}
                {activeUserListModal === 'followers' && 'Abonnés'}
                {activeUserListModal === 'friends' && 'Amis'}
                {activeUserListModal === 'mentions' && 'Mentions'}
              </span>
              <button
                onClick={() => setActiveUserListModal(null)}
                className="p-1 text-zinc-400 hover:text-black dark:hover:text-white transition font-black text-xs cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Content list */}
            <div className="flex-1 overflow-y-auto p-5 space-y-3">
              {(() => {
                const isAuthorized = 
                  activeUserListModal === 'following' ? canSeeFollowing :
                  activeUserListModal === 'followers' ? canSeeFollowers :
                  activeUserListModal === 'friends' ? canSeeFriends :
                  canSeeMentions;

                if (!isAuthorized) {
                  return (
                    <div className="flex flex-col items-center justify-center py-12 text-center space-y-3">
                      <div className="p-3 bg-zinc-150 dark:bg-zinc-900 rounded-full text-zinc-400">
                        <Lock className="w-6 h-6 stroke-[2]" />
                      </div>
                      <p className="text-zinc-800 dark:text-zinc-200 text-xs font-bold uppercase tracking-wider">Cette information est privée.</p>
                      <p className="text-zinc-400 text-[9px] leading-relaxed max-w-[210px]">L'utilisateur a restreint l'accès public à cette section de son profil.</p>
                    </div>
                  );
                }

                if (activeUserListModal === 'mentions') {
                  return (
                    <div className="flex flex-col items-center justify-center py-12 text-center space-y-2">
                      <p className="text-zinc-500 dark:text-zinc-400 text-xs font-bold leading-normal">Aucune mention pour le moment.</p>
                      <p className="text-zinc-400 text-[9px]">Toutes les réactions et mentions littéraires s'afficheront ici.</p>
                    </div>
                  );
                }

                const listIds = 
                  activeUserListModal === 'following' ? followingList :
                  activeUserListModal === 'followers' ? followersList :
                  friendsList;

                if (listIds.length === 0) {
                  return (
                    <div className="flex flex-col items-center justify-center py-12 text-center text-zinc-400 dark:text-zinc-500">
                      <span className="text-[11px] font-medium font-serif italic">Aucun utilisateur trouvé</span>
                    </div>
                  );
                }

                return (
                  <div className="space-y-2">
                    {listIds.map(id => {
                      const foundUser = allUsers.find(u => u.id === id) || (id === currentUser.id ? currentUser : null);
                      if (!foundUser) return null;
                      return (
                        <div 
                          key={id}
                          onClick={() => {
                            setActiveUserListModal(null);
                            onViewProfile?.(id);
                          }}
                          className="flex items-center justify-between p-2 rounded-xl bg-zinc-50 hover:bg-purple-500/5 dark:bg-zinc-900/35 dark:hover:bg-purple-950/15 border border-transparent hover:border-purple-500/10 cursor-pointer transition"
                        >
                          <div className="flex items-center space-x-2.5 min-w-0">
                            <img 
                              src={foundUser.avatar || "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100"} 
                              alt={foundUser.username}
                              referrerPolicy="no-referrer"
                              className="w-8 h-8 rounded-full object-cover border border-purple-500/15 shrink-0"
                            />
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5">
                                <span className="text-[11px] font-bold text-gray-900 dark:text-white truncate">
                                  {foundUser.username}
                                </span>
                                {foundUser.isVerified && <VerifiedBadge size="xs" />}
                              </div>
                              <span className="block text-[8.5px] font-mono text-zinc-450 truncate">
                                {foundUser.role}
                              </span>
                            </div>
                          </div>
                          <ChevronRight className="w-3.5 h-3.5 text-zinc-400 stroke-[2.5]" />
                        </div>
                      );
                    })}
                  </div>
                );
              })()}
            </div>

            {/* Footer */}
            <div className="px-5 py-3 border-t border-gray-150 dark:border-zinc-850 flex items-center justify-end bg-gray-50 dark:bg-[#08080C] shrink-0">
              <button
                onClick={() => setActiveUserListModal(null)}
                className="w-full sm:w-auto py-1.5 px-4 bg-gray-150 dark:bg-zinc-900 hover:bg-gray-200 dark:hover:bg-zinc-805 text-gray-800 dark:text-zinc-200 border border-gray-200 dark:border-zinc-800 rounded-xl text-[9px] font-black uppercase tracking-wider transition cursor-pointer text-center"
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
