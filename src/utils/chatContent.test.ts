import { describe, expect, it } from 'vitest';
import { CHAT_FILE_LIMIT, CHAT_SHARE_PREFIX, chatSharePreview, encodeChatShare, parseChatShare } from './chatContent';
import { messagePreview } from './inbox';
const photo = { kind: 'photo' as const, url: 'https://res.cloudinary.com/plume/image/upload/v1/photo.jpg', name: 'Photo.jpg', size: 1024 };
describe('safe chat attachments and previews', () => {
  it('round trips valid book, photo and document payloads', () => {
    for (const share of [{ kind: 'book' as const, storyId: 'published', caption: 'À découvrir' }, photo, { ...photo, kind: 'file' as const, url: 'https://res.cloudinary.com/plume/raw/upload/v1/notes.txt', name: 'notes.txt' }]) expect(parseChatShare(encodeChatShare(share))).toEqual(share);
  });
  it('rejects malformed payloads and attachment URLs outside the upload CDN', () => {
    for (const input of ['null', '{}', 'oops', JSON.stringify({ kind: 'book', storyId: '' }), ...['http://res.cloudinary.com/plume/image/upload/a.jpg', 'https://res.cloudinary.com.evil.test/plume/image/upload/a.jpg', 'https://user:pass@res.cloudinary.com/plume/image/upload/a.jpg', 'https://res.cloudinary.com:444/plume/image/upload/a.jpg', 'https://res.cloudinary.com/plume/image/fetch/https://evil.test'].map(url => JSON.stringify({ ...photo, url }))]) expect(parseChatShare(CHAT_SHARE_PREFIX + input)).toBeNull();
  });
  it('enforces file size, supported documents and bounded captions', () => {
    for (const invalid of [{ ...photo, size: 0 }, { ...photo, size: CHAT_FILE_LIMIT + 1 }, { ...photo, size: 1.5 }, { ...photo, name: 'bad\nname' }, { ...photo, caption: 'x'.repeat(1001) }, { ...photo, kind: 'file', name: 'execute.html', url: 'https://res.cloudinary.com/plume/raw/upload/a.html' }]) expect(parseChatShare(CHAT_SHARE_PREFIX + JSON.stringify(invalid))).toBeNull();
  });
  it('keeps spoiler captions and raw payloads out of notifications, search and quotes', () => {
    expect(chatSharePreview(encodeChatShare({ kind: 'book', storyId: 'published', caption: '||La fin secrète||' }))).toBe('📖 Livre partagé');
    expect(messagePreview({ content: encodeChatShare(photo) } as any)).toBe('📷 Photo');
    expect(messagePreview({ content: 'Un passage ||secret|| à lire' } as any)).toBe('Un passage Spoiler à lire');
    expect(chatSharePreview(CHAT_SHARE_PREFIX + '{}')).toBe('Pièce jointe indisponible');
    expect(chatSharePreview('Bonjour')).toBeNull();
  });
});
