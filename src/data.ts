/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Story, User, Comment, Message } from './types';

export const GENRES = [
  'Science-Fiction',
  'Thriller & Policier',
  'Romance',
  'Fantasy',
  'Réaliste',
  'Drame',
  'Poésie',
  'Historique',
  'Action',
  'Mystère',
  'Aventure',
  'Surnaturel'
];

export const CATEGORIES = [
  'Roman',
  'Nouvelle',
  'Fanfiction',
  'Poésie',
  'Essai'
];

export const AMBIANCES = [
  'Sombre',
  'Lumineux',
  'Mélancolique',
  'Captivant',
  'Onirique',
  'Mystérieux'
];

export const FORMATS = [
  'Roman Fleuve',
  'Court Métrage Littéraire',
  'Recueil',
  'Micro-fictions'
];

export const LANGUAGES = [
  'Français',
  'Anglais'
];

export const USERS: User[] = [
  {
    id: 'user_reader',
    username: 'Charlotte_B',
    email: 'charlotte@plume.fr',
    role: 'Lecteur',
    avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150',
    bio: 'Passionnée de science-fiction et de romans policiers. Toujours un livre à la main, physique ou virtuel.',
    followers: [],
    following: ['user_author'],
    isVerified: false,
    signUpDate: '2025-11-12',
    favoriteGenres: ['Science-Fiction', 'Thriller & Policier'],
    birthDate: '1998-05-15'
  },
  {
    id: 'user_author',
    username: 'Alexandre_Dumas_Modern',
    email: 'alexandre@plume.fr',
    role: 'Auteur',
    avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150',
    bio: 'Écrivain de l’étrange et du fantastique. Auteur de la trilogie "Les Échos du Cosmos". Inspiré par l’infini et la psychologie humaine.',
    followers: ['user_reader', 'user_mixed'],
    following: [],
    isVerified: true,
    signUpDate: '2025-01-10',
    favoriteGenres: ['Fantasy', 'Drame'],
    birthDate: '1985-01-10'
  },
  {
    id: 'user_mixed',
    username: 'Sophie_L',
    email: 'sophie.lefevre@plume.fr',
    role: 'Auteur',
    avatar: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=150',
    bio: 'J’écris de tendres poésies le soir et je dévore d’intenses thrillers le matin. Bienvenue dans mon cocon créatif ✨',
    followers: ['user_reader'],
    following: ['user_author'],
    isVerified: false,
    signUpDate: '2026-02-14',
    favoriteGenres: ['Poésie', 'Romance', 'Thriller & Policier'],
    birthDate: '2012-04-12'
  },
  {
    id: 'user_admin',
    username: 'Gabriel_Plume_Mod',
    email: 'gaby.mod@plume.fr',
    role: 'Administrateur',
    avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150',
    bio: 'Administrateur principal et garant de la sécurité et du respect des règles de la plateforme PLUME.',
    followers: [],
    following: [],
    isVerified: true,
    signUpDate: '2024-05-01',
    favoriteGenres: [],
    birthDate: '1990-09-20'
  }
];

const ALL_STORIES_DATABANK: Story[] = [
  {
    id: 'story_admin_fantasy_1',
    title: "L'Héritage d'Eldoria",
    description: "Le trône d'Eldoria vacille sous l'ombre d'une ancienne malédiction. Kaelen, dernier né d'une lignée de mages déchus, doit retrouver les fragments de la couronne d'ambre pour raviver le feu sacré de la citadelle avant l'éclipse éternelle.",
    authorId: 'user_admin',
    authorName: 'Gabriel_Plume_Mod',
    authorAvatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150',
    authorVerified: true,
    cover: 'https://picsum.photos/seed/eldoria/400/600',
    genre: 'Fantasy',
    category: 'Roman',
    ambiance: 'Mystérieux',
    format: 'Roman Fleuve',
    language: 'Français',
    likes: 142,
    favoritesCount: 95,
    tags: ['Magie', 'Quête', 'Couronne', 'Épique'],
    status: 'Publié',
    publishDate: '2026-04-10',
    views: 2450,
    reads: 1120,
    rating: 4.8,
    isFlagged: false,
    ageRating: '12',
    chapters: [
      {
        id: 'eldoria_c1',
        title: "Chapitre 1 : Les Vestiges d'Argent",
        content: `### 1. La Poussière des Siècles

Dans les profondeurs des ruines d'Argent, le silence n'était troublé que par le cliquetis régulier des gouttes d'eau infiltrées à travers la voûte de calcaire. Kaelen ajusta sa bure d'un geste nerveux, serrant fermement sa dague de rituel contre sa cuisse. Depuis l'écorchement céleste, aucun vivant n'avait osé franchir le seuil des Archives d'Eldoria.

— La lumière faiblit, Kaelen. C'était la voix tremblante d'Yseult, son apprentie.

Il leva sa paume droite. D'une simple impulsion spirituelle, les glyphes gravés dans sa peau s'illuminèrent d'une lueur azurée douce, repoussant l'épaisse pénombre qui pesait sur eux. Au centre de la pièce reposait le premier coffre d'ambre. Une lueur dorée s'en échappait par intermittence, tel un cœur de feu mourant.

### 2. L'Affrontement

Soudain, le sol trembla. Une silhouette de goudron liquide s'éleva des dalles disjointes, ses yeux de braise fixés sur Kaelen. C'était un Gardien d'Ombre, lié par le sang des anciens souverains pour protéger les secrets de la couronne d'ambre.

— Recule, Yseult ! ordonna-t-il en dégainant son arme.

Le monstre bondit dans un grognement assourdissant. Kaelen esquiva sur le côté, traçant une rune de barrière dans l'air. L'onde de choc repoussa le déserteur spirituel, mais Kaelen savait que sa réserve de mana s'épuisait rapidement. Il devait s'emparer du fragment avant l'effondrement de la voûte.`,
        publishDate: '2026-04-10',
        isPublished: true,
        views: 1300,
        reads: 650
      },
      {
        id: 'eldoria_c2',
        title: "Chapitre 2 : La Malédiction des Rois",
        content: `### 1. Le Fragment Obtenu

Le cœur battant, Kaelen referma ses mains gantées sur le fragment d'ambre. Une chaleur fulgurante parcourut son bras, gravant de nouvelles lignes de puissance dans ses circuits magiques. Le gardien poussa un sifflement d'opprobre avant de s'évaporer dans la brume du manoir.

— Nous l'avons, murmura Yseult, des larmes de soulagement aux yeux.

— Ce n'est que la première étape, répondit Kaelen sombrement. Les rois d'Eldoria n'ont pas seulement caché ces reliques ; ils y ont insufflé leur propre folie. 

Ses yeux se posèrent sur l'inscription gravée à la base du socle de pierre. L'ancien oracle annonçait clairement que quiconque réunirait les trois cristaux devrait affronter le reflet de sa propre folie d'esprit.

### 2. En route vers la Citadelle

Dehors, le vent soufflait en bourrasques glaciales. Le ciel d'or se teintait déjà d'indigo à l'approche de la grande éclipse. Traversant la forêt de cyprès figés, le duo savait que les brigands de la plaine rouge ne rateraient pas l'occasion d'intercepter des porteurs de reliques royales. Ils devaient trouver refuge avant l'aube.`,
        publishDate: '2026-04-12',
        isPublished: true,
        views: 1150,
        reads: 470
      }
    ]
  },
  {
    id: 'story_admin_action_2',
    title: "Opération Blackout",
    description: "Lorsque le réseau de communication mondial s'éteint brutalement, l'agent d'élite Marc Stone se retrouve piégé derrière les lignes ennemies à Genève. Sans liaison radio, il doit escorter une informatrice détenant la clé de relance du système.",
    authorId: 'user_admin',
    authorName: 'Gabriel_Plume_Mod',
    authorAvatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150',
    authorVerified: true,
    cover: 'https://picsum.photos/seed/blackout/400/600',
    genre: 'Action',
    category: 'Roman',
    ambiance: 'Captivant',
    format: 'Roman Fleuve',
    language: 'Français',
    likes: 98,
    favoritesCount: 61,
    tags: ['Tactique', 'Infiltration', 'Suisse', 'Thriller'],
    status: 'Publié',
    publishDate: '2026-03-22',
    views: 1620,
    reads: 840,
    rating: 4.6,
    isFlagged: false,
    ageRating: '16',
    chapters: [
      {
        id: 'blackout_c1',
        title: "Chapitre 1 : Silence Radio à Genève",
        content: `### 1. Le Crépuscule Numérique

Les lumières de la rade de Genève s'éteignirent d'un coup sec, plongeant le lac Léman dans un gouffre d'obscurité totale. Au trentième étage de l'hôtel de verre, Marc Stone compta les secondes. Son oreillette tactique n'émettait plus qu'un grésillement analogique statique. 

Le blackout mondial venait de frapper, précisément à l'heure prévue par les terroristes de l'Aube Noire.

— Stone, la cible s'est enfuie par les escaliers de secours de l'aile ouest, signala une voix paniquée dans le hall.

Marc réajusta son gilet pare-balles et sortit son pistolet silencieux de son étui. Sans électricité, les ascenseurs étaient des pièges mortels. Il devait agir à l'ancienne, en se fiant uniquement à ses instincts et à ses plans de secours physiques.

### 2. L'Informatrice

Il la rattrapa au niveau du dixième sous-sol, dissimulée derrière un énorme transformateur électrique hors d'état. Elena, l'ingénieure en chef d'Oracle Systems, serrait contre elle une sacoche en cuir imperméable.

— Ils sont déjà dans le bâtiment, Stone, chuchota-t-elle. Ils ne veulent pas mes données, ils veulent m'effacer du système mondial.

— Restez derrière moi, répondit Marc froidement. Nous sortons par les égouts d'écoulement pluvial.`,
        publishDate: '2026-03-22',
        isPublished: true,
        views: 870,
        reads: 450
      },
      {
        id: 'blackout_c2',
        title: "Chapitre 2 : La Poursuite sur le Pont",
        content: `### 1. La Fuite sous la Brume

L'odeur de terre mouillée et de béton humide de l'égout offrait une couverture sensorielle idéale. Marc Stone ouvrit la marche, sa lampe de poche enveloppée d'un filtre rouge pour préserver leur vision nocturne. Derrière lui, Elena gardait un silence de mort.

Soudain, des bruits de pas cadencés résonnèrent au bout du conduit. Des lampes stroboscopiques balayèrent l'eau boueuse à moins de cinquante mètres.

— Ils ont quadrillé la zone de sortie, chuchota Marc. Ils ont des détecteurs de radiations thermiques portables.

Il dégoupilla une grenade fumigène et la jeta dans le couloir adjacent pour faire diversion, avant d'engager Elena dans une cheminée de maintenance menant directement aux abords du pont du Mont-Blanc.

### 2. Le Saut du Risque

Arrivés sur le pont déserté par l'absence totale de feux de signalisation, ils furent pris pour cibles par un tireur embusqué sur un toit voisin. Les balles claquaient violemment sur le bitume gelé.

— Stone ! Nous sommes coincés ! cria Elena.

Marc regarda par-dessus le parapet du pont. Les eaux noires et tumultueuses du Rhône défilaient dix mètres plus bas. 

— Vous savez nager ? demanda-t-il.

Sans attendre sa réponse, il la saisit à la taille et bascula dans le vide sous une pluie d'étincelles provoquée par les ricochets des balles policières sur le métal du pont.`,
        publishDate: '2026-03-24',
        isPublished: true,
        views: 750,
        reads: 390
      }
    ]
  },
  {
    id: 'story_admin_romance_3',
    title: "Un Souffle sous les Cerisiers",
    description: "Clara s'envole pour Kyoto afin d'oublier un deuil douloureux. Sa rencontre inattendue avec Hiro, un artisan paysagiste discret et meurtri par le passé, va changer sa vision de la vie au rythme des bourgeons printaniers.",
    authorId: 'user_admin',
    authorName: 'Gabriel_Plume_Mod',
    authorAvatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150',
    authorVerified: true,
    cover: 'https://picsum.photos/seed/cerisiers/400/600',
    genre: 'Romance',
    category: 'Roman',
    ambiance: 'Onirique',
    format: 'Nouvelle',
    language: 'Français',
    likes: 165,
    favoritesCount: 120,
    tags: ['Japon', 'Zen', 'Guérison', 'Amour'],
    status: 'Publié',
    publishDate: '2026-02-14',
    views: 2900,
    reads: 1480,
    rating: 4.9,
    isFlagged: false,
    ageRating: 'all',
    chapters: [
      {
        id: 'cerisiers_c1',
        title: "Chapitre 1 : La Pluie de Kyoto",
        content: `### 1. Le Pays des Songes

Kyoto s'éveillait sous une fine bruine argileuse qui donnait aux temples de bois des reflets de cendre mouillée. Clara serra son imperméable beige, ébahie par la beauté tranquille du quartier de Higashiyama. Elle avait fui Paris, son tumulte et ses souvenirs encombrants pour se perdre dans ce sanctuaire extrême-oriental.

Près d'un canal bordé de lanternes éteintes, ses yeux croisèrent un homme accroupi, taillant avec une infinie délicatesse les branches basses d'un vieux pin séculaire.

— Vous devriez faire attention, la mousse est glissante, dit-il dans un français parfait mais teinté d'un accent chantant.

Clara sursauta. Elle s'arrêta, observant son visage marqué par la concentration et la douceur. 

— J'ai l'habitude de la pluie, répondit-elle doucement.

### 2. Le Premier Échange

Il se leva, essuyant ses mains calleuses sur un tablier de coton indigo. Il s'appela Hiro. Il s'occupait des jardins de la ville depuis plus de vingt ans. Chaque arbre était pour lui un poème vivant qu'il fallait guider sans jamais le contraindre de force.

— Parfois, les cicatrices d'une branche font sa force à l'automne, ajouta Hiro en désignant une greffe solide sur le tronc d'un prunier.

Clara resta silencieuse, touchée par la résonance étrange de ses paroles avec son propre cœur blessé. Elle accepta son invitation à boire un thé vert grillé sous l'auvent en bois de son atelier.`,
        publishDate: '2026-02-14',
        isPublished: true,
        views: 1500,
        reads: 780
      },
      {
        id: 'cerisiers_c2',
        title: "Chapitre 2 : L'art du Kintsugi",
        content: `### 1. Le Bol Brisé

Dans l'atelier d'Hiro, l'odeur de terre cuite, de thé vert chaud et de pin résineux enveloppait l'atmosphère d'une paix presque sacrée. Sur une étagère reposaient de nombreux récipients de céramique aux jointures rehaussées de lignes d'or étincelantes.

— C’est du Kintsugi, expliqua Hiro en tendant un bol réparé à Clara. L'art de souligner les fêlures plutôt que de chercher à les cacher à tout prix.

— C’est magnifique... mais cela n’efface pas le choc d'origine, murmura Clara d'une voix étranglée par une émotion soudaine.

— Rien n'efface la blessure, Clara, murmura-t-il doucement en frôlant ses doigts froids. Mais l'or rend l'histoire du bol plus noble et plus résistante qu'auparavant.

### 2. Une Nouvelle Saison

Au fil des jours, Hiro fit découvrir à Clara les recoins secrets de Kyoto : les bambouseraies d’Arashiyama au crépuscule, le vol silencieux des hérons au-dessus de la rivière Kamo. Clara comprit qu'elle n'avait pas simplement trouvé un guide au Japon, mais une âme miroir capable d'entendre ses silences.

Le vent souffla, emportant les premiers pétales roses des cerisiers sauvages vers le fleuve calme. Pour la première fois depuis des mois, Clara esquissa un sourire serein et confiant en repensant à l'avenir.`,
        publishDate: '2026-02-16',
        isPublished: true,
        views: 1400,
        reads: 700
      }
    ]
  },
  {
    id: 'story_admin_sf_4',
    title: "La Cité des Nuages",
    description: "Dans une haute atmosphère saturée de gaz toxiques, l'humanité a trouvé refuge dans des cités flottantes géantes. Mais la panne subite du générateur d'antigravité d'Altis menace de précipiter un million d'âmes vers le sol toxique.",
    authorId: 'user_admin',
    authorName: 'Gabriel_Plume_Mod',
    authorAvatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150',
    authorVerified: true,
    cover: 'https://picsum.photos/seed/clouds/400/600',
    genre: 'Science-Fiction',
    category: 'Roman',
    ambiance: 'Sombre',
    format: 'Roman Fleuve',
    language: 'Français',
    likes: 115,
    favoritesCount: 78,
    tags: ['Aviation', 'Futuriste', 'Technologie', 'Suspense'],
    status: 'Publié',
    publishDate: '2026-01-05',
    views: 1980,
    reads: 950,
    rating: 4.7,
    isFlagged: false,
    ageRating: '12',
    chapters: [
      {
        id: 'clouds_c1',
        title: "Chapitre 1 : Le Bourdonnement d'Altis",
        content: `### 1. Le ciel de soufre

À soixante kilomètres d'altitude, au-dessus des plaines corrosives de Vénus, Altis flottait comme une méduse géante d'acier inoxydable et de polymère renforcé. Solal observait la couche nuageuse jaune canari par le hublot de la salle des machines. Le bruit sourd et familier du générateur de champ gravitationnel s'était soudainement mis à bafouiller, émettant des vibrations inquiétantes qui fesaient tressaillir les boulons de la plate-forme.

— Solal ! La pression d'hélium du dôme 4 subit une chute exponentielle ! appela l'ingénieur de garde.

— Déclenchez le couplage thermique manuel des compresseurs ! répondit Solal en se ruant vers le sas de régulation thermique.

Il enfila son lourd casque de protection sous pression et commença la descente dans le puits central de la cité des nuages.

### 2. Le Signal Alarme

Tandis que la cité vacillait de quelques degrés sur son flanc ouest, une forte odeur d'ozone envahit le local technique. La liaison magnétique d'un des stabilisateurs extérieurs venait de lâcher, soumettant la coque à des contraintes structurelles dramatiques. Si la dépressurisation continuait, Altis coulerait dans l'enfer acide vénusien en moins de vingt minutes académiques.`,
        publishDate: '2026-01-05',
        isPublished: true,
        views: 1050,
        reads: 500
      },
      {
        id: 'clouds_c2',
        title: "Chapitre 2 : La Chute Libre",
        content: `### 1. Le Vide d'Altitude

L'air s'échappait de la turbine d'admission ouest dans un sifflement déchirant qui masquait les communications internes. Solal s'accrocha à la passerelle oscillante de toutes ses forces, observant l'immensité moutonneuse des nuages toxiques qui défilaient rapidement sous ses pieds de métal.

La gravité artificielle de la cité venait de chuter à 0,4g, fasant flotter les outils d'entretien comme d'étranges éclats métalliques autour de lui.

— Solal, la valve principale de retour gaz est grippée ! Il faut la briser physiquement avec un marteau pneumatique !

Il se hissa tant bien que mal le long des parois glacées de condensation, serrant l'outil de secours entre ses pinces magnétiques. 

### 2. Le Choc thermique

Chaque pas vers la valve manquait de le précipiter dans le vide mortel de la basse atmosphère. D'un mouvement désespéré, il frappa le clapet d'admission gelé par l'azote liquide. Un jet de vapeur argentée l'aveugla un instant, mais le ronronnement sourd et puissant du générateur gravitationnel reprit enfin son rythme régulier d'origine. La cité d'Altis venait d'être stabilisée à l'arraché, à quelques centaines de mètres seulement de sa hauteur de non-retour.`,
        publishDate: '2026-01-08',
        isPublished: true,
        views: 930,
        reads: 450
      }
    ]
  },
  {
    id: 'story_admin_mystery_5',
    title: "L'Énigme du Manoir Grey",
    description: "Le riche mécène Arthur Grey est retrouvé empoisonné dans sa bibliothèque fermée de l'intérieur. La détective privée Hélène Royer s'intéresse à l'étrange horloge astronomique du manoir, dont les aiguilles se sont arrêtées précisément à 11h32.",
    authorId: 'user_admin',
    authorName: 'Gabriel_Plume_Mod',
    authorAvatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150',
    authorVerified: true,
    cover: 'https://picsum.photos/seed/grey/400/600',
    genre: 'Mystère',
    category: 'Roman',
    ambiance: 'Sombre',
    format: 'Court Métrage Littéraire',
    language: 'Français',
    likes: 121,
    favoritesCount: 84,
    tags: ['Enquête', 'Cluedo', 'Poison', 'Sherlock'],
    status: 'Publié',
    publishDate: '2026-05-01',
    views: 2130,
    reads: 1010,
    rating: 4.7,
    isFlagged: false,
    ageRating: '16',
    chapters: [
      {
        id: 'grey_c1',
        title: "Chapitre 1 : Le Poison Silencieux",
        content: `### 1. La Pièce Close

La biblioteca du manoir Grey conservait une odeur d'encaustique de citron et de cuir vermoulu. Au centre de la vaste pièce, affalé sur son fauteuil d'acajou, Arthur Grey semblait dormir paisiblement. Seul le liseré bleuâtre de ses lèvres trahissait l'action foudroyante du cyanure d'alkyle.

Hélène Royer observa la porte massive en chêne. Elle était verrouillée de l'interieur par deux verrous de bronze massifs, et les fenêtres gothiques étaient condamnées depuis la dernière rénovation de sécurité de l'architecte du domaine.

— C'est un suicide parfait, commissaire, dit le jeune neveu d'Arthur d'une voix mal assurée.

— On ne se suicide pas en prenant la peine de dissimuler le flacon de poison, répliqua Hélène d'une voix cassante. Et on ne laisse pas ses archives personnelles brûler dans la cheminée juste avant de mourir.

### 2. Le Détail Horloger

Elle s'approcha de la haute horloge astronomique adossée à la cloison ouest. Les magnifiques cadrans de laiton affichaient la position exacte de Jupiter et de la Lune. Mais ce furent les aiguilles dorées qui attirèrent son attention de détective. Elles s'étaient figées précisément à 11h32, or l'autopsie estimait la crise cardiaque d'Arthur vers l'aube, à 5 heures du matin.`,
        publishDate: '2026-05-01',
        isPublished: true,
        views: 1100,
        reads: 540
      },
      {
        id: 'grey_c2',
        title: "Chapitre 2 : Les Rouages du Temps",
        content: `### 1. La Cachette d'Acier

Hélène Royer enfila ses gants fins en coton blanc pour inspecter le socle vermillon de l'horloge Grey. D'une pression discrète sur le chiffre zodiacal de la Balance, un tiroir secret dissimulé se déverrouilla dans un petit claquement d'engrenage poli.

À l'intérieur reposait un jeu de cire rouge enveloppant un codicille de testament raturé d'une écriture rageuse, écrit de la main même d'Arthur.

— Son propre testament l'excluait de tout héritage au profit de la fondation d'art de la ville, remarqua-t-elle à haute voix en désignant le neveu qui blêmit immédiatement sous l'accusation.

— C’est un faux grossier ! s'insurgea ce dernier, reculant nerveusement de quelques pas vers la sortie ouverte.

— Et le mécanisme de l'horloge contenait un dispositif de diffusion gazeuse télécommandé par ondes hertziennes, conclut-elle en montrant un minuscule relais connecté aux rouages dorés.`,
        publishDate: '2026-05-03',
        isPublished: true,
        views: 1030,
        reads: 470
      }
    ]
  },
  {
    id: 'story_admin_adventure_6',
    title: "Le Trésor de l'Archipel Perdu",
    description: "Munis d'une mystérieuse carte en parchemin héritée de son grand-père, Lucas et son équipage naviguent vers les eaux inexplorées du Pacifique Sud. Entre tempêtes tropicales et récifs acérés, la forêt vierge de l'île de l'Ours cache bien plus qu'un coffre d'or.",
    authorId: 'user_admin',
    authorName: 'Gabriel_Plume_Mod',
    authorAvatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150',
    authorVerified: true,
    cover: 'https://picsum.photos/seed/treasure/400/600',
    genre: 'Aventure',
    category: 'Roman',
    ambiance: 'Captivant',
    format: 'Roman Fleuve',
    language: 'Français',
    likes: 137,
    favoritesCount: 92,
    tags: ['Pirates', 'Exploration', 'Îles', 'Nature'],
    status: 'Publié',
    publishDate: '2026-04-05',
    views: 2280,
    reads: 1090,
    rating: 4.8,
    isFlagged: false,
    ageRating: 'all',
    chapters: [
      {
        id: 'treasure_c1',
        title: "Chapitre 1 : L'Héritage Salé",
        content: `### 1. La Carte aux contours d'or

L'encre noire de la carte de marine s'était en partie dissoute sous les embruns salés accumulés sur les étagères de la vieille cabine de son grand-père. Lucas caressa le parchemin d'une main rieuse. La rumeur disait vrai : la constellation de l'Ours de Mer menait bien à un récif corallien fantôme oublié par les relevés de position officiels du satellite moderne.

— Capitaine, la tempête de mousson arrive par l'est ! Le baromètre baisse à vue d'œil, signala la vigie.

— Maintenez le cap à vingt degrés ouest ! Nous devons franchir la passe avant la tombée de la nuit tropicale !

La coque en acajou du *Sillage-Blanc* grinçait sous la poussée des vagues géantes trépidantes, franchissant les écumes blanches des premiers récifs de corail.

### 2. L'Île fantôme

Au petit matin, après une nuit de lutte dantesque contre la mer déchaînée, la proue du navire s'échoua sur le sable blanc d'une plage circulaire déserte. Devant eux se dressait une jungle impénétrable de fougères arborescentes géantes, dominée par le pic rocheux sculpté à la forme brute d'une oreille d'ours.`,
        publishDate: '2026-04-05',
        isPublished: true,
        views: 1180,
        reads: 590
      },
      {
        id: 'treasure_c2',
        title: "Chapitre 2 : Dans la Jungle de l'Ours",
        content: `### 1. La Piste végétale

Traverser la jungle tropicale requérait une vigilance de chaque instant, tant les lianes épineuses et les marécages masquaient les pièges terrestres. Lucas marchait en tête de file, sa boussole de cuivre fermement arrimée à sa paume gauche.

Soudain, une dalle de basalte sculptée s'enfonça sous le talon d'un de ses marins. Un sifflement mécanique d'air comprimé retentit dans la canopée silencieuse.

— Attention ! À terre ! hurla Lucas.

Une volée de flèches de bambou séché passa en sifflant à quelques centimètres d'eux, venant se planter dans le tronc massif d'un bananier sauvage voisin.

### 2. Les Vestiges d'un Autre Âge

Au terme d'une marche harassante de six heures, ils débouchèrent sur une esplanade pavée d'orichalque au flanc de la montagne sacrée. Au centre trônait un temple cyclopéen envahi par d'immenses racines rousses d'arbres étranges. Ce qui les attendait à l'intérieur n'était pas un simple tas de pièces dorées, mais une sphère d'énergie pure tournant doucement sur elle-même.`,
        publishDate: '2026-04-07',
        isPublished: true,
        views: 1100,
        reads: 500
      }
    ]
  },
  {
    id: 'story_admin_supernatural_7',
    title: "Les Murmures de l'Hiver",
    description: "Chaque hiver, à l'approche du solstice, les habitants de Val-Neige s'enferment avant le coucher du soleil. Car c'est à ce moment que des ombres errantes descendent de la montagne brumeuse pour réclamer de vieilles promesses oubliées.",
    authorId: 'user_admin',
    authorName: 'Gabriel_Plume_Mod',
    authorAvatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150',
    authorVerified: true,
    cover: 'https://picsum.photos/seed/winter/400/600',
    genre: 'Surnaturel',
    category: 'Nouvelle',
    ambiance: 'Mélancolique',
    format: 'Recueil',
    language: 'Français',
    likes: 104,
    favoritesCount: 68,
    tags: ['Fantômes', 'Légendes', 'Neige', 'Frisson'],
    status: 'Publié',
    publishDate: '2026-01-10',
    views: 1750,
    reads: 890,
    rating: 4.6,
    isFlagged: false,
    ageRating: 'all',
    chapters: [
      {
        id: 'winter_c1',
        title: "Chapitre 1 : La Première Neige",
        content: `### 1. Le village blanc

Val-Neige s'était tapi au creux du vallon du mont Maudit comme un nid de moineaux frileux. Depuis trois générations, toute activité cessait dès que la brume blanche descendait des cimes de granit roussies.

Thomas réajusta le loquet en fonte de sa grange massive. Il détestait le sifflement mélancolique du vent d'est qui s'insinuait à travers les fentes du bois séché.

— Ne regarde pas dehors après le glas de l'église, Thomas, l'avait prévenu sa grand-mère. Ils cherchent les esprits chaleureux pour alimenter leur éternel exil blanc.

Mais ce soir-là, à travers le carreau givré de sa fenêtre d'atelier, il distingua une lueur bleutée vacillante qui flottait au-dessus de la murette de pierre du cimetière abandonné.

### 2. L'Ombre de la Promesse

Malgré la consigne ancestrale de son clan, il ouvrit la lourde porte en chêne. La neige crissa doucement sous ses pas de feutre. Devant lui se dressait une femme au teint translucide, revêtue d'une robe de lin neigeux brodée de glaçons de givre pur.

— Tu m'as promis ma liberté, Thomas, dit-elle d'une voix qui ressemblait à la cassure d'une vitre de lac gelé.`,
        publishDate: '2026-01-10',
        isPublished: true,
        views: 900,
        reads: 460
      },
      {
        id: 'winter_c2',
        title: "Chapitre 2 : Les Ombres du Solstice",
        content: `### 1. Le Pacte Scellé

Thomas resta cloué au sol, incapable de fermer les yeux face à la déesse hivernale. L'air s'était brutalement chargé de particules de glace étincelantes, gelant ses sourcils et ses cils en un instant.

— Je n'ai fait aucune promesse, murmura-t-il, sa voix tremblante d'effroi. C'était mon aïeul, il y a plus de cent ans d'ici.

— Les promesses de sang n'ont pas de date de fin pour notre peuple, répondit-elle en glissant un doigt glacé sur son front brûlant.

Un flot d'images et de souvenirs anciens s'insinua dans l'esprit de Thomas : le grand incendie de 1822 sauvé par un pacte de fraîcheur éternelle conclu avec les démons de la montagne blanche.

### 2. Le Sacrifice de Chaleur

Thomas comprit le fardeau qui pesait sur son sang. Pour libérer le village de Val-Neige de cette visite hivernale annuelle terrifiante, il devait accepter d'offrir une part de son feu intérieur aux esprits des glaces. Un échange silencieux s'accomplit sous le regard imperturbable des étoiles dorées, scellant le destin du hameau pour le siècle à venir.`,
        publishDate: '2026-01-12',
        isPublished: true,
        views: 850,
        reads: 430
      }
    ]
  },
  {
    id: 'story_admin_drama_8',
    title: "L'Écho de nos Silences",
    description: "Après dix ans de séparation forcée, deux frères se retrouvent dans la maison de campagne familiale à la suite d'un testament inattendu. Les vieux secrets resurgissent, forçant chacun à affronter la tragédie qui a déchiré leur famille.",
    authorId: 'user_admin',
    authorName: 'Gabriel_Plume_Mod',
    authorAvatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150',
    authorVerified: true,
    cover: 'https://picsum.photos/seed/silence/400/600',
    genre: 'Drame',
    category: 'Roman',
    ambiance: 'Mélancolique',
    format: 'Roman Fleuve',
    language: 'Français',
    likes: 88,
    favoritesCount: 54,
    tags: ['Famille', 'Retrouvailles', 'Psychologique', 'Secret'],
    status: 'Publié',
    publishDate: '2026-05-10',
    views: 1410,
    reads: 720,
    rating: 4.5,
    isFlagged: false,
    ageRating: 'all',
    chapters: [
      {
        id: 'silence_c1',
        title: "Chapitre 1 : La Lettre Notariée",
        content: `### 1. Le Retour au Pays

Le portail en fer forgé du domaine des Genêts grinça douloureusement, fendant l'air tiède de cette fin d'après-midi de mai. Nicolas s'arrêta sur le perron, contemplant les touffes d'orties et de pissenlits qui s'étaient frayé un chemin à travers les dalles du vieux jardin familial.

Dix ans qu'il n'avait plus parlé à son jeune frère Julien. Dix ans d'un exil volontaire passé à Montréal pour oublier l'après-midi tragique de l'été 2016.

— Tu n'as pas changé, murmura une voix grave derrière lui.

Julien se tenait là, accoudé à la rampe en chêne poussiéreuse, ses mains enfoncées profondément dans les poches de sa vieille veste de laine grise. Ses traits s'étaient durcis, mais son regard restait celui de l'enfant apeuré d'autrefois.

### 2. L'Héritage Maudit

Entre les deux hommes se dressait une lourde boîte de vieux dossiers et de photographies roussies posée sur la table de la cuisine déserte. C'était l'ensemble de la succession d'Arthur, leur défunt grand-père, dont le testament exigeait impérativement une signature conjointe pour déverrouiller le domaine de famille. Nicolas savait que cette étape administrative allait libérer des démons qu'il pensait enterrés depuis des décennies.`,
        publishDate: '2026-05-10',
        isPublished: true,
        views: 730,
        reads: 380
      },
      {
        id: 'silence_c2',
        title: "Chapitre 2 : Les Confrontations de l'Aube",
        content: `### 1. Les Pièces Manquantes

Le silence se fit de plus en plus pesant à mesure que les ombres de la nuit envahissaient le salon inhabité de la maison de campagne. Nicolas contemplait un polaroid jauni montrant leur mère souriante devant le grand chêne de l'étang.

— C’est toi qui as pris le journal intime de maman après l'accident, Julien. N'est-ce pas ? accusa brusquement Nicolas d'une voix sourde.

Julien se redressa brusquement, son visage pâle traversé par un tressautement de colère folle.

— Tu m'as laissé seul porter les accusations du village pendant que tu t'enfuyais au Canada ! s'écria-t-il. Tu n'as aucun droit de venir me réclamer des comptes maintenant !

### 2. Le Pardon Tardif

Les cris s'estompèrent, ne laissant place qu'aux bruits rythmiques de la pendule à coucou de l'escalier rustique. Hésitant, Julien posa un petit carnet de cuir rouge usé sur la table en bois usée. Tout y était consigné : les vérités poignantes d'une famille déchirée par les devoirs et les non-dits d'origine. Pour les deux frères, ce moment de douleur intense offrait enfin le chemin libérateur vers un deuil décent et une réconciliation inespérée.`,
        publishDate: '2026-05-12',
        isPublished: true,
        views: 680,
        reads: 340
      }
    ]
  },
  {
    id: 'story_cosmos_1',
    title: 'Les Échos du Cosmos',
    description: 'En 2142, l’astrophysicienne Léa Thorne intercepte un signal crypté provenant de la constellation d’Orion. Ce qu’elle décrypte ne ressemble pas à un langage extraterrestre, mais plutôt à un avertissement d’un futur qu’elle pensait impossible. Un voyage philosophique et scientifique au bout des étoiles.',
    authorId: 'user_author',
    authorName: 'Alexandre_Dumas_Modern',
    authorAvatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150',
    authorVerified: true,
    cover: 'https://picsum.photos/seed/cosmos/400/600',
    genre: 'Science-Fiction',
    category: 'Roman',
    ambiance: 'Mystérieux',
    format: 'Roman Fleuve',
    language: 'Français',
    likes: 124,
    favoritesCount: 88,
    tags: ['Espace', 'Intelligence Artificielle', 'Futur', 'Philosophique'],
    status: 'Publié',
    publishDate: '2026-03-15',
    views: 1850,
    reads: 920,
    rating: 4.8,
    isFlagged: false,
    ageRating: '12',
    chapters: [
      {
        id: 'cosmos_c1',
        title: 'Chapitre 1 : Le Frémissement d’Orion',
        content: `### 1. Le Signal

La coupole de l'observatoire chilien de Paranal flottait à près de trois mille mètres d'altitude, émergeant de la mer de nuages du désert d'Atacama comme la vigie d'un navire de pierre sur un océan de coton blanc. Léa aimait cet instant de la nuit, celui où l'air se faisait si froid et si sec que chaque inspiration piquait les bronches avec une clarté divine.

— Léa, tu devrais venir voir ça. Le bruit de fond sur le canal 21 augmente sans aucune explication locale.

C'était la voix fatiguée de Thomas, son assistant, relayée par l'interphone grésillant. Léa réajusta son grand col roulé violet et s'approcha des trois écrans incurvés de son poste de contrôle. 

Le graphique à cascades affichait une anomalie. Ce n'était pas le crépitement chaotique des radiations de fond, ni le balayage rythmique d'un pulsar lointain. C'était une oscillation régulière, une sinusoïde qui semblait respirer doucement.

— C'est modulé, chuchota-t-elle, craignant de briser l'étrange solennité de la pièce. Quelle est la source exacte ?

— Ascension droite 05h 35m, déclinaison -05 degrés. Juste en plein cœur des filaments d'Orion. Près de la nébuleuse de la Tête de Cheval.

Léa sentit un frisson courir le long de sa colonne vertébrale. Ce n'était pas juste un bruit cosmique. Une forme d'expression, structurée, compressée, venait de parcourir mille cinq cents années-lumière pour frapper leur parabole polie.

### Le Décryptage

La première phase du traitement informatique passa la structure mathématique à la moulinette de l'algorithme d'entropie de Shannon. La réponse fut immédiate : d'une complexité phénoménale. Il ne s'agissait pas de bruit blanc. La densité d'information était trop élevée pour un phénomène naturel.

— Nous avons un motif, Thomas. Lance le protocole de décompression géométrique.

L'ordinateur moulina pendant trois longues heures. Léa faisait les cent pas en buvant un café tiède et amer. Puis, les premiers idéogrammes mathématiques commencèrent à se dessiner sur le moniteur central. 

Ce n'étaient pas des équations inconnues. C'était des équations issues de la relativité humaine, mais rédigées avec une constante cosmologique légèrement décalée, résolue pour une structure spatio-temporelle complexe.

Sous les formules, des mots en français se dessinèrent, encodés en format binaire standard.

*« NE CHERCHEZ PAS À PASSER LA BARRIÈRE. NOUS SOMMES VOTRE DEMAIN, ET LE DEMAIN N’A PLUS DE CIEL. »*`,
        publishDate: '2026-03-15',
        isPublished: true,
        views: 800,
        reads: 500
      },
      {
        id: 'cosmos_c2',
        title: 'Chapitre 2 : La Barrière Infinie',
        content: `### 2. L'Effroi et la Fascination

Les mots restèrent gravés sur l'écran chrétien, blanc sur noir, impitoyables. Thomas s'était laissé glisser sur sa chaise de bureau, les yeux écarquillés, son gobelet en carton oublié au creux de sa paume.

— Comment est-ce possible ? balbutia-t-il enfin. Le français ? Le codage ASCII ? C’est un canular, Léa. Quelqu'un s’est branché sur notre réseau. Un hacker du MIT ou d’ailleurs.

— Personne ne peut simuler une source stellaire avec une telle cohérence de parallaxe, Thomas. J’ai vérifié trois fois. Les interférences ionosphériques prouvent que la source est bien en dehors du système solaire. Et le signal provient précisément de coordonnées sidérales pures.

Elle s’approcha du moniteur, posant ses doigts fins sur la dalle de verre glacée. 

— « Nous sommes votre demain... » Pourquoi cette langue ? Pourquoi cette époque ? 

Soudain, une alarme stridente retentit au pupitre ouest. La parabole subissait de légères contraintes de torsion magnétique. Quelque chose d'autre que des ondes radio venait d'atteindre le site d'Atacama. Un faisceau de neutrinos si dense qu’il venait littéralement de faire réagir les capteurs de l'ordinateur de bord.

### Le Télescope Fléchit

Léa ordonna à Thomas de braquer le miroir optique de 8,2 mètres sur le point focal d'Orion. 

La caméra de l'interféromètre commença à empiler les poses à haute résolution. Au milieu de la poussière d’étoile rosie, une fente d'ombre pure s’était ouverte. Un vide de lumière absolu.

— C’est une distorsion gravitationnelle, une singularité artificielle minuscule. Thomas... nous ne regardons pas une étoile. Nous regardons le point terminal d'un trou de ver microscopique.

Le signal reprit, avec une ferveur renouvelée. Cette fois, ce fut un flux de données graphiques complet qui se déversa dans le disque dur de la base chilienne. C’était une structure tridimensionnelle, le plan architectural d’une clé magnétique capable de manipuler le vide quantique.

Le conseil mondial devait être informé. Mais à quelle vitesse l’information allait-elle fuiter ? Léa savait que dans quelques heures, l’armée et les consortiums privés d’extractions orbitales s’empareraient de l’Atacama.`,
        publishDate: '2026-03-20',
        isPublished: true,
        views: 650,
        reads: 320
      }
    ]
  },
  {
    id: 'story_cliff_2',
    title: 'L’Ombre de la Falaise',
    description: 'Une petite ville côtière bretonne est secouée par l’apparition de mystérieuses gravures sur le granit des falaises, visibles uniquement à marée basse. Quand un historien local disparaît, la gendarme Sarah Ménez comprend que les légendes locales de marins perdus cachent des secrets de famille impitoyables.',
    authorId: 'user_mixed',
    authorName: 'Sophie_L',
    authorAvatar: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=150',
    authorVerified: false,
    cover: 'https://picsum.photos/seed/cliff/400/600',
    genre: 'Thriller & Policier',
    category: 'Nouvelle',
    ambiance: 'Sombre',
    format: 'Court Métrage Littéraire',
    language: 'Français',
    likes: 89,
    favoritesCount: 52,
    tags: ['Bretagne', 'Mystère', 'Enquête', 'Océan'],
    status: 'Publié',
    publishDate: '2026-04-02',
    views: 1100,
    reads: 650,
    rating: 4.5,
    isFlagged: false,
    ageRating: '16',
    chapters: [
      {
        id: 'cliff_c1',
        title: 'Chapitre UNIQUE : L’Écume Rouge',
        content: `### Le Granit qui pleure

La brume bretonne collait sur les joues comme un drap mouillé. Sarah Ménez coupa le moteur de sa patrouilleuse sur le haut de la pointe du Raz. La mer, cinquante mètres plus bas, hurlait contre les écueils noirs dans un fracas démoniaque. 

Elle descendit, allumant sa torche puissante. Christian, le vieil historien du village, avait garé sa vieille Citroën sur le bas-côté deux jours auparavant. On n'avait plus aucune nouvelle de lui depuis.

— Sarah ! Viens voir en bas ! C’est Éric, son jeune équipier, qui criait depuis la plage de galets contournant le phare.

La descente était abrupte, glissante sous l’humidité marine. Arrivée en bas, Sarah fut saisie par l’odeur d’iode et de décomposition végétale. Éric pointait le faisceau de sa propre lampe vers une paroi rocheuse polie par des millénaires d'océan.

Gravées profondément dans le granit, à hauteur d'homme, s'alignaient trois vagues successives surmontées d'un œil grand ouvert. La coupe était récente, nette, exempte de toute patine saline. Et pourtant, cette zone était engloutie sous six mètres d'eau froide à chaque marée haute.

— C’est la marque de l’Abysse, murmura Éric, livide. Les naufrageurs du XVIIe siècle l'utilisaient pour signer leurs trahisons. 

— Christian n'était pas un naufrageur, répondit Sarah d'une voix sèche. C’était un chercheur. Mais il avait découvert qu'une des grandes familles de la commune continue de toucher les dividendes d’un trésor dérobé à un navire espagnol échoué en 1802.

Soudain, une vague plus haute que les autres vint frapper la falaise, jetant de l'écume froide sur leurs bottes de cuir. Dans le retrait rapide de l'eau, un éclat d'os blanc apparut, coincé dans les fractures du granit sculpté.`,
        publishDate: '2026-04-02',
        isPublished: true,
        views: 1100,
        reads: 650
      }
    ]
  },
  {
    id: 'story_fantasy_3',
    title: 'Le Chant du Vent d’Opal',
    description: 'Dans le royaume d’Olyria, le vent ne souffle jamais sans but. Chaque rafale transporte des mélodies antiques dotées de pouvoirs curatifs ou destructeurs. Alyssia, une jeune « Capteuse de brise », apprend à apprivoiser le redoutable Siphon d’Or, un courant d’air capable d’effacer la mémoire de ceux qui s’y exposent.',
    authorId: 'user_author',
    authorName: 'Alexandre_Dumas_Modern',
    authorAvatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150',
    authorVerified: true,
    cover: 'https://picsum.photos/seed/wind/400/600',
    genre: 'Fantasy',
    category: 'Roman',
    ambiance: 'Onirique',
    format: 'Roman Fleuve',
    language: 'Français',
    likes: 156,
    favoritesCount: 110,
    tags: ['Magie', 'Instruments', 'Royaume', 'Épique'],
    status: 'Publié',
    publishDate: '2026-01-20',
    views: 2200,
    reads: 1150,
    rating: 4.9,
    isFlagged: false,
    ageRating: 'all',
    chapters: [
      {
        id: 'wind_c1',
        title: 'Chapitre 1 : Les Cloches d’Opal',
        content: `### Les Éoliennes Célestes

Chaque matin, à l'heure où les trois soleils d'Olyria commençaient leur course asymétrique dans le ciel couleur lavande, Alyssia grimpait au sommet de la Tour des Murmures. À son flanc gauchi se balançait son capteur : un réseau complexe de flûtes d'os léger et d'entonnoirs en cuivre poli.

Le vent de l'est apportait aujourd'hui une mélodie agile, un la bémol continu teinté d'accords de joie printanière. C'était la brise de la récolte, celle qui faisait mûrir les blés bleus en quelques heures de caresse.

— Chante, belle brise, murmura-t-elle en actionnant doucement les pistons de son étui. Chante pour nos greniers.

Soudain, le vent changea brusquement d'octave. Un sifflement strident, presque métallique, balaya la plaine d'Opal. Les cloches de la tour s'agitèrent frénétiquement dans une cadence de panique.

Alyssia sentit ses tympans vibrer douloureusement. Ce n'était plus la brise nourricière. C'était le *Siphon d’Or*, le redoutable courant des plaines interdites d'asphalte noir. Elle devait fermer sa boîte de résonance immédiatement, sous peine de voir ses souvenirs d’enfance fondre comme neige au soleil.`,
        publishDate: '2026-01-20',
        isPublished: true,
        views: 1200,
        reads: 700
      }
    ]
  },
  {
    id: 'story_flagged_demo',
    title: 'Sons d’Encre et de Pluie (Contenu Flagged)',
    description: 'Une histoire poétique et mélancolique sur les manuscrits perdus de Paris. Cette histoire a été signalée par un lecteur car elle contient une citation plagiée, permettant d’illustrer la modération de l’administrateur !',
    authorId: 'user_mixed',
    authorName: 'Sophie_L',
    authorAvatar: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=150',
    authorVerified: false,
    cover: 'https://picsum.photos/seed/rain/400/600',
    genre: 'Poésie',
    category: 'Poésie',
    ambiance: 'Mélancolique',
    format: 'Recueil',
    language: 'Français',
    likes: 4,
    favoritesCount: 2,
    tags: ['Pluie', 'Mélancolie', 'Plagiat', 'Guerre'],
    status: 'Publié',
    publishDate: '2026-05-15',
    views: 45,
    reads: 10,
    rating: 2.1,
    isFlagged: true,
    flagReason: 'Citation plagiée d’un ouvrage protégé de 2012 sans attribution.',
    ageRating: '18',
    chapters: [
      {
        id: 'rain_c1',
        title: 'Chapitre 1 : Les Vers Solitaires',
        content: `### L'encre mélancolique

La pluie tambourine sur les zincs gris de Paris, comme les doigts pressés d'une dactylo d'un autre siècle. J'écris sur de vieux carnets que la poussière a épargnés, mais dont les mots restent en sursis.

Le plagiat supposé se trouve ici dans cette strophe recopiée mot pour mot de l'encyclopédie littéraire sans l'autorisation de l'auteur d'origine. Les administrateurs peuvent censurer ou dépublier cette oeuvre d'un clic sur leur panneau dédié.`,
        publishDate: '2026-05-15',
        isPublished: true,
        views: 45,
        reads: 10
      }
    ]
  }
];

export const INITIAL_STORIES: Story[] = ALL_STORIES_DATABANK.filter(story => story.authorId !== 'user_admin' && story.genre !== 'Bibliothèque');

export const INITIAL_COMMENTS: Comment[] = [
  {
    id: 'comment_1',
    storyId: 'story_cosmos_1',
    chapterId: 'cosmos_c1',
    userId: 'user_reader',
    username: 'Charlotte_B',
    avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150',
    content: 'Une idée fantastique ! Le signal provenant d’Orion donne de réels frissons. J’aime beaucoup le style minimaliste et l’ambiance contemplative de ton écriture ! Vivement la suite.',
    date: '2026-03-16T10:30:00Z',
    likes: 12,
    replies: [
      {
        id: 'reply_1',
        userId: 'user_author',
        username: 'Alexandre_Dumas_Modern',
        avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150',
        content: 'Merci Charlotte ! Le chapitre 2 explore un peu plus en détail la nature de cette étrange barrière quantique. J’espère que cela te plaira tout autant !',
        date: '2026-03-16T12:15:00Z'
      }
    ]
  },
  {
    id: 'comment_2',
    storyId: 'story_cosmos_1',
    chapterId: 'cosmos_c1',
    userId: 'user_mixed',
    username: 'Sophie_L',
    avatar: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=150',
    content: 'La citation de Shannon et le concept géométrique du signal sont superbement décrits. Chapeau l’auteur 💜',
    date: '2026-03-17T18:45:00Z',
    likes: 8,
    replies: []
  },
  {
    id: 'comment_3',
    storyId: 'story_cliff_2',
    chapterId: 'cliff_c1',
    userId: 'user_reader',
    username: 'Charlotte_B',
    avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150',
    content: 'Cette ambiance de Bretagne sous la brume est excellemment rendue. On s’y croirait. La tension monte très vite pour un chapitre unique !',
    date: '2026-04-03T09:12:00Z',
    likes: 5,
    replies: []
  }
];

export const INITIAL_MESSAGES: Message[] = [
  {
    id: 'msg_1',
    senderId: 'user_reader',
    senderName: 'Charlotte_B',
    senderAvatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150',
    receiverId: 'user_author',
    receiverName: 'Alexandre_Dumas_Modern',
    receiverAvatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150',
    content: 'Bonjour Alexandre, je me demandais si vous comptiez sortir une version papier de "Les Échos du Cosmos" ? Je serais ravie de l’avoir dans ma bibliothèque !',
    date: '2026-05-28T14:20:00Z',
    isRead: true
  },
  {
    id: 'msg_2',
    senderId: 'user_author',
    senderName: 'Alexandre_Dumas_Modern',
    senderAvatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150',
    receiverId: 'user_reader',
    receiverName: 'Charlotte_B',
    receiverAvatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150',
    content: 'Bonjour Charlotte ! C’est un projet auquel je réfléchis oui. Pour l’instant je me concentre sur la rédaction du tome 2 mais je garde l’auto-édition papier en ligne de mire. Merci beaucoup pour votre soutien si précieux !',
    date: '2026-05-28T16:05:00Z',
    isRead: true
  },
  {
    id: 'msg_3',
    senderId: 'user_mixed',
    senderName: 'Sophie_L',
    senderAvatar: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=150',
    receiverId: 'user_author',
    receiverName: 'Alexandre_Dumas_Modern',
    receiverAvatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150',
    content: 'Coucou Alexandre ! Un retour critique sur mon premier chapitre de l’Ombre de la Falaise t’intéresserait ? On pourrait s’entraider entre auteurs !',
    date: '2026-05-29T10:00:00Z',
    isRead: false
  }
];
