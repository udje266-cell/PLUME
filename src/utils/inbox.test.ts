import { describe, expect, it } from 'vitest';
import type { Conversation, Message } from '../types';
import { formatInboxDate, isIncomingRequest, lastVisibleMessage, messagePreview, selectInboxConversations } from './inbox';
const message = (id: string, content: string, date = '2026-10-22T10:00:00Z', extra = {}) => ({ id, content, date, createdAt: date, senderId: 'other', ...extra } as Message);
const conversation = (id: string, extra = {}) => ({ id, participants: [{ id: 'me', username: 'Moi' }, { id: 'other', username: 'Éléa' }], messages: [message(id, 'Bonjour')], updatedAt: '2026-10-22T10:00:00Z', unreadCount: 0, ...extra } as Conversation);
describe('personal message inbox', () => {
  it('distinguishes incoming requests from sent, accepted, rejected and malformed requests', () => {
    expect(isIncomingRequest(conversation('in', { requestStatus: 'PENDING', requesterId: 'other' }), 'me')).toBe(true);
    for (const extra of [{ requestStatus: 'PENDING', requesterId: 'me' }, { requestStatus: 'PENDING' }, { requestStatus: 'ACCEPTED', requesterId: 'other' }, { requestStatus: 'REJECTED', requesterId: 'other' }]) expect(isIncomingRequest(conversation('out', extra), 'me')).toBe(false);
  });
  it('keeps personal pins first even after a more recent incoming message', () => {
    const pinned = conversation('pin', { isPinned: true, pinnedAt: '2026-10-20T10:00:00Z' });
    const recent = conversation('new', { messages: [message('new', 'Nouveau', '2026-10-22T12:00:00Z')] });
    expect(selectInboxConversations([recent, pinned, conversation('old')], 'me').map(c => c.id)).toEqual(['pin', 'new', 'old']);
  });
  it('intersects search and unread/request filters without including outgoing requests', () => {
    const incoming = conversation('in', { requestStatus: 'PENDING', requesterId: 'other', unreadCount: 3 });
    const outgoing = conversation('out', { requestStatus: 'PENDING', requesterId: 'me', unreadCount: 1 });
    expect(selectInboxConversations([incoming, outgoing], 'me', { query: 'elea', filter: 'requests' }).map(c => c.id)).toEqual(['in']);
    expect(selectInboxConversations([incoming, conversation('read')], 'me', { filter: 'unread' }).map(c => c.id)).toEqual(['in']);
    expect(selectInboxConversations([incoming], 'me', { query: 'introuvable', filter: 'unread' })).toEqual([]);
  });
  it('never searches content deleted globally, hidden locally or concealed by a spoiler', () => {
    const deleted = conversation('deleted', { messages: [message('deleted', 'secret', undefined, { deletedForEveryone: true })] });
    const hidden = conversation('hidden', { messages: [message('old', 'Visible'), message('hidden', 'secret')] });
    const spoiler = conversation('spoiler', { messages: [message('spoiler', 'Une fin ||secrète||')] });
    expect(selectInboxConversations([deleted, hidden], 'me', { query: 'secret', hidden: new Set(['hidden']) })).toEqual([]);
    expect(selectInboxConversations([spoiler], 'me', { query: 'secrete' })).toEqual([]);
    expect(lastVisibleMessage(hidden, new Set(['hidden']))?.id).toBe('old');
  });
  it('retains empty pinned conversations and incoming requests while omitting unused drafts', () => {
    const empty = (id: string, extra = {}) => conversation(id, { messages: [], ...extra });
    expect(selectInboxConversations([empty('draft'), empty('pin', { isPinned: true }), empty('request', { requestStatus: 'PENDING', requesterId: 'other' }), empty('active')], 'me', { activeId: 'active' }).map(c => c.id).sort()).toEqual(['active', 'pin', 'request']);
  });
  it('presents attachments, deleted messages and group polls without raw payloads', () => {
    expect(messagePreview(message('s', '[sticker]https://example.com/private.png'))).toBe('🪶 Sticker');
    expect(messagePreview(message('p', '[poll]{"q":"Question"}'))).toBe('📊 Sondage');
    expect(messagePreview(message('v', '[🎙️ Note Vocale 0:20]url'))).toBe('🎙️ Note vocale');
    expect(messagePreview(message('d', 'Secret', undefined, { deletedForEveryone: true }))).toBe('Message supprimé');
    expect(messagePreview(message('spoiler', 'Fin ||surprise||.'))).toBe('Fin Spoiler.');
  });
  it('uses local calendar days rather than labeling old messages with today’s time', () => {
    const now = new Date(2026, 0, 1, 12);
    expect(formatInboxDate(new Date(2026, 0, 1, 9, 15).toISOString(), now)).toBe('09:15');
    expect(formatInboxDate(new Date(2025, 11, 31, 23, 59).toISOString(), now)).toBe('Hier');
    expect(formatInboxDate(new Date(2024, 9, 5).toISOString(), now)).toContain('2024');
    expect(formatInboxDate('invalid', now)).toBe('');
  });
});
