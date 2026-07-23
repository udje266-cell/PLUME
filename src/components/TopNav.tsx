/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Barre de navigation SUPERIEURE horizontale — style « site web » (facon
 * Wattpad), visible uniquement sur grand ecran (>= lg). Sur mobile, elle est
 * masquee (hidden) et c'est MainNavigation (en-tete + barre du bas) qui gere.
 * Reprend le DESIGN (structure top-bar) mais garde l'identite PLUME (violet).
 */

import React, { useState, useEffect, useRef } from 'react';
import { Home, Compass, PenTool, MessageSquare, Trophy, ShieldCheck, Search, Bell, Sun, Moon } from 'lucide-react';
import { User, AppNotification } from '../types';
import Logo from './Logo';
import { VerifiedBadge } from './VerifiedBadge';

type Tab = 'home' | 'explore' | 'write' | 'messages' | 'profile' | 'admin' | 'achievements';

interface TopNavProps {
  activeTab: Tab;
  onChangeTab: (tab: Tab) => void;
  currentUser: User;
  darkMode: boolean;
  onToggleDarkMode: () => void;
  unreadMessagesCount?: number;
  notifications?: AppNotification[];
  onMarkNotificationsRead?: (type?: AppNotification['type'] | AppNotification['type'][] | 'all') => void;
  onOpenNotification?: (n: AppNotification) => void;
}

export default function TopNav({
  activeTab,
  onChangeTab,
  currentUser,
  darkMode,
  onToggleDarkMode,
  unreadMessagesCount = 0,
  notifications = [],
  onMarkNotificationsRead,
  onOpenNotification,
}: TopNavProps) {
  const canWrite = currentUser.role === 'Auteur';
  const isAdmin = currentUser.role === 'Administrateur';
  const [notifOpen, setNotifOpen] = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);

  const unreadNotifs = notifications.filter((n) => !n.read).length;

  useEffect(() => {
    if (!notifOpen) return;
    const onClick = (e: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) setNotifOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [notifOpen]);

  const links: { id: Tab; label: string; icon: React.ReactNode; badge?: number }[] = [
    { id: 'home', label: 'Accueil', icon: <Home className="w-4 h-4" /> },
    { id: 'explore', label: 'Parcourir', icon: <Compass className="w-4 h-4" /> },
    ...((canWrite || isAdmin) ? [{ id: 'write' as Tab, label: 'Écrire', icon: <PenTool className="w-4 h-4" /> }] : []),
    { id: 'messages', label: 'Messages', icon: <MessageSquare className="w-4 h-4" />, badge: unreadMessagesCount },
    { id: 'achievements', label: 'Succès', icon: <Trophy className="w-4 h-4" /> },
    ...(isAdmin ? [{ id: 'admin' as Tab, label: 'Admin', icon: <ShieldCheck className="w-4 h-4" /> }] : []),
  ];

  const go = (tab: Tab) => {
    if (tab === 'write' && !canWrite && !isAdmin) {
      alert("Pour publier vos propres récits, passez en compte « Auteur » : Profil → Réglages → Compte → Type de compte.");
      onChangeTab('profile');
      return;
    }
    onChangeTab(tab);
  };

  const fmtDate = (raw?: string) => {
    if (!raw) return '';
    const d = new Date(raw);
    if (isNaN(d.getTime())) return '';
    return d.toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
  };

  return (
    <header className="hidden lg:flex sticky top-0 z-40 h-16 items-center border-b border-gray-150 dark:border-purple-900/15 bg-white/95 dark:bg-black/95 backdrop-blur-md">
      <div className="w-full max-w-none mx-auto px-6 lg:px-10 xl:px-16 flex items-center gap-6">
        {/* Logo */}
        <button onClick={() => go('home')} className="shrink-0 flex items-center cursor-pointer" aria-label="Accueil">
          <Logo size="sm" />
        </button>

        {/* Liens de navigation */}
        <nav className="flex items-center gap-1">
          {links.map((l) => {
            const active = activeTab === l.id;
            return (
              <button
                key={l.id}
                id={`topnav-${l.id}`}
                onClick={() => go(l.id)}
                className={`relative flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-bold transition-colors cursor-pointer ${
                  active
                    ? 'text-purple-700 dark:text-purple-300'
                    : 'text-gray-600 dark:text-gray-300 hover:text-purple-600 dark:hover:text-purple-400 hover:bg-purple-500/5'
                }`}
              >
                <span className="relative">
                  {l.icon}
                  {!!l.badge && l.badge > 0 && (
                    <span className="absolute -top-1.5 -right-2 min-w-[15px] h-3.5 px-0.5 rounded-full bg-purple-600 text-white text-[8px] font-black flex items-center justify-center border border-white dark:border-black">
                      {l.badge > 9 ? '9+' : l.badge}
                    </span>
                  )}
                </span>
                <span>{l.label}</span>
                {active && <span className="absolute -bottom-[9px] inset-x-2 h-0.5 rounded-full bg-purple-600 dark:bg-purple-400" />}
              </button>
            );
          })}
        </nav>

        {/* Recherche (redirige vers Parcourir) */}
        <button
          onClick={() => go('explore')}
          className="ml-auto hidden xl:flex items-center gap-2 w-64 px-3.5 py-2 rounded-full bg-gray-100 dark:bg-zinc-900 text-gray-400 hover:bg-gray-150 dark:hover:bg-zinc-850 transition text-left cursor-text"
        >
          <Search className="w-4 h-4 shrink-0" />
          <span className="text-xs truncate">Rechercher une œuvre, un auteur…</span>
        </button>

        {/* Actions droite */}
        <div className="flex items-center gap-1 ml-auto xl:ml-2 shrink-0">
          <button onClick={() => go('explore')} className="xl:hidden p-2 rounded-full text-gray-500 hover:bg-purple-500/10 hover:text-purple-600 transition" aria-label="Rechercher">
            <Search className="w-5 h-5" />
          </button>

          <button onClick={onToggleDarkMode} className="p-2 rounded-full text-gray-500 hover:bg-purple-500/10 hover:text-purple-600 transition" aria-label="Thème">
            {darkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
          </button>

          {/* Notifications */}
          <div className="relative" ref={notifRef}>
            <button
              onClick={() => { setNotifOpen((v) => !v); if (!notifOpen) onMarkNotificationsRead?.('all'); }}
              className="relative p-2 rounded-full text-gray-500 hover:bg-purple-500/10 hover:text-purple-600 transition"
              aria-label="Notifications"
            >
              <Bell className="w-5 h-5" />
              {unreadNotifs > 0 && (
                <span className="absolute top-1 right-1 min-w-[15px] h-3.5 px-0.5 rounded-full bg-purple-600 text-white text-[8px] font-black flex items-center justify-center border border-white dark:border-black">
                  {unreadNotifs > 9 ? '9+' : unreadNotifs}
                </span>
              )}
            </button>

            {notifOpen && (
              <div className="absolute right-0 mt-2 w-80 max-h-[70vh] overflow-y-auto bg-white dark:bg-[#0E0E14] border border-gray-150 dark:border-purple-900/20 rounded-2xl shadow-2xl z-50">
                <div className="px-4 py-3 border-b border-gray-100 dark:border-zinc-850 flex items-center justify-between sticky top-0 bg-white dark:bg-[#0E0E14]">
                  <span className="text-xs font-black uppercase tracking-wider text-gray-700 dark:text-gray-200">Notifications</span>
                  <button onClick={() => onMarkNotificationsRead?.('all')} className="text-[10px] font-bold text-purple-600 hover:text-purple-500">Tout lu</button>
                </div>
                {notifications.length === 0 ? (
                  <div className="py-10 text-center text-xs text-gray-400">Aucune notification.</div>
                ) : (
                  <div className="divide-y divide-gray-100 dark:divide-zinc-850">
                    {notifications.slice(0, 25).map((n) => (
                      <button
                        key={n.id}
                        onClick={() => { onOpenNotification?.(n); setNotifOpen(false); }}
                        className={`w-full flex gap-3 px-4 py-3 text-left hover:bg-purple-500/5 transition ${!n.read ? 'bg-purple-500/5' : ''}`}
                      >
                        {n.actorAvatar
                          ? <img src={n.actorAvatar} alt="" className="w-9 h-9 rounded-full object-cover shrink-0" referrerPolicy="no-referrer" />
                          : <span className="w-9 h-9 rounded-full bg-purple-500/15 flex items-center justify-center text-purple-600 shrink-0">🪶</span>}
                        <span className="min-w-0 flex-1">
                          <span className="block text-[11px] font-bold text-gray-900 dark:text-white truncate">{n.title}</span>
                          <span className="block text-[11px] text-gray-500 dark:text-gray-400 line-clamp-2">{n.message}</span>
                          <span className="block text-[9px] text-gray-400 mt-0.5">{fmtDate(n.createdAt)}</span>
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Avatar -> profil */}
          <button onClick={() => go('profile')} className="ml-1 shrink-0 relative" aria-label="Profil">
            <img
              src={currentUser.avatar}
              alt={currentUser.username}
              className={`w-9 h-9 rounded-full object-cover ring-2 transition ${activeTab === 'profile' ? 'ring-purple-500' : 'ring-purple-500/20 hover:ring-purple-500/50'}`}
              referrerPolicy="no-referrer"
            />
            {currentUser.isVerified && (
              <span className="absolute -bottom-1 -right-1 bg-white dark:bg-black rounded-full p-[0.5px] scale-90">
                <VerifiedBadge size="xs" />
              </span>
            )}
          </button>
        </div>
      </div>
    </header>
  );
}
