# Base factuelle de la promotion

Les comptes et histoires des captures sont des données de démonstration locales. L'interface est celle du code PLUME, pas une maquette redessinée. Aucun message ou compte privé de production n'est utilisé.

| Fonction montrée | Source dans l'application |
| --- | --- |
| Découverte, recherche, genres, recommandations, reprise | `src/components/HomeView.tsx`, `ExplorerView.tsx` |
| Bibliothèque, statuts, collections, grille/liste, tri, progression | `src/components/LibraryView.tsx`, `src/utils/readingProgress.ts` |
| Taille/police/thèmes, audio par synthèse, ambiance, téléchargement préalable | `src/components/ReadingView.tsx`, `ReaderSettingsSheet.tsx` |
| Notes, surlignages, citations, commentaires par passage, PlumeCards | `src/components/ReadingView.tsx` |
| Profil, suivi, partage de progression soumis à confidentialité | `ProfileView.tsx`, `ProfileReadingSharing.tsx`, `LiveReadingProgress.tsx` |
| Conversations, filtres, épingles personnelles, clubs | `MessagesInbox.tsx`, `MessagesView.tsx` |
| Livres, photos, documents, réponses, réactions, spoilers, notes vocales | `MessagesView.tsx`, `SharedChatContent.tsx`, `src/server/chat.ts` |
| Blocage, signalement, suppression | `ConversationMenu.tsx`, routes serveur |
| Création, couverture, chapitres, tomes, import Word/texte | `WriteView.tsx` |
| Éditeur, brouillons, sauvegarde, publication | `ImmersiveEditor.tsx` |
| Statistiques d'auteur, expérience, niveaux, trophées | `WriteView.tsx`, `ProfileView.tsx` |

La voix off évoque les usages majeurs. Les réglages secondaires apparaissent dans les plans rapprochés. Le propriétaire demande explicitement la conclusion « PLUME, bientôt disponible sur Android et iOS ». C'est une annonce de lancement à venir, sans date ni badge de téléchargement. Ne pas annoncer : disponibilité actuelle sur un store, gratuité intégrale, lecture intégrale sans téléchargement, chiffrement de bout en bout, chiffres d'audience ou gains de temps non mesurés. La lecture audio est une synthèse vocale ; ne pas la présenter comme une narration humaine. Le partage en direct reste facultatif.
