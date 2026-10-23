# SPEC — PLUME « Prends la plume » (piste A)

GOAL : une lectrice ou un lecteur francophone découvre tout ce que PLUME permet, lire, écouter, partager, écrire, et retient : « là, je lis… et un jour, j'écris ».
OUTPUT : HyperFrames, 1080 × 1920, 30 fps, H.264/AAC (TikTok).
TIME : 127,5 s = 3825 images. La voix (124,96 s, « Manon », ElevenLabs) est l'horloge : chaque scène commence sur sa phrase (`assets/audio/words.json`). Musique 113 BPM (15,9 images/temps), lit sous la voix.

LOOK :
- Sols : jour #F4F0FB (lavande des cartes de l'app) avec halo blanc radial de 900 px à 60 % ; sépia #EFE2CC (thème Sépia du lecteur) ; nuit #0F0A1C avec halo #2B1752 à 35 % ; aplat de marque #7C3AED (violet de l'app) réservé à la bascule « c'est toi qui prends la plume » et à l'affirmation finale.
- Encre #181224 ; secondaire #6B6480 ; accent #7C3AED ; accent sur sombre #C4A8FF.
- Titres : Source Serif 4 (la serif de l'app) 700, 104–150 px, interlettrage −3 %, interligne 1,0. Sous-titres : Inter 800, 50 px, blancs avec contour encre de 9 px ; mot prononcé sur pastille violette #7C3AED, rayon 14 px.
- Téléphone : graphite #17141F, 442 × 926 px, rayon 70 ; écran 416 × 900 (capture 1170 × 2532 à 0,3555), rayon 56 ; îlot 118 × 34 ; ombre 0 46 90 rgba(24,18,36,.30) sur clair, rgba(0,0,0,.55) sur sombre.
- Médium : la vraie interface (captures 390 × 844 @3x), jamais redessinée ; seules les découpes « soulevées » en sortent, à 1,6–1,9× leur taille à l'écran (texte ≥ 28 px).

OBJECTS : le téléphone de face ; *La Cartographe des Marées* (la même couverture traverse l'accueil, la fiche, la lecture, la bibliothèque, la discussion, le club) ; le bouton plume de la barre d'onglets ; le logo PLUME officiel (`assets/brand`).

MOTION :
- Arrivée : expo.out 0,7 s. Caméra (punch-in) : power2.inOut 0,6 s, zoom 1,7–2,3× vers le contrôle nommé par la voix, puis tenue immobile. Retour : power2.inOut 0,5 s.
- Navigation dans l'app : nouvel écran de x 100 % → 0 en 0,42 s power3.out, l'ancien recule de −28 % et s'assombrit de 25 %. Feuille (réglages, assistant) : y 100 % → 0 en 0,45 s expo.out.
- Découpe soulevée : de sa place dans l'écran vers sa cible, échelle 1 → 1,7, 0,6 s expo.out, ombre 0 → 0 40 80 rgba(24,18,36,.35) ; sortie 0,3 s power3.in.
- Mots cinétiques : par mot, flou 8 → 0 px et opacité 0 → 1 en 0,16 s, 0,07 s d'écart ; une fois posés, immobiles.
- Transitions (5 sortes, chacune causée) : la couverture devient la page (objet → monde) ; aplat de couleur au changement de thème ; carte de livre portée de la discussion au club ; zoom à travers le bouton plume ; volet horizontal entre deux mondes.

SHOTS (secondes ; voix entre guillemets) :
| # | Temps | Plan |
|---|---|---|
| 01 | 0–7,15 | « Ton prochain livre préféré… » en grand dès l'image 0 au-dessus d'un éventail de 7 couvertures ; « …pas encore en librairie » : les couvertures s'effacent ; « Il s'écrit en ce moment » : le téléphone monte, l'éditeur tape ses lignes ; « chapitre après chapitre » : la liste des chapitres glisse. |
| 02 | 7,15–8,35 | Aplat violet : « PLUME » en serif blanche. |
| 03 | 8,35–16,05 | Le mot rétrécit dans l'en-tête de l'accueil (portée) ; « lire / écrire / partager » : la caméra va de « Reprendre ma lecture » au bouton plume, puis à Messages. |
| 04 | 16,05–27,15 | Quatre couvertures arrivent sur « Romance, fantasy, thriller, huis clos » ; « Pour vous », recherche « lune », filtre Fantasy. |
| 05 | 27,15–33,55 | Fiche : synopsis, chapitres, temps de lecture ; « tu plonges » : la couverture grandit jusqu'à devenir la page sépia. |
| 06 | 33,55–46,1 | Lecteur sépia ; réglages (8 thèmes, 13 polices) ; clair, sépia, OLED avec aplat du sol ; défilement automatique. |
| 07 | 46,1–53,27 | Nuit : carte « Lecture audio » ; ambiance Pluie ; téléchargement coché. |
| 08 | 53,27–61,82 | Passage choisi, surligné, annoté, PlumeCard ; commentaires du paragraphe. |
| 09 | 61,82–69,78 | Bibliothèque ; collections ; deuxième téléphone sombre : même livre, même chapitre. |
| 10 | 69,78–77,42 | Messages ; carte de livre envoyée ; spoiler révélé ; note vocale ; bouton d'appel. |
| 11 | 77,42–82,14 | Clubs ; sondage ; lecture en direct du club. |
| 12 | 82,14–88,18 | Parcours, niveaux ; trophées ; « Légende débloquée ». |
| 13 | 88,18–91,1 | « Et puis un jour… » : caméra sur le bouton plume ; zoom à travers ; aplat violet « c'est toi qui prends la plume ». |
| 14 | 91,1–102,1 | Atelier ; création (couverture, genres, ambiance, chapitres ou tomes) ; Importer ; éditeur immersif qui tape. |
| 15 | 102,1–110,25 | Assistant : découper, ponctuation, titre ; retour au texte. |
| 16 | 110,25–118,78 | « Mettre en ligne » → « Publié » ; notification chez un abonné ; statistiques ; « décrochage ». |
| 17 | 118,78–121,42 | Aplat violet : LIRE. ÉCRIRE. PARTAGER. un mot par temps de voix. |
| 18 | 121,42–127,5 | Logo PLUME officiel (plume puis mot), « Bientôt disponible sur » + Android et iOS avec leurs logos ; tenu 3 s. |

BANNED : sol sombre vide avec de petits éléments flottants ; lueurs, néons, particules ; dégradés violets en fond (le dégradé violet n'apparaît que sur les vrais boutons de l'app) ; cartes en verre ; trois cartes de fonctions en rangée ; tout qui glisse vers le haut en fondu ; titres qui bougent pendant la lecture ; boucles de flottement ; cercles de tapotement ; interface inclinée en 3D ; interface redessinée ; logo dans un coin ; capture déformée.

QA : chaque scène à +0,4 s et au milieu ; raccords ±0,2 s ; sous-titres jamais tronqués (≤ 2 lignes, largeur ≤ 900 px) ; texte et produit dans la bande 168–1330 px ; aucune donnée privée de production ; fin de voix « Android et iOS » puis carton tenu ; mixage −14 à −16 LUFS, crête ≤ −1 dBTP.
