/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { 
  Send, 
  MessageSquare, 
  Plus, 
  Search, 
  ArrowLeft,
  CheckCheck,
  MoreVertical,
  Phone,
  Smile,
  Paperclip,
  Sparkles,
  ChevronDown,
  ChevronUp,
  Mic,
  Square,
  Users,
  PlusCircle,
  Play,
  Pause,
  X,
  Volume2,
  Trash2,
  Check,
  Feather,
  Headphones,
  BookOpen,
  Sticker,
  Camera,
  Image as ImageIcon
} from 'lucide-react';
import Cropper from 'react-easy-crop';
import type { Area } from 'react-easy-crop';
import { Message, User, ReadingGroup, GroupMessage, Story, Conversation } from '../types';
import { authHeaders } from '../utils/auth';
import { uploadImageToCloudinary, uploadVideoToCloudinary, uploadVoiceToCloudinary } from '../utils/uploadImage';
import { getCroppedImageFile } from '../utils/cropImage';
import { BASE_STICKERS, getCustomStickers, addCustomSticker, removeCustomSticker, encodeSticker, parseSticker, isStickerUrl, isVideoSticker, buildVideoStickerUrl } from '../utils/stickers';
import { VerifiedBadge } from './VerifiedBadge';

/**
 * Accusés de lecture « façon plume » (style WhatsApp) :
 *   • 1 plume blanche  → message envoyé
 *   • 2 plumes blanches → message remis (reçu sur l'appareil)
 *   • 1 plume violette  → message lu
 * Avec une petite animation amusante à l'apparition de chaque état.
 */
// Étiquette de séparateur de date (style Telegram) : Aujourd'hui / Hier / date.
function daySeparatorLabel(dateStr?: string): string {
  const d = new Date(dateStr || 0);
  if (Number.isNaN(d.getTime())) return '';
  const today = new Date();
  const yest = new Date(); yest.setDate(today.getDate() - 1);
  const sameDay = (a: Date, b: Date) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
  if (sameDay(d, today)) return "Aujourd'hui";
  if (sameDay(d, yest)) return 'Hier';
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: d.getFullYear() === today.getFullYear() ? undefined : 'numeric' });
}
function isSameDay(a?: string, b?: string): boolean {
  const x = new Date(a || 0), y = new Date(b || 0);
  return x.getFullYear() === y.getFullYear() && x.getMonth() === y.getMonth() && x.getDate() === y.getDate();
}

function DateSeparator({ date }: { date?: string }) {
  return (
    <div className="flex justify-center my-2">
      <span className="text-[10px] font-bold px-3 py-1 rounded-full bg-black/10 dark:bg-white/10 text-gray-600 dark:text-gray-300 backdrop-blur-sm">
        {daySeparatorLabel(date)}
      </span>
    </div>
  );
}

function MessageTicks({ isDelivered, isRead, muted }: { isDelivered?: boolean; isRead?: boolean; muted?: boolean }) {  // `muted` = affiché sur un fond CLAIR (liste des discussions) : les plumes
  // blanches y seraient invisibles → on utilise une teinte grise/violette.
  const plain = muted ? 'text-zinc-400 dark:text-zinc-500' : 'text-white';
  const faint = muted ? 'text-zinc-400 dark:text-zinc-500' : 'text-white/70';
  if (isRead) {
    return (
      <Feather className="w-3.5 h-3.5 text-fuchsia-500 dark:text-fuchsia-300 fill-fuchsia-400/30 shrink-0 inline animate-feather-pop" />
    );
  }
  if (isDelivered) {
    return (
      <span className="inline-flex items-center -space-x-1.5 animate-feather-pop">
        <Feather className={`w-3.5 h-3.5 ${plain} shrink-0`} />
        <Feather className={`w-3.5 h-3.5 ${plain} shrink-0`} />
      </span>
    );
  }
  return <Feather className={`w-3.5 h-3.5 ${faint} shrink-0 inline animate-feather-in`} />;
}

// Jeu d'émojis rapides (rendus avec la police native de l'appareil). Le clavier
// natif du téléphone reste utilisable en plus, directement dans le champ texte.
const EMOJIS = [
  '😀','😁','😂','🤣','😊','😍','🥰','😘','😎','🤩','😅','😉','🙂','🙃','😇','🤗',
  '🤔','😴','😭','😢','😡','🥵','🥶','😱','🤯','🤫','😏','😬','🙄','😈','💀','👻',
  '👍','👎','👌','🙏','👏','🙌','💪','✌️','🤝','✍️','❤️','🧡','💛','💚','💙','💜',
  '🔥','✨','⭐','🌟','💫','🎉','🎊','📚','📖','✒️','🖋️','🌹','🌸','☕','🌙','🪶',
];

interface MessagesViewProps {
  currentUser: User;
  allUsers: User[];
  conversations: Conversation[];
  setConversations: React.Dispatch<React.SetStateAction<Conversation[]>>;
  onSendMessage: (conversationId: string, content: string, replyToId?: string | null) => void;
  onStartCall: (peer: { id: string; username?: string; avatar?: string }) => void;
  onlineUserIds: Set<string>;
  typingUserIds?: Set<string>;
  recordingUserIds?: Set<string>;
  groupRecording?: Record<string, string>;
  onTyping?: (receiverId: string, isTyping: boolean) => void;
  onVoiceRecording?: (receiverId: string, isRecording: boolean) => void;
  onGroupVoiceRecording?: (groupId: string, memberIds: string[], isRecording: boolean) => void;
  onViewProfile?: (userId: string) => void;
  onSyncStickers?: (stickers: string[]) => void;
  onEditMessage?: (messageId: string, content: string) => void;
  onDeleteMessageForEveryone?: (messageId: string) => void;
  onDeleteConversation: (conversationId: string) => void;
  onStartConversation: (participantIds: string[]) => Promise<Conversation>;
  activeConversationId: string;
  setActiveConversationId: (id: string) => void;
  groups: ReadingGroup[];
  setGroups: React.Dispatch<React.SetStateAction<ReadingGroup[]>>;
  groupMessages: GroupMessage[];
  setGroupMessages: React.Dispatch<React.SetStateAction<GroupMessage[]>>;
  onCreateGroup: (payload: { name: string; description?: string; storyId?: string; memberIds?: string[] }) => Promise<ReadingGroup | null>;
  onSendGroupMessage: (groupId: string, content: string) => void;
  onUpdateGroup?: (groupId: string, data: { name?: string; description?: string; avatar?: string }) => void;
  onAddGroupMembers?: (groupId: string, memberIds: string[]) => void;
  onRemoveGroupMember?: (groupId: string, userId: string) => void;
  groupTyping?: Record<string, string>;
  onGroupTyping?: (groupId: string, memberIds: string[], isTyping: boolean) => void;
  onStartGroupCall?: (groupId: string, memberIds: string[]) => void;
  stories: Story[];
  onSelectStory: (story: Story) => void;
}

// Interactive soundwave visual playback player mockup
function VoicePlayerMockup({ durationStr, isSentByMe, audioUrl }: { durationStr: string; isSentByMe: boolean; audioUrl?: string }) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const progressRef = useRef<any>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Lecture RÉELLE quand une URL est disponible (notes vocales récentes).
  useEffect(() => {
    if (!audioUrl) return;
    const a = audioRef.current;
    if (!a) return;
    const onTime = () => setProgress(a.duration ? (a.currentTime / a.duration) * 100 : 0);
    const onEnd = () => { setIsPlaying(false); setProgress(0); };
    a.addEventListener('timeupdate', onTime);
    a.addEventListener('ended', onEnd);
    return () => { a.removeEventListener('timeupdate', onTime); a.removeEventListener('ended', onEnd); };
  }, [audioUrl]);

  const togglePlay = () => {
    if (audioUrl) {
      const a = audioRef.current;
      if (!a) return;
      if (isPlaying) { a.pause(); setIsPlaying(false); }
      else { a.play().then(() => setIsPlaying(true)).catch(() => {}); }
    } else {
      setIsPlaying((v) => !v); // ancien rendu simulé (messages hérités sans URL)
    }
  };

  // Repli simulé pour les anciennes notes sans URL.
  useEffect(() => {
    if (audioUrl) return;
    if (isPlaying) {
      progressRef.current = setInterval(() => {
        setProgress(prev => {
          if (prev >= 100) { setIsPlaying(false); return 0; }
          return prev + 8;
        });
      }, 350);
    } else if (progressRef.current) {
      clearInterval(progressRef.current);
    }
    return () => { if (progressRef.current) clearInterval(progressRef.current); };
  }, [isPlaying, audioUrl]);

  return (
    <div className="flex items-center space-x-3 py-1 px-1">
      {audioUrl && <audio ref={audioRef} src={audioUrl} preload="none" />}
      <button
        type="button"
        onClick={togglePlay}
        className={`w-8 h-8 rounded-full flex items-center justify-center transition-transform active:scale-95 shrink-0 ${
          isSentByMe 
            ? 'bg-purple-900/60 text-white hover:bg-purple-900/80 border border-purple-500/10' 
            : 'bg-purple-100 text-purple-600 dark:bg-purple-950/40 dark:text-purple-300 hover:bg-purple-200/50'
        }`}
        title={isPlaying ? "Mettre en pause" : "Écouter la note"}
      >
        {isPlaying ? (
          <span className="flex space-x-0.75 items-center justify-center">
            <span className="w-1 h-3.5 bg-current animate-pulse"></span>
            <span className="w-1 h-3.5 bg-current animate-pulse delay-75"></span>
          </span>
         ) : (
          <Play className="w-3 h-3 fill-current ml-0.5" />
        )}
      </button>

      {/* Waveform representation */}
      <div className="flex-1 min-w-0">
        <div className="flex items-end space-x-0.5 h-6 w-28 sm:w-36 md:w-44 mb-0.5">
          {[12, 18, 8, 22, 14, 25, 10, 16, 28, 12, 20, 8, 15, 24, 18, 10, 22, 14, 26, 8, 16, 12].map((height, idx) => {
            const hasPassed = (idx / 22) * 100 <= progress;
            return (
              <span 
                key={idx} 
                className="w-0.75 rounded-t-full transition-colors duration-200"
                style={{ 
                  height: `${height}px`,
                  backgroundColor: hasPassed 
                    ? (isSentByMe ? '#ffffff' : '#7C3AED') 
                    : (isSentByMe ? 'rgba(255,255,255,0.35)' : 'rgba(156,163,175,0.3)')
                }}
              ></span>
            );
          })}
        </div>
        <div className={`text-[9px] font-mono select-none ${isSentByMe ? 'text-purple-200' : 'text-gray-400'}`}>
          {isPlaying ? `Lecture en cours...` : `Note vocale • ${durationStr}`}
        </div>
      </div>
    </div>
  );
}

export default function MessagesView({
  currentUser,
  allUsers,
  conversations,
  setConversations,
  onSendMessage,
  onStartCall,
  onlineUserIds,
  typingUserIds,
  recordingUserIds,
  groupRecording,
  onTyping,
  onVoiceRecording,
  onGroupVoiceRecording,
  onViewProfile,
  onSyncStickers,
  onEditMessage,
  onDeleteMessageForEveryone,
  onDeleteConversation,
  onStartConversation,
  activeConversationId,
  setActiveConversationId,
  groups,
  setGroups,
  groupMessages,
  setGroupMessages,
  onCreateGroup,
  onSendGroupMessage,
  onUpdateGroup,
  onAddGroupMembers,
  onRemoveGroupMember,
  groupTyping,
  onGroupTyping,
  onStartGroupCall,
  stories,
  onSelectStory
}: MessagesViewProps) {
  
  // Left panel navigation tabs
  const [activeTab, setActiveTab] = useState<'chats' | 'groups'>('chats');

  const [messageText, setMessageText] = useState('');
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showStickers, setShowStickers] = useState(false);
  const [customStickers, setCustomStickers] = useState<string[]>(() => getCustomStickers());

  // Arrière-plan des discussions : 5 fonds prédéfinis (thème PLUME) + image perso.
  const CHAT_BG_PRESETS: { id: string; label: string; css: string }[] = [
    { id: 'plume', label: 'Violet', css: 'linear-gradient(160deg,#f5f3ff,#e9d5ff)' },
    { id: 'parchemin', label: 'Parchemin', css: 'linear-gradient(160deg,#faf6ee,#efe2c9)' },
    { id: 'nuit', label: 'Nuit étoilée', css: 'radial-gradient(circle at 30% 20%,#3b2f63,#15131f 70%)' },
    { id: 'emeraude', label: 'Émeraude', css: 'linear-gradient(160deg,#ecfdf5,#bbf7d0)' },
    { id: 'aube', label: 'Aube', css: 'linear-gradient(160deg,#fff1f2,#fbcfe8)' },
  ];
  // Fond de discussion PERSONNALISE PAR CONVERSATION : chaque fil (prive ou
  // groupe) garde son propre theme, stocke sous une cle dediee.
  const [chatBg, setChatBg] = useState<string>('');
  const [showBgPicker, setShowBgPicker] = useState(false);
  const [uploadingBg, setUploadingBg] = useState(false);
  const bgFileRef = useRef<HTMLInputElement>(null);
  const currentThreadBgKey = (): string => {
    const tk = activeGroupId ? `g:${activeGroupId}` : (activeConversationId ? `c:${activeConversationId}` : '');
    return tk ? `plume_chat_bg_${currentUser.id}_${tk}` : '';
  };
  const applyChatBg = (val: string) => {
    setChatBg(val);
    const key = currentThreadBgKey();
    if (key) {
      try { val ? localStorage.setItem(key, val) : localStorage.removeItem(key); } catch { /* ignore */ }
    }
    setShowBgPicker(false);
  };
  const handleBgUpload = async (file: File | null) => {
    if (!file || !file.type.startsWith('image/')) return;
    setUploadingBg(true);
    try { applyChatBg(await uploadImageToCloudinary(file)); }
    catch (e: any) { alert(e?.message || "Échec de l'envoi du fond."); }
    finally { setUploadingBg(false); if (bgFileRef.current) bgFileRef.current.value = ''; }
  };
  const chatBgStyle: React.CSSProperties = !chatBg ? {}
    : chatBg.startsWith('http') ? { backgroundImage: `url(${chatBg})`, backgroundSize: 'cover', backgroundPosition: 'center' }
    : (() => { const p = CHAT_BG_PRESETS.find((x) => x.id === chatBg); return p ? { background: p.css } : {}; })();
  const [uploadingSticker, setUploadingSticker] = useState(false);
  const stickerFileRef = useRef<HTMLInputElement>(null);
  const [mobileShowThread, setMobileShowThread] = useState(false);
  // Rognage du sticker à créer (modale react-easy-crop, format carré).
  const [stickerCropSrc, setStickerCropSrc] = useState<string | null>(null);
  const [stickerCrop, setStickerCrop] = useState({ x: 0, y: 0 });
  const [stickerZoom, setStickerZoom] = useState(1);
  const [stickerCroppedPixels, setStickerCroppedPixels] = useState<Area | null>(null);
  // Sticker VIDÉO : rognage (carré, sur une image-poster) + découpe (début/fin).
  const videoStickerFileRef = useRef<HTMLInputElement>(null);
  const [videoStickerFile, setVideoStickerFile] = useState<File | null>(null);
  const [videoStickerSrc, setVideoStickerSrc] = useState<string | null>(null);
  const [videoStickerPoster, setVideoStickerPoster] = useState<string | null>(null);
  const [videoStickerDims, setVideoStickerDims] = useState<{ w: number; h: number } | null>(null);
  const [videoStickerCrop, setVideoStickerCrop] = useState({ x: 0, y: 0 });
  const [videoStickerZoom, setVideoStickerZoom] = useState(1);
  const [videoStickerCroppedPixels, setVideoStickerCroppedPixels] = useState<Area | null>(null);
  const [videoStickerDuration, setVideoStickerDuration] = useState(0);
  const [videoTrimStart, setVideoTrimStart] = useState(0);
  const [videoTrimEnd, setVideoTrimEnd] = useState(0);
  const [processingVideoSticker, setProcessingVideoSticker] = useState(false);
  const trimPreviewRef = useRef<HTMLVideoElement>(null);
  // Réglages de groupe (façon WhatsApp).
  const [showGroupSettings, setShowGroupSettings] = useState(false);
  const [groupAddOpen, setGroupAddOpen] = useState(false);
  const [uploadingGroupPhoto, setUploadingGroupPhoto] = useState(false);
  const groupPhotoRef = useRef<HTMLInputElement>(null);
  const handleGroupPhoto = async (file: File | null, groupId: string) => {
    if (!file || !file.type.startsWith('image/')) return;
    setUploadingGroupPhoto(true);
    try {
      const url = await uploadImageToCloudinary(file);
      onUpdateGroup?.(groupId, { avatar: url });
    } catch (e: any) {
      alert(e?.message || 'Échec du changement de photo.');
    } finally {
      setUploadingGroupPhoto(false);
      if (groupPhotoRef.current) groupPhotoRef.current.value = '';
    }
  };

  // Envoi d'un sticker (emoji de base ou URL d'image personnalisée).
  const sendSticker = (value: string) => {
    const content = encodeSticker(value);
    if (activeGroupId) {
      onSendGroupMessage(activeGroupId, content);
    } else if (activeConversationId) {
      onSendMessage(activeConversationId, content);
    }
    setShowStickers(false);
  };

  // Étape 1 : on charge l'image choisie et on ouvre la modale de rognage.
  const handleCreateSticker = (file: File | null) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) { alert('Choisis une image.'); return; }
    const reader = new FileReader();
    reader.onload = () => {
      setStickerCropSrc(reader.result as string);
      setStickerCrop({ x: 0, y: 0 });
      setStickerZoom(1);
      setStickerCroppedPixels(null);
    };
    reader.readAsDataURL(file);
    if (stickerFileRef.current) stickerFileRef.current.value = '';
  };

  // Étape 2 : on rogne (carré), on téléverse, et on enregistre le sticker.
  const confirmStickerCrop = async () => {
    if (!stickerCropSrc || !stickerCroppedPixels) return;
    setUploadingSticker(true);
    try {
      const cropped = await getCroppedImageFile(stickerCropSrc, stickerCroppedPixels, 'sticker.jpg');
      const url = await uploadImageToCloudinary(cropped);
      addCustomSticker(url);
      setCustomStickers(getCustomStickers()); onSyncStickers?.(getCustomStickers());
      setStickerCropSrc(null);
    } catch (e: any) {
      alert(e?.message || "Échec de la création du sticker.");
    } finally {
      setUploadingSticker(false);
    }
  };

  // --- Sticker VIDÉO : étape 1 — charger la vidéo, lire sa durée et capturer
  // une image-poster (1re frame) pour le rognage carré. ---
  const MAX_STICKER_CLIP = 6; // durée max d'un sticker vidéo (s)
  const handleCreateVideoSticker = (file: File | null) => {
    if (!file) return;
    if (!file.type.startsWith('video/')) { alert('Choisis une vidéo.'); return; }
    if (file.size > 30 * 1024 * 1024) { alert('La vidéo ne doit pas dépasser 30 Mo.'); return; }
    const url = URL.createObjectURL(file);
    const v = document.createElement('video');
    v.preload = 'metadata';
    v.muted = true;
    v.src = url;
    v.onloadedmetadata = () => {
      const dur = isFinite(v.duration) ? v.duration : 0;
      setVideoStickerDims({ w: v.videoWidth, h: v.videoHeight });
      setVideoStickerDuration(dur);
      setVideoTrimStart(0);
      setVideoTrimEnd(Math.min(MAX_STICKER_CLIP, dur || MAX_STICKER_CLIP));
      // Capture la 1re frame comme poster pour le rognage.
      const grab = () => {
        try {
          const canvas = document.createElement('canvas');
          canvas.width = v.videoWidth; canvas.height = v.videoHeight;
          const ctx = canvas.getContext('2d');
          if (ctx) { ctx.drawImage(v, 0, 0); setVideoStickerPoster(canvas.toDataURL('image/jpeg', 0.85)); }
        } catch { /* CORS-safe : la vidéo est locale (objectURL) */ }
      };
      v.onseeked = grab;
      try { v.currentTime = Math.min(0.1, (dur || 1) / 2); } catch { grab(); }
    };
    setVideoStickerFile(file);
    setVideoStickerSrc(url);
    setVideoStickerCrop({ x: 0, y: 0 });
    setVideoStickerZoom(1);
    setVideoStickerCroppedPixels(null);
    setVideoStickerPoster(null);
    if (videoStickerFileRef.current) videoStickerFileRef.current.value = '';
  };

  const cancelVideoSticker = () => {
    if (videoStickerSrc) URL.revokeObjectURL(videoStickerSrc);
    setVideoStickerFile(null);
    setVideoStickerSrc(null);
    setVideoStickerPoster(null);
    setVideoStickerDims(null);
    setVideoStickerCroppedPixels(null);
  };

  // --- Sticker VIDÉO : étape 2 — téléverser puis dériver l'URL rognée+découpée. ---
  const confirmVideoSticker = async () => {
    if (!videoStickerFile || !videoStickerCroppedPixels || !videoStickerDims) return;
    setProcessingVideoSticker(true);
    try {
      const secureUrl = await uploadVideoToCloudinary(videoStickerFile);
      const url = buildVideoStickerUrl(secureUrl, {
        x: videoStickerCroppedPixels.x,
        y: videoStickerCroppedPixels.y,
        w: videoStickerCroppedPixels.width,
        h: videoStickerCroppedPixels.height,
        start: videoTrimStart,
        end: videoTrimEnd,
      });
      addCustomSticker(url);
      setCustomStickers(getCustomStickers()); onSyncStickers?.(getCustomStickers());
      cancelVideoSticker();
    } catch (e: any) {
      alert(e?.message || "Échec de la création du sticker vidéo.");
    } finally {
      setProcessingVideoSticker(false);
    }
  };

  // Aperçu de la découpe : boucle la vidéo entre début et fin choisis.
  useEffect(() => {
    const v = trimPreviewRef.current;
    if (!v || !videoStickerSrc) return;
    const onTime = () => {
      if (v.currentTime >= videoTrimEnd || v.currentTime < videoTrimStart) {
        v.currentTime = videoTrimStart;
        v.play().catch(() => {});
      }
    };
    v.addEventListener('timeupdate', onTime);
    try { v.currentTime = videoTrimStart; v.play().catch(() => {}); } catch { /* ignore */ }
    return () => v.removeEventListener('timeupdate', onTime);
  }, [videoStickerSrc, videoTrimStart, videoTrimEnd]);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messageInputRef = useRef<HTMLTextAreaElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const lastMsgCountRef = useRef(0);
  const lastThreadKeyRef = useRef<string | null>(null);

  // Répondre / modifier / supprimer (messages privés, façon WhatsApp).
  const [replyTo, setReplyTo] = useState<Message | null>(null);
  const [editingMsg, setEditingMsg] = useState<Message | null>(null);
  const [actionMsg, setActionMsg] = useState<Message | null>(null);
  const [deletedForMe, setDeletedForMe] = useState<Set<string>>(() => {
    try { return new Set(JSON.parse(localStorage.getItem('plume_deleted_msgs') || '[]')); } catch { return new Set(); }
  });
  const deleteForMe = (id: string) => {
    setDeletedForMe((prev) => {
      const next = new Set(prev); next.add(id);
      try { localStorage.setItem('plume_deleted_msgs', JSON.stringify([...next].slice(-500))); } catch { /* ignore */ }
      return next;
    });
    setActionMsg(null);
  };
  const longPressRef = useRef<any>(null);
  const startLongPress = (msg: Message) => { longPressRef.current = setTimeout(() => setActionMsg(msg), 480); };
  const cancelLongPress = () => { if (longPressRef.current) { clearTimeout(longPressRef.current); longPressRef.current = null; } };
  // Un message peut être modifié s'il est à moi, en texte, et envoyé il y a < 5 min.
  const canEdit = (m: Message) => m.senderId === currentUser.id && !m.deletedForEveryone && !parseSticker(m.content) && !m.content.startsWith('[🎙️ Note Vocale') && (Date.now() - new Date(m.date || m.createdAt || 0).getTime() < 5 * 60 * 1000);
  const startReply = (m: Message) => { setReplyTo(m); setEditingMsg(null); setActionMsg(null); messageInputRef.current?.focus(); };
  const startEdit = (m: Message) => { setEditingMsg(m); setReplyTo(null); setMessageText(m.content); setActionMsg(null); setTimeout(() => messageInputRef.current?.focus(), 0); };
  // Ajuste la hauteur du champ message (retour à la ligne automatique, jusqu'à
  // ~5 lignes puis défilement) — comportement type WhatsApp.
  const autoSizeMessageInput = () => {
    const el = messageInputRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = Math.max(46, Math.min(el.scrollHeight, 130)) + 'px';
  };
  useEffect(() => { autoSizeMessageInput(); }, [messageText]);

  const [activeGroupId, setActiveGroupId] = useState<string | null>(null);
  // Recherche dans la liste des discussions / groupes.
  const [convSearch, setConvSearch] = useState('');
  // Hauteur disponible pour le panneau messagerie : suit le viewport visible
  // (clavier compris) afin que la zone de saisie ne disparaisse jamais.
  const messagingCardRef = useRef<HTMLDivElement>(null);
  const [messagingCardMaxH, setMessagingCardMaxH] = useState<number | null>(null);
  useEffect(() => {
    const vv = window.visualViewport;
    const compute = () => {
      const el = messagingCardRef.current;
      if (!el) return;
      const vh = vv ? vv.height : window.innerHeight;
      const top = el.getBoundingClientRect().top;
      // Hauteur visible sous le haut de la carte, moins une petite marge.
      const avail = Math.max(320, Math.round(vh - top - 6));
      setMessagingCardMaxH(window.innerWidth >= 768 ? null : avail);
    };
    compute();
    const t1 = setTimeout(compute, 150);
    const t2 = setTimeout(compute, 400);
    vv?.addEventListener('resize', compute);
    vv?.addEventListener('scroll', compute);
    window.addEventListener('resize', compute);
    window.addEventListener('orientationchange', compute);
    return () => {
      clearTimeout(t1); clearTimeout(t2);
      vv?.removeEventListener('resize', compute);
      vv?.removeEventListener('scroll', compute);
      window.removeEventListener('resize', compute);
      window.removeEventListener('orientationchange', compute);
    };
  }, []);

  // Modals state
  const [isNewChatOpen, setIsNewChatOpen] = useState(false);
  const [isNewGroupOpen, setIsNewGroupOpen] = useState(false);

  // New Group Form States
  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupDesc, setNewGroupDesc] = useState('');
  const [newGroupStoryId, setNewGroupStoryId] = useState('');
  const [groupSelectedMembers, setGroupSelectedMembers] = useState<string[]>([]);

  // Search filter for new connection modal
  const [authorSearch, setAuthorSearch] = useState('');

  // Note vocale : enregistrement RÉEL (MediaRecorder) → upload → envoi de l'URL.
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [uploadingVoice, setUploadingVoice] = useState(false);
  const recordingTimerRef = useRef<any>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const audioStreamRef = useRef<MediaStream | null>(null);

  // High fidelity simulated audio call state
  const [callState, setCallState] = useState<'idle' | 'ringing' | 'connected'>('idle');
  const [callDuration, setCallDuration] = useState(0);
  const callTimerRef = useRef<any>(null);

  // Timers de la démo "auto-débat" : suivis pour pouvoir les annuler au
  // démontage (sinon setState sur composant démonté).
  const autoDebateTimersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  useEffect(() => {
    return () => {
      autoDebateTimersRef.current.forEach((id) => clearTimeout(id));
      autoDebateTimersRef.current = [];
    };
  }, []);

  const activeConv = conversations.find(c => c.id === activeConversationId);
  // Robuste : on ne tombe jamais sur `undefined` même si `participants` est vide.
  const interlocutor =
    activeConv?.participants?.find(p => p.id !== currentUser.id)
    ?? activeConv?.participants?.[0]
    ?? allUsers.find(u => u.id !== currentUser.id)
    ?? allUsers[1]
    ?? allUsers[0]
    ?? currentUser;
  const activeGroup = groups.find(g => g.id === activeGroupId);

  // Indique « enregistre un audio… » à l'interlocuteur / au groupe.
  const emitRecording = (isRec: boolean) => {
    if (activeGroupId) onGroupVoiceRecording?.(activeGroupId, activeGroup?.members || [], isRec);
    else if (interlocutor) onVoiceRecording?.(interlocutor.id, isRec);
  };

  // « En train d'écrire » : on prévient l'interlocuteur quand on tape, et on
  // arrête après une courte pause. (Conversations privées uniquement.)
  const typingStopRef = useRef<any>(null);
  const handleTypingChange = (value: string) => {
    setMessageText(value);
    if (activeGroupId) {
      const members = activeGroup?.members || [];
      onGroupTyping?.(activeGroupId, members, true);
      clearTimeout(typingStopRef.current);
      typingStopRef.current = setTimeout(() => onGroupTyping?.(activeGroupId, members, false), 1500);
      return;
    }
    if (!activeConversationId || !interlocutor || interlocutor.id === currentUser.id) return;
    onTyping?.(interlocutor.id, true);
    clearTimeout(typingStopRef.current);
    typingStopRef.current = setTimeout(() => onTyping?.(interlocutor.id, false), 1500);
  };
  const partnerTyping = !activeGroupId && !!interlocutor && (typingUserIds?.has(interlocutor.id) ?? false);
  const partnerRecording = !activeGroupId && !!interlocutor && (recordingUserIds?.has(interlocutor.id) ?? false);
  const groupRecordingName = activeGroupId ? groupRecording?.[activeGroupId] : undefined;

  // If conversation changes, open thread on mobile
  useEffect(() => {
    if (activeConversationId) {
      setMobileShowThread(true);
    }
  }, [activeConversationId]);

  // Real-time messages read endpoint trigger on conversation activation
  useEffect(() => {
    if (activeConversationId) {
      fetch('/api/messages/read', {
        method: 'PUT',
        // Auth via token mémoire (en-tête) et/ou cookie httpOnly.
        headers: authHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ conversationId: activeConversationId })
      }).catch(e => console.error(e));

      setConversations(prev => prev.map(c => {
        if (c.id === activeConversationId) {
          return {
            ...c,
            unreadCount: 0,
            messages: c.messages.map(m => m.senderId !== currentUser.id ? { ...m, isRead: true } : m)
          };
        }
        return c;
      }));
    }
  }, [activeConversationId, currentUser.id, setConversations]);

  // Voice Note recording dynamic timer
  useEffect(() => {
    if (isRecording) {
      setRecordingSeconds(0);
      recordingTimerRef.current = setInterval(() => {
        setRecordingSeconds(prev => prev + 1);
      }, 1000);
    } else {
      if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
    }
    return () => {
      if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
    };
  }, [isRecording]);

  // Simulated audio call timer
  useEffect(() => {
    if (callState === 'ringing') {
      // Connect call automatically after 2.5 seconds
      const connectTimeout = setTimeout(() => {
        setCallState('connected');
      }, 2500);
      return () => clearTimeout(connectTimeout);
    } else if (callState === 'connected') {
      callTimerRef.current = setInterval(() => {
        setCallDuration(prev => prev + 1);
      }, 1000);
    } else {
      if (callTimerRef.current) clearInterval(callTimerRef.current);
    }
    return () => {
      if (callTimerRef.current) clearInterval(callTimerRef.current);
    };
  }, [callState]);

  const handleStartCall = () => {
    // Appel audio réel (WebRTC) géré globalement par App via onStartCall.
    if (!interlocutor) return;
    if (interlocutor.id === currentUser.id) { alert('Vous ne pouvez pas vous appeler vous-même.'); return; }
    onStartCall({ id: interlocutor.id, username: interlocutor.username, avatar: interlocutor.avatar });
  };

  const handleEndCall = () => {
    setCallState('idle');
    setCallDuration(0);
  };

  const formatCallTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  // Group messages for active thread (direct chat)
  const threadMessages = activeConv ? activeConv.messages : [];

  // Group messages filter (group chat)
  const activeGroupMessages = groupMessages.filter(
    m => m.groupId === activeGroupId
  ).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  // Auto-scroll intelligent : on descend tout en bas quand on ouvre une
  // discussion ou qu'un NOUVEAU message arrive ET que l'utilisateur est deja
  // proche du bas. Sinon on le laisse lire l'historique sans le faire sauter.
  const activeThreadCount = activeGroupId ? activeGroupMessages.length : threadMessages.length;
  const threadKey = activeGroupId ? `g:${activeGroupId}` : `c:${activeConversationId ?? ''}`;

  // Charger le fond propre a la conversation active (ou groupe) a chaque
  // changement de fil : un theme par discussion.
  useEffect(() => {
    const key = currentThreadBgKey();
    try { setChatBg(key ? (localStorage.getItem(key) || '') : ''); } catch { setChatBg(''); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [threadKey]);
  useEffect(() => {
    const container = scrollContainerRef.current;
    const end = messagesEndRef.current;
    const switchedThread = lastThreadKeyRef.current !== threadKey;
    const grew = activeThreadCount > lastMsgCountRef.current;
    lastThreadKeyRef.current = threadKey;
    lastMsgCountRef.current = activeThreadCount;

    if (!container) return;

    if (switchedThread) {
      // Nouvelle discussion : on epingle le bas pendant une courte fenetre
      // (le temps que les images / stickers / notes vocales se mettent en page
      // et decalent la hauteur). Le moindre geste de l'utilisateur (molette ou
      // doigt) annule immediatement l'epinglage : plus de "scroll tout seul"
      // ni de blocage.
      let cancelled = false;
      const deadline = performance.now() + 700;
      let raf = 0;
      const cancel = () => { cancelled = true; };
      const loop = () => {
        if (cancelled) return;
        container.scrollTop = container.scrollHeight;
        if (performance.now() < deadline) raf = requestAnimationFrame(loop);
      };
      container.addEventListener('wheel', cancel, { passive: true });
      container.addEventListener('touchstart', cancel, { passive: true });
      container.scrollTop = container.scrollHeight;
      raf = requestAnimationFrame(loop);
      return () => {
        cancelled = true;
        cancelAnimationFrame(raf);
        container.removeEventListener('wheel', cancel);
        container.removeEventListener('touchstart', cancel);
      };
    }

    if (grew) {
      const distanceFromBottom = container.scrollHeight - container.scrollTop - container.clientHeight;
      // On ne ramene en bas que si l'utilisateur y etait deja (< 160px).
      if (distanceFromBottom < 160) {
        end?.scrollIntoView({ behavior: 'smooth' });
      }
    }
  }, [threadKey, activeThreadCount]);

  // Submit send message
  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!messageText.trim()) return;

    // Modification d'un message existant (privé) plutôt qu'un nouvel envoi.
    if (editingMsg && !activeGroupId) {
      onEditMessage?.(editingMsg.id, messageText.trim());
      setEditingMsg(null);
      setMessageText('');
      return;
    }

    if (activeGroupId) {
      // Message de groupe persisté côté serveur (diffusé en temps réel).
      onSendGroupMessage(activeGroupId, messageText.trim());
    } else if (activeConversationId) {
      // Envoi privé (avec éventuelle réponse à un message).
      onSendMessage(activeConversationId, messageText.trim(), replyTo?.id || null);
    }
    setReplyTo(null);
    setMessageText('');
    // Fin de saisie : on arrête l'indicateur « écrit… » chez l'interlocuteur.
    if (!activeGroupId && interlocutor) {
      clearTimeout(typingStopRef.current);
      onTyping?.(interlocutor.id, false);
    }
  };

  // Les notes vocales ne sont pas encore implémentées (pas d'enregistrement/
  // upload audio réel) : on n'envoie plus de fausse note (un simple libellé texte).
  const handleStartVoiceNote = () => {
    alert('Les notes vocales arriveront prochainement sur PLUME.');
  };

  // Démarre l'enregistrement micro réel.
  const startVoiceRecording = async () => {
    if (isRecording || uploadingVoice) return;
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      alert("L'enregistrement vocal n'est pas disponible sur cet appareil.");
      return;
    }
    try {
      // Réducteur de bruit parasite intégré (suppression de bruit + écho + gain auto).
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { noiseSuppression: true, echoCancellation: true, autoGainControl: true } as MediaTrackConstraints,
      });
      audioStreamRef.current = stream;
      audioChunksRef.current = [];
      const mime = MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm'
        : (MediaRecorder.isTypeSupported('audio/mp4') ? 'audio/mp4' : '');
      const rec = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream);
      rec.ondataavailable = (e) => { if (e.data && e.data.size > 0) audioChunksRef.current.push(e.data); };
      mediaRecorderRef.current = rec;
      rec.start();
      setIsRecording(true);
      emitRecording(true);
    } catch {
      alert("Micro inaccessible. Autorise l'accès au microphone pour envoyer une note vocale.");
    }
  };

  const stopStream = () => {
    audioStreamRef.current?.getTracks().forEach((t) => t.stop());
    audioStreamRef.current = null;
  };

  // Annule l'enregistrement (pas d'envoi).
  const handleDiscardVoiceNote = () => {
    try { mediaRecorderRef.current?.stop(); } catch { /* ignore */ }
    mediaRecorderRef.current = null;
    audioChunksRef.current = [];
    stopStream();
    setIsRecording(false);
    setRecordingSeconds(0);
    emitRecording(false);
  };

  // Finalise : stoppe, téléverse, et envoie l'URL (privé OU groupe).
  const handleSendVoiceNote = () => {
    emitRecording(false);
    const rec = mediaRecorderRef.current;
    if (!rec) { setIsRecording(false); return; }
    const finalSecs = recordingSeconds || 1;
    const mins = Math.floor(finalSecs / 60);
    const secs = finalSecs % 60;
    const durationStr = `${mins}:${secs < 10 ? '0' : ''}${secs}`;

    rec.onstop = async () => {
      stopStream();
      const blob = new Blob(audioChunksRef.current, { type: rec.mimeType || 'audio/webm' });
      audioChunksRef.current = [];
      mediaRecorderRef.current = null;
      if (!blob.size) { setIsRecording(false); return; }
      setUploadingVoice(true);
      try {
        const url = await uploadVoiceToCloudinary(blob);
        // Format rétro-compatible : « [🎙️ Note Vocale - mm:ss|URL] ».
        const voiceTag = `[🎙️ Note Vocale - ${durationStr}|${url}]`;
        if (activeGroupId) onSendGroupMessage(activeGroupId, voiceTag);
        else if (activeConversationId) onSendMessage(activeConversationId, voiceTag);
      } catch (e: any) {
        alert(e?.message || "Échec de l'envoi de la note vocale.");
      } finally {
        setUploadingVoice(false);
      }
    };
    try { rec.stop(); } catch { /* ignore */ }
    setIsRecording(false);
    setRecordingSeconds(0);
  };

  // Custom formatted dynamic timing helper for recorder
  const formatRecordTime = (secondsCount: number) => {
    const mins = Math.floor(secondsCount / 60);
    const secs = secondsCount % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  // Create new group handler (persisté côté serveur)
  const handleCreateGroupSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newGroupName.trim()) return;

    const group = await onCreateGroup({
      name: newGroupName.trim(),
      description: newGroupDesc.trim() || 'Cercle de partage et de critiques narratives',
      storyId: newGroupStoryId || undefined,
      memberIds: groupSelectedMembers,
    });

    if (group) {
      setActiveGroupId(group.id);
      setActiveTab('groups');
      setIsNewGroupOpen(false);
      setMobileShowThread(true);
    }

    // reset fields
    setNewGroupName('');
    setNewGroupDesc('');
    setNewGroupStoryId('');
    setGroupSelectedMembers([]);
  };


  // Start direct message selection
  const selectDirectAuthor = async (authorId: string) => {
    try {
      const conv = await onStartConversation([authorId]);
      setActiveGroupId(null);
      setActiveConversationId(conv.id);
      setIsNewChatOpen(false);
      setActiveTab('chats');
      setMobileShowThread(true);
    } catch (e: any) {
      console.error(e);
      alert(`Impossible de démarrer la conversation : ${e.message || 'erreur serveur'}`);
    }
  };

  // Toggle member selection in Group Creator
  const toggleSelectGroupMember = (uid: string) => {
    setGroupSelectedMembers(prev => 
      prev.includes(uid) 
        ? prev.filter(x => x !== uid) 
        : [...prev, uid]
    );
  };

  return (
    <div className="max-w-6xl mx-auto px-0 sm:px-6 lg:px-8 pt-0 pb-0 md:py-6 lg:py-8 animate-fade-in text-left relative">

      {/* WhatsApp Layout Uniform Container (no delimiting box) */}
      <div
        ref={messagingCardRef}
        style={messagingCardMaxH ? { height: messagingCardMaxH, minHeight: 0 } : undefined}
        className="bg-gray-50 dark:bg-black md:border md:border-gray-200/50 md:dark:border-purple-900/15 md:rounded-2xl overflow-hidden grid grid-cols-1 md:grid-cols-12 h-[86vh] min-h-[360px] md:h-[700px] md:min-h-[580px] md:shadow-2xl relative z-10">
        
        {/* LEFT COMPARTMENT: CHAT LISTINGS */}
        <div className={`md:col-span-4 bg-white dark:bg-[#0E0E14] flex flex-col border-r border-gray-200/90 dark:border-purple-900/15 ${
          mobileShowThread ? 'hidden md:flex' : 'flex'
        }`}>
          {/* Header with simply 'Messagerie' + sleek Action buttons */}
          <div className="px-5 py-2.5 bg-gray-100/75 dark:bg-black/60 border-b border-gray-200/40 dark:border-purple-900/15 flex justify-between items-center">
            <h2 className="text-base font-serif font-black tracking-tight text-gray-900 dark:text-white uppercase">
              Messagerie
            </h2>
            
            {/* Quick interactive shortcuts centered on user intents */}
            <div className="flex items-center space-x-1">
              <button
                type="button"
                onClick={() => setIsNewChatOpen(true)}
                className="p-1.5 hover:bg-purple-100/60 dark:hover:bg-purple-950/20 rounded-full text-purple-600 dark:text-purple-400 font-bold transition flex items-center justify-center"
                title="Écrire un nouveau message"
              >
                <PlusCircle className="w-4.5 h-4.5" />
              </button>
              <button
                type="button"
                onClick={() => setIsNewGroupOpen(true)}
                className="p-1.5 hover:bg-purple-100/60 dark:hover:bg-purple-950/20 rounded-full text-purple-600 dark:text-purple-400 font-bold transition flex items-center justify-center"
                title="Créer un groupe de lecture"
              >
                <Users className="w-4.5 h-4.5" />
              </button>
            </div>
          </div>

          {/* Symmetrical interactive Tabs with sleek indicator lines */}
          <div className="flex bg-gray-50 dark:bg-zinc-900/90 border-b border-gray-150 dark:border-zinc-805/45 text-xs font-semibold select-none">
            <button 
              type="button"
              onClick={() => { setActiveTab('chats'); setActiveGroupId(null); }}
              className={`flex-1 py-3 text-center transition-all border-b-2 font-serif uppercase tracking-wider text-[10px] ${
                activeTab === 'chats' && !activeGroupId
                  ? 'border-purple-600 text-[#7C3AED] dark:text-purple-400 font-black' 
                  : 'border-transparent text-gray-500 hover:text-gray-950 dark:hover:text-zinc-200'
              }`}
            >
              Discussions
            </button>
            <button 
              type="button"
              onClick={() => { setActiveTab('groups'); }}
              className={`flex-1 py-3 text-center transition-all border-b-2 font-serif uppercase tracking-wider text-[10px] ${
                activeTab === 'groups'
                  ? 'border-purple-600 text-[#7C3AED] dark:text-purple-400 font-black' 
                  : 'border-transparent text-gray-500 hover:text-gray-950 dark:hover:text-zinc-200'
              }`}
            >
              Groupes de lecture ({groups.length})
            </button>
          </div>

          {/* Search bar inside current listing */}
          <div className="p-2 border-b border-gray-100 dark:border-zinc-800 bg-white dark:bg-zinc-900">
            <div className="relative bg-gray-100/85 dark:bg-zinc-800 rounded-lg flex items-center px-3 py-1.5 border border-transparent">
              <Search className="w-4 h-4 text-gray-400 shrink-0 mr-2.5" />
              <input
                id="whatsapp-search-input"
                type="text"
                value={convSearch}
                onChange={(e) => setConvSearch(e.target.value)}
                placeholder={activeTab === 'chats' ? "Rechercher une discussion solo" : "Rechercher un groupe de lecture"}
                className="w-full bg-transparent text-xs text-gray-800 dark:text-gray-100 placeholder-gray-400 border-none outline-none focus:ring-0 p-0"
              />
              {convSearch && (
                <button onClick={() => setConvSearch('')} className="ml-2 shrink-0 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200" title="Effacer">
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* CONTACT & GROUPS DECK */}
          <div className="flex-1 overflow-y-auto divide-y divide-gray-100/60 dark:divide-zinc-800/40 bg-white dark:bg-zinc-900">
            
            {/* Solo Discussions Deck View */}
            {activeTab === 'chats' && conversations.filter((conv) => {
              const q = convSearch.trim().toLowerCase();
              if (!q) return true;
              const partner = conv.participants.find(p => p.id !== currentUser.id) || conv.participants[0] || currentUser;
              const last = conv.messages[conv.messages.length - 1];
              return (partner.username || '').toLowerCase().includes(q)
                || (!!last && !last.deletedForEveryone && !parseSticker(last.content) && (last.content || '').toLowerCase().includes(q));
            }).map((conv) => {
              const partner = conv.participants.find(p => p.id !== currentUser.id) || conv.participants[0] || currentUser;
              const isActive = conv.id === activeConversationId && !activeGroupId;
              const lastMsg = conv.messages[conv.messages.length - 1];
              const unreadCount = conv.unreadCount || 0;

              return (
                <button
                  key={conv.id}
                  id={`chat-partner-select-${partner.id}`}
                  onClick={() => {
                    setActiveGroupId(null);
                    setActiveConversationId(conv.id);
                    setMobileShowThread(true);
                  }}
                  className={`w-full text-left p-3.5 flex items-center space-x-3 transition-all relative border-l-4 ${
                    isActive 
                      ? 'bg-purple-50/40 dark:bg-purple-950/20 border-purple-600' 
                      : 'border-transparent hover:bg-gray-50 dark:hover:bg-zinc-850/55'
                  }`}
                >
                  <div className="relative shrink-0 select-none">
                    <img
                      src={partner.avatar}
                      alt={partner.username}
                      onClick={(e) => { e.stopPropagation(); onViewProfile?.(partner.id); }}
                      className="w-11 h-11 rounded-full object-cover ring-2 ring-gray-100 dark:ring-zinc-800 cursor-pointer hover:ring-purple-500/50"
                      referrerPolicy="no-referrer"
                    />
                    {onlineUserIds.has(partner.id) && (
                      <span className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-white dark:border-zinc-900 rounded-full"></span>
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-baseline mb-0.5">
                      <span className="text-xs font-bold text-gray-900 dark:text-gray-50 flex items-center">
                        {partner.username}
                        {partner.isVerified && <VerifiedBadge size="xs" className="ml-1" />}
                      </span>
                      <span className="text-[9px] text-gray-400 font-mono">
                        {lastMsg ? new Date(lastMsg.date || lastMsg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                      </span>
                    </div>

                    <div className="flex items-center justify-between">
                      {typingUserIds?.has(partner.id) ? (
                        <p className="text-[11px] text-purple-600 dark:text-purple-400 truncate pr-2 flex items-center gap-1 font-bold italic">
                          <Feather className="w-3.5 h-3.5 animate-feather-write" />
                          <span>écrit…</span>
                        </p>
                      ) : (
                        <p className="text-[11px] text-gray-500 dark:text-gray-400 truncate pr-2 flex items-center space-x-1">
                          {lastMsg?.senderId === currentUser.id && !lastMsg?.deletedForEveryone && (
                            <span className="shrink-0"><MessageTicks isDelivered={lastMsg.isDelivered} isRead={lastMsg.isRead} muted /></span>
                          )}
                          <span className="truncate">{lastMsg ? (lastMsg.deletedForEveryone ? 'Message supprimé' : parseSticker(lastMsg.content) ? '🪶 Sticker' : (lastMsg.content.startsWith('[🎙️ Note Vocale') ? '🎙️ Note vocale' : lastMsg.content)) : partner.bio || 'Aucun message de chat'}</span>
                        </p>
                      )}
                      
                      {unreadCount > 0 && (
                        <span className="bg-purple-600 text-white font-black text-[9px] w-4.5 h-4.5 rounded-full flex items-center justify-center shrink-0">
                          {unreadCount}
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              );
            })}

            {/* Reading Groups Deck View */}
            {activeTab === 'groups' && groups.filter((group) => {
              const q = convSearch.trim().toLowerCase();
              return !q || (group.name || '').toLowerCase().includes(q);
            }).map((group) => {
              const isGroupActive = activeGroupId === group.id;
              
              return (
                <button
                  key={group.id}
                  onClick={() => {
                    setActiveGroupId(group.id);
                    setMobileShowThread(true);
                  }}
                  className={`w-full text-left p-3.5 flex items-center space-x-3 transition-all relative border-l-4 ${
                    isGroupActive 
                      ? 'bg-purple-50/40 dark:bg-purple-950/20 border-purple-600' 
                      : 'border-transparent hover:bg-gray-50 dark:hover:bg-zinc-850/55'
                  }`}
                >
                  <div className="relative shrink-0 select-none">
                    <div className="w-11 h-11 rounded-full bg-purple-100 dark:bg-purple-950/30 flex items-center justify-center border border-purple-505/20 text-purple-600 dark:text-purple-400 overflow-hidden">
                      {group.avatar
                        ? <img src={group.avatar} alt={group.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                        : <BookOpen className="w-5 h-5 flex items-center justify-center" />}
                    </div>
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-baseline mb-0.5">
                      <span className="text-xs font-serif font-black text-gray-900 dark:text-gray-50 truncate max-w-[140px] block">
                        {group.name}
                      </span>
                      <span className="text-[9px] text-gray-400 font-mono">
                        {group.lastMessageDate ? new Date(group.lastMessageDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                      </span>
                    </div>

                    {groupTyping?.[group.id] ? (
                      <p className="text-[10px] text-purple-600 dark:text-purple-400 truncate pr-2 flex items-center gap-1 font-bold italic">
                        <Feather className="w-3 h-3 animate-feather-write" /> {groupTyping[group.id]} écrit…
                      </p>
                    ) : (
                      <p className="text-[10px] text-gray-500 dark:text-gray-400 truncate pr-2">
                        <span>{group.lastMessage ? (parseSticker(group.lastMessage) ? '🪶 Sticker' : (group.lastMessage.startsWith('[🎙️ Note Vocale') ? '🎙️ Note vocale' : group.lastMessage)) : 'Aucune discussion récente'}</span>
                      </p>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* RIGHT COMPARTMENT: ACTIVE CHAT THREAD WINDOW */}
        <div className={`md:col-span-8 flex flex-col justify-between bg-gray-50/50 dark:bg-zinc-950/90 h-full overflow-hidden relative ${
          mobileShowThread ? 'flex' : 'hidden md:flex'
        }`}>
          
          {/* Wallpaper dynamic subtle visual anchor motif */}
          <div className="absolute inset-0 opacity-[0.03] dark:opacity-[0.015] pointer-events-none bg-[radial-gradient(#7C3AED_1px,transparent_1px)] [background-size:16px_16px] bg-repeat"></div>

          {/* Caller Screen overlay simulation (HIGH CRAFT INTERACTION) */}
          {callState !== 'idle' && (
            <div className="absolute inset-0 z-50 bg-zinc-950/95 flex flex-col justify-between items-center py-20 px-8 text-center animate-fade-in backdrop-blur-md">
              <div className="space-y-4">
                <div className="relative inline-block">
                  <div className="absolute -inset-4 rounded-full bg-purple-500/10 animate-ping duration-1000"></div>
                  <img
                    src={activeGroupId ? "https://images.unsplash.com/photo-1543002588-bfa74002ed7e?auto=format&fit=crop&q=80&w=150" : interlocutor.avatar}
                    alt="Appelant"
                    className="w-24 h-24 rounded-full object-cover ring-4 ring-purple-600"
                  />
                </div>
                <div>
                  <h3 className="text-lg font-serif font-black text-white">
                    {activeGroupId ? activeGroup?.name : interlocutor.username}
                  </h3>
                  <p className="text-xs text-purple-400 font-bold tracking-widest uppercase mt-2">
                    {callState === 'ringing' ? 'Appel audio entrant...' : 'Appel connecté'}
                  </p>
                </div>
              </div>

              {callState === 'connected' && (
                <div className="font-mono text-xl font-bold text-gray-200">
                  {formatCallTime(callDuration)}
                </div>
              )}

              <button
                type="button"
                onClick={handleEndCall}
                className="w-16 h-16 rounded-full bg-red-650 hover:bg-red-700 text-white flex items-center justify-center transition-transform hover:scale-105 active:scale-95 shadow-lg shadow-red-500/20 cursor-pointer"
                title="Raccrocher"
              >
                <X className="w-6 h-6 shrink-0" />
              </button>
            </div>
          )}

          {/* Thread Header */}
          <div className="px-4 py-3 bg-[#0F0F14] text-white flex items-center justify-between border-b border-zinc-800/80 z-10 shrink-0">
            <div className="flex items-center space-x-3 min-w-0">
              {/* Back mobile button */}
              <button 
                onClick={() => {
                  setMobileShowThread(false);
                  setActiveGroupId(null);
                  setActiveConversationId('');
                }}
                className="p-1.5 -ml-1.5 md:hidden hover:bg-zinc-800 rounded-full text-zinc-300 mr-1"
                title="Retour à la liste"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>

              {/* Header profile photo & title representation */}
              {activeGroupId ? (
                // Group Header Style (clic → réglages du groupe)
                <button type="button" onClick={() => setShowGroupSettings(true)} className="flex items-center gap-2 min-w-0 text-left">
                  <div className="w-10 h-10 rounded-full bg-purple-950/50 flex items-center justify-center text-purple-400 font-bold shrink-0 overflow-hidden">
                    {activeGroup?.avatar
                      ? <img src={activeGroup.avatar} alt={activeGroup.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                      : <BookOpen className="w-5 h-5" />}
                  </div>
                  <div className="text-left min-w-0">
                    <h4 className="text-xs font-serif font-black text-white leading-none truncate max-w-[190px]">
                      {activeGroup?.name}
                    </h4>
                    <p className="text-[9px] text-[#A78BFA] font-bold mt-1.5 truncate max-w-[190px]">
                      {activeGroupId && groupTyping?.[activeGroupId] ? `${groupTyping[activeGroupId]} écrit…` : (activeGroup?.description || `${activeGroup?.members.length || 0} membres`)}
                    </p>
                  </div>
                </button>
              ) : (
                // Direct Solo Chat Header Style
                <>
                  <div className="relative shrink-0">
                    <img
                      src={interlocutor.avatar}
                      alt={interlocutor.username}
                      onClick={() => onViewProfile?.(interlocutor.id)}
                      className="w-10 h-10 rounded-full object-cover border border-zinc-800 shrink-0 cursor-pointer hover:border-purple-500"
                      referrerPolicy="no-referrer"
                    />
                    {onlineUserIds.has(interlocutor.id) && (
                      <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-green-500 border border-zinc-900 rounded-full"></span>
                    )}
                  </div>

                  <div className="text-left min-w-0">
                    <h4
                      onClick={() => onViewProfile?.(interlocutor.id)}
                      className="text-xs font-serif font-black text-white leading-none flex items-center cursor-pointer hover:text-purple-300 transition"
                    >
                      <span>{interlocutor.username}</span>
                      {interlocutor.isVerified && <VerifiedBadge size="xs" className="ml-1" />}
                    </h4>
                    <p className="text-[10px] text-white/90 font-bold mt-1.5">
                      {onlineUserIds.has(interlocutor.id) ? 'en ligne' : 'hors ligne'}
                    </p>
                  </div>
                </>
              )}
            </div>

            {/* Quick action tools - NO VIDEO: ONLY AUDIO per user's requests! */}
            <div className="flex items-center space-x-1 text-zinc-400 shrink-0">
              <button
                type="button"
                className="p-2 hover:bg-zinc-800 rounded-full transition text-[#7C3AED] dark:text-purple-400"
                title={activeGroupId ? 'Lancer un appel de groupe' : 'Lancer un appel audio'}
                onClick={() => {
                  if (activeGroupId) onStartGroupCall?.(activeGroupId, activeGroup?.members || []);
                  else handleStartCall();
                }}
              >
                <Phone className="w-4 h-4 scale-105" />
              </button>
              <button
                type="button"
                className="p-2 hover:bg-zinc-800 rounded-full transition text-[#7C3AED] dark:text-purple-400"
                title="Fond de la discussion"
                onClick={() => setShowBgPicker(true)}
              >
                <ImageIcon className="w-4 h-4" />
              </button>
              {!activeGroupId && activeConversationId && (
                <button
                  type="button"
                  id="delete-conversation-btn"
                  className="p-2 hover:bg-red-500/10 rounded-full transition text-gray-400 hover:text-red-500"
                  title="Supprimer la conversation"
                  onClick={() => {
                    if (confirm(`Supprimer la conversation avec ${interlocutor.username} ? Cette action est définitive.`)) {
                      onDeleteConversation(activeConversationId);
                    }
                  }}
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          {activeGroupId && activeGroup?.storyId && (() => {
            const story = stories.find(s => s.id === activeGroup.storyId);
            if (!story) return null;
            return (
              <div className="px-4 py-2 bg-purple-50/70 dark:bg-purple-950/20 border-b border-gray-200/50 dark:border-purple-500/10 backdrop-blur-md flex items-center justify-between shrink-0 animate-fade-in select-none">
                <div className="flex items-center space-x-3 min-w-0">
                  <img
                    src={story.cover || 'https://images.unsplash.com/photo-1543002588-bfa74002ed7e?auto=format&fit=crop&q=80&w=150'}
                    alt={story.title}
                    className="w-7 h-10 object-cover rounded shadow-md border border-purple-500/20 shrink-0"
                    referrerPolicy="no-referrer"
                  />
                  <div className="text-left min-w-0">
                    <p className="text-[9px] text-gray-400 dark:text-zinc-500 leading-tight uppercase font-mono font-bold">Ouvrage en débat</p>
                    <h5 className="text-xs font-serif font-black text-gray-900 dark:text-white truncate max-w-[170px] sm:max-w-[320px] md:max-w-[200px] lg:max-w-[350px]">
                      {story.title}
                    </h5>
                    <p className="text-[9px] text-purple-600 dark:text-purple-400 font-bold">par {story.authorName}</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => onSelectStory(story)}
                  className="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-[10px] font-black uppercase tracking-wider transition-all duration-300 transform active:scale-95 flex items-center space-x-1 cursor-pointer shrink-0"
                >
                  <BookOpen className="w-3.5 h-3.5 shrink-0" />
                  <span>Lire l'œuvre</span>
                </button>
              </div>
            );
          })()}

          {/* ACTIVE CHAT WORKSPACE AREA */}
          <div ref={scrollContainerRef} className="flex-1 min-h-0 p-4 md:p-6 overflow-y-auto z-10 space-y-3.5 overscroll-contain" style={{ ...chatBgStyle, WebkitOverflowScrolling: 'touch', touchAction: 'pan-y', willChange: 'scroll-position' }}>
            {activeGroupId ? (
              // Group Thread messaging
              activeGroupMessages.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center p-8 select-none">
                  <div className="w-16 h-16 rounded-full bg-purple-100 dark:bg-purple-950/20 flex items-center justify-center mb-4 text-[#7C3AED]">
                    <Users className="w-8 h-8" />
                  </div>
                  <h5 className="font-bold text-gray-900 dark:text-gray-100 text-sm">Groupe de lecture sécurisé</h5>
                  <p className="text-xs text-gray-400 max-w-xs mt-1 leading-relaxed">
                    Les membres de ce cercle de lecture peuvent tous échanger ici. Écrivez le premier message coopératif !
                  </p>
                </div>
              ) : (
                activeGroupMessages.map((msg) => {
                  const isSentByMe = msg.senderId === currentUser.id;
                  const isVoiceStr = msg.content.startsWith('[🎙️ Note Vocale');

                  return (
                    <div 
                      key={msg.id}
                      className={`flex ${isSentByMe ? 'justify-end' : 'justify-start'} animate-fade-in`}
                    >
                      <div className={`relative max-w-[85.5%] md:max-w-[75%] px-3.5 py-2 shadow-sm rounded-2xl ${
                        isSentByMe
                          ? 'bg-purple-600 dark:bg-purple-700 text-white rounded-br-md text-right'
                          : 'bg-white dark:bg-zinc-800 text-gray-900 dark:text-gray-100 rounded-bl-md border border-gray-200/70 dark:border-zinc-700/50 text-left'
                      }`}>

                        {/* Group member identifier tag top */}
                        {!isSentByMe && (
                          <div className="flex items-center space-x-1 mb-1 border-b border-gray-200/70 dark:border-zinc-700/50 pb-0.5">
                            <img 
                              src={msg.senderAvatar} 
                              alt={msg.senderName} 
                              className="w-3.5 h-3.5 rounded-full object-cover ring-1 ring-purple-400/20"
                            />
                            <span className="text-[9px] font-sans font-black text-purple-400">
                              {msg.senderName}
                            </span>
                          </div>
                        )}

                        {/* Content text / Voice / Sticker */}
                        {parseSticker(msg.content) ? (
                          isStickerUrl(parseSticker(msg.content)!)
                            ? (isVideoSticker(parseSticker(msg.content)!)
                                ? <video src={parseSticker(msg.content)!} className="w-24 h-24 object-contain rounded-lg" muted loop autoPlay playsInline />
                                : <img src={parseSticker(msg.content)!} alt="sticker" className="w-24 h-24 object-contain" referrerPolicy="no-referrer" />)
                            : <span className="text-5xl leading-none">{parseSticker(msg.content)}</span>
                        ) : isVoiceStr ? (
                          <VoicePlayerMockup
                            durationStr={msg.content.match(/Note Vocale - ([\d:]+)/)?.[1] || '0:05'}
                            isSentByMe={isSentByMe}
                            audioUrl={msg.content.match(/\|(https?:\/\/[^\]]+)\]/)?.[1]}
                          />
                        ) : (
                          <p className="text-xs leading-relaxed break-words text-left">
                            {msg.content}
                          </p>
                        )}

                        <div className={`flex items-center justify-end space-x-1 mt-1 text-[8.5px] font-mono ${
                          isSentByMe ? 'text-purple-200' : 'text-zinc-400'
                        }`}>
                          <span>
                            {new Date(msg.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                          {isSentByMe && <Feather className="w-3 h-3 text-white/70 shrink-0 inline animate-feather-in" />}
                        </div>
                      </div>
                    </div>
                  );
                })
              )
            ) : (
              // Direct solo Message thread
              threadMessages.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center p-8 select-none">
                  <div className="w-16 h-16 rounded-full bg-purple-100 dark:bg-purple-950/20 flex items-center justify-center mb-4 text-[#7C3AED]">
                    <MessageSquare className="w-8 h-8" />
                  </div>
                  <h5 className="font-bold text-gray-900 dark:text-gray-100 text-sm">Chiffrement de bout en bout</h5>
                  <p className="text-xs text-gray-400 max-w-xs mt-1 leading-relaxed">
                    Vos conversations privées sont locales et chiffrées. Échangez avec le romancier {interlocutor.username}.
                  </p>
                </div>
              ) : (
                threadMessages.map((msg, mi) => {
                  if (deletedForMe.has(msg.id)) return null; // supprimé pour moi
                  const isSentByMe = msg.senderId === currentUser.id;
                  const isVoiceStr = msg.content.startsWith('[🎙️ Note Vocale');
                  const sticker = parseSticker(msg.content);
                  const showDate = mi === 0 || !isSameDay(threadMessages[mi - 1]?.date, msg.date);
                  const dateSep = showDate ? <DateSeparator date={msg.date} /> : null;

                  // Message supprimé pour tout le monde.
                  if (msg.deletedForEveryone) {
                    return (
                      <React.Fragment key={msg.id}>{dateSep}
                      <div className={`flex ${isSentByMe ? 'justify-end' : 'justify-start'} animate-fade-in`}>
                        <div className="max-w-[80%] px-3 py-1.5 rounded-xl bg-zinc-200/60 dark:bg-zinc-800/60 text-zinc-500 dark:text-zinc-400 italic text-xs flex items-center gap-1.5">
                          <Trash2 className="w-3 h-3" /> Ce message a été supprimé
                        </div>
                      </div>
                      </React.Fragment>
                    );
                  }

                  // Sticker : affichage SANS bulle (grand emoji ou image).
                  if (sticker) {
                    const savable = !isSentByMe && isStickerUrl(sticker) && !customStickers.includes(sticker);
                    return (
                      <React.Fragment key={msg.id}>{dateSep}
                      <div className={`flex flex-col ${isSentByMe ? 'items-end' : 'items-start'} animate-fade-in`}>
                        <div
                          className="relative group"
                          onTouchStart={() => startLongPress(msg)}
                          onTouchEnd={cancelLongPress}
                          onTouchMove={cancelLongPress}
                          onContextMenu={(e) => { e.preventDefault(); setActionMsg(msg); }}
                        >
                          {isStickerUrl(sticker)
                            ? (isVideoSticker(sticker)
                                ? <video src={sticker} className="w-28 h-28 object-contain drop-shadow rounded-lg" muted loop autoPlay playsInline />
                                : <img src={sticker} alt="sticker" className="w-28 h-28 object-contain drop-shadow" referrerPolicy="no-referrer" />)
                            : <span className="text-[64px] leading-none">{sticker}</span>}
                          {/* Enregistrer le sticker d'un autre (comme sur WhatsApp). */}
                          {savable && (
                            <button
                              type="button"
                              onClick={() => { addCustomSticker(sticker); setCustomStickers(getCustomStickers()); onSyncStickers?.(getCustomStickers()); }}
                              className="absolute -bottom-1 -right-1 bg-purple-600 text-white rounded-full p-1 shadow-md active:scale-90 transition"
                              title="Enregistrer ce sticker"
                            >
                              <Plus className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                        <div className="flex items-center gap-1 mt-0.5 text-[9px] font-mono text-zinc-400">
                          <span>{new Date(msg.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                          {isSentByMe && <MessageTicks isDelivered={msg.isDelivered} isRead={msg.isRead} />}
                        </div>
                      </div>
                      </React.Fragment>
                    );
                  }

                  const repliedMsg = msg.replyToId ? threadMessages.find((m) => m.id === msg.replyToId) : null;
                  return (
                    <React.Fragment key={msg.id}>{dateSep}
                    <div
                      className={`flex ${isSentByMe ? 'justify-end' : 'justify-start'} animate-fade-in`}
                    >
                      <div
                        onTouchStart={() => startLongPress(msg)}
                        onTouchEnd={cancelLongPress}
                        onTouchMove={cancelLongPress}
                        onContextMenu={(e) => { e.preventDefault(); setActionMsg(msg); }}
                        className={`relative max-w-[80.5%] md:max-w-[70%] px-3 py-2 shadow-sm rounded-2xl ${
                        isSentByMe
                          ? 'bg-purple-600 dark:bg-purple-700 text-white rounded-br-md'
                          : 'bg-white dark:bg-zinc-800 text-gray-900 dark:text-gray-100 rounded-bl-md border border-gray-200/70 dark:border-zinc-700/50'
                      }`}>

                        {/* Citation du message auquel on répond. */}
                        {repliedMsg && (
                          <div className={`mb-1 px-2 py-1 rounded-lg border-l-2 text-left ${isSentByMe ? 'bg-white/15 border-white/60' : 'bg-purple-500/10 border-purple-500'}`}>
                            <p className={`text-[9px] font-black truncate ${isSentByMe ? 'opacity-90' : 'text-purple-600 dark:text-purple-400'}`}>{repliedMsg.senderId === currentUser.id ? 'Vous' : (interlocutor?.username || 'Auteur')}</p>
                            <p className="text-[10px] opacity-80 truncate">{repliedMsg.deletedForEveryone ? 'Message supprimé' : parseSticker(repliedMsg.content) ? '🪶 Sticker' : repliedMsg.content.startsWith('[🎙️ Note Vocale') ? '🎙️ Note vocale' : repliedMsg.content}</p>
                          </div>
                        )}

                        {isVoiceStr ? (
                          <VoicePlayerMockup
                            durationStr={msg.content.match(/Note Vocale - ([\d:]+)/)?.[1] || '0:05'}
                            isSentByMe={isSentByMe}
                            audioUrl={msg.content.match(/\|(https?:\/\/[^\]]+)\]/)?.[1]}
                          />
                        ) : (
                          <p className="text-xs leading-relaxed break-words pr-1 text-left">
                            {msg.content}
                          </p>
                        )}

                        <div className={`flex items-center justify-end space-x-1 mt-1 text-[9px] font-mono ${
                          isSentByMe ? 'text-purple-200' : 'text-zinc-400'
                        }`}>
                          {msg.editedAt && <span className="italic opacity-80">modifié</span>}
                          <span>
                            {new Date(msg.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                          {isSentByMe && <MessageTicks isDelivered={msg.isDelivered} isRead={msg.isRead} />}
                        </div>

                      </div>
                    </div>
                    </React.Fragment>
                  );
                })
              )
            )}
              {/* Indicateur « enregistre un audio… » (prioritaire) — privé ET groupe */}
              {(partnerRecording || groupRecordingName) && (
                <div className="flex justify-start animate-fade-in mt-1">
                  <div className="bg-black dark:bg-zinc-800 text-white rounded-2xl rounded-tl-none px-3 py-2 flex items-center gap-1.5 shadow-sm">
                    <Mic className="w-4 h-4 text-red-400 animate-pulse" />
                    <span className="text-[10px] text-zinc-300 italic">
                      {activeGroupId ? `${groupRecordingName} enregistre un audio…` : `${interlocutor.username} enregistre un audio…`}
                    </span>
                  </div>
                </div>
              )}
              {/* Indicateur « en train d'écrire » (plume qui écrit) — privé ET groupe */}
              {!partnerRecording && !groupRecordingName && (partnerTyping || (activeGroupId && groupTyping?.[activeGroupId])) && (
                <div className="flex justify-start animate-fade-in mt-1">
                  <div className="bg-black dark:bg-zinc-800 text-white rounded-2xl rounded-tl-none px-3 py-2 flex items-center gap-1.5 shadow-sm">
                    <Feather className="w-4 h-4 text-purple-300 animate-feather-write" />
                    <span className="text-[10px] text-zinc-300 italic">
                      {activeGroupId ? `${groupTyping?.[activeGroupId]} écrit…` : `${interlocutor.username} écrit…`}
                    </span>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* ACTIVE DISCUSSION PANEL CONTROLS FOOTER */}
            <div className="z-10 bg-gray-100/75 dark:bg-zinc-900/60 border-t border-gray-200/50 dark:border-zinc-800 p-2.5 shrink-0 space-y-2">
            
              {/* Sélecteur d'émojis (rendus avec la police native du téléphone) */}
              {showEmojiPicker && (
                <div className="mb-2 p-2 bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-2xl shadow-lg grid grid-cols-8 gap-1 max-h-40 overflow-y-auto animate-fade-in">
                  {EMOJIS.map((emo) => (
                    <button
                      key={emo}
                      type="button"
                      onClick={() => setMessageText((prev) => prev + emo)}
                      className="text-xl leading-none p-1 rounded-lg hover:bg-purple-500/10 active:scale-90 transition"
                    >
                      {emo}
                    </button>
                  ))}
                </div>
              )}

              {/* Sélecteur de stickers (base + personnalisés) */}
              {showStickers && (
                <div className="mb-2 p-2.5 bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-2xl shadow-lg max-h-56 overflow-y-auto animate-fade-in space-y-2">
                  <input
                    ref={stickerFileRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => handleCreateSticker(e.target.files?.[0] || null)}
                  />
                  <input
                    ref={videoStickerFileRef}
                    type="file"
                    accept="video/*"
                    className="hidden"
                    onChange={(e) => handleCreateVideoSticker(e.target.files?.[0] || null)}
                  />
                  <div className="flex items-center justify-between">
                    <span className="text-[9px] uppercase font-black tracking-wider text-zinc-400">Stickers</span>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => stickerFileRef.current?.click()}
                        disabled={uploadingSticker}
                        className="flex items-center gap-1 text-[9px] font-black uppercase text-purple-600 bg-purple-500/10 px-2 py-1 rounded-lg hover:bg-purple-500/20 disabled:opacity-50"
                      >
                        <Plus className="w-3 h-3" />{uploadingSticker ? 'Envoi…' : 'Image'}
                      </button>
                      <button
                        type="button"
                        onClick={() => videoStickerFileRef.current?.click()}
                        disabled={processingVideoSticker}
                        className="flex items-center gap-1 text-[9px] font-black uppercase text-purple-600 bg-purple-500/10 px-2 py-1 rounded-lg hover:bg-purple-500/20 disabled:opacity-50"
                      >
                        <Play className="w-3 h-3" />Vidéo
                      </button>
                    </div>
                  </div>
                  {customStickers.length > 0 && (
                    <div className="grid grid-cols-5 gap-2">
                      {customStickers.map((url) => (
                        <div key={url} className="relative group">
                          <button type="button" onClick={() => sendSticker(url)} className="block w-full aspect-square rounded-xl overflow-hidden bg-gray-100 dark:bg-zinc-800 active:scale-95 transition">
                            {isVideoSticker(url)
                              ? <video src={url} className="w-full h-full object-cover" muted loop autoPlay playsInline />
                              : <img src={url} alt="sticker" className="w-full h-full object-cover" referrerPolicy="no-referrer" />}
                          </button>
                          <button type="button" onClick={() => { removeCustomSticker(url); setCustomStickers(getCustomStickers()); onSyncStickers?.(getCustomStickers()); }} className="absolute -top-1 -right-1 bg-red-600 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition" title="Supprimer">
                            <X className="w-2.5 h-2.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="grid grid-cols-6 gap-1.5">
                    {BASE_STICKERS.map((s) => (
                      <button key={s} type="button" onClick={() => sendSticker(s)} className="text-3xl leading-none p-1 rounded-xl hover:bg-purple-500/10 active:scale-90 transition">
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Barre « réponse à » / « modification » au-dessus du champ. */}
              {(replyTo || editingMsg) && (
                <div className="flex items-center gap-2 mb-1.5 px-3 py-2 rounded-xl bg-purple-500/10 border-l-2 border-purple-500">
                  <div className="min-w-0 flex-1">
                    <p className="text-[9px] font-black uppercase tracking-wider text-purple-600 dark:text-purple-400">{editingMsg ? 'Modification' : 'Réponse à'}</p>
                    <p className="text-[11px] text-gray-600 dark:text-gray-300 truncate">
                      {(editingMsg || replyTo)?.deletedForEveryone ? 'Message supprimé'
                        : parseSticker((editingMsg || replyTo)!.content) ? '🪶 Sticker'
                        : (editingMsg || replyTo)!.content.startsWith('[🎙️ Note Vocale') ? '🎙️ Note vocale'
                        : (editingMsg || replyTo)!.content}
                    </p>
                  </div>
                  <button type="button" onClick={() => { setReplyTo(null); setEditingMsg(null); setMessageText(''); }} className="text-gray-400 hover:text-gray-600 shrink-0" aria-label="Annuler"><X className="w-4 h-4" /></button>
                </div>
              )}

              {/* Sélecteur d'émojis (rendus avec la police native du téléphone) */}
              {/* Standard message input bar */}
              <form onSubmit={handleSend} className="flex items-end space-x-1.5">
                {isRecording || uploadingVoice ? (
                  /* Barre d'enregistrement vocal (privé ET groupe). */
                  <div className="flex-1 flex items-center gap-2 bg-white dark:bg-zinc-800 rounded-xl px-3 py-2 border border-red-500/30">
                    <button type="button" onClick={handleDiscardVoiceNote} disabled={uploadingVoice} title="Annuler" className="text-red-500 disabled:opacity-40 shrink-0">
                      <Trash2 className="w-4 h-4" />
                    </button>
                    <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse shrink-0" />
                    <span className="flex-1 text-xs font-mono text-gray-600 dark:text-gray-300">
                      {uploadingVoice ? 'Envoi de la note vocale…' : `Enregistrement… ${formatRecordTime(recordingSeconds)}`}
                    </span>
                    <button
                      type="button"
                      onClick={handleSendVoiceNote}
                      disabled={uploadingVoice}
                      title="Envoyer la note vocale"
                      className="bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white p-2 rounded-full shrink-0 active:scale-95 transition"
                    >
                      <Send className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <>
                    <button
                      type="button"
                      className={`p-1.5 rounded-full transition-all shrink-0 ${showEmojiPicker ? 'bg-purple-500/15 text-purple-600' : 'text-[#7C3AED] dark:text-purple-400 hover:bg-gray-200/55 dark:hover:bg-zinc-850'}`}
                      title="Émojis"
                      onClick={() => { setShowEmojiPicker((v) => !v); setShowStickers(false); }}
                    >
                      <Smile className="w-5 h-5 shrink-0" />
                    </button>
                    <button
                      type="button"
                      className={`p-1.5 rounded-full transition-all shrink-0 ${showStickers ? 'bg-purple-500/15 text-purple-600' : 'text-[#7C3AED] dark:text-purple-400 hover:bg-gray-200/55 dark:hover:bg-zinc-850'}`}
                      title="Stickers"
                      onClick={() => { setShowStickers((v) => !v); setShowEmojiPicker(false); }}
                    >
                      <Sticker className="w-5 h-5 shrink-0" />
                    </button>

                    <textarea
                      id="message-input-chat-box"
                      ref={messageInputRef}
                      rows={1}
                      placeholder={activeGroupId ? "Message de groupe..." : "Rédiger votre message..."}
                      className="flex-1 w-full min-w-0 min-h-[46px] resize-none bg-white dark:bg-zinc-800 border border-transparent focus:border-[#7C3AED]/35 text-[15px] rounded-2xl px-4 py-3 focus:outline-none focus:ring-1 focus:ring-purple-500/35 text-gray-800 dark:text-gray-100 placeholder-gray-400 leading-relaxed scrollbar-none"
                      value={messageText}
                      onChange={(e) => handleTypingChange(e.target.value)}
                      onFocus={() => { setShowEmojiPicker(false); setShowStickers(false); }}
                      onKeyDown={(e) => {
                        // Entrée = envoyer ; Maj+Entrée = nouvelle ligne.
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          handleSend(e as any);
                        }
                      }}
                    />

                    {messageText.trim() ? (
                      <button
                        id="send-message-chat-btn"
                        type="submit"
                        className="bg-purple-600 hover:bg-purple-700 text-white p-2.5 rounded-full transition shrink-0 shadow-sm flex items-center justify-center active:scale-95"
                        title="Envoyer"
                      >
                        <Send className="w-4 h-4 transform rotate-0 shrink-0" />
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={startVoiceRecording}
                        className="bg-purple-600 hover:bg-purple-700 text-white p-2.5 rounded-full transition shrink-0 shadow-sm flex items-center justify-center active:scale-95"
                        title="Enregistrer une note vocale"
                      >
                        <Mic className="w-4 h-4 shrink-0" />
                      </button>
                    )}
                  </>
                )}
              </form>

          </div>

        </div>

      </div>

      {/* POPUP MODAL: WRITE A NEW DIRECT MESSAGE */}
      {isNewChatOpen && (
        <div
          className="fixed inset-0 bg-black/60 dark:bg-black/80 z-50 flex items-center justify-center p-4 backdrop-blur-xs"
          onClick={() => setIsNewChatOpen(false)}
        >
          <div
            className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-3xl w-full max-w-md max-h-[85vh] overflow-hidden flex flex-col shadow-2xl animate-fade-in text-left"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-5 border-b border-gray-100 dark:border-zinc-850 flex items-center justify-between">
              <h3 className="text-sm font-serif font-black text-gray-950 dark:text-gray-100 uppercase tracking-wider flex items-center space-x-1.5">
                <PlusCircle className="w-5 h-5 text-purple-600" />
                <span>Nouveau Message</span>
              </h3>
              <button
                type="button"
                onClick={() => setIsNewChatOpen(false)}
                className="p-1 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded-full text-gray-400 dark:text-zinc-500 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 border-b border-gray-100 dark:border-zinc-850">
              <div className="relative bg-gray-50 dark:bg-zinc-950 rounded-xl flex items-center px-3 py-2">
                <Search className="w-4 h-4 text-gray-400 shrink-0 mr-2" />
                <input
                  type="text"
                  placeholder="Rechercher un auteur par nom..."
                  value={authorSearch}
                  onChange={(e) => setAuthorSearch(e.target.value)}
                  className="w-full bg-transparent text-xs text-gray-800 dark:text-gray-100 placeholder-gray-400 border-none outline-none focus:ring-0 p-0"
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-2">
              <p className="text-[10px] font-mono font-bold text-gray-450 uppercase mb-2">Auteurs disponibles ({allUsers.filter(u => u.id !== currentUser.id).length})</p>
              {allUsers
                .filter(u => u.id !== currentUser.id)
                .filter(u => u.username.toLowerCase().includes(authorSearch.toLowerCase()))
                .map((userObj) => (
                  <button
                    key={userObj.id}
                    onClick={() => selectDirectAuthor(userObj.id)}
                    className="w-full flex items-center space-x-3.5 p-3 rounded-2xl hover:bg-purple-500/5 dark:hover:bg-purple-950/15 border border-gray-55/10 hover:border-purple-600/20 text-left transition"
                  >
                    <img
                      src={userObj.avatar}
                      alt={userObj.username}
                      className="w-10 h-10 rounded-full object-cover shrink-0 ring-2 ring-purple-600/5"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-gray-900 dark:text-gray-100">{userObj.username}</span>
                      </div>
                      <p className="text-[10px] text-gray-400 truncate mt-0.5">{userObj.bio || "Aucune biographie"}</p>
                    </div>
                  </button>
                ))
              }
            </div>
          </div>
        </div>
      )}

      {/* POPUP MODAL: CREATE A READING GROUP */}
      {isNewGroupOpen && (
        <div
          className="fixed inset-0 bg-black/60 dark:bg-black/80 z-50 flex items-center justify-center p-4 backdrop-blur-xs"
          onClick={() => setIsNewGroupOpen(false)}
        >
          <div
            className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-3xl w-full max-w-md max-h-[85vh] overflow-hidden flex flex-col shadow-2xl animate-fade-in text-left"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-5 border-b border-gray-100 dark:border-zinc-850 flex items-center justify-between">
              <h3 className="text-sm font-serif font-black text-gray-950 dark:text-gray-100 uppercase tracking-wider flex items-center space-x-1.5 select-none">
                <Users className="w-5 h-5 text-purple-600" />
                <span>Créer un groupe de lecture</span>
              </h3>
              <button
                type="button"
                onClick={() => setIsNewGroupOpen(false)}
                className="p-1 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded-full text-gray-400 dark:text-zinc-500 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateGroupSubmit} className="flex-1 overflow-y-auto p-5 space-y-4">
              <div className="space-y-1.5">
                <label className="text-[10px] font-mono font-bold uppercase text-gray-400">Nom du groupe de lecture</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Passion Thriller, Club Victor Hugo, etc."
                  value={newGroupName}
                  onChange={(e) => setNewGroupName(e.target.value)}
                  className="w-full bg-gray-50 dark:bg-zinc-950 border border-gray-200 dark:border-zinc-800 text-xs text-gray-805 dark:text-gray-100 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-1 focus:ring-purple-650"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-mono font-bold uppercase text-gray-400">Description ou thème</label>
                <input
                  type="text"
                  placeholder="Ex: Lecture partagée des oeuvres classiques gothiques."
                  value={newGroupDesc}
                  onChange={(e) => setNewGroupDesc(e.target.value)}
                  className="w-full bg-gray-50 dark:bg-zinc-950 border border-gray-200 dark:border-zinc-805 text-xs text-gray-805 dark:text-gray-100 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-1 focus:ring-purple-650"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-mono font-bold uppercase text-gray-400">Ouvrage lié (Optionnel)</label>
                <select
                  value={newGroupStoryId}
                  onChange={(e) => setNewGroupStoryId(e.target.value)}
                  className="w-full bg-gray-50 dark:bg-zinc-950 border border-gray-200 dark:border-zinc-805 text-xs text-gray-800 dark:text-gray-100 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-1 focus:ring-purple-650"
                >
                  <option value="">-- Aucun ouvrage associé --</option>
                  {stories.map((story) => (
                    <option key={story.id} value={story.id}>
                      {story.title} (par {story.authorName})
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5 flex-1 flex flex-col">
                <label className="text-[10px] font-mono font-bold uppercase text-gray-400">Membres fondateurs à inviter</label>
                <div className="bg-gray-50 dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-xl p-3 max-h-[170px] overflow-y-auto space-y-1.5">
                  {allUsers
                    .filter(u => u.id !== currentUser.id)
                    .map((memberUser) => {
                      const isSelected = groupSelectedMembers.includes(memberUser.id);
                      return (
                        <div 
                          key={memberUser.id}
                          onClick={() => toggleSelectGroupMember(memberUser.id)}
                          className="flex items-center justify-between p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-zinc-800 cursor-pointer text-xs"
                        >
                          <div className="flex items-center space-x-2">
                            <img
                              src={memberUser.avatar}
                              alt={memberUser.username}
                              className="w-6 h-6 rounded-full object-cover"
                            />
                            <span className="font-bold text-gray-900 dark:text-gray-100">{memberUser.username}</span>
                          </div>
                          <div className={`w-4 h-4 rounded border flex items-center justify-center transition-all ${
                            isSelected 
                              ? 'bg-purple-600 border-purple-600 text-white' 
                              : 'border-gray-300 dark:border-zinc-700'
                          }`}>
                            {isSelected && <Check className="w-3 h-3 text-white fill-current shrink-0" />}
                          </div>
                        </div>
                      );
                    })
                  }
                </div>
              </div>

              <button
                type="submit"
                disabled={!newGroupName.trim()}
                className="w-full bg-purple-600 hover:bg-purple-700 disabled:opacity-40 text-white font-bold text-xs uppercase tracking-wider py-3 rounded-xl transition duration-150 shadow-md shadow-purple-500/10 uppercase"
              >
                Créer le cercle de lecture
              </button>
            </form>
          </div>
        </div>
      )}

      {/* MODALE : RÉGLAGES DU GROUPE (façon WhatsApp) */}
      {showGroupSettings && activeGroup && (() => {
        const isGroupAdmin = activeGroup.creatorId === currentUser.id;
        const memberUsers = (activeGroup.members || []).map((id) => allUsers.find((u) => u.id === id)).filter(Boolean) as User[];
        const addableUsers = allUsers.filter((u) => u.id !== currentUser.id && !(activeGroup.members || []).includes(u.id));
        return (
          <div className="fixed inset-0 bg-black/70 z-[60] flex items-center justify-center p-4 animate-fade-in" onClick={() => { setShowGroupSettings(false); setGroupAddOpen(false); }}>
            <div className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-3xl w-full max-w-md max-h-[88vh] overflow-hidden flex flex-col shadow-2xl" onClick={(e) => e.stopPropagation()}>
              <div className="p-4 border-b border-gray-100 dark:border-zinc-850 flex items-center justify-between">
                <h3 className="text-sm font-serif font-black text-gray-950 dark:text-gray-100">Infos du groupe</h3>
                <button onClick={() => { setShowGroupSettings(false); setGroupAddOpen(false); }} className="p-1 text-gray-400 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded-full"><X className="w-5 h-5" /></button>
              </div>

              <div className="flex-1 overflow-y-auto p-5 space-y-4">
                {/* Photo + nom */}
                <div className="flex flex-col items-center gap-2">
                  <div className="relative">
                    <div className="w-24 h-24 rounded-full bg-purple-100 dark:bg-purple-950/30 overflow-hidden flex items-center justify-center text-purple-500">
                      {activeGroup.avatar ? <img src={activeGroup.avatar} alt={activeGroup.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" /> : <BookOpen className="w-9 h-9" />}
                    </div>
                    {isGroupAdmin && (
                      <>
                        <input ref={groupPhotoRef} type="file" accept="image/*" className="hidden" onChange={(e) => handleGroupPhoto(e.target.files?.[0] || null, activeGroup.id)} />
                        <button onClick={() => groupPhotoRef.current?.click()} disabled={uploadingGroupPhoto} className="absolute bottom-0 right-0 bg-purple-600 text-white rounded-full p-1.5 shadow disabled:opacity-50" title="Changer la photo">
                          {uploadingGroupPhoto ? <span className="w-3.5 h-3.5 block rounded-full border-2 border-white/40 border-t-white animate-spin" /> : <Camera className="w-3.5 h-3.5" />}
                        </button>
                      </>
                    )}
                  </div>
                  {isGroupAdmin ? (
                    <input
                      defaultValue={activeGroup.name}
                      onBlur={(e) => { const v = e.target.value.trim(); if (v && v !== activeGroup.name) onUpdateGroup?.(activeGroup.id, { name: v }); }}
                      className="text-center text-sm font-black bg-transparent border-b border-transparent focus:border-purple-500 outline-none text-gray-900 dark:text-white"
                    />
                  ) : (
                    <span className="text-sm font-black text-gray-900 dark:text-white">{activeGroup.name}</span>
                  )}
                  <span className="text-[10px] text-zinc-400">{memberUsers.length} membre{memberUsers.length > 1 ? 's' : ''}</span>
                </div>

                {/* Membres */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] uppercase font-black tracking-wider text-zinc-400">Membres</span>
                    {isGroupAdmin && <button onClick={() => setGroupAddOpen((v) => !v)} className="text-[10px] font-black uppercase text-purple-600 flex items-center gap-1"><Plus className="w-3 h-3" />Ajouter</button>}
                  </div>

                  {groupAddOpen && isGroupAdmin && (
                    <div className="mb-3 max-h-40 overflow-y-auto rounded-xl border border-gray-150 dark:border-zinc-800 divide-y divide-gray-100 dark:divide-zinc-850">
                      {addableUsers.length === 0 ? <p className="text-[10px] text-zinc-400 p-3 text-center">Aucun utilisateur à ajouter.</p> : addableUsers.slice(0, 50).map((u) => (
                        <button key={u.id} onClick={() => { onAddGroupMembers?.(activeGroup.id, [u.id]); setGroupAddOpen(false); }} className="w-full flex items-center gap-2 p-2 hover:bg-purple-500/10 text-left">
                          <img src={u.avatar} alt={u.username} className="w-7 h-7 rounded-full object-cover" referrerPolicy="no-referrer" />
                          <span className="text-xs font-bold text-gray-800 dark:text-gray-100 flex-1 truncate">{u.username}</span>
                          <Plus className="w-3.5 h-3.5 text-purple-600" />
                        </button>
                      ))}
                    </div>
                  )}

                  <div className="space-y-1">
                    {memberUsers.map((u) => (
                      <div key={u.id} className="flex items-center gap-2 p-2 rounded-xl hover:bg-gray-50 dark:hover:bg-zinc-850/50">
                        <img src={u.avatar} alt={u.username} onClick={() => onViewProfile?.(u.id)} className="w-8 h-8 rounded-full object-cover cursor-pointer" referrerPolicy="no-referrer" />
                        <span className="text-xs font-bold text-gray-800 dark:text-gray-100 flex-1 truncate">{u.username}</span>
                        {u.id === activeGroup.creatorId && <span className="text-[8px] font-black uppercase bg-purple-500/15 text-purple-600 px-1.5 py-0.5 rounded">Admin</span>}
                        {isGroupAdmin && u.id !== activeGroup.creatorId && (
                          <button onClick={() => onRemoveGroupMember?.(activeGroup.id, u.id)} className="p-1 text-gray-400 hover:text-red-500" title="Retirer"><X className="w-3.5 h-3.5" /></button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Quitter le groupe (sauf l'admin) */}
              <div className="p-4 border-t border-gray-100 dark:border-zinc-850">
                {activeGroup.creatorId !== currentUser.id ? (
                  <button onClick={() => { if (confirm('Quitter ce groupe ?')) { onRemoveGroupMember?.(activeGroup.id, currentUser.id); setShowGroupSettings(false); } }} className="w-full py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white font-black text-xs uppercase tracking-wider">
                    Quitter le groupe
                  </button>
                ) : (
                  <p className="text-[10px] text-center text-zinc-400">Vous êtes l'administrateur de ce groupe.</p>
                )}
              </div>
            </div>
          </div>
        );
      })()}

      {/* MENU D'ACTIONS SUR UN MESSAGE (appui long) — répondre / modifier / supprimer. */}
      {actionMsg && createPortal(
        <div className="fixed inset-0 z-[2147483000] bg-black/50 flex items-end justify-center" onClick={() => setActionMsg(null)}>
          <div className="w-full max-w-md bg-white dark:bg-[#0E0E14] rounded-t-3xl p-2 animate-fade-in" onClick={(e) => e.stopPropagation()} style={{ paddingBottom: 'calc(0.5rem + env(safe-area-inset-bottom))' }}>
            <button onClick={() => startReply(actionMsg)} className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl hover:bg-gray-100 dark:hover:bg-zinc-900 text-left">
              <Send className="w-4 h-4 text-purple-600 -scale-x-100" /><span className="text-sm font-bold">Répondre</span>
            </button>
            {canEdit(actionMsg) && (
              <button onClick={() => startEdit(actionMsg)} className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl hover:bg-gray-100 dark:hover:bg-zinc-900 text-left">
                <Check className="w-4 h-4 text-purple-600" /><span className="text-sm font-bold">Modifier</span>
              </button>
            )}
            <button onClick={() => deleteForMe(actionMsg.id)} className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl hover:bg-gray-100 dark:hover:bg-zinc-900 text-left">
              <Trash2 className="w-4 h-4 text-gray-500" /><span className="text-sm font-bold">Supprimer pour moi</span>
            </button>
            {actionMsg.senderId === currentUser.id && !actionMsg.deletedForEveryone && (
              <button onClick={() => { onDeleteMessageForEveryone?.(actionMsg.id); setActionMsg(null); }} className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl hover:bg-red-500/10 text-left">
                <Trash2 className="w-4 h-4 text-red-500" /><span className="text-sm font-bold text-red-500">Supprimer pour tout le monde</span>
              </button>
            )}
            <button onClick={() => setActionMsg(null)} className="w-full px-4 py-3 mt-1 text-center text-sm font-black text-gray-400">Annuler</button>
          </div>
        </div>,
        document.body,
      )}

      {/* MODALE : FOND DE LA DISCUSSION (5 fonds prédéfinis + image perso). */}
      {showBgPicker && createPortal(
        <div className="fixed inset-0 z-[2147483000] bg-black/60 flex items-end sm:items-center justify-center p-4" onClick={() => setShowBgPicker(false)}>
          <div className="w-full max-w-md bg-white dark:bg-[#0E0E14] rounded-3xl p-4" onClick={(e) => e.stopPropagation()} style={{ paddingBottom: 'calc(1rem + env(safe-area-inset-bottom))' }}>
            <h3 className="font-serif font-black text-sm mb-3">Fond de la discussion</h3>
            <input ref={bgFileRef} type="file" accept="image/*" className="hidden" onChange={(e) => handleBgUpload(e.target.files?.[0] || null)} />
            <div className="grid grid-cols-3 gap-2.5">
              <button onClick={() => applyChatBg('')} className={`aspect-square rounded-2xl border-2 flex items-center justify-center text-[10px] font-black text-gray-500 ${!chatBg ? 'border-purple-600' : 'border-transparent'} bg-gray-100 dark:bg-zinc-800`}>Aucun</button>
              {CHAT_BG_PRESETS.map((p) => (
                <button key={p.id} onClick={() => applyChatBg(p.id)} className={`aspect-square rounded-2xl border-2 ${chatBg === p.id ? 'border-purple-600' : 'border-transparent'} flex items-end p-1.5`} style={{ background: p.css }}>
                  <span className="text-[8px] font-black text-gray-700 bg-white/70 rounded px-1">{p.label}</span>
                </button>
              ))}
              <button onClick={() => bgFileRef.current?.click()} disabled={uploadingBg} className={`aspect-square rounded-2xl border-2 border-dashed border-purple-400 flex flex-col items-center justify-center text-[9px] font-black text-purple-600 ${chatBg.startsWith('http') ? 'ring-2 ring-purple-600' : ''}`}>
                <ImageIcon className="w-4 h-4 mb-0.5" />{uploadingBg ? 'Envoi…' : 'Mon image'}
              </button>
            </div>
            <button onClick={() => setShowBgPicker(false)} className="mt-4 w-full py-2.5 rounded-xl bg-purple-600 text-white text-xs font-black uppercase tracking-wider">Fermer</button>
          </div>
        </div>,
        document.body,
      )}

      {/* MODALE : ROGNAGE DU STICKER (format carré) — rendue via un portail sur
          document.body afin qu'aucun parent (transform/overflow d'une vue
          animée) ne puisse rogner la modale ni masquer ses boutons. */}
      {stickerCropSrc && createPortal(
        <div className="fixed inset-0 bg-black/80 z-[2147483000] flex flex-col p-4 animate-fade-in" style={{ paddingBottom: 'calc(1rem + env(safe-area-inset-bottom))', paddingTop: 'calc(1rem + env(safe-area-inset-top))' }}>
          <div className="flex-1 min-h-0 relative max-w-md w-full mx-auto rounded-2xl overflow-hidden bg-zinc-900">
            <Cropper
              image={stickerCropSrc}
              crop={stickerCrop}
              zoom={stickerZoom}
              aspect={1}
              cropShape="rect"
              showGrid={false}
              onCropChange={setStickerCrop}
              onZoomChange={setStickerZoom}
              onCropComplete={(_, pixels) => setStickerCroppedPixels(pixels)}
            />
          </div>
          <div className="max-w-md w-full mx-auto mt-3 space-y-3 shrink-0">
            <input
              type="range" min={1} max={3} step={0.01}
              value={stickerZoom}
              onChange={(e) => setStickerZoom(Number(e.target.value))}
              className="w-full accent-purple-600"
            />
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setStickerCropSrc(null)}
                className="flex-1 py-3 rounded-xl bg-zinc-700 text-white font-bold text-xs uppercase tracking-wider"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={confirmStickerCrop}
                disabled={uploadingSticker || !stickerCroppedPixels}
                className="flex-1 py-3 rounded-xl bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white font-bold text-xs uppercase tracking-wider"
              >
                {uploadingSticker ? 'Création…' : 'Créer le sticker'}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* MODALE : STICKER VIDÉO — rognage carré (sur poster) + découpe début/fin. */}
      {videoStickerSrc && createPortal(
        <div className="fixed inset-0 bg-black/85 z-[2147483000] flex flex-col p-4 animate-fade-in" style={{ paddingBottom: 'calc(1rem + env(safe-area-inset-bottom))', paddingTop: 'calc(1rem + env(safe-area-inset-top))' }}>
          <div className="max-w-md w-full mx-auto flex-1 min-h-0 flex flex-col gap-3">
            <div className="flex items-center justify-between shrink-0">
              <span className="text-white font-black text-xs uppercase tracking-wider">Sticker vidéo</span>
              <span className="text-[10px] text-zinc-400">Rogne (carré) puis découpe (max {MAX_STICKER_CLIP}s)</span>
            </div>

            {/* Rognage carré sur l'image-poster (1re frame). */}
            <div className="flex-1 min-h-0 relative rounded-2xl overflow-hidden bg-zinc-900">
              {videoStickerPoster ? (
                <Cropper
                  image={videoStickerPoster}
                  crop={videoStickerCrop}
                  zoom={videoStickerZoom}
                  aspect={1}
                  cropShape="rect"
                  showGrid={false}
                  onCropChange={setVideoStickerCrop}
                  onZoomChange={setVideoStickerZoom}
                  onCropComplete={(_, pixels) => setVideoStickerCroppedPixels(pixels)}
                />
              ) : (
                <div className="absolute inset-0 flex items-center justify-center text-zinc-500 text-xs">Préparation…</div>
              )}
            </div>

            {/* Aperçu animé de la découpe. */}
            <div className="shrink-0 flex items-center gap-3">
              <video
                ref={trimPreviewRef}
                src={videoStickerSrc}
                className="w-16 h-16 rounded-lg object-cover bg-black shrink-0"
                muted
                playsInline
              />
              <div className="flex-1 space-y-2">
                <div className="flex items-center gap-2">
                  <span className="text-[9px] text-zinc-400 w-10 shrink-0">Début</span>
                  <input
                    type="range" min={0} max={Math.max(0.1, videoStickerDuration)} step={0.1}
                    value={videoTrimStart}
                    onChange={(e) => {
                      const s = Math.min(Number(e.target.value), videoTrimEnd - 0.3);
                      setVideoTrimStart(Math.max(0, s));
                      if (videoTrimEnd - s > MAX_STICKER_CLIP) setVideoTrimEnd(s + MAX_STICKER_CLIP);
                    }}
                    className="flex-1 accent-purple-600"
                  />
                  <span className="text-[9px] font-mono text-zinc-300 w-8 text-right">{videoTrimStart.toFixed(1)}s</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[9px] text-zinc-400 w-10 shrink-0">Fin</span>
                  <input
                    type="range" min={0} max={Math.max(0.1, videoStickerDuration)} step={0.1}
                    value={videoTrimEnd}
                    onChange={(e) => {
                      let en = Math.max(Number(e.target.value), videoTrimStart + 0.3);
                      if (en - videoTrimStart > MAX_STICKER_CLIP) en = videoTrimStart + MAX_STICKER_CLIP;
                      setVideoTrimEnd(Math.min(videoStickerDuration || en, en));
                    }}
                    className="flex-1 accent-purple-600"
                  />
                  <span className="text-[9px] font-mono text-zinc-300 w-8 text-right">{videoTrimEnd.toFixed(1)}s</span>
                </div>
              </div>
            </div>

            <div className="shrink-0 flex gap-2">
              <button
                type="button"
                onClick={cancelVideoSticker}
                disabled={processingVideoSticker}
                className="flex-1 py-3 rounded-xl bg-zinc-700 text-white font-bold text-xs uppercase tracking-wider disabled:opacity-50"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={confirmVideoSticker}
                disabled={processingVideoSticker || !videoStickerCroppedPixels}
                className="flex-1 py-3 rounded-xl bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white font-bold text-xs uppercase tracking-wider"
              >
                {processingVideoSticker ? 'Création…' : 'Créer le sticker'}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

    </div>
  );
}
