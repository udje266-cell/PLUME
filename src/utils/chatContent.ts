export const CHAT_SHARE_PREFIX = '[plume-share]';
export const CHAT_REACTIONS = ['👍', '❤️', '😂', '😮', '😢', '🙏', '💜', '🔥'] as const;
export const CHAT_FILE_LIMIT = 10 * 1024 * 1024;
export const CHAT_DOCUMENT_TYPES = /\.(pdf|epub|txt|docx|odt|rtf|md|csv)$/i;
export type ChatShare = ({ kind: 'book'; storyId: string } | { kind: 'photo' | 'file'; url: string; name: string; size: number }) & { caption?: string };
export function parseChatShare(content: string): ChatShare | null {
  if (!content.startsWith(CHAT_SHARE_PREFIX)) return null;
  try {
    const data = JSON.parse(content.slice(CHAT_SHARE_PREFIX.length));
    if (data.caption !== undefined && (typeof data.caption !== 'string' || data.caption.length > 1000)) return null;
    const caption = data.caption ? { caption: data.caption } : {};
    if (data.kind === 'book' && typeof data.storyId === 'string' && data.storyId.length > 0 && data.storyId.length <= 128) return { kind: 'book', storyId: data.storyId, ...caption };
    if (!['photo', 'file'].includes(data.kind) || typeof data.url !== 'string' || typeof data.name !== 'string' || !data.name.trim() || data.name.length > 180 || /[\u0000-\u001f]/.test(data.name) || !Number.isSafeInteger(data.size) || data.size <= 0 || data.size > CHAT_FILE_LIMIT) return null;
    const url = new URL(data.url);
    if (url.protocol !== 'https:' || url.hostname !== 'res.cloudinary.com' || url.username || url.password || url.port || !new RegExp(`^/[^/]+/${data.kind === 'photo' ? 'image' : 'raw'}/upload/`).test(url.pathname)) return null;
    if (data.kind === 'file' && !CHAT_DOCUMENT_TYPES.test(data.name)) return null;
    return { kind: data.kind, url: url.href, name: data.name.trim(), size: data.size, ...caption };
  } catch { return null; }
}
export const encodeChatShare = (share: ChatShare) => CHAT_SHARE_PREFIX + JSON.stringify(share);
export const chatSharePreview = (content: string): string | null => {
  if (!content.startsWith(CHAT_SHARE_PREFIX)) return null;
  const share = parseChatShare(content);
  return !share ? 'Pièce jointe indisponible' : share.kind === 'book' ? '📖 Livre partagé' : share.kind === 'photo' ? '📷 Photo' : `📎 ${share.name}`;
};
