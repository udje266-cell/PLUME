import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Bookmark, BookOpen, Check, ChevronRight, FolderHeart, Grid2X2, List, MoreHorizontal, Play, Plus, Search, Sparkles, Trash2, X } from 'lucide-react';
import type { Story, User } from '../types';
import { authHeaders } from '../utils/auth';
import { getBookProgress, getSavedBookProgress, saveBookProgress } from '../utils/readingProgress';
import { EMPTY_LIBRARY, libraryProgress, libraryStatus, newLibraryChapters, normalizeSearch, sortLibraryBooks, type LibrarySnapshot, type LibrarySort, type ReaderCollection, type ReadingStatus } from '../utils/library';
import { optimizedImage } from '../utils/imageUrl';
import { generateCoverDataUri } from '../utils/coverImage';

interface Props {
  currentUser: User; stories: Story[]; favorites: string[];
  currentlyReading: string[]; readLater: string[]; completedStories: string[];
  onSelectStory: (story: Story) => void; onDiscover: () => void;
  onToggleFavorite: (id: string) => void; onSetStatus: (id: string, status: ReadingStatus) => void;
}
const labels: Record<ReadingStatus, string> = { currently: 'En cours', later: 'À lire', completed: 'Terminés' };
const dateNumber = (value: string) => new Date(value).getTime() || 0;
const readStored = <T,>(key: string, fallback: T): T => { try { return JSON.parse(localStorage.getItem(key) || 'null') ?? fallback; } catch { return fallback; } };

export default function LibraryView({ currentUser, stories, favorites, currentlyReading, readLater, completedStories, onSelectStory, onDiscover, onToggleFavorite, onSetStatus }: Props) {
  const cacheKey = `plume_library_${currentUser.id}`;
  const optionsKey = `plume_library_options_${currentUser.id}`;
  const [snapshot, setSnapshot] = useState<LibrarySnapshot>(() => readStored(cacheKey, EMPTY_LIBRARY));
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [tab, setTab] = useState<ReadingStatus | 'all'>('currently');
  const [collectionId, setCollectionId] = useState<string | null>(null);
  const [view, setView] = useState<'grid' | 'list'>(() => readStored(optionsKey, { view: 'grid' }).view === 'list' ? 'list' : 'grid');
  const [sort, setSort] = useState<LibrarySort>(() => readStored<{ sort: LibrarySort }>(optionsKey, { sort: 'recent' }).sort);
  const [overrides, setOverrides] = useState<Record<string, ReadingStatus>>({});
  const [, updateProgress] = useState(0);
  const [menuId, setMenuId] = useState<string | null>(null);
  const [fanned, setFanned] = useState<string | null>(null);
  const [dialog, setDialog] = useState<{ id?: string; name: string } | null>(null);
  const [bookQuery, setBookQuery] = useState('');
  const [busy, setBusy] = useState(false);
  const [dialogError, setDialogError] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const gridRef = useRef<HTMLElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async (signal?: AbortSignal) => {
    try {
      const response = await fetch('/api/me/library', { headers: authHeaders(), signal });
      if (!response.ok) throw new Error('La synchronisation est indisponible. Vos données déjà enregistrées restent accessibles.');
      const data: LibrarySnapshot = await response.json();
      if (signal?.aborted) return;
      setSnapshot(data); setError('');
      setOverrides(previous => Object.fromEntries(Object.entries(previous).filter(([id, status]) => !data.entries.some(entry => entry.storyId === id && entry.list === status))));
      try { localStorage.setItem(cacheKey, JSON.stringify(data)); } catch { /* quota */ }
    } catch (failure: any) {
      if (!signal?.aborted) setError(failure instanceof TypeError ? 'Connexion interrompue. Votre bibliothèque enregistrée reste disponible.' : failure.message || 'Impossible de synchroniser votre bibliothèque.');
    } finally { if (!signal?.aborted) setLoading(false); }
  }, [cacheKey]);

  useEffect(() => {
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    const refresh = () => { clearTimeout(timer); timer = setTimeout(() => { void load(controller.signal); }, 300); };
    void load(controller.signal);
    const interval = setInterval(refresh, 20_000);
    window.addEventListener('plume:reading-progress', refresh);
    window.addEventListener('online', refresh);
    return () => { controller.abort(); clearTimeout(timer); clearInterval(interval); window.removeEventListener('plume:reading-progress', refresh); window.removeEventListener('online', refresh); };
  }, [load]);
  useEffect(() => {
    const refresh = () => updateProgress(value => value + 1);
    const storage = (event: StorageEvent) => { if (!event.key || event.key === `plume_book_progress_${currentUser.id}`) refresh(); };
    window.addEventListener('plume:book-progress', refresh); window.addEventListener('storage', storage);
    return () => { window.removeEventListener('plume:book-progress', refresh); window.removeEventListener('storage', storage); };
  }, [currentUser.id]);
  useEffect(() => { try { localStorage.setItem(optionsKey, JSON.stringify({ view, sort })); } catch { /* unavailable */ } }, [view, sort, optionsKey]);
  useEffect(() => {
    if (!dialog) return;
    const previous = document.activeElement as HTMLElement | null;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !busy) setDialog(null);
      if (event.key === 'Tab') {
        const nodes = dialogRef.current?.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled)');
        if (!nodes?.length) return;
        const first = nodes[0], last = nodes[nodes.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
      }
    };
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('keydown', onKey); previous?.focus(); };
  }, [!!dialog, busy]);

  const published = stories.filter(story => story.status === 'Publié' && !story.isFlagged);
  const saved = getSavedBookProgress(currentUser.id);
  const ids = new Set([...currentlyReading, ...readLater, ...completedStories, ...favorites, ...Object.keys(saved),
    ...snapshot.entries.map(row => row.storyId), ...snapshot.favorites.map(row => row.storyId),
    ...snapshot.history.map(row => row.storyId), ...snapshot.progress.map(row => row.storyId),
    ...snapshot.collections.flatMap(collection => collection.books.map(book => book.storyId))]);
  const books = published.filter(story => ids.has(story.id)).map(story => {
    const remote = snapshot.progress.find(row => row.storyId === story.id);
    const progress = libraryProgress(story, getBookProgress(currentUser.id, story.id), remote);
    const history = snapshot.history.find(row => row.storyId === story.id);
    const dates = [...snapshot.entries.filter(row => row.storyId === story.id).map(row => row.createdAt),
      ...snapshot.favorites.filter(row => row.storyId === story.id).map(row => row.createdAt),
      ...snapshot.collections.flatMap(collection => collection.books.filter(book => book.storyId === story.id).map(book => book.addedAt)), history?.addedAt].filter(Boolean) as string[];
    const addedAt = dates.sort((a, b) => dateNumber(a) - dateNumber(b))[0] || progress.updatedAt;
    const remoteLists = snapshot.entries.filter(entry => entry.storyId === story.id);
    const lists = remoteLists.length ? {
      currently: remoteLists.filter(entry => entry.list === 'currently').map(entry => entry.storyId),
      later: remoteLists.filter(entry => entry.list === 'later').map(entry => entry.storyId),
      completed: remoteLists.filter(entry => entry.list === 'completed').map(entry => entry.storyId),
    } : { currently: currentlyReading, later: readLater, completed: completedStories };
    const status = overrides[story.id] || libraryStatus(story.id, progress.percent || (history ? .001 : 0), lists);
    const lastVisit = [history?.lastOpenedAt, progress.updatedAt, addedAt].filter(Boolean).sort((a, b) => dateNumber(b!) - dateNumber(a!))[0] || '';
    const news = newLibraryChapters(story, lastVisit, snapshot.reads.filter(row => row.storyId === story.id).map(row => row.chapterId));
    return { story, progress, status, addedAt, lastVisit, news };
  });
  const counts = { currently: books.filter(book => book.status === 'currently').length, later: books.filter(book => book.status === 'later').length, completed: books.filter(book => book.status === 'completed').length };
  const resume = books.filter(book => book.status === 'currently' && book.progress.percent < 100).sort((a, b) => dateNumber(b.lastVisit) - dateNumber(a.lastVisit))[0];
  const favoriteBooks = books.filter(book => favorites.includes(book.story.id));
  const selectedCollection = snapshot.collections.find(collection => collection.id === collectionId);
  const matching = books.filter(book => (tab === 'all' || book.status === tab) &&
    (!collectionId || (collectionId === 'favorites' ? favorites.includes(book.story.id) : selectedCollection?.books.some(row => row.storyId === book.story.id))) &&
    normalizeSearch(`${book.story.title} ${book.story.authorName}`).includes(normalizeSearch(query.trim())));
  const visible = sortLibraryBooks(matching, sort);
  const cover = (story: Story, width = 360) => optimizedImage(story.cover, width) || generateCoverDataUri(story.title);
  const fallback = (story: Story) => (event: React.SyntheticEvent<HTMLImageElement>) => { if (!event.currentTarget.dataset.fallback) { event.currentTarget.dataset.fallback = '1'; event.currentTarget.src = generateCoverDataUri(story.title); } };
  const openCollection = (id: string) => { setCollectionId(collectionId === id ? null : id); setTab('all'); };
  const setStatus = (id: string, status: ReadingStatus) => { setOverrides(previous => ({ ...previous, [id]: status })); onSetStatus(id, status); setMenuId(null); };
  const continueBook = (book: typeof books[number]) => {
    if (book.progress.source === 'server') {
      const remote = snapshot.progress.find(row => row.storyId === book.story.id)!;
      const fraction = Math.max(0, Math.min(1, remote.progressPercent / 100));
      saveBookProgress(currentUser.id, book.story.id, { chapterIndex: book.progress.chapterIndex, scrollRatio: fraction, paragraphIndex: book.progress.paragraphIndex, percent: book.progress.percent });
    }
    onSelectStory(book.story);
  };
  const request = async (method: string, path: string, body?: unknown) => {
    let response: Response;
    try { response = await fetch(path, { method, headers: authHeaders({ 'Content-Type': 'application/json' }), ...(body ? { body: JSON.stringify(body) } : {}) }); }
    catch { throw new Error('Connexion interrompue. Réessayez après reconnexion pour enregistrer cette modification.'); }
    if (!response.ok) { const data = await response.json().catch(() => ({})); throw new Error(data.error || 'Impossible d’enregistrer cette modification. Réessayez après reconnexion.'); }
    return response.status === 204 ? null : response.json();
  };
  const openEditor = (collection?: ReaderCollection) => { setDialog({ id: collection?.id, name: collection?.name || '' }); setBookQuery(''); setDialogError(''); setConfirmDelete(false); };
  const saveCollection = async (event: React.FormEvent) => {
    event.preventDefault(); if (!dialog || busy) return;
    setBusy(true); setDialogError('');
    try {
      const collection = await request(dialog.id ? 'PATCH' : 'POST', `/api/me/collections${dialog.id ? `/${encodeURIComponent(dialog.id)}` : ''}`, { name: dialog.name.trim() });
      await load();
      if (dialog.id) setDialog(null); else setDialog({ id: collection.id, name: collection.name });
    } catch (failure: any) { setDialogError(failure.message); } finally { setBusy(false); }
  };
  const changeMembership = async (storyId: string, active: boolean) => {
    if (!dialog?.id || busy) return;
    const previous = snapshot;
    setSnapshot(state => ({ ...state, collections: state.collections.map(collection => collection.id !== dialog.id ? collection : {
      ...collection, books: active ? [...collection.books.filter(book => book.storyId !== storyId), { storyId, addedAt: new Date().toISOString() }] : collection.books.filter(book => book.storyId !== storyId),
    }) }));
    setBusy(true); setDialogError('');
    try { await request(active ? 'PUT' : 'DELETE', `/api/me/collections/${encodeURIComponent(dialog.id)}/books/${encodeURIComponent(storyId)}`); await load(); }
    catch (failure: any) { setSnapshot(previous); setDialogError(failure.message); } finally { setBusy(false); }
  };
  const removeCollection = async () => {
    if (!dialog?.id || busy) return; setBusy(true);
    try { await request('DELETE', `/api/me/collections/${encodeURIComponent(dialog.id)}`); if (collectionId === dialog.id) setCollectionId(null); setDialog(null); await load(); }
    catch (failure: any) { setDialogError(failure.message); } finally { setBusy(false); }
  };
  const progressBar = (value: number, title: string) => <div className="mt-1.5 flex items-center gap-2"><div role="progressbar" aria-label={`Progression de ${title}`} aria-valuenow={Math.round(value)} aria-valuemin={0} aria-valuemax={100} className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-purple-100 dark:bg-purple-950"><div className="h-full rounded-full bg-gradient-to-r from-purple-500 to-violet-600 transition-[width] motion-reduce:transition-none" style={{ width: `${value}%` }} /></div><span className="shrink-0 text-[10px] text-zinc-500 dark:text-zinc-400">{Math.round(value)} %</span></div>;
  const collectionCard = (id: string, name: string, items: Story[], index: number) => {
    const expanded = fanned === id || collectionId === id;
    return <div key={id} className="relative min-w-0">
      <button onClick={() => openCollection(id)} onPointerEnter={event => { if (event.pointerType !== 'touch') setFanned(id); }} onPointerLeave={() => setFanned(null)} onPointerDown={() => setFanned(id)} onPointerUp={() => setFanned(null)} aria-pressed={collectionId === id} className={`w-full overflow-hidden rounded-2xl px-2 pb-3 pt-2 text-center outline-offset-2 ${index % 2 ? 'bg-[#fcede8] dark:bg-rose-950/30' : 'bg-[#f0eafa] dark:bg-purple-950/40'} ${collectionId === id ? 'ring-2 ring-violet-500' : ''}`}>
        <div className="relative mx-auto h-[82px] max-w-[175px]" aria-hidden="true">
          {items.slice(0, 5).map((story, position, array) => {
            const offset = position - (array.length - 1) / 2;
            return <img key={story.id} src={cover(story, 160)} alt="" draggable={false} onError={fallback(story)} className="absolute bottom-0 left-1/2 h-[72px] w-[49px] rounded shadow-md transition-transform duration-300 motion-reduce:transition-none" style={{ zIndex: 10 - Math.abs(offset), transform: `translateX(calc(-50% + ${offset * (expanded ? 27 : 20)}px)) rotate(${offset * (expanded ? 13 : 4)}deg) translateY(${Math.abs(offset) * (expanded ? 4 : 2)}px)` }} />;
          })}
          {!items.length && <FolderHeart className="absolute left-1/2 top-5 h-11 w-11 -translate-x-1/2 text-purple-400/60" />}
        </div>
        <h3 className="mt-2 line-clamp-1 font-serif text-sm font-semibold sm:text-base">{name}</h3><p className="text-[10px] text-zinc-500">{items.length} livre{items.length > 1 ? 's' : ''}</p>
      </button>
      {id !== 'favorites' && <button aria-label={`Modifier ${name}`} onClick={() => openEditor(snapshot.collections.find(collection => collection.id === id))} className="absolute right-1.5 top-1.5 rounded-full bg-white/80 p-1 text-zinc-600 dark:bg-zinc-900 dark:text-zinc-300"><MoreHorizontal className="h-4 w-4" /></button>}
    </div>;
  };

  return <div className="mx-auto w-full max-w-6xl px-[18px] pb-9 pt-2 text-[#181224] dark:text-zinc-100 sm:px-7 lg:px-10 lg:pt-7">
    <header><h1 className="font-serif text-[clamp(28px,7.5vw,44px)] font-bold leading-tight tracking-[-0.04em]">Ma bibliothèque</h1><p className="mt-1 text-[13px] text-zinc-500 sm:text-base">Vos histoires, toujours à portée de main.</p>
      <div className="relative mt-4"><Search className="absolute left-3.5 top-3 h-5 w-5 text-zinc-500" /><input type="search" aria-label="Rechercher dans ma bibliothèque" placeholder="Rechercher dans ma bibliothèque…" value={query} onChange={event => setQuery(event.target.value)} className="h-11 w-full rounded-[17px] bg-[#f0eff5] pl-11 pr-3 text-xs outline-none focus:ring-2 focus:ring-purple-500/40 dark:bg-zinc-900" /></div>
    </header>
    <div role="tablist" aria-label="État de lecture" className="mt-3 grid grid-cols-3 gap-2">
      {(Object.keys(labels) as ReadingStatus[]).map(status => <button key={status} role="tab" aria-selected={tab === status} onClick={() => { setTab(status); setCollectionId(null); }} className={`flex items-center justify-center gap-1.5 rounded-xl px-1 py-2.5 text-xs transition ${tab === status ? 'bg-gradient-to-r from-violet-600 to-purple-600 text-white shadow-sm' : 'bg-[#f0eff5] text-zinc-700 dark:bg-zinc-900 dark:text-zinc-300'}`}>{labels[status]}<span className={`rounded-full px-1.5 py-0.5 text-[10px] ${tab === status ? 'bg-white/25' : 'bg-zinc-200/60 dark:bg-zinc-800'}`}>{counts[status]}</span></button>)}
    </div>
    {error && <div role="status" className="mt-3 flex items-center justify-between gap-2 rounded-xl bg-amber-50 p-3 text-xs text-amber-800 dark:bg-amber-950/30 dark:text-amber-200">{error}<button onClick={() => void load()} className="shrink-0 font-bold underline">Réessayer</button></div>}
    {loading && !books.length && <p role="status" className="py-4 text-xs text-zinc-400">Synchronisation de votre bibliothèque…</p>}

    {resume && !query && <section aria-label="Reprendre une histoire" className="mt-5">
      <div className="mb-2 flex items-center justify-between"><h2 className="font-serif text-xl font-semibold tracking-tight">Reprendre une histoire</h2><button onClick={() => { setTab('currently'); setCollectionId(null); gridRef.current?.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' }); }} className="flex items-center gap-1 text-[11px] text-purple-700 dark:text-purple-400">Tout voir<ChevronRight className="h-4 w-4" /></button></div>
      <div className="flex gap-3 rounded-2xl bg-[#f1ebfd] p-3 shadow-sm dark:bg-purple-950/30 sm:gap-5 sm:p-4">
        <img src={cover(resume.story, 240)} alt={resume.story.title} onError={fallback(resume.story)} className="w-[90px] shrink-0 rounded-lg object-cover sm:w-28" />
        <div className="min-w-0 flex-1"><div className="flex items-start justify-between gap-2"><div className="min-w-0"><h3 className="line-clamp-2 font-serif text-xl font-semibold leading-tight">{resume.story.title}</h3><p className="mt-1 truncate text-xs text-zinc-500">{resume.story.authorName}</p></div><button aria-label={favorites.includes(resume.story.id) ? 'Retirer des favoris' : 'Ajouter aux favoris'} onClick={() => onToggleFavorite(resume.story.id)} className="p-1 text-purple-600"><Bookmark className="h-5 w-5" fill={favorites.includes(resume.story.id) ? 'currentColor' : 'none'} /></button></div>
          <p className="mt-5 text-[10px] text-zinc-500">Chapitre {resume.progress.chapterIndex + 1} sur {resume.story.chapters.filter(chapter => chapter.isPublished).length}</p>
          {progressBar(resume.progress.percent, resume.story.title)}
          <button onClick={() => continueBook(resume)} className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-purple-600 py-2.5 text-xs font-semibold text-white hover:brightness-110"><Play className="h-3.5 w-3.5" fill="currentColor" />Reprendre</button>
        </div>
      </div>
    </section>}

    {!query && <section aria-label="Mes collections" className="mt-5">
      <div className="mb-2.5 flex items-center justify-between"><h2 className="font-serif text-xl font-semibold tracking-tight">Mes collections</h2><button onClick={() => openEditor()} className="flex items-center gap-1 rounded-xl border border-purple-400 px-2.5 py-1.5 text-[11px] text-purple-700 dark:text-purple-300"><Plus className="h-3.5 w-3.5" />Créer</button></div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {collectionCard('favorites', 'Favoris', favoriteBooks.map(book => book.story), 0)}
        {snapshot.collections.map((collection, index) => collectionCard(collection.id, collection.name, collection.books.map(row => books.find(book => book.story.id === row.storyId)?.story).filter(Boolean) as Story[], index + 1))}
        {!snapshot.collections.length && <button onClick={() => openEditor()} className="flex min-h-[132px] flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-purple-300 bg-purple-50/40 p-4 text-xs text-purple-600 dark:bg-purple-950/10"><Plus className="h-6 w-6" />Créer ma première collection</button>}
      </div>
    </section>}

    <section ref={gridRef} aria-label="Tous mes livres" className="mt-5 scroll-mt-5">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2"><h2 className="font-serif text-xl font-semibold tracking-tight">{collectionId === 'favorites' ? 'Favoris' : selectedCollection?.name || 'Tous mes livres'}</h2><div className="flex items-center gap-2">
        <select aria-label="Trier mes livres" value={sort} onChange={event => setSort(event.target.value as LibrarySort)} className="max-w-[108px] rounded-lg bg-transparent py-1 text-[11px] outline-purple-500 dark:bg-zinc-950"><option value="recent">Ajout récent</option><option value="title">Titre</option><option value="author">Auteur</option></select>
        <div className="flex gap-1"><button aria-label="Vue en grille" aria-pressed={view === 'grid'} onClick={() => setView('grid')} className={`rounded-md p-1.5 ${view === 'grid' ? 'bg-purple-600 text-white' : 'bg-zinc-100 text-zinc-500 dark:bg-zinc-900'}`}><Grid2X2 className="h-4 w-4" /></button><button aria-label="Vue en liste" aria-pressed={view === 'list'} onClick={() => setView('list')} className={`rounded-md p-1.5 ${view === 'list' ? 'bg-purple-600 text-white' : 'bg-zinc-100 text-zinc-500 dark:bg-zinc-900'}`}><List className="h-4 w-4" /></button></div>
      </div></div>
      {collectionId && <button onClick={() => { setCollectionId(null); setTab('all'); }} className="mb-3 text-xs text-purple-600">Toutes mes étagères ×</button>}
      {visible.length ? <div className={view === 'grid' ? 'grid grid-cols-2 gap-x-4 gap-y-5 sm:grid-cols-3 lg:grid-cols-4' : 'space-y-3'}>
        {visible.map(book => <article key={book.story.id} data-book-id={book.story.id} className={`relative min-w-0 ${view === 'list' ? 'flex gap-3 rounded-xl bg-zinc-50 p-2.5 dark:bg-zinc-900/60' : ''}`}>
          <button onClick={() => continueBook(book)} aria-label={`Ouvrir ${book.story.title}`} className={`relative block overflow-hidden rounded-xl ${view === 'list' ? 'w-14 shrink-0' : 'w-full'}`}>
            <img src={cover(book.story)} alt={book.story.title} onError={fallback(book.story)} loading="lazy" className={`w-full bg-zinc-100 object-cover dark:bg-zinc-900 ${view === 'list' ? 'h-20' : 'aspect-[0.88]'}`} />
            {view === 'grid' && <span className="absolute left-1.5 top-1.5 flex items-center gap-1 rounded-full bg-white/95 px-1.5 py-1 text-[8px] text-zinc-700 shadow-sm"><BookOpen className="h-2.5 w-2.5 text-purple-600" />{labels[book.status]}</span>}
          </button>
          <div className={`min-w-0 ${view === 'list' ? 'flex-1 pr-6' : ''}`}><h3 className="mt-1.5 line-clamp-2 font-serif text-base font-semibold leading-tight">{book.story.title}</h3><p className="mt-0.5 truncate text-[10px] text-zinc-400">{book.story.authorName}{view === 'list' ? ` · ${labels[book.status]}` : ''}</p>{progressBar(book.progress.percent, book.story.title)}
            {book.news > 0 && <p className="mt-1.5 flex items-center gap-1 text-[9px] font-medium text-purple-700 dark:text-purple-400"><Sparkles className="h-3 w-3" />{book.news} nouveau{book.news > 1 ? 'x' : ''} chapitre{book.news > 1 ? 's' : ''}</p>}
          </div>
          <button onClick={() => setMenuId(menuId === book.story.id ? null : book.story.id)} aria-label={`Options de ${book.story.title}`} aria-expanded={menuId === book.story.id} className={`absolute right-1 top-1 rounded-full bg-white/90 p-1 text-zinc-500 dark:bg-zinc-950/90 ${view === 'list' ? 'right-2 top-2' : ''}`}><MoreHorizontal className="h-4 w-4" /></button>
          {menuId === book.story.id && <><button aria-label="Fermer les options du livre" onClick={() => setMenuId(null)} className="fixed inset-0 z-20 cursor-default" /><div className="absolute right-0 top-8 z-30 min-w-[165px] rounded-xl border border-zinc-100 bg-white p-1.5 text-xs shadow-xl dark:border-zinc-800 dark:bg-zinc-950">
            {(Object.keys(labels) as ReadingStatus[]).map(status => <button key={status} onClick={() => setStatus(book.story.id, status)} className="flex w-full items-center justify-between rounded-lg p-2 text-left hover:bg-purple-50 dark:hover:bg-zinc-900">{labels[status]}{book.status === status && <Check className="h-3 w-3 text-purple-600" />}</button>)}
            <button onClick={() => { onToggleFavorite(book.story.id); setMenuId(null); }} className="block w-full rounded-lg p-2 text-left hover:bg-purple-50 dark:hover:bg-zinc-900">{favorites.includes(book.story.id) ? 'Retirer des favoris' : 'Ajouter aux favoris'}</button>
            <button onClick={() => { openEditor(); setMenuId(null); }} className="block w-full rounded-lg p-2 text-left hover:bg-purple-50 dark:hover:bg-zinc-900">Créer une collection</button>
          </div></>}
        </article>)}
      </div> : <div className="rounded-2xl bg-purple-50/60 px-5 py-8 text-center dark:bg-purple-950/20"><BookOpen className="mx-auto mb-3 h-8 w-8 text-purple-400" /><p className="text-sm">{query ? 'Aucun livre ne correspond à cette recherche.' : selectedCollection ? 'Cette collection attend ses premières histoires.' : `Aucun livre dans « ${tab === 'all' ? 'Tous mes livres' : labels[tab]} » pour le moment.`}</p><button onClick={selectedCollection ? () => openEditor(selectedCollection) : onDiscover} className="mt-3 rounded-xl bg-purple-600 px-4 py-2 text-xs font-semibold text-white">{selectedCollection ? 'Ajouter des livres' : 'Découvrir des histoires'}</button></div>}
    </section>

    {dialog && <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm" onClick={() => { if (!busy) setDialog(null); }}>
      <div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="collection-dialog-title" onClick={event => event.stopPropagation()} className="max-h-[85dvh] w-full max-w-md overflow-y-auto rounded-2xl bg-white p-5 shadow-xl dark:bg-zinc-950">
        <div className="flex items-center justify-between gap-2"><h2 id="collection-dialog-title" className="font-serif text-xl font-semibold">{dialog.id ? 'Ma collection' : 'Nouvelle collection'}</h2><button aria-label="Fermer la collection" disabled={busy} onClick={() => setDialog(null)} className="p-1"><X className="h-5 w-5" /></button></div>
        <form onSubmit={saveCollection} className="mt-4 space-y-3"><label className="block text-xs font-medium">Nom de la collection<input autoFocus maxLength={80} required value={dialog.name} onChange={event => setDialog({ ...dialog, name: event.target.value })} placeholder="Lectures du soir…" className="mt-1.5 w-full rounded-xl border border-purple-200 bg-transparent p-3 text-sm outline-purple-500 dark:border-zinc-700" /></label><button disabled={busy || !dialog.name.trim()} className="w-full rounded-xl bg-purple-600 p-2.5 text-xs font-semibold text-white disabled:opacity-50">{busy ? 'Enregistrement…' : dialog.id ? 'Enregistrer le nom' : 'Créer la collection'}</button></form>
        {dialogError && <p role="alert" className="mt-3 text-xs text-rose-600">{dialogError}</p>}
        {dialog.id && <><h3 className="mt-5 text-sm font-bold">Ajouter ou retirer des livres</h3><input aria-label="Rechercher un livre pour ma collection" type="search" value={bookQuery} onChange={event => setBookQuery(event.target.value)} placeholder="Titre ou auteur…" className="mt-2 w-full rounded-xl bg-zinc-100 p-2.5 text-xs dark:bg-zinc-900" /><div className="mt-2 max-h-60 space-y-1 overflow-y-auto">
          {published.filter(story => normalizeSearch(`${story.title} ${story.authorName}`).includes(normalizeSearch(bookQuery))).map(story => <label key={story.id} className="flex cursor-pointer items-center gap-2 rounded-lg p-2 hover:bg-purple-50 dark:hover:bg-zinc-900"><input type="checkbox" disabled={busy} checked={snapshot.collections.find(collection => collection.id === dialog.id)?.books.some(book => book.storyId === story.id) || false} onChange={event => void changeMembership(story.id, event.target.checked)} className="accent-purple-600" /><img src={cover(story, 80)} alt="" onError={fallback(story)} className="h-10 w-7 rounded object-cover" /><span className="min-w-0 text-xs"><strong className="block truncate">{story.title}</strong><span className="text-zinc-400">{story.authorName}</span></span></label>)}
        </div><p className="mt-2 text-[10px] text-zinc-400">Les livres cochés sont enregistrés dans votre collection.</p>
        {confirmDelete ? <div className="mt-4 rounded-xl bg-rose-50 p-3 text-xs dark:bg-rose-950/30"><p>Supprimer cette collection ? Vos livres et leur progression seront conservés.</p><div className="mt-2 flex gap-3"><button disabled={busy} onClick={() => void removeCollection()} className="font-bold text-rose-600">Supprimer la collection</button><button onClick={() => setConfirmDelete(false)}>Annuler</button></div></div> : <button onClick={() => setConfirmDelete(true)} className="mt-4 flex items-center gap-1 text-xs text-rose-600"><Trash2 className="h-3.5 w-3.5" />Supprimer cette collection</button>}
        <button disabled={busy} onClick={() => setDialog(null)} className="mt-4 w-full rounded-xl border border-purple-300 py-2.5 text-xs font-semibold text-purple-700 dark:text-purple-300">Terminé</button></>}
      </div>
    </div>}
  </div>;
}
