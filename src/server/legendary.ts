/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * ════════════════════════════════════════════════════════════════════════════
 *  TROPHEES LEGENDAIRES & SECRETS DE PLUME — LOGIQUE 100 % SERVEUR
 * ════════════════════════════════════════════════════════════════════════════
 *
 * Ce module est le SEUL endroit ou vivent les conditions d'obtention des
 * trophees legendaires et secrets. Il est importe UNIQUEMENT par `server.ts`
 * (compile a part par esbuild) et JAMAIS par du code client (bundle Vite) :
 * les seuils, formules et combinaisons secretes ne se retrouvent donc ni dans
 * le JavaScript telecharge par le navigateur/l'app, ni dans aucune reponse API,
 * ni dans le stockage local, ni dans une donnee accessible cote utilisateur.
 *
 * Garanties de confidentialite (voir aussi les projections plus bas) :
 *   - Un trophee SECRET verrouille est totalement absent des reponses API :
 *     invisible, non compte, sans indice, sans progression, sans compteur.
 *   - Un trophee VISIBLE mais a condition cachee expose son nom/icone/rarete,
 *     mais JAMAIS le seuil chiffre ni la formule (seulement une description
 *     poetique volontairement vague).
 *   - Les conditions exactes ne sont exposees qu'aux ADMINISTRATEURS via
 *     `adminProjection` (endpoint admin dedie), jamais autrement.
 *   - L'evaluation se fait exclusivement ici, cote serveur, sur des donnees
 *     autoritatives (Prisma). Le client ne fait qu'AFFICHER ce que le serveur
 *     a deja tranche.
 *
 * EXTENSIBILITE : pour ajouter un nouveau trophee (legendaire ou secret), il
 * suffit d'ajouter une entree dans `LEGENDARY_DEFS`. Rien d'autre dans le
 * systeme principal (les 125 succes lecteur / 100 succes auteur) n'est touche.
 */

import { prisma } from './prisma';
import {
  coversAllGenres,
  hasCompletedOldWork,
  hasWeeklyStreak,
  hasFlawlessWork,
  hasLivingUniverse,
  yearsBetween,
} from './legendaryLogic';

// Genres canoniques de PLUME (miroir de src/data.ts GENRES). Sert de reference
// a « couvrir tous les genres ». Duplique ici volontairement pour garder ce
// module serveur autonome (ne pas importer les gros mocks de data.ts).
const ALL_GENRES = [
  'Science-Fiction', 'Thriller & Policier', 'Romance', 'Fantasy', 'Réaliste',
  'Drame', 'Poésie', 'Historique', 'Action', 'Mystère', 'Aventure', 'Surnaturel',
];

export type LegendaryRarity = 'legendaire' | 'divin';
export type LegendaryCategory = 'reader' | 'author';

export interface LegendaryDef {
  id: string;
  name: string;
  icon: string; // emoji affiche
  rarity: LegendaryRarity;
  category: LegendaryCategory;
  /** true => totalement cache tant que non debloque (Divins). */
  secret: boolean;
  /** Description PUBLIQUE volontairement vague pour les trophees VISIBLES
   *  verrouilles : elle ne revele jamais le seuil chiffre. */
  publicDescription: string;
  /** Texte poetique affiche APRES obtention (ne revele pas la condition). */
  flavor: string;
  /** Condition EXACTE — reservee aux administrateurs autorises. */
  adminCondition: string;
  /** Predicat serveur : l'utilisateur remplit-il la condition ? */
  evaluate: (ctx: EvalContext) => Promise<boolean>;
}

/**
 * Contexte d'evaluation : agrege paresseusement (et une seule fois) les donnees
 * autoritatives couteuses, partagees par plusieurs trophees.
 */
export class EvalContext {
  readonly userId: string;
  readonly nowMs: number;
  private _reader?: Promise<ReaderAggregate>;
  private _author?: Promise<AuthorAggregate>;
  private _user?: Promise<{ createdAt: Date; isFlagged: boolean; isBanned: boolean; reports: number } | null>;

  constructor(userId: string, nowMs: number) {
    this.userId = userId;
    this.nowMs = nowMs;
  }

  user() {
    if (!this._user) {
      this._user = (async () => {
        const u = await prisma.user.findUnique({
          where: { id: this.userId },
          select: { createdAt: true, isFlagged: true, isBanned: true },
        });
        if (!u) return null;
        const reports = await prisma.report.count({ where: { reportedId: this.userId } });
        return { createdAt: u.createdAt, isFlagged: u.isFlagged, isBanned: u.isBanned, reports };
      })();
    }
    return this._user;
  }

  reader() {
    if (!this._reader) this._reader = buildReaderAggregate(this.userId);
    return this._reader;
  }

  author() {
    if (!this._author) this._author = buildAuthorAggregate(this.userId);
    return this._author;
  }
}

interface ReaderAggregate {
  completedStoryIds: string[];
  completedCount: number;
  completedGenres: Set<string>;
  completedStartTimestamps: number[];
  readGenres: Set<string>;
  distinctCommentedStories: number;
  libraryCount: number;
}

interface AuthorAggregate {
  publishTimestamps: number[];
  chaptersPublished: number;
  completedWorks: number;
  worksPerMarker: number[];
  flawlessWorks: { publishedChapters: number; maxEditGapMs: number; complete: boolean }[];
  likesReceived: number;
  distinctReaders: number;
}

async function buildReaderAggregate(userId: string): Promise<ReaderAggregate> {
  const reads = await prisma.chapterRead.findMany({
    where: { userId },
    select: { storyId: true, chapterId: true },
  });
  const readChapterIds = new Set(reads.map((r) => r.chapterId));
  const readStoryIds = Array.from(new Set(reads.map((r) => r.storyId)));

  // Genres LUS (toute œuvre dont au moins un chapitre a ete lu en entier) et
  // œuvres TERMINEES (dernier chapitre publie lu).
  const readGenres = new Set<string>();
  const completedStoryIds: string[] = [];
  const completedGenres = new Set<string>();
  const completedStartTimestamps: number[] = [];

  if (readStoryIds.length) {
    const stories = await prisma.story.findMany({
      where: { id: { in: readStoryIds } },
      select: {
        id: true, genre: true, createdAt: true,
        chapters: { where: { isPublished: true }, orderBy: { order: 'asc' }, select: { id: true } },
      },
    });
    for (const s of stories) {
      if (s.genre) readGenres.add(s.genre);
      const last = s.chapters[s.chapters.length - 1];
      if (last && readChapterIds.has(last.id)) {
        completedStoryIds.push(s.id);
        if (s.genre) completedGenres.add(s.genre);
        completedStartTimestamps.push(new Date(s.createdAt).getTime());
      }
    }
  }

  // Œuvres DISTINCTES commentees.
  const commented = await prisma.comment.findMany({
    where: { userId }, select: { storyId: true }, distinct: ['storyId'],
  });

  // Bibliotheque = favoris + entrees de listes de lecture (œuvres distinctes).
  const [favs, listEntries] = await Promise.all([
    prisma.favorite.findMany({ where: { userId }, select: { storyId: true } }),
    prisma.readingListEntry.findMany({ where: { userId }, select: { storyId: true } }),
  ]);
  const library = new Set<string>();
  for (const f of favs) library.add(f.storyId);
  for (const e of listEntries) library.add(e.storyId);

  return {
    completedStoryIds,
    completedCount: completedStoryIds.length,
    completedGenres,
    completedStartTimestamps,
    readGenres,
    distinctCommentedStories: commented.length,
    libraryCount: library.size,
  };
}

async function buildAuthorAggregate(userId: string): Promise<AuthorAggregate> {
  const stories = await prisma.story.findMany({
    where: { authorId: userId },
    select: {
      id: true, status: true, tags: true, views: true,
      _count: { select: { likes: true } },
      chapters: { where: { isPublished: true }, select: { createdAt: true, updatedAt: true } },
    },
  });

  const publishTimestamps: number[] = [];
  let chaptersPublished = 0;
  let completedWorks = 0;
  let likesReceived = 0;
  const markerCounts = new Map<string, number>();
  const flawlessWorks: { publishedChapters: number; maxEditGapMs: number; complete: boolean }[] = [];

  for (const s of stories) {
    likesReceived += s._count?.likes || 0;
    const isComplete = s.status === 'PUBLIE' || s.status === 'PUBLISHED' || s.status === 'Publié';
    if (isComplete) completedWorks += 1;

    let maxEditGapMs = 0;
    for (const c of s.chapters) {
      chaptersPublished += 1;
      publishTimestamps.push(new Date(c.createdAt).getTime());
      const gap = new Date(c.updatedAt).getTime() - new Date(c.createdAt).getTime();
      if (gap > maxEditGapMs) maxEditGapMs = gap;
    }
    flawlessWorks.push({ publishedChapters: s.chapters.length, maxEditGapMs, complete: isComplete });

    // Marqueurs d'univers = tags partages entre œuvres.
    let tags: string[] = [];
    try { tags = Array.isArray(JSON.parse(s.tags || '[]')) ? JSON.parse(s.tags || '[]') : []; } catch { tags = []; }
    for (const t of tags) {
      const key = String(t).trim().toLowerCase();
      if (key) markerCounts.set(key, (markerCounts.get(key) || 0) + 1);
    }
  }

  // Lecteurs distincts (interaction lecteur forte).
  const storyIds = stories.map((s) => s.id);
  let distinctReaders = 0;
  if (storyIds.length) {
    const rows = await prisma.chapterRead.findMany({
      where: { storyId: { in: storyIds } }, select: { userId: true }, distinct: ['userId'],
    });
    distinctReaders = rows.length;
  }

  return {
    publishTimestamps,
    chaptersPublished,
    completedWorks,
    worksPerMarker: Array.from(markerCounts.values()),
    flawlessWorks,
    likesReceived,
    distinctReaders,
  };
}

// Tolerance d'edition pour « Le Sans Faute » : brouillon publie et non re-edite
// longtemps apres (absorbe la meme session brouillon->publication). ~2 jours.
const FLAWLESS_TOLERANCE_MS = 2 * 24 * 60 * 60 * 1000;

// ── REGISTRE DES TROPHEES ───────────────────────────────────────────────────
// Ajouter un trophee = ajouter une entree ici. Rien d'autre a modifier.
export const LEGENDARY_DEFS: LegendaryDef[] = [
  // ─────────────── LECTEURS — legendaires visibles (condition cachee) ────────
  {
    id: 'reader_archiviste',
    name: "L'Archiviste",
    icon: '📚',
    rarity: 'legendaire',
    category: 'reader',
    secret: false,
    publicDescription: "Explorer l'archipel dans toute sa diversite, sans laisser un seul horizon inconnu.",
    flavor: "A parcouru chaque territoire litteraire de PLUME et n'a laisse aucun genre inexplore.",
    adminCondition: `Terminer au moins une œuvre dans CHACUN des ${ALL_GENRES.length} genres disponibles (${ALL_GENRES.join(', ')}). Œuvre "terminee" = dernier chapitre publie lu en entier.`,
    evaluate: async (ctx) => {
      const r = await ctx.reader();
      return coversAllGenres(r.completedGenres, ALL_GENRES);
    },
  },
  {
    id: 'reader_voyageur_temps',
    name: 'Le Voyageur du Temps',
    icon: '⏳',
    rarity: 'legendaire',
    category: 'reader',
    secret: false,
    publicDescription: "Remonter le fil du temps jusqu'aux recits des premieres heures de l'archipel.",
    flavor: "A acheve une œuvre nee il y a bien longtemps, quand l'archipel n'etait qu'une jeune legende.",
    adminCondition: 'Terminer une œuvre dont la publication a commence il y a au moins 5 ans (story.createdAt >= 5 ans).',
    evaluate: async (ctx) => {
      const r = await ctx.reader();
      return hasCompletedOldWork(r.completedStartTimestamps, ctx.nowMs, 5);
    },
  },

  // ─────────────── AUTEURS — legendaires visibles (condition cachee) ─────────
  {
    id: 'author_immortel',
    name: "L'Immortel",
    icon: '🔥',
    rarity: 'legendaire',
    category: 'author',
    secret: false,
    publicDescription: "Ne jamais laisser la flamme s'eteindre, saison apres saison, sans la moindre interruption.",
    flavor: "N'a jamais rompu le rythme : une flamme d'ecriture entretenue sans faille pendant des annees.",
    adminCondition: 'Publier au moins un chapitre CHAQUE semaine pendant 3 annees consecutives sans interruption (aucune semaine vide sur une fenetre glissante de 3 ans).',
    evaluate: async (ctx) => {
      const a = await ctx.author();
      return hasWeeklyStreak(a.publishTimestamps, 3);
    },
  },
  {
    id: 'author_monde_vivant',
    name: 'Le Monde Vivant',
    icon: '🌍',
    rarity: 'legendaire',
    category: 'author',
    secret: false,
    publicDescription: "Tisser plusieurs recits en un seul univers, relies par un fil invisible mais coherent.",
    flavor: "A donne naissance a un univers vivant, ou plusieurs œuvres se repondent et se completent.",
    adminCondition: "Creer un univers d'au moins 3 œuvres reliees par un marqueur commun (tag partage entre >= 3 œuvres).",
    evaluate: async (ctx) => {
      const a = await ctx.author();
      return hasLivingUniverse(a.worksPerMarker, 3);
    },
  },
  {
    id: 'author_sans_faute',
    name: 'Le Sans Faute',
    icon: '⚜️',
    rarity: 'legendaire',
    category: 'author',
    secret: false,
    publicDescription: "Ecrire juste, du premier coup, et n'avoir jamais eu a corriger l'œuvre achevee.",
    flavor: "A publie une œuvre complete d'une seule traite, sans jamais retoucher un seul chapitre.",
    adminCondition: `Publier une œuvre COMPLETE (statut publie, >= 3 chapitres) dont aucun chapitre n'a ete modifie apres publication (ecart updatedAt-createdAt <= ${FLAWLESS_TOLERANCE_MS} ms pour chaque chapitre). Proxy : sans champ publishedAt, on tolere la meme session brouillon->publication.`,
    evaluate: async (ctx) => {
      const a = await ctx.author();
      return hasFlawlessWork(a.flawlessWorks, 3, FLAWLESS_TOLERANCE_MS);
    },
  },

  // ─────────────────────── SECRETS TOTAUX (Divins) ──────────────────────────
  {
    id: 'reader_lecteur_divin',
    name: 'Le Lecteur Divin',
    icon: '👑',
    rarity: 'divin',
    category: 'reader',
    secret: true,
    publicDescription: '', // jamais expose (trophee cache)
    flavor: "Une legende parmi les lecteurs. Nul ne sait vraiment comment ce sceau s'obtient.",
    adminCondition:
      "SECRET. Cumul : >=100 œuvres terminees ET au moins une œuvre lue dans chaque genre ET une œuvre terminee agee de >5 ans ET commentaires sur >=50 œuvres distinctes ET >=200 œuvres en bibliotheque ET compte age d'au moins 2 ans (activite prolongee) ET combinaison secrete supplementaire : >=100 œuvres terminees couvrant TOUS les genres (double garde). Les seuils exacts ne sont jamais reveles.",
    evaluate: async (ctx) => {
      const [r, u] = await Promise.all([ctx.reader(), ctx.user()]);
      if (!u) return false;
      const accountYears = yearsBetween(new Date(u.createdAt).getTime(), ctx.nowMs);
      return (
        r.completedCount >= 100 &&
        coversAllGenres(r.readGenres, ALL_GENRES) &&
        hasCompletedOldWork(r.completedStartTimestamps, ctx.nowMs, 5) &&
        r.distinctCommentedStories >= 50 &&
        r.libraryCount >= 200 &&
        accountYears >= 2 &&
        // Combinaison secrete supplementaire (garde renforcee) :
        coversAllGenres(r.completedGenres, ALL_GENRES)
      );
    },
  },
  {
    id: 'author_plume_divine',
    name: 'La Plume Divine',
    icon: '👑',
    rarity: 'divin',
    category: 'author',
    secret: true,
    publicDescription: '', // jamais expose (trophee cache)
    flavor: "Une legende parmi les auteurs. Son secret ne se transmet pas — il se merite.",
    adminCondition:
      "SECRET. Cumul : auteur actif depuis >=2 ans ET publication reguliere sans interruption (streak hebdomadaire sur >=2 ans) ET >=3 œuvres achevees ET univers developpe (>=3 œuvres reliees) ET forte interaction lecteurs (>=50 j'aime cumules OU >=100 lecteurs distincts) ET aucune sanction de moderation (non signale, non banni, 0 rapport) ET combinaison secrete supplementaire : >=50 chapitres publies. Les seuils exacts ne sont jamais reveles.",
    evaluate: async (ctx) => {
      const [a, u] = await Promise.all([ctx.author(), ctx.user()]);
      if (!u) return false;
      const authorYears = yearsBetween(new Date(u.createdAt).getTime(), ctx.nowMs);
      const moderationClean = !u.isFlagged && !u.isBanned && u.reports === 0;
      const strongInteraction = a.likesReceived >= 50 || a.distinctReaders >= 100;
      return (
        authorYears >= 2 &&
        hasWeeklyStreak(a.publishTimestamps, 2) &&
        a.completedWorks >= 3 &&
        hasLivingUniverse(a.worksPerMarker, 3) &&
        strongInteraction &&
        moderationClean &&
        // Combinaison secrete supplementaire :
        a.chaptersPublished >= 50
      );
    },
  },
];

const DEF_BY_ID = new Map(LEGENDARY_DEFS.map((d) => [d.id, d]));

export function getLegendaryDef(id: string): LegendaryDef | undefined {
  return DEF_BY_ID.get(id);
}

export type UnlockMap = Record<string, string>; // { trophyId: dateISO }

/**
 * Evalue TOUS les trophees pour un utilisateur et fusionne avec ses deblocages
 * deja persistes (un trophee acquis le reste a jamais). Renvoie la carte a jour
 * et la liste des NOUVEAUX deblocages (pour la celebration cote client).
 *
 * @param isAdmin  Un administrateur a tout debloque d'office (statut plein).
 */
export async function evaluateAndMerge(
  userId: string,
  existing: UnlockMap,
  nowIso: string,
  isAdmin: boolean,
): Promise<{ unlocks: UnlockMap; newlyUnlocked: string[] }> {
  const ctx = new EvalContext(userId, new Date(nowIso).getTime());
  const unlocks: UnlockMap = { ...existing };
  const newlyUnlocked: string[] = [];

  for (const def of LEGENDARY_DEFS) {
    if (unlocks[def.id]) continue; // deja acquis (definitif)
    let ok = isAdmin;
    if (!ok) {
      try { ok = await def.evaluate(ctx); } catch { ok = false; }
    }
    if (ok) {
      unlocks[def.id] = nowIso;
      newlyUnlocked.push(def.id);
    }
  }
  return { unlocks, newlyUnlocked };
}

// ── PROJECTIONS (ce qui sort de l'API) ──────────────────────────────────────

/** Projection destinee au PROPRIETAIRE (sa propre liste de succes) :
 *  - trophees visibles : toujours listes (nom/icone/rarete), condition masquee ;
 *  - trophees secrets : listes UNIQUEMENT s'ils sont debloques. */
export function ownerProjection(unlocks: UnlockMap) {
  const out: any[] = [];
  for (const def of LEGENDARY_DEFS) {
    const date = unlocks[def.id];
    const unlocked = !!date;
    if (def.secret && !unlocked) continue; // totalement cache
    out.push({
      id: def.id,
      name: def.name,
      icon: def.icon,
      rarity: def.rarity,
      category: def.category,
      secret: def.secret,
      unlocked,
      unlockedDate: date || null,
      // Aucune condition ni seuil : description vague si verrouille, flavor sinon.
      description: unlocked ? def.flavor : def.publicDescription,
    });
  }
  return out;
}

/** Projection PUBLIQUE (profil d'un autre utilisateur) : UNIQUEMENT les trophees
 *  DEBLOQUES, sans aucune condition. Les secrets non debloques restent invisibles. */
export function publicProjection(unlocks: UnlockMap) {
  const out: any[] = [];
  for (const def of LEGENDARY_DEFS) {
    const date = unlocks[def.id];
    if (!date) continue; // seul l'acquis est visible chez autrui
    out.push({
      id: def.id,
      name: def.name,
      icon: def.icon,
      rarity: def.rarity,
      category: def.category,
      secret: def.secret,
      unlockedDate: date,
      description: def.flavor,
    });
  }
  return out;
}

/** Projection ADMINISTRATEUR : conditions EXACTES incluses. Reservee aux
 *  endpoints admin authentifies. */
export function adminProjection(unlocks?: UnlockMap) {
  return LEGENDARY_DEFS.map((def) => ({
    id: def.id,
    name: def.name,
    icon: def.icon,
    rarity: def.rarity,
    category: def.category,
    secret: def.secret,
    condition: def.adminCondition,
    unlocked: unlocks ? !!unlocks[def.id] : undefined,
    unlockedDate: unlocks ? unlocks[def.id] || null : undefined,
  }));
}

/** Nombre de trophees legendaires VISIBLES (non secrets) — pour l'UI (« x / N »).
 *  Les secrets ne sont jamais comptes dans le total affiche. */
export const VISIBLE_LEGENDARY_COUNT = LEGENDARY_DEFS.filter((d) => !d.secret).length;
