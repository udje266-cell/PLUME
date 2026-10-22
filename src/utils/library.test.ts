import { describe, it, expect } from 'vitest';
import { libraryProgress, libraryStatus, newLibraryChapters, sortLibraryBooks } from './library';
import type { Story } from '../types';
const story = { id: 's', title: 'Éveil', authorName: 'Zoé', chapters: [
  { id: 'c1', isPublished: true, content: 'Un\n\nDeux', publishDate: '2026-01-01' },
  { id: 'c2', isPublished: true, content: '<p>Trois</p><p>Quatre</p><p>Cinq</p><p>Six</p>', publishDate: '2026-10-22' },
  { id: 'draft', isPublished: false, content: 'secret', publishDate: '2026-10-23' },
] } as Story;

describe('personal library', () => {
  it('computes server progress using the same paragraph weights as the reader', () => {
    expect(libraryProgress(story, null, { storyId: 's', chapterId: 'c2', progressPercent: 50, lastReadAt: '2026-10-22' })).toMatchObject({ chapterIndex: 1, percent: 67, source: 'server' });
  });
  it('uses the stored paragraph even when a rounded percentage would land elsewhere', () => {
    const longStory = { ...story, chapters: [{ ...story.chapters[0], content: Array.from({ length: 200 }, () => 'Paragraphe').join('\n\n') }] };
    const position = libraryProgress(longStory, null, { storyId: 's', chapterId: 'c1', progressPercent: 37, paragraphIndex: 73, lastReadAt: '2026-10-22' });
    expect(position.percent).toBe(37);
    expect(position.paragraphIndex).toBe(73);
    expect(position.source).toBe('server');
  });
  it('chooses the freshest position instead of overwriting a newer device position', () => {
    const local = { chapterIndex: 0, scrollRatio: .35, percent: 35, updatedAt: '2026-10-21' };
    const remote = { storyId: 's', chapterId: 'c2', progressPercent: 50, lastReadAt: '2026-10-22' };
    expect(libraryProgress(story, local, remote).source).toBe('server');
    expect(libraryProgress(story, { ...local, updatedAt: '2026-10-23' }, remote).percent).toBe(35);
  });
  it('recalculates a completed book when more published chapters are added', () => {
    expect(libraryProgress(story, { chapterIndex: 0, paragraphIndex: 1, scrollRatio: 1, percent: 100, updatedAt: '2026-10-21' }).percent).toBe(33);
  });
  it('never counts a draft, an old chapter or a chapter already read as new', () => {
    expect(newLibraryChapters(story, '2026-10-21', [])).toBe(1);
    expect(newLibraryChapters(story, '2026-10-21', ['c2'])).toBe(0);
    expect(newLibraryChapters(story, '', [])).toBe(0);
  });
  it('detects a chapter released later on the same day, using its full timestamp', () => {
    const sameDay = { ...story, chapters: [{ ...story.chapters[1], publishDate: '2026-10-22', publishedAt: '2026-10-22T18:00:00Z' }] };
    expect(newLibraryChapters(sameDay, '2026-10-22T17:00:00Z', [])).toBe(1);
  });
  it('respects explicit shelves and infers status only for unclassified books', () => {
    const lists = { currently: [], later: ['s'], completed: [] };
    expect(libraryStatus('s', 35, lists)).toBe('later');
    expect(libraryStatus('other', 35, lists)).toBe('currently');
    expect(libraryStatus('other', 100, lists)).toBe('completed');
  });
  it('sorts by addition, French title or author without mutating the source', () => {
    const books = [{ story, addedAt: '2026-01-02' }, { story: { ...story, title: 'Aube', authorName: 'Alice' }, addedAt: '2026-01-01' }];
    expect(sortLibraryBooks(books, 'recent')[0].story.title).toBe('Éveil');
    expect(sortLibraryBooks(books, 'title')[0].story.title).toBe('Aube');
    expect(sortLibraryBooks(books, 'author')[0].story.authorName).toBe('Alice');
    expect(books[0].story.title).toBe('Éveil');
  });
});
