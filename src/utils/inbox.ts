import type { Conversation, Message } from '../types';

export type InboxFilter = 'all' | 'unread' | 'requests';
export const normalizeInboxSearch = (value: string) => value.normalize('NFD').replace(/\p{M}/gu, '').toLocaleLowerCase().trim();
export const isIncomingRequest = (conversation: Conversation, userId: string) => conversation.requestStatus === 'PENDING' && !!conversation.requesterId && conversation.requesterId !== userId;
export const lastVisibleMessage = (conversation: Conversation, hidden: ReadonlySet<string>) => [...(conversation.messages || [])].reverse().find(message => !hidden.has(message.id));
export const unreadMessages = (conversation: Pick<Conversation, 'unreadCount'>) => Math.max(0, Math.floor(Number(conversation.unreadCount) || 0));
export const inboxTimestamp = (date?: string | null) => date && Number.isFinite(Date.parse(date)) ? Date.parse(date) : 0;

export function messagePreview(message?: Pick<Message, 'content' | 'deletedForEveryone'>): string {
  if (!message) return 'Commencez la discussion';
  if (message.deletedForEveryone) return 'Message supprimé';
  if (message.content.startsWith('[poll]')) return '📊 Sondage';
  if (message.content.startsWith('[sticker]')) return '🪶 Sticker';
  if (message.content.startsWith('[🎙️ Note Vocale')) return '🎙️ Note vocale';
  return message.content.replace(/\|\|[\s\S]+?\|\|/g, 'Spoiler');
}

/** Pins survive new arrivals; incoming requests are distinct from requests sent. */
export function selectInboxConversations(conversations: Conversation[], userId: string, options: {
  filter?: InboxFilter; query?: string; hidden?: ReadonlySet<string>; activeId?: string;
} = {}) {
  const { filter = 'all', query = '', hidden = new Set<string>(), activeId } = options;
  const search = normalizeInboxSearch(query);
  return conversations.filter(conversation => {
    if (!conversation.messages?.length && !conversation.isPinned && !isIncomingRequest(conversation, userId) && conversation.id !== activeId) return false;
    if (filter === 'requests' && !isIncomingRequest(conversation, userId)) return false;
    if (filter === 'unread' && !unreadMessages(conversation)) return false;
    if (!search) return true;
    const partner = conversation.participants.find(user => user.id !== userId);
    const last = lastVisibleMessage(conversation, hidden);
    return normalizeInboxSearch(partner?.username || 'Compte supprimé').includes(search)
      || (!!last && !last.deletedForEveryone && !last.content.startsWith('[sticker]') && normalizeInboxSearch(messagePreview(last)).includes(search));
  }).sort((a, b) => {
    if (!!a.isPinned !== !!b.isPinned) return a.isPinned ? -1 : 1;
    if (a.isPinned && b.isPinned) return inboxTimestamp(b.pinnedAt) - inboxTimestamp(a.pinnedAt) || a.id.localeCompare(b.id);
    const latest = (conversation: Conversation) => {
      const message = lastVisibleMessage(conversation, hidden);
      return inboxTimestamp(message?.createdAt || message?.date || conversation.updatedAt);
    };
    return latest(b) - latest(a) || a.id.localeCompare(b.id);
  });
}

/** Calendar days in the reader's timezone, including daylight-saving changes. */
export function formatInboxDate(value?: string | null, now = new Date()): string {
  if (!inboxTimestamp(value)) return '';
  const date = new Date(value!);
  const sameDay = (left: Date, right: Date) => left.getFullYear() === right.getFullYear() && left.getMonth() === right.getMonth() && left.getDate() === right.getDate();
  if (sameDay(date, now)) return date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  const yesterday = new Date(now); yesterday.setDate(yesterday.getDate() - 1);
  if (sameDay(date, yesterday)) return 'Hier';
  return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', ...(date.getFullYear() !== now.getFullYear() ? { year: 'numeric' } : {}) });
}
