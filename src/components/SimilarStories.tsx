import React, { useEffect, useState } from 'react';
import { BookOpen, Loader2 } from 'lucide-react';
import { Story } from '../types';
import { authHeaders } from '../utils/auth';
import { generateCoverDataUri } from '../utils/coverImage';

/**
 * « Les lecteurs ont aussi aimé » — recommandation par co-occurrence (Phase 2
 * du moteur). Récupère /api/reco/similar/:id (item-item) et affiche des cartes.
 * Silencieux : si l'API ne renvoie rien, la section ne s'affiche pas du tout.
 */
export default function SimilarStories({
  storyId,
  onSelect,
}: {
  storyId: string;
  onSelect?: (story: Story) => void;
}) {
  const [items, setItems] = useState<Story[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch(`/api/reco/similar/${storyId}?limit=8`, { headers: authHeaders() })
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => { if (!cancelled) setItems(Array.isArray(data) ? data : []); })
      .catch(() => { if (!cancelled) setItems([]); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [storyId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-6 text-purple-400">
        <Loader2 className="w-5 h-5 animate-spin" />
      </div>
    );
  }
  if (!items.length) return null;

  return (
    <section className="mt-10 pt-8 border-t border-gray-205/60 dark:border-zinc-800">
      <h3 className="text-[11px] font-black uppercase tracking-widest text-purple-500 mb-4 flex items-center gap-2">
        <BookOpen className="w-3.5 h-3.5" /> Les lecteurs ont aussi aimé
      </h3>
      <div className="flex gap-3 overflow-x-auto pb-2 -mx-1 px-1 snap-x">
        {items.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => onSelect?.(s)}
            className="snap-start shrink-0 w-32 text-left group"
          >
            <div className="w-32 h-44 rounded-xl overflow-hidden bg-gray-100 dark:bg-zinc-900 border border-gray-150 dark:border-zinc-800 shadow-sm group-hover:shadow-md group-active:scale-[0.98] transition">
              <img
                src={s.cover || generateCoverDataUri(s.title)}
                alt={s.title}
                loading="lazy"
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover"
              />
            </div>
            <p className="mt-1.5 text-[11px] font-bold text-gray-900 dark:text-white leading-tight line-clamp-2">{s.title}</p>
            <p className="text-[10px] text-gray-400 truncate">{s.authorName}</p>
          </button>
        ))}
      </div>
    </section>
  );
}
