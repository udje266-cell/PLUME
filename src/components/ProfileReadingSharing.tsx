import { useState } from 'react';
import { ChevronRight, Radio } from 'lucide-react';
import type { User } from '../types';
import LiveReadingProgress from './LiveReadingProgress';

/** Uses the same permission as the live-reading API; a private profile never shares. */
export default function ProfileReadingSharing({ user, isOwnProfile, onUpdateProfile, onManage }: {
  user: User;
  isOwnProfile: boolean;
  onUpdateProfile: (fields: Partial<User>) => void | Promise<boolean>;
  onManage: () => void;
}) {
  const active = !!user.showBooksRead && !user.privateProfile && !user.isBanned;
  // The parent optimistically updates the profile. Hold the previous status
  // until the server acknowledges it so a failed save never claims to share.
  const [pending, setPending] = useState<boolean | null>(null);
  const [error, setError] = useState(false);
  const displayedActive = pending ?? active;
  const toggle = async () => {
    if (pending !== null) return;
    setPending(active);
    setError(false);
    try {
      const saved = await onUpdateProfile({ showBooksRead: !active });
      if (saved === false) setError(true);
    } catch { setError(true); }
    finally { setPending(null); }
  };
  return <section aria-label="Partage de lecture en direct" className="p-3 rounded-2xl border border-purple-500/20 bg-purple-50/70 dark:bg-purple-950/15 space-y-3">
    <div className="flex items-center gap-3">
      <Radio className="w-6 h-6 shrink-0 text-purple-600 dark:text-purple-400" />
      <div className="min-w-0 flex-1">
        <h2 className="font-serif text-base font-bold text-zinc-900 dark:text-white">Lecture en direct</h2>
        <p role="status" className="flex items-center gap-1.5 text-xs text-zinc-600 dark:text-zinc-300">
          <span data-sharing-status={displayedActive ? 'active' : 'disabled'} className={`h-2 w-2 shrink-0 rounded-full ${displayedActive ? 'bg-emerald-500' : 'bg-zinc-400 dark:bg-zinc-500'}`} />
          {pending !== null ? 'Enregistrement…' : displayedActive ? 'Partage activé' : 'Partage désactivé'}
        </p>
      </div>
      {isOwnProfile && <>
        <button type="button" role="switch" aria-label="Partager ma lecture en direct" aria-checked={displayedActive} aria-busy={pending !== null} disabled={pending !== null || !!user.privateProfile || !!user.isBanned} onClick={toggle} className={`shrink-0 w-10 h-6 p-0.5 rounded-full transition-colors disabled:opacity-50 ${displayedActive ? 'bg-emerald-600' : 'bg-zinc-300 dark:bg-zinc-700'}`}>
          <span className={`block h-5 w-5 bg-white rounded-full shadow transition-transform ${displayedActive ? 'translate-x-4' : 'translate-x-0'}`} />
        </button>
        <button type="button" onClick={onManage} aria-label="Gérer le partage des lectures" className="inline-flex items-center gap-0.5 text-xs text-purple-700 dark:text-purple-300 underline underline-offset-4 py-2">Gérer<ChevronRight className="w-3.5 h-3.5" /></button>
      </>}
    </div>
    {isOwnProfile && <p className="text-[11px] text-zinc-500 dark:text-zinc-400">{user.privateProfile ? 'Votre profil est privé. Gérez sa confidentialité pour autoriser le partage.' : 'Partagez votre progression en temps réel avec votre communauté.'}</p>}
    {error && <p role="alert" className="text-xs text-rose-600 dark:text-rose-400">Le partage n’a pas pu être enregistré. Réessayez lorsque la connexion est rétablie.</p>}
    {displayedActive && <LiveReadingProgress userId={user.id} embedded />}
  </section>;
}
