/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Barre de navigation LATERALE — visible uniquement sur grand ecran (>= lg).
 * Sur mobile, elle est masquee (hidden) et c'est la barre du bas de
 * MainNavigation qui prend le relais. Aucune logique dupliquee : elle ne fait
 * que declencher onChangeTab, comme la barre du bas.
 */

import React from 'react';
import { Home, Compass, PenTool, MessageSquare, Trophy, User as UserIcon, ShieldCheck, Sun, Moon, LogOut } from 'lucide-react';
import { User } from '../types';
import Logo from './Logo';
import { VerifiedBadge } from './VerifiedBadge';

type Tab = 'home' | 'explore' | 'write' | 'messages' | 'profile' | 'admin' | 'achievements';

interface SideNavigationProps {
  activeTab: Tab;
  onChangeTab: (tab: Tab) => void;
  currentUser: User;
  darkMode: boolean;
  onToggleDarkMode: () => void;
  unreadMessagesCount?: number;
  onLogout?: () => void;
}

export default function SideNavigation({
  activeTab,
  onChangeTab,
  currentUser,
  darkMode,
  onToggleDarkMode,
  unreadMessagesCount = 0,
  onLogout,
}: SideNavigationProps) {
  const canWrite = currentUser.role === 'Auteur';
  const isAdmin = currentUser.role === 'Administrateur';

  const items: { id: Tab; label: string; icon: React.ReactNode; badge?: number }[] = [
    { id: 'home', label: 'Accueil', icon: <Home className="w-5 h-5" /> },
    { id: 'explore', label: 'Explorer', icon: <Compass className="w-5 h-5" /> },
    ...((canWrite || isAdmin) ? [{ id: 'write' as Tab, label: 'Écrire', icon: <PenTool className="w-5 h-5" /> }] : []),
    { id: 'messages', label: 'Messages', icon: <MessageSquare className="w-5 h-5" />, badge: unreadMessagesCount },
    { id: 'achievements', label: 'Succès', icon: <Trophy className="w-5 h-5" /> },
    { id: 'profile', label: 'Profil', icon: <UserIcon className="w-5 h-5" /> },
    ...(isAdmin ? [{ id: 'admin' as Tab, label: 'Admin', icon: <ShieldCheck className="w-5 h-5" /> }] : []),
  ];

  const handleWriteGuard = (tab: Tab) => {
    if (tab === 'write' && !canWrite && !isAdmin) {
      alert("Pour publier vos propres récits, passez en compte « Auteur » : Profil → Réglages → Compte → Type de compte.");
      onChangeTab('profile');
      return;
    }
    onChangeTab(tab);
  };

  return (
    <aside className="hidden lg:flex lg:flex-col lg:w-[248px] lg:shrink-0 lg:sticky lg:top-0 lg:h-screen border-r border-gray-150 dark:border-purple-900/15 bg-white dark:bg-black px-3 py-5 select-none">
      {/* Logo / marque (le wordmark PLUME est inclus dans l'image du logo) */}
      <div className="px-2 mb-6 flex items-center">
        <Logo size="sm" />
      </div>

      {/* Navigation principale */}
      <nav className="flex-1 space-y-1">
        {items.map((item) => {
          const isSelected = activeTab === item.id;
          return (
            <button
              key={item.id}
              id={`side-nav-${item.id}`}
              onClick={() => handleWriteGuard(item.id)}
              className={`group w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all cursor-pointer ${
                isSelected
                  ? 'bg-purple-600 text-white font-black shadow-sm shadow-purple-600/20'
                  : 'text-gray-600 dark:text-gray-300 hover:bg-purple-500/10 hover:text-purple-700 dark:hover:text-purple-300 font-bold'
              }`}
            >
              <span className="relative shrink-0">
                {item.icon}
                {!!item.badge && item.badge > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 min-w-[15px] h-3.5 px-0.5 rounded-full bg-purple-600 text-white text-[8px] font-black flex items-center justify-center border border-white dark:border-black">
                    {item.badge > 9 ? '9+' : item.badge}
                  </span>
                )}
              </span>
              <span className="text-sm">{item.label}</span>
            </button>
          );
        })}
      </nav>

      {/* Bas : theme + profil + deconnexion */}
      <div className="mt-4 space-y-1 border-t border-gray-100 dark:border-zinc-850 pt-3">
        <button
          onClick={onToggleDarkMode}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-gray-600 dark:text-gray-300 hover:bg-purple-500/10 font-bold transition cursor-pointer"
        >
          {darkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
          <span className="text-sm">{darkMode ? 'Mode clair' : 'Mode sombre'}</span>
        </button>

        <button
          onClick={() => onChangeTab('profile')}
          className="w-full flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-purple-500/10 transition cursor-pointer"
        >
          <span className="relative shrink-0">
            <img
              src={currentUser.avatar}
              alt={currentUser.username}
              className="w-9 h-9 rounded-full object-cover ring-2 ring-purple-500/20"
              referrerPolicy="no-referrer"
            />
            {currentUser.isVerified && (
              <span className="absolute -bottom-1 -right-1 bg-white dark:bg-black rounded-full p-[0.5px] scale-90">
                <VerifiedBadge size="xs" />
              </span>
            )}
          </span>
          <span className="min-w-0 text-left">
            <span className="block text-xs font-black text-gray-900 dark:text-white truncate">{currentUser.username}</span>
            <span className="block text-[10px] text-gray-400 truncate">{currentUser.role}</span>
          </span>
        </button>

        {onLogout && (
          <button
            onClick={onLogout}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-gray-500 dark:text-gray-400 hover:bg-red-500/10 hover:text-red-600 dark:hover:text-red-400 font-bold transition cursor-pointer"
          >
            <LogOut className="w-5 h-5" />
            <span className="text-sm">Déconnexion</span>
          </button>
        )}
      </div>
    </aside>
  );
}
