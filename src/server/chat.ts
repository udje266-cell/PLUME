import type { Express, RequestHandler } from 'express';
import type { PrismaClient } from '@prisma/client';
import type { Server } from 'socket.io';
import { CHAT_REACTIONS, CHAT_SHARE_PREFIX, parseChatShare } from '../utils/chatContent';

export async function validateChatShare(prisma: PrismaClient, content: string): Promise<string | null> {
  if (!content.startsWith(CHAT_SHARE_PREFIX)) return null;
  const share = parseChatShare(content);
  if (!share) return 'Pièce jointe invalide ou format non pris en charge.';
  if (share.kind === 'book' && !await prisma.story.findFirst({ where: { id: share.storyId, status: 'PUBLIE', isFlagged: false }, select: { id: true } })) return 'Ce livre n’est plus disponible au partage.';
  return null;
}

/** Batched quotes remain visible even when the parent is outside the loaded page. */
export async function hydrateDirectMessages(prisma: PrismaClient, messages: any[]) {
  const ids = [...new Set(messages.flatMap(message => message.replyToId ? [message.replyToId as string] : []))];
  const quoted = ids.length ? await prisma.message.findMany({ where: { id: { in: ids }, conversationId: { in: [...new Set(messages.map(message => message.conversationId))] } }, select: { id: true, conversationId: true, senderId: true, content: true, deletedForEveryone: true } }) : [];
  return messages.map(message => {
    const reactions = new Map<string, string[]>();
    for (const reaction of message.reactions || []) reactions.set(reaction.emoji, [...(reactions.get(reaction.emoji) || []), reaction.userId]);
    return { ...message, reactions: [...reactions].map(([emoji, userIds]) => ({ emoji, count: userIds.length, userIds })), replyTo: quoted.find(parent => parent.id === message.replyToId && parent.conversationId === message.conversationId) || null };
  });
}

export function registerChatRoutes(app: Express, prisma: PrismaClient, requireAuth: RequestHandler, io: Server) {
  app.put('/api/messages/:id/reactions', requireAuth, async (req: any, res) => {
    const { emoji, active } = req.body || {};
    if (!(CHAT_REACTIONS as readonly string[]).includes(emoji) || typeof active !== 'boolean') return res.status(400).json({ error: 'Réaction invalide.' });
    try {
      const message = await prisma.message.findFirst({ where: { id: req.params.id, conversation: { participants: { some: { id: req.user.id } } } }, include: { conversation: { select: { participants: { select: { id: true } } } } } });
      if (!message) return res.status(404).json({ error: 'Message introuvable.' });
      if (message.deletedForEveryone) return res.status(400).json({ error: 'Ce message a été supprimé.' });
      const peers = message.conversation.participants.filter(participant => participant.id !== req.user.id).map(participant => participant.id);
      if (await prisma.blockedUser.findFirst({ where: { OR: [{ blockerId: req.user.id, blockedId: { in: peers } }, { blockedId: req.user.id, blockerId: { in: peers } }] } })) return res.status(403).json({ error: 'Un blocage est actif.' });
      const key = { messageId: message.id, userId: req.user.id, emoji };
      if (active) await prisma.messageReaction.upsert({ where: { messageId_userId_emoji: key }, create: key, update: {} });
      else await prisma.messageReaction.deleteMany({ where: key });
      const fresh = await prisma.message.findUnique({ where: { id: message.id }, include: { reactions: true } });
      if (!fresh) return res.status(404).json({ error: 'Message introuvable.' });
      const [serialized] = await hydrateDirectMessages(prisma, [fresh]);
      message.conversation.participants.forEach(participant => io.to(`user:${participant.id}`).emit('message_updated', serialized));
      res.set('Cache-Control', 'private, no-store').json(serialized);
    } catch (error) {
      console.error('[CHAT] reaction:', error); res.status(500).json({ error: 'La réaction n’a pas pu être enregistrée.' });
    }
  });
}
