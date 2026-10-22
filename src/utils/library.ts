import type { Story } from '../types';
import type { BookProgress } from './readingProgress';
import { buildParaMeta, bookPercentFromParagraph } from './readingProgress';
import { contentToParagraphs } from './chapterParagraphs';

export type ReadingStatus = 'currently' | 'later' | 'completed';
export type LibrarySort = 'recent' | 'title' | 'author';
export interface ReaderCollection { id: string; name: string; createdAt: string; books: { storyId: string; addedAt: string }[]; }
export interface LibrarySnapshot {
  collections: ReaderCollection[];
  entries: { storyId: string; list: string; createdAt: string }[];
  favorites: { storyId: string; createdAt: string }[];
  progress: { storyId: string; chapterId: string; progressPercent: number; paragraphIndex?: number | null; lastReadAt: string }[];
  history: { storyId: string; addedAt: string; lastOpenedAt: string }[];
  reads: { storyId: string; chapterId: string }[];
}
export const EMPTY_LIBRARY: LibrarySnapshot = { collections: [], entries: [], favorites: [], progress: [], history: [], reads: [] };
export const normalizeSearch = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('fr');
const stamp = (value?: string) => value ? new Date(value).getTime() || 0 : 0;

/** Exact local paragraph position wins only when it is newer than the server. */
export function libraryProgress(story: Story, local: BookProgress | null, remote?: LibrarySnapshot['progress'][number]) {
  const chapters = story.chapters.filter(chapter => chapter.isPublished);
  if (local && (!remote || stamp(local.updatedAt) >= stamp(remote.lastReadAt))) {
    const chapterIndex = Math.min(Math.max(0, local.chapterIndex), Math.max(0, chapters.length - 1));
    const counts = chapters.map(chapter => Math.max(1, contentToParagraphs(chapter.content || '').length));
    const para = local.percent === 100 || local.scrollRatio >= .995 ? counts[chapterIndex] : local.paragraphIndex;
    const percent = typeof para === 'number' ? bookPercentFromParagraph(buildParaMeta(counts), chapterIndex, para) : local.percent;
    return { percent: Math.max(0, Math.min(100, percent)), paragraphIndex: local.paragraphIndex, chapterIndex, updatedAt: local.updatedAt, source: 'local' as const };
  }
  if (remote) {
    const chapterIndex = chapters.findIndex(chapter => chapter.id === remote.chapterId);
    if (chapterIndex >= 0) {
      const counts = chapters.map(chapter => Math.max(1, contentToParagraphs(chapter.content || '').length));
      const before = counts.slice(0, chapterIndex).reduce((sum, count) => sum + count, 0);
      const total = counts.reduce((sum, count) => sum + count, 0);
      const current = typeof remote.paragraphIndex === 'number' ? Math.min(counts[chapterIndex], Math.max(0, remote.paragraphIndex)) : counts[chapterIndex] * Math.max(0, Math.min(100, remote.progressPercent)) / 100;
      const paragraphIndex = Math.min(counts[chapterIndex] - 1, typeof remote.paragraphIndex === 'number' ? Math.max(0, remote.paragraphIndex) : Math.round(current));
      return { paragraphIndex, percent: Math.round(100 * (before + current) / total), chapterIndex, updatedAt: remote.lastReadAt, source: 'server' as const };
    }
  }
  return { percent: 0, paragraphIndex: 0, chapterIndex: 0, updatedAt: '', source: 'none' as const };
}

export function libraryStatus(id: string, percent: number, lists: Record<ReadingStatus, string[]>): ReadingStatus {
  if (lists.completed.includes(id)) return 'completed';
  if (lists.currently.includes(id)) return 'currently';
  if (lists.later.includes(id)) return 'later';
  return percent >= 100 ? 'completed' : percent > 0 ? 'currently' : 'later';
}

/** Only chapters actually published since the last visit/addition count as new. */
export function newLibraryChapters(story: Story, baseline: string, readChapterIds: string[]): number {
  const since = stamp(baseline);
  if (!since) return 0;
  return story.chapters.filter(chapter => chapter.isPublished && stamp(chapter.publishedAt || chapter.publishDate) > since && !readChapterIds.includes(chapter.id)).length;
}

export function sortLibraryBooks<T extends { story: Story; addedAt: string }>(books: T[], sort: LibrarySort): T[] {
  return [...books].sort((a, b) => sort === 'title' ? a.story.title.localeCompare(b.story.title, 'fr', { sensitivity: 'base' }) :
    sort === 'author' ? a.story.authorName.localeCompare(b.story.authorName, 'fr', { sensitivity: 'base' }) : stamp(b.addedAt) - stamp(a.addedAt));
}
