/**
 * Utility functions and data structures for PLUME accomplishments.
 * Designed strictly using the Violet, White, and Black design philosophy.
 * Incorporates 125 Reader achievements and 100 Author achievements.
 */

export interface UserStats {
  chaptersRead: number;
  commentsPosted: number;
  likesGiven: number;
  favoritesAdded: number;
  activeDays: number;
  completedReadCycles: number;
  
  wordsWritten: number;
  storiesCreated: number;
  chaptersPublished: number;
  viewsReceived: number;
  likesReceived: number;
  decorChanges: number;

  genresReadCount?: number;
  authorsFollowedCount?: number;
}

export interface Achievement {
  id: string;
  category: 'reader' | 'author';
  difficulty: 'facile' | 'difficile'; // Facile = cache, Difficile = visible mais description cachée
  rarity: 'commun' | 'rare' | 'epic' | 'mythic';
  isUnlocked: boolean;
  title: string;
  mysteryTitle: string; // "???" or similar when locked
  realDesc: string; // The text shown after unlocking
  mysteryDesc: string; // Hint shown when locked
  unlockedDate?: string; // Stored in localStorage
}

export const INITIAL_STATS: UserStats = {
  chaptersRead: 12,
  commentsPosted: 3,
  likesGiven: 5,
  favoritesAdded: 2,
  activeDays: 4,
  completedReadCycles: 0,
  
  wordsWritten: 1200,
  storiesCreated: 1,
  chaptersPublished: 2,
  viewsReceived: 140,
  likesReceived: 18,
  decorChanges: 1,
  
  genresReadCount: 2,
  authorsFollowedCount: 1,
};

/**
 * Gets user stats from local storage or returns customized initial stats based on preset users
 */
export function getUserStats(userId: string, role?: string, username?: string): UserStats {
  const stored = localStorage.getItem(`plume_stats_v1_${userId}`);
  if (stored) {
    try {
      const parsed = JSON.parse(stored);
      // Guarantee fallback properties for levels
      if (parsed.genresReadCount === undefined) parsed.genresReadCount = 2;
      if (parsed.authorsFollowedCount === undefined) parsed.authorsFollowedCount = 1;
      return parsed;
    } catch (e) {
      console.error("Error reading stats:", e);
    }
  }

  // Fallback de démonstration : limité aux COMPTES de démo explicites (par id ou
  // pseudo). On ne se base plus sur le rôle, sinon tout vrai utilisateur (ex.
  // chaque "Lecteur") hériterait de statistiques fictives.
  const stats = { ...INITIAL_STATS };
  const lowerUser = (userId || '').toLowerCase();
  const lowerUsername = (username || '').toLowerCase();
  const isReader = lowerUser === 'user_reader' || lowerUsername === 'charlotte_b';
  const isAuthor = lowerUser === 'user_author' || lowerUsername === 'alexandre_dumas_modern';
  const isMixed = lowerUser === 'user_mixed' || lowerUsername === 'sophie_l';

  if (isReader) {
    stats.chaptersRead = 105;
    stats.commentsPosted = 15;
    stats.likesGiven = 22;
    stats.favoritesAdded = 8;
    stats.activeDays = 14;
    stats.completedReadCycles = 2;
    stats.wordsWritten = 0;
    stats.storiesCreated = 0;
    stats.chaptersPublished = 0;
    stats.genresReadCount = 4;
    stats.authorsFollowedCount = 5;
  } else if (isAuthor) {
    stats.chaptersRead = 5;
    stats.commentsPosted = 4;
    stats.likesGiven = 3;
    stats.favoritesAdded = 1;
    stats.activeDays = 28;
    stats.wordsWritten = 85000;
    stats.storiesCreated = 4;
    stats.chaptersPublished = 12;
    stats.viewsReceived = 2450;
    stats.likesReceived = 180;
    stats.genresReadCount = 1;
    stats.authorsFollowedCount = 2;
  } else if (isMixed) {
    stats.chaptersRead = 31;
    stats.commentsPosted = 10;
    stats.likesGiven = 14;
    stats.favoritesAdded = 6;
    stats.activeDays = 18;
    stats.completedReadCycles = 1;
    stats.wordsWritten = 4800;
    stats.storiesCreated = 1;
    stats.chaptersPublished = 3;
    stats.viewsReceived = 380;
    stats.likesReceived = 24;
    stats.genresReadCount = 3;
    stats.authorsFollowedCount = 3;
  }
  return stats;
}

export function saveUserStats(userId: string, stats: UserStats): void {
  localStorage.setItem(`plume_stats_v1_${userId}`, JSON.stringify(stats));
}

/**
 * Handle persistent unlock dates inside localStorage
 */
export function getUnlockDates(userId: string): Record<string, string> {
  const key = `plume_ach_dates_v1_${userId}`;
  const stored = localStorage.getItem(key);
  if (stored) {
    try {
      return JSON.parse(stored);
    } catch (e) {
      console.error("Error reading unlock dates:", e);
    }
  }
  return {};
}

export function saveUnlockDate(userId: string, achievementId: string): string {
  const key = `plume_ach_dates_v1_${userId}`;
  const dates = getUnlockDates(userId);
  if (!dates[achievementId]) {
    const now = new Date().toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
    dates[achievementId] = now;
    localStorage.setItem(key, JSON.stringify(dates));
    return now;
  }
  return dates[achievementId];
}

/**
 * Generates specifically 125 achievements for Readers
 * Incorporates the 25 level-based accomplishments as part of the total
 */
export function generateReaderAchievements(stats: UserStats, userId: string = 'current_user'): Achievement[] {
  const list: Achievement[] = [];
  const TOTAL_READER = 125;
  const SIMPLE_COUNT = 75; // 60% simple, 40% difficult/complex
  const unlockDates = getUnlockDates(userId);

  for (let i = 1; i <= TOTAL_READER; i++) {
    // We mark the last 25 as the level-based ones, which are difficult/progress tracking
    const isLevelAch = i > 100;
    const isSimple = i <= SIMPLE_COUNT;
    const difficulty = isSimple ? 'facile' : 'difficile';
    
    let rarity: 'commun' | 'rare' | 'epic' | 'mythic' = 'commun';
    if (i > 75 && i <= 100) rarity = 'rare';
    else if (i > 100 && i <= 118) rarity = 'epic';
    else if (i > 118) rarity = 'mythic';

    let isUnlocked = false;
    let title = "";
    let mysteryTitle = `Chambellan du Savoir #${i}`;
    let realDesc = "";
    let mysteryDesc = "Accomplissement mystérieux. Parcourez l'archipel PLUME pour débloquer ce secret.";

    if (isLevelAch) {
      // 25 levels: 101 to 125
      const lvlIndex = i - 100; // 1 to 25
      if (lvlIndex <= 5) {
        // Retourneur de Pages I à V (Index 101-105)
        const levels = [10, 30, 50, 100, 200];
        const target = levels[lvlIndex - 1];
        isUnlocked = stats.chaptersRead >= target;
        title = `Retourneur de Pages ${"I".repeat(lvlIndex)}`;
        realDesc = `A dévoré ${target} chapitres de récits captivants.`;
        mysteryDesc = `Lisez de nombreux chapitres pour débloquer le niveau ${"I".repeat(lvlIndex)}.`;
        rarity = 'rare';
      } else if (lvlIndex <= 10) {
        // Temps de Lecture I à V (Index 106-110)
        const sub = lvlIndex - 5;
        const levels = [2, 5, 10, 15, 30];
        const target = levels[sub - 1];
        isUnlocked = stats.activeDays >= target;
        title = `Temps de Lecture ${"I".repeat(sub)}`;
        realDesc = `S'est connecté et adonné à la lecture durant au moins ${target} jours.`;
        mysteryDesc = `Cultivez votre fidélité littéraire durant ${target} jours pour atteindre ce rang.`;
        rarity = 'rare';
      } else if (lvlIndex <= 15) {
        // Histoires Terminées I à V (Index 111-115)
        const sub = lvlIndex - 10;
        const levels = [1, 2, 3, 5, 8];
        const target = levels[sub - 1];
        isUnlocked = stats.completedReadCycles >= target;
        title = `Histoires Terminées ${"I".repeat(sub)}`;
        realDesc = `A lu et achevé de bout en bout ${target} histoires fantastiques.`;
        mysteryDesc = `Terminez complètement la lecture de ${target} histoires distinctes.`;
        rarity = 'epic';
      } else if (lvlIndex <= 20) {
        // Genres Découverts I à V (Index 116-120)
        const sub = lvlIndex - 15;
        const levels = [1, 2, 3, 4, 5];
        const target = levels[sub - 1];
        const actualGenres = stats.genresReadCount || Math.min(5, Math.max(1, Math.floor(stats.chaptersRead / 8)));
        isUnlocked = actualGenres >= target;
        title = `Genres Découverts ${"I".repeat(sub)}`;
        realDesc = `A exploré d'autres horizons avec au moins ${target} genres littéraires parcourus.`;
        mysteryDesc = `Ouvrez et lisez des œuvres de ${target} thèmes/genres différents.`;
        rarity = 'epic';
      } else {
        // Auteurs Suivis I à V (Index 121-125)
        const sub = lvlIndex - 20;
        const levels = [1, 2, 4, 6, 10];
        const target = levels[sub - 1];
        const actualAuthors = stats.authorsFollowedCount || Math.min(10, Math.max(1, Math.floor(stats.likesGiven / 4)));
        isUnlocked = actualAuthors >= target;
        title = `Auteurs Suivis ${"I".repeat(sub)}`;
        realDesc = `A manifesté de la fidélité en suivant ${target} plumes distinctes de l'archipel.`;
        mysteryDesc = `Abonnez-vous à la page de ${target} auteurs de talent.`;
        rarity = 'mythic';
      }
    } else {
      // 1-100: Other reader accomplishments
      if (i <= 25) {
        // 1-25: simple based on chaptersRead
        const target = i;
        isUnlocked = stats.chaptersRead >= target;
        title = `Liseur Passionné Niv.${i}`;
        realDesc = `A dévoré au moins ${target} chapitres de récits captivants sur l'archipel.`;
      } else if (i <= 45) {
        // 26-45: comments
        const target = i - 25;
        isUnlocked = stats.commentsPosted >= target;
        title = `Critique de Salon Niv.${target}`;
        realDesc = `A partagé ${target} commentaires éclairés pour encourager les auteurs.`;
      } else if (i <= 65) {
        // 46-65: likes given
        const target = (i - 45) * 2;
        isUnlocked = stats.likesGiven >= target;
        title = `Donateur des Astres Niv.${i - 45}`;
        realDesc = `A attribué ${target} cœurs d'appréciation sur les œuvres de l'archipel.`;
      } else if (i <= 75) {
        // 66-75: favorites
        const target = i - 65;
        isUnlocked = stats.favoritesAdded >= target;
        title = `Archiviste Privé Niv.${target}`;
        realDesc = `A conservé ${target} œuvres soignées parmi ses lectures favorites.`;
      } else if (i <= 90) {
        // 76-90: Difficult ones (rare)
        const sub = i - 75; // 1 to 15
        const target = sub * 10 + 25;
        isUnlocked = stats.chaptersRead >= target;
        title = `Explorateur Abyssal des Tomes (#${sub})`;
        mysteryDesc = "Lisez de longs ouvrages et accumulez des chapitres dévorés.";
        realDesc = `A englouti un volume considérable de ${target} chapitres littéraires.`;
      } else {
        // 91-100: Difficult ones (extreme)
        const sub = i - 90; // 1 to 10
        const target = sub * 3 + 12;
        isUnlocked = stats.commentsPosted >= target;
        title = `Héraut de l'Encouragement (#${sub})`;
        mysteryDesc = "Prenez activement part au destin des récits en écrivant de mûrs commentaires.";
        realDesc = `A laissé une trace impérissable avec ${target} avis détaillés sous les chapitres.`;
      }
    }

    // Capture acquisition date dynamically
    let actualUnlockedDate = undefined;
    if (isUnlocked) {
      actualUnlockedDate = unlockDates[`reader_${i}`] || saveUnlockDate(userId, `reader_${i}`);
    }

    list.push({
      id: `reader_${i}`,
      category: 'reader',
      difficulty,
      rarity,
      isUnlocked,
      title,
      mysteryTitle,
      realDesc,
      mysteryDesc,
      unlockedDate: actualUnlockedDate
    });
  }

  return list;
}

/**
 * Generates specifically 100 accomplishments for Authors
 * 60 common / 15 rare / 15 epic / 10 mythic
 */
export function generateAuthorAchievements(stats: UserStats, userId: string = 'current_user'): Achievement[] {
  const list: Achievement[] = [];
  const unlockDates = getUnlockDates(userId);

  // Define names exactly as requested
  const commonTitles = [
    "Première Plume", "Naissance d'un Monde", "Le Commencement", "Première Couverture", "Premier Brouillon",
    "Chapitre Deux", "Chapitre Trois", "Plume Active", "Auteur Débutant", "Créateur",
    "Premier Lecteur", "Premier J'aime", "Première Réaction", "Première Bibliothèque", "Premier Abonné",
    "Auteur Observé", "Première Discussion", "Présence", "Retour de l'Auteur", "Une Voix Entendue",
    "Une Semaine d'Écriture", "Auteur Assidu", "Travailleur de l'Ombre", "Toujours Présent", "Habitude d'Écrire",
    "Architecte", "Conteur", "Bâtisseur d'Univers", "Imagination Sans Limite", "Premier Fan",
    "Apprécié", "Remarqué", "Suivi", "Source d'Inspiration", "Écrivain Actif",
    "Persévérant", "Productif", "Créateur de Mondes", "Collection d'Histoires", "Le Conteur",
    "Auteur du Matin", "Auteur de la Nuit", "Marathonien", "Créatif", "Inspiration Continue",
    "Première Série", "Série Active", "Série Durable", "Série Vivante", "Narrateur",
    "Maître du Brouillon", "Travailleur Silencieux", "Auteur Régulier", "Voix Unique", "Créateur Passionné",
    "Raconteur d'Histoires", "Bâtisseur de Récits", "Auteur Investi", "Plume Fidèle", "Le Récit de l'Écrivain"
  ];

  const rareTitles = [
    "Auteur Fidèle", "Plume Respectée", "Créateur d'Univers", "Auteur Populaire", "Collectionneur de Lecteurs",
    "Architecte de Mondes", "Source de Divertissement", "Plume d'Argent", "Gardien du Récit", "Auteur Inspirant",
    "Communauté Grandissante", "Voix Reconnue", "Auteur Accompli", "Écrivain Passionné", "Conteur d'Exception"
  ];

  const epicTitles = [
    "Plume d'Or", "Maître Conteur", "Créateur Légendaire", "Auteur d'Élite", "Bâtisseur de Légendes",
    "Architecte Suprême", "Univers Vivant", "Héritage Littéraire", "Auteur Inarrêtable", "Le Visionnaire",
    "L'Immortel", "Générateur de Mondes", "Maître des Histoires", "Auteur Mythique", "Légende de l'Écriture"
  ];

  const mythicTitles = [
    "Le Maître des Plumes", "L'Architecte Éternel", "Le Créateur Mythique", "La Plume Absolue", "L'Héritier des Légendes",
    "Le Cœur de la Bibliothèque", "Le Fondateur de Mondes", "Le Sans-Limite", "Constellation des Auteurs", "L'Œuvre Éternelle"
  ];

  for (let i = 1; i <= 100; i++) {
    let rarity: 'commun' | 'rare' | 'epic' | 'mythic' = 'commun';
    let title = "";
    let isUnlocked = false;
    let realDesc = "";
    let mysteryTitle = "???";
    let mysteryDesc = "Accomplissement inconnu"; // Common hidden default

    if (i <= 60) {
      rarity = 'commun';
      title = commonTitles[i - 1] || `Auteur Commun #${i}`;
    } else if (i <= 75) {
      rarity = 'rare';
      title = rareTitles[i - 61] || `Auteur Rare #${i}`;
      mysteryDesc = "Objectif encore à découvrir.";
    } else if (i <= 90) {
      rarity = 'epic';
      title = epicTitles[i - 76] || `Auteur Épique #${i}`;
      mysteryDesc = "Objectif encore à découvrir.";
    } else {
      rarity = 'mythic';
      title = mythicTitles[i - 91] || `Auteur Mythique #${i}`;
      mysteryDesc = "Objectif encore à découvrir.";
    }

    // Difficulty maps to visibility rules:
    // "facile" for commons (fully mystery check before unlock)
    // "difficile" for rare, epic, and mythic (real title always visible / condition is hidden as "Objectif encore à découvrir.")
    const difficulty = rarity === 'commun' ? 'facile' : 'difficile';

    // Evaluate exact internal conditions for the 100 author achievements
    if (i === 1) { // Première Plume
      isUnlocked = stats.chaptersPublished >= 1;
      realDesc = "Publier son premier chapitre de récit.";
    } else if (i === 2) { // Naissance d'un Monde
      isUnlocked = stats.storiesCreated >= 1;
      realDesc = "Créer sa toute première histoire créative.";
    } else if (i === 3) { // Le Commencement
      isUnlocked = stats.storiesCreated >= 1 && stats.wordsWritten >= 50;
      realDesc = "Ajouter un résumé d'introduction captivant à votre œuvre.";
    } else if (i === 4) { // Première Couverture
      isUnlocked = stats.storiesCreated >= 1;
      realDesc = "Parer votre roman d'une illustration de couverture soignée.";
    } else if (i === 5) { // Premier Brouillon
      isUnlocked = stats.storiesCreated >= 1;
      realDesc = "Formuler les premières trames d'un chapitre de brouillon.";
    } else if (i === 6) { // Chapitre Deux
      isUnlocked = stats.chaptersPublished >= 2;
      realDesc = "Publier un deuxième chapitre de suite.";
    } else if (i === 7) { // Chapitre Trois
      isUnlocked = stats.chaptersPublished >= 3;
      realDesc = "Achever et publier le troisième chapitre de vos récits.";
    } else if (i === 8) { // Plume Active
      isUnlocked = stats.wordsWritten >= 1000;
      realDesc = "Accumuler 1 000 mots écrits à l'encre digitale.";
    } else if (i === 9) { // Auteur Débutant
      isUnlocked = stats.wordsWritten >= 2500;
      realDesc = "Prendre de l'assurance avec plus de 2 500 mots soignés.";
    } else if (i === 10) { // Créateur
      isUnlocked = stats.wordsWritten >= 5000;
      realDesc = "Établir les bases d'un livre riche de 5 000 mots rédigés.";
    } else if (i === 11) { // Premier Lecteur
      isUnlocked = stats.viewsReceived >= 1;
      realDesc = "Enregistrer la toute première ouverture ou vue d'un lecteur.";
    } else if (i === 12) { // Premier J'aime
      isUnlocked = stats.likesReceived >= 1;
      realDesc = "Décrocher le premier j'aime de soutien sur l'un de vos chapitres.";
    } else if (i === 13) { // Première Réaction
      isUnlocked = stats.viewsReceived >= 5;
      realDesc = "Faire naitre vos premières réactions auprès de 5 amateurs de lecture.";
    } else if (i === 14) { // Première Bibliothèque
      isUnlocked = stats.viewsReceived >= 10;
      realDesc = "Être repéré et susciter plus de 10 visites sur votre catalogue.";
    } else if (i === 15) { // Premier Abonné
      isUnlocked = stats.viewsReceived >= 15;
      realDesc = "Fidéliser vos tout premiers abonnés avec vos récits d'envergure.";
    } else if (i === 16) { // Auteur Observé
      isUnlocked = stats.viewsReceived >= 30;
      realDesc = "Un intérêt naissant avec plus de 30 lectures enregistrées.";
    } else if (i === 17) { // Première Discussion
      isUnlocked = stats.viewsReceived >= 40;
      realDesc = "Inaugurer les premiers débats constructifs autour de votre univers.";
    } else if (i === 18) { // Présence
      isUnlocked = stats.activeDays >= 2;
      realDesc = "Venir poser des mots sur deux journées consécutives.";
    } else if (i === 19) { // Retour de l'Auteur
      isUnlocked = stats.activeDays >= 3;
      realDesc = "Persister et retravailler son œuvre sur trois jours distincts.";
    } else if (i === 20) { // Une Voix Entendue
      isUnlocked = stats.viewsReceived >= 50;
      realDesc = "Atteindre un jalon symbolique de 50 lectures d'archipels.";
    } else if (i === 21) { // Une Semaine d'Écriture
      isUnlocked = stats.activeDays >= 7;
      realDesc = "Cumuler 7 jours de retouches, écritures et retours soignés.";
    } else if (i === 22) { // Auteur Assidu
      isUnlocked = stats.activeDays >= 10;
      realDesc = "Marquer dix jours de créations à votre compteur d'activité.";
    } else if (i === 23) { // Travailleur de l'Ombre
      isUnlocked = stats.wordsWritten >= 7500;
      realDesc = "Composer d'arrache-pied avec plus de 7 500 mots d'aventures.";
    } else if (i === 24) { // Toujours Présent
      isUnlocked = stats.activeDays >= 14;
      realDesc = "Travailler régulièrement sur l'application durant deux semaines.";
    } else if (i === 25) { // Habitude d'Écrire
      isUnlocked = stats.activeDays >= 20;
      realDesc = "Créer un véritable rituel avec vingt jours d'écriture active.";
    } else if (i === 26) { // Architecte
      isUnlocked = stats.storiesCreated >= 2;
      realDesc = "Superviser de front deux projets littéraires complémentaires.";
    } else if (i === 27) { // Conteur
      isUnlocked = stats.storiesCreated >= 3;
      realDesc = "Ouvrir les portes de votre imagination dans 3 grands romans.";
    } else if (i === 28) { // Bâtisseur d'Univers
      isUnlocked = stats.storiesCreated >= 4;
      realDesc = "Régner en maître sur 4 récits aux intrigues fantastiques.";
    } else if (i === 29) { // Imagination Sans Limite
      isUnlocked = stats.wordsWritten >= 10000;
      realDesc = "Rédiger un seuil mûr de 10 000 mots détaillés.";
    } else if (i === 30) { // Premier Fan
      isUnlocked = stats.likesReceived >= 3;
      realDesc = "Cumuler 3 marques d'étoiles et de cœurs de vos admirateurs.";
    } else if (i === 31) { // Apprécié
      isUnlocked = stats.likesReceived >= 5;
      realDesc = "Voir vos écrits acclamés par 5 mentions j'aime flatteuses.";
    } else if (i === 32) { // Remarqué
      isUnlocked = stats.likesReceived >= 10;
      realDesc = "Recueillir les félicitations enthousiastes de 10 lecteurs captivés.";
    } else if (i === 33) { // Suivi
      isUnlocked = stats.likesReceived >= 15;
      realDesc = "Dégager une véritable influence avec 15 mentions d'évaluations j'aime.";
    } else if (i === 34) { // Source d'Inspiration
      isUnlocked = stats.likesReceived >= 20;
      realDesc = "Donner envie d'écrire aux autres grâce à 20 j'aime validés.";
    } else if (i === 35) { // Écrivain Actif
      isUnlocked = stats.wordsWritten >= 12000;
      realDesc = "Une productivité sans faille culminant à 12 000 mots.";
    } else if (i === 36) { // Persévérant
      isUnlocked = stats.chaptersPublished >= 5;
      realDesc = "Publier au moins 5 chapitres d'œuvres complexes.";
    } else if (i === 37) { // Productif
      isUnlocked = stats.chaptersPublished >= 8;
      realDesc = "Soutenir un rythme de parution de 8 chapitres complets.";
    } else if (i === 38) { // Créateur de Mondes
      isUnlocked = stats.storiesCreated >= 5;
      realDesc = "Gérer 5 univers d'évasion spirituelle.";
    } else if (i === 39) { // Collection d'Histoires
      isUnlocked = stats.storiesCreated >= 6;
      realDesc = "Peupler l'archipel avec 6 récits aux genres opposés.";
    } else if (i === 40) { // Le Conteur
      isUnlocked = stats.chaptersPublished >= 10;
      realDesc = "Atteindre la barre émérite de 10 chapitres mis en page.";
    } else if (i === 41) { // Auteur du Matin
      isUnlocked = stats.activeDays >= 5;
      realDesc = "Avoir posé son inspiration dès l'aurore bercée par la rosée.";
    } else if (i === 42) { // Auteur de la Nuit
      isUnlocked = stats.activeDays >= 6;
      realDesc = "Écrire sous la lueur mystérieuse d'une nuit de pleine lune.";
    } else if (i === 43) { // Marathonien
      isUnlocked = stats.wordsWritten >= 15000;
      realDesc = "Franchir l'étape symbolique de 15 000 mots rédigés.";
    } else if (i === 44) { // Créatif
      isUnlocked = stats.wordsWritten >= 18000;
      realDesc = "Exposer votre imagination débordante sur 18 000 mots fluides.";
    } else if (i === 45) { // Inspiration Continue
      isUnlocked = stats.wordsWritten >= 20000;
      realDesc = "Ressentir l'écoulement naturel du verbe sur plus de 20 000 mots.";
    } else if (i === 46) { // Première Série
      isUnlocked = stats.storiesCreated >= 2;
      realDesc = "Maîtriser durablement le format de saga complexe.";
    } else if (i === 47) { // Série Active
      isUnlocked = stats.chaptersPublished >= 12;
      realDesc = "Maintenir le souffle de l'aventure sur 12 chapitres consécutifs.";
    } else if (i === 48) { // Série Durable
      isUnlocked = stats.chaptersPublished >= 15;
      realDesc = "Imprimer votre style sur l'esprit de vos lecteurs avec 15 chapitres.";
    } else if (i === 49) { // Série Vivante
      isUnlocked = stats.chaptersPublished >= 18;
      realDesc = "Une plume en symbiose parfaite avec 18 chapitres de grande facture.";
    } else if (i === 50) { // Narrateur
      isUnlocked = stats.wordsWritten >= 25000;
      realDesc = "Asseoir votre autorité de romancier sur 25 000 mots d'intrigue.";
    } else if (i === 51) { // Maître du Brouillon
      isUnlocked = stats.wordsWritten >= 30000;
      realDesc = "Polir attentivement la matière grise de 30 000 mots ciselés.";
    } else if (i === 52) { // Travailleur Silencieux
      isUnlocked = stats.activeDays >= 15;
      realDesc = "Persister obstinément en solitaire sur plus de 15 séances d'écriture.";
    } else if (i === 53) { // Auteur Régulier
      isUnlocked = stats.activeDays >= 25;
      realDesc = "Un engagement à toute épreuve consolidé sur 25 jours actifs.";
    } else if (i === 54) { // Voix Unique
      isUnlocked = stats.viewsReceived >= 100;
      realDesc = "Séduire une foule de 100 curieux d'un style tranchant.";
    } else if (i === 55) { // Créateur Passionné
      isUnlocked = stats.wordsWritten >= 35000;
      realDesc = "Laisser parler les sentiments profonds au travers de 35 000 mots.";
    } else if (i === 56) { // Raconteur d'Histoires
      isUnlocked = stats.wordsWritten >= 40000;
      realDesc = "Nourrir la bibliothèque impériale d'un grand tome de 40 000 mots.";
    } else if (i === 57) { // Bâtisseur de Récits
      isUnlocked = stats.chaptersPublished >= 20;
      realDesc = "Donner vie au monumental volume de 20 chapitres d'intrigue.";
    } else if (i === 58) { // Auteur Investi
      isUnlocked = stats.activeDays >= 30;
      realDesc = "Un mois complet d'efforts couronné par une présence ininterrompue.";
    } else if (i === 59) { // Plume Fidèle
      isUnlocked = stats.activeDays >= 40;
      realDesc = "Quarante jours de dévouement littéraire sous la bannière Plume.";
    } else if (i === 60) { // L'Écrivain
      isUnlocked = stats.wordsWritten >= 50000;
      realDesc = "Éclater la majestueuse ligne d'or des premiers 50 000 mots rédigés.";
    }

    // --- RARES (61 - 75) ---
    else if (i === 61) { // Auteur Fidèle
      isUnlocked = stats.activeDays >= 45;
      realDesc = "Obtenir une assiduité royale avec 45 journées actives consacrées à l'écriture.";
    } else if (i === 62) { // Plume Respectée
      isUnlocked = stats.likesReceived >= 25;
      realDesc = "Susciter une vague de respect chez vos lecteurs avec 25 mentions j'aime.";
    } else if (i === 63) { // Créateur d'Univers
      isUnlocked = stats.storiesCreated >= 7;
      realDesc = "Façonner 7 mondes distincts de l'archipel à partir du chaos primordial.";
    } else if (i === 64) { // Auteur Populaire
      isUnlocked = stats.viewsReceived >= 250;
      realDesc = "Devenir une voix écoutée par un lectorat florissant de 250 curieux.";
    } else if (i === 65) { // Collectionneur de Lecteurs
      isUnlocked = stats.viewsReceived >= 500;
      realDesc = "Regrouper sous votre égide une audience dense de plus de 500 lectures de tome.";
    } else if (i === 66) { // Architecte de Mondes
      isUnlocked = stats.storiesCreated >= 8;
      realDesc = "Superviser les fondations géométriques de 8 histoires distinctes.";
    } else if (i === 67) { // Source de Divertissement
      isUnlocked = stats.viewsReceived >= 750;
      realDesc = "Être le sanctuaire de 750 âmes conquises par votre inventivité.";
    } else if (i === 68) { // Plume d'Argent
      isUnlocked = stats.wordsWritten >= 60000;
      realDesc = "Fondre un lingot royal en argent massif de 60 000 mots d'intrigues haletantes.";
    } else if (i === 69) { // Gardien du Récit
      isUnlocked = stats.chaptersPublished >= 22;
      realDesc = "Faire briller le feu de vos parutions sur le seuil de 22 chapitres d'action.";
    } else if (i === 70) { // Auteur Inspirant
      isUnlocked = stats.likesReceived >= 30;
      realDesc = "Orienter les élans créatifs de la communauté grâce à 30 cœurs de retours flatteurs.";
    } else if (i === 71) { // Communauté Grandissante
      isUnlocked = stats.viewsReceived >= 1000;
      realDesc = "Casser le palier phénoménal de 1 000 ouvertures et lectures cumulées.";
    } else if (i === 72) { // Voix Reconnue
      isUnlocked = stats.likesReceived >= 40;
      realDesc = "Acquérir le statut de référence respectée avec 40 ovations positives.";
    } else if (i === 73) { // Auteur Accompli
      isUnlocked = stats.wordsWritten >= 70000;
      realDesc = "Graver 70 000 mots de caractère et d'intrigue au cœur de l'archipel.";
    } else if (i === 74) { // Écrivain Passionné
      isUnlocked = stats.wordsWritten >= 80000;
      realDesc = "Rédiger le fleuve vertueux de 80 000 mots débordant de passion pure.";
    } else if (i === 75) { // Conteur d'Exception
      isUnlocked = stats.chaptersPublished >= 25;
      realDesc = "Un quart de centaine (25) de chapitres finement contés.";
    }

    // --- ÉPIQUES (76 - 90) ---
    else if (i === 76) { // Plume d'Or
      isUnlocked = stats.wordsWritten >= 100000;
      realDesc = "Inscrire en lettres d'or d'une plume étincelante une œuvre de 100 000 mots.";
    } else if (i === 77) { // Maître Conteur
      isUnlocked = stats.chaptersPublished >= 30;
      realDesc = "Conduire avec superbe 30 chapitres d'intrigues épiques sans faillir.";
    } else if (i === 78) { // Créateur Légendaire
      isUnlocked = stats.storiesCreated >= 10;
      realDesc = "Une créativité colossale illustrée par 10 projets romanesques distincts.";
    } else if (i === 79) { // Auteur d'Élite
      isUnlocked = stats.viewsReceived >= 1500;
      realDesc = "Se hisser au pinacle des célébrités avec plus de 1 500 visites sur vos pages.";
    } else if (i === 80) { // Bâtisseur de Légendes
      isUnlocked = stats.wordsWritten >= 120000;
      realDesc = "Rédiger 120 000 mots de légendes et de gloire.";
    } else if (i === 81) { // Architecte Suprême
      isUnlocked = stats.storiesCreated >= 12;
      realDesc = "Détenir les plans de construction d'une constellation géante de 12 récits.";
    } else if (i === 82) { // Univers Vivant
      isUnlocked = stats.viewsReceived >= 2000;
      realDesc = "Vos créations captivent l'équivalent de 2 000 lectures de pages actives.";
    } else if (i === 83) { // Héritage Littéraire
      isUnlocked = stats.wordsWritten >= 150000;
      realDesc = "Laisser un colossal héritage écrit de plus de 150 000 mots.";
    } else if (i === 84) { // Auteur Inarrêtable
      isUnlocked = stats.chaptersPublished >= 35;
      realDesc = "Une longévité à toute épreuve concrétisée par 35 chapitres d'envergure.";
    } else if (i === 85) { // Le Visionnaire
      isUnlocked = stats.likesReceived >= 60;
      realDesc = "Se projeter dans l'esprit populaire et obtenir 60 marques d'estime.";
    } else if (i === 86) { // L'Immortel
      isUnlocked = stats.activeDays >= 60;
      realDesc = "Garant de l'éternité avec 60 journées d'expressions poétiques de premier choix.";
    } else if (i === 87) { // Générateur de Mondes
      isUnlocked = stats.storiesCreated >= 15;
      realDesc = "Donner vie de manière herculéenne à 15 sagas distinctes sur l'application.";
    } else if (i === 88) { // Maître des Histoires
      isUnlocked = stats.chaptersPublished >= 40;
      realDesc = "La maîtrise des mots illustrée par une quarantaine de chapitres mûrs.";
    } else if (i === 89) { // Auteur Mythique
      isUnlocked = stats.viewsReceived >= 3000;
      realDesc = "S'entourer d'une aura légendaire avec 3 000 visites de tomes littéraires.";
    } else if (i === 90) { // Légende de l'Écriture
      isUnlocked = stats.wordsWritten >= 200000;
      realDesc = "Savoir extraire de son âme plus de 200 000 mots d'intrigues passionnantes.";
    }

    // --- MYTHIQUES (91 - 100) ---
    else if (i === 91) { // Le Maître des Plumes
      isUnlocked = stats.wordsWritten >= 250000;
      realDesc = "Le sommet inviolable de 250 000 mots écrits au service de l'évasion spirituelle.";
    } else if (i === 92) { // L'Architecte Éternel
      isUnlocked = stats.storiesCreated >= 20;
      realDesc = "Avoir façonné 20 univers épiques distincts sur l'archipel PLUME.";
    } else if (i === 93) { // Le Créateur Mythique
      isUnlocked = stats.chaptersPublished >= 50;
      realDesc = "Publier un demi-cent (50) de chapitres d'œuvres complexes.";
    } else if (i === 94) { // La Plume Absolue
      isUnlocked = stats.wordsWritten >= 300000;
      realDesc = "Un chef-d'œuvre titanesque totalisant plus de 300 000 mots d'aventure.";
    } else if (i === 95) { // L'Héritier des Légendes
      isUnlocked = stats.likesReceived >= 100;
      realDesc = "Avoir été gratifié de l'adulation populaire suprême de 100 mentions d'honneur j'aime.";
    } else if (i === 96) { // Le Cœur de la Bibliothèque
      isUnlocked = stats.viewsReceived >= 5000;
      realDesc = "Une lecture de vos pages qui bat au rythme herculéen de 5 000 visites.";
    } else if (i === 97) { // Le Fondateur de Mondes
      isUnlocked = stats.storiesCreated >= 25;
      realDesc = "Créer un panthéon colossal de 25 récits de qualité impériale.";
    } else if (i === 98) { // Le Sans-Limite
      isUnlocked = stats.wordsWritten >= 400000;
      realDesc = "Une ferveur littéraire hors du commun couronnée de 400 000 mots.";
    } else if (i === 99) { // Constellation des Auteurs
      isUnlocked = stats.viewsReceived >= 10000;
      realDesc = "S'élever parmi les cieux avec plus de 10 000 lectures d'archipels.";
    } else if (i === 100) { // L'Œuvre Éternelle
      isUnlocked = stats.wordsWritten >= 500000;
      realDesc = "Achever le légendaire grand œuvre immortel culminant à 500 000 mots.";
    }

    // Capture acquisition date dynamically
    let actualUnlockedDate = undefined;
    if (isUnlocked) {
      actualUnlockedDate = unlockDates[`author_${i}`] || saveUnlockDate(userId, `author_${i}`);
    }

    list.push({
      id: `author_${i}`,
      category: 'author',
      difficulty,
      rarity,
      isUnlocked,
      title,
      mysteryTitle,
      realDesc,
      mysteryDesc,
      unlockedDate: actualUnlockedDate
    });
  }

  return list;
}

/**
 * Calculates current unlocking details and handles certification triggers
 * @returns Progress calculations and whether the certification conditions are met.
 */
export function countAndEvaluateCertification(
  role: string,
  stats: UserStats,
  userId: string = 'current_user'
): {
  readerPercent: number;
  authorPercent: number;
  unlockedReaderCount: number;
  unlockedAuthorCount: number;
  shouldCertify: boolean;
} {
  const readers = generateReaderAchievements(stats, userId);
  const authors = generateAuthorAchievements(stats, userId);

  const rUnlocked = readers.filter(a => a.isUnlocked).length;
  const aUnlocked = authors.filter(a => a.isUnlocked).length;

  const readerPercent = Math.round((rUnlocked / 125) * 100);
  const authorPercent = Math.round((aUnlocked / 100) * 100);

  // Seule la spécialité Auteur peut être certifiée, en débloquant au moins 80 %
  // de ses accomplissements. Les lecteurs conservent leurs accomplissements mais
  // ne sont jamais certifiés ; le rôle « Utilisateur Mixte » n'existe plus.
  let shouldCertify = false;
  if (role === 'Auteur' && authorPercent >= 80) {
    shouldCertify = true;
  }

  return {
    readerPercent,
    authorPercent,
    unlockedReaderCount: rUnlocked,
    unlockedAuthorCount: aUnlocked,
    shouldCertify
  };
}

export interface AchievementEnigma {
  /** L'énigme poétique (toujours montrée, y compris pour les badges cachés). */
  riddle: string;
  /** L'indice d'action concret qui aide à progresser, sans révéler le seuil
   *  exact d'un badge caché. */
  hint: string;
}

/**
 * Construit une « énigme » d'aide pour n'importe quel badge, dérivée du domaine
 * d'accomplissement (lecture, écriture, social…). Conçue pour AIDER le joueur à
 * comprendre comment progresser, tout en préservant le mystère : on ne révèle
 * jamais ici la description réelle ni le seuil chiffré d'un badge verrouillé.
 */
export function getAchievementEnigma(ach: Achievement): AchievementEnigma {
  // Détection sur la description réelle uniquement (le titre est trop bruité :
  // « Bibliothèque », « Archiviste »… induisent en erreur). L'ordre des règles
  // est important : on teste les domaines les plus spécifiques d'abord.
  const text = (ach.realDesc || '').toLowerCase();
  const has = (...words: string[]) => words.some((w) => text.includes(w));
  const isAuthor = ach.category === 'author';

  // 1) Favoris (avant « vues » : le libellé contient « lectures favorites »).
  if (has('favori', 'archivist', 'conserv')) {
    return {
      riddle: '« Ce que l’on chérit vraiment, on le garde toujours près de soi. »',
      hint: 'Ajoute des œuvres à tes favoris.',
    };
  }
  // 2) Assiduité (avant « vues » : « ...lecture durant X jours »).
  if (has('jour', 'journée', 'semaine', 'assidu', 'présent', 'habitude', 'régul', 'rituel', 'consécut')) {
    return {
      riddle: '« La constance, jour après jour, forge les légendes. »',
      hint: 'Reviens régulièrement sur l’archipel, jour après jour.',
    };
  }
  // 3) Genres / exploration (lecteur : « genres » est aussi un mot de saveur des
  //    récits d'auteur, on réserve donc cette piste à la lecture).
  if (!isAuthor && has('genre', 'horizon', 'thème')) {
    return {
      riddle: '« L’explorateur de mille horizons découvre les trésors cachés. »',
      hint: 'Lis des œuvres de genres littéraires variés.',
    };
  }
  // 4) Mots écrits.
  if (has('mot')) {
    return {
      riddle: '« Mille mots après mille mots, la légende prend forme. »',
      hint: 'Écris et accumule davantage de mots dans tes œuvres.',
    };
  }
  // 5) Commentaires.
  if (has('commentaire', 'avis', 'critique', 'encourag', 'débat')) {
    return {
      riddle: '« La voix qui éclaire les récits d’autrui ouvre cette porte. »',
      hint: 'Publie des commentaires constructifs sous les chapitres.',
    };
  }
  // 6) J'aime / appréciation.
  if (has('aime', 'cœur', 'coeur', 'appréci', 'étoile')) {
    return {
      riddle: '« L’admiration partagée illumine ce qui était caché. »',
      hint: isAuthor ? 'Obtiens des j’aime sur tes chapitres.' : 'Offre des cœurs aux œuvres que tu apprécies.',
    };
  }
  // 7) Abonnés / suivis.
  if (has('abonné', 'suiv', 'communauté', 'admirateur')) {
    return {
      riddle: '« Une communauté se rassemble autour des grandes plumes. »',
      hint: isAuthor ? 'Gagne des abonnés à ta page d’auteur.' : 'Abonne-toi à davantage d’auteurs de l’archipel.',
    };
  }
  // 8) Publication de chapitres (auteur) — avant « création » car « Publier un
  //    chapitre de récit » contient « récit ».
  if (isAuthor && has('publi', 'chapitre')) {
    return {
      riddle: '« Ce que l’on couche sur le papier doit un jour rejoindre les lecteurs. »',
      hint: 'Publie davantage de chapitres de tes récits.',
    };
  }
  // 9) Création d'histoires (auteur).
  if (isAuthor && has('créer', 'histoire', 'récit', 'roman', 'univers', 'monde', 'série', 'brouillon', 'couverture', 'résumé', 'projet')) {
    return {
      riddle: '« Celui qui donne naissance à des mondes ne s’arrête jamais à un seul. »',
      hint: 'Crée et étoffe de nouvelles histoires (couverture, résumé, chapitres).',
    };
  }
  // 10) Vues / lectures reçues (surtout côté auteur).
  if (has('vue', 'visite', 'repéré', 'catalogue', 'observé', 'lecteur', 'lecture')) {
    return {
      riddle: '« Quand les regards affluent vers ta plume, le sceau s’éveille. »',
      hint: isAuthor ? 'Fais découvrir tes récits pour accumuler des vues.' : 'Explore et fais vivre les récits de l’archipel.',
    };
  }
  // 11) Lecture de chapitres (lecteur).
  if (has('chapitre', 'page', 'lire', 'dévoré', 'tome', 'liseur', 'terminé', 'achevé', 'volume')) {
    return {
      riddle: '« Celui qui tourne sans relâche les pages verra ce sceau s’illuminer. »',
      hint: 'Continue de lire — et de terminer — des chapitres et des récits.',
    };
  }
  return {
    riddle: '« Un secret de l’archipel attend l’explorateur patient. »',
    hint: isAuthor
      ? 'Continue de créer et de partager tes œuvres sur PLUME.'
      : 'Continue d’explorer, de lire et d’interagir sur PLUME.',
  };
}
