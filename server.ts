/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import 'dotenv/config';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { prisma } from './src/server/prisma';
import { redis } from './src/server/redis';
import { createAdapter } from '@socket.io/redis-adapter';
import { recommendStories, weightsForDiscovery, explorationRatioForDiscovery } from './src/utils/recommendation';

// La logique de certification (src/utils/achievements) référence localStorage
// pour les dates de déblocage. Côté serveur, seul le COMPTAGE des accomplissements
// nous intéresse : on fournit donc un stub mémoire avant de l'utiliser. Les dates
// de déblocage absentes n'affectent pas le calcul de `shouldCertify`.
if (typeof (globalThis as any).localStorage === 'undefined') {
  const __store = new Map<string, string>();
  (globalThis as any).localStorage = {
    getItem: (k: string) => (__store.has(k) ? __store.get(k)! : null),
    setItem: (k: string, v: string) => { __store.set(k, String(v)); },
    removeItem: (k: string) => { __store.delete(k); },
    clear: () => { __store.clear(); },
  };
}
import { countAndEvaluateCertification, type UserStats } from './src/utils/achievements';
import { levelFromXp } from './src/utils/leveling';
import { sendPushToUser } from './src/server/push';

// Garde-fou : une promesse rejetée non gérée (ex. erreur Prisma dans un handler
// sans try/catch) ne doit jamais faire planter le process en production.
process.on('unhandledRejection', (reason) => {
  console.error('[PLUME] Unhandled promise rejection:', reason);
});
process.on('uncaughtException', (error) => {
  console.error('[PLUME] Uncaught exception:', error);
});

function parseJsonArray(value: string | null | undefined) {
  try {
    return JSON.parse(value || '[]');
  } catch {
    return [];
  }
}

function roleToPrisma(role: string | undefined | null) {
  if (!role) return 'Lecteur';
  const r = role.toUpperCase();
  if (r === 'AUTEUR' || role === 'Auteur') return 'Auteur';
  // Le rôle « Utilisateur Mixte » a été supprimé : tout résidu est rattaché à Auteur.
  if (r === 'UTILISATEUR_MIXTE' || role === 'Utilisateur Mixte') return 'Auteur';
  if (r === 'ADMINISTRATEUR' || role === 'Administrateur') return 'Administrateur';
  return 'Lecteur';
}

function roleFromPrisma(role: string | undefined | null) {
  if (!role) return 'Lecteur';
  const r = role.toUpperCase();
  if (r === 'AUTEUR' || role === 'Auteur') return 'Auteur';
  // Compatibilité ascendante : un ancien compte « Mixte » est présenté comme Auteur.
  if (r === 'UTILISATEUR_MIXTE' || role === 'Utilisateur Mixte') return 'Auteur';
  if (r === 'ADMINISTRATEUR' || role === 'Administrateur') return 'Administrateur';
  return 'Lecteur';
}

function genderToPrisma(gender: string | undefined | null) {
  if (!gender) return null;
  const g = gender.toUpperCase();
  if (g === 'HOMME' || gender === 'Homme') return 'Homme';
  if (g === 'FEMME' || gender === 'Femme') return 'Femme';
  return null;
}

function genderFromPrisma(gender: string | null | undefined) {
  if (!gender) return undefined;
  const g = gender.toUpperCase();
  if (g === 'HOMME' || gender === 'Homme') return 'Homme';
  if (g === 'FEMME' || gender === 'Femme') return 'Femme';
  return undefined;
}

function storyStatusToPrisma(status: string | undefined) {
  return status === 'Publié' ? 'PUBLIE' as any : 'BROUILLON' as any;
}

function storyStatusFromPrisma(status: string | undefined) {
  return status === 'PUBLIE' ? 'Publié' : 'Brouillon';
}

function ageRatingToPrisma(ageRating: string | undefined) {
  if (ageRating === '12') return 'TWELVE' as any;
  if (ageRating === '16') return 'SIXTEEN' as any;
  if (ageRating === '18') return 'EIGHTEEN' as any;
  return 'ALL' as any;
}

function ageRatingFromPrisma(ageRating: string | undefined) {
  if (ageRating === 'TWELVE') return '12';
  if (ageRating === 'SIXTEEN') return '16';
  if (ageRating === 'EIGHTEEN') return '18';
  return 'all';
}

function validatePassword(password: string): boolean {
  if (typeof password !== 'string') return false;
  return password.length >= 8 && /[a-zA-Z]/.test(password) && /\d/.test(password);
}

// includePrivate : n'inclure email/birthDate (données personnelles) que pour
// l'utilisateur lui-même ou un administrateur. Par défaut elles sont masquées
// afin de ne pas fuiter sur les routes publiques (listes, profils d'autrui…).
function serializeUser(user: any, includePrivate = false) {
  if (!user) return user;
  const followers = Array.isArray(user.followers) ? user.followers.map((f: any) => f.followerId || f.id || f) : [];
  const following = Array.isArray(user.following) ? user.following.map((f: any) => f.followingId || f.id || f) : [];
  const blockedUsers = Array.isArray(user.blockedUsers) ? user.blockedUsers.map((b: any) => b.blockedId || b.id || b) : [];
  // flagReason est un motif de modération : on ne l'expose qu'en mode privé
  // (soi-même / administrateur), jamais sur les profils publics.
  const { passwordHash, email, birthDate, flagReason, xpMeta, ...safeUser } = user;
  const result: any = {
    ...safeUser,
    role: roleFromPrisma(user.role),
    gender: genderFromPrisma(user.gender),
    avatar: user.avatar || '',
    bio: user.bio || '',
    favoriteGenres: parseJsonArray(user.favoriteGenres),
    customStickers: parseJsonArray(user.customStickers),
    followers,
    following,
    blockedUsers,
    signUpDate: user.createdAt ? new Date(user.createdAt).toISOString().split('T')[0] : undefined,
  };
  if (includePrivate) {
    result.email = email;
    result.birthDate = birthDate ? new Date(birthDate).toISOString().split('T')[0] : undefined;
    result.flagReason = flagReason ?? null;
  } else if (result.role === 'Administrateur') {
    // Statut administrateur masqué aux tiers : exposé comme « Auteur ». Le rôle
    // réel n'est renvoyé qu'en mode privé (l'admin lui-même / endpoints admin),
    // ce qui préserve l'accès au panneau d'administration.
    result.role = 'Auteur';
  }
  return result;
}

function serializeChapter(chapter: any) {
  if (!chapter) return chapter;
  return {
    ...chapter,
    publishDate: chapter.publishedAt ? new Date(chapter.publishedAt).toISOString().split('T')[0] : undefined,
  };
}

function serializeStory(story: any) {
  if (!story) return story;
  const author = story.author ? serializeUser(story.author) : null;
  return {
    ...story,
    tags: parseJsonArray(story.tags),
    status: storyStatusFromPrisma(story.status),
    ageRating: ageRatingFromPrisma(story.ageRating),
    publishDate: story.publishedAt ? new Date(story.publishedAt).toISOString().split('T')[0] : undefined,
    chapters: Array.isArray(story.chapters) ? story.chapters.map(serializeChapter) : [],
    author,
    authorName: author?.username || story.authorName || '',
    authorAvatar: author?.avatar || story.authorAvatar || '',
    authorVerified: Boolean(author?.isVerified),
    likes: Array.isArray(story.likes) ? story.likes.length : (story.likes ?? 0),
    favoritesCount: Array.isArray(story.favorites) ? story.favorites.length : (story.favoritesCount ?? 0),
  };
}

function serializeComment(comment: any) {
  if (!comment) return comment;
  const user = comment.user ? serializeUser(comment.user) : null;
  return {
    ...comment,
    username: user?.username || comment.username || '',
    avatar: user?.avatar || comment.avatar || '',
    date: comment.createdAt ? new Date(comment.createdAt).toISOString() : undefined,
    replies: Array.isArray(comment.replies)
      ? comment.replies.map((reply: any) => {
          const replyUser = reply.user ? serializeUser(reply.user) : null;
          return {
            ...reply,
            username: replyUser?.username || '',
            avatar: replyUser?.avatar || '',
            date: reply.createdAt ? new Date(reply.createdAt).toISOString() : undefined,
          };
        })
      : [],
  };
}

function serializeReactions(reactions: any[], meId?: string) {
  if (!Array.isArray(reactions) || !reactions.length) return [];
  const byEmoji = new Map<string, { emoji: string; count: number; mine: boolean; userIds: string[] }>();
  for (const r of reactions) {
    const e = byEmoji.get(r.emoji) || { emoji: r.emoji, count: 0, mine: false, userIds: [] };
    e.count += 1;
    e.userIds.push(r.userId);
    if (meId && r.userId === meId) e.mine = true;
    byEmoji.set(r.emoji, e);
  }
  return Array.from(byEmoji.values());
}

function serializeGroupMessage(m: any, meId?: string) {
  if (!m) return m;
  return {
    id: m.id,
    groupId: m.groupId,
    senderId: m.senderId,
    senderName: m.sender?.username || '',
    senderAvatar: m.sender?.avatar || '',
    content: m.content,
    replyToId: m.replyToId || null,
    editedAt: m.editedAt ? new Date(m.editedAt).toISOString() : null,
    deletedForEveryone: !!m.deletedForEveryone,
    deletedByAdmin: !!m.deletedByAdmin,
    pinned: !!m.pinned,
    pinnedAt: m.pinnedAt ? new Date(m.pinnedAt).toISOString() : null,
    isAnnouncement: !!m.isAnnouncement,
    reactions: serializeReactions(m.reactions, meId),
    date: m.createdAt ? new Date(m.createdAt).toISOString() : new Date().toISOString(),
  };
}

// Hierarchie des roles de groupe.
const GROUP_ROLE_RANK: Record<string, number> = { owner: 3, admin: 2, moderator: 1, member: 0 };
function groupRoleRank(role?: string): number { return GROUP_ROLE_RANK[role || 'member'] ?? 0; }

function serializeMembership(gm: any) {
  if (!gm) return gm;
  return {
    userId: gm.userId,
    role: gm.role || 'member',
    status: gm.status || 'active',
    joinedAt: gm.joinedAt ? new Date(gm.joinedAt).toISOString() : undefined,
    username: gm.user?.username || '',
    avatar: gm.user?.avatar || '',
    isVerified: !!gm.user?.isVerified,
  };
}

function serializeGroup(group: any) {
  if (!group) return group;
  const last = Array.isArray(group.messages) && group.messages.length ? group.messages[0] : null;
  const roster = Array.isArray(group.memberships) ? group.memberships.map(serializeMembership) : undefined;
  return {
    id: group.id,
    name: group.name,
    description: group.description || '',
    avatar: group.avatar || undefined,
    storyId: group.storyId || undefined,
    creatorId: group.creatorId,
    members: Array.isArray(group.members) ? group.members.map((m: any) => m.id || m) : [],
    // Parametres.
    visibility: group.visibility || 'private',
    whoCanEditInfo: group.whoCanEditInfo || 'admins',
    messagePermission: group.messagePermission || 'all',
    allowReactions: group.allowReactions !== false,
    allowMedia: group.allowMedia !== false,
    requireApproval: !!group.requireApproval,
    inviteCode: group.inviteCode || undefined,
    inviteEnabled: group.inviteEnabled !== false,
    // Roster (roles/statuts) si charge.
    roster,
    lastMessage: last ? last.content : undefined,
    lastMessageDate: last?.createdAt ? new Date(last.createdAt).toISOString() : undefined,
    createdAt: group.createdAt ? new Date(group.createdAt).toISOString() : undefined,
    updatedAt: group.updatedAt ? new Date(group.updatedAt).toISOString() : undefined,
  };
}

// Message d'erreur OTP volontairement générique : ne révèle ni l'existence du
// code, ni s'il est expiré/incorrect (réduit les oracles de brute-force).
const OTP_GENERIC_ERROR = 'Code OTP invalide ou expiré.';
const OTP_MAX_ATTEMPTS = 5;

// Génère un code OTP à 6 chiffres avec une source cryptographiquement sûre
// (crypto.randomInt), contrairement à Math.random() qui est prévisible.
function generateOtpCode(): string {
  return String(crypto.randomInt(100000, 1000000));
}

// Vérifie un code OTP pour un e-mail. Incrémente un compteur de tentatives et
// invalide le code au-delà de OTP_MAX_ATTEMPTS (anti brute-force par e-mail).
// `consume` supprime le code en cas de succès (usage unique) ; on le met à false
// pour une simple pré-vérification.
async function checkOtp(
  email: string,
  code: string,
  consume: boolean
): Promise<{ ok: boolean; status: number; error: string }> {
  const rec = await prisma.otp.findUnique({ where: { email } });
  if (!rec) return { ok: false, status: 400, error: OTP_GENERIC_ERROR };
  if (rec.expiresAt.getTime() < Date.now()) {
    await prisma.otp.delete({ where: { email } }).catch(() => {});
    return { ok: false, status: 400, error: OTP_GENERIC_ERROR };
  }
  if (rec.code !== code) {
    const attempts = (rec.attempts ?? 0) + 1;
    if (attempts >= OTP_MAX_ATTEMPTS) {
      await prisma.otp.delete({ where: { email } }).catch(() => {});
      return { ok: false, status: 429, error: 'Trop de tentatives. Veuillez demander un nouveau code.' };
    }
    await prisma.otp.update({ where: { email }, data: { attempts } }).catch(() => {});
    return { ok: false, status: 400, error: OTP_GENERIC_ERROR };
  }
  if (consume) await prisma.otp.delete({ where: { email } }).catch(() => {});
  return { ok: true, status: 200, error: '' };
}

// Seuil de signalements distincts à partir duquel un compte est automatiquement
// marqué pour modération (évite qu'un seul utilisateur puisse flaguer autrui).
const REPORT_FLAG_THRESHOLD = 3;

// Vrai s'il existe un blocage dans un sens ou l'autre entre deux utilisateurs.
async function blockExistsBetween(aId: string | undefined, bId: string | undefined): Promise<boolean> {
  if (!aId || !bId || aId === bId) return false;
  const found = await prisma.blockedUser.findFirst({
    where: {
      OR: [
        { blockerId: aId, blockedId: bId },
        { blockerId: bId, blockedId: aId },
      ],
    },
    select: { id: true },
  });
  return Boolean(found);
}

// Détermine si `requesterId` a le droit de commenter une histoire selon le
// réglage « Qui peut commenter » de l'auteur et l'état de blocage. L'auteur peut
// toujours commenter ses propres histoires.
async function ensureCanComment(
  requesterId: string,
  authorId: string | undefined,
  whoCanComment: string | null | undefined
): Promise<{ ok: boolean; error?: string }> {
  if (!authorId || requesterId === authorId) return { ok: true };
  if (await blockExistsBetween(requesterId, authorId)) {
    return { ok: false, error: 'Action impossible : un blocage est actif.' };
  }
  if (whoCanComment === 'none') {
    return { ok: false, error: 'L’auteur a désactivé les commentaires sur cette histoire.' };
  }
  if (whoCanComment === 'followers') {
    const follow = await prisma.follow.findUnique({
      where: { followerId_followingId: { followerId: requesterId, followingId: authorId } },
    }).catch(() => null);
    if (!follow) return { ok: false, error: 'Seuls les abonnés de l’auteur peuvent commenter.' };
  }
  return { ok: true };
}

// Masque les chapitres non publiés d'une histoire pour quiconque n'en est ni
// l'auteur ni administrateur (les brouillons ne doivent pas fuiter).
function filterDraftChapters(story: any, requesterId: string | undefined, isAdmin: boolean) {
  if (!story) return story;
  if (isAdmin || (requesterId && story.authorId === requesterId)) return story;
  return { ...story, chapters: Array.isArray(story.chapters) ? story.chapters.filter((c: any) => c.isPublished) : story.chapters };
}

// Pagination opt-in : sans paramètre `limit`, le comportement reste inchangé
// (liste complète). Avec `?limit=N&page=P`, on renvoie la tranche correspondante.
function parsePagination(req: any): { take?: number; skip?: number } {
  if (req.query.limit === undefined) return {};
  const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit), 10) || 0));
  if (!limit) return {};
  const page = Math.max(1, parseInt(String(req.query.page ?? '1'), 10) || 1);
  return { take: limit, skip: (page - 1) * limit };
}

function countWords(text: string | null | undefined): number {
  if (!text) return 0;
  const t = String(text).trim();
  if (!t) return 0;
  return t.split(/\s+/).length;
}

// Calcule les statistiques d'auteur d'un utilisateur À PARTIR DE LA BASE
// (sources de vérité), pour évaluer la certification sans faire confiance au
// client. Les champs lecteur ne sont pas pertinents pour la certification auteur.
async function computeAuthorStats(userId: string): Promise<UserStats> {
  const stories = await prisma.story.findMany({
    where: { authorId: userId },
    select: { views: true, createdAt: true, _count: { select: { likes: true } } },
  });
  const storiesCreated = stories.length;
  const viewsReceived = stories.reduce((s, st) => s + (st.views || 0), 0);
  const likesReceived = stories.reduce((s, st) => s + (st._count?.likes || 0), 0);

  const chapters = await prisma.chapter.findMany({
    where: { story: { authorId: userId }, isPublished: true },
    select: { content: true, createdAt: true, updatedAt: true },
  });
  const chaptersPublished = chapters.length;
  const wordsWritten = chapters.reduce((s, c) => s + countWords(c.content), 0);

  // activeDays : approximation autoritative = nombre de jours distincts d'activité
  // d'écriture (création d'histoires + publication/mise à jour de chapitres).
  const days = new Set<string>();
  for (const st of stories) days.add(new Date(st.createdAt).toISOString().slice(0, 10));
  for (const c of chapters) {
    days.add(new Date(c.createdAt).toISOString().slice(0, 10));
    days.add(new Date(c.updatedAt).toISOString().slice(0, 10));
  }

  return {
    chaptersRead: 0,
    commentsPosted: 0,
    likesGiven: 0,
    favoritesAdded: 0,
    activeDays: days.size,
    completedReadCycles: 0,
    wordsWritten,
    storiesCreated,
    chaptersPublished,
    viewsReceived,
    likesReceived,
    decorChanges: 0,
    genresReadCount: 0,
    authorsFollowedCount: 0,
  };
}

// Recalcule et persiste isVerified depuis des données autoritatives. Seuls les
// auteurs atteignant le seuil sont certifiés ; tout autre rôle est décertifié.
// `isVerified` n'est donc jamais piloté par le client.
async function recomputeCertification(userId: string): Promise<void> {
  try {
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { role: true, isVerified: true } });
    if (!user) return;
    const role = roleFromPrisma(user.role);
    let shouldBeVerified = false;
    if (role === 'Administrateur') {
      // Le propriétaire/administrateur est certifié d'office (statut plein).
      shouldBeVerified = true;
    } else if (role === 'Auteur') {
      const stats = await computeAuthorStats(userId);
      shouldBeVerified = countAndEvaluateCertification('Auteur', stats, userId).shouldCertify;
    }
    if (user.isVerified !== shouldBeVerified) {
      await prisma.user.update({ where: { id: userId }, data: { isVerified: shouldBeVerified } });
    }
  } catch (error) {
    console.error('[CERT] Échec du recalcul de certification:', error);
  }
}

// ----- Système de niveaux (XP) -----
// Barème validé (deux jauges séparées : lecteur / auteur).
const XP = {
  readChapter: 10, finishBook: 50, likeGiven: 2, commentGiven: 5,
  favoriteGiven: 3, followGiven: 5,
  publishChapter: 30, publishStory: 80,
  likeReceived: 3, favoriteReceived: 5, commentReceived: 4, followerGained: 10,
};

/** Ajoute de l'XP à une jauge (lecteur/auteur). Best-effort, jamais bloquant. */
async function awardXp(userId: string | undefined, pool: 'reader' | 'author', amount: number): Promise<void> {
  if (!userId || amount <= 0) return;
  try {
    const field = pool === 'author' ? 'authorXp' : 'readerXp';
    await prisma.user.update({ where: { id: userId }, data: { [field]: { increment: amount } } });
  } catch { /* l'XP ne doit jamais casser l'action principale */ }
}

/**
 * Ajoute de l'XP avec un PLAFOND JOURNALIER par type d'action (anti-abus).
 * Utilise User.xpMeta = { date: 'YYYY-MM-DD', counters: { [key]: n } }.
 */
async function awardCappedXp(userId: string | undefined, pool: 'reader' | 'author', amount: number, key: string, dailyMax: number): Promise<void> {
  if (!userId || amount <= 0) return;
  try {
    const u = await prisma.user.findUnique({ where: { id: userId }, select: { xpMeta: true } });
    const today = new Date().toISOString().slice(0, 10);
    let meta: any = (u?.xpMeta as any) || {};
    if (meta.date !== today || typeof meta.counters !== 'object') meta = { date: today, counters: {} };
    const used = meta.counters[key] || 0;
    if (used >= dailyMax) return; // plafond atteint pour aujourd'hui
    meta.counters[key] = used + 1;
    await prisma.user.update({ where: { id: userId }, data: { xpMeta: meta } });
    await awardXp(userId, pool, amount);
  } catch { /* best-effort */ }
}

export async function createServerInstance() {
  const app = express();
  // Nécessaire pour obtenir la vraie IP client derrière un proxy (Render, etc.)
  app.set('trust proxy', 1);
  const httpServer = createServer(app);

  // Liste blanche d'origines CORS (séparées par des virgules). En production, on
  // refuse les origines inconnues ; en développement on autorise tout.
  const allowedOrigins = (process.env.CORS_ORIGINS || process.env.APP_URL || '')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);
  // Origines de l'app native (Capacitor) : toujours tolérées pour Socket.io.
  const SOCKET_NATIVE_ORIGINS = ['capacitor://localhost', 'ionic://localhost', 'http://localhost', 'https://localhost'];
  // IMPORTANT : les origines natives (Capacitor/APK) doivent TOUJOURS être
  // autorisées pour Socket.io, sinon l'APK ne peut pas établir la connexion
  // temps réel (messages, notifications, présence) en production — même quand
  // CORS_ORIGINS n'est pas défini. Le web est servi en same-origin (pas de CORS).
  const corsOrigin: any =
    allowedOrigins.length > 0
      ? [...allowedOrigins, ...SOCKET_NATIVE_ORIGINS]
      : process.env.NODE_ENV === 'production'
        ? SOCKET_NATIVE_ORIGINS
        : '*';

  const io = new Server(httpServer, {
    cors: { origin: corsOrigin, methods: ['GET', 'POST', 'PUT', 'DELETE'] },
  });

  // Multi-instances : sans cet adaptateur, une notification temps réel émise par
  // l'instance A n'atteint pas un client connecté à l'instance B. Avec Redis,
  // la diffusion Socket.io est partagée entre toutes les instances.
  if (redis) {
    io.adapter(createAdapter(redis, redis.duplicate()));
    console.log('[SOCKET.IO] Adaptateur Redis actif (diffusion multi-instances).');
  }

  // Notifie un utilisateur en TEMPS RÉEL (socket, app ouverte) ET en PUSH (FCM,
  // app fermée). Best-effort : le push est un no-op si FCM n'est pas configuré.
  const notifyUser = (userId: string, notification: any) => {
    io.to(`user:${userId}`).emit('new_notification', notification);
    const data: Record<string, string> = { type: String(notification?.type || '') };
    const nd = notification?.data || {};
    if (nd.conversationId) data.conversationId = String(nd.conversationId);
    if (nd.storyId) data.storyId = String(nd.storyId);
    if (nd.actorId) data.actorId = String(nd.actorId);
    // Pour les messages : marqueur + expéditeur → la notification native peut
    // proposer « Répondre » et « Marquer comme lu ».
    if (String(notification?.type || '').toUpperCase() === 'MESSAGE') {
      data.category = 'message';
      if (nd.actorId) data.senderId = String(nd.actorId);
      if (nd.actorName) data.senderName = String(nd.actorName);
    }
    sendPushToUser(userId, {
      title: notification?.title || 'PLUME',
      body: notification?.message || '',
      data,
    }).catch(() => {});
  };

  // Diffuse en TEMPS RÉEL les compteurs d'un récit à son auteur (et aux clients)
  // après un like/favori → la stat « Mentions » du profil se met à jour sans
  // rafraîchissement.
  const emitStoryStats = async (storyId: string) => {
    try {
      const story = await prisma.story.findUnique({
        where: { id: storyId },
        select: { authorId: true, _count: { select: { likes: true, favorites: true } } },
      });
      if (!story) return;
      io.emit('story_stats', { storyId, likes: story._count.likes, favoritesCount: story._count.favorites });
    } catch { /* best-effort */ }
  };

  const PORT = Number(process.env.PORT || 3000);
  const JWT_SECRET = process.env.JWT_SECRET || 'plume_secret_dev_change_later';

  // En production, le secret JWT est obligatoire : sans cela n'importe qui
  // pourrait forger des tokens valides avec la valeur par défaut publique.
  if (
    process.env.NODE_ENV === 'production' &&
    (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 16)
  ) {
    throw new Error(
      'JWT_SECRET manquant ou trop court en production (16 caractères minimum requis).'
    );
  }

  // Email configuration (used for sender extraction)
  const smtpFrom = process.env.SMTP_FROM || '"PLUME" <udje266@gmail.com>';

  async function sendOtpEmail(email: string, code: string, reason: 'register' | 'reset') {
    const subject = reason === 'register' 
      ? 'PLUME - Création de votre compte' 
      : 'PLUME - Réinitialisation de votre mot de passe';
    
    const reasonText = reason === 'register'
      ? "Pour finaliser votre inscription sur la plateforme littéraire PLUME, veuillez utiliser le code de validation à 6 chiffres ci-dessous :"
      : "Nous avons reçu une demande de réinitialisation de votre mot de passe PLUME. Veuillez utiliser le code de validation à 6 chiffres ci-dessous pour continuer :";

    const htmlContent = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eaeaea; border-radius: 8px;">
          <h2 style="color: #7c3aed; text-align: center;">PLUME</h2>
          <p>Bonjour,</p>
          <p>${reasonText}</p>
          <div style="text-align: center; margin: 30px 0;">
            <span style="font-size: 24px; font-weight: bold; letter-spacing: 4px; padding: 10px 20px; background-color: #f3f4f6; border-radius: 4px; border: 1px dashed #7c3aed; color: #111827;">
              ${code}
            </span>
          </div>
          <p style="font-size: 12px; color: #6b7280; text-align: center; margin-top: 40px;">
            Ce code est valide pendant 10 minutes. Si vous n'êtes pas à l'origine de cette demande, vous pouvez ignorer cet e-mail en toute sécurité.
          </p>
        </div>
    `;

    const brevoApiKey = process.env.BREVO_API_KEY || '';

    if (!brevoApiKey) {
      console.warn(`[PLUME EMAIL] Configuration BREVO_API_KEY manquante. OTP pour ${email} : ${code} (Simulation)`);
      return true;
    }

    let senderName = "PLUME";
    let senderEmail = "udje266@gmail.com";
    const match = smtpFrom.match(/^(?:"?([^"]*)"?\s)?<?([^>]+)>?$/);
    if (match) {
      senderName = match[1]?.trim() || "PLUME";
      senderEmail = match[2]?.trim();
    }

    try {
      const response = await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: {
          'accept': 'application/json',
          'api-key': brevoApiKey,
          'content-type': 'application/json'
        },
        body: JSON.stringify({
          sender: {
            name: senderName,
            email: senderEmail
          },
          to: [
            {
              email: email
            }
          ],
          subject: subject,
          htmlContent: htmlContent
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Erreur HTTP ${response.status} : ${errorText}`);
      }

      console.log(`[PLUME EMAIL] OTP envoyé avec succès à ${email}`);
      return true;
    } catch (error: any) {
      console.error("[PLUME EMAIL] Erreur Brevo lors de l'envoi d'e-mail :", error?.message || error);
      console.warn(`[PLUME EMAIL] Échec envoi, OTP pour ${email} : ${code}`);
      return process.env.NODE_ENV !== 'production';
    }
  }

  app.use(express.json({ limit: '10mb' }));

  // ── CORS HTTP (en plus de la config Socket.io) ─────────────────────────────
  // Indispensable pour le build natif (Capacitor) : l'app y tourne sur une
  // origine locale (capacitor://localhost, https://localhost) et appelle le
  // backend en cross-origin. On autorise ces origines + la whitelist configurée,
  // avec les credentials (cookie/Authorization).
  const NATIVE_ORIGINS = ['capacitor://localhost', 'ionic://localhost', 'http://localhost', 'https://localhost'];
  const httpAllowedOrigins = new Set([...allowedOrigins, ...NATIVE_ORIGINS]);
  app.use((req, res, next) => {
    const origin = req.headers.origin as string | undefined;
    const allow =
      origin &&
      (httpAllowedOrigins.has(origin) || process.env.NODE_ENV !== 'production');
    if (allow && origin) {
      res.header('Access-Control-Allow-Origin', origin);
      res.header('Vary', 'Origin');
      res.header('Access-Control-Allow-Credentials', 'true');
      res.header('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
      res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    }
    if (req.method === 'OPTIONS') return res.sendStatus(204);
    next();
  });

  // ── En-têtes de sécurité (durcissement, sans dépendance type helmet) ────────
  // Protège contre le MIME-sniffing, le clickjacking et les fuites de referrer.
  // Pas de CSP stricte ici (risquerait de casser l'app/Cloudinary) ; HSTS en prod.
  app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('X-DNS-Prefetch-Control', 'off');
    res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(self), camera=()');
    if (process.env.NODE_ENV === 'production') {
      res.setHeader('Strict-Transport-Security', 'max-age=15552000; includeSubDomains');
    }
    next();
  });

  // ── Rate limiting simple en mémoire (par IP) ───────────────────────────────
  // Protège les routes sensibles (login, OTP, reset) contre le brute-force et le
  // spam. Note : en mémoire uniquement — pour du multi-instance, utiliser Redis.
  // Compteur d'instanciation : donne à chaque limiteur un espace de clés Redis
  // distinct et STABLE (les limiteurs sont créés dans le même ordre au démarrage
  // de chaque instance), pour que le comptage soit partagé et cohérent.
  let rateLimiterSeq = 0;
  function createRateLimiter(opts: { windowMs: number; max: number; message?: string }) {
    const namespace = `rl:${rateLimiterSeq++}`;
    const hits = new Map<string, { count: number; resetAt: number }>();
    const cleanup = setInterval(() => {
      const now = Date.now();
      for (const [key, value] of hits) {
        if (value.resetAt <= now) hits.delete(key);
      }
    }, opts.windowMs);
    if (typeof cleanup.unref === 'function') cleanup.unref();

    const tooMany = (res: any, retryAfterSec: number) => {
      res.setHeader('Retry-After', String(Math.max(1, retryAfterSec)));
      return res.status(429).json({
        error: opts.message || 'Trop de requêtes, veuillez réessayer plus tard.',
      });
    };

    return async (req: any, res: any, next: any) => {
      // Désactivé en test pour ne pas rendre les tests flaky.
      if (process.env.NODE_ENV === 'test') return next();
      const ip = req.ip || req.connection?.remoteAddress || 'unknown';

      // Chemin Redis (multi-instances) : compteur partagé via INCR + expiration.
      if (redis) {
        try {
          const key = `${namespace}:${ip}`;
          const count = await redis.incr(key);
          if (count === 1) await redis.pexpire(key, opts.windowMs);
          if (count > opts.max) {
            const ttl = await redis.pttl(key);
            return tooMany(res, Math.ceil((ttl > 0 ? ttl : opts.windowMs) / 1000));
          }
          return next();
        } catch (e) {
          // Redis indisponible : on retombe sur le compteur mémoire ci-dessous.
        }
      }

      // Repli en mémoire (mono-instance / Redis absent).
      const now = Date.now();
      const entry = hits.get(ip);
      if (!entry || entry.resetAt <= now) {
        hits.set(ip, { count: 1, resetAt: now + opts.windowMs });
        return next();
      }
      entry.count += 1;
      if (entry.count > opts.max) {
        return tooMany(res, Math.ceil((entry.resetAt - now) / 1000));
      }
      return next();
    };
  }

  const authLimiter = createRateLimiter({
    windowMs: 15 * 60 * 1000,
    max: 10,
    message: 'Trop de tentatives. Réessayez dans quelques minutes.',
  });
  const otpLimiter = createRateLimiter({
    windowMs: 15 * 60 * 1000,
    max: 5,
    message: "Trop de demandes de code. Réessayez dans quelques minutes.",
  });
  // Télémétrie d'erreurs : on borne le débit pour éviter le spam de logs.
  const clientErrorLimiter = createRateLimiter({
    windowMs: 60 * 1000,
    max: 20,
    message: 'Trop de rapports d’erreur.',
  });
  // Recherche publique : borne le debit pour eviter l'enumeration / le spam.
  const searchLimiter = createRateLimiter({
    windowMs: 60 * 1000,
    max: 40,
    message: 'Trop de recherches. Patiente quelques secondes.',
  });

  function createToken(userId: string) {
    return jwt.sign({ userId }, JWT_SECRET, { expiresIn: '30d' });
  }

  const AUTH_COOKIE = 'plume_token';
  const AUTH_COOKIE_MAX_AGE = 30 * 24 * 60 * 60 * 1000; // 30 jours

  // Pose le JWT dans un cookie httpOnly : inaccessible au JavaScript (donc non
  // volable via XSS), contrairement à un stockage localStorage.
  function setAuthCookie(res: any, token: string) {
    res.cookie(AUTH_COOKIE, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: AUTH_COOKIE_MAX_AGE,
      path: '/',
    });
  }

  function clearAuthCookie(res: any) {
    res.clearCookie(AUTH_COOKIE, { path: '/' });
  }

  // Lit le token depuis l'en-tête Authorization (clients cross-origin / mobile)
  // ou, à défaut, depuis le cookie httpOnly (application web same-origin).
  function getTokenFromRequest(req: any): string | null {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const headerToken = authHeader.slice('Bearer '.length).trim();
      if (headerToken) return headerToken;
    }
    const cookieHeader = req.headers.cookie;
    if (cookieHeader) {
      const found = cookieHeader
        .split(';')
        .map((c: string) => c.trim())
        .find((c: string) => c.startsWith(`${AUTH_COOKIE}=`));
      if (found) return decodeURIComponent(found.slice(AUTH_COOKIE.length + 1));
    }
    return null;
  }

  async function requireAuth(req: any, res: any, next: any) {
    try {
      const token = getTokenFromRequest(req);
      if (!token) {
        return res.status(401).json({ error: 'Non connecté' });
      }
      const decoded = jwt.verify(token, JWT_SECRET) as { userId: string };
      const user = await prisma.user.findUnique({ where: { id: decoded.userId } });
      if (!user) return res.status(401).json({ error: 'Utilisateur introuvable' });
      req.user = user;
      next();
    } catch (err: any) {
      console.warn(`[AUTH] Echec authentification :`, err.message || err);
      return res.status(401).json({ error: 'Session invalide' });
    }
  }


  async function getUserFromAuthorizationHeader(req: any) {
    const token = getTokenFromRequest(req);
    if (!token) return null;
    try {
      const decoded = jwt.verify(token, JWT_SECRET) as { userId: string };
      return await prisma.user.findUnique({ where: { id: decoded.userId } });
    } catch {
      return null;
    }
  }

  // Authentification de la connexion WebSocket via le JWT (handshake).
  // Empêche un client anonyme d'écouter les notifications/messages d'autrui.
  io.use((socket, next) => {
    // Token via handshake.auth (clients mobiles) ou via le cookie httpOnly
    // envoyé automatiquement par le navigateur en same-origin.
    const token =
      (socket.handshake.auth && (socket.handshake.auth as any).token) ||
      (socket.handshake.query && (socket.handshake.query as any).token) ||
      getTokenFromRequest(socket.request as any);
    if (!token) return next(new Error('Authentification requise'));
    try {
      const decoded = jwt.verify(String(token), JWT_SECRET) as { userId: string };
      (socket.data as any).userId = decoded.userId;
      return next();
    } catch {
      return next(new Error('Session invalide'));
    }
  });

  // Présence en ligne (style WhatsApp). Map userId → nombre de connexions
  // actives (un même utilisateur peut avoir plusieurs onglets/appareils).
  // Mono-instance : suffisant pour le déploiement actuel.
  const onlineUsers = new Map<string, number>();

  // Liste des membres d'un groupe (cache court) — utilisée par les relais
  // socket (saisie/appels de groupe). SÉCURITÉ : on ne fait JAMAIS confiance aux
  // memberIds fournis par le client (sinon un utilisateur pourrait envoyer de
  // fausses notifications « écrit… » ou de faux appels à n'importe qui). On
  // dérive toujours les membres de la base.
  const groupMembersCache = new Map<string, { ids: string[]; exp: number }>();
  const getGroupMemberIds = async (groupId: string): Promise<string[]> => {
    const now = Date.now();
    const cached = groupMembersCache.get(groupId);
    if (cached && cached.exp > now) return cached.ids;
    const g = await prisma.readingGroup
      .findUnique({ where: { id: groupId }, select: { members: { select: { id: true } } } })
      .catch(() => null);
    const ids = g ? g.members.map((m) => m.id) : [];
    groupMembersCache.set(groupId, { ids, exp: now + 30_000 });
    return ids;
  };
  const markOnline = (userId: string) => {
    const n = (onlineUsers.get(userId) || 0) + 1;
    onlineUsers.set(userId, n);
    if (n === 1) io.emit('presence_update', { userId, online: true });
  };
  const markOffline = (userId: string) => {
    const n = (onlineUsers.get(userId) || 0) - 1;
    if (n <= 0) {
      onlineUsers.delete(userId);
      io.emit('presence_update', { userId, online: false });
    } else {
      onlineUsers.set(userId, n);
    }
  };

  // Appels de GROUPE (maillage WebRTC) : participants actifs par groupe.
  const groupCallParticipants = new Map<string, Set<string>>();
  const leaveGroupCall = (groupId: string, userId: string) => {
    const set = groupCallParticipants.get(groupId);
    if (!set || !set.has(userId)) return;
    set.delete(userId);
    set.forEach((id) => io.to(`user:${id}`).emit('group_call:participant_left', { groupId, userId }));
    if (set.size === 0) groupCallParticipants.delete(groupId);
  };

  io.on('connection', (socket) => {
    const authUserId = (socket.data as any).userId as string | undefined;
    console.log(`[SOCKET] utilisateur connecté - socketId: ${socket.id}`);

    // On ignore l'identifiant fourni par le client : un utilisateur ne peut
    // rejoindre que SA propre room, déduite du token vérifié.
    socket.on('join', () => {
      if (!authUserId) return;
      socket.join(`user:${authUserId}`);
      console.log(`[SOCKET] room join - userId: ${authUserId}, socketId: ${socket.id}`);
      socket.emit('joined', { userId: authUserId });
      // Présence : marque en ligne + envoie la liste actuelle au nouvel arrivant.
      markOnline(authUserId);
      socket.emit('presence_list', Array.from(onlineUsers.keys()));

      // Rattrapage « remis » : à la connexion, on marque distribués les messages
      // reçus en attente et on prévient leurs expéditeurs (2 plumes blanches).
      (async () => {
        try {
          const convs = await prisma.conversation.findMany({ where: { participants: { some: { id: authUserId } } }, select: { id: true } });
          const ids = convs.map((c) => c.id);
          if (!ids.length) return;
          const pending = await prisma.message.findMany({ where: { conversationId: { in: ids }, senderId: { not: authUserId }, isDelivered: false }, select: { id: true, senderId: true } });
          if (!pending.length) return;
          await prisma.message.updateMany({ where: { id: { in: pending.map((m) => m.id) } }, data: { isDelivered: true } });
          const bySender = new Map<string, string[]>();
          for (const m of pending) { const a = bySender.get(m.senderId) || []; a.push(m.id); bySender.set(m.senderId, a); }
          for (const [sid, mids] of bySender) io.to(`user:${sid}`).emit('message_delivered', { messageIds: mids });
        } catch { /* best-effort */ }
      })();
    });

    // Accusé de distribution en direct : le destinataire confirme la réception
    // d'un message ; on le marque « remis » et on prévient l'expéditeur.
    socket.on('message_ack', async (p: { messageId: string }) => {
      if (!authUserId || !p?.messageId) return;
      try {
        // On ne fait confiance qu'au token : le message doit exister, l'accusé
        // doit venir d'un PARTICIPANT (autre que l'expediteur), et on notifie le
        // VRAI expediteur (jamais un senderId fourni par le client).
        const msg = await prisma.message.findUnique({
          where: { id: p.messageId },
          include: { conversation: { include: { participants: { select: { id: true } } } } },
        });
        if (!msg || msg.senderId === authUserId) return;
        if (!msg.conversation.participants.some((pp) => pp.id === authUserId)) return;
        await prisma.message.update({ where: { id: p.messageId }, data: { isDelivered: true } }).catch(() => {});
        socket.to(`user:${msg.senderId}`).emit('message_delivered', { messageIds: [p.messageId] });
      } catch { /* ignore */ }
    });

    // L'expediteur d'un « ecrit… » est TOUJOURS l'utilisateur du token (anti-usurpation).
    socket.on('typing', (payload: { receiverId: string; kind?: string }) => {
      if (authUserId && payload?.receiverId) {
        socket.to(`user:${payload.receiverId}`).emit('typing', { senderId: authUserId, receiverId: payload.receiverId, kind: payload.kind });
      }
    });

    socket.on('stop_typing', (payload: { receiverId: string; kind?: string }) => {
      if (authUserId && payload?.receiverId) {
        socket.to(`user:${payload.receiverId}`).emit('stop_typing', { senderId: authUserId, receiverId: payload.receiverId, kind: payload.kind });
      }
    });

    // Saisie dans un GROUPE : relayée aux VRAIS membres (issus de la base), et
    // seulement si l'expéditeur est lui-même membre. On ignore les memberIds du
    // client (anti-usurpation / anti-spam de fausses notifications).
    socket.on('group_typing', async (p: { groupId: string; senderName?: string; kind?: string }) => {
      if (!authUserId || !p?.groupId) return;
      const members = await getGroupMemberIds(p.groupId);
      if (!members.includes(authUserId)) return;
      members.filter((id) => id !== authUserId).forEach((id) =>
        socket.to(`user:${id}`).emit('group_typing', { groupId: p.groupId, senderId: authUserId, senderName: p.senderName, kind: p.kind }));
    });
    socket.on('group_stop_typing', async (p: { groupId: string; kind?: string }) => {
      if (!authUserId || !p?.groupId) return;
      const members = await getGroupMemberIds(p.groupId);
      if (!members.includes(authUserId)) return;
      members.filter((id) => id !== authUserId).forEach((id) =>
        socket.to(`user:${id}`).emit('group_stop_typing', { groupId: p.groupId, senderId: authUserId, kind: p.kind }));
    });

    // ----- Signalisation WebRTC (appels audio) -----
    // Le serveur ne fait que RELAYER les messages de signalisation entre les
    // deux pairs (offre/réponse SDP + candidats ICE). Le flux audio lui-même
    // est pair-à-pair (P2P) et ne transite jamais par le serveur. L'identité de
    // l'appelant est déduite du token vérifié (authUserId), jamais du client.
    // Push d'appel entrant : si le destinataire n'est PAS connecté (donc HORS
    // de l'appli), on l'alerte via FCM pour qu'il sache qu'on l'appelle. S'il
    // est en ligne, l'overlay temps réel (socket) suffit → pas de doublon.
    const pushIncomingCall = async (toUserId: string, groupId?: string) => {
      try {
        if (!authUserId || !toUserId) return;
        if (onlineUsers.has(toUserId)) return;
        const caller = await prisma.user.findUnique({ where: { id: authUserId }, select: { username: true } });
        const callerName = caller?.username || 'Quelqu’un';
        let groupName: string | undefined;
        if (groupId) {
          const g = await prisma.readingGroup.findUnique({ where: { id: groupId }, select: { name: true } }).catch(() => null);
          groupName = g?.name || undefined;
        }
        await sendPushToUser(toUserId, {
          title: groupId ? `Appel de groupe${groupName ? ' • ' + groupName : ''}` : 'Appel entrant',
          body: groupId ? `${callerName} démarre un appel audio` : `${callerName} vous appelle`,
          data: {
            category: 'call',
            callerId: authUserId,
            callerName,
            ...(groupId ? { groupId } : {}),
          },
        });
      } catch { /* best-effort */ }
    };

    socket.on('call:offer', (p: { to: string; sdp: any; caller?: any }) => {
      if (!authUserId || !p?.to) return;
      socket.to(`user:${p.to}`).emit('call:incoming', { from: authUserId, caller: p.caller, sdp: p.sdp });
      pushIncomingCall(p.to).catch(() => {});
    });
    socket.on('call:answer', (p: { to: string; sdp: any }) => {
      if (!authUserId || !p?.to) return;
      socket.to(`user:${p.to}`).emit('call:answered', { from: authUserId, sdp: p.sdp });
    });
    socket.on('call:ice', (p: { to: string; candidate: any }) => {
      if (!authUserId || !p?.to) return;
      socket.to(`user:${p.to}`).emit('call:ice', { from: authUserId, candidate: p.candidate });
    });
    socket.on('call:reject', (p: { to: string }) => {
      if (!authUserId || !p?.to) return;
      socket.to(`user:${p.to}`).emit('call:rejected', { from: authUserId });
    });
    socket.on('call:end', (p: { to: string }) => {
      if (!authUserId || !p?.to) return;
      socket.to(`user:${p.to}`).emit('call:ended', { from: authUserId });
    });

    // ----- Appels de GROUPE (maillage WebRTC, audio) -----
    // SÉCURITÉ : seuls les MEMBRES du groupe (vérifiés en base) peuvent rejoindre
    // et déclencher des invitations ; la liste invitée est dérivée de la base,
    // jamais des memberIds du client (anti-faux appels).
    socket.on('group_call:join', async (p: { groupId: string }) => {
      if (!authUserId || !p?.groupId) return;
      const members = await getGroupMemberIds(p.groupId);
      if (!members.includes(authUserId)) return;
      let set = groupCallParticipants.get(p.groupId);
      if (!set) { set = new Set(); groupCallParticipants.set(p.groupId, set); }
      // Liste des participants DÉJÀ en appel envoyée à l'arrivant (il créera les
      // connexions vers eux). Puis on l'ajoute et on prévient les autres.
      socket.emit('group_call:participants', { groupId: p.groupId, userIds: Array.from(set) });
      set.add(authUserId);
      set.forEach((id) => { if (id !== authUserId) io.to(`user:${id}`).emit('group_call:participant_joined', { groupId: p.groupId, userId: authUserId }); });
      // Sonnerie : invite les MEMBRES (issus de la base) qui ne sont pas déjà en appel.
      members.filter((id) => id !== authUserId && !set!.has(id)).forEach((id) => {
        io.to(`user:${id}`).emit('group_call:invite', { groupId: p.groupId, from: authUserId });
        pushIncomingCall(id, p.groupId).catch(() => {});
      });
    });
    socket.on('group_call:leave', (p: { groupId: string }) => {
      if (!authUserId || !p?.groupId) return;
      leaveGroupCall(p.groupId, authUserId);
    });
    socket.on('group_call:offer', (p: { groupId: string; to: string; sdp: any }) => {
      if (!authUserId || !p?.to) return;
      socket.to(`user:${p.to}`).emit('group_call:offer', { groupId: p.groupId, from: authUserId, sdp: p.sdp });
    });
    socket.on('group_call:answer', (p: { groupId: string; to: string; sdp: any }) => {
      if (!authUserId || !p?.to) return;
      socket.to(`user:${p.to}`).emit('group_call:answer', { groupId: p.groupId, from: authUserId, sdp: p.sdp });
    });
    socket.on('group_call:ice', (p: { groupId: string; to: string; candidate: any }) => {
      if (!authUserId || !p?.to) return;
      socket.to(`user:${p.to}`).emit('group_call:ice', { groupId: p.groupId, from: authUserId, candidate: p.candidate });
    });

    socket.on('disconnect', () => {
      console.log(`[SOCKET] utilisateur déconnecté - socketId: ${socket.id}`);
      if (authUserId) {
        markOffline(authUserId);
        // Retire l'utilisateur de tous les appels de groupe en cours.
        Array.from(groupCallParticipants.keys()).forEach((gid) => leaveGroupCall(gid, authUserId));
      }
    });
  });

  // ----- Notifications push (FCM) : enregistrement des appareils -----
  app.post('/api/devices/register', requireAuth, async (req: any, res) => {
    try {
      const token = String(req.body?.token || '').trim();
      const platform = String(req.body?.platform || 'android').slice(0, 20);
      if (!token) return res.status(400).json({ error: 'token requis' });
      // Un jeton est unique : on le (ré)affecte à l'utilisateur courant.
      await prisma.deviceToken.upsert({
        where: { token },
        update: { userId: req.user.id, platform },
        create: { token, platform, userId: req.user.id },
      });
      res.status(201).json({ success: true });
    } catch (error) {
      console.error('[PUSH] register:', error);
      res.status(500).json({ error: 'Erreur lors de l’enregistrement de l’appareil.' });
    }
  });

  // Clé publique VAPID pour l'abonnement Web Push (PWA). Publique par nature ;
  // renvoie null si le Web Push n'est pas configuré (le client n'insiste pas).
  app.get('/api/push/vapid', (_req, res) => {
    res.json({ key: process.env.VAPID_PUBLIC_KEY || null });
  });

  app.post('/api/devices/unregister', requireAuth, async (req: any, res) => {
    try {
      const token = String(req.body?.token || '').trim();
      if (token) await prisma.deviceToken.deleteMany({ where: { token, userId: req.user.id } });
      res.json({ success: true });
    } catch (error) {
      console.error('[PUSH] unregister:', error);
      res.status(500).json({ error: 'Erreur.' });
    }
  });

  // Health
  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', message: 'Le serveur backend de PLUME fonctionne.', time: new Date().toISOString() });
  });

  app.get('/api/info', (_req, res) => {
    res.json({ appName: 'PLUME Platform', version: '1.0.0' });
  });

  // Auth
  app.post('/api/auth/otp/request', otpLimiter, async (req, res) => {
    try {
      const { email, reason } = req.body;
      if (!email || !reason) {
        return res.status(400).json({ error: 'Email et raison requis' });
      }

      const normalizedEmail = email.trim().toLowerCase();

      if (reason === 'register') {
        const existingUser = await prisma.user.findFirst({ where: { email: normalizedEmail } });
        if (existingUser) {
          return res.status(400).json({ error: 'Cet e-mail est déjà associé à un compte Plume.' });
        }
      } else if (reason === 'reset') {
        const existingUser = await prisma.user.findFirst({ where: { email: normalizedEmail } });
        if (!existingUser) {
          // Anti-énumération : on renvoie la même réponse que si le compte
          // existait, sans générer ni envoyer de code.
          return res.json({ message: 'Si un compte existe, un code de validation a été envoyé.', email });
        }
      } else {
        return res.status(400).json({ error: 'Raison invalide.' });
      }

      console.log(`[OTP] Génération OTP pour ${normalizedEmail}`);
      const code = generateOtpCode();
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

      // Delete existing OTP for this email and expired OTPs globally
      await prisma.otp.deleteMany({
        where: {
          OR: [
            { email: normalizedEmail },
            { expiresAt: { lt: new Date() } }
          ]
        }
      });

      // Save OTP code BEFORE calling sendOtpEmail()
      await prisma.otp.create({
        data: {
          email: normalizedEmail,
          code,
          expiresAt,
        },
      });
      console.log(`[OTP] Sauvegarde OTP réussie pour ${normalizedEmail}`);

      const sent = await sendOtpEmail(email, code, reason);
      if (!sent) {
        return res.status(500).json({ error: "Échec de l'envoi de l'e-mail de validation." });
      }

      res.json({ message: 'Code OTP envoyé avec succès.', email });
    } catch (error) {
      console.error('[PLUME OTP] Request error:', error);
      res.status(500).json({ error: "Erreur lors de la demande d'OTP." });
    }
  });

  app.post('/api/auth/register', authLimiter, async (req, res) => {
    try {
      const { username, email, password, role, gender, birthDate, avatar, bio, favoriteGenres, code } = req.body;
      if (!username || !email || !password || !code) return res.status(400).json({ error: 'username, email, password et code OTP sont requis' });

      if (!validatePassword(password)) {
        return res.status(400).json({ error: 'Le mot de passe doit contenir au moins 8 caractères, dont une lettre et un chiffre.' });
      }

      // Âge minimum (13 ans) : garde-fou requis vu les classifications de contenu.
      if (!birthDate) {
        return res.status(400).json({ error: 'La date de naissance est requise.' });
      }
      const birth = new Date(birthDate);
      if (isNaN(birth.getTime()) || birth >= new Date()) {
        return res.status(400).json({ error: 'Date de naissance invalide.' });
      }
      const ageMs = Date.now() - birth.getTime();
      const ageYears = ageMs / (365.25 * 24 * 60 * 60 * 1000);
      if (ageYears < 13) {
        return res.status(400).json({ error: 'Vous devez avoir au moins 13 ans pour créer un compte.' });
      }

      const normalizedEmail = email.trim().toLowerCase();

      const existingUser = await prisma.user.findFirst({
        where: {
          OR: [
            { email: normalizedEmail },
            { username: { equals: username, mode: 'insensitive' } }
          ]
        }
      });
      if (existingUser) {
        return res.status(400).json({ error: 'Cet utilisateur existe déjà' });
      }

      // Vérifie ET consomme le code (usage unique) avec compteur de tentatives.
      const otpCheck = await checkOtp(normalizedEmail, code, true);
      if (!otpCheck.ok) {
        console.log(`[OTP] Vérification échouée pour ${normalizedEmail}`);
        return res.status(otpCheck.status).json({ error: otpCheck.error });
      }
      console.log(`[OTP] Vérification réussie pour ${normalizedEmail}`);

      const passwordHash = await bcrypt.hash(password, 12);
      const finalRole = roleToPrisma(role);
      const finalGender = genderToPrisma(gender);

      console.log('[REGISTRATION] Tentative de création utilisateur avec les données normalisées :', {
        username,
        email: normalizedEmail,
        role: finalRole,
        gender: finalGender,
      });

      const user = await prisma.user.create({
        data: {
          username,
          email: normalizedEmail,
          passwordHash,
          role: finalRole,
          gender: finalGender,
          birthDate: birthDate ? new Date(birthDate) : null,
          avatar: avatar || null,
          bio: bio || '',
          favoriteGenres: JSON.stringify(favoriteGenres || []),
        },
        include: { followers: true, following: true, blockedUsers: true },
      });
      console.log(`[AUTH] utilisateur authentifié - userId: ${user.id}, username: ${user.username} (inscription)`);
      const token = createToken(user.id);
      setAuthCookie(res, token);
      res.status(201).json({ token, user: serializeUser(user, true) });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Erreur lors de l'inscription" });
    }
  });

  app.post('/api/auth/login', authLimiter, async (req, res) => {
    try {
      const { email, password } = req.body;
      if (!email || !password || typeof email !== 'string' || typeof password !== 'string') {
        return res.status(400).json({ error: 'email et password sont requis' });
      }
      // L'email est normalisé (trim + minuscules) à l'inscription : on aligne ici
      // (un espace résiduel ne doit pas faire échouer une connexion valide).
      const user = await prisma.user.findUnique({
        where: { email: email.trim().toLowerCase() },
        include: { followers: true, following: true, blockedUsers: true },
      });
      if (!user || !user.passwordHash) return res.status(401).json({ error: 'Identifiants incorrects' });
      const valid = await bcrypt.compare(password, user.passwordHash);
      if (!valid) return res.status(401).json({ error: 'Identifiants incorrects' });
      // Compte suspendu par un administrateur : connexion refusée.
      if (user.isBanned) return res.status(403).json({ error: 'Votre compte a été suspendu par un administrateur.' });
      const token = createToken(user.id);
      setAuthCookie(res, token);
      res.json({ token, user: serializeUser(user, true) });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Erreur lors de la connexion' });
    }
  });

  app.post('/api/auth/demo-login', authLimiter, async (req, res) => {
    try {
      // Cette route délivre un token sans mot de passe : réservée au
      // développement/démo, jamais exposée en production (account takeover).
      if (process.env.NODE_ENV === 'production') {
        return res.status(404).json({ error: 'Route introuvable.' });
      }
      const { email, username, role, avatar, bio, birthDate, gender, favoriteGenres } = req.body;
      if (!email || !username) {
        return res.status(400).json({ error: 'Email et nom d’utilisateur requis' });
      }

      const normalizedEmail = email.toLowerCase();
      let user = await prisma.user.findUnique({
        where: { email: normalizedEmail },
        include: { followers: true, following: true, blockedUsers: true },
      });

      if (!user) {
        user = await prisma.user.create({
          data: {
            username,
            email: normalizedEmail,
            passwordHash: await bcrypt.hash('Plume12345', 12),
            role: roleToPrisma(role),
            gender: genderToPrisma(gender),
            birthDate: birthDate ? new Date(birthDate) : null,
            avatar: avatar || null,
            bio: bio || '',
            favoriteGenres: JSON.stringify(favoriteGenres || []),
          },
          include: { followers: true, following: true, blockedUsers: true },
        });
      }

      console.log(`[AUTH DEMO] utilisateur connecté - userId: ${user.id}, username: ${user.username}`);
      const token = createToken(user.id);
      setAuthCookie(res, token);
      res.json({ token, user: serializeUser(user, true) });
    } catch (error) {
      console.error('[AUTH DEMO] Erreur lors du demo-login:', error);
      res.status(500).json({ error: 'Erreur serveur lors de la connexion démo.' });
    }
  });

  app.post('/api/auth/reset-password', authLimiter, async (req, res) => {
    try {
      const { email, password, code } = req.body;

      if (!email || !password) {
        return res.status(400).json({ error: 'Email et nouveau mot de passe requis.' });
      }

      if (!validatePassword(password)) {
        return res.status(400).json({ error: 'Le mot de passe doit contenir au moins 8 caractères, dont une lettre et un chiffre.' });
      }

      const normalizedEmail = email.trim().toLowerCase();

      // Un utilisateur déjà connecté peut changer son mot de passe sans OTP ;
      // sinon le code de validation est obligatoire.
      const authUser = await getUserFromAuthorizationHeader(req);
      const isAuthenticated = authUser && authUser.email.toLowerCase() === normalizedEmail;

      if (!isAuthenticated) {
        if (!code) {
          return res.status(400).json({ error: 'Code OTP requis.' });
        }
        const otpCheck = await checkOtp(normalizedEmail, code, true);
        if (!otpCheck.ok) {
          return res.status(otpCheck.status).json({ error: otpCheck.error });
        }
      }

      const user = await prisma.user.findFirst({ where: { email: normalizedEmail } });
      if (!user) {
        // Le code OTP n'est généré que pour des comptes existants : à ce stade,
        // l'absence d'utilisateur reste traitée de façon générique
        // (anti-énumération).
        return res.status(400).json({ error: OTP_GENERIC_ERROR });
      }

      const passwordHash = await bcrypt.hash(password, 12);

      await prisma.user.update({
        where: { id: user.id },
        data: { passwordHash },
      });

      res.json({ message: 'Mot de passe réinitialisé avec succès.' });
    } catch (error) {
      console.error('[PLUME] reset password error:', error);
      res.status(500).json({ error: 'Erreur lors de la réinitialisation du mot de passe.' });
    }
  });

  // Changement de mot de passe par un utilisateur connecté : vérifie le mot de
  // passe actuel avant d'enregistrer le nouveau.
  app.post('/api/auth/change-password', authLimiter, requireAuth, async (req: any, res) => {
    try {
      const { currentPassword, newPassword } = req.body || {};
      if (!currentPassword || !newPassword) {
        return res.status(400).json({ error: 'Mot de passe actuel et nouveau mot de passe requis.' });
      }
      if (!validatePassword(newPassword)) {
        return res.status(400).json({ error: 'Le mot de passe doit contenir au moins 8 caractères, dont une lettre et un chiffre.' });
      }
      const user = await prisma.user.findUnique({ where: { id: req.user.id } });
      if (!user || !user.passwordHash) {
        return res.status(400).json({ error: 'Aucun mot de passe défini pour ce compte.' });
      }
      const valid = await bcrypt.compare(currentPassword, user.passwordHash);
      if (!valid) {
        return res.status(401).json({ error: 'Mot de passe actuel incorrect.' });
      }
      const passwordHash = await bcrypt.hash(newPassword, 12);
      await prisma.user.update({ where: { id: user.id }, data: { passwordHash } });
      res.json({ message: 'Mot de passe mis à jour avec succès.' });
    } catch (error) {
      console.error('[PLUME] change password error:', error);
      res.status(500).json({ error: 'Erreur lors du changement de mot de passe.' });
    }
  });

  app.post('/api/auth/verify-otp', otpLimiter, async (req, res) => {
    try {
      const { email, code } = req.body;
      if (!email || !code) {
        return res.status(400).json({ error: 'Email et code OTP requis.' });
      }

      const normalizedEmail = email.trim().toLowerCase();
      // Pré-vérification sans consommer le code (consume=false) : il reste
      // utilisable pour l'inscription/réinitialisation finale.
      const otpCheck = await checkOtp(normalizedEmail, code, false);
      if (!otpCheck.ok) {
        console.log(`[OTP] Vérification échouée pour ${normalizedEmail}`);
        return res.status(otpCheck.status).json({ error: otpCheck.error });
      }
      console.log(`[OTP] Vérification réussie pour ${normalizedEmail}`);
      res.json({ message: 'Code OTP valide.' });
    } catch (error) {
      console.error('[PLUME OTP] Verify route error:', error);
      res.status(500).json({ error: 'Erreur lors de la vérification de l\'OTP.' });
    }
  });

  app.get('/api/auth/me', requireAuth, async (req: any, res) => {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      include: { followers: true, following: true, blockedUsers: true },
    });
    res.json(serializeUser(user, true));
  });

  // Progression de certification calculée à partir des données réelles (même
  // source que le badge serveur), pour que l'UI n'affiche pas un pourcentage
  // localStorage divergent du badge.
  app.get('/api/me/certification', requireAuth, async (req: any, res) => {
    try {
      const role = roleFromPrisma(req.user.role);
      // Administrateur = propriétaire : tous les accomplissements débloqués + certifié.
      const ownerAllUnlocked = role === 'Administrateur';
      const stats = await computeAuthorStats(req.user.id);
      const evalRes = countAndEvaluateCertification('Auteur', stats, req.user.id, ownerAllUnlocked);
      res.json({
        role,
        authorPercent: evalRes.authorPercent,
        authorUnlocked: evalRes.unlockedAuthorCount,
        authorTotal: 100,
        shouldCertify: ownerAllUnlocked || (role === 'Auteur' && evalRes.shouldCertify),
        isVerified: ownerAllUnlocked || Boolean(req.user.isVerified),
      });
    } catch (error) {
      console.error('[CERT] progression:', error);
      res.status(500).json({ error: 'Erreur lors du calcul de la certification.' });
    }
  });

  app.post('/api/auth/logout', (_req, res) => {
    clearAuthCookie(res);
    res.json({ success: true });
  });

  // Users
  app.get('/api/users', async (req: any, res) => {
    try {
      // Les emails ne sont exposés qu'aux administrateurs.
      const requester = await getUserFromAuthorizationHeader(req);
      const includePrivate = requester?.role === 'Administrateur';
      const users = await prisma.user.findMany({ include: { followers: true, following: true, blockedUsers: true }, orderBy: { createdAt: 'desc' }, ...parsePagination(req) });
      res.json(users.map((u) => serializeUser(u, includePrivate)));
    } catch (error) {
      console.error('[PLUME] Erreur lors du chargement des utilisateurs, retour d\'un tableau vide par sécurité:', error);
      res.json([]);
    }
  });

  // Suggestions de personnes à découvrir (PLUME = aussi une appli pour se faire
  // des amis). On propose des comptes aux GOÛTS PROCHES : score = nombre de
  // genres favoris en commun (+ léger bonus si même rôle). On exclut soi-même,
  // les comptes déjà suivis, bloqués (dans un sens ou l'autre) et bannis.
  app.get('/api/suggestions/people', requireAuth, async (req: any, res) => {
    try {
      const me = await prisma.user.findUnique({
        where: { id: req.user.id },
        include: { following: { select: { followingId: true } }, blockedUsers: { select: { blockedId: true } }, blockedBy: { select: { blockerId: true } } },
      });
      if (!me) return res.json([]);
      const myGenres = new Set(parseJsonArray(me.favoriteGenres));
      const excluded = new Set<string>([
        me.id,
        ...me.following.map((f: any) => f.followingId),
        ...me.blockedUsers.map((b: any) => b.blockedId),
        ...me.blockedBy.map((b: any) => b.blockerId),
      ]);

      const candidates = await prisma.user.findMany({
        where: { id: { notIn: Array.from(excluded) }, isBanned: false },
        include: { followers: true, following: true, blockedUsers: true },
        take: 200,
      });

      const scored = candidates
        .map((u) => {
          const genres = parseJsonArray(u.favoriteGenres);
          const shared = genres.filter((g: string) => myGenres.has(g));
          let score = shared.length * 10;
          if (u.role === me.role) score += 2; // affinité de profil
          return { user: u, score, shared };
        })
        .filter((c) => c.score > 0)
        .sort((a, b) => b.score - a.score || (b.user.followers?.length || 0) - (a.user.followers?.length || 0))
        .slice(0, 12);

      res.json(scored.map((c) => ({ ...serializeUser(c.user), sharedGenres: c.shared })));
    } catch (error) {
      console.error('[SUGGESTIONS] erreur:', error);
      res.json([]);
    }
  });

  app.get('/api/users/:id', async (req: any, res) => {
    try {
      const user = await prisma.user.findUnique({ where: { id: req.params.id }, include: { followers: true, following: true, blockedUsers: true } });
      if (!user) return res.status(404).json({ error: 'Utilisateur non trouvé' });
      // L'email n'est renvoyé que pour soi-même ou un administrateur.
      const requester = await getUserFromAuthorizationHeader(req);
      const includePrivate = requester?.id === user.id || requester?.role === 'Administrateur';
      res.json(serializeUser(user, includePrivate));
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Erreur lors du chargement de l’utilisateur' });
    }
  });

  // Création directe d'utilisateur : réservée aux administrateurs. L'inscription
  // publique passe par /api/auth/otp/request + /api/auth/register (avec OTP).
  app.post('/api/users', requireAuth, async (req: any, res) => {
    try {
      if (req.user.role !== 'Administrateur') {
        return res.status(403).json({ error: 'Action interdite' });
      }
      const user = req.body;
      if (!user.username || !user.email) {
        return res.status(400).json({ error: 'username et email sont requis' });
      }
      if (user.password && !validatePassword(user.password)) {
        return res.status(400).json({ error: 'Le mot de passe doit contenir au moins 8 caractères, dont une lettre et un chiffre.' });
      }
      const normalizedEmail = String(user.email).toLowerCase();
      const existingUser = await prisma.user.findFirst({ where: { OR: [{ email: normalizedEmail }, { username: user.username }] } });
      if (existingUser) return res.status(400).json({ error: 'Cet utilisateur existe déjà.' });
      const newUser = await prisma.user.create({
        data: {
          // L'id est généré par la base : on n'accepte pas d'id arbitraire.
          username: user.username,
          email: normalizedEmail,
          passwordHash: user.password ? await bcrypt.hash(user.password, 12) : null,
          role: roleToPrisma(user.role),
          gender: genderToPrisma(user.gender),
          birthDate: user.birthDate ? new Date(user.birthDate) : null,
          avatar: user.avatar || null,
          bio: user.bio || '',
          favoriteGenres: JSON.stringify(user.favoriteGenres || []),
        },
        include: { followers: true, following: true, blockedUsers: true },
      });
      res.status(201).json(serializeUser(newUser, true));
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Erreur lors de la création de l'utilisateur" });
    }
  });

  app.put('/api/users/:id', requireAuth, async (req: any, res) => {
    try {
      const authUser = req.user;
      const isSelf = authUser.id === req.params.id;
      const isAdmin = authUser.role === 'Administrateur';

      // Un utilisateur ne peut modifier que son propre profil (sauf admin).
      if (!isSelf && !isAdmin) {
        return res.status(403).json({ error: 'Action interdite' });
      }

      const user = req.body;

      // État actuel : nécessaire pour détecter un VRAI changement de pseudo/e-mail
      // et appliquer les délais (anti-abus).
      const existing = await prisma.user.findUnique({ where: { id: req.params.id } });
      if (!existing) return res.status(404).json({ error: 'Utilisateur non trouvé' });

      const now = new Date();
      const DAY = 86_400_000;
      const USERNAME_COOLDOWN_DAYS = 30;
      const EMAIL_COOLDOWN_DAYS = 90;
      const fmt = (d: Date) => d.toLocaleDateString('fr-FR');

      const newUsername = typeof user.username === 'string' ? user.username.trim() : undefined;
      const newEmail = typeof user.email === 'string' ? user.email.toLowerCase().trim() : undefined;
      const usernameChanging = newUsername !== undefined && newUsername.length > 0 && newUsername !== existing.username;
      const emailChanging = newEmail !== undefined && newEmail.length > 0 && newEmail !== (existing.email || '').toLowerCase();

      // Délais de modification — appliqués côté SERVEUR (source de vérité), pas
      // seulement côté client. Les administrateurs en sont exemptés.
      if (!isAdmin) {
        if (usernameChanging && existing.usernameChangedAt) {
          const nextAllowed = new Date(existing.usernameChangedAt.getTime() + USERNAME_COOLDOWN_DAYS * DAY);
          if (now < nextAllowed) {
            return res.status(429).json({
              error: `Le nom d'utilisateur n'est modifiable qu'une fois tous les 30 jours. Prochaine modification possible le ${fmt(nextAllowed)}.`,
              field: 'username',
              nextChangeAt: nextAllowed.toISOString(),
            });
          }
        }
        if (emailChanging && existing.emailChangedAt) {
          const nextAllowed = new Date(existing.emailChangedAt.getTime() + EMAIL_COOLDOWN_DAYS * DAY);
          if (now < nextAllowed) {
            return res.status(429).json({
              error: `L'adresse e-mail n'est modifiable qu'une fois tous les 90 jours. Prochaine modification possible le ${fmt(nextAllowed)}.`,
              field: 'email',
              nextChangeAt: nextAllowed.toISOString(),
            });
          }
        }
      }

      // Unicité de l'e-mail s'il change (message clair plutôt qu'erreur Prisma opaque).
      if (emailChanging) {
        const taken = await prisma.user.findFirst({ where: { email: newEmail, id: { not: req.params.id } }, select: { id: true } });
        if (taken) return res.status(409).json({ error: 'Cet e-mail est déjà utilisé par un autre compte.' });
      }

      // Borne la longueur de la bio (anti-bloat des objets utilisateur).
      if (typeof user.bio === 'string' && user.bio.length > 500) {
        return res.status(400).json({ error: 'Bio trop longue (500 caractères maximum).' });
      }

      // Champs librement modifiables par le propriétaire du compte.
      // (pseudo/e-mail ajoutés conditionnellement plus bas, avec horodatage.)
      const data: any = {
        bio: user.bio ?? undefined,
        avatar: user.avatar ?? undefined,
        banner: user.banner ?? undefined,
        gender: user.gender ? genderToPrisma(user.gender) : undefined,
        birthDate: user.birthDate ? new Date(user.birthDate) : undefined,
        favoriteGenres: Array.isArray(user.favoriteGenres) ? JSON.stringify(user.favoriteGenres) : undefined,
        customStickers: Array.isArray(user.customStickers) ? JSON.stringify(user.customStickers) : undefined,
        showFollowers: user.showFollowers,
        showFollowing: user.showFollowing,
        showFriends: user.showFriends,
        showMentions: user.showMentions,
        privateProfile: user.privateProfile,
        showBooksRead: user.showBooksRead,
        showBooksWritten: user.showBooksWritten,
        showPalmares: user.showPalmares,
        allowMessages: user.allowMessages,
        whoCanFollow: user.whoCanFollow,
        whoCanComment: user.whoCanComment,
        readingTheme: user.readingTheme,
        readingFontSize: user.readingFontSize,
        readingFontFamily: user.readingFontFamily,
        readingFullscreen: user.readingFullscreen,
        autoSaveEnabled: user.autoSaveEnabled,
        confirmDeleteStory: user.confirmDeleteStory,
        showcase: user.showcase === undefined ? undefined : (Array.isArray(user.showcase) ? user.showcase.slice(0, 3) : null),
        hasChangedRole: user.hasChangedRole,
      };

      // Pseudo / e-mail : appliqués SEULEMENT s'ils changent réellement, avec
      // horodatage du changement (sert au calcul des délais). Un changement par
      // un admin n'enclenche pas de cooldown pour l'utilisateur.
      if (usernameChanging) {
        data.username = newUsername;
        if (!isAdmin) data.usernameChangedAt = now;
      }
      if (emailChanging) {
        data.email = newEmail;
        if (!isAdmin) data.emailChangedAt = now;
      }

      // isVerified n'est JAMAIS piloté par le client : la certification est
      // recalculée par le serveur depuis des données autoritatives (voir plus
      // bas). Seul un administrateur peut forcer manuellement le badge.
      let adminSetVerification = false;
      if (isAdmin && user.isVerified !== undefined) {
        data.isVerified = Boolean(user.isVerified);
        adminSetVerification = true;
      }

      // Changement de rôle : on interdit toute auto-promotion en
      // Administrateur. Seul un admin peut accorder ce rôle.
      if (user.role !== undefined) {
        const requestedRole = roleToPrisma(user.role);
        if (requestedRole === 'Administrateur' && !isAdmin) {
          return res.status(403).json({ error: 'Élévation de privilèges interdite.' });
        }
        data.role = requestedRole;
      }

      // Champs de modération : réservés aux administrateurs.
      if (isAdmin) {
        data.isFlagged = user.isFlagged;
        data.flagReason = user.flagReason;
        if (user.featured !== undefined) data.featured = Boolean(user.featured);
      }

      const updatedUser = await prisma.user.update({
        where: { id: req.params.id },
        data,
        include: { followers: true, following: true, blockedUsers: true },
      });

      // Sauf override admin explicite, on (re)calcule la certification d'après
      // les données réelles (rôle Auteur + accomplissements DB).
      if (!adminSetVerification) {
        const fresh = await prisma.user.findUnique({ where: { id: req.params.id }, include: { followers: true, following: true, blockedUsers: true } });
        await recomputeCertification(req.params.id);
        const reloaded = await prisma.user.findUnique({ where: { id: req.params.id }, include: { followers: true, following: true, blockedUsers: true } });
        return res.json(serializeUser(reloaded || fresh || updatedUser, true));
      }
      res.json(serializeUser(updatedUser, true));
    } catch (error) {
      console.error(error);
      res.status(404).json({ error: 'Utilisateur non trouvé ou erreur de modification' });
    }
  });

  // Suppression de compte (RGPD + exigence obligatoire Apple/Google pour les
  // apps avec comptes). Un utilisateur supprime son propre compte ; un admin
  // peut supprimer n'importe quel compte. Les données liées (récits, chapitres,
  // commentaires, likes, favoris, follows, messages, notifications…) partent en
  // cascade via les relations onDelete: Cascade du schéma Prisma.
  app.delete('/api/users/:id', requireAuth, async (req: any, res) => {
    try {
      const authUser = req.user;
      const isSelf = authUser.id === req.params.id;
      const isAdmin = authUser.role === 'Administrateur';
      if (!isSelf && !isAdmin) return res.status(403).json({ error: 'Action interdite' });

      const existing = await prisma.user.findUnique({ where: { id: req.params.id }, select: { id: true } });
      if (!existing) return res.status(404).json({ error: 'Utilisateur introuvable' });

      await prisma.user.delete({ where: { id: req.params.id } });

      // L'utilisateur qui supprime SON compte voit aussi sa session révoquée.
      if (isSelf) res.clearCookie(AUTH_COOKIE, { path: '/' });
      res.status(204).end();
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Erreur lors de la suppression du compte.' });
    }
  });

  // Suspension / réactivation d'un compte (modération). RÉSERVÉ aux admins.
  // Bannir = bloquer la connexion + dépublier les récits (données préservées,
  // donc réversible). `{ banned: false }` réactive le compte.
  app.post('/api/users/:id/ban', requireAuth, async (req: any, res) => {
    try {
      if (req.user.role !== 'Administrateur') {
        return res.status(403).json({ error: 'Action réservée aux administrateurs.' });
      }
      if (req.user.id === req.params.id) {
        return res.status(400).json({ error: 'Un administrateur ne peut pas se suspendre lui-même.' });
      }
      const target = await prisma.user.findUnique({ where: { id: req.params.id }, select: { id: true, role: true } });
      if (!target) return res.status(404).json({ error: 'Utilisateur introuvable.' });
      if (target.role === 'Administrateur') {
        return res.status(403).json({ error: 'Impossible de suspendre un autre administrateur.' });
      }

      const banned = req.body?.banned !== false; // défaut = suspendre
      await prisma.user.update({ where: { id: req.params.id }, data: { isBanned: banned } });

      // À la suspension, on dépublie ses récits (retirés du public, données
      // conservées) ; à la réactivation, on ne re-publie pas automatiquement.
      if (banned) {
        await prisma.story.updateMany({ where: { authorId: req.params.id, status: 'PUBLIE' }, data: { status: 'BROUILLON' } });
      }

      res.json({ success: true, banned });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Erreur lors de la suspension du compte.' });
    }
  });

  // Signalement d'un compte : tout utilisateur connecté peut signaler, mais
  // seul ce flux (et non un PUT arbitraire) peut positionner isFlagged.
  app.post('/api/users/:id/report', requireAuth, async (req: any, res) => {
    try {
      const reportedId = req.params.id;
      if (reportedId === req.user.id) {
        return res.status(400).json({ error: 'Vous ne pouvez pas vous signaler vous-même.' });
      }
      const { reason } = req.body || {};
      const target = await prisma.user.findUnique({ where: { id: reportedId }, select: { id: true, isFlagged: true } });
      if (!target) return res.status(404).json({ error: 'Utilisateur introuvable' });

      const cleanReason = typeof reason === 'string' && reason.trim() ? reason.trim().slice(0, 500) : null;

      // Un seul signalement par couple (reporter, signalé) : idempotent, donc un
      // utilisateur ne peut pas gonfler le compteur en répétant l'appel.
      await prisma.report.upsert({
        where: { reporterId_reportedId: { reporterId: req.user.id, reportedId } },
        update: { reason: cleanReason },
        create: { reporterId: req.user.id, reportedId, reason: cleanReason },
      });

      // Le compte n'est marqué pour modération qu'au-delà d'un seuil de
      // signalements DISTINCTS (anti-abus / harcèlement par un compte isolé).
      const reportCount = await prisma.report.count({ where: { reportedId } });
      let flagged = target.isFlagged;
      if (!target.isFlagged && reportCount >= REPORT_FLAG_THRESHOLD) {
        await prisma.user.update({
          where: { id: reportedId },
          data: { isFlagged: true, flagReason: cleanReason || `Signalé par ${reportCount} utilisateurs` },
        });
        flagged = true;
      }
      console.log(`[REPORT] compte ${reportedId} signalé par ${req.user.id} (total distinct: ${reportCount})`);
      res.json({ success: true, reportCount, isFlagged: flagged });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Erreur lors du signalement.' });
    }
  });

  // Configuration publique côté client, lue au RUNTIME. Permet à l'app native
  // (APK) d'obtenir la config Cloudinary sans qu'elle soit figée au build :
  // le serveur, lui, a les variables d'environnement.
  app.get('/api/config', (_req, res) => {
    res.json({
      cloudinary: {
        cloudName: process.env.VITE_CLOUDINARY_CLOUD_NAME || process.env.CLOUDINARY_CLOUD_NAME || '',
        uploadPreset: process.env.VITE_CLOUDINARY_UPLOAD_PRESET || process.env.CLOUDINARY_UPLOAD_PRESET || '',
      },
    });
  });

  // Sonde de santé ultra-légère (aucun accès base) : utilisée par le keep-alive
  // (auto-ping + workflow GitHub) pour empêcher la mise en veille du plan gratuit.
  app.get('/healthz', (_req, res) => res.status(200).type('text/plain').send('ok'));

  // Télémétrie d'erreurs client : l'app (ErrorBoundary + handlers globaux)
  // remonte ici les crashs JS. On les trace dans les logs serveur (visibles sur
  // Render) → on détecte les écrans noirs/plantages SANS dépendre d'une capture.
  app.post('/api/client-error', clientErrorLimiter, (req: any, res) => {
    const b = req.body || {};
    const clip = (v: any, n: number) => String(v ?? '').slice(0, n);
    console.error('[CLIENT-ERROR]', JSON.stringify({
      message: clip(b.message, 500),
      url: clip(b.url, 300),
      userId: clip(b.userId, 60),
      info: clip(b.info, 1200),
      stack: clip(b.stack, 2000),
      ua: clip(b.ua, 200),
      at: new Date().toISOString(),
    }));
    res.status(204).end();
  });

  // Search
  // Échappe les métacaractères LIKE (\ % _) saisis par l'utilisateur pour qu'ils
  // soient traités littéralement (le caractère d'échappement est le backslash).
  const escapeLike = (value: string) => value.replace(/[\\%_]/g, (c) => '\\' + c);

  // La recherche utilise unaccent(lower(...)) pour être insensible à la casse ET
  // aux accents (« eveil » trouve « Éveil »). On récupère d'abord les IDs en SQL
  // brut, puis on recharge via Prisma pour conserver les includes/sérialisation.
  app.get('/api/search/users', searchLimiter, async (req, res) => {
    try {
      const q = String(req.query.q || '').trim();
      if (!q) return res.json([]);
      const pattern = `%${escapeLike(q)}%`;
      const rows = await prisma.$queryRaw<Array<{ id: string }>>`
        SELECT "id" FROM "User"
        WHERE unaccent(lower("username")) LIKE unaccent(lower(${pattern})) ESCAPE '\\'
           OR unaccent(lower("bio")) LIKE unaccent(lower(${pattern})) ESCAPE '\\'
        LIMIT 20`;
      const ids = rows.map((r) => r.id);
      if (ids.length === 0) return res.json([]);
      const users = await prisma.user.findMany({
        where: { id: { in: ids } },
        include: { followers: true, following: true, blockedUsers: true },
      });
      res.json(users.map((u) => serializeUser(u)));
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Erreur lors de la recherche.' });
    }
  });

  app.get('/api/search/stories', searchLimiter, async (req, res) => {
    try {
      const q = String(req.query.q || '').trim();
      if (!q) return res.json([]);
      const pattern = `%${escapeLike(q)}%`;
      // La recherche ne révèle jamais les brouillons (seuls les récits publiés).
      const rows = await prisma.$queryRaw<Array<{ id: string }>>`
        SELECT "id" FROM "Story"
        WHERE "status" = 'PUBLIE' AND (
              unaccent(lower("title")) LIKE unaccent(lower(${pattern})) ESCAPE '\\'
           OR unaccent(lower("description")) LIKE unaccent(lower(${pattern})) ESCAPE '\\'
           OR unaccent(lower("genre")) LIKE unaccent(lower(${pattern})) ESCAPE '\\'
           OR unaccent(lower("tags")) LIKE unaccent(lower(${pattern})) ESCAPE '\\')
        ORDER BY "createdAt" DESC
        LIMIT 30`;
      const ids = rows.map((r) => r.id);
      if (ids.length === 0) return res.json([]);
      const stories = await prisma.story.findMany({
        where: { id: { in: ids } },
        include: { author: true, chapters: { orderBy: { order: 'asc' } }, likes: true, favorites: true },
      });
      // On restaure l'ordre du tri SQL (createdAt DESC), perdu par le `in`.
      const order = new Map(ids.map((id, i) => [id, i]));
      stories.sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));
      res.json(stories.map((s) => serializeStory(filterDraftChapters(s, undefined, false))));
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Erreur lors de la recherche.' });
    }
  });

  // Fil personnalisé : applique l'algorithme de diffusion partagé
  // (src/utils/recommendation) côté serveur, sur l'ensemble du catalogue publié,
  // avec pagination par curseur. ?discovery=0..1 règle découverte↔pertinence.
  app.get('/api/feed', requireAuth, async (req: any, res) => {
    try {
      const discovery = Math.max(0, Math.min(1, parseFloat(String(req.query.discovery ?? '0.5')) || 0.5));
      const limit = Math.max(1, Math.min(50, parseInt(String(req.query.limit ?? '20'), 10) || 20));
      const cursor = Math.max(0, parseInt(String(req.query.cursor ?? '0'), 10) || 0);

      // Requérant enrichi (forme User côté client) pour l'algorithme.
      const me = await prisma.user.findUnique({
        where: { id: req.user.id },
        include: {
          followers: true,
          following: true,
          blockedUsers: true,
          readingHistory: { select: { storyId: true } },
          favorites: { select: { storyId: true } },
          likes: { select: { storyId: true } },
        },
      });
      if (!me) return res.status(404).json({ error: 'Utilisateur introuvable' });
      const user: any = serializeUser(me, true);
      const readStoryIds = (me.readingHistory || []).map((h: any) => h.storyId);
      user.readingHistory = Array.from(new Set(readStoryIds));
      // On ne re-pousse pas dans le fil les récits déjà lus, aimés ou en favori :
      // « Pour toi » sert à faire DÉCOUVRIR, pas à ressasser ce qu'on connaît déjà.
      const excludeStoryIds = Array.from(new Set([
        ...readStoryIds,
        ...(me.favorites || []).map((f: any) => f.storyId),
        ...(me.likes || []).map((l: any) => l.storyId),
      ]));

      // Catalogue publié enrichi : on expose likedBy/favoritedBy (ids) pour les
      // briques sociale et collaborative, absents de serializeStory.
      const dbStories = await prisma.story.findMany({
        where: { status: 'PUBLIE' },
        include: {
          author: true,
          chapters: { orderBy: { order: 'asc' } },
          likes: { select: { userId: true } },
          favorites: { select: { userId: true } },
        },
      });
      const stories = dbStories.map((s: any) => {
        const serialized: any = serializeStory(filterDraftChapters(s, undefined, false));
        return {
          ...serialized,
          // Fallback de date pour les récits publiés sans publishedAt explicite.
          publishDate: serialized.publishDate || (s.createdAt ? new Date(s.createdAt).toISOString().split('T')[0] : undefined),
          likedBy: (s.likes || []).map((l: any) => l.userId),
          favoritedBy: (s.favorites || []).map((f: any) => f.userId),
        };
      });

      const ranked = recommendStories(stories as any, user, {
        weights: weightsForDiscovery(discovery),
        explorationRatio: explorationRatioForDiscovery(discovery),
        excludeStoryIds,
      });

      const page = ranked.slice(cursor, cursor + limit);
      const nextCursor = cursor + limit < ranked.length ? cursor + limit : null;
      res.json({
        items: page.map((p) => ({ story: p.story, reasons: p.reasons, isExploration: p.isExploration })),
        nextCursor,
        total: ranked.length,
      });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Erreur lors de la génération du fil.' });
    }
  });

  // Stories
  app.get('/api/stories', async (req: any, res) => {
    try {
      // Routes publiques : on ne renvoie que les récits publiés, plus les
      // brouillons du demandeur lui-même (identifié via le cookie/token) et
      // tout pour un administrateur.
      const requester = await getUserFromAuthorizationHeader(req);
      const isAdmin = requester?.role === 'Administrateur';
      const where = isAdmin
        ? {}
        : requester
          ? { OR: [{ status: 'PUBLIE' }, { authorId: requester.id }] }
          : { status: 'PUBLIE' };
      const stories = await prisma.story.findMany({ where, include: { author: true, chapters: { orderBy: { order: 'asc' } }, likes: true, favorites: true }, orderBy: { createdAt: 'desc' }, ...parsePagination(req) });
      res.json(stories.map((s) => serializeStory(filterDraftChapters(s, requester?.id, isAdmin))));
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Erreur lors du chargement des histoires' });
    }
  });

  app.get('/api/stories/:id', async (req: any, res) => {
    try {
      const story = await prisma.story.findUnique({
        where: { id: req.params.id },
        include: { author: true, chapters: { orderBy: { order: 'asc' } }, likes: true, favorites: true, comments: { include: { user: true, replies: { include: { user: true }, orderBy: { createdAt: 'asc' } } }, orderBy: { createdAt: 'desc' } } },
      });
      if (!story) return res.status(404).json({ error: 'Récit non trouvé' });
      const requester = await getUserFromAuthorizationHeader(req);
      const isAdmin = requester?.role === 'Administrateur';
      const isOwner = requester?.id === story.authorId;
      // Un brouillon n'est visible que par son auteur ou un administrateur.
      if (story.status !== 'PUBLIE' && !isOwner && !isAdmin) {
        return res.status(404).json({ error: 'Récit non trouvé' });
      }
      res.json(serializeStory(filterDraftChapters(story, requester?.id, isAdmin)));
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Erreur lors du chargement du récit' });
    }
  });

  // Bornes de taille par champ texte (le corps JSON est déjà plafonné à 10mb
  // globalement ; ceci évite qu'un seul champ n'atteigne cette taille).
  const LIMITS = { title: 300, description: 8000, chapterContent: 200_000, comment: 8000 };
  const tooLong = (v: unknown, max: number) => typeof v === 'string' && v.length > max;

  app.post('/api/stories', requireAuth, async (req: any, res) => {
    try {
      const story = req.body;
      if (tooLong(story.title, LIMITS.title) || tooLong(story.description, LIMITS.description)) {
        return res.status(400).json({ error: 'Titre (max 300) ou description (max 8000) trop long.' });
      }
      const newStory = await prisma.story.create({
        data: {
          id: story.id || undefined,
          title: story.title || 'Sans titre',
          description: story.description || '',
          cover: story.cover || null,
          genre: story.genre || 'Non classé',
          category: story.category || null,
          ambiance: story.ambiance || null,
          format: story.format || null,
          language: story.language || 'fr',
          tags: JSON.stringify(story.tags || []),
          status: storyStatusToPrisma(story.status),
          // Les compteurs (views/reads/rating) et le statut de modération
          // (isFlagged) ne sont jamais pilotés par le client : ils partent des
          // valeurs par défaut du schéma et n'évoluent que via les routes
          // dédiées (/read, /like) ou la modération admin.
          ageRating: ageRatingToPrisma(story.ageRating),
          authorId: req.user.id,
          publishedAt: story.status === 'Publié' ? new Date() : null,
        },
        include: { author: true, chapters: { orderBy: { order: 'asc' } }, likes: true, favorites: true },
      });
      await recomputeCertification(req.user.id);
      res.status(201).json(serializeStory(newStory));
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Erreur lors de la création de l'histoire" });
    }
  });

  app.put('/api/stories/:id', requireAuth, async (req: any, res) => {
    try {
      const existing = await prisma.story.findUnique({ where: { id: req.params.id } });
      if (!existing) return res.status(404).json({ error: 'Récit non trouvé' });
      const isAdmin = req.user.role === 'Administrateur';
      if (existing.authorId !== req.user.id && !isAdmin) return res.status(403).json({ error: 'Action interdite' });
      const story = req.body;
      if (tooLong(story.title, LIMITS.title) || tooLong(story.description, LIMITS.description)) {
        return res.status(400).json({ error: 'Titre (max 300) ou description (max 8000) trop long.' });
      }
      const data: any = {
        title: story.title,
        description: story.description,
        cover: story.cover,
        genre: story.genre,
        category: story.category,
        ambiance: story.ambiance,
        format: story.format,
        language: story.language,
        tags: Array.isArray(story.tags) ? JSON.stringify(story.tags) : undefined,
        status: story.status ? storyStatusToPrisma(story.status) : undefined,
        ageRating: story.ageRating ? ageRatingToPrisma(story.ageRating) : undefined,
        publishedAt: story.status === 'Publié' ? new Date() : undefined,
      };
      // views/reads/rating ne sont jamais modifiables par le client (sinon
      // gonflage des statistiques). Le statut de modération (isFlagged/
      // flagReason) est réservé aux administrateurs : un auteur ne peut pas
      // lever un signalement sur sa propre histoire.
      if (isAdmin) {
        data.isFlagged = story.isFlagged;
        data.flagReason = story.flagReason;
        if (story.featured !== undefined) data.featured = Boolean(story.featured);
      }
      const updatedStory = await prisma.story.update({
        where: { id: req.params.id },
        data,
        include: { author: true, chapters: { orderBy: { order: 'asc' } }, likes: true, favorites: true },
      });
      await recomputeCertification(existing.authorId);
      // XP auteur : +80 à la PREMIÈRE publication d'un récit (transition vers Publié).
      if (existing.status !== 'PUBLIE' && data.status === 'PUBLIE') {
        awardXp(existing.authorId, 'author', XP.publishStory).catch(() => {});
      }
      res.json(serializeStory(updatedStory));
    } catch (error) {
      console.error(error);
      res.status(404).json({ error: 'Récit non trouvé ou erreur de modification' });
    }
  });

  app.delete('/api/stories/:id', requireAuth, async (req: any, res) => {
    try {
      const story = await prisma.story.findUnique({ where: { id: req.params.id } });
      if (!story) return res.status(404).json({ error: 'Récit non trouvé' });
      if (story.authorId !== req.user.id && req.user.role !== 'Administrateur') return res.status(403).json({ error: 'Action interdite' });
      await prisma.story.delete({ where: { id: req.params.id } });
      await recomputeCertification(story.authorId);
      res.status(204).end();
    } catch (error) {
      console.error(error);
      res.status(404).json({ error: 'Récit non trouvé ou erreur de suppression' });
    }
  });

  // Chapters
  app.get('/api/stories/:storyId/chapters', async (req: any, res) => {
    const story = await prisma.story.findUnique({ where: { id: req.params.storyId }, select: { authorId: true, status: true } });
    if (!story) return res.json([]);
    const requester = await getUserFromAuthorizationHeader(req);
    const isAdmin = requester?.role === 'Administrateur';
    const isOwner = requester?.id === story.authorId;
    // Brouillon non visible aux tiers ; pour un récit publié, on masque les
    // chapitres encore non publiés à quiconque n'en est pas l'auteur/admin.
    if (story.status !== 'PUBLIE' && !isOwner && !isAdmin) return res.json([]);
    const where: any = { storyId: req.params.storyId };
    if (!isOwner && !isAdmin) where.isPublished = true;
    const chapters = await prisma.chapter.findMany({ where, orderBy: { order: 'asc' } });
    res.json(chapters.map(serializeChapter));
  });

  app.post('/api/stories/:storyId/chapters', requireAuth, async (req: any, res) => {
    try {
      const story = await prisma.story.findUnique({ where: { id: req.params.storyId } });
      if (!story) return res.status(404).json({ error: 'Récit non trouvé' });
      if (story.authorId !== req.user.id && req.user.role !== 'Administrateur') return res.status(403).json({ error: 'Action interdite' });
      const chapter = req.body;
      if (tooLong(chapter.title, LIMITS.title) || tooLong(chapter.content, LIMITS.chapterContent)) {
        return res.status(400).json({ error: 'Titre (max 300) ou contenu (max 200000) du chapitre trop long.' });
      }
      // Ordre calculé CÔTÉ SERVEUR (max existant + 1) pour garantir l'unicité
      // imposée par @@unique([storyId, order]). Auparavant l'ordre valait toujours
      // 1 → le 2e chapitre violait la contrainte et n'était jamais enregistré.
      const lastChapter = await prisma.chapter.findFirst({
        where: { storyId: req.params.storyId },
        orderBy: { order: 'desc' },
        select: { order: true },
      });
      const nextOrder = (lastChapter?.order ?? 0) + 1;
      const newChapter = await prisma.chapter.create({
        data: {
          id: chapter.id || undefined,
          title: chapter.title || 'Chapitre sans titre',
          content: chapter.content || '',
          order: nextOrder,
          isPublished: Boolean(chapter.isPublished ?? (chapter.status === 'Publié')),
          // views/reads partent à 0 (défaut schéma) : non pilotables par le client.
          storyId: req.params.storyId,
          publishedAt: chapter.isPublished || chapter.status === 'Publié' ? new Date() : null,
        },
      });
      await recomputeCertification(story.authorId);
      // XP auteur : +30 si le chapitre est créé directement publié.
      if (newChapter.isPublished) awardXp(story.authorId, 'author', XP.publishChapter).catch(() => {});
      res.status(201).json(serializeChapter(newChapter));
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Erreur lors de la création du chapitre' });
    }
  });

  app.put('/api/chapters/:id', requireAuth, async (req: any, res) => {
    try {
      const existingChapter = await prisma.chapter.findUnique({ where: { id: req.params.id }, include: { story: true } });
      if (!existingChapter) return res.status(404).json({ error: 'Chapitre non trouvé' });
      if (existingChapter.story.authorId !== req.user.id && req.user.role !== 'Administrateur') return res.status(403).json({ error: 'Action interdite' });
      const chapter = req.body;
      const updatedChapter = await prisma.chapter.update({
        where: { id: req.params.id },
        data: {
          title: chapter.title,
          content: chapter.content,
          order: chapter.order,
          // views/reads volontairement omis : non modifiables par le client.
          isPublished: chapter.isPublished,
          publishedAt: chapter.isPublished ? new Date() : undefined,
        },
      });
      await recomputeCertification(existingChapter.story.authorId);
      // XP auteur : +30 à la PREMIÈRE publication du chapitre (transition).
      if (!existingChapter.isPublished && updatedChapter.isPublished) {
        awardXp(existingChapter.story.authorId, 'author', XP.publishChapter).catch(() => {});
      }
      res.json(serializeChapter(updatedChapter));
    } catch (error) {
      console.error(error);
      res.status(404).json({ error: 'Chapitre non trouvé ou erreur de modification' });
    }
  });

  app.delete('/api/chapters/:id', requireAuth, async (req: any, res) => {
    try {
      const existingChapter = await prisma.chapter.findUnique({ where: { id: req.params.id }, include: { story: true } });
      if (!existingChapter) return res.status(404).json({ error: 'Chapitre non trouvé' });
      if (existingChapter.story.authorId !== req.user.id && req.user.role !== 'Administrateur') return res.status(403).json({ error: 'Action interdite' });
      await prisma.chapter.delete({ where: { id: req.params.id } });
      await recomputeCertification(existingChapter.story.authorId);
      res.status(204).end();
    } catch (error) {
      console.error(error);
      res.status(404).json({ error: 'Chapitre non trouvé ou erreur de suppression' });
    }
  });


  app.put('/api/stories/:storyId/chapters/:chapterId', requireAuth, async (req: any, res) => {
    req.params.id = req.params.chapterId;
    try {
      const existingChapter = await prisma.chapter.findUnique({ where: { id: req.params.chapterId }, include: { story: true } });
      if (!existingChapter) return res.status(404).json({ error: 'Chapitre non trouvé' });
      if (existingChapter.story.authorId !== req.user.id && req.user.role !== 'Administrateur') return res.status(403).json({ error: 'Action interdite' });
      const chapter = req.body;
      const updatedChapter = await prisma.chapter.update({
        where: { id: req.params.chapterId },
        data: {
          title: chapter.title,
          content: chapter.content,
          order: chapter.order,
          // views/reads volontairement omis : non modifiables par le client.
          isPublished: chapter.isPublished,
          publishedAt: chapter.isPublished ? new Date() : undefined,
        },
      });
      await recomputeCertification(existingChapter.story.authorId);
      res.json(serializeChapter(updatedChapter));
    } catch (error) {
      console.error(error);
      res.status(404).json({ error: 'Chapitre non trouvé ou erreur de modification' });
    }
  });

  app.delete('/api/stories/:storyId/chapters/:chapterId', requireAuth, async (req: any, res) => {
    try {
      const existingChapter = await prisma.chapter.findUnique({ where: { id: req.params.chapterId }, include: { story: true } });
      if (!existingChapter) return res.status(404).json({ error: 'Chapitre non trouvé' });
      if (existingChapter.story.authorId !== req.user.id && req.user.role !== 'Administrateur') return res.status(403).json({ error: 'Action interdite' });
      await prisma.chapter.delete({ where: { id: req.params.chapterId } });
      await recomputeCertification(existingChapter.story.authorId);
      res.status(204).end();
    } catch (error) {
      console.error(error);
      res.status(404).json({ error: 'Chapitre non trouvé ou erreur de suppression' });
    }
  });

  // Comments
  app.get('/api/comments', async (_req, res) => {
    const comments = await prisma.comment.findMany({ include: { user: true, replies: { include: { user: true } } }, orderBy: { createdAt: 'desc' } });
    res.json(comments.map(serializeComment));
  });

  app.get('/api/stories/:storyId/comments', async (req, res) => {
    const comments = await prisma.comment.findMany({ where: { storyId: req.params.storyId }, include: { user: true, replies: { include: { user: true }, orderBy: { createdAt: 'asc' } } }, orderBy: { createdAt: 'desc' } });
    res.json(comments.map(serializeComment));
  });

  app.post('/api/comments', requireAuth, async (req: any, res) => {
    try {
      const { storyId, chapterId, content } = req.body;
      if (!storyId || !chapterId || !content) return res.status(400).json({ error: 'storyId, chapterId et content sont requis' });
      if (tooLong(content, LIMITS.comment)) return res.status(400).json({ error: 'Commentaire trop long (max 8000 caractères).' });
      const story = await prisma.story.findUnique({ where: { id: storyId }, select: { authorId: true, title: true, author: { select: { whoCanComment: true } } } });
      if (!story) return res.status(404).json({ error: 'Récit non trouvé' });
      const permission = await ensureCanComment(req.user.id, story.authorId, story.author?.whoCanComment);
      if (!permission.ok) return res.status(403).json({ error: permission.error });
      const comment = await prisma.comment.create({ data: { storyId, chapterId, userId: req.user.id, content }, include: { user: true, replies: true } });
      // XP : commentaire (plafonné côté donneur), bonus à l'auteur du récit.
      if (story.authorId !== req.user.id) {
        awardCappedXp(req.user.id, 'reader', XP.commentGiven, 'commentGiven', 10).catch(() => {});
        awardXp(story.authorId, 'author', XP.commentReceived).catch(() => {});
      }
      if (story.authorId !== req.user.id) {
        const notification = await prisma.notification.create({
          data: {
            userId: story.authorId,
            type: 'COMMENT' as any,
            title: 'Nouveau commentaire',
            message: `Quelqu’un a commenté ton histoire « ${story.title} ».`,
            data: {
              actorId: req.user.id,
              actorName: req.user.username,
              actorAvatar: req.user.avatar || '',
              storyId: storyId,
              storyTitle: story.title,
              chapterId,
              commentId: comment.id,
              excerpt: content.length > 60 ? content.slice(0, 57) + '...' : content,
            } as any
          }
        });
        notifyUser(story.authorId, notification);
      }
      res.status(201).json(serializeComment(comment));
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Erreur lors de la création du commentaire' });
    }
  });

  app.post('/api/stories/:storyId/comments', requireAuth, async (req: any, res) => {
    try {
      const { chapterId, content } = req.body;
      if (!chapterId || !content) return res.status(400).json({ error: 'chapterId et content sont requis' });
      if (tooLong(content, LIMITS.comment)) return res.status(400).json({ error: 'Commentaire trop long (max 8000 caractères).' });
      const story = await prisma.story.findUnique({ where: { id: req.params.storyId }, select: { authorId: true, title: true, author: { select: { whoCanComment: true } } } });
      if (!story) return res.status(404).json({ error: 'Récit non trouvé' });
      const permission = await ensureCanComment(req.user.id, story.authorId, story.author?.whoCanComment);
      if (!permission.ok) return res.status(403).json({ error: permission.error });
      const comment = await prisma.comment.create({
        data: { storyId: req.params.storyId, chapterId, userId: req.user.id, content },
        include: { user: true, replies: true },
      });
      if (story.authorId !== req.user.id) {
        const notification = await prisma.notification.create({
          data: {
            userId: story.authorId,
            type: 'COMMENT' as any,
            title: 'Nouveau commentaire',
            message: `Quelqu’un a commenté ton histoire « ${story.title} ».`,
            data: {
              actorId: req.user.id,
              actorName: req.user.username,
              actorAvatar: req.user.avatar || '',
              storyId: req.params.storyId,
              storyTitle: story.title,
              chapterId,
              commentId: comment.id,
              excerpt: content.length > 60 ? content.slice(0, 57) + '...' : content,
            } as any
          }
        });
        notifyUser(story.authorId, notification);
      }
      res.status(201).json(serializeComment(comment));
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Erreur lors de la création du commentaire' });
    }
  });

  app.put('/api/comments/:id', requireAuth, async (req: any, res) => {
    try {
      const content = typeof req.body.content === 'string' ? req.body.content.trim() : '';
      if (!content) return res.status(400).json({ error: 'content est requis' });
      if (content.length > LIMITS.comment) return res.status(400).json({ error: 'Texte trop long (max 8000 caractères).' });
      const existing = await prisma.comment.findUnique({ where: { id: req.params.id } });
      if (!existing) return res.status(404).json({ error: 'Commentaire non trouvé' });
      // Seul l'AUTEUR du commentaire (ou un admin) peut en MODIFIER le contenu.
      // L'auteur du récit peut modérer en SUPPRIMANT (cf. DELETE), mais pas
      // réécrire les propos d'un lecteur.
      if (existing.userId !== req.user.id && req.user.role !== 'Administrateur') return res.status(403).json({ error: 'Action interdite' });
      const comment = await prisma.comment.update({ where: { id: req.params.id }, data: { content }, include: { user: true, replies: { include: { user: true } } } });
      res.json(serializeComment(comment));
    } catch (error) {
      console.error(error);
      res.status(404).json({ error: 'Commentaire non trouvé ou erreur de modification' });
    }
  });

  app.put('/api/comments/:id/like', requireAuth, async (req: any, res) => {
    try {
      const likedByMe = Boolean(req.body.likedByMe);
      const commentId = req.params.id;
      const existing = await prisma.comment.findUnique({ where: { id: commentId } });
      if (!existing) return res.status(404).json({ error: 'Commentaire non trouvé' });

      // On enregistre le like par (utilisateur, commentaire) : la contrainte
      // d'unicité rend l'opération idempotente. Un utilisateur ne peut donc plus
      // gonfler/dégonfler arbitrairement le compteur avec des +/-1 répétés.
      if (likedByMe) {
        await prisma.commentLike.upsert({
          where: { userId_commentId: { userId: req.user.id, commentId } },
          update: {},
          create: { userId: req.user.id, commentId },
        });
      } else {
        await prisma.commentLike.deleteMany({ where: { userId: req.user.id, commentId } });
      }

      // Le compteur dénormalisé est recalculé depuis la source de vérité, jamais
      // dérivé d'une valeur transmise par le client.
      const likes = await prisma.commentLike.count({ where: { commentId } });
      const comment = await prisma.comment.update({
        where: { id: commentId },
        data: { likes },
        include: { user: true, replies: { include: { user: true } } },
      });
      res.json(serializeComment(comment));
    } catch (error) {
      console.error(error);
      res.status(404).json({ error: 'Commentaire non trouvé' });
    }
  });

  app.delete('/api/comments/:id', requireAuth, async (req: any, res) => {
    try {
      const existing = await prisma.comment.findUnique({ where: { id: req.params.id }, include: { story: true } });
      if (!existing) return res.status(404).json({ error: 'Commentaire non trouvé' });
      if (existing.userId !== req.user.id && existing.story.authorId !== req.user.id && req.user.role !== 'Administrateur') return res.status(403).json({ error: 'Action interdite' });
      await prisma.comment.delete({ where: { id: req.params.id } });
      res.status(204).end();
    } catch (error) {
      console.error(error);
      res.status(404).json({ error: 'Commentaire non trouvé ou erreur de suppression' });
    }
  });

  app.post('/api/comments/:id/replies', requireAuth, async (req: any, res) => {
    try {
      const content = typeof req.body.content === 'string' ? req.body.content.trim() : '';
      if (!content) return res.status(400).json({ error: 'content est requis' });
      if (content.length > LIMITS.comment) return res.status(400).json({ error: 'Texte trop long (max 8000 caractères).' });
      // On vérifie que le commentaire parent existe AVANT d'insérer la réponse,
      // sinon Prisma lève une erreur de clé étrangère renvoyée en 500 opaque.
      const parent = await prisma.comment.findUnique({ where: { id: req.params.id }, select: { userId: true, storyId: true, chapterId: true } });
      if (!parent) return res.status(404).json({ error: 'Commentaire non trouvé' });
      const reply = await prisma.commentReply.create({ data: { commentId: req.params.id, userId: req.user.id, content }, include: { user: true } });
      if (parent.userId !== req.user.id) {
        const notification = await prisma.notification.create({
          data: {
            userId: parent.userId,
            type: 'COMMENT_REPLY' as any,
            title: 'Nouvelle réponse',
            message: 'Quelqu’un a répondu à ton commentaire.',
            data: {
              actorId: req.user.id,
              actorName: req.user.username,
              actorAvatar: req.user.avatar || '',
              storyId: parent.storyId,
              chapterId: parent.chapterId,
              commentId: req.params.id,
              excerpt: content.length > 60 ? content.slice(0, 57) + '...' : content,
            } as any
          }
        });
        notifyUser(parent.userId, notification);
      }
      res.status(201).json(serializeComment({ ...reply, replies: [] }));
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Erreur lors de la création de la réponse' });
    }
  });

  // Notifications
  app.get('/api/notifications/:userId', requireAuth, async (req: any, res) => {
    if (req.user.id !== req.params.userId && req.user.role !== 'Administrateur') return res.status(403).json({ error: 'Action interdite' });
    const notifications = await prisma.notification.findMany({ where: { userId: req.params.userId }, orderBy: { createdAt: 'desc' } });
    res.json(notifications);
  });

  app.put('/api/notifications/:id/read', requireAuth, async (req: any, res) => {
    try {
      // On vérifie l'appartenance AVANT toute écriture (sinon IDOR : on
      // marquerait comme lue la notification d'autrui).
      const existing = await prisma.notification.findUnique({ where: { id: req.params.id } });
      if (!existing) return res.status(404).json({ error: 'Notification introuvable' });
      if (existing.userId !== req.user.id && req.user.role !== 'Administrateur') {
        return res.status(403).json({ error: 'Action interdite' });
      }
      const notification = await prisma.notification.update({ where: { id: req.params.id }, data: { isRead: true } });
      res.json(notification);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Erreur lors de la mise à jour de la notification' });
    }
  });

  app.put('/api/notifications/:userId/read-all', requireAuth, async (req: any, res) => {
    if (req.user.id !== req.params.userId && req.user.role !== 'Administrateur') return res.status(403).json({ error: 'Action interdite' });
    await prisma.notification.updateMany({ where: { userId: req.params.userId, isRead: false }, data: { isRead: true } });
    res.json({ success: true });
  });

  // In-memory anti-spam rate limiter
  const lastMessageTimes = new Map<string, number>();

  // Conversations & Messages
  app.post('/api/conversations', requireAuth, async (req: any, res) => {
    try {
      const { participantIds } = req.body;

      if (!participantIds || !Array.isArray(participantIds) || participantIds.length === 0) {
        return res.status(400).json({ error: 'participantIds (tableau non vide) est requis' });
      }

      // Ensure current user is in participants
      const targetIds = Array.from(new Set([req.user.id, ...participantIds]));

      // Verify that all users exist
      const users = await prisma.user.findMany({
        where: { id: { in: targetIds } }
      });
      if (users.length !== targetIds.length) {
        console.warn(`[CONVERSATION] erreur création : certains participants n'existent pas dans targetIds: ${JSON.stringify(targetIds)}`);
        return res.status(400).json({ error: 'Un ou plusieurs participants n’existent pas' });
      }

      // Réglage « accepte les messages » + blocages : on n'autorise pas à ouvrir
      // une conversation avec un utilisateur qui les refuse ou qui est en
      // relation de blocage avec l'initiateur.
      const others = users.filter((u: any) => u.id !== req.user.id);
      for (const other of others) {
        if (other.allowMessages === false) {
          return res.status(403).json({ error: 'Cet utilisateur n’accepte pas les messages.' });
        }
        if (await blockExistsBetween(req.user.id, other.id)) {
          return res.status(403).json({ error: 'Action impossible : un blocage est actif.' });
        }
      }

      // If it's a 1-to-1 conversation, try to find an existing one
      let existingConversation: any = null;
      if (targetIds.length === 2) {
        const userConversations = await prisma.conversation.findMany({
          where: {
            participants: {
              some: { id: req.user.id }
            }
          },
          include: {
            participants: true
          }
        });

        existingConversation = userConversations.find(conv => {
          const ids = conv.participants.map(p => p.id);
          return ids.length === 2 && targetIds.every(id => ids.includes(id));
        });
      }

      if (existingConversation) {
        console.log(`[CONVERSATION] conversation existante renvoyée - conversationId: ${existingConversation.id}`);
        return res.json(existingConversation);
      }

      // Create new conversation
      const conversation = await prisma.conversation.create({
        data: {
          participants: {
            connect: targetIds.map(id => ({ id }))
          }
        },
        include: {
          participants: true
        }
      });

      // Broadcast creation to all participants
      targetIds.forEach(id => {
        io.to(`user:${id}`).emit('conversation_created', conversation);
      });

      console.log(`[CONVERSATION] conversation créée - conversationId: ${conversation.id}`);
      res.status(201).json(conversation);
    } catch (error: any) {
      console.error(`[CONVERSATION] erreur création :`, error);
      res.status(500).json({ error: `Erreur lors de la création de la conversation : ${error.message || 'erreur serveur'}` });
    }
  });

  app.get('/api/conversations', requireAuth, async (req: any, res) => {
    try {
      const conversations = await prisma.conversation.findMany({
        where: {
          participants: {
            some: { id: req.user.id }
          }
        },
        include: {
          participants: true,
          messages: {
            orderBy: { createdAt: 'desc' },
            take: 1,
            include: {
              sender: true
            }
          }
        },
        orderBy: { updatedAt: 'desc' }
      });

      // Compute unread count for each conversation
      const conversationsWithUnread = await Promise.all(
        conversations.map(async (conv) => {
          const unreadCount = await prisma.message.count({
            where: {
              conversationId: conv.id,
              senderId: { not: req.user.id },
              isRead: false
            }
          });
          return {
            ...conv,
            unreadCount
          };
        })
      );

      res.json(conversationsWithUnread);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Erreur lors de la récupération des conversations' });
    }
  });

  // Suppression d'une conversation : réservée à un participant (ou admin). Les
  // messages liés partent en cascade (onDelete: Cascade). L'autre participant
  // est notifié en temps réel pour rafraîchir sa liste.
  app.delete('/api/conversations/:id', requireAuth, async (req: any, res) => {
    try {
      const conv = await prisma.conversation.findUnique({
        where: { id: req.params.id },
        include: { participants: { select: { id: true } } },
      });
      if (!conv) return res.status(404).json({ error: 'Conversation introuvable.' });

      const isParticipant = conv.participants.some((p) => p.id === req.user.id);
      if (!isParticipant && req.user.role !== 'Administrateur') {
        return res.status(403).json({ error: 'Action interdite.' });
      }

      await prisma.conversation.delete({ where: { id: req.params.id } });

      // Notifie les autres participants (suppression côté leur app aussi).
      conv.participants
        .filter((p) => p.id !== req.user.id)
        .forEach((p) => io.to(`user:${p.id}`).emit('conversation_deleted', { conversationId: req.params.id }));

      res.status(204).end();
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Erreur lors de la suppression de la conversation.' });
    }
  });

  app.get('/api/conversations/:id/messages', requireAuth, async (req: any, res) => {
    try {
      console.log(`[CONVERSATION] accès aux messages - conversationId: ${req.params.id}, userId: ${req.user.id}`);
      const conversation = await prisma.conversation.findUnique({
        where: { id: req.params.id },
        include: { participants: true }
      });

      if (!conversation) {
        console.warn(`[CONVERSATION] erreur accès - conversationId: ${req.params.id} non trouvée`);
        return res.status(404).json({ error: 'Conversation non trouvée' });
      }

      const isParticipant = conversation.participants.some(p => p.id === req.user.id);
      if (!isParticipant && req.user.role !== 'Administrateur') {
        console.warn(`[CONVERSATION] erreur accès - conversationId: ${req.params.id}, action interdite pour userId: ${req.user.id}`);
        return res.status(403).json({ error: 'Action interdite' });
      }

      const messages = await prisma.message.findMany({
        where: { conversationId: req.params.id },
        include: {
          sender: true
        },
        orderBy: { createdAt: 'asc' }
      });

      res.json(messages);
    } catch (error) {
      console.error(`[CONVERSATION] erreur accès - conversationId: ${req.params.id}:`, error);
      res.status(500).json({ error: 'Erreur lors de la récupération des messages' });
    }
  });

  app.post('/api/messages', requireAuth, async (req: any, res) => {
    try {
      const { conversationId, content, replyToId } = req.body;
      // L'expéditeur est TOUJOURS l'utilisateur authentifié : on ignore tout
      // senderId fourni par le client (sinon usurpation d'identité possible).
      const senderId = req.user.id;

      if (!conversationId || !content) {
        console.warn(`[MESSAGE] Paramètres manquants : conversationId=${conversationId}, content=${content}`);
        return res.status(400).json({ error: 'conversationId et content sont requis' });
      }

      // Content length limit (anti-spam / validation)
      const trimmed = content.trim();
      if (!trimmed) {
        return res.status(400).json({ error: 'Le contenu du message ne peut pas être vide' });
      }
      if (trimmed.length > 2000) {
        return res.status(400).json({ error: 'Le contenu du message ne doit pas dépasser 2000 caractères' });
      }

      // Anti-spam : 1 message / 150ms par utilisateur. Cohérent multi-instances
      // via Redis (SET NX PX) ; repli en mémoire si Redis absent.
      let spamBlocked = false;
      if (redis) {
        try {
          const ok = await redis.set(`spam:msg:${req.user.id}`, '1', 'PX', 150, 'NX');
          spamBlocked = ok !== 'OK';
        } catch {
          const now = Date.now();
          spamBlocked = now - (lastMessageTimes.get(req.user.id) || 0) < 150;
          if (!spamBlocked) lastMessageTimes.set(req.user.id, now);
        }
      } else {
        const now = Date.now();
        spamBlocked = now - (lastMessageTimes.get(req.user.id) || 0) < 150;
        if (!spamBlocked) lastMessageTimes.set(req.user.id, now);
      }
      if (spamBlocked) {
        console.warn(`[MESSAGE] Bloqué par l’anti-spam - utilisateur: ${req.user.id}`);
        return res.status(429).json({ error: 'Veuillez patienter avant d’envoyer un autre message (anti-spam)' });
      }

      const conversation = await prisma.conversation.findUnique({
        where: { id: conversationId },
        include: { participants: true }
      });

      if (!conversation) {
        console.warn(`[MESSAGE] Conversation non trouvée : ${conversationId}`);
        return res.status(404).json({ error: 'Conversation non trouvée' });
      }

      const isParticipant = conversation.participants.some(p => p.id === senderId);
      if (!isParticipant) {
        console.warn(`[MESSAGE] Utilisateur ${senderId} non participant à la conversation ${conversationId}`);
        return res.status(403).json({ error: 'Action interdite' });
      }

      // Un blocage (dans un sens ou l'autre) interdit l'envoi de message.
      for (const p of conversation.participants) {
        if (p.id !== senderId && await blockExistsBetween(senderId, p.id)) {
          return res.status(403).json({ error: 'Action impossible : un blocage est actif.' });
        }
      }

      // « Remis » (2 plumes blanches) : vrai si un destinataire est en ligne au
      // moment de l'envoi (il recevra l'événement temps réel). Sinon, marqué
      // remis plus tard quand il se connecte / charge la conversation.
      const recipientOnline = conversation.participants.some(
        (p) => p.id !== senderId && onlineUsers.has(p.id)
      );

      // Create message
      let message;
      try {
        message = await prisma.message.create({
          data: {
            conversationId,
            senderId,
            content: trimmed,
            replyToId: typeof replyToId === 'string' ? replyToId : null,
            isDelivered: recipientOnline,
            isRead: false
          },
          include: {
            sender: true
          }
        });
        console.log(`[MESSAGE] sauvegarde - messageId: ${message.id}`);
      } catch (dbErr) {
        console.error(`[MESSAGE] erreur sauvegarde :`, dbErr);
        throw dbErr;
      }

      // Update conversation updatedAt timestamp
      await prisma.conversation.update({
        where: { id: conversationId },
        data: { updatedAt: new Date() }
      });

      // Find the actual sender details
      const actualSender = conversation.participants.find(p => p.id === senderId) || req.user;

      // Create system notification for all other participants and emit via socket
      await Promise.all(
        conversation.participants
          .filter(p => p.id !== senderId)
          .map(async (p) => {
            // Aperçu lisible (façon WhatsApp) : nom de l'expéditeur en titre,
            // contenu du message en corps (sticker/note vocale résumés).
            const preview = trimmed.startsWith('[sticker]')
              ? '🪶 Sticker'
              : trimmed.startsWith('[🎙️ Note Vocale')
                ? '🎙️ Note vocale'
                : (trimmed.length > 140 ? trimmed.slice(0, 137) + '…' : trimmed);
            const notification = await prisma.notification.create({
              data: {
                userId: p.id,
                type: 'MESSAGE' as any,
                title: `💬 ${actualSender.username}`,
                message: preview,
                data: {
                  actorId: actualSender.id,
                  actorName: actualSender.username,
                  actorAvatar: actualSender.avatar || '',
                  conversationId,
                  excerpt: preview,
                } as any
              }
            });
            notifyUser(p.id, notification);
          })
      );

      // Broadcast message to all conversation participants
      conversation.participants.forEach(p => {
        io.to(`user:${p.id}`).emit('new_message', message);
        console.log(`[SOCKET] message émis - conversationId: ${conversationId}, messageId: ${message.id}, destinataire: ${p.id}`);
      });

      res.status(201).json(message);
    } catch (error) {
      console.error('[MESSAGE] Erreur sauvegarde globale :', error);
      res.status(500).json({ error: 'Erreur lors de l’envoi du message' });
    }
  });

  app.put('/api/messages/read', requireAuth, async (req: any, res) => {
    try {
      const { conversationId } = req.body;
      if (!conversationId) {
        return res.status(400).json({ error: 'conversationId est requis' });
      }

      const conversation = await prisma.conversation.findUnique({
        where: { id: conversationId },
        include: { participants: true }
      });

      if (!conversation) {
        return res.status(404).json({ error: 'Conversation non trouvée' });
      }

      const isParticipant = conversation.participants.some(p => p.id === req.user.id);
      if (!isParticipant) {
        return res.status(403).json({ error: 'Action interdite' });
      }

      // Mark all messages as read
      await prisma.message.updateMany({
        where: {
          conversationId,
          senderId: { not: req.user.id },
          isRead: false
        },
        data: {
          isRead: true
        }
      });

      // Broadcast update to all participants
      conversation.participants.forEach(p => {
        io.to(`user:${p.id}`).emit('messages_read', { conversationId, readerId: req.user.id });
      });

      res.json({ success: true });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Erreur lors du marquage comme lu' });
    }
  });

  // Modifier un message TEXTE envoyé par soi, dans un délai de 5 minutes.
  app.put('/api/messages/:id', requireAuth, async (req: any, res) => {
    try {
      const msg = await prisma.message.findUnique({ where: { id: req.params.id }, include: { conversation: { include: { participants: { select: { id: true } } } } } });
      if (!msg) return res.status(404).json({ error: 'Message introuvable' });
      if (msg.senderId !== req.user.id) return res.status(403).json({ error: 'Action interdite' });
      if (msg.deletedForEveryone) return res.status(400).json({ error: 'Message supprimé' });
      if (Date.now() - new Date(msg.createdAt).getTime() > 5 * 60 * 1000) {
        return res.status(403).json({ error: 'Modification possible uniquement dans les 5 minutes.' });
      }
      const content = String(req.body?.content || '').trim();
      if (!content) return res.status(400).json({ error: 'Contenu vide.' });
      if (content.length > 2000) return res.status(400).json({ error: 'Message trop long.' });
      const updated = await prisma.message.update({ where: { id: req.params.id }, data: { content, editedAt: new Date() }, include: { sender: true } });
      msg.conversation.participants.forEach((p) => io.to(`user:${p.id}`).emit('message_updated', updated));
      res.json(updated);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Erreur lors de la modification du message' });
    }
  });

  // Supprimer un message POUR TOUT LE MONDE (uniquement ses propres messages).
  app.delete('/api/messages/:id', requireAuth, async (req: any, res) => {
    try {
      const msg = await prisma.message.findUnique({ where: { id: req.params.id }, include: { conversation: { include: { participants: { select: { id: true } } } } } });
      if (!msg) return res.status(404).json({ error: 'Message introuvable' });
      if (msg.senderId !== req.user.id) return res.status(403).json({ error: 'Action interdite' });
      // « Supprimer pour tout le monde » limite a 6 minutes apres l'envoi.
      if (Date.now() - new Date(msg.createdAt).getTime() > 6 * 60 * 1000) {
        return res.status(403).json({ error: 'Delai depasse (6 min) pour supprimer pour tout le monde' });
      }
      const updated = await prisma.message.update({ where: { id: req.params.id }, data: { deletedForEveryone: true, content: '' }, include: { sender: true } });
      msg.conversation.participants.forEach((p) => io.to(`user:${p.id}`).emit('message_updated', updated));
      res.json(updated);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Erreur lors de la suppression du message' });
    }
  });

  // ── Groupes de lecture ──────────────────────────────────────────────────────
  const GROUP_INCLUDE = {
    members: true,
    memberships: { include: { user: { select: { id: true, username: true, avatar: true, isVerified: true } } } },
    messages: { include: { sender: true }, orderBy: { createdAt: 'desc' as const }, take: 1 },
  };

  // ---- Helpers de roles/permissions de groupe -----------------------------
  // Renvoie l'adhesion (role/statut) d'un utilisateur dans un groupe.
  const getMembership = async (groupId: string, userId: string) =>
    prisma.groupMember.findUnique({ where: { groupId_userId: { groupId, userId } } });

  // Role EFFECTIF (le createur est toujours owner, meme si la ligne manque).
  const effectiveRole = async (group: any, userId: string): Promise<string | null> => {
    if (group.creatorId === userId) return 'owner';
    const gm = await getMembership(group.id, userId);
    if (!gm || gm.status !== 'active') return null;
    return gm.role || 'member';
  };

  // Garantit l'existence d'une ligne d'adhesion (utile pour les anciens groupes).
  const ensureMembership = async (groupId: string, userId: string, role: string, status = 'active') => {
    await prisma.groupMember.upsert({
      where: { groupId_userId: { groupId, userId } },
      update: { status, ...(role ? { role } : {}) },
      create: { groupId, userId, role: role || 'member', status },
    });
  };

  app.post('/api/groups', requireAuth, async (req: any, res) => {
    try {
      const { name, description, storyId, memberIds } = req.body || {};
      if (!name || !String(name).trim()) {
        return res.status(400).json({ error: 'Le nom du groupe est requis.' });
      }
      const requested = Array.isArray(memberIds) ? memberIds : [];
      const ids = Array.from(new Set([req.user.id, ...requested]));
      // On ne connecte que des membres réels.
      const users = await prisma.user.findMany({ where: { id: { in: ids } }, select: { id: true } });
      const validIds = users.map((u) => u.id);
      const group = await prisma.readingGroup.create({
        data: {
          name: String(name).trim().slice(0, 120),
          description: String(description || '').slice(0, 500),
          storyId: storyId || null,
          creatorId: req.user.id,
          members: { connect: validIds.map((id) => ({ id })) },
          // Roles : le createur est PROPRIETAIRE, les autres membres simples.
          memberships: {
            create: validIds.map((id) => ({
              userId: id,
              role: id === req.user.id ? 'owner' : 'member',
              status: 'active',
            })),
          },
        },
        include: GROUP_INCLUDE,
      });
      const serialized = serializeGroup(group);
      validIds.forEach((id) => io.to(`user:${id}`).emit('group_created', serialized));
      res.status(201).json(serialized);
    } catch (error) {
      console.error('[GROUP] création:', error);
      res.status(500).json({ error: 'Erreur lors de la création du groupe.' });
    }
  });

  app.get('/api/groups', requireAuth, async (req: any, res) => {
    try {
      const groups = await prisma.readingGroup.findMany({
        where: { members: { some: { id: req.user.id } } },
        include: GROUP_INCLUDE,
        orderBy: { updatedAt: 'desc' },
      });
      res.json(groups.map(serializeGroup));
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Erreur lors du chargement des groupes.' });
    }
  });

  app.get('/api/groups/:id/messages', requireAuth, async (req: any, res) => {
    try {
      const group = await prisma.readingGroup.findUnique({ where: { id: req.params.id }, include: { members: { select: { id: true } } } });
      if (!group) return res.status(404).json({ error: 'Groupe introuvable' });
      if (!group.members.some((m) => m.id === req.user.id)) return res.status(403).json({ error: 'Action interdite' });
      const messages = await prisma.groupMessage.findMany({
        where: { groupId: req.params.id },
        include: { sender: true, reactions: true },
        orderBy: { createdAt: 'asc' },
      });
      res.json(messages.map((m: any) => serializeGroupMessage(m, req.user.id)));
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Erreur lors du chargement des messages du groupe.' });
    }
  });

  app.post('/api/groups/:id/messages', requireAuth, async (req: any, res) => {
    try {
      const content = String(req.body?.content || '').trim();
      const replyToId = req.body?.replyToId ? String(req.body.replyToId) : null;
      const wantAnnouncement = !!req.body?.isAnnouncement;
      if (!content) return res.status(400).json({ error: 'Le contenu du message ne peut pas être vide.' });
      if (content.length > 2000) return res.status(400).json({ error: 'Message trop long (2000 caractères max).' });
      const group = await prisma.readingGroup.findUnique({ where: { id: req.params.id }, include: { members: { select: { id: true } } } });
      if (!group) return res.status(404).json({ error: 'Groupe introuvable' });
      if (!group.members.some((m) => m.id === req.user.id)) return res.status(403).json({ error: 'Action interdite' });
      const myRole = await effectiveRole(group, req.user.id);
      const isAdminPlus = groupRoleRank(myRole || 'member') >= GROUP_ROLE_RANK.admin;
      // Mode annonce : seuls les admins peuvent ecrire.
      if (group.messagePermission === 'admins' && !isAdminPlus) {
        return res.status(403).json({ error: 'Seuls les administrateurs peuvent envoyer des messages dans ce groupe.' });
      }
      // Partage de medias desactive.
      const isMedia = /^\[(img|🎙️|sticker|video|file)/i.test(content) || content.startsWith('[Image]');
      if (!group.allowMedia && isMedia) {
        return res.status(403).json({ error: 'Le partage de médias est désactivé dans ce groupe.' });
      }
      // Seuls les admins peuvent marquer un message comme annonce.
      const isAnnouncement = wantAnnouncement && isAdminPlus;
      const message = await prisma.groupMessage.create({
        data: { groupId: req.params.id, senderId: req.user.id, content, replyToId, isAnnouncement },
        include: { sender: true, reactions: true },
      });
      await prisma.readingGroup.update({ where: { id: req.params.id }, data: { updatedAt: new Date() } });
      const serialized = serializeGroupMessage(message);
      group.members.forEach((m) => io.to(`user:${m.id}`).emit('new_group_message', serialized));

      // Notification + push aux AUTRES membres (l'app peut etre fermee).
      const gPreview = content.startsWith('[sticker]')
        ? '🪶 Sticker'
        : content.startsWith('[🎙️ Note Vocale')
          ? '🎙️ Note vocale'
          : (content.length > 140 ? content.slice(0, 137) + '…' : content);
      await Promise.all(
        group.members
          .filter((m) => m.id !== req.user.id)
          .map(async (m) => {
            const notif = await prisma.notification.create({
              data: {
                userId: m.id,
                type: 'MESSAGE' as any,
                title: `👥 ${group.name}`,
                message: `${req.user.username || 'Un membre'} : ${gPreview}`,
                data: {
                  actorId: req.user.id,
                  actorName: req.user.username,
                  groupId: group.id,
                  excerpt: gPreview,
                } as any,
              },
            });
            notifyUser(m.id, notif);
          })
      );

      res.status(201).json(serialized);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Erreur lors de l’envoi du message de groupe.' });
    }
  });

  // Modifier son propre message de groupe (texte, <= 5 min).
  app.put('/api/groups/messages/:id', requireAuth, async (req: any, res) => {
    try {
      const content = String(req.body?.content || '').trim();
      if (!content) return res.status(400).json({ error: 'Contenu vide.' });
      if (content.length > 2000) return res.status(400).json({ error: 'Message trop long (2000 caractères max).' });
      const msg = await prisma.groupMessage.findUnique({ where: { id: req.params.id } });
      if (!msg) return res.status(404).json({ error: 'Message introuvable' });
      if (msg.senderId !== req.user.id) return res.status(403).json({ error: 'Action interdite' });
      if (msg.deletedForEveryone) return res.status(400).json({ error: 'Message supprimé' });
      if (Date.now() - new Date(msg.createdAt).getTime() > 5 * 60 * 1000) {
        return res.status(403).json({ error: 'Delai depasse (5 min) pour modifier' });
      }
      const updated = await prisma.groupMessage.update({ where: { id: req.params.id }, data: { content, editedAt: new Date() }, include: { sender: true } });
      const serialized = serializeGroupMessage(updated);
      const members = await getGroupMemberIds(msg.groupId);
      members.forEach((id) => io.to(`user:${id}`).emit('group_message_updated', serialized));
      res.json(serialized);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Erreur lors de la modification.' });
    }
  });

  // Supprimer pour tout le monde son propre message de groupe (<= 6 min).
  app.delete('/api/groups/messages/:id', requireAuth, async (req: any, res) => {
    try {
      const msg = await prisma.groupMessage.findUnique({ where: { id: req.params.id } });
      if (!msg) return res.status(404).json({ error: 'Message introuvable' });
      if (msg.senderId !== req.user.id) return res.status(403).json({ error: 'Action interdite' });
      if (Date.now() - new Date(msg.createdAt).getTime() > 6 * 60 * 1000) {
        return res.status(403).json({ error: 'Delai depasse (6 min) pour supprimer pour tout le monde' });
      }
      const updated = await prisma.groupMessage.update({ where: { id: req.params.id }, data: { deletedForEveryone: true, content: '' }, include: { sender: true } });
      const serialized = serializeGroupMessage(updated);
      const members = await getGroupMemberIds(msg.groupId);
      members.forEach((id) => io.to(`user:${id}`).emit('group_message_updated', serialized));
      res.json(serialized);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Erreur lors de la suppression.' });
    }
  });

  // Marque le groupe comme LU jusqu'a maintenant pour l'utilisateur courant.
  app.put('/api/groups/:id/read', requireAuth, async (req: any, res) => {
    try {
      const members = await getGroupMemberIds(req.params.id);
      if (!members.includes(req.user.id)) return res.status(403).json({ error: 'Action interdite' });
      const now = new Date();
      await prisma.groupRead.upsert({
        where: { groupId_userId: { groupId: req.params.id, userId: req.user.id } },
        update: { lastRead: now },
        create: { groupId: req.params.id, userId: req.user.id, lastRead: now },
      });
      const at = now.toISOString();
      members.forEach((id) => io.to(`user:${id}`).emit('group_read', { groupId: req.params.id, userId: req.user.id, at }));
      res.json({ success: true, at });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Erreur.' });
    }
  });

  // Etat de lecture (par membre) de TOUS les groupes de l'utilisateur.
  app.get('/api/groups/reads', requireAuth, async (req: any, res) => {
    try {
      const groups = await prisma.readingGroup.findMany({
        where: { members: { some: { id: req.user.id } } },
        select: { id: true },
      });
      const ids = groups.map((g) => g.id);
      if (!ids.length) return res.json([]);
      const reads = await prisma.groupRead.findMany({
        where: { groupId: { in: ids } },
        select: { groupId: true, userId: true, lastRead: true },
      });
      res.json(reads.map((r) => ({ groupId: r.groupId, userId: r.userId, at: r.lastRead.toISOString() })));
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Erreur.' });
    }
  });

  // Helper : renvoie le groupe (roster complet) et notifie ses membres en direct.
  const broadcastGroupUpdate = async (groupId: string) => {
    const fresh = await prisma.readingGroup.findUnique({ where: { id: groupId }, include: GROUP_INCLUDE });
    if (!fresh) return null;
    const serialized = serializeGroup(fresh);
    // On notifie aussi bien les membres actifs que les personnes en attente/bannies
    // (pour qu'elles voient leur statut evoluer).
    const ids = new Set<string>([
      ...fresh.members.map((m: any) => m.id),
      ...(fresh.memberships || []).map((gm: any) => gm.userId),
    ]);
    ids.forEach((id) => io.to(`user:${id}`).emit('group_updated', serialized));
    return serialized;
  };

  // Charge un groupe et le role effectif de l'appelant ; gere 404/403 standard.
  const loadGroupForActor = async (groupId: string, userId: string) => {
    const group = await prisma.readingGroup.findUnique({ where: { id: groupId } });
    if (!group) return { error: 404 as const };
    const role = await effectiveRole(group, userId);
    return { group, role };
  };

  const genInviteCode = () => crypto.randomBytes(6).toString('base64url');

  // GET un groupe complet (roster) — reserve aux membres actifs.
  app.get('/api/groups/:id', requireAuth, async (req: any, res) => {
    try {
      const group = await prisma.readingGroup.findUnique({ where: { id: req.params.id }, include: GROUP_INCLUDE });
      if (!group) return res.status(404).json({ error: 'Groupe introuvable' });
      if (!group.members.some((m: any) => m.id === req.user.id)) return res.status(403).json({ error: 'Action interdite' });
      res.json(serializeGroup(group));
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Erreur.' });
    }
  });

  // Modifier un groupe : infos (nom/desc/photo) + parametres (visibilite,
  // permissions, approbation...). Permissions par champ.
  app.put('/api/groups/:id', requireAuth, async (req: any, res) => {
    try {
      const { group, role, error } = await loadGroupForActor(req.params.id, req.user.id);
      if (error) return res.status(404).json({ error: 'Groupe introuvable' });
      if (!role) return res.status(403).json({ error: 'Action interdite' });
      const isAdminPlus = groupRoleRank(role) >= GROUP_ROLE_RANK.admin;
      const b = req.body || {};
      const data: any = {};

      // Infos du groupe : selon whoCanEditInfo.
      const canEditInfo = group!.whoCanEditInfo === 'all' || isAdminPlus;
      const wantsInfo = ['name', 'description', 'avatar'].some((k) => b[k] !== undefined);
      if (wantsInfo) {
        if (!canEditInfo) return res.status(403).json({ error: 'Vous n’êtes pas autorisé à modifier les infos du groupe.' });
        if (typeof b.name === 'string' && b.name.trim()) data.name = b.name.trim().slice(0, 120);
        if (typeof b.description === 'string') data.description = b.description.slice(0, 1000);
        if (typeof b.avatar === 'string') data.avatar = b.avatar;
      }

      // Parametres de gouvernance : admin minimum.
      const govKeys = ['visibility', 'whoCanEditInfo', 'messagePermission', 'allowReactions', 'allowMedia', 'requireApproval'];
      const wantsGov = govKeys.some((k) => b[k] !== undefined);
      if (wantsGov) {
        if (!isAdminPlus) return res.status(403).json({ error: 'Seuls les administrateurs peuvent modifier les paramètres.' });
        if (['public', 'private', 'invite'].includes(b.visibility)) data.visibility = b.visibility;
        if (['all', 'admins'].includes(b.whoCanEditInfo)) data.whoCanEditInfo = b.whoCanEditInfo;
        if (['all', 'admins'].includes(b.messagePermission)) data.messagePermission = b.messagePermission;
        if (typeof b.allowReactions === 'boolean') data.allowReactions = b.allowReactions;
        if (typeof b.allowMedia === 'boolean') data.allowMedia = b.allowMedia;
        if (typeof b.requireApproval === 'boolean') data.requireApproval = b.requireApproval;
      }

      if (!Object.keys(data).length) return res.json(await broadcastGroupUpdate(req.params.id));
      await prisma.readingGroup.update({ where: { id: req.params.id }, data });
      res.json(await broadcastGroupUpdate(req.params.id));
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Erreur lors de la modification du groupe.' });
    }
  });

  // Ajouter des membres directement — admin minimum.
  app.post('/api/groups/:id/members', requireAuth, async (req: any, res) => {
    try {
      const { group, role, error } = await loadGroupForActor(req.params.id, req.user.id);
      if (error) return res.status(404).json({ error: 'Groupe introuvable' });
      if (groupRoleRank(role || '') < GROUP_ROLE_RANK.admin) return res.status(403).json({ error: 'Seuls les administrateurs peuvent ajouter des membres.' });
      const ids: string[] = Array.isArray(req.body?.memberIds) ? req.body.memberIds : [];
      if (!ids.length) return res.status(400).json({ error: 'Aucun membre à ajouter.' });
      const users = await prisma.user.findMany({ where: { id: { in: ids } }, select: { id: true } });
      const validIds = users.map((u) => u.id);
      await prisma.readingGroup.update({
        where: { id: req.params.id },
        data: { members: { connect: validIds.map((id) => ({ id })) } },
      });
      for (const id of validIds) await ensureMembership(req.params.id, id, 'member', 'active');
      groupMembersCache.delete(req.params.id);
      const serialized = await broadcastGroupUpdate(req.params.id);
      // Les nouveaux membres recoivent le groupe complet (group_updated ne suffit
      // pas : le groupe n'est pas encore dans leur liste).
      validIds.forEach((id) => io.to(`user:${id}`).emit('group_created', serialized));
      res.json(serialized);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Erreur lors de l’ajout de membres.' });
    }
  });

  // Retirer / exclure un membre — admin (sur role inferieur) ; ou depart volontaire.
  app.delete('/api/groups/:id/members/:userId', requireAuth, async (req: any, res) => {
    try {
      const { group, role, error } = await loadGroupForActor(req.params.id, req.user.id);
      if (error) return res.status(404).json({ error: 'Groupe introuvable' });
      const targetId = req.params.userId;
      const isSelf = targetId === req.user.id;
      const targetRole = await effectiveRole(group!, targetId);
      if (targetId === group!.creatorId) return res.status(400).json({ error: 'Le propriétaire ne peut pas être retiré du groupe.' });
      if (!isSelf) {
        if (groupRoleRank(role || '') < GROUP_ROLE_RANK.admin) return res.status(403).json({ error: 'Action interdite.' });
        if (groupRoleRank(targetRole || 'member') >= groupRoleRank(role || '')) {
          return res.status(403).json({ error: 'Vous ne pouvez pas exclure un membre de rang égal ou supérieur.' });
        }
      }
      await prisma.readingGroup.update({ where: { id: req.params.id }, data: { members: { disconnect: { id: targetId } } } });
      await prisma.groupMember.updateMany({ where: { groupId: req.params.id, userId: targetId }, data: { status: 'removed' } });
      groupMembersCache.delete(req.params.id);
      await broadcastGroupUpdate(req.params.id);
      io.to(`user:${targetId}`).emit('group_removed', { groupId: req.params.id });
      res.status(204).end();
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Erreur lors du retrait du membre.' });
    }
  });

  // Definir le ROLE d'un membre (admin/moderateur/membre) ou TRANSFERER la propriete.
  app.post('/api/groups/:id/members/:userId/role', requireAuth, async (req: any, res) => {
    try {
      const { group, role, error } = await loadGroupForActor(req.params.id, req.user.id);
      if (error) return res.status(404).json({ error: 'Groupe introuvable' });
      const newRole = String(req.body?.role || '');
      if (!['admin', 'moderator', 'member', 'owner'].includes(newRole)) return res.status(400).json({ error: 'Rôle invalide.' });
      const targetId = req.params.userId;
      if (targetId === req.user.id) return res.status(400).json({ error: 'Vous ne pouvez pas changer votre propre rôle.' });
      const actorRank = groupRoleRank(role || '');
      if (actorRank < GROUP_ROLE_RANK.admin) return res.status(403).json({ error: 'Action interdite.' });
      const targetRole = await effectiveRole(group!, targetId);
      if (!targetRole) return res.status(404).json({ error: 'Membre introuvable.' });

      // Transfert de propriete : reserve au proprietaire.
      if (newRole === 'owner') {
        if (role !== 'owner') return res.status(403).json({ error: 'Seul le propriétaire peut transférer la propriété.' });
        await ensureMembership(req.params.id, targetId, 'owner', 'active');
        await ensureMembership(req.params.id, req.user.id, 'admin', 'active');
        await prisma.readingGroup.update({ where: { id: req.params.id }, data: { creatorId: targetId } });
        return res.json(await broadcastGroupUpdate(req.params.id));
      }

      // Nommer/retirer un ADMIN : reserve au proprietaire.
      if ((newRole === 'admin' || targetRole === 'admin') && role !== 'owner') {
        return res.status(403).json({ error: 'Seul le propriétaire peut nommer ou retirer un administrateur.' });
      }
      // On ne touche pas a un rang superieur/egal au sien (hors owner).
      if (role !== 'owner' && groupRoleRank(targetRole) >= actorRank) {
        return res.status(403).json({ error: 'Action interdite sur ce membre.' });
      }
      if (targetId === group!.creatorId) return res.status(400).json({ error: 'Le rôle du propriétaire ne peut pas être modifié.' });

      await ensureMembership(req.params.id, targetId, newRole, 'active');
      res.json(await broadcastGroupUpdate(req.params.id));
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Erreur lors du changement de rôle.' });
    }
  });

  // Bannir un membre — admin (sur rang inferieur).
  app.post('/api/groups/:id/members/:userId/ban', requireAuth, async (req: any, res) => {
    try {
      const { group, role, error } = await loadGroupForActor(req.params.id, req.user.id);
      if (error) return res.status(404).json({ error: 'Groupe introuvable' });
      const targetId = req.params.userId;
      if (targetId === group!.creatorId) return res.status(400).json({ error: 'Le propriétaire ne peut pas être banni.' });
      if (groupRoleRank(role || '') < GROUP_ROLE_RANK.admin) return res.status(403).json({ error: 'Action interdite.' });
      const targetRole = await effectiveRole(group!, targetId);
      if (groupRoleRank(targetRole || 'member') >= groupRoleRank(role || '')) return res.status(403).json({ error: 'Action interdite sur ce membre.' });
      await prisma.readingGroup.update({ where: { id: req.params.id }, data: { members: { disconnect: { id: targetId } } } });
      await ensureMembership(req.params.id, targetId, 'member', 'banned');
      groupMembersCache.delete(req.params.id);
      await broadcastGroupUpdate(req.params.id);
      io.to(`user:${targetId}`).emit('group_removed', { groupId: req.params.id });
      res.status(204).end();
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Erreur lors du bannissement.' });
    }
  });

  // Lever un bannissement (le membre n'est PAS reintegre automatiquement).
  app.post('/api/groups/:id/members/:userId/unban', requireAuth, async (req: any, res) => {
    try {
      const { role, error } = await loadGroupForActor(req.params.id, req.user.id);
      if (error) return res.status(404).json({ error: 'Groupe introuvable' });
      if (groupRoleRank(role || '') < GROUP_ROLE_RANK.admin) return res.status(403).json({ error: 'Action interdite.' });
      await prisma.groupMember.updateMany({ where: { groupId: req.params.id, userId: req.params.userId, status: 'banned' }, data: { status: 'removed' } });
      res.json(await broadcastGroupUpdate(req.params.id));
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Erreur.' });
    }
  });

  // ---- Lien d'invitation ---------------------------------------------------
  app.get('/api/groups/:id/invite', requireAuth, async (req: any, res) => {
    try {
      const { group, role, error } = await loadGroupForActor(req.params.id, req.user.id);
      if (error) return res.status(404).json({ error: 'Groupe introuvable' });
      if (groupRoleRank(role || '') < GROUP_ROLE_RANK.admin) return res.status(403).json({ error: 'Action interdite.' });
      let code = group!.inviteCode;
      if (!code) {
        code = genInviteCode();
        await prisma.readingGroup.update({ where: { id: req.params.id }, data: { inviteCode: code } });
      }
      res.json({ code, enabled: group!.inviteEnabled !== false });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Erreur.' });
    }
  });

  app.post('/api/groups/:id/invite/reset', requireAuth, async (req: any, res) => {
    try {
      const { role, error } = await loadGroupForActor(req.params.id, req.user.id);
      if (error) return res.status(404).json({ error: 'Groupe introuvable' });
      if (groupRoleRank(role || '') < GROUP_ROLE_RANK.admin) return res.status(403).json({ error: 'Action interdite.' });
      const code = genInviteCode();
      await prisma.readingGroup.update({ where: { id: req.params.id }, data: { inviteCode: code } });
      res.json({ code });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Erreur.' });
    }
  });

  app.post('/api/groups/:id/invite/toggle', requireAuth, async (req: any, res) => {
    try {
      const { role, error } = await loadGroupForActor(req.params.id, req.user.id);
      if (error) return res.status(404).json({ error: 'Groupe introuvable' });
      if (groupRoleRank(role || '') < GROUP_ROLE_RANK.admin) return res.status(403).json({ error: 'Action interdite.' });
      const enabled = !!req.body?.enabled;
      await prisma.readingGroup.update({ where: { id: req.params.id }, data: { inviteEnabled: enabled } });
      res.json({ enabled });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Erreur.' });
    }
  });

  // Apercu d'un groupe via code (avant de rejoindre).
  app.get('/api/groups/preview/:code', requireAuth, async (req: any, res) => {
    try {
      const group = await prisma.readingGroup.findUnique({ where: { inviteCode: req.params.code }, include: { members: { select: { id: true } } } });
      if (!group || group.inviteEnabled === false) return res.status(404).json({ error: 'Lien d’invitation invalide ou désactivé.' });
      res.json({ id: group.id, name: group.name, avatar: group.avatar || undefined, description: group.description || '', memberCount: group.members.length, requireApproval: !!group.requireApproval });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Erreur.' });
    }
  });

  // Rejoindre via code d'invitation.
  app.post('/api/groups/join', requireAuth, async (req: any, res) => {
    try {
      const code = String(req.body?.code || '').trim();
      if (!code) return res.status(400).json({ error: 'Code requis.' });
      const group = await prisma.readingGroup.findUnique({ where: { inviteCode: code }, include: { members: { select: { id: true } } } });
      if (!group || group.inviteEnabled === false) return res.status(404).json({ error: 'Lien d’invitation invalide ou désactivé.' });
      const existing = await getMembership(group.id, req.user.id);
      if (existing?.status === 'banned') return res.status(403).json({ error: 'Vous avez été banni de ce groupe.' });
      if (group.members.some((m: any) => m.id === req.user.id)) {
        return res.json({ status: 'member', group: serializeGroup(await prisma.readingGroup.findUnique({ where: { id: group.id }, include: GROUP_INCLUDE })) });
      }
      if (group.requireApproval) {
        await ensureMembership(group.id, req.user.id, 'member', 'pending');
        await broadcastGroupUpdate(group.id);
        return res.json({ status: 'pending' });
      }
      await prisma.readingGroup.update({ where: { id: group.id }, data: { members: { connect: { id: req.user.id } } } });
      await ensureMembership(group.id, req.user.id, 'member', 'active');
      groupMembersCache.delete(group.id);
      const serialized = await broadcastGroupUpdate(group.id);
      io.to(`user:${req.user.id}`).emit('group_created', serialized);
      res.json({ status: 'joined', group: serialized });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Erreur lors de l’adhésion.' });
    }
  });

  // Approuver / refuser une demande d'adhesion (approbation manuelle).
  app.post('/api/groups/:id/requests/:userId/approve', requireAuth, async (req: any, res) => {
    try {
      const { role, error } = await loadGroupForActor(req.params.id, req.user.id);
      if (error) return res.status(404).json({ error: 'Groupe introuvable' });
      if (groupRoleRank(role || '') < GROUP_ROLE_RANK.admin) return res.status(403).json({ error: 'Action interdite.' });
      const pending = await prisma.groupMember.findUnique({ where: { groupId_userId: { groupId: req.params.id, userId: req.params.userId } } });
      if (!pending || pending.status !== 'pending') return res.status(404).json({ error: 'Demande introuvable.' });
      await prisma.readingGroup.update({ where: { id: req.params.id }, data: { members: { connect: { id: req.params.userId } } } });
      await prisma.groupMember.update({ where: { groupId_userId: { groupId: req.params.id, userId: req.params.userId } }, data: { status: 'active' } });
      groupMembersCache.delete(req.params.id);
      const serialized = await broadcastGroupUpdate(req.params.id);
      io.to(`user:${req.params.userId}`).emit('group_created', serialized);
      res.json({ success: true });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Erreur.' });
    }
  });

  app.post('/api/groups/:id/requests/:userId/reject', requireAuth, async (req: any, res) => {
    try {
      const { role, error } = await loadGroupForActor(req.params.id, req.user.id);
      if (error) return res.status(404).json({ error: 'Groupe introuvable' });
      if (groupRoleRank(role || '') < GROUP_ROLE_RANK.admin) return res.status(403).json({ error: 'Action interdite.' });
      await prisma.groupMember.updateMany({ where: { groupId: req.params.id, userId: req.params.userId, status: 'pending' }, data: { status: 'removed' } });
      res.json(await broadcastGroupUpdate(req.params.id));
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Erreur.' });
    }
  });

  // ---- Contenu : epingles, suppression admin, reactions -------------------
  const relayMessageUpdate = async (messageId: string) => {
    const fresh = await prisma.groupMessage.findUnique({ where: { id: messageId }, include: { sender: true, reactions: true } });
    if (!fresh) return null;
    const serialized = serializeGroupMessage(fresh);
    const members = await getGroupMemberIds(fresh.groupId);
    members.forEach((id) => io.to(`user:${id}`).emit('group_message_updated', serialized));
    return serialized;
  };

  const pinHandler = (pin: boolean) => async (req: any, res: any) => {
    try {
      const msg = await prisma.groupMessage.findUnique({ where: { id: req.params.id } });
      if (!msg) return res.status(404).json({ error: 'Message introuvable' });
      const { group, role, error } = await loadGroupForActor(msg.groupId, req.user.id);
      if (error || !group) return res.status(404).json({ error: 'Groupe introuvable' });
      if (groupRoleRank(role || '') < GROUP_ROLE_RANK.moderator) return res.status(403).json({ error: 'Action interdite.' });
      await prisma.groupMessage.update({ where: { id: req.params.id }, data: { pinned: pin, pinnedAt: pin ? new Date() : null } });
      res.json(await relayMessageUpdate(req.params.id));
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Erreur.' });
    }
  };
  app.post('/api/groups/messages/:id/pin', requireAuth, pinHandler(true));
  app.post('/api/groups/messages/:id/unpin', requireAuth, pinHandler(false));

  app.get('/api/groups/:id/pinned', requireAuth, async (req: any, res) => {
    try {
      const members = await getGroupMemberIds(req.params.id);
      if (!members.includes(req.user.id)) return res.status(403).json({ error: 'Action interdite' });
      const pins = await prisma.groupMessage.findMany({ where: { groupId: req.params.id, pinned: true, deletedForEveryone: false }, include: { sender: true, reactions: true }, orderBy: { pinnedAt: 'desc' } });
      res.json(pins.map((m: any) => serializeGroupMessage(m, req.user.id)));
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Erreur.' });
    }
  });

  // Suppression de N'IMPORTE QUEL message par un moderateur/admin.
  app.delete('/api/groups/messages/:id/admin', requireAuth, async (req: any, res) => {
    try {
      const msg = await prisma.groupMessage.findUnique({ where: { id: req.params.id } });
      if (!msg) return res.status(404).json({ error: 'Message introuvable' });
      const { role, error } = await loadGroupForActor(msg.groupId, req.user.id);
      if (error) return res.status(404).json({ error: 'Groupe introuvable' });
      if (groupRoleRank(role || '') < GROUP_ROLE_RANK.moderator) return res.status(403).json({ error: 'Action interdite.' });
      await prisma.groupMessage.update({ where: { id: req.params.id }, data: { deletedForEveryone: true, deletedByAdmin: true, content: '', pinned: false } });
      res.json(await relayMessageUpdate(req.params.id));
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Erreur.' });
    }
  });

  // Reagir a un message (toggle) — si les reactions sont autorisees.
  // Supprimer un groupe entierement — reserve au proprietaire.
  app.delete('/api/groups/:id', requireAuth, async (req: any, res) => {
    try {
      const group = await prisma.readingGroup.findUnique({ where: { id: req.params.id }, include: { members: { select: { id: true } }, memberships: { select: { userId: true } } } });
      if (!group) return res.status(404).json({ error: 'Groupe introuvable' });
      if (group.creatorId !== req.user.id) return res.status(403).json({ error: 'Seul le propriétaire peut supprimer le groupe.' });
      const recipients = new Set<string>([...group.members.map((m: any) => m.id), ...group.memberships.map((g: any) => g.userId)]);
      await prisma.readingGroup.delete({ where: { id: req.params.id } });
      groupMembersCache.delete(req.params.id);
      recipients.forEach((id) => io.to(`user:${id}`).emit('group_removed', { groupId: req.params.id }));
      res.status(204).end();
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Erreur lors de la suppression du groupe.' });
    }
  });

  app.post('/api/groups/messages/:id/react', requireAuth, async (req: any, res) => {
    try {
      const emoji = String(req.body?.emoji || '').slice(0, 8);
      if (!emoji) return res.status(400).json({ error: 'Emoji requis.' });
      const msg = await prisma.groupMessage.findUnique({ where: { id: req.params.id }, include: { group: true } });
      if (!msg) return res.status(404).json({ error: 'Message introuvable' });
      const members = await getGroupMemberIds(msg.groupId);
      if (!members.includes(req.user.id)) return res.status(403).json({ error: 'Action interdite' });
      if (msg.group.allowReactions === false) return res.status(403).json({ error: 'Les réactions sont désactivées dans ce groupe.' });
      const existing = await prisma.groupMessageReaction.findUnique({ where: { messageId_userId_emoji: { messageId: req.params.id, userId: req.user.id, emoji } } });
      if (existing) {
        await prisma.groupMessageReaction.delete({ where: { id: existing.id } });
      } else {
        await prisma.groupMessageReaction.create({ data: { messageId: req.params.id, userId: req.user.id, emoji } });
      }
      res.json(await relayMessageUpdate(req.params.id));
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Erreur.' });
    }
  });

  // Follow
  app.post('/api/users/:id/follow', requireAuth, async (req: any, res) => {
    const followingId = req.params.id;
    try {
      if (followingId === req.user.id) {
        return res.status(400).json({ error: 'Tu ne peux pas te suivre toi-même' });
      }
      const target = await prisma.user.findUnique({ where: { id: followingId }, select: { whoCanFollow: true } });
      if (!target) return res.status(404).json({ error: 'Utilisateur introuvable' });
      // Réglage « Qui peut me suivre » : 'none' bloque tout nouvel abonnement.
      if (target.whoCanFollow === 'none') {
        return res.status(403).json({ error: 'Cet utilisateur n’accepte pas de nouveaux abonnés.' });
      }
      // Un blocage (dans un sens ou l'autre) interdit le suivi.
      if (await blockExistsBetween(req.user.id, followingId)) {
        return res.status(403).json({ error: 'Action impossible : un blocage est actif.' });
      }
      const alreadyFollowing = await prisma.follow.findUnique({
        where: { followerId_followingId: { followerId: req.user.id, followingId } },
        select: { id: true },
      });
      const follow = await prisma.follow.upsert({
        where: { followerId_followingId: { followerId: req.user.id, followingId } },
        update: {},
        create: { followerId: req.user.id, followingId },
      });
      // XP : nouvel abonnement uniquement (l'abonné = lecteur, le suivi = auteur).
      if (!alreadyFollowing) {
        awardXp(req.user.id, 'reader', XP.followGiven).catch(() => {});
        awardXp(followingId, 'author', XP.followerGained).catch(() => {});
      }

      const notification = await prisma.notification.create({
        data: {
          userId: followingId,
          type: 'FOLLOW' as any,
          title: 'Nouvel abonné',
          message: `@${req.user.username || 'Un utilisateur'} a commencé à te suivre.`,
          data: {
            actorId: req.user.id,
            actorName: req.user.username,
            actorAvatar: req.user.avatar || '',
          } as any
        },
      });

      notifyUser(followingId, notification);
      
      // Real-time synchronization socket events for follow
      io.to(`user:${followingId}`).emit('user_followed', { followerId: req.user.id, followingId });
      io.to(`user:${req.user.id}`).emit('user_followed', { followerId: req.user.id, followingId });

      // Fetch updated users
      const updatedCurrentUser = await prisma.user.findUnique({
        where: { id: req.user.id },
        include: { followers: true, following: true, blockedUsers: true }
      });
      const updatedTargetUser = await prisma.user.findUnique({
        where: { id: followingId },
        include: { followers: true, following: true, blockedUsers: true }
      });

      console.log(`[FOLLOW] succès de l'abonnement - followerId: ${req.user.id}, followingId: ${followingId}`);
      res.status(201).json({ 
        follow, 
        notification,
        currentUser: serializeUser(updatedCurrentUser, true),
        targetUser: serializeUser(updatedTargetUser)
      });
    } catch (error) {
      console.error(`[FOLLOW] erreur lors de l'abonnement - followerId: ${req.user.id}, followingId: ${followingId} :`, error);
      res.status(500).json({ error: "Erreur lors de l'abonnement" });
    }
  });

  app.delete('/api/users/:id/follow', requireAuth, async (req: any, res) => {
    const followingId = req.params.id;
    try {
      await prisma.follow.deleteMany({
        where: {
          followerId: req.user.id,
          followingId,
        },
      });

      // Real-time synchronization socket events for unfollow
      io.to(`user:${followingId}`).emit('user_unfollowed', { followerId: req.user.id, followingId });
      io.to(`user:${req.user.id}`).emit('user_unfollowed', { followerId: req.user.id, followingId });

      // Fetch updated users
      const updatedCurrentUser = await prisma.user.findUnique({
        where: { id: req.user.id },
        include: { followers: true, following: true, blockedUsers: true }
      });
      const updatedTargetUser = await prisma.user.findUnique({
        where: { id: followingId },
        include: { followers: true, following: true, blockedUsers: true }
      });

      console.log(`[FOLLOW] succès de désabonnement - followerId: ${req.user.id}, followingId: ${followingId}`);
      res.status(200).json({
        currentUser: serializeUser(updatedCurrentUser, true),
        targetUser: serializeUser(updatedTargetUser)
      });
    } catch (error) {
      console.error(`[FOLLOW] erreur lors du désabonnement - followerId: ${req.user.id}, followingId: ${followingId} :`, error);
      res.status(500).json({ error: 'Abonnement non trouvé' });
    }
  });

  app.get('/api/users/:id/followers', async (req, res) => {
    const target = await prisma.user.findUnique({ where: { id: req.params.id } });
    if (!target) return res.status(404).json({ error: 'Utilisateur non trouvé' });
    if (!target.showFollowers) return res.status(403).json({ error: 'La liste des abonnés est privée' });
    const followers = await prisma.follow.findMany({ where: { followingId: req.params.id }, include: { follower: true }, orderBy: { createdAt: 'desc' } });
    res.json(followers.map((f: any) => serializeUser(f.follower)));
  });

  app.get('/api/users/:id/following', async (req, res) => {
    const target = await prisma.user.findUnique({ where: { id: req.params.id } });
    if (!target) return res.status(404).json({ error: 'Utilisateur non trouvé' });
    if (!target.showFollowing) return res.status(403).json({ error: 'La liste des suivis est privée' });
    const following = await prisma.follow.findMany({ where: { followerId: req.params.id }, include: { following: true }, orderBy: { createdAt: 'desc' } });
    res.json(following.map((f: any) => serializeUser(f.following)));
  });

  // Friends
  app.post('/api/friends/request/:id', requireAuth, async (req: any, res) => {
    try {
      const receiverId = req.params.id;
      if (receiverId === req.user.id) return res.status(400).json({ error: 'Demande impossible' });
      const target = await prisma.user.findUnique({ where: { id: receiverId } });
      if (!target) return res.status(404).json({ error: 'Utilisateur introuvable' });
      const friendship = await prisma.friendship.upsert({ where: { requesterId_receiverId: { requesterId: req.user.id, receiverId } }, update: { status: 'PENDING' as any }, create: { requesterId: req.user.id, receiverId } });
      const notification = await prisma.notification.create({
        data: {
          userId: receiverId,
          type: 'FRIEND_REQUEST' as any,
          title: 'Demande d’ami',
          message: 'Tu as reçu une demande d’ami.',
          data: {
            actorId: req.user.id,
            actorName: req.user.username,
            actorAvatar: req.user.avatar || '',
          } as any
        }
      });
      notifyUser(receiverId, notification);
      res.status(201).json(friendship);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Erreur lors de l'envoi de la demande d'ami" });
    }
  });

  app.post('/api/friends/accept/:id', requireAuth, async (req: any, res) => {
    try {
      // Autorisation vérifiée AVANT modification (sinon IDOR : on pourrait
      // accepter une demande d'ami dont on n'est pas le destinataire).
      const existing = await prisma.friendship.findUnique({ where: { id: req.params.id } });
      if (!existing) return res.status(404).json({ error: 'Demande introuvable' });
      if (existing.receiverId !== req.user.id && req.user.role !== 'Administrateur') {
        return res.status(403).json({ error: 'Action interdite' });
      }
      const friendship = await prisma.friendship.update({ where: { id: req.params.id }, data: { status: 'ACCEPTED' as any } });
      const notification = await prisma.notification.create({
        data: {
          userId: friendship.requesterId,
          type: 'FRIEND_ACCEPTED' as any,
          title: 'Demande acceptée',
          message: 'Ta demande d’ami a été acceptée.',
          data: {
            actorId: req.user.id,
            actorName: req.user.username,
            actorAvatar: req.user.avatar || '',
          } as any
        }
      });
      notifyUser(friendship.requesterId, notification);
      res.json(friendship);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Erreur lors de l'acceptation de la demande" });
    }
  });

  app.post('/api/friends/reject/:id', requireAuth, async (req: any, res) => {
    try {
      const existing = await prisma.friendship.findUnique({ where: { id: req.params.id } });
      if (!existing) return res.status(404).json({ error: 'Demande introuvable' });
      if (existing.receiverId !== req.user.id && req.user.role !== 'Administrateur') {
        return res.status(403).json({ error: 'Action interdite' });
      }
      const friendship = await prisma.friendship.update({ where: { id: req.params.id }, data: { status: 'REJECTED' as any } });
      res.json(friendship);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Erreur lors du rejet de la demande' });
    }
  });

  app.get('/api/friends', requireAuth, async (req: any, res) => {
    const friendships = await prisma.friendship.findMany({
      where: { status: 'ACCEPTED' as any, OR: [{ requesterId: req.user.id }, { receiverId: req.user.id }] },
      include: { requester: true, receiver: true },
      orderBy: { updatedAt: 'desc' },
    });
    res.json(friendships.map((f: any) => serializeUser(f.requesterId === req.user.id ? f.receiver : f.requester)));
  });

  app.delete('/api/friends/:id', requireAuth, async (req: any, res) => {
    const friendship = await prisma.friendship.findUnique({ where: { id: req.params.id } });
    if (!friendship) return res.status(404).json({ error: 'Relation non trouvée' });
    if (friendship.requesterId !== req.user.id && friendship.receiverId !== req.user.id && req.user.role !== 'Administrateur') return res.status(403).json({ error: 'Action interdite' });
    await prisma.friendship.delete({ where: { id: req.params.id } });
    res.status(204).end();
  });

  // Likes and Favorites
  app.post('/api/stories/:id/like', requireAuth, async (req: any, res) => {
    try {
      const alreadyLiked = await prisma.storyLike.findUnique({ where: { userId_storyId: { userId: req.user.id, storyId: req.params.id } }, select: { id: true } });
      const like = await prisma.storyLike.upsert({ where: { userId_storyId: { userId: req.user.id, storyId: req.params.id } }, update: {}, create: { userId: req.user.id, storyId: req.params.id } });
      const story = await prisma.story.findUnique({ where: { id: req.params.id } });
      // XP : seulement à un NOUVEAU like (pas au re-like), plafonné côté donneur.
      if (!alreadyLiked && story && story.authorId !== req.user.id) {
        awardCappedXp(req.user.id, 'reader', XP.likeGiven, 'likeGiven', 20).catch(() => {});
        awardXp(story.authorId, 'author', XP.likeReceived).catch(() => {});
      }
      if (story && story.authorId !== req.user.id) {
        const notification = await prisma.notification.create({
          data: {
            userId: story.authorId,
            type: 'LIKE' as any,
            title: 'Nouveau like',
            message: 'Quelqu’un a aimé ton histoire.',
            data: {
              actorId: req.user.id,
              actorName: req.user.username,
              actorAvatar: req.user.avatar || '',
              storyId: req.params.id,
              storyTitle: story.title,
            } as any
          }
        });
        notifyUser(story.authorId, notification);
      }
      // Le total de likes reçus alimente la certification de l'auteur.
      if (story) recomputeCertification(story.authorId).catch(() => {});
      emitStoryStats(req.params.id).catch(() => {});
      res.status(201).json(like);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Erreur lors du like' });
    }
  });

  app.delete('/api/stories/:id/like', requireAuth, async (req: any, res) => {
    await prisma.storyLike.delete({ where: { userId_storyId: { userId: req.user.id, storyId: req.params.id } } }).catch(() => null);
    const story = await prisma.story.findUnique({ where: { id: req.params.id }, select: { authorId: true } });
    if (story) recomputeCertification(story.authorId).catch(() => {});
    emitStoryStats(req.params.id).catch(() => {});
    res.status(204).end();
  });

  app.get('/api/stories/:id/likes', async (req, res) => {
    const likes = await prisma.storyLike.findMany({ where: { storyId: req.params.id }, include: { user: true } });
    res.json(likes.map((l: any) => serializeUser(l.user)));
  });

  // Notation des histoires (1 à 5). La note d'une histoire (Story.rating) est la
  // MOYENNE recalculée des notes réelles — jamais une valeur fournie par le client.
  app.post('/api/stories/:id/rate', requireAuth, async (req: any, res) => {
    try {
      const value = Math.round(Number(req.body.value));
      if (!Number.isFinite(value) || value < 1 || value > 5) {
        return res.status(400).json({ error: 'La note doit être comprise entre 1 et 5.' });
      }
      const story = await prisma.story.findUnique({ where: { id: req.params.id }, select: { id: true } });
      if (!story) return res.status(404).json({ error: 'Récit non trouvé' });
      await prisma.storyRating.upsert({
        where: { userId_storyId: { userId: req.user.id, storyId: req.params.id } },
        update: { value },
        create: { userId: req.user.id, storyId: req.params.id, value },
      });
      const agg = await prisma.storyRating.aggregate({ where: { storyId: req.params.id }, _avg: { value: true }, _count: true });
      const average = agg._avg.value || 0;
      await prisma.story.update({ where: { id: req.params.id }, data: { rating: average } });
      res.json({ rating: average, count: agg._count, myRating: value });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Erreur lors de la notation.' });
    }
  });

  app.get('/api/stories/:id/rating', async (req: any, res) => {
    const agg = await prisma.storyRating.aggregate({ where: { storyId: req.params.id }, _avg: { value: true }, _count: true });
    let myRating = 0;
    const requester = await getUserFromAuthorizationHeader(req);
    if (requester) {
      const mine = await prisma.storyRating.findUnique({ where: { userId_storyId: { userId: requester.id, storyId: req.params.id } } });
      myRating = mine?.value || 0;
    }
    res.json({ rating: agg._avg.value || 0, count: agg._count, myRating });
  });

  app.post('/api/stories/:id/favorite', requireAuth, async (req: any, res) => {
    try {
      const alreadyFav = await prisma.favorite.findUnique({ where: { userId_storyId: { userId: req.user.id, storyId: req.params.id } }, select: { id: true } });
      const favorite = await prisma.favorite.upsert({ where: { userId_storyId: { userId: req.user.id, storyId: req.params.id } }, update: {}, create: { userId: req.user.id, storyId: req.params.id } });
      const story = await prisma.story.findUnique({ where: { id: req.params.id } });
      // XP : nouveau favori uniquement (action idempotente, pas de farming).
      if (!alreadyFav && story && story.authorId !== req.user.id) {
        awardXp(req.user.id, 'reader', XP.favoriteGiven).catch(() => {});
        awardXp(story.authorId, 'author', XP.favoriteReceived).catch(() => {});
      }
      if (story && story.authorId !== req.user.id) {
        const notification = await prisma.notification.create({
          data: {
            userId: story.authorId,
            type: 'FAVORITE' as any,
            title: 'Nouveau favori',
            message: 'Quelqu’un a ajouté ton histoire en favori.',
            data: {
              actorId: req.user.id,
              actorName: req.user.username,
              actorAvatar: req.user.avatar || '',
              storyId: req.params.id,
              storyTitle: story.title,
            } as any
          }
        });
        notifyUser(story.authorId, notification);
      }
      emitStoryStats(req.params.id).catch(() => {});
      res.status(201).json(favorite);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Erreur lors de l’ajout en favori' });
    }
  });

  app.delete('/api/stories/:id/favorite', requireAuth, async (req: any, res) => {
    await prisma.favorite.delete({ where: { userId_storyId: { userId: req.user.id, storyId: req.params.id } } }).catch(() => null);
    emitStoryStats(req.params.id).catch(() => {});
    res.status(204).end();
  });

  app.get('/api/me/favorites', requireAuth, async (req: any, res) => {
    const favorites = await prisma.favorite.findMany({ where: { userId: req.user.id }, include: { story: { include: { author: true, chapters: { orderBy: { order: 'asc' } }, likes: true, favorites: true } } }, orderBy: { createdAt: 'desc' } });
    res.json(favorites.map((f: any) => serializeStory(f.story)));
  });

  // Reading
  app.post('/api/stories/:id/read', requireAuth, async (req: any, res) => {
    try {
      const chapterId = req.body.chapterId || null;
      // Anti-gonflage : les compteurs ne sont incrémentés qu'une fois par
      // fenêtre glissante (6 h) et par utilisateur. L'historique de lecture,
      // lui, est toujours enregistré.
      const since = new Date(Date.now() - 6 * 60 * 60 * 1000);
      const alreadyCounted = await prisma.readingHistory.findFirst({
        where: { userId: req.user.id, storyId: req.params.id, chapterId, createdAt: { gte: since } },
        select: { id: true },
      });
      // XP lecteur : +10 à la PREMIÈRE lecture d'un chapitre (jamais rejouable).
      const everReadChapter = chapterId
        ? await prisma.readingHistory.findFirst({ where: { userId: req.user.id, storyId: req.params.id, chapterId }, select: { id: true } })
        : await prisma.readingHistory.findFirst({ where: { userId: req.user.id, storyId: req.params.id }, select: { id: true } });
      const history = await prisma.readingHistory.create({ data: { userId: req.user.id, storyId: req.params.id, chapterId } });
      if (!alreadyCounted) {
        await prisma.story.update({ where: { id: req.params.id }, data: { reads: { increment: 1 }, views: { increment: 1 } } }).catch(() => null);
        if (chapterId) await prisma.chapter.update({ where: { id: chapterId }, data: { reads: { increment: 1 }, views: { increment: 1 } } }).catch(() => null);
      }
      if (!everReadChapter) awardXp(req.user.id, 'reader', XP.readChapter).catch(() => {});
      res.status(201).json(history);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Erreur lors de l’enregistrement de la lecture' });
    }
  });

  app.get('/api/me/history', requireAuth, async (req: any, res) => {
    const history = await prisma.readingHistory.findMany({ where: { userId: req.user.id }, include: { story: { include: { author: true, chapters: { orderBy: { order: 'asc' } }, likes: true, favorites: true } }, chapter: true }, orderBy: { createdAt: 'desc' } });
    res.json(history.map((h: any) => ({ ...h, story: serializeStory(h.story), chapter: serializeChapter(h.chapter) })));
  });

  // Effacer tout l'historique de lecture de l'utilisateur courant.
  app.delete('/api/me/history', requireAuth, async (req: any, res) => {
    try {
      await prisma.readingHistory.deleteMany({ where: { userId: req.user.id } });
      res.status(204).end();
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Erreur lors de l'effacement de l'historique" });
    }
  });

  app.post('/api/chapters/:id/progress', requireAuth, async (req: any, res) => {
    try {
      const chapter = await prisma.chapter.findUnique({ where: { id: req.params.id }, include: { story: { select: { authorId: true } } } });
      if (!chapter) return res.status(404).json({ error: 'Chapitre non trouvé' });
      // Un chapitre non publié ne doit pas être lisible/traçable par autrui : on
      // renvoie 404 (sans révéler son existence ni son contenu) sauf à l'auteur.
      if (!chapter.isPublished && chapter.story?.authorId !== req.user.id && req.user.role !== 'Administrateur') {
        return res.status(404).json({ error: 'Chapitre non trouvé' });
      }
      const progressPercent = Math.min(100, Math.max(0, Number(req.body.progressPercent || 0)));
      const progress = await prisma.readingProgress.upsert({
        where: { userId_storyId_chapterId: { userId: req.user.id, storyId: chapter.storyId, chapterId: chapter.id } },
        update: { progressPercent, lastReadAt: new Date() },
        create: { userId: req.user.id, storyId: chapter.storyId, chapterId: chapter.id, progressPercent },
        include: { story: true, chapter: true },
      });
      res.json({ ...progress, story: { ...progress.story, tags: parseJsonArray(progress.story.tags) }, chapter: serializeChapter(progress.chapter) });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Erreur lors de l’enregistrement de la progression' });
    }
  });

  app.get('/api/stories/:id/progress', requireAuth, async (req: any, res) => {
    const progress = await prisma.readingProgress.findMany({ where: { userId: req.user.id, storyId: req.params.id }, include: { chapter: true }, orderBy: { lastReadAt: 'desc' } });
    res.json(progress.map((p: any) => ({ ...p, chapter: serializeChapter(p.chapter) })));
  });

  // Block users
  app.post('/api/users/:id/block', requireAuth, async (req: any, res) => {
    try {
      const blockedId = req.params.id;
      if (blockedId === req.user.id) return res.status(400).json({ error: 'Tu ne peux pas te bloquer toi-même' });
      const block = await prisma.blockedUser.upsert({
        where: { blockerId_blockedId: { blockerId: req.user.id, blockedId } },
        update: {},
        create: { blockerId: req.user.id, blockedId },
      });
      res.status(201).json(block);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Erreur lors du blocage' });
    }
  });

  app.delete('/api/users/:id/block', requireAuth, async (req: any, res) => {
    await prisma.blockedUser.deleteMany({ where: { blockerId: req.user.id, blockedId: req.params.id } });
    res.status(204).end();
  });

  app.get('/api/me/blocked', requireAuth, async (req: any, res) => {
    const blocks = await prisma.blockedUser.findMany({
      where: { blockerId: req.user.id },
      include: { blocked: true },
      orderBy: { createdAt: 'desc' },
    });
    res.json(blocks.map((b: any) => serializeUser(b.blocked)));
  });

  if (process.env.NODE_ENV !== 'test') {
    if (process.env.NODE_ENV !== 'production') {
      console.log('Mode développement : Initialisation du serveur de développement Vite...');
      const vite = await createViteServer({ server: { middlewareMode: true }, appType: 'spa' });
      app.use(vite.middlewares);
    } else {
      console.log('Mode production : Service des fichiers statiques depuis "dist"...');
      const distPath = process.cwd().endsWith('dist') ? process.cwd() : path.resolve(process.cwd(), 'dist');
      app.use(express.static(distPath));
      app.get('*', (_req, res) => res.sendFile(path.join(distPath, 'index.html')));
    }
  }

  return { app, httpServer, io };
}

if (process.env.NODE_ENV !== 'test') {
  // Garantit le compte ADMINISTRATEUR du propriétaire (gated par ADMIN_PASSWORD).
  // Exécuté DANS le process serveur au démarrage → fiable quelles que soient les
  // commandes de build / start de l'hébergeur (ne dépend ni du seed ni de tsx).
  const ensureAdminAccount = async () => {
    const password = process.env.ADMIN_PASSWORD;
    if (!password) return;
    const email = (process.env.ADMIN_EMAIL || 'udje266@gmail.com').toLowerCase();
    const passwordHash = await bcrypt.hash(password, 10);
    const profile = {
      username: process.env.ADMIN_USERNAME || 'hyde.._',
      role: 'Administrateur',
      gender: 'Homme',
      birthDate: new Date('2002-09-18'),
      emailVerified: true,
      isVerified: true,
    };
    try {
      await prisma.user.upsert({
        where: { email },
        update: { ...profile, passwordHash },
        create: { ...profile, email, passwordHash, favoriteGenres: '[]', bio: '' },
      });
      console.log(`[ADMIN] ✅ Compte administrateur garanti : ${email}`);
    } catch (e: any) {
      // Collision (ex. username déjà pris) : on garantit au moins l'accès (mot de
      // passe + rôle Administrateur) par e-mail pour que la connexion fonctionne.
      try {
        await prisma.user.updateMany({ where: { email }, data: { passwordHash, role: 'Administrateur', emailVerified: true } });
        console.log(`[ADMIN] ✅ Accès administrateur garanti (fallback) : ${email}`);
      } catch (e2: any) {
        console.error('[ADMIN] échec de la garantie du compte admin :', e2?.message || e?.message || e);
      }
    }
  };

  createServerInstance().then(({ httpServer }) => {
    const PORT = Number(process.env.PORT || 3000);
    httpServer.listen(PORT, '0.0.0.0', () => {
      console.log(`[PLUME App] Backend + Socket.io en écoute sur http://0.0.0.0:${PORT}`);
      ensureAdminAccount().catch((e) => console.error('[ADMIN] erreur :', e));
    });

    // Anti-veille (plan gratuit Render) : tant que le service est ÉVEILLÉ, il se
    // pingue lui-même via son URL PUBLIQUE toutes les ~13 min. Render compte cet
    // appel entrant et remet le minuteur d'inactivité (15 min) à zéro → le
    // service ne s'endort plus. Bien plus fiable que le cron GitHub (souvent
    // retardé/sauté). Aucune dépendance externe ni configuration requise :
    // Render fournit automatiquement RENDER_EXTERNAL_URL.
    const publicUrl = (process.env.RENDER_EXTERNAL_URL || process.env.PUBLIC_URL || '').replace(/\/+$/, '');
    if (publicUrl && process.env.NODE_ENV === 'production' && typeof fetch === 'function') {
      const KEEPALIVE_MS = 13 * 60 * 1000;
      setInterval(() => {
        fetch(`${publicUrl}/healthz`, { method: 'GET' })
          .then((r) => console.log(`[KEEPALIVE] auto-ping ${publicUrl}/healthz → ${r.status}`))
          .catch((e) => console.warn('[KEEPALIVE] auto-ping échoué :', e?.message || e));
      }, KEEPALIVE_MS).unref?.();
    }

    // Arrêt propre (redéploiements / autoscaling) : on cesse d'accepter de
    // nouvelles connexions puis on libère Prisma et Redis pour ne pas fuiter de
    // connexions à la base — critique en multi-instances.
    let shuttingDown = false;
    const shutdown = (signal: string) => {
      if (shuttingDown) return;
      shuttingDown = true;
      console.log(`[PLUME App] Arrêt (${signal})…`);
      httpServer.close(async () => {
        try { await prisma.$disconnect(); } catch { /* ignore */ }
        try { await redis?.quit(); } catch { /* ignore */ }
        process.exit(0);
      });
      // Filet de sécurité si la fermeture traîne.
      setTimeout(() => process.exit(0), 10000).unref();
    };
    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
  }).catch((err) => {
    console.error('Erreur au démarrage du serveur principal :', err);
  });
}

