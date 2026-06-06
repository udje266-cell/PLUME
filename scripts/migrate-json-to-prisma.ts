import fs from 'fs';
import path from 'path';
import bcrypt from 'bcryptjs';
import { prisma } from '../src/server/prisma';

const DB_FILE = path.join(process.cwd(), 'data', 'db.json');

function roleToPrisma(role: string | undefined) {
  if (role === 'Auteur') return 'AUTEUR' as any;
  if (role === 'Utilisateur Mixte') return 'UTILISATEUR_MIXTE' as any;
  if (role === 'Administrateur') return 'ADMINISTRATEUR' as any;
  return 'LECTEUR' as any;
}

function genderToPrisma(gender: string | undefined | null) {
  if (gender === 'Homme') return 'HOMME' as any;
  if (gender === 'Femme') return 'FEMME' as any;
  return null;
}

function storyStatusToPrisma(status: string | undefined) {
  return status === 'Publié' ? 'PUBLIE' as any : 'BROUILLON' as any;
}

async function main() {
  if (!fs.existsSync(DB_FILE)) {
    console.log('Aucun fichier data/db.json trouvé.');
    return;
  }

  const raw = fs.readFileSync(DB_FILE, 'utf-8');
  const db = JSON.parse(raw);

  console.log('Migration JSON vers Prisma...');

  for (const user of db.users ?? []) {
    await prisma.user.upsert({
      where: { id: user.id },
      update: {},
      create: {
        id: user.id,
        username: user.username ?? user.id,
        email: user.email ?? `${user.id}@plume.local`,
        passwordHash: user.password ? await bcrypt.hash(user.password, 12) : null,
        avatar: user.avatar ?? null,
        bio: user.bio ?? '',
        role: roleToPrisma(user.role),
        gender: genderToPrisma(user.gender),
        birthDate: user.birthDate ? new Date(user.birthDate) : null,
        favoriteGenres: JSON.stringify(user.favoriteGenres ?? []),
      },
    });
  }

  for (const story of db.stories ?? []) {
    if (!story.authorId) continue;

    await prisma.story.upsert({
      where: { id: story.id },
      update: {},
      create: {
        id: story.id,
        title: story.title ?? 'Sans titre',
        description: story.description ?? '',
        cover: story.cover ?? null,
        genre: story.genre ?? 'Non classé',
        category: story.category ?? null,
        ambiance: story.ambiance ?? null,
        format: story.format ?? null,
        language: story.language ?? 'fr',
        tags: JSON.stringify(story.tags ?? []),
        status: storyStatusToPrisma(story.status),
        views: story.views ?? 0,
        reads: story.reads ?? 0,
        rating: story.rating ?? 0,
        isFlagged: story.isFlagged ?? false,
        flagReason: story.flagReason ?? null,
        authorId: story.authorId,
      },
    });

    for (const chapter of story.chapters ?? []) {
      await prisma.chapter.upsert({
        where: { id: chapter.id },
        update: {},
        create: {
          id: chapter.id,
          storyId: story.id,
          title: chapter.title ?? 'Chapitre sans titre',
          content: chapter.content ?? '',
          order: chapter.order ?? 1,
          isPublished: Boolean(chapter.isPublished || chapter.status === 'Publié'),
          views: chapter.views ?? 0,
          reads: chapter.reads ?? 0,
        },
      });
    }
  }

  for (const comment of db.comments ?? []) {
    if (!comment.userId || !comment.storyId || !comment.chapterId) continue;
    await prisma.comment.upsert({
      where: { id: comment.id },
      update: {},
      create: {
        id: comment.id,
        content: comment.content ?? '',
        userId: comment.userId,
        storyId: comment.storyId,
        chapterId: comment.chapterId,
        likes: comment.likes ?? 0,
      },
    });
  }

  for (const message of db.messages ?? []) {
    if (!message.senderId || !message.receiverId) continue;
    await prisma.message.upsert({
      where: { id: message.id },
      update: {},
      create: {
        id: message.id,
        senderId: message.senderId,
        receiverId: message.receiverId,
        content: message.content ?? '',
        isRead: message.isRead ?? false,
      },
    });
  }

  console.log('Migration terminée.');
}

main()
  .catch((error) => console.error(error))
  .finally(async () => {
    await prisma.$disconnect();
  });
