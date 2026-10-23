// Données de DÉMONSTRATION pour les captures de la pub.
// À lancer depuis la racine du dépôt, contre une base PostgreSQL LOCALE
// uniquement (refus explicite de toute autre base). Les comptes sont fictifs
// (@example.invalid) ; « The Hostel » reprend le livre public du propriétaire.
import { PrismaClient } from '@prisma/client';
import assert from 'node:assert/strict';

const dbUrl = process.env.DATABASE_URL || '';
assert(['localhost', '127.0.0.1'].includes(new URL(dbUrl).hostname), 'Base locale uniquement');
const db = new PrismaClient();
const P = 'demo';
const now = Date.now();
const ago = (min) => new Date(now - min * 60000);
const days = (d) => new Date(now - d * 86400000);

const people = [
  ['ines', 'Inès Kouassi', 'Auteur', 'Lectrice de nuit, autrice à mes heures. Les histoires de mer et de mémoire me font vibrer.', '#7c3aed'],
  ['malik', 'Malik Diallo', 'Lecteur', 'Thrillers, mangas et grands romans. Toujours un livre dans le sac.', '#0e7490'],
  ['sarah', 'Sarah Ndiaye', 'Auteur', 'J’écris des cartes qui mènent ailleurs. Autrice de La Cartographe des Marées.', '#be185d'],
  ['yanis', 'Yanis Bekri', 'Auteur', 'Huis clos, suspense, nuits blanches garanties.', '#334155'],
  ['awa', 'Awa Traoré', 'Auteur', 'Romance et soleil. Dakar dans le cœur.', '#c2410c'],
  ['theo', 'Théo Martin', 'Lecteur', 'Club des Nuits Blanches 🌙', '#15803d'],
  ['chloe', 'Chloé Lambert', 'Auteur', 'Poésie, science-fiction et lettres jamais envoyées.', '#4338ca'],
  ['hyde', 'hyde.._', 'Auteur', 'Juste un mec chill qui aime écrire.', '#111827'],
];
const uid = (k) => `${P}-${k}`;

const cartographe = [
  'Ma grand-mère disait que la mer, à Grand-Bassam, savait écrire. Chaque matin, elle laissait sur le sable des lignes que personne ne savait lire. Personne, sauf elle.',
  'Le jour de ses funérailles, le notaire me tendit une enveloppe de papier épais, fermée à la cire bleue. À l’intérieur, une carte. Pas une carte de la côte, ni du pays : une carte de la marée elle-même.',
  'Les traits bougeaient. Je crus d’abord à la fatigue, au chagrin, à la lumière tremblante de la lampe à pétrole. Mais quand la marée monta, l’encre monta avec elle.',
  'Au bas de la carte, une phrase écrite de sa main penchée : « Quand l’eau se retire, cherche ce qu’elle a oublié de reprendre. »',
  'Cette nuit-là, je n’ai pas dormi. J’ai regardé la mer reculer, ligne après ligne, jusqu’à découvrir un chemin de pierres noires qui n’existait sur aucune carte du monde.',
  'Au bout du chemin, un phare. Éteint depuis cinquante ans, disaient les pêcheurs. Pourtant, une lumière brillait à sa fenêtre la plus haute.',
  'J’ai serré la carte contre ma poitrine. Elle était tiède, comme une main. Comme si, quelque part entre deux vagues, quelqu’un m’attendait encore.',
  'Alors j’ai fait ce que ma grand-mère m’avait appris à faire face à l’inconnu. J’ai retiré mes sandales, j’ai pris une grande inspiration… et j’ai marché vers la lumière.',
];
const generic = (title) => [
  `Il y a des soirs où tout bascule sans prévenir. Celui-là commença comme les autres, avec une tasse qui refroidit et une fenêtre ouverte sur la ville.`,
  `Puis vint le message. Trois mots à peine, mais assez pour que plus rien ne ressemble à avant.`,
  `On dit que chaque histoire a un seuil. Celle de « ${title} » commençait ici, sur cette ligne, au moment précis où l’on décide de tourner la page.`,
  `Et cette fois, personne ne reviendrait en arrière.`,
];

// [clé, titre, auteur, genres, description, nb chapitres, lectures, vues, couverture]
const books = [
  ['cartographe', 'La Cartographe des Marées', 'sarah', ['Fantasy', 'Aventure'], 'À la mort de sa grand-mère, Adjoua hérite d’une carte impossible : celle de la marée elle-même. Quand l’eau se retire, un chemin apparaît… et un phare éteint depuis cinquante ans se rallume.', 8, 18420, 46100],
  ['chambre', 'Chambre 317', 'yanis', ['Thriller', 'Huis clos'], 'Six inconnus se réveillent dans un hôtel fermé depuis vingt ans. Une seule chambre est ouverte. La 317.', 6, 9310, 21800],
  ['nuit', 'Ce que la nuit m’a dit', 'awa', ['Romance', 'Contemporain'], 'Deux insomniaques, une radio de nuit à Abidjan, et des confidences qu’on ne fait qu’à trois heures du matin.', 5, 12760, 30400],
  ['dakar', 'Une saison à Dakar', 'awa', ['Romance', 'Drame'], 'Un été, une librairie au bord de l’océan, et une lettre glissée dans un livre d’occasion.', 4, 7420, 15900],
  ['lunes', 'Neuf Lunes', 'chloe', ['Science-Fiction', 'Dystopie'], 'Sur Kepler-9, il fait nuit neuf mois par an. Lyra est la seule à se souvenir du soleil.', 5, 6980, 14200],
  ['sel', 'Les Héritiers du Sel', 'sarah', ['Aventure', 'Historique'], 'Tombouctou, 1590. Une caravane, un manuscrit volé, et deux frères que tout oppose.', 4, 5140, 11700],
  ['lettres', 'Petites lettres à personne', 'chloe', ['Poésie'], 'Des lettres jamais envoyées, pour tous ceux qu’on n’a pas su retenir.', 3, 4380, 8900],
  ['baobab', 'Le Silence des Baobabs', 'yanis', ['Mystère', 'Drame'], 'Dans un village du Sine-Saloum, un baobab millénaire garde un secret que personne ne veut entendre.', 4, 3960, 8100],
  ['hostel', 'The Hostel', 'hyde', ['Huis clos', 'Thriller psychologique'], 'Neil se réveille dans un hôtel qu’il est incapable de reconnaître. Une seule règle semble régir les lieux :\nChaque chambre doit rester occupée.\nÀ chaque étage, un nouveau jeu.\nPersonne ne sait qui a construit cet hôtel.', 1, 2210, 4820],
];
const chapterTitles = {
  cartographe: ['La carte qui respirait', 'Le chemin de pierres noires', 'Le phare', 'Ce que l’eau oublie', 'La gardienne', 'Marée haute', 'La dernière ligne', 'Retour à Grand-Bassam'],
};

async function main() {
  // Lecteurs « silencieux » pour donner du volume aux statistiques d'autrice.
  const crowd = Array.from({ length: 48 }, (_, i) => `crowd${String(i + 1).padStart(2, '0')}`);
  const firstNames = ['Léa', 'Moussa', 'Fatou', 'Hugo', 'Aminata', 'Lucas', 'Mariam', 'Nathan', 'Kadi', 'Emma', 'Ibrahim', 'Jade', 'Oumar', 'Lina', 'Yao', 'Zoé'];

  for (const [k, name, role, bio, color] of people) {
    await db.user.create({ data: {
      id: uid(k), username: name, email: `${k}@example.invalid`, role, bio,
      avatar: `/promo-demo/avatar-${k}.svg`, emailVerified: true, isVerified: ['sarah', 'awa'].includes(k),
      favoriteGenres: JSON.stringify(['Fantasy', 'Romance', 'Thriller']), birthDate: new Date('1998-03-14'), gender: k === 'ines' ? 'Femme' : null,
      showBooksRead: true, showBooksWritten: true, readerXp: k === 'ines' ? 2460 : 320, authorXp: k === 'ines' ? 940 : 410,
      banner: k === 'ines' ? '/promo-demo/cover-cartographe.png' : null,
      stats: k === 'ines' ? { chaptersRead: 132, commentsPosted: 38, likesGiven: 214, favoritesAdded: 17, activeDays: 64, completedReadCycles: 9, wordsWritten: 26500, storiesCreated: 2, chaptersPublished: 4, viewsReceived: 1830, likesReceived: 146, decorChanges: 4, genresReadCount: 8, authorsFollowedCount: 7 } : undefined,
    } });
  }
  for (const [i, k] of crowd.entries()) {
    await db.user.create({ data: { id: uid(k), username: `${firstNames[i % firstNames.length]} ${String.fromCharCode(65 + (i % 26))}.`, email: `${k}@example.invalid`, role: 'Lecteur', emailVerified: true } });
  }

  for (const [k, title, author, genres, description, nCh, reads, views] of books) {
    const id = uid(k);
    await db.story.create({ data: {
      id, title, description, authorId: uid(author), genre: genres[0], genres: JSON.stringify(genres),
      cover: `/promo-demo/cover-${k}.png`, status: 'PUBLIE', featured: k === 'cartographe', reads, views,
      rating: 4.7, ageRating: k === 'chambre' || k === 'hostel' ? '12' : 'ALL', publishedAt: days(30 + nCh), createdAt: days(40 + nCh),
      tags: JSON.stringify(k === 'cartographe' ? ['mer', 'mémoire', 'Côte d’Ivoire'] : []),
    } });
    for (let j = 0; j < nCh; j++) {
      const t = chapterTitles[k]?.[j] || `Chapitre ${j + 1}`;
      await db.chapter.create({ data: {
        id: `${id}-ch${j + 1}`, storyId: id, title: t, order: j + 1, isPublished: true, publishedAt: days(30 - j * 3),
        content: (k === 'cartographe' && j === 0 ? cartographe : generic(title)).join('\n\n'), views: Math.round(views / (j + 2)), reads: Math.round(reads / (j + 2)),
      } });
    }
  }

  // Le roman d'Inès : publié (3 chapitres) + un chapitre en brouillon.
  const mine = uid('etoiles');
  await db.story.create({ data: {
    id: mine, title: 'Ce que les étoiles taisent', authorId: uid('ines'), genre: 'Fantastique', genres: JSON.stringify(['Fantastique', 'Contemporain']),
    description: 'Chaque nuit, une étoile s’éteint au-dessus d’Abidjan. Nadia est la seule à remarquer qu’elles s’éteignent dans l’ordre de son carnet.',
    cover: '/promo-demo/cover-etoiles.png', status: 'PUBLIE', reads: 1284, views: 3420, publishedAt: days(12), createdAt: days(20),
  } });
  const mineCh = ['La première étoile', 'Le carnet', 'Ce que les étoiles taisent', 'Nuit sans lune'];
  for (let j = 0; j < 4; j++) {
    await db.chapter.create({ data: { id: `${mine}-ch${j + 1}`, storyId: mine, title: mineCh[j], order: j + 1, isPublished: j < 3, publishedAt: j < 3 ? days(12 - j * 4) : null,
      content: (j === 3 ? ['Cette nuit-là, il n’y eut pas de lune.', 'Nadia ouvrit son carnet à la dernière page, et retint son souffle.'] : generic('Ce que les étoiles taisent')).join('\n\n'), views: [940, 610, 520, 0][j], reads: [610, 402, 272, 0][j] } });
  }
  // Un second projet tout neuf, en brouillon.
  await db.story.create({ data: { id: uid('brouillon'), title: 'La Maison aux Mille Fenêtres', authorId: uid('ines'), genre: 'Mystère', genres: JSON.stringify(['Mystère']), description: 'Une maison, mille fenêtres, et une seule qui reste allumée.', cover: '/promo-demo/cover-maison.png', status: 'BROUILLON', createdAt: days(2) } });
  await db.chapter.create({ data: { id: `${uid('brouillon')}-ch1`, storyId: uid('brouillon'), title: 'La fenêtre allumée', order: 1, isPublished: false, content: 'Tout le quartier savait que la maison était vide.\n\nAlors pourquoi, chaque soir à 22 h, une fenêtre s’allumait-elle au troisième étage ?' } });

  // Télémétrie de lecture du roman d'Inès (lecteurs fictifs) → entonnoir et décrochage.
  const startersPerCh = [46, 34, 31];
  const finishersPerCh = [38, 30, 19];
  for (let j = 0; j < 3; j++) {
    const chId = `${mine}-ch${j + 1}`;
    for (let r = 0; r < startersPerCh[j]; r++) {
      const userId = uid(crowd[r]);
      await db.readingEvent.create({ data: { userId, storyId: mine, chapterId: chId, type: 'read_start', createdAt: days(5 - (r % 5)) } });
      const done = r < finishersPerCh[j];
      await db.readingEvent.create({ data: { userId, storyId: mine, chapterId: chId, type: 'read_end', payload: { percent: done ? 100 : 40, dwellMs: done ? 540000 + r * 4000 : 160000, wpm: 230 }, createdAt: days(5 - (r % 5)) } });
      if (done) await db.chapterRead.create({ data: { userId, storyId: mine, chapterId: chId } });
    }
  }
  // Abonnés d'Inès.
  for (const k of [...crowd.slice(0, 40), 'malik', 'sarah', 'theo', 'awa', 'chloe']) await db.follow.create({ data: { followerId: uid(k), followingId: uid('ines') } });
  for (const k of ['malik', 'sarah', 'theo', 'awa', 'chloe', 'yanis']) await db.follow.create({ data: { followerId: uid('ines'), followingId: uid(k) } });
  // Commentaires sur le roman d'Inès.
  for (const [k, txt, p] of [['malik', 'Le coup du carnet… j’en ai eu des frissons 😳', 2], ['sarah', 'Ta plume est magnifique. Vivement le chapitre 4 !', 0], ['theo', 'Nadia, c’est moi à 3 h du matin 😂', 1]]) {
    await db.comment.create({ data: { storyId: mine, chapterId: `${mine}-ch3`, userId: uid(k), content: txt, paragraphIndex: p, likes: 12 } });
  }

  // Lecture d'Inès.
  const lists = { currently: ['cartographe', 'chambre', 'hostel'], later: ['lunes', 'dakar', 'baobab'], completed: ['nuit', 'lettres'] };
  for (const [list, keys] of Object.entries(lists)) for (const k of keys) await db.readingListEntry.create({ data: { userId: uid('ines'), storyId: uid(k), list } });
  for (const k of ['cartographe', 'nuit', 'lettres', 'chambre']) await db.favorite.create({ data: { userId: uid('ines'), storyId: uid(k) } });
  for (const [k, ch, pct, para, at] of [['cartographe', 1, 62, 4, 30], ['chambre', 2, 35, 1, 600], ['hostel', 1, 18, 1, 1500]]) {
    await db.readingProgress.create({ data: { userId: uid('ines'), storyId: uid(k), chapterId: `${uid(k)}-ch${ch}`, progressPercent: pct, paragraphIndex: para, lastReadAt: ago(at) } });
    await db.readingHistory.create({ data: { userId: uid('ines'), storyId: uid(k), chapterId: `${uid(k)}-ch${ch}`, createdAt: ago(at) } });
  }
  for (const k of ['nuit', 'lettres']) for (let j = 1; j <= (k === 'nuit' ? 5 : 3); j++) await db.chapterRead.create({ data: { userId: uid('ines'), storyId: uid(k), chapterId: `${uid(k)}-ch${j}` } });
  for (const [name, keys] of [['Lectures du soir', ['cartographe', 'nuit', 'lunes']], ['Coups de cœur', ['nuit', 'lettres', 'cartographe', 'dakar']], ['Frissons garantis', ['chambre', 'hostel', 'baobab']]]) {
    await db.bookCollection.create({ data: { userId: uid('ines'), name, books: { create: keys.map((k) => ({ storyId: uid(k) })) } } });
  }

  // Passages et commentaires sur La Cartographe (chapitre 1).
  const c1 = `${uid('cartographe')}-ch1`;
  for (const [k, txt, p, likes, reply] of [
    ['malik', 'L’encre qui monte avec la marée… quelle image 🌊', 2, 48, ['sarah', 'Merci Malik ! Attends de voir le chapitre 3 😉']],
    ['theo', 'J’ai relu ce passage trois fois. Le phare ALLUMÉ ?!', 5, 31, null],
    ['awa', 'Cette phrase de la grand-mère me reste en tête depuis hier.', 3, 57, ['ines', 'Pareil, je l’ai mise en citation 💜']],
    ['chloe', 'On sent le sel et le vent. Superbe.', 0, 22, null],
    ['yanis', 'Le dernier paragraphe 😭', 7, 19, null],
  ]) {
    await db.comment.create({ data: { storyId: uid('cartographe'), chapterId: c1, userId: uid(k), content: txt, paragraphIndex: p, likes, createdAt: ago(200 + likes),
      ...(reply ? { replies: { create: { userId: uid(reply[0]), content: reply[1] } } } : {}) } });
  }
  for (const k of crowd.slice(0, 26)) await db.passageLike.create({ data: { userId: uid(k), storyId: uid('cartographe'), chapterId: c1, paragraphIndex: 3 } }).catch(() => {});
  await db.passageNote.create({ data: { userId: uid('ines'), storyId: uid('cartographe'), chapterId: c1, paragraphIndex: 3, color: 'violet', note: 'Ce que l’eau oublie… à garder pour mon roman ✨' } });

  // Messages privés.
  const share = (k) => '[plume-share]' + JSON.stringify({ kind: 'book', storyId: uid(k) });
  const conv = uid('conv-malik');
  await db.conversation.create({ data: { id: conv, participants: { connect: [{ id: uid('ines') }, { id: uid('malik') }] } } });
  const msgs = [
    ['malik', 'Tu lis quoi en ce moment ? 👀', 34],
    ['ines', 'La Cartographe des Marées. Je n’arrive plus à m’arrêter 😭', 33],
    ['ines', share('cartographe'), 33],
    ['malik', 'Ok la couverture… je commence ce soir !', 32],
    ['malik', '||Le phare au chapitre 1… il est ALLUMÉ ?!||', 6],
    ['ines', '[🎙️ Note Vocale - 0:14|/promo-demo/voice.mp3]', 4],
  ];
  for (const [i, [k, content, m]] of msgs.entries()) await db.message.create({ data: { id: `${conv}-${i}`, conversationId: conv, senderId: uid(k), content, createdAt: ago(m), isDelivered: true, isRead: true } });
  await db.messageReaction.create({ data: { messageId: `${conv}-4`, userId: uid('ines'), emoji: '😱' } });
  for (const [k, text, m] of [['sarah', 'Merci pour ton commentaire sur le chapitre 2 💜', 55], ['awa', 'Ton chapitre 3 m’a mis la chair de poule !', 140], ['theo', 'Club ce soir 21 h ? 🌙', 300], ['chloe', 'Je t’envoie ma nouvelle poésie demain ✨', 900]]) {
    const id = uid(`conv-${k}`);
    await db.conversation.create({ data: { id, participants: { connect: [{ id: uid('ines') }, { id: uid(k) }] }, messages: { create: { senderId: uid(k), content: text, createdAt: ago(m) } } } });
  }
  await db.conversationPin.create({ data: { userId: uid('ines'), conversationId: conv } });

  // Club de lecture.
  const club = uid('club');
  const members = ['ines', 'malik', 'sarah', 'theo', 'awa', 'chloe', 'yanis'];
  await db.readingGroup.create({ data: {
    id: club, name: 'Les Nuits Blanches', description: 'On lit ensemble, on débat, on ne dort pas.', creatorId: uid('ines'), storyId: uid('cartographe'), avatar: '/promo-demo/cover-cartographe.png',
    members: { connect: members.map((k) => ({ id: uid(k) })) }, memberships: { create: members.map((k) => ({ userId: uid(k), role: k === 'ines' ? 'owner' : 'member' })) },
  } });
  const gm = [
    ['sarah', '📢 Ce soir 21 h : on attaque le chapitre 4 ensemble !', 120, { isAnnouncement: true, pinned: true }],
    ['theo', 'J’ai déjà les biscuits et le thé 🍵', 95],
    ['ines', '[poll]' + JSON.stringify({ q: 'Notre prochaine lecture ?', o: ['Chambre 317', 'Neuf Lunes', 'Une saison à Dakar'] }), 80],
    ['awa', share('dakar'), 60],
    ['malik', '||La gardienne du phare, c’est sa grand-mère. J’en suis sûr.||', 20],
    ['chloe', 'Malik 😭 on avait dit pas de spoil !', 18],
  ];
  for (const [i, [k, content, m, extra]] of gm.entries()) await db.groupMessage.create({ data: { id: `${club}-m${i}`, groupId: club, senderId: uid(k), content, createdAt: ago(m), ...(extra || {}) } });
  for (const [k, o] of [['malik', 0], ['theo', 0], ['awa', 2], ['chloe', 1], ['yanis', 0], ['sarah', 1]]) await db.groupPollVote.create({ data: { messageId: `${club}-m2`, userId: uid(k), optionIndex: o } });

  // Les autres membres lisent en ce moment (lecture en direct).
  for (const [k, ch, pct, para] of [['malik', 1, 74, 5], ['theo', 2, 38, 2], ['awa', 1, 92, 7]]) {
    await db.readingProgress.create({ data: { userId: uid(k), storyId: uid('cartographe'), chapterId: `${uid('cartographe')}-ch${ch}`, progressPercent: pct, paragraphIndex: para, lastReadAt: ago(1) } });
  }

  // Notifications.
  for (const [type, title, message, m, actor] of [
    ['NEW_CHAPTER', 'Nouveau chapitre', 'Sarah Ndiaye a publié « Le phare » dans La Cartographe des Marées.', 8, 'sarah'],
    ['COMMENT', 'Nouveau commentaire', 'Malik Diallo a commenté ton chapitre « Ce que les étoiles taisent ».', 26, 'malik'],
    ['FOLLOW', 'Nouvel abonné', 'Théo Martin s’est abonné à toi.', 90, 'theo'],
    ['LIKE', 'J’aime', 'Awa Traoré aime ta citation.', 140, 'awa'],
  ]) await db.notification.create({ data: { userId: uid('ines'), type, title, message, createdAt: ago(m), data: { actorId: uid(actor), actorName: people.find((p) => p[0] === actor)[1], actorAvatar: `/promo-demo/avatar-${actor}.svg` } } });

  // Notifications d'un abonné (Malik) ; la publication du chapitre 4 pendant les
  // captures ajoute la vraie notification « Nouveau chapitre ».
  await db.notification.create({ data: { userId: uid('malik'), type: 'COMMENT_REPLY', title: 'Nouvelle réponse', message: 'Sarah Ndiaye a répondu à ton commentaire sur La Cartographe des Marées.', isRead: true, createdAt: ago(50), data: { actorId: uid('sarah'), actorName: 'Sarah Ndiaye', actorAvatar: '/promo-demo/avatar-sarah.svg' } } });
  await db.notification.create({ data: { userId: uid('malik'), type: 'LIKE', title: 'J’aime', message: 'Théo Martin aime ton commentaire.', isRead: true, createdAt: ago(120), data: { actorId: uid('theo'), actorName: 'Théo Martin', actorAvatar: '/promo-demo/avatar-theo.svg' } } });
  console.log('SEED OK');
}

main().catch((e) => { console.error(e); process.exitCode = 1; }).finally(() => db.$disconnect());
