import { useEffect, useState } from 'react';
import { authHeaders } from '../utils/auth';

type Row = {
  userId: string; chapterId: string; progressPercent: number;
  user: { username: string }; story: { title: string }; chapter: { title: string };
};

/** Socket invalidations plus a fallback refresh, with fresh authorization each time. */
export default function LiveReadingProgress({ userId, storyId, groupId, embedded = false }: {
  userId?: string; storyId?: string; groupId?: string; embedded?: boolean;
}) {
  const [rows, setRows] = useState<Row[]>([]);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    let loading = false;
    let again = false;
    setRows([]);
    const query = new URLSearchParams(userId ? { userId } : groupId ? { groupId } : { storyId: storyId! });
    const load = async () => {
      if (loading) { again = true; return; }
      loading = true;
      try {
        const response = await fetch(`/api/live-reading?${query}`, { headers: authHeaders(), signal: controller.signal });
        if (!response.ok) throw new Error('Unavailable');
        const data = await response.json();
        if (!controller.signal.aborted) { setRows(data); setFailed(false); }
      } catch {
        if (!controller.signal.aborted) { setRows([]); setFailed(true); }
      } finally {
        loading = false;
        if (again && !controller.signal.aborted) { again = false; schedule(); }
      }
    };
    const schedule = () => { clearTimeout(timer); timer = setTimeout(load, 300); };
    void load();
    const interval = setInterval(load, 15_000);
    window.addEventListener('plume:reading-progress', schedule);
    window.addEventListener('online', schedule);
    return () => {
      controller.abort(); clearTimeout(timer); clearInterval(interval);
      window.removeEventListener('plume:reading-progress', schedule);
      window.removeEventListener('online', schedule);
    };
  }, [userId, storyId, groupId]);
  return <section aria-label={embedded ? "Progression partagée" : "Lecture en direct"} className="p-3 rounded-xl bg-purple-50 dark:bg-purple-950/20 text-xs space-y-2 max-h-44 overflow-y-auto">
    {!embedded && <p className="font-bold">Lecture en direct</p>}
    {failed ? <p>Connexion interrompue. Nouvelle tentative automatique.</p> : !rows.length ?
      <p className="text-zinc-500">Aucune lecture partagée ces 5 dernières minutes. Le partage dépend de la visibilité des lectures dans les paramètres du profil.</p> :
      rows.map(row => <div key={row.userId} className="space-y-1">
        <p><strong>{row.user.username}</strong> · {row.story.title} · {row.chapter.title} · {Math.round(row.progressPercent)} % du chapitre</p>
        <progress className="w-full h-2 accent-purple-600" value={row.progressPercent} max={100} aria-label={`Progression de ${row.user.username}`} />
      </div>)}
  </section>;
}
