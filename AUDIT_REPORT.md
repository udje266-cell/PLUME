# Rapport d'audit PLUME — 2026-06-11

Audit complet (auth, profil, contenu, synchronisation, sécurité, stabilité APK)
et corrections appliquées. Source de vérité unique : backend Express + PostgreSQL ;
web et APK consomment la **même** API.

---

## 1. Limites de modification pseudo (30 j) / e-mail (90 j) — ✅ FAIT & TESTÉ

**Demande** : pseudo modifiable 1×/30 j, e-mail 1×/90 j, vérifié **en base**
(pas seulement côté client), message clair avec date de prochaine modification,
double sécurité backend + frontend.

**Cause** : aucune limite n'existait — un utilisateur pouvait changer son
identité en boucle (usurpation, contournement de modération, spam).

**Correctif** :
- **Schéma** : colonnes `usernameChangedAt` / `emailChangedAt`
  (migration `20260611000000_add_profile_change_dates`).
- **Backend** (`PUT /api/users/:id`) : compare la requête à l'état **en base**,
  renvoie **HTTP 429** `{ error, field, nextChangeAt }` avec date de déblocage
  si le délai n'est pas écoulé. Horodatage posé à chaque changement réel.
  Admin exempté. Les autres champs (bio…) restent modifiables même verrouillé.
- **Frontend** (`ProfileView`) : pré-vérifie le délai, affiche la date de
  déblocage sous chaque champ, relaie le message serveur sur 429.

**Tests E2E réels** (Postgres + serveur lancés) :
1er pseudo → 200 ; 2e immédiat → **429** (date +30 j) ; 1er e-mail → 200 ;
2e immédiat → **429** (date +90 j) ; bio seule en verrou → 200 ;
admin 2× de suite → 200/200. ✅

**Fichiers** : `prisma/schema.prisma`, `prisma/migrations/20260611000000_*`,
`server.ts`, `src/types.ts`, `src/components/ProfileView.tsx`.

---

## 2. Désynchronisation APK / Web — ✅ RÉSOLU

**Symptôme** : modifications faites sur le web absentes de l'APK (et inverse).

**Cause racine** : l'APK était buildée vers un **mauvais backend**
(`plume-app.onrender.com` = une autre application). L'APK et le web tapaient
donc deux bases différentes.

**Correctif** :
- Toutes les références pointent désormais vers `plume-app-fudd.onrender.com`.
- Le workflow Android injecte `VITE_API_URL` au build (fallback = bon backend).
- `src/utils/api.ts` réécrit `/api` → `${VITE_API_URL}/api` en natif ; le web
  appelle en same-origin. **Une seule source de vérité.**

**Vérification** : aucune logique métier divergente par plateforme. Le cache
`localStorage` (« éditions locales ») est purement optimiste et **vidé à chaque
écriture serveur réussie** → pas de divergence persistante. Une modif web
apparaît sur l'APK et inversement après rechargement.

**Fichiers** (déjà en place) : `src/utils/api.ts`, `.github/workflows/android-release.yml`.

---

## 3. Erreurs spécifiques Android (APK) — ✅ CONFIG VÉRIFIÉE

- `AndroidManifest.xml` : permission `INTERNET` présente.
- Build release **signé** via secrets GitHub (keystore hors dépôt) ; debug intact.
- `VITE_API_URL` injecté au build → l'APK connaît son backend HTTPS.
- Upload Cloudinary : config récupérée au **runtime** via `GET /api/config`
  (les `VITE_CLOUDINARY_*` étant des variables de build absentes de l'APK) ;
  XHR avec progression, timeout 60 s, retry auto unique, erreurs explicites.

**Non vérifiable ici** : exécution réelle sur device/émulateur (indisponible
dans cet environnement). La configuration est correcte ; reste à valider un run
APK réel (cf. §5).

---

## 4. Audit transverse — corrections appliquées (sessions précédentes)

- **Édition de commentaire** restreinte à l'auteur + admin.
- **Fuite de progression** sur chapitres en brouillon corrigée.
- **Plafonds de longueur** sur les entrées + **gardes `JSON.parse`**.
- **Auto-promotion Administrateur interdite** (élévation de privilèges → 403).
- **isVerified** recalculé serveur (non pilotable par le client).
- `flagReason` / e-mail / birthDate exposés uniquement en mode privé.
- Revert d'édition locale sur échec de sauvegarde profil.

---

## 5. Test APK end-to-end — ⏳ À FAIRE SUR DEVICE

Impossible dans cet environnement (pas d'émulateur Android). À exécuter :
build CI → installation APK → login → modif profil (vérifier le verrou 30/90 j)
→ création récit → upload image Cloudinary → vérifier parité avec le web.

---

## 6. Comptes / livres de test — ✅ RAPPORT + OUTIL (aucune suppression auto)

Contenu de démo issu de `prisma/seed.ts`, identifiable par `*.demo@plume.app` :
6 comptes (Elena_Verne, Marcus_Cole, Aria_Sol, Theo_M, Sara_B, Lina_K) et
6 récits (2 chapitres chacun) + engagement.

**Outil livré** : `npm run db:cleanup-demo` (script `prisma/cleanup-demo.ts`).
DRY-RUN par défaut, suppression réelle seulement avec `-- --apply`, **compte
admin protégé**. Testé E2E (détection → dry-run → apply → admin conservé).
À lancer par le propriétaire avec son `DATABASE_URL` (jamais collé en chat).

---

## 7. État de stabilité

| Élément | État |
|---|---|
| Lint (`tsc --noEmit`) | ✅ |
| Build production | ✅ (warnings `import.meta` préexistants, fallback runtime) |
| Limites pseudo/e-mail | ✅ testé E2E |
| Sync web/APK (source unique) | ✅ |
| Config APK (perms, signing, backend, Cloudinary) | ✅ |
| Run APK réel sur device | ⏳ à valider |
| Nettoyage démo prod | ⏳ à lancer par le propriétaire |

**Problèmes non résolus** : aucun bug bloquant identifié. Restent deux actions
**manuelles** côté propriétaire (run APK réel ; lancement du nettoyage démo).

**Stabilité estimée : élevée** — backend unique cohérent, auth stateless,
limites anti-abus en place et testées, build vert.
