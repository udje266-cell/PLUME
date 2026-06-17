/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Écran SUCCÈS dédié : affiche tous les accomplissements de l'utilisateur
 * (lecteur + auteur). Réutilise la logique de génération des succès
 * (utils/achievements). Les succès restent aussi visibles dans le profil.
 */

import { useMemo, useState } from 'react';
import { Trophy, Lock, BookOpen, PenTool, Sparkles } from 'lucide-react';
import { User } from '../types';
import {
  getUserStats,
  generateReaderAchievements,
  generateAuthorAchievements,
  type Achievement,
} from '../utils/achievements';

const RARITY_STYLE: Record<Achievement['rarity'], string> = {
  commun: 'from-zinc-400/15 to-zinc-500/5 border-zinc-300/40 dark:border-zinc-700',
  rare: 'from-blue-500/15 to-cyan-500/5 border-blue-400/40',
  epic: 'from-purple-500/20 to-fuchsia-500/5 border-purple-400/50',
  mythic: 'from-amber-400/25 to-orange-500/10 border-amber-400/60',
};
const RARITY_LABEL: Record<Achievement['rarity'], string> = {
  commun: 'Commun', rare: 'Rare', epic: 'Épique', mythic: 'Mythique',
};

function AchievementCard({ a }: { a: Achievement }) {
  const locked = !a.isUnlocked;
  return (
    <div
      className={`relative rounded-2xl border bg-gradient-to-br p-3 flex flex-col gap-1.5 ${RARITY_STYLE[a.rarity]} ${
        locked ? 'opacity-70' : ''
      }`}
    >
      <div className="flex items-center justify-between">
        <span className={`text-[8px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded-full ${
          locked ? 'bg-zinc-400/20 text-zinc-500' : 'bg-purple-500/15 text-purple-600 dark:text-purple-300'
        }`}>
          {RARITY_LABEL[a.rarity]}
        </span>
        {locked
          ? <Lock className="w-3.5 h-3.5 text-zinc-400" />
          : <Trophy className="w-3.5 h-3.5 text-amber-500" />}
      </div>
      <h4 className="text-xs font-black text-gray-900 dark:text-white leading-tight">
        {locked ? a.mysteryTitle : a.title}
      </h4>
      <p className="text-[10px] text-gray-500 dark:text-gray-400 leading-snug line-clamp-3">
        {locked ? a.mysteryDesc : a.realDesc}
      </p>
      {!locked && a.unlockedDate && (
        <span className="text-[8px] font-mono text-gray-400 mt-auto pt-1">Débloqué le {a.unlockedDate}</span>
      )}
    </div>
  );
}

interface AchievementsViewProps {
  currentUser: User;
}

export default function AchievementsView({ currentUser }: AchievementsViewProps) {
  const [tab, setTab] = useState<'reader' | 'author'>(
    currentUser.role === 'Auteur' ? 'author' : 'reader',
  );

  const allUnlocked = currentUser.role === 'Administrateur';
  const { reader, author } = useMemo(() => {
    const stats = getUserStats(currentUser.id, currentUser.role, currentUser.username);
    return {
      reader: generateReaderAchievements(stats, currentUser.id, allUnlocked),
      author: generateAuthorAchievements(stats, currentUser.id, allUnlocked),
    };
  }, [currentUser.id, currentUser.role, currentUser.username, allUnlocked]);

  const list = tab === 'reader' ? reader : author;
  const unlocked = list.filter((a) => a.isUnlocked).length;

  return (
    <div className="px-4 py-4 space-y-5 animate-fade-in pb-28">
      <header className="flex items-center gap-2">
        <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow-md">
          <Trophy className="w-5 h-5 text-white" />
        </div>
        <div>
          <h1 className="text-xl font-black tracking-tight text-gray-950 dark:text-white">Succès</h1>
          <p className="text-[11px] text-gray-400 -mt-0.5">Tes accomplissements de lecture et d'écriture</p>
        </div>
      </header>

      {/* Sélecteur Lecteur / Auteur */}
      <div className="grid grid-cols-2 gap-2 bg-gray-100 dark:bg-zinc-900 p-1 rounded-2xl">
        <button
          onClick={() => setTab('reader')}
          className={`flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition ${
            tab === 'reader' ? 'bg-white dark:bg-zinc-800 text-purple-600 shadow-sm' : 'text-gray-400'
          }`}
        >
          <BookOpen className="w-3.5 h-3.5" /> Lecteur
        </button>
        <button
          onClick={() => setTab('author')}
          className={`flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition ${
            tab === 'author' ? 'bg-white dark:bg-zinc-800 text-purple-600 shadow-sm' : 'text-gray-400'
          }`}
        >
          <PenTool className="w-3.5 h-3.5" /> Auteur
        </button>
      </div>

      <div className="flex items-center gap-1.5 text-[11px] font-bold text-gray-500 dark:text-gray-400">
        <Sparkles className="w-3.5 h-3.5 text-amber-500" />
        <span>{unlocked} / {list.length} débloqués</span>
        <div className="flex-1 h-1.5 bg-gray-200 dark:bg-zinc-800 rounded-full overflow-hidden ml-2">
          <div className="h-full bg-gradient-to-r from-amber-400 to-orange-500" style={{ width: `${list.length ? (unlocked / list.length) * 100 : 0}%` }} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {list.map((a) => <AchievementCard key={a.id} a={a} />)}
      </div>

      {list.length === 0 && (
        <p className="text-center text-sm text-gray-400 py-12">Aucun succès pour le moment.</p>
      )}
    </div>
  );
}
