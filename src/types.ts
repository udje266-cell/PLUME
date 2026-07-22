/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type UserRole = 'Lecteur' | 'Auteur' | 'Administrateur';

export interface User {
  id: string;
  username: string;
  email: string;
  role: UserRole;
  avatar: string;
  banner?: string;
  bio: string;
  followers: string[];
  following: string[];
  isVerified: boolean;
  signUpDate: string;
  favoriteGenres: string[];
  customStickers?: string[];
  birthDate?: string;
  gender?: 'Homme' | 'Femme';
  hasChangedRole?: boolean;
  usernameChangedAt?: string | null;
  emailChangedAt?: string | null;
  isFlagged?: boolean;
  flagReason?: string;
  isBanned?: boolean;
  featured?: boolean;
  readerXp?: number;
  authorXp?: number;
  showPalmares?: boolean;
  showFollowers?: boolean;
  showFollowing?: boolean;
  showFriends?: boolean;
  showMentions?: boolean;
  privateProfile?: boolean;
  showBooksRead?: boolean;
  showBooksWritten?: boolean;
  allowMessages?: boolean;
  whoCanFollow?: string;
  whoCanComment?: string;
  blockedUsers?: string[];
  readingTheme?: string;
  readingFontSize?: string;
  readingFontFamily?: string;
  readingFullscreen?: boolean;
  readingHistory?: string[];
  autoSaveEnabled?: boolean;
  confirmDeleteStory?: boolean;
  activeConnections?: string[];
  emailVerified?: boolean;
  // Vitrine de trophees mis en avant (snapshots), visible par tous les visiteurs.
  showcase?: { id: string; title: string }[];
  // Statistiques de progression des succes (UserStats), persistees serveur.
  stats?: Record<string, number>;
  // Le compte possède-t-il un mot de passe ? (faux pour les comptes Google tant
  // qu'ils n'en ont pas créé un). Sert à proposer « Créer un mot de passe ».
  hasPassword?: boolean;
}

export interface Chapter {
  id: string;
  title: string;
  content: string;
  publishDate: string;
  isPublished: boolean;
  order?: number;
  views: number;
  viewedBy?: string[];
  reads: number;
  // Tome OPTIONNEL auquel appartient le chapitre (null/absent = hors tome).
  tomeId?: string | null;
}

// Tome / volume : regroupement optionnel de chapitres dans une œuvre.
export interface Tome {
  id: string;
  storyId: string;
  title: string;
  description: string;
  order: number;
}

export interface CommentReply {
  id: string;
  userId: string;
  username: string;
  avatar: string;
  content: string;
  date: string;
}

export interface Comment {
  id: string;
  storyId: string;
  chapterId: string;
  userId: string;
  username: string;
  avatar: string;
  content: string;
  date: string;
  likes: number;
  replies: CommentReply[];
  likedByMe?: boolean;
  likedBy?: string[];
}

export interface Story {
  id: string;
  title: string;
  description: string;
  authorId: string;
  authorName: string;
  authorAvatar: string;
  authorVerified: boolean;
  cover: string;
  genre: string;
  category: string;
  ambiance: string;
  format: string;
  language: string;
  chapters: Chapter[];
  // Mode d'organisation choisi à la création : 'chapters' (défaut) ou 'tomes'.
  structure?: 'chapters' | 'tomes';
  // Tomes optionnels (triés par ordre). Absent/vide = œuvre à lecture plate.
  tomes?: Tome[];
  likes: number;
  likedBy?: string[];
  favoritesCount: number;
  favoritedBy?: string[];
  tags: string[];
  status: 'Brouillon' | 'Publié';
  publishDate: string;
  views: number;
  viewedBy?: string[];
  reads: number;
  rating: number;
  isFlagged: boolean;
  flagReason?: string;
  featured?: boolean;
  ageRating?: 'all' | '12' | '16' | '18';
}

export interface Message {
  id: string;
  senderId: string;
  senderName?: string;
  senderAvatar?: string;
  conversationId?: string;
  content: string;
  date: string;
  isRead: boolean;
  isDelivered?: boolean;
  sender?: User;
  receiverId?: string;
  receiverName?: string;
  receiverAvatar?: string;
  createdAt?: string;
  replyToId?: string | null;
  editedAt?: string | null;
  deletedForEveryone?: boolean;
}

export interface Conversation {
  id: string;
  participants: User[];
  messages: Message[];
  createdAt: string;
  updatedAt: string;
  unreadCount?: number;
  // L'autre participant m'a bloqué : le composer est verrouillé (message
  // neutre) au lieu de laisser envoyer pour un rejet serveur garanti.
  blockedByPartner?: boolean;
  // Demande de message (façon TikTok) entre personnes non amies.
  // NONE = libre ; PENDING = en attente d'acceptation ; ACCEPTED = illimité ;
  // REJECTED = déclinée.
  requestStatus?: 'NONE' | 'PENDING' | 'ACCEPTED' | 'REJECTED';
  requesterId?: string | null; // l'initiateur soumis à la limite
  requestMessagesLeft?: number; // messages restants pour l'initiateur (si PENDING)
}

export interface ReadingProgress {
  storyId: string;
  chapterId: string;
  progressPercent: number;
  lastReadTime: string;
}

export type AppNotificationType = 'follow' | 'friend' | 'comment' | 'like' | 'favorite' | 'message';

export interface AppNotification {
  id: string;
  type: AppNotificationType;
  targetUserId: string;
  actorId: string;
  actorName: string;
  actorAvatar: string;
  title: string;
  message: string;
  createdAt: string;
  read: boolean;
  storyId?: string;
  storyTitle?: string;
  chapterId?: string;
  commentId?: string;
  excerpt?: string;
  conversationId?: string;
  groupId?: string;
}

export type GroupRole = 'owner' | 'admin' | 'moderator' | 'member';
export type GroupMemberStatus = 'active' | 'pending' | 'banned' | 'removed';
export type GroupVisibility = 'public' | 'private' | 'invite';

export interface GroupMembership {
  userId: string;
  role: GroupRole;
  status: GroupMemberStatus;
  joinedAt?: string;
  username: string;
  avatar: string;
  isVerified?: boolean;
}

export interface ReadingGroup {
  id: string;
  name: string;
  description: string;
  avatar?: string;
  creatorId?: string; // proprietaire du groupe
  members: string[]; // User IDs (membres actifs)
  roster?: GroupMembership[]; // roles/statuts/dates d'entree
  lastMessage?: string;
  lastMessageDate?: string;
  unreadCount?: number; // messages des autres depuis mon dernier marquage lu
  storyId?: string; // Tying group to a specific story
  // Parametres (style WhatsApp).
  visibility?: GroupVisibility;
  whoCanEditInfo?: 'all' | 'admins';
  messagePermission?: 'all' | 'admins';
  allowReactions?: boolean;
  allowMedia?: boolean;
  requireApproval?: boolean;
  inviteCode?: string;
  inviteEnabled?: boolean;
}

export interface GroupReaction {
  emoji: string;
  count: number;
  mine: boolean;
  userIds: string[];
}

export interface GroupMessage {
  id: string;
  groupId: string;
  senderId: string;
  senderName: string;
  senderAvatar: string;
  content: string;
  date: string;
  replyToId?: string | null;
  editedAt?: string | null;
  deletedForEveryone?: boolean;
  deletedByAdmin?: boolean;
  pinned?: boolean;
  pinnedAt?: string | null;
  isAnnouncement?: boolean;
  reactions?: GroupReaction[];
}

