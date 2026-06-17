/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Editeur d'ecriture IMMERSIF (mobile-first), WYSIWYG :
 *  - zone d'ecriture contentEditable -> gras / italique / souligne VISIBLES en
 *    direct (comme WhatsApp), stockage en HTML leger (<b>/<i>/<u>) ;
 *  - auto-sauvegarde INVISIBLE (debounce + brouillon local + serveur) + bouton
 *    de sauvegarde MANUELLE ; toute sauvegarde lit les valeurs courantes (refs)
 *    pour ne jamais perdre les dernieres modifs a la sortie ;
 *  - mode immersion sans distraction ; navigation entre chapitres par swipe.
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import { ChevronLeft, Check, Loader2, Bold, Italic, Underline, Minus, Undo2, Redo2, Maximize2, List, Trash2, Save } from 'lucide-react';
import { Story, Chapter } from '../types';

interface ImmersiveEditorProps {
  story: Story;
  chapter: Chapter | null;
  fontFamily?: string;
  fontSize?: string;
  onPersistNew: (data: Partial<Chapter>) => Chapter | void;
  onPersistUpdate: (chapterId: string, data: Partial<Chapter>) => void;
  onDelete?: (chapterId: string) => void;
  onClose: () => void;
  onSwitchChapter: (target: Chapter | 'new') => void;
}

type SaveState = 'idle' | 'dirty' | 'saving' | 'saved';

const DRAFT_KEY = (storyId: string, chId: string) => `plume_chapter_draft_${storyId}_${chId}`;

function plainTextOf(html: string): string {
  const d = document.createElement('div');
  d.innerHTML = html || '';
  return (d.textContent || '').trim();
}

function useKeyboardHeight() {
  const [h, setH] = useState(0);
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const onResize = () => {
      const kb = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
      setH(kb > 80 ? kb : 0);
    };
    vv.addEventListener('resize', onResize);
    vv.addEventListener('scroll', onResize);
    onResize();
    return () => { vv.removeEventListener('resize', onResize); vv.removeEventListener('scroll', onResize); };
  }, []);
  return h;
}

export default function ImmersiveEditor({
  story, chapter, fontFamily, fontSize, onPersistNew, onPersistUpdate, onDelete, onClose, onSwitchChapter,
}: ImmersiveEditorProps) {
  const isNew = !chapter;
  const [title, setTitle] = useState(chapter ? chapter.title : `Chapitre ${story.chapters.length + 1} : `);
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const [chromeVisible, setChromeVisible] = useState(true);
  const [showSommaire, setShowSommaire] = useState(false);
  const [wordCount, setWordCount] = useState(() => plainTextOf(chapter?.content || '').split(/\s+/).filter(Boolean).length);

  const editorRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<any>(null);
  const idleRef = useRef<any>(null);
  const createdIdRef = useRef<string | null>(chapter?.id || null);
  const lastSavedRef = useRef<string>(`${chapter?.title || ''} ${chapter?.content || ''}`);

  const keyboardH = useKeyboardHeight();

  // Source de verite du contenu : le HTML de la zone editable (non controlee
  // par React pour eviter les sauts de curseur). Title controle en state.
  const titleRef = useRef(title);
  titleRef.current = title;
  const contentRef = useRef<string>(chapter?.content || '');

  // Initialise la zone editable une seule fois (au montage / changement chapitre).
  useEffect(() => {
    if (editorRef.current) editorRef.current.innerHTML = chapter?.content || '';
    contentRef.current = chapter?.content || '';
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const persist = useCallback((opts?: { force?: boolean }) => {
    const nextTitle = titleRef.current;
    const nextContent = contentRef.current;
    const sig = `${nextTitle} ${nextContent}`;
    if (!(opts && opts.force) && sig === lastSavedRef.current) return;
    if (!createdIdRef.current && !plainTextOf(nextContent)) return; // pas de chapitre fantome

    setSaveState('saving');
    try {
      if (createdIdRef.current) {
        onPersistUpdate(createdIdRef.current, { title: nextTitle.trim() || 'Chapitre', content: nextContent });
      } else {
        const created = onPersistNew({
          title: nextTitle.trim() || `Chapitre ${story.chapters.length + 1}`,
          content: nextContent,
          isPublished: true,
          publishDate: new Date().toISOString(),
          views: 0, reads: 0,
        });
        if (created && (created as Chapter).id) createdIdRef.current = (created as Chapter).id;
      }
      lastSavedRef.current = sig;
      try { localStorage.removeItem(DRAFT_KEY(story.id, createdIdRef.current || 'new')); } catch { /* ignore */ }
      setSaveState('saved');
      window.setTimeout(() => setSaveState((st) => (st === 'saved' ? 'idle' : st)), 1400);
    } catch {
      setSaveState('dirty');
    }
  }, [onPersistNew, onPersistUpdate, story.id, story.chapters.length]);

  const persistRef = useRef(persist);
  persistRef.current = persist;

  const persistNow = useCallback(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    persistRef.current();
  }, []);

  const saveManually = () => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    persistRef.current({ force: true });
  };

  // Planifie une sauvegarde + brouillon local (appele a chaque frappe/edition).
  const scheduleSave = useCallback(() => {
    setSaveState((st) => (st === 'saved' ? st : 'dirty'));
    try { localStorage.setItem(DRAFT_KEY(story.id, createdIdRef.current || 'new'), JSON.stringify({ title: titleRef.current, content: contentRef.current, at: Date.now() })); } catch { /* ignore */ }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => persistRef.current(), 800);
  }, [story.id]);

  // Sauvegarde forcee a l'arriere-plan + FLUSH au demontage (valeurs courantes).
  useEffect(() => {
    const onHide = () => { if (document.visibilityState === 'hidden') persistRef.current(); };
    document.addEventListener('visibilitychange', onHide);
    return () => {
      document.removeEventListener('visibilitychange', onHide);
      if (debounceRef.current) clearTimeout(debounceRef.current);
      persistRef.current();
    };
  }, []);

  const wakeChrome = useCallback(() => {
    setChromeVisible(true);
    if (idleRef.current) clearTimeout(idleRef.current);
    idleRef.current = setTimeout(() => setChromeVisible(false), 2600);
  }, []);
  useEffect(() => { wakeChrome(); return () => { if (idleRef.current) clearTimeout(idleRef.current); }; }, [wakeChrome]);

  // Edition : on lit le HTML courant, met a jour refs + compteur, planifie save.
  const onEditorInput = () => {
    const html = editorRef.current?.innerHTML || '';
    contentRef.current = html;
    setWordCount(plainTextOf(html).split(/\s+/).filter(Boolean).length);
    scheduleSave();
    wakeChrome();
  };

  // Mise en forme WYSIWYG (gras/italique/souligne) via execCommand.
  const applyFormat = (cmd: 'bold' | 'italic' | 'underline') => {
    editorRef.current?.focus();
    try { document.execCommand('styleWithCSS', false, 'false'); } catch { /* ignore */ }
    document.execCommand(cmd, false);
    onEditorInput();
  };
  const insertSeparator = () => {
    editorRef.current?.focus();
    document.execCommand('insertHTML', false, '<div>* * *</div><div><br></div>');
    onEditorInput();
  };
  const doUndo = () => { editorRef.current?.focus(); document.execCommand('undo'); onEditorInput(); };
  const doRedo = () => { editorRef.current?.focus(); document.execCommand('redo'); onEditorInput(); };

  // Navigation entre chapitres (swipe horizontal).
  const idx = isNew ? story.chapters.length : story.chapters.findIndex((c) => c.id === createdIdRef.current);
  const goRelative = (dir: -1 | 1) => {
    persistNow();
    const target = story.chapters[idx + dir];
    if (target) onSwitchChapter(target);
    else if (dir === 1) onSwitchChapter('new');
  };
  const touchX = useRef<number | null>(null);
  const onTouchStart = (e: React.TouchEvent) => { touchX.current = e.touches[0].clientX; };
  const onTouchEnd = (e: React.TouchEvent) => {
    if (touchX.current == null) return;
    const dx = e.changedTouches[0].clientX - touchX.current;
    touchX.current = null;
    const sel = window.getSelection();
    if (sel && !sel.isCollapsed) return; // ne pas naviguer pendant une selection
    if (Math.abs(dx) > window.innerWidth * 0.32) goRelative(dx < 0 ? 1 : -1);
  };

  const familyClass = fontFamily === 'sans' ? 'font-sans' : fontFamily === 'mono' ? 'font-mono' : 'font-serif';
  const sizeStyle = fontSize === 'small' ? '16px' : fontSize === 'large' ? '21px' : '18px';

  return (
    <div className="fixed inset-0 z-[100] bg-[#FBFAF7] dark:bg-[#15130F] flex flex-col" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
      <div className={`shrink-0 px-3 h-12 flex items-center gap-1.5 transition-all duration-200 ${chromeVisible ? 'opacity-100' : 'opacity-0 -translate-y-2 pointer-events-none'}`}>
        <button onClick={() => { persistNow(); onClose(); }} className="p-1.5 -ml-1 text-gray-500 dark:text-gray-300 shrink-0" aria-label="Retour">
          <ChevronLeft className="w-5 h-5" />
        </button>
        <input
          value={title}
          onChange={(e) => { setTitle(e.target.value); scheduleSave(); wakeChrome(); }}
          placeholder="Titre du chapitre"
          className="flex-1 min-w-0 bg-transparent text-sm font-serif font-black text-gray-900 dark:text-gray-100 focus:outline-none truncate"
        />
        <span className="text-gray-400 w-5 flex justify-center shrink-0" title={saveState === 'saving' ? 'Sauvegarde...' : 'A jour'}>
          {saveState === 'saving' ? <Loader2 className="w-4 h-4 animate-spin" />
            : saveState === 'saved' ? <Check className="w-4 h-4 text-emerald-500" />
            : saveState === 'dirty' ? <span className="w-1.5 h-1.5 rounded-full bg-gray-300 dark:bg-zinc-600 block" /> : null}
        </span>
        <button onClick={saveManually} className="flex items-center gap-1 text-[10px] font-black uppercase tracking-wide text-white bg-purple-600 hover:bg-purple-700 px-2.5 py-1.5 rounded-lg shrink-0" aria-label="Enregistrer">
          <Save className="w-3.5 h-3.5" />
        </button>
        <button onClick={() => setShowSommaire(true)} className="p-1.5 text-gray-500 dark:text-gray-300 shrink-0" aria-label="Sommaire"><List className="w-5 h-5" /></button>
      </div>

      <div
        className="flex-1 overflow-y-auto"
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
        onClick={() => { if (!chromeVisible) wakeChrome(); }}
      >
        <div
          ref={editorRef}
          contentEditable
          suppressContentEditableWarning
          onInput={onEditorInput}
          onFocus={wakeChrome}
          data-placeholder="Commence ton chapitre..."
          className={`plume-editor w-full min-h-full bg-transparent focus:outline-none break-words ${familyClass} text-[#1F2421] dark:text-[#E9E5DC]`}
          style={{
            fontSize: sizeStyle,
            lineHeight: 1.7,
            padding: `10px 14px ${Math.max(120, keyboardH + 80)}px 14px`,
            caretColor: '#7C3AED',
            whiteSpace: 'pre-wrap',
            overflowWrap: 'anywhere',
            width: '100%',
            boxSizing: 'border-box',
          }}
        />
      </div>

      <div
        className={`shrink-0 bg-white/95 dark:bg-[#0E0E14]/95 backdrop-blur border-t border-gray-100 dark:border-zinc-800 flex items-center justify-around px-2 transition-opacity ${chromeVisible || keyboardH > 0 ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
        style={{ height: 48, marginBottom: keyboardH, paddingBottom: keyboardH ? 0 : 'env(safe-area-inset-bottom)' }}
      >
        <button onMouseDown={(e) => e.preventDefault()} onClick={() => applyFormat('bold')} className="p-2 text-gray-700 dark:text-gray-200" aria-label="Gras"><Bold className="w-4 h-4" /></button>
        <button onMouseDown={(e) => e.preventDefault()} onClick={() => applyFormat('italic')} className="p-2 text-gray-700 dark:text-gray-200" aria-label="Italique"><Italic className="w-4 h-4" /></button>
        <button onMouseDown={(e) => e.preventDefault()} onClick={() => applyFormat('underline')} className="p-2 text-gray-700 dark:text-gray-200" aria-label="Souligne"><Underline className="w-4 h-4" /></button>
        <button onMouseDown={(e) => e.preventDefault()} onClick={insertSeparator} className="p-2 text-gray-700 dark:text-gray-200" aria-label="Separateur"><Minus className="w-4 h-4" /></button>
        <button onMouseDown={(e) => e.preventDefault()} onClick={doUndo} className="p-2 text-gray-700 dark:text-gray-200" aria-label="Annuler"><Undo2 className="w-4 h-4" /></button>
        <button onMouseDown={(e) => e.preventDefault()} onClick={doRedo} className="p-2 text-gray-700 dark:text-gray-200" aria-label="Retablir"><Redo2 className="w-4 h-4" /></button>
        <button onMouseDown={(e) => e.preventDefault()} onClick={() => { editorRef.current?.blur(); setChromeVisible(false); }} className="p-2 text-purple-600" aria-label="Immersion"><Maximize2 className="w-4 h-4" /></button>
      </div>

      {showSommaire && (
        <div className="fixed inset-0 z-[110] bg-black/40 flex items-end" onClick={() => setShowSommaire(false)}>
          <div className="w-full max-w-xl mx-auto bg-white dark:bg-[#0E0E14] rounded-t-3xl p-4 max-h-[70vh] overflow-y-auto" onClick={(e) => e.stopPropagation()} style={{ paddingBottom: 'calc(1rem + env(safe-area-inset-bottom))' }}>
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-serif font-black text-sm">Chapitres - {wordCount} mots ici</h3>
              {!isNew && onDelete && createdIdRef.current && (
                <button onClick={() => { if (confirm('Supprimer ce chapitre ?')) { onDelete(createdIdRef.current!); onClose(); } }} className="text-red-500 text-xs font-bold flex items-center gap-1"><Trash2 className="w-3.5 h-3.5" />Supprimer</button>
              )}
            </div>
            {story.chapters.map((c, i) => (
              <button key={c.id} onClick={() => { setShowSommaire(false); persistNow(); onSwitchChapter(c); }}
                className={`w-full text-left px-3 py-2.5 rounded-xl mb-1 flex items-center justify-between ${c.id === createdIdRef.current ? 'bg-purple-500/10 text-purple-600' : 'hover:bg-gray-100 dark:hover:bg-zinc-900'}`}>
                <span className="text-xs font-bold truncate">{i + 1}. {c.title || 'Sans titre'}</span>
                <span className="text-[9px] text-gray-400 shrink-0 ml-2">{c.isPublished ? 'Publie' : 'Brouillon'}</span>
              </button>
            ))}
            <button onClick={() => { setShowSommaire(false); persistNow(); onSwitchChapter('new'); }} className="w-full mt-2 py-2.5 rounded-xl bg-purple-600 text-white text-xs font-black uppercase tracking-wider">+ Nouveau chapitre</button>
          </div>
        </div>
      )}
    </div>
  );
}
