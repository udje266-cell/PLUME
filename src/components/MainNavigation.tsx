/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { 
  Home, 
  Search, 
  PenTool, 
  MessageSquare, 
  User as UserIcon, 
  Menu, 
  Sun, 
  Moon, 
  ShieldCheck,
  Wifi,
  Battery,
  Signal,
  Bell,
  Heart,
  MessageCircle,
  Users,
  Send,
  Star,
  Trophy,
  Feather
} from 'lucide-react';
import { User, UserRole, AppNotification } from '../types';
import Logo from './Logo';
import { VerifiedBadge } from './VerifiedBadge';

interface MainNavigationProps {
  activeTab: 'home' | 'explore' | 'write' | 'messages' | 'profile' | 'admin' | 'achievements';
  onChangeTab: (tab: 'home' | 'explore' | 'write' | 'messages' | 'profile' | 'admin' | 'achievements') => void;
  currentUser: User;
  onOpenSidebar: () => void;
  darkMode: boolean;
  onToggleDarkMode: () => void;
  notifications?: AppNotification[];
  onMarkNotificationsRead?: (type?: AppNotification['type'] | AppNotification['type'][] | 'all') => void;
  onOpenNotification?: (notification: AppNotification) => void;
  unreadMessagesCount?: number;
}

export default function MainNavigation({
  activeTab,
  onChangeTab,
  currentUser,
  onOpenSidebar,
  darkMode,
  onToggleDarkMode,
  notifications = [],
  onMarkNotificationsRead,
  onOpenNotification,
  unreadMessagesCount = 0,
}: MainNavigationProps) {

  const canWrite = currentUser.role === 'Auteur';
  const isAdmin = currentUser.role === 'Administrateur';
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [activeNotificationTab, setActiveNotificationTab] = useState<string>('all');

  // Catégories alignées sur les vrais types de notifications du serveur.
  const NOTIF_CATEGORIES: { id: string; label: string; types: AppNotification['type'][] | null }[] = [
    { id: 'all', label: 'Tout', types: null },
    { id: 'social', label: 'Social', types: ['follow', 'friend'] },
    { id: 'comment', label: 'Com.', types: ['comment'] },
    { id: 'reaction', label: 'Réact.', types: ['like', 'favorite'] },
    { id: 'message', label: 'Msg', types: ['message'] },
  ];

  const unreadCount = notifications.filter((notification) => !notification.read).length;
  const countFor = (types: AppNotification['type'][] | null) =>
    types ? notifications.filter((n) => types.includes(n.type)).length : notifications.length;

  const activeCategory = NOTIF_CATEGORIES.find((c) => c.id === activeNotificationTab) || NOTIF_CATEGORIES[0];
  const getVisibleNotifications = () =>
    activeCategory.types ? notifications.filter((n) => activeCategory.types!.includes(n.type)) : notifications;

  const notifIcon = (t: AppNotification['type']) =>
    t === 'follow' || t === 'friend' ? Users : t === 'comment' ? MessageCircle : t === 'message' ? Send : t === 'favorite' ? Star : Heart;
  const notifColor = (t: AppNotification['type']) =>
    t === 'like' ? 'text-pink-500' : t === 'favorite' ? 'text-amber-500' : t === 'comment' ? 'text-purple-500' : t === 'message' ? 'text-blue-500' : 'text-indigo-500';

  const formatNotificationDate = (dateValue: string) => {
    const date = new Date(dateValue);
    if (Number.isNaN(date.getTime())) return '';
    return date.toLocaleString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // State to hold live digital clock simulation
  const [time, setTime] = useState('');

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      const hh = String(now.getHours()).padStart(2, '0');
      const mm = String(now.getMinutes()).padStart(2, '0');
      setTime(`${hh}:${mm}`);
    };
    updateTime();
    const timer = setInterval(updateTime, 1000);
    return () => clearInterval(timer);
  }, []);

  // Barre du bas : Accueil · Succès · [Écrire centré] · Message · Profil.
  // L'« Explorer » est devenu la « Bibliothèque », ouverte depuis la barre de
  // recherche de l'accueil (plus dans la barre du bas). Le bouton central
  // « Écrire » est mis en avant (rond surélevé).
  const leftTabs = [
    { id: 'home' as const, label: 'Accueil', icon: <Home className="w-5 h-5" /> },
    { id: 'achievements' as const, label: 'Succès', icon: <Trophy className="w-5 h-5" /> },
  ];
  const rightTabs = [
    { id: 'messages' as const, label: 'Message', icon: <MessageSquare className="w-5 h-5" /> },
    { id: 'profile' as const, label: 'Profil', icon: <UserIcon className="w-5 h-5" /> },
    ...(isAdmin ? [{ id: 'admin' as const, label: 'Admin', icon: <ShieldCheck className="w-5 h-5" /> }] : []),
  ];

  const renderTab = (tab: { id: any; label: string; icon: React.ReactNode }) => {
    const isSelected = activeTab === tab.id;
    return (
      <button
        key={tab.id}
        id={`nav-tab-${tab.id}`}
        onClick={() => onChangeTab(tab.id)}
        className={`relative flex flex-col items-center justify-center p-1.5 focus:outline-none transition-all cursor-pointer ${
          isSelected ? 'text-[#7C3AED] dark:text-purple-400 scale-105' : 'text-gray-400 dark:text-gray-500'
        }`}
      >
        <div className="relative">
          {tab.icon}
          {tab.id === 'messages' && unreadMessagesCount > 0 && (
            <span className="absolute -top-1.5 -right-1.5 min-w-[15px] h-3.5 px-0.75 rounded-full bg-purple-600 text-white text-[8px] font-black flex items-center justify-center border border-white dark:border-black">
              {unreadMessagesCount > 9 ? '9+' : unreadMessagesCount}
            </span>
          )}
        </div>
        <span className="text-[9px] mt-1 font-bold font-sans tracking-wide">{tab.label}</span>
        {isSelected && (
          <span className="absolute -bottom-1.5 w-1.5 h-1.5 rounded-full bg-[#7C3AED] dark:bg-purple-400" />
        )}
      </button>
    );
  };

  return (
    <div className="w-full flex flex-col z-30 select-none">
      
      {/* TOP ACTIONS APP HEADER */}
      <header className="w-full bg-white/90 dark:bg-black/90 backdrop-blur-md transition-colors py-3 px-4">
        <div className="flex items-center justify-between">
          
          {/* Left: Filter Toggle Button */}
          <button
            id="sidebar-toggle-btn"
            onClick={onOpenSidebar}
            className="p-2.5 rounded-xl text-gray-500 hover:text-purple-600 dark:text-gray-400 dark:hover:text-purple-400 hover:bg-gray-100 dark:hover:bg-purple-950/20 transition-all cursor-pointer"
            title="Sélecteur d'Archipel"
          >
            <Menu className="w-5 h-5" />
          </button>

          {/* Center Brand */}
          <div className="cursor-pointer" onClick={() => onChangeTab('home')}>
            <Logo size="lg" showText={true} />
          </div>

          {/* Right: Theme Toggle or Mini Avatar */}
          <div className="flex items-center space-x-1">
            <button
               id="theme-toggle-btn"
              onClick={onToggleDarkMode}
              className="p-2 rounded-lg text-gray-500 hover:text-purple-600 dark:text-gray-400 dark:hover:text-purple-400 hover:bg-gray-100 dark:hover:bg-purple-950/20 transition-all active:scale-95 duration-200 outline-none cursor-pointer"
              title={darkMode ? 'Passer en mode clair' : 'Passer en mode sombre'}
            >
              <div className="transition-transform duration-500 hover:rotate-45">
                {darkMode ? <Sun className="w-4 h-4 fill-purple-400 text-purple-400" /> : <Moon className="w-4 h-4 text-zinc-650" />}
              </div>
            </button>

            <div className="relative">
              <button
                id="notifications-bell-btn"
                onClick={() => {
                  const nextOpenState = !isNotificationsOpen;
                  setIsNotificationsOpen(nextOpenState);
                  if (nextOpenState) {
                    onMarkNotificationsRead?.(activeCategory.types ?? 'all');
                  }
                }}
                className="relative p-2 rounded-lg text-gray-500 hover:text-purple-600 dark:text-gray-400 dark:hover:text-purple-400 hover:bg-gray-100 dark:hover:bg-purple-950/20 transition-all active:scale-95 duration-200 outline-none cursor-pointer"
                title="Notifications"
              >
                <Bell className="w-4 h-4" />
                {unreadCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 rounded-full bg-purple-600 text-white text-[9px] font-black flex items-center justify-center border border-white dark:border-black">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </button>

              {isNotificationsOpen && (
                <>
                  {/* Fond cliquable : ferme le panneau en touchant n'importe où à l'écran. */}
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setIsNotificationsOpen(false)}
                    aria-hidden="true"
                  />
                <div className="absolute right-0 top-11 w-80 max-w-[88vw] bg-white dark:bg-[#0E0E14] border border-gray-150 dark:border-zinc-850 rounded-2xl shadow-2xl z-50 overflow-hidden animate-fade-in">
                  <div className="px-4 py-3 border-b border-gray-100 dark:border-zinc-850 flex items-center justify-between">
                    <div>
                      <h3 className="text-xs font-serif font-black text-gray-950 dark:text-white">Notifications</h3>
                      <p className="text-[9px] text-zinc-400 font-mono uppercase tracking-wider">Suivis, commentaires et likes</p>
                    </div>
                    <button
                      onClick={() => onMarkNotificationsRead?.('all')}
                      className="text-[9px] font-black uppercase tracking-wider text-purple-600 dark:text-purple-400 hover:underline"
                    >
                      Tout lu
                    </button>
                  </div>

                  <div className="grid grid-cols-5 gap-1 p-2 bg-zinc-50 dark:bg-zinc-950/40">
                    {NOTIF_CATEGORIES.map((cat) => {
                      const count = countFor(cat.types);
                      return (
                        <button
                          key={cat.id}
                          onClick={() => {
                            setActiveNotificationTab(cat.id);
                            onMarkNotificationsRead?.(cat.types ?? 'all');
                          }}
                          className={`py-1.5 rounded-xl text-[9px] font-black uppercase tracking-wider transition ${
                            activeNotificationTab === cat.id
                              ? 'bg-purple-600 text-white shadow-sm'
                              : 'text-zinc-500 dark:text-zinc-400 hover:bg-white dark:hover:bg-zinc-900'
                          }`}
                        >
                          {cat.label}
                          {count > 0 && <span className="ml-1 opacity-80">{count}</span>}
                        </button>
                      );
                    })}
                  </div>

                  <div className="max-h-80 overflow-y-auto scrollbar-none">
                    {getVisibleNotifications().length === 0 ? (
                      <div className="py-10 px-4 text-center text-zinc-400">
                        <Bell className="w-8 h-8 mx-auto mb-2 text-purple-300" />
                        <p className="text-xs font-bold">Aucune notification ici.</p>
                      </div>
                    ) : (
                      getVisibleNotifications().map((notification) => {
                        const Icon = notifIcon(notification.type);
                        return (
                          <button
                            key={notification.id}
                            onClick={() => { onOpenNotification?.(notification); setIsNotificationsOpen(false); }}
                            className={`w-full px-4 py-3 border-b border-gray-100 dark:border-zinc-850 flex gap-3 text-left cursor-pointer hover:bg-purple-500/10 transition ${
                              notification.read ? 'bg-white dark:bg-[#0E0E14]' : 'bg-purple-500/5 dark:bg-purple-950/15'
                            }`}
                          >
                            <img
                              src={notification.actorAvatar}
                              alt={notification.actorName}
                              className="w-9 h-9 rounded-full object-cover ring-1 ring-purple-500/20 shrink-0"
                              referrerPolicy="no-referrer"
                            />
                            <div className="min-w-0 flex-1">
                              <div className="flex items-start justify-between gap-2">
                                <p className="text-[11px] font-black text-zinc-850 dark:text-zinc-100 leading-snug">
                                  {notification.title}
                                </p>
                                <Icon className={`w-3.5 h-3.5 shrink-0 ${notifColor(notification.type)}`} />
                              </div>
                              <p className="mt-0.5 text-[10px] text-zinc-500 dark:text-zinc-300 leading-snug line-clamp-2">
                                {notification.message}
                              </p>
                              {notification.excerpt && (
                                <p className="mt-1 text-[9px] italic text-zinc-400 line-clamp-1">“{notification.excerpt}”</p>
                              )}
                              <p className="mt-1 text-[8px] text-zinc-400 font-mono">
                                {formatNotificationDate(notification.createdAt)}
                              </p>
                            </div>
                          </button>
                        );
                      })
                    )}
                  </div>
                </div>
                </>
              )}
            </div>

            {/* Quick Profile Simulation Button */}
            <div 
              onClick={() => onChangeTab('profile')}
              className="relative cursor-pointer"
            >
              <img
                src={currentUser.avatar}
                alt={currentUser.username}
                className="w-7 h-7 rounded-full object-cover ring-2 ring-purple-600"
                referrerPolicy="no-referrer"
              />
              {currentUser.isVerified && (
                <div className="absolute -bottom-1 -right-1 bg-white dark:bg-black rounded-full p-[0.3px] scale-90">
                  <VerifiedBadge size="xs" />
                </div>
              )}
            </div>
          </div>

        </div>
      </header>

      {/* STICKY BOTTOM TAB NAVIGATION BAR (Écrire centré et surélevé) */}
      <nav className="fixed md:absolute bottom-0 inset-x-0 bg-white/95 dark:bg-black/95 backdrop-blur-md border-t border-gray-100 dark:border-purple-900/15 pb-3 pt-2.5 px-3 z-40 transition-colors">
        <div className="flex items-end justify-around">
          {leftTabs.map((tab) => renderTab(tab))}

          {/* Bouton central « Écrire » mis en avant. Pour un Lecteur, il invite à
              passer Auteur (redirection gérée en amont si besoin). */}
          <button
            id="nav-tab-write"
            onClick={() => onChangeTab(canWrite || isAdmin ? 'write' : 'profile')}
            className="relative -mt-7 flex flex-col items-center focus:outline-none cursor-pointer"
            aria-label="Écrire"
          >
            <span className={`w-14 h-14 rounded-full flex items-center justify-center overflow-hidden shadow-lg shadow-purple-600/30 border-4 border-white dark:border-black transition-transform active:scale-95 ${
              activeTab === 'write' ? 'ring-2 ring-purple-400' : ''
            } bg-gradient-to-br from-purple-600 to-fuchsia-600`}>
              <img src="/plume-icon.png" alt="Écrire" className="w-full h-full object-cover" draggable={false} />
            </span>
            <span className={`text-[9px] mt-1 font-black uppercase tracking-wide ${activeTab === 'write' ? 'text-purple-600 dark:text-purple-400' : 'text-gray-400 dark:text-gray-500'}`}>Écrire</span>
          </button>

          {rightTabs.map((tab) => renderTab(tab))}
        </div>
      </nav>

    </div>
  );
}
