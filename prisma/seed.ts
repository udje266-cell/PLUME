/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Seed de démarrage (production friendly).
 *
 * Objectif : éviter qu'une instance fraîchement déployée n'ouvre sur un écran
 * vide (mauvaise première impression + risque de refus stores). On crée
 * quelques auteurs et récits publiés, avec chapitres et un peu d'engagement.
 *
 * IDEMPOTENT : si des récits existent déjà, le script ne fait rien. Les comptes
 * sont upsertés par e-mail. À lancer manuellement :
 *
 *   DATABASE_URL="<url_prod>" npm run db:seed
 *
 * Les comptes de démonstration partagent le mot de passe « Plume!Demo2026 ».
 * Pense à retirer/éditer ce contenu de démo avant l'ouverture publique réelle.
 */

import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const DEMO_PASSWORD = 'Plume!Demo2026';
const avatar = (id: string) => `https://images.unsplash.com/${id}?w=240&h=240&fit=crop&crop=faces&q=80`;
const cover = (id: string) => `https://images.unsplash.com/${id}?w=600&h=900&fit=crop&q=80`;

const DAY = 86_400_000;

async function main() {
  const existingStories = await prisma.story.count();
  if (existingStories > 0) {
    console.log(`[seed] ${existingStories} récit(s) déjà présents — seed ignoré (idempotent).`);
    return;
  }

  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);
  const now = Date.now();

  const upsertUser = (data: {
    username: string; email: string; role: string; bio?: string;
    avatarId?: string; isVerified?: boolean; favoriteGenres?: string[];
  }) =>
    prisma.user.upsert({
      where: { email: data.email.toLowerCase() },
      update: {},
      create: {
        username: data.username,
        email: data.email.toLowerCase(),
        passwordHash,
        role: data.role,
        bio: data.bio ?? '',
        avatar: data.avatarId ? avatar(data.avatarId) : null,
        isVerified: data.isVerified ?? false,
        favoriteGenres: JSON.stringify(data.favoriteGenres ?? []),
      },
    });

  const elena = await upsertUser({ username: 'Elena_Verne', email: 'elena.demo@plume.app', role: 'Auteur', isVerified: true, avatarId: 'photo-1494790108377-be9c29b29330', bio: 'Autrice de mondes imaginaires. Plume au clair de lune.' });
  const marcus = await upsertUser({ username: 'Marcus_Cole', email: 'marcus.demo@plume.app', role: 'Auteur', isVerified: true, avatarId: 'photo-1500648767791-00dcc994a43e', bio: 'Thrillers et science-fiction noire.' });
  const aria = await upsertUser({ username: 'Aria_Sol', email: 'aria.demo@plume.app', role: 'Auteur', isVerified: false, avatarId: 'photo-1534528741775-53994a69daeb', bio: 'Romance, contemplation et embruns.' });
  const lecteurs = await Promise.all([
    upsertUser({ username: 'Theo_M', email: 'theo.demo@plume.app', role: 'Lecteur', avatarId: 'photo-1507003211169-0a1dd7228f2d' }),
    upsertUser({ username: 'Sara_B', email: 'sara.demo@plume.app', role: 'Lecteur', avatarId: 'photo-1544005313-94ddf0286df2' }),
    upsertUser({ username: 'Lina_K', email: 'lina.demo@plume.app', role: 'Lecteur', avatarId: 'photo-1438761681033-6461ffad8d80' }),
  ]);

  const chapterText = (title: string) =>
    `${title}\n\nLe vent se leva sur les dunes pâles, portant l'odeur du sel et des promesses anciennes. ` +
    `Kaela referma son carnet, le cœur battant au rythme des marées invisibles.\n\n` +
    `Elle savait que franchir la crête signifiait ne jamais revenir. Pourtant, une lueur l'appelait ` +
    `depuis l'enfance. Elle posa la main sur la pierre tiède et respira.\n\n` +
    `« Que la plume me guide », souffla-t-elle, avant de s'élancer vers l'inconnu.`;

  async function createStory(author: { id: string }, d: {
    title: string; desc: string; coverId: string; genre: string;
    tags: string[]; reads: number; rating: number; ageDays: number;
  }) {
    const story = await prisma.story.create({
      data: {
        title: d.title, description: d.desc, cover: cover(d.coverId), genre: d.genre,
        category: 'Roman', ambiance: 'Épique', tags: JSON.stringify(d.tags),
        status: 'PUBLIE', ageRating: 'ALL', reads: d.reads, rating: d.rating,
        publishedAt: new Date(now - d.ageDays * DAY), authorId: author.id,
      },
    });
    await prisma.chapter.create({ data: { storyId: story.id, title: 'Chapitre I — Le Seuil', content: chapterText(d.title), order: 1, isPublished: true, publishedAt: new Date(now - d.ageDays * DAY) } });
    await prisma.chapter.create({ data: { storyId: story.id, title: 'Chapitre II — La Crête', content: chapterText('La Crête'), order: 2, isPublished: true, publishedAt: new Date(now - (d.ageDays - 1) * DAY) } });
    return story;
  }

  const stories = [
    await createStory(elena, { title: 'Les Sables de Kael', desc: 'Une cartographe traverse un désert qui efface les souvenirs.', coverId: 'photo-1470071459604-3b5ec3a7fe05', genre: 'Fantasy', tags: ['aventure', 'désert', 'magie'], reads: 18420, rating: 4.7, ageDays: 2 }),
    await createStory(elena, { title: 'Néon Mémoire', desc: 'Une hackeuse vend ses propres souvenirs sous la pluie de néons.', coverId: 'photo-1545972154-9bb223aac798', genre: 'Science-Fiction', tags: ['cyberpunk', 'IA'], reads: 9310, rating: 4.5, ageDays: 6 }),
    await createStory(aria, { title: "L'Écho des Marées", desc: 'Deux âmes reliées par une lettre échouée sur le rivage.', coverId: 'photo-1505142468610-359e7d316be0', genre: 'Romance', tags: ['mer', 'lettres'], reads: 4120, rating: 4.3, ageDays: 14 }),
    await createStory(marcus, { title: 'Dossier 17', desc: 'Une inspectrice exhume une affaire que tous voulaient oublier.', coverId: 'photo-1509248961158-e54f6934749c', genre: 'Thriller', tags: ['enquête', 'suspense'], reads: 25600, rating: 4.8, ageDays: 1 }),
    await createStory(marcus, { title: 'La Dernière Comète', desc: 'Le dernier équipage humain file vers une lumière mourante.', coverId: 'photo-1462331940025-496dfbfc7564', genre: 'Science-Fiction', tags: ['espace', 'huis-clos'], reads: 7700, rating: 4.4, ageDays: 8 }),
    await createStory(aria, { title: "Brumes d'Ardenne", desc: 'Un village se réveille sans ombres. Et sans mémoire.', coverId: 'photo-1418065460487-3e41a6c84dc5', genre: 'Horreur', tags: ['mystère', 'village'], reads: 3300, rating: 4.1, ageDays: 20 }),
  ];

  // Engagement (likes / favoris / notes) pour des tendances crédibles.
  const everyone = [...lecteurs, elena, marcus, aria];
  async function engage(story: { id: string; rating: number }, likers: { id: string }[], favers: { id: string }[]) {
    for (const u of likers) await prisma.storyLike.create({ data: { userId: u.id, storyId: story.id } }).catch(() => {});
    for (const u of favers) await prisma.favorite.create({ data: { userId: u.id, storyId: story.id } }).catch(() => {});
    for (const u of everyone) await prisma.storyRating.create({ data: { userId: u.id, storyId: story.id, value: Math.round(story.rating) } }).catch(() => {});
  }
  await engage(stories[0], lecteurs, [lecteurs[0]]);
  await engage(stories[3], [...lecteurs, elena], [lecteurs[1]]);
  await engage(stories[1], [lecteurs[0], lecteurs[2]], []);
  await engage(stories[4], [lecteurs[1]], []);

  // Quelques abonnements + un commentaire.
  await prisma.follow.create({ data: { followerId: lecteurs[0].id, followingId: elena.id } }).catch(() => {});
  await prisma.follow.create({ data: { followerId: lecteurs[1].id, followingId: marcus.id } }).catch(() => {});
  const ch = await prisma.chapter.findFirst({ where: { storyId: stories[0].id, order: 1 } });
  if (ch) await prisma.comment.create({ data: { storyId: stories[0].id, chapterId: ch.id, userId: lecteurs[0].id, content: "Quelle ouverture magistrale ! J'ai dévoré ce chapitre." } });

  const users = await prisma.user.count();
  const total = await prisma.story.count();
  console.log(`[seed] OK — ${users} utilisateurs, ${total} récits publiés.`);
}

main()
  .catch((e) => { console.error('[seed] échec :', e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
