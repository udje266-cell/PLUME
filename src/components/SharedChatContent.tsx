import type { ReactNode } from 'react';
import { ArrowRight, BookOpen, Download, FileText } from 'lucide-react';
import type { Story } from '../types';
import { parseChatShare } from '../utils/chatContent';
import { generateCoverDataUri } from '../utils/coverImage';

export default function SharedChatContent({ content, stories, onSelectStory, renderCaption }: {
  content: string; stories: Story[]; onSelectStory: (story: Story) => void; renderCaption: (text: string) => ReactNode;
}) {
  const share = parseChatShare(content);
  if (!share) return <p className="text-sm italic">Pièce jointe indisponible.</p>;
  const story = share.kind === 'book' ? stories.find(book => book.id === share.storyId && book.status === 'Publié') : null;
  return <div className="space-y-2 min-w-0">
    {share.kind === 'book' ? !story ? <div className="flex items-center gap-2 p-3 text-sm"><BookOpen className="w-5 h-5" />Ce livre n’est plus disponible.</div> : <section aria-label={`Livre partagé : ${story.title}`} className="rounded-2xl border border-purple-400/30 bg-purple-50 dark:bg-[#151226] p-3 text-zinc-900 dark:text-zinc-100">
      <div className="flex gap-3"><img src={story.cover || generateCoverDataUri(story.title)} alt={`Couverture de ${story.title}`} className="w-20 sm:w-24 h-32 sm:h-36 rounded-lg object-cover shrink-0" onError={event => { event.currentTarget.onerror = null; event.currentTarget.src = generateCoverDataUri(story.title); }} />
        <div className="min-w-0 flex-1"><h3 className="text-sm font-bold leading-snug break-words">{story.title}</h3><p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">{story.authorName}</p><p className="mt-1 text-[11px] text-purple-600 dark:text-purple-300">{story.genre}</p><p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400 line-clamp-3">{story.description}</p></div>
      </div><button type="button" onClick={() => onSelectStory(story)} className="mt-3 pt-2 border-t border-purple-500/15 w-full flex items-center justify-end gap-2 text-xs font-semibold text-purple-700 dark:text-purple-300">Voir le livre<ArrowRight className="w-4 h-4" /></button>
    </section> : share.kind === 'photo' ? <a href={share.url} target="_blank" rel="noopener noreferrer" aria-label={`Ouvrir la photo ${share.name}`} className="block"><img src={share.url} alt={share.name} loading="lazy" className="max-h-80 w-full max-w-sm rounded-xl object-contain" /></a> : <a href={share.url} download={share.name} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 rounded-xl border border-purple-400/25 p-3 hover:bg-purple-500/10" aria-label={`Télécharger ${share.name}`}>
      <FileText className="h-7 w-7 shrink-0" /><span className="min-w-0 flex-1"><span className="block text-xs font-semibold break-all">{share.name}</span><span className="text-[10px] opacity-70">{share.size < 1024 ? `${share.size} octets` : `${Math.ceil(share.size / 1024)} Ko`}</span></span><Download className="h-4 w-4 shrink-0" />
    </a>}
    {share.caption && <div className="text-sm leading-relaxed break-words">{renderCaption(share.caption)}</div>}
  </div>;
}
