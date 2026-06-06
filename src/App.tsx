/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
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
import { USERS, INITIAL_STORIES, INITIAL_COMMENTS, INITIAL_MESSAGES } from './data';
import MainNavigation from './components/MainNavigation';
import LateralMenu from './components/LateralMenu';
import ExplorerView from './components/ExplorerView';
import ReadingView from './components/ReadingView';
import WriteView from './components/WriteView';
import MessagesView from './components/MessagesView';
import ProfileView from './components/ProfileView';
import AdminDashboard from './components/AdminDashboard';
import HomeView from './components/HomeView';
import AuthView from './components/AuthView';
import { calculateAge, isUserAgeAllowed } from './utils/age';
import { 
  getUserStats, 
  saveUserStats, 
  countAndEvaluateCertification, 
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
    FRIEND_REQUEST: 'follow',
    FRIEND_ACCEPTED: 'follow',
    MESSAGE: 'comment',
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


  const handleMarkNotificationsRead = (type?: AppNotification['type'] | 'all') => {
    if (!currentUser) return;
    const nextNotifications = notifications.map((notification) => {
      if (notification.targetUserId !== currentUser.id) return notification;
      if (!type || type === 'all' || notification.type === type) {
        return { ...notification, read: true };
      }
      return notification;
    });

    saveNotifications(nextNotifications);

    if (isAuthenticated && localStorage.getItem('plume_auth_token')) {
      fetch(`/api/notifications/${currentUser.id}/read-all`, {
        method: 'PUT',
        headers: authHeaders(),
      }).catch(() => {});
    }
  };

  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    return localStorage.getItem('plume_is_logged_in') === 'true';
  });

  const authHeaders = (extra: Record<string, string> = {}) => {
    const token = localStorage.getItem('plume_auth_token');
    return {
      ...extra,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };
  };

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
    const hasToken = !!localStorage.getItem('plume_auth_token');
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

  const ensureSimulatorAccounts = (backendUsers: User[]): User[] => {
    const isAuth = isAuthenticated || !!localStorage.getItem('plume_auth_token');
    if (isAuth) {
      return backendUsers.map(u => mergeLocalUserEdit(u, true));
    }

    const mergedById = new Map<string, User>();
    const backendIds = new Set(backendUsers.map(u => u.id));

    [...backendUsers, ...USERS].forEach((user) => {
      if (!user?.id) return;
      const existing = mergedById.get(user.id);
      const isBackend = backendIds.has(user.id);
      mergedById.set(user.id, mergeLocalUserEdit(existing ? { ...user, ...existing } : user, isBackend));
    });

    const users = Array.from(mergedById.values());
    const requiredRoles: UserRole[] = ['Lecteur', 'Auteur', 'Administrateur'];

    requiredRoles.forEach((role) => {
      if (!users.some((user) => user.role === role)) {
        const seed = USERS.find((user) => user.role === role);
        if (seed) {
          users.push(mergeLocalUserEdit(seed, false));
        }
      }
    });

    return users;
  };

  const getLikedStoriesStorageKey = (userId: string) => `plume_liked_stories_${userId}`;
  const getFavoritesStorageKey = (userId: string) => `plume_favorites_${userId}`;

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

    const socket = io(window.location.origin, {
      transports: ['websocket', 'polling'],
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
            messages: c.messages.map((m) => m.senderId === payload.readerId ? { ...m, isRead: true } : m)
          };
        }
        return c;
      }));
    });

    socket.on('user_followed', () => {
      refreshUsersData();
    });

    socket.on('user_unfollowed', () => {
      refreshUsersData();
    });

    return () => {
      socket.off('connect');
      socket.off('new_notification');
      socket.off('conversation_created');
      socket.off('new_message');
      socket.off('messages_read');
      socket.off('user_followed');
      socket.off('user_unfollowed');
      socket.disconnect();
      socketRef.current = null;
    };
  }, [isAuthenticated, currentUser?.id]);

  const [favorites, setFavorites] = useState<string[]>(() => {
    if (!currentUser?.id) return ['story_cosmos_1'];
    try {
      const savedUserFavorites = localStorage.getItem(getFavoritesStorageKey(currentUser.id));
      if (savedUserFavorites) return JSON.parse(savedUserFavorites);
    } catch (e) {
      console.error(e);
    }

    try {
      const legacyFavorites = localStorage.getItem('plume_favorites');
      return legacyFavorites ? JSON.parse(legacyFavorites) : ['story_cosmos_1']; // Initial seeded favorite
    } catch {
      return ['story_cosmos_1'];
    }
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
    try {
      const savedUserFavorites = localStorage.getItem(getFavoritesStorageKey(currentUser.id));
      const legacyFavorites = localStorage.getItem('plume_favorites');

      setFavorites(
        savedUserFavorites
          ? JSON.parse(savedUserFavorites)
          : legacyFavorites
            ? JSON.parse(legacyFavorites)
            : []
      );
    } catch (e) {
      console.error(e);
    }
  }, [currentUser?.id]);

  const [currentlyReading, setCurrentlyReading] = useState<string[]>(() => {
    const saved = localStorage.getItem('plume_currently_reading');
    return saved ? JSON.parse(saved) : ['story_cosmos_1']; // Seeded first book
  });

  const [completedStories, setCompletedStories] = useState<string[]>(() => {
    const saved = localStorage.getItem('plume_completed');
    return saved ? JSON.parse(saved) : [];
  });

  const [readLater, setReadLater] = useState<string[]>(() => {
    const saved = localStorage.getItem('plume_read_later');
    return saved ? JSON.parse(saved) : [];
  });

  const [readChapters, setReadChapters] = useState<string[]>(() => {
    const saved = localStorage.getItem('plume_read_chapters');
    return saved ? JSON.parse(saved) : [];
  });

  const [lastReadProgress, setLastReadProgress] = useState<{ storyId: string; chapterId: string } | null>(() => {
    const saved = localStorage.getItem('plume_last_read_progress');
    return saved ? JSON.parse(saved) : null;
  });

  // UI state variables
  const [activeTab, setActiveTab] = useState<'home' | 'explore' | 'write' | 'messages' | 'profile' | 'admin'>('home');
  const [activeInterlocutorId, setActiveInterlocutorId] = useState<string>(() => {
    const saved = localStorage.getItem('plume_active_interlocutor_id');
    return saved ? saved : 'user_author';
  });

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

  const [darkMode, setDarkMode] = useState<boolean>(() => {
    const saved = localStorage.getItem('plume_dark_mode');
    return saved ? JSON.parse(saved) : true; // Default to eye-safe dark theme
  });

  const refreshUsersData = async () => {
    try {
      const usersRes = await fetch('/api/users');
      if (usersRes.ok) {
        const fetchedUsers = await usersRes.json();
        const mergedUsers = ensureSimulatorAccounts(fetchedUsers as User[]);
        setAllUsers(mergedUsers);
        
        const token = localStorage.getItem('plume_auth_token');
        if (token) {
          const meRes = await fetch('/api/auth/me', { headers: authHeaders() });
          if (meRes.ok) {
            const me = mergeLocalUserEdit(await meRes.json(), true);
            setCurrentUser(me);
            localStorage.setItem('plume_current_user', JSON.stringify(me));
            setIsAuthenticated(true);
            return me;
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
        // 1. Fetch Users & Me
        const me = await refreshUsersData();
        const token = localStorage.getItem('plume_auth_token');
        const headers = authHeaders();

        if (token && me) {
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
    localStorage.setItem('plume_current_user', JSON.stringify(currentUser));
  }, [currentUser]);

  useEffect(() => {
    localStorage.setItem('plume_is_logged_in', isAuthenticated ? 'true' : 'false');
  }, [isAuthenticated]);

  useEffect(() => {
    localStorage.setItem('plume_favorites', JSON.stringify(favorites));
  }, [favorites]);

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
    localStorage.setItem('plume_currently_reading', JSON.stringify(currentlyReading));
  }, [currentlyReading]);

  useEffect(() => {
    localStorage.setItem('plume_completed', JSON.stringify(completedStories));
  }, [completedStories]);

  useEffect(() => {
    localStorage.setItem('plume_read_later', JSON.stringify(readLater));
  }, [readLater]);

  useEffect(() => {
    localStorage.setItem('plume_read_chapters', JSON.stringify(readChapters));
  }, [readChapters]);

  useEffect(() => {
    if (lastReadProgress) {
      localStorage.setItem('plume_last_read_progress', JSON.stringify(lastReadProgress));
    }
  }, [lastReadProgress]);

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

  // Switch simulation profile without modifying the role of the previous account.
  const handleQuickRoleChange = (role: UserRole) => {
    const availableUsers = ensureSimulatorAccounts(allUsers);
    const targetUser = availableUsers.find(u => u.role === role);

    if (!targetUser) {
      console.error(`[PLUME] Impossible de trouver ou créer un compte ${role} pour le simulateur.`);
      return;
    }

    const safeTargetUser = mergeLocalUserEdit(targetUser);
    setAllUsers(availableUsers.map((u) => u.id === safeTargetUser.id ? safeTargetUser : u));
    setCurrentUser(safeTargetUser);
    localStorage.setItem('plume_current_user', JSON.stringify(safeTargetUser));
    setViewedUser(null);
    setSelectedStoryForReading(null);

    if (role === 'Administrateur') {
      setActiveTab('admin');
    } else if (role === 'Auteur') {
      setActiveTab('write');
    } else {
      setActiveTab('home');
    }
  };

  // Update profile attributes (bio, preferences)
  const handleUpdateProfile = (updatedFields: Partial<User>) => {
    if (!currentUser) return;
    const originalCurrentUser = currentUser;
    const originalAllUsers = allUsers;
    
    let nextUser = { ...currentUser, ...updatedFields } as User;
    
    // Evaluate stats for isVerified when changing role/type of account
    let certifiedUser: User | null = null;
    if (updatedFields.role) {
      const stats = getUserStats(currentUser.id, currentUser.role, currentUser.username);
      const evalResult = countAndEvaluateCertification(updatedFields.role, stats);
      if (evalResult.shouldCertify && !nextUser.isVerified) {
        certifiedUser = { ...nextUser, isVerified: true };
        nextUser = certifiedUser;
      }
    }

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

    if (isAuthenticated) {
      // Sync profile modification to the backend server
      fetch(`/api/users/${currentUser.id}`, {
        method: 'PUT',
        headers: authHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify(nextUser)
      })
      .then(async (res) => {
        if (res.ok) {
          const syncedUser = await res.json();
          // Remove local edits to avoid stale override
          const edits = getLocalUserEdits();
          delete edits[currentUser.id];
          localStorage.setItem('plume_user_edits_by_id', JSON.stringify(edits));

          setCurrentUser(syncedUser);
          localStorage.setItem('plume_current_user', JSON.stringify(syncedUser));
          setAllUsers(prev => prev.map(u => u.id === syncedUser.id ? syncedUser : u));
        } else {
          let errorMsg = "Impossible de mettre à jour le profil sur le serveur.";
          try {
            const errData = await res.json();
            if (errData.error) errorMsg += ` (${errData.error})`;
          } catch {}
          alert(errorMsg);
          
          // Revert state
          setCurrentUser(originalCurrentUser);
          setAllUsers(originalAllUsers);
        }
      })
      .catch(e => {
        console.error('[PLUME] Erreur de mise à jour du profil backend :', e);
        alert("Erreur de connexion. Le profil n'a pas pu être enregistré.");
        // Revert state
        setCurrentUser(originalCurrentUser);
        setAllUsers(originalAllUsers);
      });
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

    // Evaluate for automatic certification
    const evalResult = countAndEvaluateCertification(currentUser.role, nextStats, currentUser.id);
    if (evalResult.shouldCertify && !currentUser.isVerified) {
      // Auto verify!
      const nextUser = { ...currentUser!, isVerified: true };
      setCurrentUser(nextUser);
      setAllUsers(prev => prev.map(u => u.id === currentUser!.id ? nextUser : u));

      fetch(`/api/users/${currentUser!.id}`, {
        method: 'PUT',
        headers: authHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify(nextUser)
      }).catch(e => console.error('[PLUME] Erreur de certification auto :', e));
    } else if (!evalResult.shouldCertify && currentUser.isVerified) {
      // Auto decertify!
      const nextUser = { ...currentUser!, isVerified: false };
      setCurrentUser(nextUser);
      setAllUsers(prev => prev.map(u => u.id === currentUser!.id ? nextUser : u));

      fetch(`/api/users/${currentUser!.id}`, {
        method: 'PUT',
        headers: authHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify(nextUser)
      }).catch(e => console.error('[PLUME] Erreur de décertification auto :', e));
    }
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

    if (isAuthenticated) {
      const token = localStorage.getItem('plume_auth_token');
      if (!token) {
        alert("Erreur : session expirée ou non connecté. Veuillez vous reconnecter pour vous abonner.");
        setIsAuthenticated(false);
        setCurrentUser(null);
        return;
      }
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

    fetch(`/api/stories/${storyId}/favorite`, {
      method: hasFavorited ? 'DELETE' : 'POST',
      headers: authHeaders(),
    }).catch(() => {
      // Si cette route n'existe pas encore côté serveur, le PUT de syncStoryMetricsToServer garde déjà le compteur favoritesCount et favoritedBy à jour.
    });
  };

  // Like / unlike a story. One user = one like per story.
  // Les mentions du profil de l'auteur sont calculées à partir de story.likes.
  // Donc chaque like reçu sur un livre augmente automatiquement la section « Mentions ».
  const handleToggleStoryLike = (storyId: string) => {
    if (!currentUser) return;
    const targetStory = stories.find((story) => story.id === storyId) || selectedStoryForReading;

    if (!targetStory || targetStory.id !== storyId) return;

    // Pour une version publique propre, un auteur ne doit pas augmenter ses propres mentions.
    if (targetStory.authorId === currentUser.id) {
      alert("Vous ne pouvez pas aimer votre propre histoire. Les mentions viennent des lecteurs.");
      return;
    }

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

    fetch(`/api/stories/${storyId}/like`, {
      method: hasLiked ? 'DELETE' : 'POST',
      headers: authHeaders(),
    }).catch(() => {
      // Si cette route n'existe pas encore côté serveur, le PUT de syncStoryMetricsToServer garde déjà le compteur likes et likedBy à jour.
    });
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

    if (isAuthenticated && localStorage.getItem('plume_auth_token')) {
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
    const savedLikedComments = JSON.parse(localStorage.getItem(likedCommentsKey) || '[]') as string[];

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

    fetch(`/api/comments/${commentId}/like`, {
      method: hasLiked ? 'DELETE' : 'POST',
      headers: authHeaders({ 'Content-Type': 'application/json' }),
    }).catch((e) => {
      console.warn('[PLUME] Like commentaire non synchronisé côté serveur, état local conservé :', e);
    });
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
      rating: 5.0,
      isFlagged: false,
      ageRating: storyData.ageRating || 'all'
    };

    setStories([newStory, ...stories]);

    // Send new story to the backend server
    fetch('/api/stories', {
      method: 'POST',
      headers: authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(newStory)
    }).catch(e => console.error('[PLUME] Erreur de création de récit sur le serveur :', e));
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
      }).catch(e => console.error('[PLUME] Erreur de mise à jour du récit sur le serveur :', e));
    }
  };

  // Chapter integrations under stories
  const handleAddChapter = (storyId: string, chapterData: Partial<Chapter>) => {
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

    setStories(stories.map(s => {
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
        }).catch(e => console.error('[PLUME] Erreur ajout de chapitre :', e));

        return updatedStory;
      }
      return s;
    }));
  };

  const handleUpdateChapter = (storyId: string, chapterId: string, updatedChapter: Partial<Chapter>) => {
    setStories(stories.map(s => {
      if (s.id === storyId) {
        const freshChapters = s.chapters.map(ch => ch.id === chapterId ? { ...ch, ...updatedChapter } : ch);
        const matchChapter = freshChapters.find(ch => ch.id === chapterId);
        
        if (matchChapter) {
          // Sync updated chapter draft / published status to server
          fetch(`/api/stories/${storyId}/chapters/${chapterId}`, {
            method: 'PUT',
            headers: authHeaders({ 'Content-Type': 'application/json' }),
            body: JSON.stringify(matchChapter)
          }).catch(e => console.error('[PLUME] Erreur édition chapitre :', e));
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
        }).catch(e => console.error('[PLUME] Erreur d’effacement chapitre :', e));

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

  const handleSimulateReceiveMessage = (conversationId: string, senderId: string, content: string) => {
    if (!currentUser) return;
    const sender = allUsers.find(u => u.id === senderId) || allUsers[0];
    
    // Simulate incoming message creation on backend
    fetch('/api/messages', {
      method: 'POST',
      headers: authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ conversationId, senderId: sender.id, content })
    }).catch(e => console.error('[PLUME] Erreur réception message simulé backend :', e));
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

  const handleBanUser = (userId: string) => {
    const targetStories = stories.filter(s => s.authorId === userId);

    setAllUsers(allUsers.filter(u => u.id !== userId));
    setStories(stories.filter(s => s.authorId !== userId));

    // Clear banned users works on backend
    targetStories.forEach(s => {
       fetch(`/api/stories/${s.id}`, { method: 'DELETE', headers: authHeaders() }).catch(() => {});
    });
    alert("Compte suspendu avec succès. Ses œuvres ont été dépubliées.");
  };

  const handleDeleteStory = (storyId: string) => {
    setStories(stories.filter(s => s.id !== storyId));
    setComments(comments.filter(c => c.storyId !== storyId));

    // DELETE request to remove story
    fetch(`/api/stories/${storyId}`, { method: 'DELETE', headers: authHeaders() })
      .then(() => alert("L'histoire signalée a été retirée définitivement de la plateforme."))
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

  // Log Out Simulation
  const handleLogout = () => {
    setIsAuthenticated(false);
    setCurrentUser(null);
    localStorage.removeItem('plume_is_logged_in');
    localStorage.removeItem('plume_auth_token');
    localStorage.removeItem('plume_current_user');
  };

  // Wrap fetch globally to catch 401 errors
  useEffect(() => {
    const originalFetch = window.fetch;
    window.fetch = async (input, init) => {
      try {
        const response = await originalFetch(input, init);
        if (response.status === 401) {
          const urlStr = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
          if (!urlStr.includes('/api/auth/login') && !urlStr.includes('/api/auth/verify-otp') && !urlStr.includes('/api/auth/otp/request')) {
            console.warn('[AUTH] Intercepted 401 Unauthorized response, logging out user.');
            handleLogout();
            alert("Votre session a expiré. Veuillez vous reconnecter.");
          }
        }
        return response;
      } catch (error) {
        throw error;
      }
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

  const handleSelectStoryForReading = (story: Story) => {
    const age = calculateAge(currentUser?.birthDate);
    if (!isUserAgeAllowed(age, story.ageRating) && story.authorId !== currentUser?.id) {
      alert(`Accès interdit. Cette œuvre est classée ${story.ageRating === 'all' || !story.ageRating ? 'Tout public' : story.ageRating + ' ans et plus'} et vous avez ${age} ans.`);
      return;
    }
    const freshStory = stories.find((s) => s.id === story.id) || story;
    const viewedStory = handleRecordStoryView(freshStory.id) || freshStory;
    setSelectedStoryForReading(viewedStory);
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
              onQuickRoleChange={handleQuickRoleChange}
              notifications={notifications.filter((notification) => notification.targetUserId === currentUser?.id)}
              onMarkNotificationsRead={handleMarkNotificationsRead}
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
            <div className="flex-1 overflow-y-auto pb-28 pt-2 scrollbar-none scroll-smooth">
              
              {/* SPECIAL SCREEN: Reading pane overlay taking precedence */}
              {selectedStoryForReading ? (
                <ReadingView
                  story={selectedStoryForReading}
                  onBack={() => setSelectedStoryForReading(null)}
                  currentUser={currentUser!}
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
                    />
                  )}

                  {activeTab === 'explore' && (
                    <ExplorerView
                      stories={allowedStories}
                      onSelectStory={(story) => handleSelectStoryForReading(story)}
                      activeFilter={activeFilter}
                      onClearFilter={handleClearFilter}
                      onOpenDiscussion={handleOpenDiscussion}
                      onViewProfile={handleViewUserProfile}
                    />
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
                      onSendMessage={handleSendMessage}
                      onSimulateReceiveMessage={handleSimulateReceiveMessage}
                      onStartConversation={handleStartConversation}
                      activeConversationId={activeConversationId}
                      setActiveConversationId={setActiveConversationId}
                      groups={groups}
                      setGroups={setGroups}
                      groupMessages={groupMessages}
                      setGroupMessages={setGroupMessages}
                      stories={allowedStories}
                      onSelectStory={handleSelectStoryForReading}
                    />
                  )}

                  {activeTab === 'profile' && (
                    <ProfileView
                      currentUser={currentUser!}
                      viewedUser={viewedUser}
                      onBackToMyProfile={() => setViewedUser(null)}
                      onUpdateProfile={handleUpdateProfile}
                      onQuickRoleChange={handleQuickRoleChange}
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
                      onDeleteStory={handleDeleteStory}
                      onDismissFlag={handleDismissFlag}
                      onDismissUserFlag={handleDismissUserFlag}
                    />
                  )}
                </>
              )}

            </div>
          </div>
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
