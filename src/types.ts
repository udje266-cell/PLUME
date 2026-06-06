/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type UserRole = 'Lecteur' | 'Auteur' | 'Utilisateur Mixte' | 'Administrateur';

export interface User {
  id: string;
  username: string;
  email: string;
  role: UserRole;
  avatar: string;
  bio: string;
  followers: string[];
  following: string[];
  isVerified: boolean;
  signUpDate: string;
  favoriteGenres: string[];
  birthDate?: string;
  gender?: 'Homme' | 'Femme';
  hasChangedRole?: boolean;
  isFlagged?: boolean;
  flagReason?: string;
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
}

export interface Chapter {
  id: string;
  title: string;
  content: string;
  publishDate: string;
  isPublished: boolean;
  views: number;
  viewedBy?: string[];
  reads: number;
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
  ageRating?: 'all' | '12' | '16' | '18';
}

export interface Message {
  id: string;
  senderId: string;
  senderName?: string;
  senderAvatar?: string;
  conversationId: string;
  content: string;
  date: string;
  isRead: boolean;
  sender?: User;
}

export interface Conversation {
  id: string;
  participants: User[];
  messages: Message[];
  createdAt: string;
  updatedAt: string;
  unreadCount?: number;
}

export interface ReadingProgress {
  storyId: string;
  chapterId: string;
  progressPercent: number;
  lastReadTime: string;
}

export type AppNotificationType = 'follow' | 'comment' | 'like' | 'favorite';

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
}

export interface ReadingGroup {
  id: string;
  name: string;
  description: string;
  members: string[]; // User IDs
  lastMessage?: string;
  lastMessageDate?: string;
  storyId?: string; // Tying group to a specific story
}

export interface GroupMessage {
  id: string;
  groupId: string;
  senderId: string;
  senderName: string;
  senderAvatar: string;
  content: string;
  date: string;
}

