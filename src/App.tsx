/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, Suspense } from 'react';
import { io, Socket } from 'socket.io-client';
import { 
  Sparkles, 
  BookOpen, 
  PenTool, 
  MessageSquare, 
  History, 
  Flame, 
  Compass, 
  CheckCircle, 
  Award,
  ChevronRight,
  TrendingUp,
  BookmarkCheck
} from 'lucide-react';
import { User, Story, Comment, Message, UserRole, Chapter, AppNotification, ReadingGroup, GroupMessage, Conversation } from './types';
import MainNavigation from './components/MainNavigation';
import LateralMenu from './components/LateralMenu';
// NB : vues importées en STATIQUE (un seul bundle). Le code-splitting (React.lazy
// + import dynamique) s'est révélé incompatible avec certaines WebView Android de
// l'APK (chunks non chargés → écran de lecture qui ne s'ouvre pas). La fiabilité
// de la lecture prime sur le gain de démarrage.
import ExplorerView from './components/ExplorerView';
import ReadingView from './components/ReadingView';
import WriteView from './components/WriteView';
import MessagesView from './components/MessagesView';
import ProfileView from './components/ProfileView';
import AdminDashboard from './components/AdminDashboard';
import AchievementsView from './components/AchievementsView';
import HomeView from './components/HomeView';
import AuthView from './components/AuthView';
import CallOverlay from './components/CallOverlay';
import GroupCallOverlay from './components/GroupCallOverlay';
import { CallManager, type CallStatus, type CallPeer } from './utils/webrtcCall';
import { GroupCallManager } from './utils/groupCall';
import { startRingtone, stopRingtone } from './utils/ringtone';
import { enqueueAction, flushQueue, queueLength, onQueueChange } from './utils/offlineQueue';
import { mergeServerStickers } from './utils/stickers';
import { initPushNotifications } from './utils/push';
import { Capacitor } from '@capacitor/core';
import PullToRefresh from './components/PullToRefresh';
import { calculateAge, isUserAgeAllowed } from './utils/age';
import { authHeaders as sharedAuthHeaders, setAuthToken, getAuthToken, restoreAuthToken } from './utils/auth';
import { API_BASE } from './utils/api';
import { 
  getUserStats,
  saveUserStats,
  UserStats,
  generateReaderAchievements,
  generateAuthorAchievements
} from './utils/achievements';

type RealtimeNotificationToast = {
  id: string;
  title: string;
  message: string;
  type?: string;
};

function mapServerNotificationType(type: string): AppNotification['type'] {
  const map: Record<string, AppNotification['type']> = {
    FOLLOW: 'follow',
    COMMENT: 'comment',
    LIKE: 'like',
    FAVORITE: 'favorite',
    FRIEND_REQUEST: 'friend',
    FRIEND_ACCEPTED: 'friend',
    MESSAGE: 'message',
    COMMENT_REPLY: 'comment',
    NEW_CHAPTER: 'comment',
  };
  return map[type] || 'follow';
}

function mapServerNotification(n: any): AppNotification {
  const data = n.data && typeof n.data === 'object' ? n.data : {};
  return {
    id: n.id,
    type: mapServerNotificationType(n.type),
    targetUserId: n.userId,
    actorId: data.actorId || '',
    actorName: data.actorName || n.title || 'PLUME',
    actorAvatar: data.actorAvatar || '',
    title: n.title || 'Notification',
    message: n.message || '',
    createdAt: n.createdAt ? new Date(n.createdAt).toISOString() : new Date().toISOString(),
    read: Boolean(n.isRead),
    storyId: data.storyId,
    storyTitle: data.storyTitle,
    chapterId: data.chapterId,
    commentId: data.commentId,
    excerpt: data.excerpt,
  };
}

export default function App() {
  
  // Custom State for Floating Premium Achievements Toasts
  const [unlockedToasts, setUnlockedToasts] = useState<any[]>([]);

  // Real-time notification toasts received through Socket.io
  const socketRef = useRef<Socket | null>(null);
  // Reflète isAuthenticated pour l'intercepteur 401 (évite la fausse alerte
  // « session expirée » pendant l'initialisation / hors session active).
  const isAuthenticatedRef = useRef<boolean>(false);

  // ----- Appels audio (WebRTC) -----
  const callManagerRef = useRef<CallManager | null>(null);
  const [callStatus, setCallStatus] = useState<CallStatus>('idle');
  const [callPeer, setCallPeer] = useState<CallPeer | null>(null);
  const [callRemoteStream, setCallRemoteStream] = useState<MediaStream | null>(null);

  // ----- Appels de GROUPE (mesh) -----
  const groupCallManagerRef = useRef<GroupCallManager | null>(null);
  const [groupCallId, setGroupCallId] = useState<string | null>(null);
  const [groupCallParticipants, setGroupCallParticipants] = useState<string[]>([]);
  const [groupCallInvite, setGroupCallInvite] = useState<{ groupId: string; from: string } | null>(null);

  // Présence en ligne (style WhatsApp) : IDs des utilisateurs réellement connectés.
  const [onlineUserIds, setOnlineUserIds] = useState<Set<string>>(new Set());
  // « En train d'écrire » : IDs des utilisateurs qui m'écrivent en ce moment.
  const [typingUserIds, setTypingUserIds] = useState<Set<string>>(new Set());
  const typingTimeoutsRef = useRef<Record<string, any>>({});
  // « En train d'écrire » dans un GROUPE : groupId → nom de l'auteur.
  const [groupTyping, setGroupTyping] = useState<Record<string, string>>({});
  const groupTypingTimeoutsRef = useRef<Record<string, any>>({});
  // Passe à true une fois le token restauré (natif) → évite d'ouvrir le socket
  // temps réel sans authentification au démarrage de l'app.
  const [tokenRestored, setTokenRestored] = useState(false);
  const [realtimeToasts, setRealtimeToasts] = useState<RealtimeNotificationToast[]>([]);

  // Notifications : chargées depuis l'API, mises en cache localStorage, enrichies via Socket.io.
  const [notifications, setNotifications] = useState<AppNotification[]>(() => {
    try {
      return JSON.parse(localStorage.getItem('plume_notifications') || '[]');
    } catch {
      return [];
    }
  });

  const saveNotifications = (nextNotifications: AppNotification[]) => {
    setNotifications(nextNotifications);
    localStorage.setItem('plume_notifications', JSON.stringify(nextNotifications));
  };

  const createLocalNotification = (notificationData: Omit<AppNotification, 'id' | 'createdAt' | 'read'>) => {
    if (!notificationData.targetUserId || notificationData.targetUserId === notificationData.actorId) return;

    const nextNotification: AppNotification = {
      ...notificationData,
      id: `notification_${Date.now()}_${Math.random().toString(36).slice(2)}`,
      createdAt: new Date().toISOString(),
      read: false,
    };

    saveNotifications([nextNotification, ...notifications].slice(0, 120));
  };

  // Database collection states populated strictly from Express backend APIs
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [stories, setStories] = useState<Story[]>([]);
  const [comments, setComments] = useState<Comment[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string>('');
  const activeConversationIdRef = React.useRef(activeConversationId);
  React.useEffect(() => {
    activeConversationIdRef.current = activeConversationId;
  }, [activeConversationId]);
  const [serverFriendIds, setServerFriendIds] = useState<string[]>([]);

  const [currentUser, setCurrentUser] = useState<User | null>(() => {
    try {
      const isLogged = localStorage.getItem('plume_is_logged_in') === 'true';
      if (isLogged) {
        const saved = localStorage.getItem('plume_current_user');
        if (saved) {
          const parsed = JSON.parse(saved);
          if (parsed && parsed.id) return parsed;
        }
      }
    } catch (e) {
      console.error('[PLUME] Erreur de lecture de plume_current_user depuis localStorage:', e);
    }
    return null;
  });

  const [groups, setGroups] = useState<ReadingGroup[]>(() => {
    try {
      const saved = localStorage.getItem('plume_reading_groups');
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.error(e);
    }
    if (localStorage.getItem('plume_is_logged_in') === 'true') {
      return [];
    }
    return [
      {
        id: 'group_fantasy',
        name: 'Alliance Littéraire Gothique',
        description: 'Pour débattre de romans gothiques, polar fantastique et de la poésie d’outre-tombe.',
        members: ['user_author', 'user_critic', 'user_rookie'],
        lastMessage: 'Avez-vous lu le chapitre 3 recommandé ?',
        lastMessageDate: new Date(Date.now() - 7200000).toISOString()
      },
      {
        id: 'group_cyber',
        name: 'Cyber & Dystopies Narratives',
        description: 'Prospective cyberpunk, IA et récits de science-fiction dystopiques.',
        members: ['user_author', 'user_scholar'],
        lastMessage: 'Atelier d’écriture SF programmé à demain !',
        lastMessageDate: new Date(Date.now() - 15000000).toISOString()
      }
    ];
  });

  const [groupMessages, setGroupMessages] = useState<GroupMessage[]>(() => {
    try {
      const saved = localStorage.getItem('plume_group_messages');
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.error(e);
    }
    if (localStorage.getItem('plume_is_logged_in') === 'true') {
      return [];
    }
    return [
      {
        id: 'group_init_1',
        groupId: 'group_fantasy',
        senderId: 'user_critic',
        senderName: 'Marie de France',
        senderAvatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&q=80&w=150',
        content: 'Bienvenue à tous dans notre salon de lecture gothique !',
        date: new Date(Date.now() - 14400000).toISOString()
      },
      {
        id: 'group_init_2',
        groupId: 'group_fantasy',
        senderId: 'user_rookie',
        senderName: 'Arthur Rimbaud',
        senderAvatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&q=80&w=150',
        content: 'Enchanté ! Hâte de confronter ma plume à vos avis éclairés.',
        date: new Date(Date.now() - 10800000).toISOString()
      },
      {
        id: 'group_init_3',
        groupId: 'group_fantasy',
        senderId: 'user_author',
        senderName: 'Molière',
        senderAvatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=crop&q=80&w=150',
        content: 'Avez-vous lu le chapitre 3 recommandé ?',
        date: new Date(Date.now() - 7200000).toISOString()
      }
    ];
  });


  // ── Groupes de lecture (persistés côté serveur) ─────────────────────────────
  const fetchGroups = async () => {
    try {
      const res = await fetch('/api/groups', { headers: authHeaders() });
      if (!res.ok) return;
      const data: ReadingGroup[] = await res.json();
      setGroups(data);
      const all: GroupMessage[] = [];
      for (const g of data) {
        try {
          const mres = await fetch(`/api/groups/${g.id}/messages`, { headers: authHeaders() });
          if (mres.ok) {
            const ms: GroupMessage[] = await mres.json();
            all.push(...ms);
          }
        } catch { /* ignore par groupe */ }
      }
      setGroupMessages(all);
    } catch (e) {
      console.error('[PLUME] Erreur chargement groupes :', e);
    }
  };

  const handleCreateGroup = async (payload: { name: string; description?: string; storyId?: string; memberIds?: string[] }): Promise<ReadingGroup | null> => {
    try {
      const res = await fetch('/api/groups', {
        method: 'POST',
        headers: authHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify(payload),
      });
      if (!res.ok) return null;
      const group: ReadingGroup = await res.json();
      setGroups((prev) => (prev.some((g) => g.id === group.id) ? prev : [group, ...prev]));
      return group;
    } catch (e) {
      console.error('[PLUME] Erreur création de groupe :', e);
      return null;
    }
  };

  const handleSendGroupMessage = async (groupId: string, content: string) => {
    try {
      const res = await fetch(`/api/groups/${groupId}/messages`, {
        method: 'POST',
        headers: authHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ content }),
      });
      if (!res.ok) return;
      const msg: GroupMessage = await res.json();
      setGroupMessages((prev) => (prev.some((m) => m.id === msg.id) ? prev : [...prev, msg]));
      setGroups((prev) => prev.map((g) => (g.id === groupId ? { ...g, lastMessage: msg.content, lastMessageDate: msg.date } : g)));
    } catch (e) {
      console.error('[PLUME] Erreur envoi message de groupe :', e);
    }
  };

  // ----- Gestion des groupes (façon WhatsApp) -----
  const handleUpdateGroup = async (groupId: string, data: { name?: string; description?: string; avatar?: string }) => {
    try {
      const res = await fetch(`/api/groups/${groupId}`, {
        method: 'PUT', headers: authHeaders({ 'Content-Type': 'application/json' }), body: JSON.stringify(data),
      });
      if (!res.ok) { let m = 'Modification impossible.'; try { const d = await res.json(); if (d.error) m = d.error; } catch {} alert(m); return; }
      const updated = await res.json();
      setGroups((prev) => prev.map((g) => (g.id === groupId ? { ...g, ...updated } : g)));
    } catch { alert('Erreur de connexion.'); }
  };
  const handleAddGroupMembers = async (groupId: string, memberIds: string[]) => {
    try {
      const res = await fetch(`/api/groups/${groupId}/members`, {
        method: 'POST', headers: authHeaders({ 'Content-Type': 'application/json' }), body: JSON.stringify({ memberIds }),
      });
      if (!res.ok) { let m = 'Ajout impossible.'; try { const d = await res.json(); if (d.error) m = d.error; } catch {} alert(m); return; }
      const updated = await res.json();
      setGroups((prev) => prev.map((g) => (g.id === groupId ? { ...g, ...updated } : g)));
    } catch { alert('Erreur de connexion.'); }
  };
  const handleRemoveGroupMember = async (groupId: string, userId: string) => {
    try {
      const res = await fetch(`/api/groups/${groupId}/members/${userId}`, { method: 'DELETE', headers: authHeaders() });
      if (!res.ok && res.status !== 204) { let m = 'Retrait impossible.'; try { const d = await res.json(); if (d.error) m = d.error; } catch {} alert(m); return; }
      if (userId === currentUser?.id) {
        setGroups((prev) => prev.filter((g) => g.id !== groupId));
      } else {
        setGroups((prev) => prev.map((g) => (g.id === groupId ? { ...g, members: (g.members || []).filter((id) => id !== userId) } : g)));
      }
    } catch { alert('Erreur de connexion.'); }
  };

  const handleMarkNotificationsRead = (type?: AppNotification['type'] | AppNotification['type'][] | 'all') => {
    if (!currentUser) return;
    const matchesType = (t: AppNotification['type']) =>
      !type || type === 'all' ? true : Array.isArray(type) ? type.includes(t) : t === type;
    const nextNotifications = notifications.map((notification) => {
      if (notification.targetUserId !== currentUser.id) return notification;
      if (matchesType(notification.type)) {
        return { ...notification, read: true };
      }
      return notification;
    });

    saveNotifications(nextNotifications);

    if (isAuthenticated) {
      fetch(`/api/notifications/${currentUser.id}/read-all`, {
        method: 'PUT',
        headers: authHeaders(),
      }).catch(() => {});
    }
  };

  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    return localStorage.getItem('plume_is_logged_in') === 'true';
  });

  // Charge les groupes de lecture (persistés côté serveur) à l'authentification.
  useEffect(() => {
    if (isAuthenticated) fetchGroups();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated]);

  // L'authentification repose sur un cookie httpOnly (rechargement) + un token
  // gardé en mémoire et envoyé en en-tête pour la session active. Le token
  // n'est jamais écrit dans localStorage (atténuation XSS).
  const authHeaders = (extra: Record<string, string> = {}) => sharedAuthHeaders(extra);

  // Synchronisation serveur d'une action IDEMPOTENTE, tolérante au hors-ligne :
  // si le réseau est absent ou que la requête échoue, on met l'action en file
  // (offlineQueue) ; elle sera rejouée automatiquement au retour de la connexion.
  // `key` fusionne les intentions contraires (ex. like puis unlike du même récit).
  const mutateServer = (
    method: 'POST' | 'PUT' | 'DELETE',
    path: string,
    body?: any,
    key?: string,
  ) => {
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      enqueueAction({ method, path, body, key });
      return;
    }
    fetch(path, {
      method,
      headers: authHeaders(body ? { 'Content-Type': 'application/json' } : {}),
      body: body ? JSON.stringify(body) : undefined,
    }).catch(() => enqueueAction({ method, path, body, key }));
  };

  // Progression de certification d'auteur calculée par le serveur (source de
  // vérité du badge), pour que ProfileView affiche un pourcentage cohérent.
  const [authorCertification, setAuthorCertification] = useState<{ authorPercent: number; authorUnlocked: number } | null>(null);
  useEffect(() => {
    if (!isAuthenticated) { setAuthorCertification(null); return; }
    fetch('/api/me/certification', { headers: authHeaders() })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => { if (data) setAuthorCertification({ authorPercent: data.authorPercent, authorUnlocked: data.authorUnlocked }); })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, currentUser?.id, currentUser?.isVerified]);

  const fetchConversationsList = React.useCallback(() => {
    fetch('/api/conversations', { headers: authHeaders() })
      .then(res => {
        if (res.ok) return res.json();
      })
      .then(fetched => {
        if (fetched) {
          setConversations(fetched.map((c: any) => ({
            ...c,
            messages: (c.messages || []).map((m: any) => ({
              ...m,
              date: m.createdAt
            }))
          })));
        }
      })
      .catch(err => console.error(err));
  }, [isAuthenticated, currentUser?.id]);


  const getLocalUserEdits = (): Record<string, Partial<User>> => {
    try {
      return JSON.parse(localStorage.getItem('plume_user_edits_by_id') || '{}');
    } catch {
      return {};
    }
  };

  const saveLocalUserEdit = (user: User) => {
    const edits = getLocalUserEdits();
    edits[user.id] = {
      ...(edits[user.id] || {}),
      ...user,
    };
    localStorage.setItem('plume_user_edits_by_id', JSON.stringify(edits));
    localStorage.setItem('plume_current_user', JSON.stringify(user));
  };

  const mergeLocalUserEdit = (user: User, isBackendUser: boolean = false): User => {
    const edits = getLocalUserEdits();
    const hasToken = localStorage.getItem('plume_is_logged_in') === 'true';
    const shouldSkipLocalMerge = hasToken && isBackendUser;

    if (shouldSkipLocalMerge) {
      const { followers, following, favoriteGenres, ...otherEdits } = edits[user.id] || {};
      return {
        ...user,
        ...otherEdits,
      };
    }

    return {
      ...user,
      ...(edits[user.id] || {}),
      followers: (edits[user.id]?.followers as string[] | undefined) || user.followers || [],
      following: (edits[user.id]?.following as string[] | undefined) || user.following || [],
      favoriteGenres: (edits[user.id]?.favoriteGenres as string[] | undefined) || user.favoriteGenres || [],
    };
  };

  // Applique les éditions locales aux comptes RÉELS du backend. (Les anciens
  // comptes de démonstration/testeurs ont été retirés : l'app n'affiche plus que
  // de vrais utilisateurs.)
  const ensureSimulatorAccounts = (backendUsers: User[]): User[] => {
    // On filtre toute entrée invalide (null/undefined/sans id) : un seul élément
    // corrompu ferait planter les rendus qui lisent `u.role` (écran noir).
    return (Array.isArray(backendUsers) ? backendUsers : [])
      .map(u => mergeLocalUserEdit(u, true))
      .filter((u: any): u is User => !!u && !!u.id);
  };

  const getLikedStoriesStorageKey = (userId: string) => `plume_liked_stories_${userId}`;
  const getFavoritesStorageKey = (userId: string) => `plume_favorites_${userId}`;

  // Listes de lecture : autrefois stockées sous des clés localStorage GLOBALES,
  // ce qui les faisait fuiter d'un compte à l'autre sur un même navigateur. On
  // les scope désormais par utilisateur, comme les favoris/likes.
  const getCurrentlyReadingStorageKey = (userId: string) => `plume_currently_reading_${userId}`;
  const getCompletedStorageKey = (userId: string) => `plume_completed_${userId}`;
  const getReadLaterStorageKey = (userId: string) => `plume_read_later_${userId}`;
  const getReadChaptersStorageKey = (userId: string) => `plume_read_chapters_${userId}`;
  const getLastReadProgressStorageKey = (userId: string) => `plume_last_read_progress_${userId}`;
  const getActiveInterlocutorStorageKey = (userId: string) => `plume_active_interlocutor_id_${userId}`;

  // Lit une valeur scopée par utilisateur. Si elle est absente mais qu'une
  // ancienne clé globale existe, on migre sa valeur vers la clé par utilisateur
  // puis on supprime la clé globale (évite toute fuite vers un autre compte).
  const readUserScopedValue = <T,>(perUserKey: string, legacyGlobalKey: string, fallback: T): T => {
    try {
      const scoped = localStorage.getItem(perUserKey);
      if (scoped !== null) return JSON.parse(scoped);
      const legacy = localStorage.getItem(legacyGlobalKey);
      if (legacy !== null) {
        localStorage.removeItem(legacyGlobalKey);
        return JSON.parse(legacy);
      }
    } catch (e) {
      console.error(e);
    }
    return fallback;
  };

  const STORY_LIKERS_STORAGE_KEY = 'plume_story_likers_by_story';
  const COMMENT_LIKERS_STORAGE_KEY = 'plume_comment_likers_by_comment';
  const STORY_FAVORITERS_STORAGE_KEY = 'plume_story_favoriters_by_story';
  const STORY_VIEWERS_STORAGE_KEY = 'plume_story_viewers_by_story';

  const readLikeMap = (storageKey: string): Record<string, string[]> => {
    try {
      const parsed = JSON.parse(localStorage.getItem(storageKey) || '{}');
      if (!parsed || typeof parsed !== 'object') return {};

      return Object.entries(parsed).reduce<Record<string, string[]>>((acc, [itemId, userIds]) => {
        acc[itemId] = Array.isArray(userIds)
          ? Array.from(new Set(userIds.filter((id): id is string => typeof id === 'string')))
          : [];
        return acc;
      }, {});
    } catch {
      return {};
    }
  };

  const saveLikeMap = (storageKey: string, likeMap: Record<string, string[]>) => {
    localStorage.setItem(storageKey, JSON.stringify(likeMap));
  };

  const createLegacyLikeIds = (prefix: string, itemId: string, count: number) => {
    return Array.from({ length: Math.max(0, count || 0) }, (_, index) => `${prefix}_${itemId}_${index}`);
  };

  const mergeLikeIds = (...lists: (string[] | undefined)[]) => {
    return Array.from(
      new Set(
        lists
          .flatMap((list) => Array.isArray(list) ? list : [])
          .filter((id): id is string => typeof id === 'string' && id.trim().length > 0)
      )
    );
  };

  const normalizeStoryLikesFromStorage = (story: Story): Story => {
    const likeMap = readLikeMap(STORY_LIKERS_STORAGE_KEY);
    const storedLikedBy = likeMap[story.id];
    const storyLikedBy = Array.isArray(story.likedBy) ? story.likedBy : [];

    const likedBy = storedLikedBy
      ? mergeLikeIds(storedLikedBy, storyLikedBy)
      : storyLikedBy.length > 0
        ? storyLikedBy
        : createLegacyLikeIds('legacy_story_like', story.id, story.likes || 0);

    likeMap[story.id] = likedBy;
    saveLikeMap(STORY_LIKERS_STORAGE_KEY, likeMap);

    return {
      ...story,
      likedBy,
      likes: likedBy.length,
    };
  };

  const normalizeStoryFavoritesFromStorage = (story: Story): Story => {
    const favoriteMap = readLikeMap(STORY_FAVORITERS_STORAGE_KEY);
    const storedFavoritedBy = favoriteMap[story.id];
    const storyFavoritedBy = Array.isArray(story.favoritedBy) ? story.favoritedBy : [];

    const favoritedBy = storedFavoritedBy
      ? mergeLikeIds(storedFavoritedBy, storyFavoritedBy)
      : storyFavoritedBy.length > 0
        ? storyFavoritedBy
        : createLegacyLikeIds('legacy_story_favorite', story.id, story.favoritesCount || 0);

    favoriteMap[story.id] = favoritedBy;
    saveLikeMap(STORY_FAVORITERS_STORAGE_KEY, favoriteMap);

    return {
      ...story,
      favoritedBy,
      favoritesCount: favoritedBy.length,
    };
  };

  const normalizeStoryViewsFromStorage = (story: Story): Story => {
    const viewMap = readLikeMap(STORY_VIEWERS_STORAGE_KEY);
    const storedViewedBy = viewMap[story.id];
    const storyViewedBy = Array.isArray(story.viewedBy) ? story.viewedBy : [];

    const viewedBy = storedViewedBy
      ? mergeLikeIds(storedViewedBy, storyViewedBy)
      : storyViewedBy.length > 0
        ? storyViewedBy
        : createLegacyLikeIds('legacy_story_view', story.id, story.views || 0);

    viewMap[story.id] = viewedBy;
    saveLikeMap(STORY_VIEWERS_STORAGE_KEY, viewMap);

    return {
      ...story,
      viewedBy,
      views: viewedBy.length,
    };
  };

  const normalizeCommentLikesFromStorage = (comment: Comment): Comment => {
    const likeMap = readLikeMap(COMMENT_LIKERS_STORAGE_KEY);
    const storedLikedBy = likeMap[comment.id];
    const commentLikedBy = Array.isArray(comment.likedBy) ? comment.likedBy : [];

    const likedBy = storedLikedBy
      ? mergeLikeIds(storedLikedBy, commentLikedBy)
      : commentLikedBy.length > 0
        ? commentLikedBy
        : createLegacyLikeIds('legacy_comment_like', comment.id, comment.likes || 0);

    likeMap[comment.id] = likedBy;
    saveLikeMap(COMMENT_LIKERS_STORAGE_KEY, likeMap);

    return {
      ...comment,
      likedBy,
      likes: likedBy.length,
      likedByMe: currentUser ? likedBy.includes(currentUser.id) : false,
    };
  };


  useEffect(() => {
    if (!isAuthenticated || !currentUser?.id) return;
    // Sur natif (APK), l'auth socket repose UNIQUEMENT sur le token (pas de
    // cookie cross-origin). On attend donc que le token soit restauré avant
    // d'ouvrir le socket, sinon il se connecte sans token, est rejeté, et ne
    // se reconnecte jamais → ni présence, ni messages, ni abonnements en direct.
    if (Capacitor.isNativePlatform() && !getAuthToken()) return;

    const socket = io(API_BASE || window.location.origin, {
      transports: ['websocket', 'polling'],
      // Authentification via le token mémoire (handshake) et/ou le cookie
      // httpOnly envoyé automatiquement. Le serveur n'autorise que la room
      // correspondant à l'utilisateur authentifié.
      auth: { token: getAuthToken() || '' },
      withCredentials: true,
    });

    socketRef.current = socket;
    
    const joinRoom = () => {
      if (currentUser?.id) {
        socket.emit('join', currentUser.id);
      }
    };

    if (socket.connected) {
      joinRoom();
    }

    socket.on('connect', joinRoom);

    socket.on('new_notification', (notification: any) => {
      const mapped = mapServerNotification(notification);
      setNotifications((prev) => {
        const next = [mapped, ...prev.filter((n) => n.id !== mapped.id)].slice(0, 120);
        localStorage.setItem('plume_notifications', JSON.stringify(next));
        return next;
      });

      const toastId = mapped.id;
      const nextToast: RealtimeNotificationToast = {
        id: toastId,
        title: mapped.title || 'Nouvelle notification',
        message: mapped.message || 'Vous avez une nouvelle activité sur PLUME.',
        type: mapped.type,
      };

      setRealtimeToasts((prev) => [nextToast, ...prev].slice(0, 4));

      window.setTimeout(() => {
        setRealtimeToasts((prev) => prev.filter((toast) => toast.id !== toastId));
      }, 6000);
    });

    socket.on('conversation_created', (conversation: any) => {
      setConversations((prev) => {
        if (prev.some((c) => c.id === conversation.id)) return prev;
        return [{ ...conversation, messages: [] }, ...prev];
      });
    });

    socket.on('new_message', (message: Message) => {
      if (message.senderId === (currentUser?.id || '')) return;

      // Accusé de distribution (2 plumes blanches côté expéditeur).
      socket.emit('message_ack', { messageId: message.id, senderId: message.senderId });

      const isCurrentActive = message.conversationId === activeConversationIdRef.current;

      if (isCurrentActive) {
        // Mark as read immediately on the server
        fetch('/api/messages/read', {
          method: 'PUT',
          headers: authHeaders({ 'Content-Type': 'application/json' }),
          body: JSON.stringify({ conversationId: message.conversationId })
        }).catch(e => console.error('[PLUME] Erreur marquage lu message temps réel :', e));
      }

      setConversations((prev) => {
        const convIndex = prev.findIndex((c) => c.id === message.conversationId);
        if (convIndex === -1) {
          fetchConversationsList();
          return prev;
        }
        const conv = prev[convIndex];
        if (conv.messages.some((m) => m.id === message.id)) return prev;

        const updatedConv = {
          ...conv,
          updatedAt: message.createdAt || new Date().toISOString(),
          messages: [...conv.messages, { ...message, isRead: isCurrentActive, date: message.createdAt }],
          unreadCount: (conv.unreadCount || 0) + (isCurrentActive ? 0 : 1)
        };

        const next = [...prev];
        next[convIndex] = updatedConv;
        return next.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
      });
    });

    socket.on('messages_read', (payload: { conversationId: string; readerId: string }) => {
      setConversations((prev) => prev.map((c) => {
        if (c.id === payload.conversationId) {
          return {
            ...c,
            unreadCount: payload.readerId === (currentUser?.id || '') ? 0 : c.unreadCount,
            // Le lecteur a lu les messages des AUTRES : on les passe en « lu »
            // (plume violette) côté expéditeur. (Avant : mauvaise condition.)
            messages: c.messages.map((m) => m.senderId !== payload.readerId ? { ...m, isRead: true } : m)
          };
        }
        return c;
      }));
    });

    socket.on('message_delivered', ({ messageIds }: { messageIds: string[] }) => {
      if (!Array.isArray(messageIds) || !messageIds.length) return;
      const idSet = new Set(messageIds);
      setConversations((prev) => prev.map((c) => ({
        ...c,
        messages: c.messages.map((m) => idSet.has(m.id) ? { ...m, isDelivered: true } : m),
      })));
    });

    // Compteurs de récit (likes/favoris) en temps réel → la stat « Mentions »
    // du profil se met à jour sans rafraîchissement.
    socket.on('story_stats', ({ storyId, likes, favoritesCount }: { storyId: string; likes: number; favoritesCount: number }) => {
      setStories((prev) => prev.map((s) => s.id === storyId ? { ...s, likes, favoritesCount } : s));
    });

    socket.on('user_followed', () => {
      refreshUsersData();
    });

    socket.on('user_unfollowed', () => {
      refreshUsersData();
    });

    socket.on('conversation_deleted', ({ conversationId }: { conversationId: string }) => {
      setConversations((prev) => prev.filter((c) => c.id !== conversationId));
      setActiveConversationId((prev) => (prev === conversationId ? '' : prev));
    });

    // Présence : liste initiale + mises à jour individuelles.
    socket.on('presence_list', (ids: string[]) => {
      setOnlineUserIds(new Set(Array.isArray(ids) ? ids : []));
    });
    socket.on('presence_update', ({ userId, online }: { userId: string; online: boolean }) => {
      setOnlineUserIds((prev) => {
        const next = new Set(prev);
        if (online) next.add(userId); else next.delete(userId);
        return next;
      });
    });

    // « En train d'écrire » : on ajoute l'expéditeur et on l'enlève
    // automatiquement après un court délai (sécurité si stop_typing se perd).
    const clearTyping = (senderId: string) => setTypingUserIds((prev) => {
      if (!prev.has(senderId)) return prev;
      const next = new Set(prev); next.delete(senderId); return next;
    });
    socket.on('typing', ({ senderId }: { senderId: string }) => {
      if (!senderId) return;
      setTypingUserIds((prev) => prev.has(senderId) ? prev : new Set(prev).add(senderId));
      clearTimeout(typingTimeoutsRef.current[senderId]);
      typingTimeoutsRef.current[senderId] = setTimeout(() => clearTyping(senderId), 5000);
    });
    socket.on('stop_typing', ({ senderId }: { senderId: string }) => {
      if (!senderId) return;
      clearTimeout(typingTimeoutsRef.current[senderId]);
      clearTyping(senderId);
    });

    socket.on('group_created', (group: ReadingGroup) => {
      setGroups((prev) => (prev.some((g) => g.id === group.id) ? prev : [group, ...prev]));
    });

    socket.on('group_updated', (group: ReadingGroup) => {
      setGroups((prev) => prev.map((g) => (g.id === group.id ? { ...g, ...group } : g)));
    });
    socket.on('group_removed', ({ groupId }: { groupId: string }) => {
      setGroups((prev) => prev.filter((g) => g.id !== groupId));
    });
    socket.on('group_typing', ({ groupId, senderName }: { groupId: string; senderName?: string }) => {
      if (!groupId) return;
      setGroupTyping((prev) => ({ ...prev, [groupId]: senderName || 'Quelqu’un' }));
      clearTimeout(groupTypingTimeoutsRef.current[groupId]);
      groupTypingTimeoutsRef.current[groupId] = setTimeout(() => {
        setGroupTyping((prev) => { const n = { ...prev }; delete n[groupId]; return n; });
      }, 5000);
    });
    socket.on('group_stop_typing', ({ groupId }: { groupId: string }) => {
      if (!groupId) return;
      clearTimeout(groupTypingTimeoutsRef.current[groupId]);
      setGroupTyping((prev) => { const n = { ...prev }; delete n[groupId]; return n; });
    });

    socket.on('new_group_message', (msg: GroupMessage) => {
      setGroupMessages((prev) => (prev.some((m) => m.id === msg.id) ? prev : [...prev, msg]));
      setGroups((prev) => prev.map((g) => (g.id === msg.groupId ? { ...g, lastMessage: msg.content, lastMessageDate: msg.date } : g)));
    });

    // Gestionnaire d'appels audio : relié au même socket (signalisation).
    callManagerRef.current = new CallManager(socket, {
      onStatus: (s) => { setCallStatus(s); if (s === 'idle') { setCallPeer(null); setCallRemoteStream(null); } },
      onIncoming: (peer) => setCallPeer(peer),
      onRemoteStream: (stream) => setCallRemoteStream(stream),
      onError: (msg) => { setCallStatus('idle'); setCallPeer(null); setCallRemoteStream(null); alert(msg); },
    });

    // Appels de groupe (mesh).
    groupCallManagerRef.current = new GroupCallManager(socket, {
      onActive: (active) => setGroupCallId(active ? groupCallManagerRef.current?.currentGroupId ?? null : null),
      onParticipants: (ids) => setGroupCallParticipants(ids),
      onError: (msg) => { alert(msg); setGroupCallId(null); setGroupCallParticipants([]); },
    });
    socket.on('group_call:invite', ({ groupId, from }: { groupId: string; from: string }) => {
      // On ne propose de rejoindre que si on n'est pas déjà dans cet appel.
      if (groupCallManagerRef.current?.currentGroupId === groupId) return;
      setGroupCallInvite({ groupId, from });
    });

    return () => {
      socket.off('group_call:invite');
      socket.off('connect');
      socket.off('new_notification');
      socket.off('conversation_created');
      socket.off('new_message');
      socket.off('messages_read');
      socket.off('user_followed');
      socket.off('user_unfollowed');
      socket.off('conversation_deleted');
      socket.off('presence_list');
      socket.off('presence_update');
      socket.off('typing');
      socket.off('stop_typing');
      socket.off('message_delivered');
      socket.off('story_stats');
      socket.off('group_created');
      socket.off('group_updated');
      socket.off('group_removed');
      socket.off('group_typing');
      socket.off('group_stop_typing');
      socket.off('new_group_message');
      callManagerRef.current?.dispose();
      groupCallManagerRef.current?.dispose();
      groupCallManagerRef.current = null;
      callManagerRef.current = null;
      socket.disconnect();
      socketRef.current = null;
    };
  }, [isAuthenticated, currentUser?.id, tokenRestored]);

  // Démarre un appel audio sortant vers un utilisateur.
  const handleStartCall = React.useCallback((peer: { id: string; username?: string; avatar?: string }) => {
    if (!callManagerRef.current || !currentUser) { alert("L'appel audio n'est pas disponible (connexion temps réel absente)."); return; }
    if (callStatus !== 'idle') return;
    setCallPeer({ id: peer.id, name: peer.username, avatar: peer.avatar });
    callManagerRef.current.startCall(
      { id: peer.id, name: peer.username, avatar: peer.avatar },
      { id: currentUser.id, name: currentUser.username, avatar: currentUser.avatar },
    );
  }, [callStatus, currentUser]);

  // Appels de groupe : démarrer / rejoindre / quitter.
  const handleStartGroupCall = (groupId: string, memberIds: string[]) => {
    if (!groupCallManagerRef.current) { alert("L'appel de groupe n'est pas disponible."); return; }
    groupCallManagerRef.current.join(groupId, memberIds);
  };
  const acceptGroupCall = () => {
    if (!groupCallInvite || !groupCallManagerRef.current) return;
    const group = groups.find((g) => g.id === groupCallInvite.groupId);
    groupCallManagerRef.current.join(groupCallInvite.groupId, group?.members || []);
    setGroupCallInvite(null);
  };
  const leaveGroupCall = () => {
    groupCallManagerRef.current?.leave();
    setGroupCallId(null);
    setGroupCallParticipants([]);
  };

  // Sonnerie + vibration tant qu'un appel ENTRANT n'est pas pris/refusé (1:1 ou
  // groupe). S'arrête dès que l'appel est accepté, refusé ou terminé.
  useEffect(() => {
    const incoming = callStatus === 'incoming' || !!groupCallInvite;
    if (incoming) startRingtone();
    else stopRingtone();
    return () => stopRingtone();
  }, [callStatus, groupCallInvite]);

  // Détection hors-ligne : on prévient l'utilisateur quand le réseau tombe
  // (l'app reste utilisable en lecture grâce aux livres téléchargés + caches).
  const [isOffline, setIsOffline] = useState<boolean>(() => typeof navigator !== 'undefined' && navigator.onLine === false);
  const [pendingActions, setPendingActions] = useState<number>(() => queueLength());
  useEffect(() => {
    const goOnline = () => { setIsOffline(false); flushQueue(); };
    const goOffline = () => setIsOffline(true);
    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);
    // Suit le nombre d'actions en attente (pour le bandeau) + rejeu au démarrage.
    const off = onQueueChange(setPendingActions);
    flushQueue();
    return () => {
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
      off();
    };
  }, []);

  // Rejeu de la file dès que la session est prête (token disponible).
  useEffect(() => {
    if (isAuthenticated && currentUser?.id) flushQueue();
  }, [isAuthenticated, currentUser?.id]);

  const [favorites, setFavorites] = useState<string[]>(() => {
    if (!currentUser?.id) return ['story_cosmos_1'];
    // Clé par utilisateur, avec migration de l'ancienne clé globale `plume_favorites`.
    return readUserScopedValue(getFavoritesStorageKey(currentUser.id), 'plume_favorites', ['story_cosmos_1']);
  });

  const [likedStories, setLikedStories] = useState<string[]>(() => {
    if (!currentUser?.id) return [];
    try {
      const saved = localStorage.getItem(getLikedStoriesStorageKey(currentUser.id));
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    if (!currentUser?.id) return;
    try {
      const savedLikes = localStorage.getItem(getLikedStoriesStorageKey(currentUser.id));
      setLikedStories(savedLikes ? JSON.parse(savedLikes) : []);
    } catch (e) {
      console.error(e);
    }
  }, [currentUser?.id]);

  useEffect(() => {
    if (!currentUser?.id) return;
    setFavorites(readUserScopedValue<string[]>(getFavoritesStorageKey(currentUser.id), 'plume_favorites', []));
  }, [currentUser?.id]);

  const [currentlyReading, setCurrentlyReading] = useState<string[]>(() => {
    if (!currentUser?.id) return ['story_cosmos_1']; // Seeded first book
    return readUserScopedValue(getCurrentlyReadingStorageKey(currentUser.id), 'plume_currently_reading', ['story_cosmos_1']);
  });

  const [completedStories, setCompletedStories] = useState<string[]>(() => {
    if (!currentUser?.id) return [];
    return readUserScopedValue<string[]>(getCompletedStorageKey(currentUser.id), 'plume_completed', []);
  });

  const [readLater, setReadLater] = useState<string[]>(() => {
    if (!currentUser?.id) return [];
    return readUserScopedValue<string[]>(getReadLaterStorageKey(currentUser.id), 'plume_read_later', []);
  });

  const [readChapters, setReadChapters] = useState<string[]>(() => {
    if (!currentUser?.id) return [];
    return readUserScopedValue<string[]>(getReadChaptersStorageKey(currentUser.id), 'plume_read_chapters', []);
  });

  const [lastReadProgress, setLastReadProgress] = useState<{ storyId: string; chapterId: string } | null>(() => {
    if (!currentUser?.id) return null;
    return readUserScopedValue<{ storyId: string; chapterId: string } | null>(getLastReadProgressStorageKey(currentUser.id), 'plume_last_read_progress', null);
  });

  // UI state variables
  const [activeTab, setActiveTab] = useState<'home' | 'explore' | 'write' | 'messages' | 'profile' | 'admin' | 'achievements'>('home');
  const [activeInterlocutorId, setActiveInterlocutorId] = useState<string>(() => {
    if (!currentUser?.id) return 'user_author';
    const scopedKey = getActiveInterlocutorStorageKey(currentUser.id);
    const scoped = localStorage.getItem(scopedKey);
    if (scoped !== null) return scoped;
    // Migration de l'ancienne clé globale (valeur brute, pas du JSON).
    const legacy = localStorage.getItem('plume_active_interlocutor_id');
    if (legacy !== null) {
      localStorage.removeItem('plume_active_interlocutor_id');
      return legacy;
    }
    return 'user_author';
  });

  // Recharge les listes de lecture propres à l'utilisateur lors d'un changement
  // de compte (connexion/déconnexion sur le même navigateur).
  useEffect(() => {
    if (!currentUser?.id) return;
    setCurrentlyReading(readUserScopedValue(getCurrentlyReadingStorageKey(currentUser.id), 'plume_currently_reading', ['story_cosmos_1']));
    setCompletedStories(readUserScopedValue<string[]>(getCompletedStorageKey(currentUser.id), 'plume_completed', []));
    setReadLater(readUserScopedValue<string[]>(getReadLaterStorageKey(currentUser.id), 'plume_read_later', []));
    setReadChapters(readUserScopedValue<string[]>(getReadChaptersStorageKey(currentUser.id), 'plume_read_chapters', []));
    setLastReadProgress(readUserScopedValue<{ storyId: string; chapterId: string } | null>(getLastReadProgressStorageKey(currentUser.id), 'plume_last_read_progress', null));
  }, [currentUser?.id]);

  const handleOpenDiscussion = async (userId: string) => {
    if (!currentUser?.id || userId === currentUser.id) return;
    setSelectedStoryForReading(null); // Leave reading screen in order to view messages
    setActiveTab('messages');

    // Look for an existing 1-to-1 conversation with this user
    const existing = conversations.find(c => {
      const pIds = c.participants.map(p => p.id);
      return pIds.length === 2 && pIds.includes(userId) && pIds.includes(currentUser.id);
    });

    if (existing) {
      setActiveConversationId(existing.id);
    } else {
      try {
        const newConv = await handleStartConversation([userId]);
        if (newConv) {
          setActiveConversationId(newConv.id);
        }
      } catch (err: any) {
        console.error('[CONVERSATION] Erreur démarrage discussion :', err);
        alert(`Impossible de démarrer la conversation : ${err.message || 'erreur serveur'}`);
      }
    }
  };

  const [activeFilter, setActiveFilter] = useState<{ type: string; value: string } | null>(null);
  const [selectedStoryForReading, setSelectedStoryForReading] = useState<Story | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [viewedUser, setViewedUser] = useState<User | null>(null);

  const handleViewUserProfile = (userId: string) => {
    const target = allUsers.find(u => u.id === userId) || (userId === currentUser?.id ? currentUser : null);
    if (target) {
      setViewedUser(target);
      setSelectedStoryForReading(null); // Leave reading mode when switching to a profile
      setActiveTab('profile');
    }
  };

  // Ouvre l'élément pertinent depuis l'onglet Notifications.
  const handleOpenNotification = (n: AppNotification) => {
    if (!n) return;
    if (n.type === 'message') {
      // Ouvre la conversation avec l'expéditeur (messagerie).
      if (n.actorId) handleOpenDiscussion(n.actorId);
      return;
    }
    if (n.type === 'follow' || n.type === 'friend') {
      if (n.actorId) handleViewUserProfile(n.actorId);
      return;
    }
    // commentaire / like / favori : ouvrir le récit concerné, sinon le profil.
    if (n.storyId) {
      const story = stories.find(s => s.id === n.storyId);
      if (story) { handleSelectStoryForReading(story); return; }
    }
    if (n.actorId) handleViewUserProfile(n.actorId);
  };

  const [darkMode, setDarkMode] = useState<boolean>(() => {
    const saved = localStorage.getItem('plume_dark_mode');
    return saved ? JSON.parse(saved) : false; // Thème CLAIR par défaut (choix produit).
  });

  // Gestion du bouton retour physique Android (déclenché depuis utils/native).
  // On ferme l'élément ouvert le plus prioritaire ; si rien n'est ouvert, on
  // renvoie false pour laisser l'app se fermer.
  useEffect(() => {
    (window as any).__plumeHandleBack = (): boolean => {
      if (isSidebarOpen) { setIsSidebarOpen(false); return true; }
      if (selectedStoryForReading) { setSelectedStoryForReading(null); return true; }
      if (viewedUser) { setViewedUser(null); return true; }
      if (activeTab !== 'home') { setActiveTab('home'); return true; }
      return false;
    };
    return () => { delete (window as any).__plumeHandleBack; };
  }, [isSidebarOpen, selectedStoryForReading, viewedUser, activeTab]);

  const refreshUsersData = async () => {
    try {
      // Envoi du token : le backend n'inclut les emails que pour un administrateur.
      const usersRes = await fetch('/api/users', { headers: authHeaders() });
      if (usersRes.ok) {
        const fetchedUsers = await usersRes.json();
        const mergedUsers = ensureSimulatorAccounts(fetchedUsers as User[]);
        setAllUsers(mergedUsers);
        
        const loggedIn = localStorage.getItem('plume_is_logged_in') === 'true';
        if (loggedIn) {
          // Le cookie httpOnly est envoyé automatiquement ; /auth/me confirme la session.
          const meRes = await fetch('/api/auth/me', { headers: authHeaders() });
          if (meRes.ok) {
            const me = mergeLocalUserEdit(await meRes.json(), true);
            if (me && me.id) {
              setCurrentUser(me);
              localStorage.setItem('plume_current_user', JSON.stringify(me));
              setIsAuthenticated(true);
              return me;
            }
            // Réponse inexploitable : on retombe sur l'utilisateur en cache si possible.
            const cached = mergedUsers.find((u: User) => u.id === currentUser?.id);
            if (cached) setCurrentUser(cached);
          } else if (meRes.status === 401) {
            localStorage.removeItem('plume_auth_token');
            setIsAuthenticated(false);
          }
        } else {
          const savedCurrentUser = localStorage.getItem('plume_current_user');
          if (savedCurrentUser) {
            const parsed = JSON.parse(savedCurrentUser) as User;
            const freshUser = mergedUsers.find((u: User) => u.id === parsed.id);
            if (freshUser) setCurrentUser(freshUser);
          }
        }
      }
    } catch (err) {
      console.error('[PLUME] Erreur de rafraîchissement des utilisateurs', err);
    }
    return null;
  };

  // Fetch initial data from Express API on first load
  useEffect(() => {
    const fetchApiData = async () => {
      try {
        // 0. Natif : réhydrate le token persistant avant tout appel authentifié
        //    (le cookie httpOnly n'existe pas hors web same-origin).
        await restoreAuthToken();
        // Le token mémoire est prêt → débloque la (re)connexion du socket temps
        // réel, qui sinon démarrerait sans token et resterait non authentifié.
        setTokenRestored(true);

        // 1. Fetch Users & Me
        const me = await refreshUsersData();
        const loggedIn = localStorage.getItem('plume_is_logged_in') === 'true';
        const headers = authHeaders();

        if (loggedIn && me) {
          const notifRes = await fetch(`/api/notifications/${me.id}`, { headers });
          if (notifRes.ok) {
            const serverNotifs = await notifRes.json();
            const mapped = serverNotifs.map(mapServerNotification).slice(0, 120);
            setNotifications(mapped);
            localStorage.setItem('plume_notifications', JSON.stringify(mapped));
          }

          const favRes = await fetch('/api/me/favorites', { headers });
          if (favRes.ok) {
            const favStories = await favRes.json();
            const favIds = favStories.map((s: Story) => s.id);
            setFavorites(favIds);
            localStorage.setItem(getFavoritesStorageKey(me.id), JSON.stringify(favIds));
          }

          const histRes = await fetch('/api/me/history', { headers });
          if (histRes.ok) {
            const history = await histRes.json();
            const readKeys = history
              .filter((h: any) => h.chapterId)
              .map((h: any) => `${me.id}:${h.storyId}:${h.chapterId}`);
            if (readKeys.length) setReadChapters(readKeys);
            const latest = history[0];
            if (latest?.storyId && latest?.chapterId) {
              setLastReadProgress({ storyId: latest.storyId, chapterId: latest.chapterId });
            }
          }

          const friendsRes = await fetch('/api/friends', { headers });
          if (friendsRes.ok) {
            const friendsUsers = await friendsRes.json();
            setServerFriendIds(friendsUsers.map((u: User) => u.id));
          }
        }

        // 2. Fetch Stories
        const storiesRes = await fetch('/api/stories');
        if (storiesRes.ok) {
          const fetchedStories = await storiesRes.json();
          setStories(fetchedStories.map((story: Story) => normalizeStoryViewsFromStorage(normalizeStoryFavoritesFromStorage(normalizeStoryLikesFromStorage(story)))));
        }

        // 3. Fetch Comments
        const commentsRes = await fetch('/api/comments');
        if (commentsRes.ok) {
          const fetchedComments = await commentsRes.json();
          setComments(fetchedComments.map((comment: Comment) => normalizeCommentLikesFromStorage(comment)));
        }

        // 4. Fetch Conversations
        fetchConversationsList();
      } catch (err) {
        console.error('[PLUME] Erreur de chargement des données depuis l\'API backend, secours local activé.', err);
      }
    };
    fetchApiData();
  }, []);

  // Load full messages when selecting a conversation
  useEffect(() => {
    if (!activeConversationId) return;

    fetch(`/api/conversations/${activeConversationId}/messages`, { headers: authHeaders() })
      .then(res => {
        if (res.ok) return res.json();
      })
      .then(fetchedMessages => {
        if (fetchedMessages) {
          setConversations(prev => prev.map(c => {
            if (c.id === activeConversationId) {
              return {
                ...c,
                messages: fetchedMessages.map((m: any) => ({
                  ...m,
                  date: m.createdAt
                }))
              };
            }
            return c;
          }));
        }
      })
      .catch(err => console.error('[PLUME] Erreur chargement messages conversation:', err));
  }, [activeConversationId]);

  // Synchronizers to local storage for navigation preferences and session state
  useEffect(() => {
    // À la déconnexion (currentUser === null) on supprime la clé au lieu d'y
    // écrire la chaîne "null", qui réintroduisait un état incohérent au montage.
    if (currentUser) {
      localStorage.setItem('plume_current_user', JSON.stringify(currentUser));
    } else {
      localStorage.removeItem('plume_current_user');
    }
  }, [currentUser]);

  // Stickers persistés : on fusionne ceux du serveur dans le stockage local dès
  // que le profil est charge -> ils reviennent apres une reinstallation.
  useEffect(() => {
    mergeServerStickers(currentUser?.customStickers);
  }, [currentUser?.id, (currentUser?.customStickers || []).length]);

  useEffect(() => {
    isAuthenticatedRef.current = isAuthenticated;
    localStorage.setItem('plume_is_logged_in', isAuthenticated ? 'true' : 'false');
    // Enregistre l'appareil pour les notifications push (natif uniquement).
    if (isAuthenticated) initPushNotifications().catch(() => {});
  }, [isAuthenticated]);

  // Filet anti-blocage : session « connectée » mais profil absent (cache vidé,
  // /api/users en échec au démarrage…). On (re)charge le profil directement via
  // /auth/me, indépendamment du reste du bootstrap, et on tranche toujours :
  //   • profil valide → on entre dans l'app ;
  //   • session invalide (401) ou utilisateur inexistant → on déconnecte (AuthView) ;
  //   • erreur réseau (serveur froid/hors-ligne) → un seul réessai après 4 s, puis
  //     l'écran d'attente garde son bouton « Se reconnecter » manuel.
  // État de la récupération de profil (pour l'écran d'attente) + bouton Réessayer.
  const [profileRecoveryFailed, setProfileRecoveryFailed] = useState(false);
  const [recoveryNonce, setRecoveryNonce] = useState(0);
  useEffect(() => {
    if (!isAuthenticated || currentUser) { setProfileRecoveryFailed(false); return; }
    let cancelled = false;
    let retryTimer: any = null;
    setProfileRecoveryFailed(false);

    const logout = () => {
      localStorage.removeItem('plume_auth_token');
      localStorage.removeItem('plume_is_logged_in');
      localStorage.removeItem('plume_current_user');
      setIsAuthenticated(false);
    };

    const loadProfile = async (attempt: number) => {
      try {
        await restoreAuthToken();
        const res = await fetch('/api/auth/me', { headers: authHeaders() });
        if (cancelled) return;
        if (res.ok) {
          const me = await res.json().catch(() => null);
          if (me && me.id) {
            setCurrentUser(me);
            localStorage.setItem('plume_current_user', JSON.stringify(me));
            return;
          }
          // 200 mais profil nul/incomplet → la session pointe vers un compte
          // inexistant : on déconnecte plutôt que de rester bloqué.
          logout();
          return;
        }
        if (res.status === 401 || res.status === 403) { logout(); return; }
        // Autre code (5xx, serveur froid) : on réessaie (jusqu'à ~45 s).
        if (attempt < 8) retryTimer = setTimeout(() => loadProfile(attempt + 1), 5000);
        else if (!cancelled) setProfileRecoveryFailed(true);
      } catch {
        // Réseau indisponible / serveur en cours de démarrage : on réessaie.
        if (attempt < 8 && !cancelled) retryTimer = setTimeout(() => loadProfile(attempt + 1), 5000);
        else if (!cancelled) setProfileRecoveryFailed(true);
      }
    };

    loadProfile(0);
    return () => { cancelled = true; if (retryTimer) clearTimeout(retryTimer); };
  }, [isAuthenticated, currentUser, recoveryNonce]);

  useEffect(() => {
    if (!currentUser?.id) return;
    localStorage.setItem(getFavoritesStorageKey(currentUser.id), JSON.stringify(favorites));
  }, [favorites, currentUser?.id]);

  useEffect(() => {
    localStorage.setItem('plume_reading_groups', JSON.stringify(groups));
  }, [groups]);

  useEffect(() => {
    localStorage.setItem('plume_group_messages', JSON.stringify(groupMessages));
  }, [groupMessages]);

  useEffect(() => {
    if (!currentUser?.id) return;
    localStorage.setItem(getLikedStoriesStorageKey(currentUser.id), JSON.stringify(likedStories));
  }, [likedStories, currentUser?.id]);


  useEffect(() => {
    if (!currentUser?.id) return;
    localStorage.setItem(getCurrentlyReadingStorageKey(currentUser.id), JSON.stringify(currentlyReading));
  }, [currentlyReading, currentUser?.id]);

  useEffect(() => {
    if (!currentUser?.id) return;
    localStorage.setItem(getCompletedStorageKey(currentUser.id), JSON.stringify(completedStories));
  }, [completedStories, currentUser?.id]);

  useEffect(() => {
    if (!currentUser?.id) return;
    localStorage.setItem(getReadLaterStorageKey(currentUser.id), JSON.stringify(readLater));
  }, [readLater, currentUser?.id]);

  useEffect(() => {
    if (!currentUser?.id) return;
    localStorage.setItem(getReadChaptersStorageKey(currentUser.id), JSON.stringify(readChapters));
  }, [readChapters, currentUser?.id]);

  useEffect(() => {
    if (!currentUser?.id) return;
    if (lastReadProgress) {
      localStorage.setItem(getLastReadProgressStorageKey(currentUser.id), JSON.stringify(lastReadProgress));
    }
  }, [lastReadProgress, currentUser?.id]);

  useEffect(() => {
    localStorage.setItem('plume_dark_mode', JSON.stringify(darkMode));
    // Apply body and html classes for clean background coloring matching light/dark modes
    if (darkMode) {
      document.documentElement.classList.add('dark');
      document.body.className = 'bg-black text-white transition-colors duration-300';
    } else {
      document.documentElement.classList.remove('dark');
      document.body.className = 'bg-[#FFFFFF] text-[#1F2937] transition-colors duration-300';
    }
  }, [darkMode]);

  // Handle lateral filter choices. Re-routes to the Explorer view and updates the filter criteria
  const handleFilterSelect = (type: 'genre' | 'category' | 'ambiance' | 'format' | 'language' | 'ranking', value: string) => {
    setActiveFilter({ type, value });
    setSelectedStoryForReading(null); // Leave reading screen
    setActiveTab('explore');
  };

  const handleClearFilter = () => {
    setActiveFilter(null);
  };

  // Toggle dark/light theme
  const handleToggleDarkMode = () => {
    setDarkMode(!darkMode);
  };

  // Update profile attributes (bio, preferences)
  const handleUpdateProfile = async (updatedFields: Partial<User>): Promise<boolean> => {
    if (!currentUser) return false;
    const originalCurrentUser = currentUser;
    const originalAllUsers = allUsers;

    let nextUser = { ...currentUser, ...updatedFields } as User;

    // La certification (isVerified) est calculée et persistée par le serveur
    // (rôle Auteur + accomplissements réels). On ne la devine plus côté client :
    // la réponse du PUT /api/users renvoie la valeur autoritative, appliquée plus bas.

    setCurrentUser(nextUser);
    saveLocalUserEdit(nextUser);
    setAllUsers(prev => {
      const exists = prev.some(u => u.id === currentUser!.id);
      return exists
        ? prev.map(u => u.id === currentUser!.id ? nextUser : u)
        : [...prev, nextUser];
    });

    if (updatedFields.role) {
      if (updatedFields.role === 'Lecteur' && (activeTab === 'write' || activeTab === 'admin')) {
        setActiveTab('home');
      } else if (updatedFields.role === 'Auteur' && activeTab === 'admin') {
        setActiveTab('write');
      }
    }

    if (!isAuthenticated) return true;

    // Sync profile modification to the backend server
    try {
      const res = await fetch(`/api/users/${currentUser.id}`, {
        method: 'PUT',
        headers: authHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify(nextUser)
      });
      if (res.ok) {
        const syncedUser = await res.json();
        // Remove local edits to avoid stale override
        const edits = getLocalUserEdits();
        delete edits[currentUser.id];
        localStorage.setItem('plume_user_edits_by_id', JSON.stringify(edits));

        setCurrentUser(syncedUser);
        localStorage.setItem('plume_current_user', JSON.stringify(syncedUser));
        setAllUsers(prev => prev.map(u => u.id === syncedUser.id ? syncedUser : u));
        return true;
      }
      let errorMsg = "Impossible de mettre à jour le profil sur le serveur.";
      try {
        const errData = await res.json();
        if (errData.error) errorMsg += ` (${errData.error})`;
      } catch {}
      alert(errorMsg);
      // Revert state ET l'édition locale persistée (sinon la modif ratée
      // réapparaît au prochain chargement via mergeLocalUserEdit).
      saveLocalUserEdit(originalCurrentUser);
      setCurrentUser(originalCurrentUser);
      setAllUsers(originalAllUsers);
      return false;
    } catch (e) {
      console.error('[PLUME] Erreur de mise à jour du profil backend :', e);
      alert("Erreur de connexion. Le profil n'a pas pu être enregistré.");
      // Revert state ET l'édition locale persistée (sinon la modif ratée
      // réapparaît au prochain chargement via mergeLocalUserEdit).
      saveLocalUserEdit(originalCurrentUser);
      setCurrentUser(originalCurrentUser);
      setAllUsers(originalAllUsers);
      return false;
    }
  };

  // Method to increment stats and evaluate automatic certification dynamically
  const handleUpdateAndVerifyUserStats = (updateFn: (stats: UserStats) => void) => {
    if (!currentUser || !currentUser.id) return;

    const oldStats = { ...getUserStats(currentUser.id, currentUser.role, currentUser.username) };
    
    // Get list of already unlocked IDs BEFORE update
    const prevAuthorUnlockedIds = generateAuthorAchievements(oldStats, currentUser.id).filter(a => a.isUnlocked).map(a => a.id);
    const prevReaderUnlockedIds = generateReaderAchievements(oldStats, currentUser.id).filter(a => a.isUnlocked).map(a => a.id);

    // Perform state updates
    const nextStats = getUserStats(currentUser.id, currentUser.role, currentUser.username);
    updateFn(nextStats);
    saveUserStats(currentUser.id, nextStats);

    // Get list of unlocked achievements AFTER update
    const nextAuthorAchievements = generateAuthorAchievements(nextStats, currentUser.id);
    const nextReaderAchievements = generateReaderAchievements(nextStats, currentUser.id);

    // Detect newly unlocked
    const newlyUnlockedAuthor = nextAuthorAchievements.filter(a => a.isUnlocked && !prevAuthorUnlockedIds.includes(a.id));
    const newlyUnlockedReader = nextReaderAchievements.filter(a => a.isUnlocked && !prevReaderUnlockedIds.includes(a.id));

    // Queue toasts for each newly unlocked achievements
    const allNewlyUnlocked = [...newlyUnlockedAuthor, ...newlyUnlockedReader];
    if (allNewlyUnlocked.length > 0) {
      allNewlyUnlocked.forEach(ach => {
        const toastId = `${ach.id}_${Date.now()}_${Math.random()}`;
        const newToast = {
          id: toastId,
          title: ach.title,
          rarity: ach.rarity,
          category: ach.category === 'author' ? 'auteur' : 'lecteur',
          realDesc: ach.realDesc
        };
        setUnlockedToasts(prev => [...prev, newToast]);
        // Automatically hide toast after 5 seconds
        setTimeout(() => {
          setUnlockedToasts(prev => prev.filter(t => t.id !== toastId));
        }, 5000);
      });
    }

    // La certification est désormais décidée par le serveur (rôle Auteur +
    // accomplissements réels en base) et renvoyée via /api/auth/me et les réponses
    // d'écriture. Le client ne fabrique ni ne pousse plus isVerified : il se
    // contente de suivre les statistiques/trophées pour l'affichage.
  };

  // Follow author handler
  // Important : le backend peut répondre 401 sur les comptes simulateurs.
  // On sauvegarde donc aussi le suivi en local, par ID utilisateur, pour que
  // Lecteur / Auteur / Administrateur gardent chacun leurs suivis après refresh.
  const handleFollowAuthor = (authorId: string) => {
    console.log("currentUser.id =", currentUser?.id);
    console.log("targetUser.id =", authorId);
    if (currentUser?.id?.startsWith("user_") || authorId?.startsWith("user_")) {
      console.error("[PLUME ERROR] Un ID commence par 'user_' ou correspond à un compte de démonstration interdit.");
    }
    if (!currentUser?.id || !authorId || authorId === currentUser.id) return;

    if (isAuthenticated && localStorage.getItem('plume_is_logged_in') !== 'true') {
      alert("Erreur : session expirée ou non connecté. Veuillez vous reconnecter pour vous abonner.");
      setIsAuthenticated(false);
      setCurrentUser(null);
      return;
    }

    const author = allUsers.find((u) => u.id === authorId);
    if (!author) return;

    const originalCurrentUser = currentUser;
    const originalAllUsers = allUsers;

    const currentFollowing = currentUser.following || [];
    const authorFollowers = author.followers || [];

    const isCurrentlyFollowing =
      currentFollowing.includes(authorId) || authorFollowers.includes(currentUser.id);

    const nextFollowing = isCurrentlyFollowing
      ? currentFollowing.filter((id) => id !== authorId)
      : currentFollowing.includes(authorId)
        ? currentFollowing
        : [...currentFollowing, authorId];

    const nextFollowers = isCurrentlyFollowing
      ? authorFollowers.filter((id) => id !== currentUser.id)
      : authorFollowers.includes(currentUser.id)
        ? authorFollowers
        : [...authorFollowers, currentUser.id];

    const nextUser: User = {
      ...currentUser,
      following: nextFollowing,
    };

    const nextAuthor: User = {
      ...author,
      followers: nextFollowers,
    };

    const nextAllUsers = ensureSimulatorAccounts(allUsers).map((u) => {
      if (u.id === nextUser.id) return nextUser;
      if (u.id === nextAuthor.id) return nextAuthor;
      return u;
    });

    setCurrentUser(nextUser);
    setAllUsers(nextAllUsers);

    // If NOT authenticated, keep it local only
    if (!isAuthenticated) {
      saveLocalUserEdit(nextUser);
      saveLocalUserEdit(nextAuthor);
      
      if (!isCurrentlyFollowing) {
        createLocalNotification({
          type: 'follow',
          targetUserId: authorId,
          actorId: currentUser.id,
          actorName: currentUser.username,
          actorAvatar: currentUser.avatar,
          title: 'Nouvel abonné',
          message: `${currentUser.username} vous suit.`,
        });
      }
      return;
    }

    // Hors-ligne : on garde le suivi optimiste et on met l'action en file
    // (rejouée au retour du réseau) plutôt que de l'annuler.
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      enqueueAction({
        method: isCurrentlyFollowing ? 'DELETE' : 'POST',
        path: `/api/users/${authorId}/follow`,
        key: `follow:${authorId}`,
      });
      return;
    }

    // Authenticated: Sync with server!
    fetch(`/api/users/${authorId}/follow`, {
      method: isCurrentlyFollowing ? 'DELETE' : 'POST',
      headers: authHeaders(),
    })
    .then(async (res) => {
      if (res.ok) {
        const data = await res.json();
        if (data.currentUser && data.targetUser) {
          // Remove local edits to avoid overriding
          const edits = getLocalUserEdits();
          delete edits[currentUser.id];
          delete edits[authorId];
          localStorage.setItem('plume_user_edits_by_id', JSON.stringify(edits));

          setCurrentUser(data.currentUser);
          localStorage.setItem('plume_current_user', JSON.stringify(data.currentUser));
          setAllUsers(prev => prev.map(u => {
            if (u.id === data.currentUser.id) return data.currentUser;
            if (u.id === data.targetUser.id) return data.targetUser;
            return u;
          }));
        }
      } else {
        let errorMsg = isCurrentlyFollowing 
          ? "Impossible de se désabonner de l'utilisateur."
          : "Impossible de s'abonner à l'utilisateur.";
        try {
          const errData = await res.json();
          if (errData.error) errorMsg += ` (${errData.error})`;
        } catch {}
        alert(errorMsg);

        // Revert
        setCurrentUser(originalCurrentUser);
        setAllUsers(originalAllUsers);
      }
    })
    .catch((e) => {
      console.error('[PLUME] Erreur de suivi backend :', e);
      alert("Erreur de connexion. Le suivi n'a pas pu être enregistré.");
      // Revert
      setCurrentUser(originalCurrentUser);
      setAllUsers(originalAllUsers);
    });
  };

  const syncStoryMetricsToServer = (storyId: string, nextStoryObj: Story) => {
    fetch(`/api/stories/${storyId}`, {
      method: 'PUT',
      headers: authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(nextStoryObj)
    }).catch(e => console.error('[PLUME] Erreur de synchronisation métriques récit :', e));
  };

  // Add / remove a story from favorites. One user = one favorite per story.
  // Le compteur public favoritesCount est calculé à partir de favoritedBy.length.
  const handleToggleFavorite = (storyId: string) => {
    const targetStory = stories.find((story) => story.id === storyId) || selectedStoryForReading;

    if (!targetStory || targetStory.id !== storyId) return;

    const favoriteMap = readLikeMap(STORY_FAVORITERS_STORAGE_KEY);
    const initialFavoritedBy = mergeLikeIds(
      favoriteMap[storyId],
      targetStory.favoritedBy,
      favoriteMap[storyId] || (targetStory.favoritedBy?.length ? [] : createLegacyLikeIds('legacy_story_favorite', storyId, targetStory.favoritesCount || 0))
    );

    const hasFavorited = initialFavoritedBy.includes(currentUser.id);
    const nextFavoritedBy = hasFavorited
      ? initialFavoritedBy.filter((id) => id !== currentUser.id)
      : [...initialFavoritedBy, currentUser.id];

    favoriteMap[storyId] = nextFavoritedBy;
    saveLikeMap(STORY_FAVORITERS_STORAGE_KEY, favoriteMap);

    const nextFavorites = hasFavorited
      ? favorites.filter((id) => id !== storyId)
      : favorites.includes(storyId)
        ? favorites
        : [...favorites, storyId];

    setFavorites(nextFavorites);
    localStorage.setItem(getFavoritesStorageKey(currentUser.id), JSON.stringify(nextFavorites));

    if (!hasFavorited) {
      handleUpdateAndVerifyUserStats(st => {
        st.favoritesAdded = st.favoritesAdded + 1;
      });
    }

    let updatedStoryForSync: Story | null = null;

    setStories((prevStories) => {
      const nextStories = prevStories.map((story) => {
        if (story.id !== storyId) return story;

        updatedStoryForSync = {
          ...story,
          favoritedBy: nextFavoritedBy,
          favoritesCount: nextFavoritedBy.length,
        };

        return updatedStoryForSync;
      });

      localStorage.setItem('plume_stories_backup', JSON.stringify(nextStories));
      return nextStories;
    });

    const selectedUpdatedStory =
      selectedStoryForReading?.id === storyId
        ? {
            ...selectedStoryForReading,
            favoritedBy: nextFavoritedBy,
            favoritesCount: nextFavoritedBy.length,
          }
        : selectedStoryForReading;

    setSelectedStoryForReading(selectedUpdatedStory);

    const storyToSync = updatedStoryForSync || {
      ...targetStory,
      favoritedBy: nextFavoritedBy,
      favoritesCount: nextFavoritedBy.length,
    };

    syncStoryMetricsToServer(storyId, storyToSync);

    if (!hasFavorited && targetStory.authorId !== currentUser.id && !isAuthenticated) {
      createLocalNotification({
        type: 'favorite',
        targetUserId: targetStory.authorId,
        actorId: currentUser.id,
        actorName: currentUser.username,
        actorAvatar: currentUser.avatar,
        storyId: targetStory.id,
        storyTitle: targetStory.title,
        title: 'Nouveau favori',
        message: `${currentUser.username} a ajouté votre livre « ${targetStory.title} » à ses favoris.`,
      });
    }

    // Tolérant au hors-ligne : rejoué au retour du réseau (clé = fav:<story>).
    mutateServer(hasFavorited ? 'DELETE' : 'POST', `/api/stories/${storyId}/favorite`, undefined, `fav:${storyId}`);
  };

  // Like / unlike a story. One user = one like per story.
  // Les mentions du profil de l'auteur sont calculées à partir de story.likes.
  // Donc chaque like reçu sur un livre augmente automatiquement la section « Mentions ».
  const handleToggleStoryLike = (storyId: string) => {
    if (!currentUser) return;
    const targetStory = stories.find((story) => story.id === storyId) || selectedStoryForReading;

    if (!targetStory || targetStory.id !== storyId) return;

    // L'auteur peut aimer sa propre histoire (comme sur les réseaux sociaux).

    const likeMap = readLikeMap(STORY_LIKERS_STORAGE_KEY);
    const initialLikedBy = mergeLikeIds(
      likeMap[storyId],
      targetStory.likedBy,
      likeMap[storyId] || (targetStory.likedBy?.length ? [] : createLegacyLikeIds('legacy_story_like', storyId, targetStory.likes || 0))
    );

    const hasLiked = initialLikedBy.includes(currentUser.id);
    const nextLikedBy = hasLiked
      ? initialLikedBy.filter((id) => id !== currentUser.id)
      : [...initialLikedBy, currentUser.id];

    likeMap[storyId] = nextLikedBy;
    saveLikeMap(STORY_LIKERS_STORAGE_KEY, likeMap);

    const nextLikedStories = hasLiked
      ? likedStories.filter((id) => id !== storyId)
      : likedStories.includes(storyId)
        ? likedStories
        : [...likedStories, storyId];

    setLikedStories(nextLikedStories);
    localStorage.setItem(getLikedStoriesStorageKey(currentUser.id), JSON.stringify(nextLikedStories));

    let updatedStoryForSync: Story | null = null;

    setStories((prevStories) => {
      const nextStories = prevStories.map((story) => {
        if (story.id !== storyId) return story;

        updatedStoryForSync = {
          ...story,
          likedBy: nextLikedBy,
          likes: nextLikedBy.length,
        };

        return updatedStoryForSync;
      });

      localStorage.setItem('plume_stories_backup', JSON.stringify(nextStories));
      return nextStories;
    });

    const selectedUpdatedStory =
      selectedStoryForReading?.id === storyId
        ? {
            ...selectedStoryForReading,
            likedBy: nextLikedBy,
            likes: nextLikedBy.length,
          }
        : selectedStoryForReading;

    setSelectedStoryForReading(selectedUpdatedStory);

    const storyToSync = updatedStoryForSync || {
      ...targetStory,
      likedBy: nextLikedBy,
      likes: nextLikedBy.length,
    };

    syncStoryMetricsToServer(storyId, storyToSync);

    if (!hasLiked && !isAuthenticated) {
      createLocalNotification({
        type: 'like',
        targetUserId: targetStory.authorId,
        actorId: currentUser.id,
        actorName: currentUser.username,
        actorAvatar: currentUser.avatar,
        storyId: targetStory.id,
        storyTitle: targetStory.title,
        title: 'Nouveau like',
        message: `${currentUser.username} a aimé votre livre « ${targetStory.title} ».`,
      });
    }

    // Tolérant au hors-ligne : rejoué au retour du réseau (clé = like:<story>).
    mutateServer(hasLiked ? 'DELETE' : 'POST', `/api/stories/${storyId}/like`, undefined, `like:${storyId}`);
  };

  const handleToggleCurrentlyReading = (storyId: string) => {
    setCurrentlyReading(prev =>
      prev.includes(storyId) ? prev.filter(id => id !== storyId) : [...prev, storyId]
    );
  };

  const handleToggleCompletedStories = (storyId: string) => {
    const isAdding = !completedStories.includes(storyId);
    if (isAdding) {
      handleUpdateAndVerifyUserStats(st => {
        st.completedReadCycles = st.completedReadCycles + 1;
      });
    }
    setCompletedStories(prev =>
      prev.includes(storyId) ? prev.filter(id => id !== storyId) : [...prev, storyId]
    );
  };

  const handleToggleReadLater = (storyId: string) => {
    setReadLater(prev =>
      prev.includes(storyId) ? prev.filter(id => id !== storyId) : [...prev, storyId]
    );
  };

  // Track real reading progress. A chapter is counted once per user.
  const handleMarkChapterRead = (storyId: string, chapterId: string) => {
    const readKey = `${currentUser.id}:${storyId}:${chapterId}`;

    if (!readChapters.includes(readKey) && !readChapters.includes(chapterId)) {
      const nextReadChapters = [...readChapters, readKey];
      setReadChapters(nextReadChapters);

      handleUpdateAndVerifyUserStats(st => {
        st.chaptersRead = st.chaptersRead + 1;
      });

      setStories(prevStories => prevStories.map(s => {
        if (s.id !== storyId) return s;

        const updatedChapters = s.chapters.map(ch =>
          ch.id === chapterId
            ? {
                ...ch,
                views: (ch.views || 0) + 1,
                reads: (ch.reads || 0) + 1,
              }
            : ch
        );

        const nextStoryObj = {
          ...s,
          views: s.views || 0,
          reads: (s.reads || 0) + 1,
          chapters: updatedChapters,
        };

        if (selectedStoryForReading?.id === storyId) {
          setSelectedStoryForReading(nextStoryObj);
        }

        syncStoryMetricsToServer(storyId, nextStoryObj);
        return nextStoryObj;
      }));
    }

    setLastReadProgress({ storyId, chapterId });

    if (isAuthenticated) {
      fetch(`/api/stories/${storyId}/read`, {
        method: 'POST',
        headers: authHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ chapterId }),
      }).catch(() => {});

      fetch(`/api/chapters/${chapterId}/progress`, {
        method: 'POST',
        headers: authHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ progressPercent: 100 }),
      }).catch(() => {});
    }
  };

  // Comments management
  const handleAddComment = (chapterId: string, content: string) => {
    if (!selectedStoryForReading) return;

    // Increment comments stats for achievements
    handleUpdateAndVerifyUserStats(st => {
      st.commentsPosted = st.commentsPosted + 1;
    });

    const newComment: Comment = {
      id: `comment_${Date.now()}`,
      storyId: selectedStoryForReading.id,
      chapterId,
      userId: currentUser.id,
      username: currentUser.username,
      avatar: currentUser.avatar,
      content,
      date: new Date().toISOString(),
      likes: 0,
      replies: []
    };

    setComments([newComment, ...comments]);

    if (!isAuthenticated) createLocalNotification({
      type: 'comment',
      targetUserId: selectedStoryForReading.authorId,
      actorId: currentUser.id,
      actorName: currentUser.username,
      actorAvatar: currentUser.avatar,
      storyId: selectedStoryForReading.id,
      storyTitle: selectedStoryForReading.title,
      chapterId,
      commentId: newComment.id,
      title: 'Nouveau commentaire',
      message: `${currentUser.username} a commenté « ${selectedStoryForReading.title} » : ${content.trim()}`,
      excerpt: content.trim(),
    });

    // Async sync to the backend Express server
    fetch('/api/comments', {
      method: 'POST',
      headers: authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(newComment)
    }).catch(e => console.error('[PLUME] Erreur de création du commentaire sur le serveur :', e));
  };

  const handleLikeComment = (commentId: string) => {
    const likeMap = readLikeMap(COMMENT_LIKERS_STORAGE_KEY);
    const targetComment = comments.find((comment) => comment.id === commentId);

    if (!targetComment) return;

    const initialLikedBy = mergeLikeIds(
      likeMap[commentId],
      targetComment.likedBy,
      likeMap[commentId] || (targetComment.likedBy?.length ? [] : createLegacyLikeIds('legacy_comment_like', commentId, targetComment.likes || 0))
    );

    const hasLiked = initialLikedBy.includes(currentUser.id);
    const nextLikedBy = hasLiked
      ? initialLikedBy.filter((id) => id !== currentUser.id)
      : [...initialLikedBy, currentUser.id];

    likeMap[commentId] = nextLikedBy;
    saveLikeMap(COMMENT_LIKERS_STORAGE_KEY, likeMap);

    const likedCommentsKey = `plume_liked_comments_${currentUser.id}`;
    let savedLikedComments: string[] = [];
    try {
      savedLikedComments = JSON.parse(localStorage.getItem(likedCommentsKey) || '[]');
    } catch {
      savedLikedComments = [];
    }

    const nextLikedComments = hasLiked
      ? savedLikedComments.filter((id) => id !== commentId)
      : savedLikedComments.includes(commentId)
        ? savedLikedComments
        : [...savedLikedComments, commentId];

    localStorage.setItem(likedCommentsKey, JSON.stringify(nextLikedComments));

    setComments((prevComments) => {
      const nextComments = prevComments.map((comment) => {
        if (comment.id !== commentId) return comment;

        return {
          ...comment,
          likedBy: nextLikedBy,
          likes: nextLikedBy.length,
          likedByMe: !hasLiked,
        };
      });

      localStorage.setItem('plume_comments_backup', JSON.stringify(nextComments));
      return nextComments;
    });

    // Tolérant au hors-ligne : rejoué au retour du réseau (clé = clike:<id>).
    mutateServer(hasLiked ? 'DELETE' : 'POST', `/api/comments/${commentId}/like`, undefined, `clike:${commentId}`);
  };

  const handleAddReply = (commentId: string, content: string) => {
    const newReply = {
      id: `reply_${Date.now()}`,
      userId: currentUser.id,
      username: currentUser.username,
      avatar: currentUser.avatar,
      content,
      date: new Date().toISOString()
    };

    setComments(comments.map(c => {
      if (c.id === commentId) {
        return {
          ...c,
          replies: [...c.replies, newReply]
        };
      }
      return c;
    }));

    // Async sync of reply to the parent comment on server
    fetch(`/api/comments/${commentId}/replies`, {
      method: 'POST',
      headers: authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(newReply)
    }).catch(e => console.error('[PLUME] Erreur d’ajout de la réponse sur le serveur :', e));
  };

  const handleDeleteComment = (commentId: string) => {
    setComments(comments.filter(c => c.id !== commentId));

    // Delete comment on backend
    fetch(`/api/comments/${commentId}`, { method: 'DELETE', headers: authHeaders() })
      .catch(e => console.error('[PLUME] Erreur de suppression commentaire backend :', e));
  };

  // Stories creations (for Authors)
  // Recharge l'utilisateur courant depuis le serveur, source de vérité du badge
  // de certification (recalculé côté serveur après les actions d'écriture). On ne
  // synchronise que isVerified pour ne pas écraser d'éventuelles éditions locales.
  const refreshCurrentUser = async () => {
    try {
      const res = await fetch('/api/auth/me', { headers: authHeaders() });
      if (!res.ok) return;
      const me = await res.json();
      setCurrentUser(prev => (prev ? { ...prev, isVerified: me.isVerified } : prev));
      setAllUsers(prev => prev.map(u => (u.id === me.id ? { ...u, isVerified: me.isVerified } : u)));
      setStories(prev => prev.map(s => (s.authorId === me.id ? { ...s, authorVerified: me.isVerified } : s)));
    } catch (e) {
      console.error('[PLUME] Erreur de rafraîchissement du profil :', e);
    }
  };

  // Rafraîchissement global (tirer vers le bas) : recharge comptes, récits,
  // commentaires, conversations et notifications depuis le serveur.
  const handleGlobalRefresh = React.useCallback(async () => {
    try {
      await Promise.all([
        refreshUsersData(),
        fetchConversationsList(),
        (async () => {
          const r = await fetch('/api/stories');
          if (r.ok) {
            const s = await r.json();
            setStories(s.map((story: Story) => normalizeStoryViewsFromStorage(normalizeStoryFavoritesFromStorage(normalizeStoryLikesFromStorage(story)))));
          }
        })(),
        (async () => {
          const r = await fetch('/api/comments');
          if (r.ok) {
            const c = await r.json();
            setComments(c.map((comment: Comment) => normalizeCommentLikesFromStorage(comment)));
          }
        })(),
        (async () => {
          if (!currentUser?.id) return;
          const r = await fetch(`/api/notifications/${currentUser.id}`, { headers: authHeaders() });
          if (r.ok) {
            const n = await r.json();
            const mapped = n.map(mapServerNotification).slice(0, 120);
            setNotifications(mapped);
            localStorage.setItem('plume_notifications', JSON.stringify(mapped));
          }
        })(),
      ]);
    } catch (e) {
      console.error('[PLUME] Erreur de rafraîchissement global :', e);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser?.id]);

  const handleCreateStory = (storyData: Partial<Story>) => {
    // Increment stats for achievements
    handleUpdateAndVerifyUserStats(st => {
      st.storiesCreated = st.storiesCreated + 1;
    });

    const newStory: Story = {
      id: storyData.id || `story_${Date.now()}`,
      title: storyData.title || 'Untitled',
      description: storyData.description || '',
      authorId: currentUser.id,
      authorName: currentUser.username,
      authorAvatar: currentUser.avatar,
      authorVerified: currentUser.isVerified,
      cover: storyData.cover || 'https://picsum.photos/400/600',
      genre: storyData.genre || 'Science-Fiction',
      category: storyData.category || 'Roman',
      ambiance: storyData.ambiance || 'Mystérieux',
      format: storyData.format || 'Roman Fleuve',
      language: storyData.language || 'Français',
      chapters: [],
      likes: 0,
      likedBy: [],
      favoritesCount: 0,
      favoritedBy: [],
      tags: storyData.tags || [],
      status: 'Brouillon',
      publishDate: new Date().toISOString().split('T')[0],
      views: 0,
      viewedBy: [],
      reads: 0,
      rating: 0,
      isFlagged: false,
      ageRating: storyData.ageRating || 'all'
    };

    setStories([newStory, ...stories]);

    // Send new story to the backend server
    fetch('/api/stories', {
      method: 'POST',
      headers: authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(newStory)
    }).then(() => refreshCurrentUser()).catch(e => console.error('[PLUME] Erreur de création de récit sur le serveur :', e));
  };

  const handleUpdateStory = (storyId: string, updatedStory: Partial<Story>) => {
    const oldStory = stories.find(s => s.id === storyId);
    if (oldStory) {
      const nextStoryObj = { ...oldStory, ...updatedStory };
      setStories(stories.map(s => s.id === storyId ? nextStoryObj : s));
      if (selectedStoryForReading && selectedStoryForReading.id === storyId) {
        setSelectedStoryForReading(nextStoryObj);
      }

      // Sync updated story to backend database
      fetch(`/api/stories/${storyId}`, {
        method: 'PUT',
        headers: authHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify(nextStoryObj)
      }).then(() => refreshCurrentUser()).catch(e => console.error('[PLUME] Erreur de mise à jour du récit sur le serveur :', e));
    }
  };

  // Chapter integrations under stories
  const handleAddChapter = (storyId: string, chapterData: Partial<Chapter>): Chapter => {
    // Increment author stats for achievements
    const wordCount = (chapterData.content || '').split(/\s+/).filter(Boolean).length;
    handleUpdateAndVerifyUserStats(st => {
      st.chaptersPublished = st.chaptersPublished + 1;
      st.wordsWritten = st.wordsWritten + wordCount;
    });

    const newChapter: Chapter = {
      id: `chapter_${Date.now()}`,
      title: chapterData.title || `Chapitre ${Date.now()}`,
      content: chapterData.content || '',
      publishDate: new Date().toISOString(),
      isPublished: true,
      views: 1,
      reads: 1
    };

    setStories(prev => prev.map(s => {
      if (s.id === storyId) {
        const updatedStory = {
          ...s,
          chapters: [...s.chapters, newChapter]
        };

        // Sync new chapter to server
        fetch(`/api/stories/${storyId}/chapters`, {
          method: 'POST',
          headers: authHeaders({ 'Content-Type': 'application/json' }),
          body: JSON.stringify(newChapter)
        }).then(() => refreshCurrentUser()).catch(e => console.error('[PLUME] Erreur ajout de chapitre :', e));

        return updatedStory;
      }
      return s;
    }));

    return newChapter; // l'éditeur immersif s'en sert pour passer en mode mise à jour
  };

  const handleUpdateChapter = (storyId: string, chapterId: string, updatedChapter: Partial<Chapter>) => {
    setStories(prev => prev.map(s => {
      if (s.id === storyId) {
        const freshChapters = s.chapters.map(ch => ch.id === chapterId ? { ...ch, ...updatedChapter } : ch);
        const matchChapter = freshChapters.find(ch => ch.id === chapterId);
        
        if (matchChapter) {
          // Sync updated chapter draft / published status to server
          fetch(`/api/stories/${storyId}/chapters/${chapterId}`, {
            method: 'PUT',
            headers: authHeaders({ 'Content-Type': 'application/json' }),
            body: JSON.stringify(matchChapter)
          }).then(() => refreshCurrentUser()).catch(e => console.error('[PLUME] Erreur édition chapitre :', e));
        }

        return {
          ...s,
          chapters: freshChapters
        };
      }
      return s;
    }));
  };

  const handleDeleteChapter = (storyId: string, chapterId: string) => {
    setStories(stories.map(s => {
      if (s.id === storyId) {
        // Sync chapter removal to backend
        fetch(`/api/stories/${storyId}/chapters/${chapterId}`, {
          method: 'DELETE',
          headers: authHeaders()
        }).then(() => refreshCurrentUser()).catch(e => console.error('[PLUME] Erreur d’effacement chapitre :', e));

        return {
          ...s,
          chapters: s.chapters.filter(ch => ch.id !== chapterId)
        };
      }
      return s;
    }));
  };

  // Messages operations
  const handleSendMessage = (conversationId: string, content: string) => {
    if (!currentUser) return;
    
    const conv = conversations.find(c => c.id === conversationId);
    const otherParticipant = conv?.participants.find(p => p.id !== currentUser.id);
    const targetUserId = otherParticipant?.id;
    console.log("currentUser.id =", currentUser.id);
    console.log("targetUser.id =", targetUserId);
    if (currentUser.id.startsWith("user_") || (targetUserId && targetUserId.startsWith("user_"))) {
      console.error("[PLUME ERROR] Un ID commence par 'user_' ou correspond à un compte de démonstration interdit.");
    }
    
    const tempMsgId = `msg_temp_${Date.now()}`;
    const newMsg: Message = {
      id: tempMsgId,
      senderId: currentUser.id,
      conversationId,
      content,
      date: new Date().toISOString(),
      isRead: false,
      sender: currentUser
    };

    // Optimistically add message to the correct conversation
    setConversations(prev => prev.map(c => {
      if (c.id === conversationId) {
        return {
          ...c,
          updatedAt: new Date().toISOString(),
          messages: [...c.messages, newMsg]
        };
      }
      return c;
    }));

    // Send new chat message to Express service
    fetch('/api/messages', {
      method: 'POST',
      headers: authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ conversationId, content })
    })
    .then(async (res) => {
      if (res.ok) {
        const savedMsg = await res.json();
        // Replace temporary message with final saved message
        setConversations(prev => prev.map(c => {
          if (c.id === conversationId) {
            return {
              ...c,
              messages: c.messages.map(m => m.id === tempMsgId ? { ...savedMsg, date: savedMsg.createdAt } : m)
            };
          }
          return c;
        }));
      } else {
        let errMsg = 'Erreur lors de l’envoi du message';
        try {
          const data = await res.json();
          errMsg = data.error || errMsg;
        } catch (jsonErr) {
          // response is not JSON
        }
        alert(errMsg);
        // Revert optimistic update
        setConversations(prev => prev.map(c => {
          if (c.id === conversationId) {
            return {
              ...c,
              messages: c.messages.filter(m => m.id !== tempMsgId)
            };
          }
          return c;
        }));
      }
    })
    .catch(e => {
      console.error('[PLUME] Erreur envoi message backend :', e);
      alert('Impossible d’envoyer le message. Problème de connexion réseau ou serveur.');
      // Revert optimistic update
      setConversations(prev => prev.map(c => {
        if (c.id === conversationId) {
          return {
            ...c,
            messages: c.messages.filter(m => m.id !== tempMsgId)
          };
        }
        return c;
      }));
    });
  };

  const handleDeleteConversation = async (conversationId: string) => {
    // Retrait optimiste de l'UI, puis suppression serveur (cascade des messages).
    const removeLocally = () => {
      setConversations(prev => prev.filter(c => c.id !== conversationId));
      setActiveConversationId(prev => (prev === conversationId ? '' : prev));
    };
    try {
      const res = await fetch(`/api/conversations/${conversationId}`, {
        method: 'DELETE',
        headers: authHeaders(),
      });
      if (res.ok || res.status === 404) {
        removeLocally();
      } else {
        let msg = 'La conversation n’a pas pu être supprimée.';
        try { const d = await res.json(); if (d.error) msg = d.error; } catch {}
        alert(msg);
      }
    } catch {
      alert("Erreur de connexion : la conversation n’a pas pu être supprimée.");
    }
  };

  const handleStartConversation = async (participantIds: string[]): Promise<Conversation> => {
    const targetUserId = participantIds.find(id => id !== currentUser?.id);
    console.log("currentUser.id =", currentUser?.id);
    console.log("targetUser.id =", targetUserId);
    if (currentUser?.id?.startsWith("user_") || (targetUserId && targetUserId.startsWith("user_"))) {
      console.error("[PLUME ERROR] Un ID commence par 'user_' ou correspond à un compte de démonstration interdit.");
    }
    try {
      const res = await fetch('/api/conversations', {
        method: 'POST',
        headers: authHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ participantIds })
      });
      if (res.ok) {
        const conversation = await res.json();
        const mappedConv = {
          ...conversation,
          messages: (conversation.messages || []).map((m: any) => ({
            ...m,
            date: m.createdAt
          }))
        };
        // Prepend it if not already present
        setConversations(prev => {
          if (prev.some(c => c.id === mappedConv.id)) return prev;
          return [mappedConv, ...prev];
        });
        return mappedConv;
      } else {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Erreur de création de conversation');
      }
    } catch (e) {
      console.error(e);
      throw e;
    }
  };

  // Admin Operations
  const handleToggleUserVerification = (userId: string) => {
    const updatedUsers = allUsers.map(u => {
      if (u.id === userId) {
        const nextStatus = !u.isVerified;
        const nextUserObj = { ...u, isVerified: nextStatus };
        
        // Sync modified verification details to server
        fetch(`/api/users/${userId}`, {
          method: 'PUT',
          headers: authHeaders({ 'Content-Type': 'application/json' }),
          body: JSON.stringify(nextUserObj)
        }).catch(e => console.error('[PLUME] Erreur de certification Admin backend :', e));

        // Update also currentUser to keep synchronous
        if (currentUser.id === userId) {
          setCurrentUser(nextUserObj);
        }
        return nextUserObj;
      }
      return u;
    });

    setAllUsers(updatedUsers);

    // Sync story verified badges
    const targetUser = updatedUsers.find(u => u.id === userId);
    if (targetUser) {
      setStories(stories.map(s => {
        if (s.authorId === userId) {
          const updatedSt = { ...s, authorVerified: targetUser.isVerified };
          
          fetch(`/api/stories/${s.id}`, {
            method: 'PUT',
            headers: authHeaders({ 'Content-Type': 'application/json' }),
            body: JSON.stringify(updatedSt)
          }).catch(e => console.error('[PLUME] Erreur mise à jour badge récit :', e));

          return updatedSt;
        }
        return s;
      }));
    }
  };

  // Mise en avant (admin) d'un COMPTE.
  const handleToggleUserFeatured = async (userId: string) => {
    const target = allUsers.find((u) => u.id === userId);
    if (!target) return;
    const next = !target.featured;
    try {
      const res = await fetch(`/api/users/${userId}`, {
        method: 'PUT', headers: authHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ id: userId, featured: next }),
      });
      if (!res.ok) { alert('Mise en avant impossible.'); return; }
      const updated = await res.json();
      setAllUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, featured: updated.featured } : u)));
      alert(next ? 'Compte mis en avant ✨' : 'Compte retiré de la une.');
    } catch { alert('Erreur de connexion.'); }
  };

  // Mise en avant (admin) d'un RÉCIT.
  const handleToggleStoryFeatured = async (storyId: string) => {
    const target = stories.find((s) => s.id === storyId);
    if (!target) return;
    const next = !target.featured;
    try {
      const res = await fetch(`/api/stories/${storyId}`, {
        method: 'PUT', headers: authHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ ...target, featured: next }),
      });
      if (!res.ok) { alert('Mise en avant impossible.'); return; }
      const updated = await res.json();
      setStories((prev) => prev.map((s) => (s.id === storyId ? { ...s, featured: updated.featured } : s)));
      alert(next ? 'Récit mis en avant ✨' : 'Récit retiré de la une.');
    } catch { alert('Erreur de connexion.'); }
  };

  const handleBanUser = async (userId: string) => {
    // Suspension RÉELLE côté serveur : bloque la connexion et dépublie les
    // récits (réversible). Sans cet appel, un compte « banni » réapparaîtrait
    // au rechargement et pourrait toujours se reconnecter.
    try {
      const res = await fetch(`/api/users/${userId}/ban`, {
        method: 'POST',
        headers: authHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ banned: true }),
      });
      if (!res.ok) {
        let msg = 'La suspension a échoué.';
        try { const d = await res.json(); if (d.error) msg = d.error; } catch {}
        alert(msg);
        return;
      }
      // Reflète l'état serveur : compte marqué suspendu (conservé dans la liste
      // admin pour permettre la réactivation), récits dépubliés.
      setAllUsers(prev => prev.map(u => u.id === userId ? { ...u, isBanned: true } : u));
      setStories(prev => prev.filter(s => s.authorId !== userId));
      alert("Compte suspendu. La connexion est bloquée et ses œuvres ont été dépubliées.");
    } catch {
      alert("Erreur de connexion : la suspension n'a pas pu être appliquée.");
    }
  };

  const handleUnbanUser = async (userId: string) => {
    // Réactivation : lève la suspension côté serveur (login de nouveau possible).
    // Les récits restent en brouillon — à l'auteur de les republier.
    try {
      const res = await fetch(`/api/users/${userId}/ban`, {
        method: 'POST',
        headers: authHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ banned: false }),
      });
      if (!res.ok) {
        let msg = 'La réactivation a échoué.';
        try { const d = await res.json(); if (d.error) msg = d.error; } catch {}
        alert(msg);
        return;
      }
      setAllUsers(prev => prev.map(u => u.id === userId ? { ...u, isBanned: false } : u));
      alert("Compte réactivé. L'utilisateur peut de nouveau se connecter.");
    } catch {
      alert("Erreur de connexion : la réactivation n'a pas pu être appliquée.");
    }
  };

  const handleDeleteStory = (storyId: string) => {
    setStories(stories.filter(s => s.id !== storyId));
    setComments(comments.filter(c => c.storyId !== storyId));

    // DELETE request to remove story
    fetch(`/api/stories/${storyId}`, { method: 'DELETE', headers: authHeaders() })
      .then(() => { alert("L'histoire signalée a été retirée définitivement de la plateforme."); refreshCurrentUser(); })
      .catch(e => console.error('[PLUME] Erreur de suppression permanente du récit :', e));
  };

  const handleDismissFlag = (storyId: string) => {
    setStories(stories.map(s => {
      if (s.id === storyId) {
        const updated = { ...s, isFlagged: false, flagReason: undefined };
        
        fetch(`/api/stories/${storyId}`, {
          method: 'PUT',
          headers: authHeaders({ 'Content-Type': 'application/json' }),
          body: JSON.stringify(updated)
        }).catch(e => console.error('[PLUME] Erreur absoudre signalement récit backend :', e));

        return updated;
      }
      return s;
    }));
  };

  const handleDismissUserFlag = (userId: string) => {
    setAllUsers(prev => prev.map(u => {
      if (u.id === userId) {
        const updated = { ...u, isFlagged: false, flagReason: undefined };
        
        fetch(`/api/users/${userId}`, {
          method: 'PUT',
          headers: authHeaders({ 'Content-Type': 'application/json' }),
          body: JSON.stringify(updated)
        }).catch(e => console.error('[PLUME] Erreur absoudre signalement compte backend :', e));

        return updated;
      }
      return u;
    }));
  };

  // Log Out
  const handleLogout = () => {
    // Demande au serveur d'effacer le cookie httpOnly d'authentification.
    fetch('/api/auth/logout', { method: 'POST', headers: authHeaders() }).catch(() => {});
    setAuthToken(null);
    setIsAuthenticated(false);
    setCurrentUser(null);
    localStorage.removeItem('plume_is_logged_in');
    localStorage.removeItem('plume_auth_token');
    localStorage.removeItem('plume_current_user');
    // Purge les caches encore stockés sous des clés GLOBALES (non scopées par
    // utilisateur) pour éviter qu'ils ne fuitent vers le compte suivant connecté
    // sur le même navigateur. Les favoris et les listes de lecture sont désormais
    // scopés par utilisateur (clés `*_${userId}`) et n'ont plus besoin d'y figurer.
    [
      'plume_notifications',
      'plume_reading_groups',
      'plume_group_messages',
    ].forEach((key) => localStorage.removeItem(key));
  };

  // Wrap fetch globally to catch 401 errors
  useEffect(() => {
    const originalFetch = window.fetch;
    // Routes pour lesquelles un 401 est NORMAL et ne doit JAMAIS déclencher le
    // message « session expirée » : connexion/OTP (échec de saisie) et la sonde
    // de session /api/auth/me (un 401 y signifie simplement « pas connecté »,
    // déjà géré silencieusement par refreshUsersData au démarrage).
    const ignore401 = (url: string) =>
      url.includes('/api/auth/login') ||
      url.includes('/api/auth/verify-otp') ||
      url.includes('/api/auth/otp/request') ||
      url.includes('/api/auth/me');

    window.fetch = async (input, init) => {
      const response = await originalFetch(input, init);
      // IMPORTANT : on NE déconnecte JAMAIS automatiquement sur un 401 reçu en
      // cours d'usage. C'était la cause de la boucle de connexion : un seul 401
      // transitoire (requête bancale, serveur froid, course juste après le
      // login) suffisait à détruire une session pourtant valide. La validité de
      // session est vérifiée UNIQUEMENT au démarrage (bootstrap + filet /auth/me)
      // et lors d'une déconnexion explicite par l'utilisateur. Ici, on se
      // contente de tracer le 401 ; la requête concernée échoue simplement.
      if (response.status === 401) {
        const urlStr = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
        if (!ignore401(urlStr)) console.warn('[AUTH] 401 sur', urlStr, '(ignoré, pas de déconnexion auto).');
      }
      return response;
    };
    return () => {
      window.fetch = originalFetch;
    };
  }, []);

  // Filter stories the logged-in user is allowed to access
  const userAge = calculateAge(currentUser?.birthDate);
  const allowedStories = stories.filter(story => {
    // Current user can always access / read their own works
    if (story.authorId === currentUser?.id) return true;
    
    // Otherwise check age range compliance
    return isUserAgeAllowed(userAge, story.ageRating);
  });

  // Resume Reading lookup
  const resumeStory = lastReadProgress ? allowedStories.find(s => s.id === lastReadProgress.storyId) : null;

  // Filter out draft books for display on home tab
  const publishedStories = allowedStories.filter(s => s.status === 'Publié' && !s.isFlagged);
  const userWritings = currentUser ? stories.filter(s => s.authorId === currentUser.id) : [];

  const handleRecordStoryView = (storyId: string) => {
    const targetStory = stories.find((story) => story.id === storyId) || selectedStoryForReading;
    if (!targetStory || targetStory.id !== storyId) return targetStory || null;

    // L'auteur ne doit pas augmenter les vues de son propre livre.
    if (targetStory.authorId === currentUser?.id) return targetStory;

    const viewMap = readLikeMap(STORY_VIEWERS_STORAGE_KEY);
    const initialViewedBy = mergeLikeIds(
      viewMap[storyId],
      targetStory.viewedBy,
      viewMap[storyId] || (targetStory.viewedBy?.length ? [] : createLegacyLikeIds('legacy_story_view', storyId, targetStory.views || 0))
    );

    if (initialViewedBy.includes(currentUser.id)) {
      return {
        ...targetStory,
        viewedBy: initialViewedBy,
        views: initialViewedBy.length,
      };
    }

    const nextViewedBy = [...initialViewedBy, currentUser.id];
    viewMap[storyId] = nextViewedBy;
    saveLikeMap(STORY_VIEWERS_STORAGE_KEY, viewMap);

    let updatedStoryForSync: Story | null = null;

    setStories((prevStories) => {
      const nextStories = prevStories.map((item) => {
        if (item.id !== storyId) return item;

        updatedStoryForSync = {
          ...item,
          viewedBy: nextViewedBy,
          views: nextViewedBy.length,
        };

        return updatedStoryForSync;
      });

      localStorage.setItem('plume_stories_backup', JSON.stringify(nextStories));
      return nextStories;
    });

    const storyToSync = updatedStoryForSync || {
      ...targetStory,
      viewedBy: nextViewedBy,
      views: nextViewedBy.length,
    };

    syncStoryMetricsToServer(storyId, storyToSync);
    return storyToSync;
  };

  // Note personnelle de l'utilisateur par histoire (la moyenne publique vit dans story.rating).
  const [myRatings, setMyRatings] = useState<Record<string, number>>({});

  const handleRateStory = (storyId: string, value: number) => {
    setMyRatings(prev => ({ ...prev, [storyId]: value })); // retour visuel immédiat
    fetch(`/api/stories/${storyId}/rate`, {
      method: 'POST',
      headers: authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ value }),
    })
      .then(res => (res.ok ? res.json() : null))
      .then(data => {
        if (data && typeof data.rating === 'number') {
          setStories(prev => prev.map(s => (s.id === storyId ? { ...s, rating: data.rating } : s)));
          setSelectedStoryForReading(prev => (prev && prev.id === storyId ? { ...prev, rating: data.rating } : prev));
          setMyRatings(prev => ({ ...prev, [storyId]: data.myRating }));
        }
      })
      .catch(e => console.error('[PLUME] Erreur de notation :', e));
  };

  const handleSelectStoryForReading = (story: Story) => {
    const age = calculateAge(currentUser?.birthDate);
    if (!isUserAgeAllowed(age, story.ageRating) && story.authorId !== currentUser?.id) {
      alert(`Accès interdit. Cette œuvre est classée ${story.ageRating === 'all' || !story.ageRating ? 'Tout public' : story.ageRating + ' ans et plus'} et vous avez ${age} ans.`);
      return;
    }
    const freshStory = stories.find((s) => s.id === story.id) || story;
    const viewedStory = handleRecordStoryView(freshStory.id) || freshStory;
    setSelectedStoryForReading(viewedStory);

    // Charge la note réelle (moyenne + ma note) pour cette histoire.
    fetch(`/api/stories/${viewedStory.id}/rating`, { headers: authHeaders() })
      .then(res => (res.ok ? res.json() : null))
      .then(data => {
        if (!data) return;
        setMyRatings(prev => ({ ...prev, [viewedStory.id]: data.myRating || 0 }));
        if (typeof data.rating === 'number') {
          setStories(prev => prev.map(s => (s.id === viewedStory.id ? { ...s, rating: data.rating } : s)));
        }
      })
      .catch(() => {});
  };

  return (
    <div className={`min-h-screen w-full flex flex-col items-center justify-start font-sans transition-colors duration-300 select-none ${
      darkMode 
        ? 'dark text-white bg-black' 
        : 'text-[#1F2937] bg-[#F3F4F6]'
    }`}>
      
      {/* Background ambient lighting blur spots (desktop only) */}
      <div className="hidden md:block absolute -left-16 -top-16 w-96 h-96 rounded-full bg-purple-600/5 blur-3xl pointer-events-none" />
      <div className="hidden md:block absolute -right-16 -bottom-16 w-96 h-96 rounded-full bg-purple-600/5 blur-3xl pointer-events-none" />

      {/* Bandeau HORS-LIGNE : visible en haut dès que le réseau tombe. */}
      {isOffline && (
        <div className="fixed top-0 inset-x-0 z-[2147482000] bg-amber-500 text-black text-[11px] font-black uppercase tracking-wider text-center py-1.5 shadow" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
          Hors ligne — lecture des livres téléchargés disponible
          {pendingActions > 0 && ` · ${pendingActions} action${pendingActions > 1 ? 's' : ''} en attente`}
        </div>
      )}
      {/* De retour en ligne mais file non vide : synchronisation en cours. */}
      {!isOffline && pendingActions > 0 && (
        <div className="fixed top-0 inset-x-0 z-[2147482000] bg-purple-600 text-white text-[11px] font-black uppercase tracking-wider text-center py-1.5 shadow" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
          Synchronisation… {pendingActions} action{pendingActions > 1 ? 's' : ''} en attente
        </div>
      )}

      {/* Main Responsive Mobile-First Centered Container */}
      <div className="relative w-full max-w-xl min-h-screen mx-auto flex flex-col overflow-hidden bg-white dark:bg-black text-gray-900 dark:text-white shadow-xl md:border-x md:border-gray-200 md:dark:border-purple-900/10 justify-center">
        {!isAuthenticated ? (
          <AuthView
            allUsers={allUsers}
            onLoginSuccess={(user) => {
              setCurrentUser(user);
              setIsAuthenticated(true);
            }}
            onRegisterSuccess={(newUser) => {
              setAllUsers([...allUsers, newUser]);
              setCurrentUser(newUser);
              setIsAuthenticated(true);
              
            }}
          />
        ) : !currentUser ? (
          // Session « connectée » mais profil pas encore (re)chargé : on affiche
          // un écran d'attente plutôt que de rendre l'app avec un utilisateur
          // indéfini — c'était la cause de l'écran noir après connexion
          // (MainNavigation/HomeView lisaient currentUser.role sur undefined).
          <div className="min-h-screen flex flex-col items-center justify-center gap-5 p-8 text-center">
            <div className="text-4xl animate-pulse">🪶</div>
            {profileRecoveryFailed ? (
              <>
                <p className="text-sm font-bold text-gray-700 dark:text-gray-200">Serveur injoignable</p>
                <p className="text-xs text-gray-400 max-w-xs">
                  Impossible de charger votre profil. Le serveur démarre peut-être (cela peut prendre ~1 min) ou votre connexion est instable.
                </p>
                <div className="flex flex-col gap-2 w-full max-w-xs">
                  <button
                    onClick={() => { setProfileRecoveryFailed(false); setRecoveryNonce((n) => n + 1); }}
                    className="text-xs font-black uppercase tracking-wider text-white bg-purple-600 px-4 py-3 rounded-xl hover:bg-purple-700"
                  >
                    Réessayer
                  </button>
                  <button
                    onClick={() => {
                      localStorage.removeItem('plume_is_logged_in');
                      localStorage.removeItem('plume_current_user');
                      localStorage.removeItem('plume_auth_token');
                      setIsAuthenticated(false);
                    }}
                    className="text-xs font-black uppercase tracking-wider text-purple-600 bg-purple-500/10 px-4 py-3 rounded-xl hover:bg-purple-500/20"
                  >
                    Se reconnecter
                  </button>
                </div>
              </>
            ) : (
              <>
                <p className="text-sm font-bold text-gray-500 dark:text-gray-300">Chargement de votre profil…</p>
                <button
                  onClick={() => {
                    localStorage.removeItem('plume_is_logged_in');
                    localStorage.removeItem('plume_current_user');
                    localStorage.removeItem('plume_auth_token');
                    setIsAuthenticated(false);
                  }}
                  className="text-xs font-black uppercase tracking-wider text-purple-600 bg-purple-500/10 px-4 py-2.5 rounded-xl hover:bg-purple-500/20"
                >
                  Se reconnecter
                </button>
              </>
            )}
          </div>
        ) : (
          <div className="flex flex-col flex-1 min-h-screen">
            {/* Top Header navbar navigation */}
            <MainNavigation
              activeTab={activeTab}
              onChangeTab={(tab) => {
                setViewedUser(null); // Reset peer visitation
                if (tab === 'admin' && currentUser?.role !== 'Administrateur') {
                  setActiveTab('home');
                } else if (tab === 'write' && currentUser?.role === 'Lecteur') {
                  setActiveTab('home');
                } else {
                  setActiveTab(tab);
                }
                setSelectedStoryForReading(null); // Quits reading screen on tab alteration
              }}
              currentUser={currentUser!}
              onOpenSidebar={() => setIsSidebarOpen(true)}
              darkMode={darkMode}
              onToggleDarkMode={handleToggleDarkMode}
              notifications={notifications.filter((notification) => notification.targetUserId === currentUser?.id)}
              onMarkNotificationsRead={handleMarkNotificationsRead}
              onOpenNotification={handleOpenNotification}
              unreadMessagesCount={conversations.reduce((sum, c) => sum + (c.unreadCount || 0), 0)}
            />

            {/* Side-Drawer filter checklist menu */}
            <LateralMenu
              isOpen={isSidebarOpen}
              onClose={() => setIsSidebarOpen(false)}
              activeFilter={activeFilter}
              onFilterSelect={handleFilterSelect}
              onLogout={handleLogout}
            />

            {/* Main scrollable body container */}
            <PullToRefresh onRefresh={handleGlobalRefresh} className="flex-1 overflow-y-auto pb-28 pt-2 scrollbar-none scroll-smooth">

              {/* Frontière de chargement pour les vues découpées (lazy). */}
              <Suspense fallback={(
                <div className="flex items-center justify-center py-24 text-3xl animate-pulse" aria-label="Chargement">🪶</div>
              )}>

              {/* SPECIAL SCREEN: Reading pane overlay taking precedence */}
              {selectedStoryForReading ? (
                <ReadingView
                  key={selectedStoryForReading.id}
                  story={selectedStoryForReading}
                  onBack={() => setSelectedStoryForReading(null)}
                  currentUser={currentUser!}
                  onToggleFeatured={handleToggleStoryFeatured}
                  onFollowAuthor={handleFollowAuthor}
                  comments={comments}
                  onAddComment={handleAddComment}
                  onLikeComment={handleLikeComment}
                  onAddReply={handleAddReply}
                  onDeleteComment={handleDeleteComment}
                  onToggleFavorite={handleToggleFavorite}
                  isFavorited={favorites.includes(selectedStoryForReading.id)}
                  onToggleStoryLike={handleToggleStoryLike}
                  isLiked={(selectedStoryForReading.likedBy || []).includes(currentUser?.id || '') || likedStories.includes(selectedStoryForReading.id)}
                  onRateStory={handleRateStory}
                  userRating={myRatings[selectedStoryForReading.id] || 0}
                  onMarkChapterRead={handleMarkChapterRead}
                  readChapters={readChapters.map(key => key.includes(':') ? key.split(':').pop() || key : key)}
                  onOpenDiscussion={handleOpenDiscussion}
                  currentlyReading={currentlyReading}
                  completedStories={completedStories}
                  readLater={readLater}
                  onToggleCurrentlyReading={handleToggleCurrentlyReading}
                  onToggleCompletedStories={handleToggleCompletedStories}
                  onToggleReadLater={handleToggleReadLater}
                  onViewProfile={handleViewUserProfile}
                />
              ) : (
                /* STANDARD DIRECT VIEW SWITCHERS */
                <>
                  {activeTab === 'home' && (
                    <HomeView
                      currentUser={currentUser!}
                      allUsers={allUsers}
                      stories={allowedStories}
                      favorites={favorites}
                      readChapters={readChapters.map(key => key.includes(':') ? key.split(':').pop() || key : key)}
                      lastReadProgress={lastReadProgress}
                      onSelectStory={handleSelectStoryForReading}
                      onToggleFavorite={handleToggleFavorite}
                      onFollowAuthor={handleFollowAuthor}
                      onOpenDiscussion={handleOpenDiscussion}
                      onViewProfile={handleViewUserProfile}
                      onOpenLibrary={(query) => {
                        if (query) setActiveFilter({ type: 'search', value: query });
                        setActiveTab('explore');
                      }}
                      onStartWriting={() => setActiveTab(currentUser?.role !== 'Lecteur' ? 'write' : 'profile')}
                    />
                  )}

                  {activeTab === 'explore' && (
                    <ExplorerView
                      stories={allowedStories}
                      users={allUsers}
                      onSelectStory={(story) => handleSelectStoryForReading(story)}
                      activeFilter={activeFilter}
                      onClearFilter={handleClearFilter}
                      onOpenDiscussion={handleOpenDiscussion}
                      onViewProfile={handleViewUserProfile}
                    />
                  )}

                  {activeTab === 'achievements' && (
                    <AchievementsView currentUser={currentUser} />
                  )}

                  {activeTab === 'write' && currentUser?.role !== 'Lecteur' && (
                    <WriteView
                      currentUser={currentUser!}
                      userStories={userWritings}
                      onCreateStory={handleCreateStory}
                      onUpdateStory={handleUpdateStory}
                      onAddChapter={handleAddChapter}
                      onUpdateChapter={handleUpdateChapter}
                      onDeleteChapter={handleDeleteChapter}
                      onDeleteStory={handleDeleteStory}
                      comments={comments}
                    />
                  )}

                  {activeTab === 'messages' && (
                    <MessagesView
                      currentUser={currentUser!}
                      allUsers={allUsers}
                      conversations={conversations}
                      setConversations={setConversations}
                      onStartCall={handleStartCall}
                      onlineUserIds={onlineUserIds}
                      typingUserIds={typingUserIds}
                      onTyping={(receiverId, isTyping) => socketRef.current?.emit(isTyping ? 'typing' : 'stop_typing', { senderId: currentUser!.id, receiverId })}
                      onViewProfile={handleViewUserProfile}
                      onSyncStickers={(stickers) => handleUpdateProfile({ customStickers: stickers })}
                      onSendMessage={handleSendMessage}
                      onDeleteConversation={handleDeleteConversation}
                      onStartConversation={handleStartConversation}
                      activeConversationId={activeConversationId}
                      setActiveConversationId={setActiveConversationId}
                      groups={groups}
                      setGroups={setGroups}
                      groupMessages={groupMessages}
                      setGroupMessages={setGroupMessages}
                      onCreateGroup={handleCreateGroup}
                      onSendGroupMessage={handleSendGroupMessage}
                      onUpdateGroup={handleUpdateGroup}
                      onAddGroupMembers={handleAddGroupMembers}
                      onRemoveGroupMember={handleRemoveGroupMember}
                      groupTyping={groupTyping}
                      onGroupTyping={(groupId, memberIds, isTyping) => socketRef.current?.emit(isTyping ? 'group_typing' : 'group_stop_typing', { groupId, memberIds, senderName: currentUser!.username })}
                      onStartGroupCall={handleStartGroupCall}
                      stories={allowedStories}
                      onSelectStory={handleSelectStoryForReading}
                    />
                  )}

                  {activeTab === 'profile' && (
                    <ProfileView
                      currentUser={currentUser!}
                      authorCertification={authorCertification}
                      viewedUser={viewedUser}
                      onBackToMyProfile={() => setViewedUser(null)}
                      onUpdateProfile={handleUpdateProfile}
                      onUpdateAndVerifyUserStats={handleUpdateAndVerifyUserStats}
                      stories={allowedStories}
                      favorites={favorites}
                      onRemoveFavorite={handleToggleFavorite}
                      onAddChapter={handleAddChapter}
                      onUpdateChapter={handleUpdateChapter}
                      onDeleteChapter={handleDeleteChapter}
                      onUpdateStory={handleUpdateStory}
                      onDeleteStory={handleDeleteStory}
                      currentlyReading={currentlyReading}
                      completedStories={completedStories}
                      readLater={readLater}
                      onToggleCurrentlyReading={handleToggleCurrentlyReading}
                      onToggleCompletedStories={handleToggleCompletedStories}
                      onToggleReadLater={handleToggleReadLater}
                      onLogout={handleLogout}
                      onSelectStory={handleSelectStoryForReading}
                      onFollowAuthor={handleFollowAuthor}
                      onOpenDiscussion={handleOpenDiscussion}
                      onViewProfile={handleViewUserProfile}
                      allUsers={allUsers}
                      friendIds={!viewedUser ? serverFriendIds : undefined}
                    />
                  )}

                  {activeTab === 'admin' && currentUser.role === 'Administrateur' && (
                    <AdminDashboard
                      currentUser={currentUser}
                      allUsers={allUsers}
                      stories={stories}
                      onToggleUserVerification={handleToggleUserVerification}
                      onBanUser={handleBanUser}
                      onUnbanUser={handleUnbanUser}
                      onToggleUserFeatured={handleToggleUserFeatured}
                      onDeleteStory={handleDeleteStory}
                      onDismissFlag={handleDismissFlag}
                      onDismissUserFlag={handleDismissUserFlag}
                    />
                  )}
                </>
              )}

              </Suspense>
            </PullToRefresh>
          </div>
        )}

        {/* APPEL AUDIO — surcouche globale (entrant / sortant / en cours) */}
        <CallOverlay
          status={callStatus}
          peer={callPeer}
          remoteStream={callRemoteStream}
          onAccept={() => callManagerRef.current?.accept()}
          onReject={() => callManagerRef.current?.reject()}
          onHangup={() => callManagerRef.current?.end()}
          onToggleMute={() => callManagerRef.current?.toggleMute() ?? false}
          onToggleNoise={(on) => { callManagerRef.current?.setNoiseReduction(on); }}
        />

        {/* APPEL DE GROUPE — surcouche (invitation + appel en cours) */}
        {currentUser && (
          <GroupCallOverlay
            activeGroupId={groupCallId}
            participantIds={groupCallParticipants}
            invite={groupCallInvite}
            groups={groups}
            allUsers={allUsers}
            currentUser={currentUser}
            onAccept={acceptGroupCall}
            onDecline={() => setGroupCallInvite(null)}
            onLeave={leaveGroupCall}
            onToggleMute={() => groupCallManagerRef.current?.toggleMute() ?? false}
          />
        )}

        {/* REAL-TIME NOTIFICATIONS TOASTS OVERLAY */}
        <div className="fixed top-6 right-6 z-50 flex flex-col gap-3 max-w-sm w-full pointer-events-none font-sans">
          {realtimeToasts.map((toast) => (
            <div
              key={toast.id}
              className="p-4 rounded-2xl border bg-white dark:bg-zinc-950 border-purple-500/25 text-zinc-900 dark:text-zinc-50 shadow-xl flex items-start gap-3 pointer-events-auto animate-slide-up duration-300 w-full"
            >
              <div className="p-2 bg-purple-500/10 text-purple-600 dark:text-purple-400 rounded-xl shrink-0">
                <Sparkles className="w-4 h-4" />
              </div>
              <div className="flex-1 min-w-0">
                <span className="text-[9px] uppercase tracking-wider font-extrabold text-purple-600 dark:text-purple-400 block">
                  Notification PLUME
                </span>
                <h4 className="text-xs font-serif font-black text-zinc-900 dark:text-white leading-tight mt-0.5">
                  {toast.title}
                </h4>
                <p className="text-[10px] text-zinc-500 dark:text-zinc-400 leading-normal mt-1">
                  {toast.message}
                </p>
              </div>
              <button
                onClick={() => setRealtimeToasts((prev) => prev.filter((item) => item.id !== toast.id))}
                className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 text-xs font-black shrink-0 transition"
                title="Fermer"
              >
                ✕
              </button>
            </div>
          ))}
        </div>

        {/* ELEVATED PREMIUM ACCOMPLISHMENTS TOASTS OVERLAY */}
        <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-3 max-w-sm w-full pointer-events-none font-sans">
          {unlockedToasts.map(toast => {
            let rarityColorClass = "border-zinc-200 dark:border-zinc-800 text-zinc-800 dark:text-zinc-200";
            let bgClass = "bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-50 border-zinc-200 dark:border-zinc-800";
            let alertRarity = "Commun";
            
            if (toast.rarity === 'rare') {
              rarityColorClass = "text-purple-600 dark:text-purple-400";
              bgClass = "bg-white dark:bg-zinc-950 border-purple-500/30 text-zinc-950 dark:text-zinc-50 shadow-lg";
              alertRarity = "Rare";
            } else if (toast.rarity === 'epic') {
              rarityColorClass = "text-purple-300";
              bgClass = "bg-gradient-to-r from-zinc-950 to-[#231535] border-purple-800 text-white shadow-xl";
              alertRarity = "Épique";
            } else if (toast.rarity === 'mythic') {
              rarityColorClass = "text-purple-400 font-black animate-pulse";
              bgClass = "bg-black border-2 border-purple-505 text-white shadow-2xl";
              alertRarity = "Mythique";
            }

            return (
              <div
                key={toast.id}
                className={`p-4 rounded-2xl border ${bgClass} flex items-start gap-3 pointer-events-auto animate-slide-up duration-300 w-full`}
              >
                <div className="p-2 bg-purple-500/10 text-purple-600 dark:text-purple-405 rounded-xl shrink-0">
                  🏆
                </div>
                <div className="flex-1 min-w-0">
                  <span className="text-[9px] uppercase tracking-wider font-extrabold text-purple-600 dark:text-purple-400 block">
                    Trophée Débloqué • {alertRarity}
                  </span>
                  <h4 className="text-xs font-serif font-black text-zinc-900 dark:text-white leading-tight mt-0.5">
                    {toast.title}
                  </h4>
                  <p className="text-[10px] text-zinc-500 dark:text-zinc-400 leading-normal mt-1">
                    {toast.realDesc}
                  </p>
                </div>
                <button
                  onClick={() => setUnlockedToasts(prev => prev.filter(t => t.id !== toast.id))}
                  className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 text-xs font-black shrink-0 transition"
                  title="Fermer"
                >
                  ✕
                </button>
              </div>
            );
          })}
        </div>

      </div>
    </div>
  );
}
