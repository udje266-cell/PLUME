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
  Users
} from 'lucide-react';
import { User, UserRole, AppNotification } from '../types';
import Logo from './Logo';
import { VerifiedBadge } from './VerifiedBadge';

interface MainNavigationProps {
  activeTab: 'home' | 'explore' | 'write' | 'messages' | 'profile' | 'admin';
  onChangeTab: (tab: 'home' | 'explore' | 'write' | 'messages' | 'profile' | 'admin') => void;
  currentUser: User;
  onOpenSidebar: () => void;
  darkMode: boolean;
  onToggleDarkMode: () => void;
  onQuickRoleChange: (role: UserRole) => void;
  notifications?: AppNotification[];
  onMarkNotificationsRead?: (type?: AppNotification['type'] | 'all') => void;
  unreadMessagesCount?: number;
}

export default function MainNavigation({
  activeTab,
  onChangeTab,
  currentUser,
  onOpenSidebar,
  darkMode,
  onToggleDarkMode,
  onQuickRoleChange,
  notifications = [],
  onMarkNotificationsRead,
  unreadMessagesCount = 0,
}: MainNavigationProps) {

  const canWrite = currentUser.role === 'Auteur' || currentUser.role === 'Utilisateur Mixte';
  const isAdmin = currentUser.role === 'Administrateur';
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [activeNotificationTab, setActiveNotificationTab] = useState<'all' | 'follow' | 'comment' | 'like'>('all');

  const unreadCount = notifications.filter((notification) => !notification.read).length;
  const followNotifications = notifications.filter((notification) => notification.type === 'follow');
  const commentNotifications = notifications.filter((notification) => notification.type === 'comment');
  const likeNotifications = notifications.filter((notification) => notification.type === 'like');

  const getVisibleNotifications = () => {
    if (activeNotificationTab === 'follow') return followNotifications;
    if (activeNotificationTab === 'comment') return commentNotifications;
    if (activeNotificationTab === 'like') return likeNotifications;
    return notifications;
  };

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

  // Bottom action tabs matching premium design
  const tabs = [
    { id: 'home' as const, label: 'Accueil', icon: <Home className="w-5 h-5" /> },
    { id: 'explore' as const, label: 'Explorer', icon: <Search className="w-5 h-5" /> },
    ...(currentUser.role !== 'Lecteur' ? [{ id: 'write' as const, label: 'Écrire', icon: <PenTool className="w-5 h-5" /> }] : []),
    { id: 'messages' as const, label: 'Messages', icon: <MessageSquare className="w-5 h-5" /> },
    ...(isAdmin ? [{ id: 'admin' as const, label: 'Admin', icon: <ShieldCheck className="w-5 h-5 text-purple-600 dark:text-purple-400" /> }] : []),
    { id: 'profile' as const, label: 'Profil', icon: <UserIcon className="w-5 h-5" /> },
  ];

  return (
    <div className="w-full flex flex-col z-30 select-none">
      
      {/* TOP ACTIONS APP HEADER */}
      <header className="w-full bg-white/90 dark:bg-black/90 backdrop-blur-md border-b border-gray-150 dark:border-purple-900/10 transition-colors py-3 px-4">
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
            <Logo size="sm" showText={true} />
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
                    onMarkNotificationsRead?.(activeNotificationTab);
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

                  <div className="grid grid-cols-4 gap-1 p-2 bg-zinc-50 dark:bg-zinc-950/40">
                    {[
                      { id: 'all' as const, label: 'Tout', count: notifications.length },
                      { id: 'follow' as const, label: 'Suivis', count: followNotifications.length },
                      { id: 'comment' as const, label: 'Com.', count: commentNotifications.length },
                      { id: 'like' as const, label: 'Likes', count: likeNotifications.length },
                    ].map((tab) => (
                      <button
                        key={tab.id}
                        onClick={() => {
                          setActiveNotificationTab(tab.id);
                          onMarkNotificationsRead?.(tab.id);
                        }}
                        className={`py-1.5 rounded-xl text-[9px] font-black uppercase tracking-wider transition ${
                          activeNotificationTab === tab.id
                            ? 'bg-purple-600 text-white shadow-sm'
                            : 'text-zinc-500 dark:text-zinc-400 hover:bg-white dark:hover:bg-zinc-900'
                        }`}
                      >
                        {tab.label}
                        {tab.count > 0 && <span className="ml-1 opacity-80">{tab.count}</span>}
                      </button>
                    ))}
                  </div>

                  <div className="max-h-80 overflow-y-auto scrollbar-none">
                    {getVisibleNotifications().length === 0 ? (
                      <div className="py-10 px-4 text-center text-zinc-400">
                        <Bell className="w-8 h-8 mx-auto mb-2 text-purple-300" />
                        <p className="text-xs font-bold">Aucune notification ici.</p>
                      </div>
                    ) : (
                      getVisibleNotifications().map((notification) => {
                        const Icon = notification.type === 'follow' ? Users : notification.type === 'comment' ? MessageCircle : Heart;
                        return (
                          <div
                            key={notification.id}
                            className={`px-4 py-3 border-b border-gray-100 dark:border-zinc-850 flex gap-3 text-left ${
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
                                <Icon className={`w-3.5 h-3.5 shrink-0 ${
                                  notification.type === 'like' ? 'text-pink-500' : notification.type === 'comment' ? 'text-purple-500' : 'text-indigo-500'
                                }`} />
                              </div>
                              <p className="mt-0.5 text-[10px] text-zinc-500 dark:text-zinc-350 leading-snug line-clamp-2">
                                {notification.message}
                              </p>
                              {notification.excerpt && (
                                <p className="mt-1 text-[9px] italic text-zinc-400 line-clamp-1">“{notification.excerpt}”</p>
                              )}
                              <p className="mt-1 text-[8px] text-zinc-400 font-mono">
                                {formatNotificationDate(notification.createdAt)}
                              </p>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
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

        {/* Dynamic Simulator Profile selector for quick evaluation on the top page */}
        <div className="mt-2.5 mx-auto bg-gray-50 dark:bg-purple-950/10 p-1 rounded-xl border border-gray-100 dark:border-purple-900/10 flex items-center justify-between text-[10px] text-gray-400 px-2 select-none">
          <span className="font-bold uppercase tracking-wider text-[9px]">Simulateur :</span>
          <div className="flex space-x-1">
            {(['Lecteur', 'Auteur', 'Administrateur'] as UserRole[]).map((role) => (
              <button
                key={role}
                id={`quick-role-${role}`}
                onClick={() => onQuickRoleChange(role)}
                className={`px-2 py-0.5 rounded-lg font-bold transition-all ${
                  currentUser.role === role
                    ? 'bg-[#7C3AED] text-white shadow-xs'
                    : 'text-gray-500 dark:text-gray-400 hover:text-purple-600'
                }`}
              >
                {role}
              </button>
            ))}
          </div>
        </div>
      </header>

      {/* STICKY BOTTOM TAB NAVIGATION BAR */}
      <nav className="fixed md:absolute bottom-0 inset-x-0 bg-white/95 dark:bg-black/95 backdrop-blur-md border-t border-gray-100 dark:border-purple-900/15 pb-3 pt-2.5 px-3 z-40 flex flex-col transition-colors">
        <div className="flex items-center justify-around">
          {tabs.map((tab) => {
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
                  {/* Visual trigger indicator for new messages */}
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
          })}
        </div>
      </nav>

    </div>
  );
}
