/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Vitrine des TROPHEES LEGENDAIRES & SECRETS.
 *
 * Confidentialite : ce composant n'AFFICHE que ce que le serveur renvoie. Il ne
 * connait AUCUNE condition d'obtention (elles vivent uniquement dans le module
 * serveur src/server/legendary.ts). Un trophee secret verrouille n'est jamais
 * present dans la reponse API — il n'existe donc pas ici : pas d'indice, pas de
 * progression, pas de compteur.
 *
 * Deux modes :
 *   - `owner`  : liste du membre courant (GET /api/me/legendary). Declenche
 *     l'evaluation serveur + persiste les nouveaux deblocages, montre les
 *     legendaires VISIBLES meme verrouilles (condition masquee) et les SECRETS
 *     seulement s'ils sont acquis. Affiche une celebration a chaque nouveau
 *     deblocage.
 *   - `public` : legendes DEBLOQUEES d'un profil (GET /api/users/:id/legendary),
 *     sans rien de verrouille.
 */

import { useEffect, useMemo, useState } from 'react';
import { Crown, Lock, Sparkles } from 'lucide-react';
import type { LegendaryTrophy } from '../types';

const RARITY_STYLE: Record<LegendaryTrophy['rarity'], string> = {
  legendaire: 'from-amber-400/25 to-orange-500/10 border-amber-400/60',
  divin: 'from-fuchsia-500/25 via-purple-600/15 to-amber-400/15 border-fuchsia-400/60',
};
const RARITY_LABEL: Record<LegendaryTrophy['rarity'], string> = {
  legendaire: 'Légendaire',
  divin: 'Divin',
};

function TrophyCard({ t, onClick }: { t: LegendaryTrophy; onClick: () => void }) {
  const locked = t.unlocked === false;
  return (
    <button
      type="button"
      onClick={onClick}
      className={`relative text-left rounded-2xl border bg-gradient-to-br p-3 flex flex-col gap-1.5 active:scale-[0.98] transition ${RARITY_STYLE[t.rarity]} ${locked ? 'opacity-70' : ''}`}
    >
      <div className="flex items-center justify-between">
        <span className={`text-[8px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded-full ${
          t.rarity === 'divin' ? 'bg-fuchsia-500/20 text-fuchsia-600 dark:text-fuchsia-300' : 'bg-amber-500/15 text-amber-600 dark:text-amber-300'
        }`}>
          {RARITY_LABEL[t.rarity]}
        </span>
        {locked ? <Lock className="w-3.5 h-3.5 text-zinc-400" /> : <span className="text-base leading-none">{t.icon}</span>}
      </div>
      <h4 className="text-xs font-black text-gray-900 dark:text-white leading-tight flex items-center gap-1">
        {t.name}
      </h4>
      <p className="text-[10px] text-gray-500 dark:text-gray-400 leading-snug line-clamp-3">{t.description}</p>
      {!locked && t.unlockedDate && (
        <span className="text-[8px] font-mono text-gray-400 mt-auto pt-1">Débloqué le {t.unlockedDate}</span>
      )}
    </button>
  );
}

interface Props {
  /** Mode `owner` = membre courant (evaluation) ; `public` = profil consulte. */
  mode: 'owner' | 'public';
  /** Requis en mode `public` : l'utilisateur dont on affiche les legendes. */
  userId?: string;
  /** Grille plus dense (3 colonnes) — utilisé sur le profil. */
  compact?: boolean;
}

export default function LegendaryTrophies({ mode, userId, compact }: Props) {
  const [items, setItems] = useState<LegendaryTrophy[]>([]);
  const [selected, setSelected] = useState<LegendaryTrophy | null>(null);
  const [celebrate, setCelebrate] = useState<LegendaryTrophy[]>([]);

  useEffect(() => {
    let cancelled = false;
    const url = mode === 'owner' ? '/api/me/legendary' : `/api/users/${userId}/legendary`;
    (async () => {
      try {
        const res = await fetch(url);
        if (!res.ok || cancelled) return;
        const data = await res.json();
        const list: LegendaryTrophy[] = Array.isArray(data?.legendaries) ? data.legendaries : [];
        if (cancelled) return;
        setItems(list);
        // Celebration : trophees fraichement debloques (mode owner uniquement).
        const ids: string[] = Array.isArray(data?.newlyUnlocked) ? data.newlyUnlocked : [];
        if (ids.length) {
          const fresh = list.filter((t) => ids.includes(t.id));
          if (fresh.length) setCelebrate(fresh);
        }
      } catch { /* hors-ligne : la section reste simplement vide */ }
    })();
    return () => { cancelled = true; };
  }, [mode, userId]);

  const unlockedCount = useMemo(() => items.filter((t) => t.unlocked !== false).length, [items]);

  // Rien à montrer (aucune légende renvoyée, hors-ligne, ou pas encore chargé) :
  // on masque entièrement la section plutôt que d'afficher un cartouche vide.
  if (items.length === 0) return null;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-fuchsia-500 via-purple-600 to-amber-400 flex items-center justify-center shadow-md">
          <Crown className="w-4 h-4 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <h2 className="text-sm font-black tracking-tight text-gray-950 dark:text-white leading-none">Légendes</h2>
          <p className="text-[10px] text-gray-400 mt-0.5">
            {mode === 'owner'
              ? `${unlockedCount} légende${unlockedCount > 1 ? 's' : ''} en ta possession`
              : 'Trophées légendaires obtenus'}
          </p>
        </div>
      </div>

      <div className={`grid ${compact ? 'grid-cols-2 sm:grid-cols-3' : 'grid-cols-2'} gap-3`}>
        {items.map((t) => <TrophyCard key={t.id} t={t} onClick={() => setSelected(t)} />)}
      </div>

      {/* Detail d'une legende (jamais la condition — description poetique seule). */}
      {selected && (
        <div className="fixed inset-0 z-[130] bg-black/70 backdrop-blur-sm flex items-center justify-center p-5" onClick={() => setSelected(null)}>
          <div className={`w-full max-w-sm rounded-3xl border bg-gradient-to-br p-6 ${RARITY_STYLE[selected.rarity]} bg-white dark:bg-[#0E0E14]`} onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full ${
                selected.rarity === 'divin' ? 'bg-fuchsia-500/20 text-fuchsia-600 dark:text-fuchsia-300' : 'bg-amber-500/15 text-amber-600 dark:text-amber-300'
              }`}>{RARITY_LABEL[selected.rarity]}</span>
              {selected.unlocked === false ? <Lock className="w-6 h-6 text-zinc-400" /> : <span className="text-3xl leading-none">{selected.icon}</span>}
            </div>
            <h3 className="text-lg font-serif font-black text-gray-900 dark:text-white mb-2">{selected.name}</h3>
            <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed">{selected.description}</p>
            {selected.unlocked === false && (
              <p className="text-[11px] text-amber-600 dark:text-amber-400 font-bold mt-3 flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5" /> Légende encore scellée — son secret reste à percer.
              </p>
            )}
            {selected.unlockedDate && (
              <p className="text-[10px] font-mono text-gray-400 mt-3">Débloqué le {selected.unlockedDate}</p>
            )}
            <button onClick={() => setSelected(null)} className="mt-5 w-full py-2.5 rounded-xl bg-purple-600 text-white text-xs font-black uppercase tracking-wider">Fermer</button>
          </div>
        </div>
      )}

      {/* CELEBRATION : nouveau deblocage. */}
      {celebrate.length > 0 && (
        <div className="fixed inset-0 z-[140] bg-black/80 backdrop-blur-md flex items-center justify-center p-5 animate-fade-in" onClick={() => setCelebrate([])}>
          <div className={`relative w-full max-w-sm rounded-[2rem] border bg-gradient-to-br p-7 text-center ${RARITY_STYLE[celebrate[0].rarity]} bg-white dark:bg-[#0E0E14]`} onClick={(e) => e.stopPropagation()}>
            <div className="absolute -top-3 left-1/2 -translate-x-1/2 flex items-center gap-1 px-3 py-1 rounded-full bg-gradient-to-r from-fuchsia-500 to-amber-400 text-white text-[9px] font-black uppercase tracking-widest shadow-lg">
              <Sparkles className="w-3 h-3" /> Légende débloquée
            </div>
            <div className="text-6xl mt-2 mb-2 animate-scale-up">{celebrate[0].icon}</div>
            <h3 className="text-2xl font-serif font-black text-gray-900 dark:text-white">{celebrate[0].name}</h3>
            <span className={`inline-block mt-1 text-[10px] font-black uppercase tracking-widest px-2.5 py-0.5 rounded-full ${
              celebrate[0].rarity === 'divin' ? 'bg-fuchsia-500/20 text-fuchsia-600 dark:text-fuchsia-300' : 'bg-amber-500/15 text-amber-600 dark:text-amber-300'
            }`}>{RARITY_LABEL[celebrate[0].rarity]}</span>
            <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed mt-3">{celebrate[0].description}</p>
            {celebrate.length > 1 && (
              <p className="text-[11px] text-purple-500 font-bold mt-3">+ {celebrate.length - 1} autre{celebrate.length - 1 > 1 ? 's' : ''} légende{celebrate.length - 1 > 1 ? 's' : ''} !</p>
            )}
            <button onClick={() => setCelebrate([])} className="mt-5 w-full py-3 rounded-xl bg-gradient-to-r from-fuchsia-600 to-purple-600 text-white text-xs font-black uppercase tracking-wider">Magnifique</button>
          </div>
        </div>
      )}
    </div>
  );
}
