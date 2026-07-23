# PLUME — Checklist de lancement officiel

Ce guide rassemble tout ce qu'il faut vérifier/faire **avant** de publier PLUME
(web déjà en ligne sur Render, Android via le Play Store, iOS via TestFlight).

> Raccourci : `GET /api/admin/diagnostic` (connecté en **admin**) te dit d'un
> coup d'œil si les points critiques sont au vert (`readyToPublish: true`).

---

## 0. Vérifier la config de PRODUCTION (bloquant)

Ouvre, connecté en admin dans le navigateur :
```
https://plume-app-fudd.onrender.com/api/admin/diagnostic
```

`readyToPublish` doit être `true`. Les 4 points **critiques** :

| Point | Pourquoi c'est bloquant |
|---|---|
| `nodeEnv = production` | Active cookies `secure`, HSTS, CORS strict, désactive `demo-login`. |
| `database` | Connexion Postgres vivante. |
| `jwtSecret` | Secret fort (≥16 car., pas la valeur par défaut) sinon des tokens forgeables. |
| `email` (**BREVO_API_KEY**) | **Sans ça, aucun code OTP n'est envoyé → personne ne peut s'inscrire.** |

Variables Render à confirmer (Settings → Environment) : `NODE_ENV=production`,
`JWT_SECRET`, `DATABASE_URL`, `DIRECT_URL`, `BREVO_API_KEY`, `SMTP_FROM`,
`ADMIN_PASSWORD`, `GOOGLE_CLIENT_ID`, `VITE_GOOGLE_CLIENT_ID`,
`VITE_CLOUDINARY_CLOUD_NAME`, `VITE_CLOUDINARY_UPLOAD_PRESET`, `CORS_ORIGINS`,
`APP_URL`.

---

## 1. Base de données Neon — connexion poolée (recommandé)

Les logs Render montrent parfois `prisma:error … PostgreSQL connection: Closed`.
C'est bénin (coupure d'une connexion Neon inactive / redéploiement) mais on le
supprime en passant par le **pooler** :

1. Neon → **Connection Details** → active **« Pooled connection »** (l'hôte
   contient alors `-pooler`).
2. Render → Environment :
   - `DATABASE_URL` = URL **poolée** + `?sslmode=require&pgbouncer=true`
   - `DIRECT_URL` = URL **directe** (non poolée) — pour les migrations
3. Redeploy.

> Le `schema.prisma` est déjà prêt (`url` + `directUrl`).
> Bonus : un plan Render payant supprime la mise en veille (cold start ~50 s).

---

## 2. Sauvegardes & sécurité (déjà en place)

- ✅ Sauvegarde hebdo chiffrée de la base (GitHub Action `db-backup.yml`).
- ✅ Revue de sécurité passée (CSP bloquante, assainissement HTML serveur,
  rate-limiting, OTP robuste, contrôle d'accès). Voir l'historique des commits.
- Vérifier une fois que la CSP ne bloque rien de légitime : logs Render →
  chercher `CSP-REPORT` (doit être vide en usage normal).

---

## 3. Google Play Store (Android)

Prérequis : compte **Google Play Console** (25 $, une fois).

1. **Générer l'AAB signé** : onglet GitHub **Actions → Android release (AAB) →
   Run workflow**. Récupérer l'artefact `PLUME-release-aab`.
2. Play Console → **Créer l'application** (nom PLUME, langue FR).
3. **Fiche du Store** : description, icône 512×512, captures d'écran
   (téléphone + éventuellement tablette), bannière.
4. **Politique de confidentialité** : renseigner l'URL
   `https://plume-app-fudd.onrender.com/privacy.html`.
5. **Data safety** : déclarer les données collectées (e-mail, contenu créé,
   éventuellement notifications). L'app **permet la suppression de compte**
   (obligatoire) → l'indiquer.
6. **Content rating** : remplir le questionnaire IARC.
7. **Public cible** : 13 ans et + (cohérent avec le gating d'âge de l'app).
8. Choisir un canal : **test fermé** (recommandé d'abord) puis **production**.
9. Uploader l'**AAB**, remplir la note de version, envoyer en revue.

> `targetSdk 36` : conforme aux exigences Play. `com.plume.app` = identifiant
> de package.

---

## 4. iOS TestFlight (bêta)

Voir `docs/IOS_TESTFLIGHT_SETUP.md`. Résumé : compte Apple Developer (99 $/an),
créer l'app dans App Store Connect (bundle `com.plume.app`), fournir 7 secrets
GitHub, puis **Actions → iOS TestFlight → Run workflow**.

---

## 5. Test réel de bout en bout (en prod, avant d'ouvrir au public)

- [ ] Inscription e-mail → **réception effective du code OTP** → compte créé.
- [ ] Connexion e-mail + **connexion Google**.
- [ ] Mot de passe oublié → réception du code → réinitialisation.
- [ ] Publier une œuvre + un chapitre ; la lire ; reprise de lecture.
- [ ] Commentaire, like, favori, note.
- [ ] Messagerie (envoi/réception temps réel), groupe de lecture.
- [ ] Upload d'avatar / couverture (Cloudinary).
- [ ] Notifications (nouveau chapitre aux abonnés).
- [ ] **Suppression de compte** (efface bien toutes les données).
- [ ] Installer l'APK signé sur un vrai téléphone et refaire les points clés.

---

## 6. Recommandé avant une grosse audience (non bloquant)

- **Images en base64 dans la base** → migrer vers Cloudinary (le vrai frein
  d'échelle : ça alourdit la base et les payloads).
- **Monitoring d'erreurs** (Sentry ou équivalent) pour voir les crashes en prod.
- **Clé Gemini** avec un quota utilisable (sinon l'assistant IA échouera pour
  les utilisateurs — ou masquer la fonction au lancement).
- **CSP → mode strict confirmé** : déjà en bloquant ; surveiller `CSP-REPORT`.
- **Plan Render payant** : supprime les cold starts (~50 s) au réveil.

---

## Récapitulatif « prêt à publier »

- [ ] `/api/admin/diagnostic` → `readyToPublish: true`
- [ ] Neon en connexion poolée (plus de `Closed` en boucle)
- [ ] Parcours de bout en bout OK en prod (surtout **e-mail OTP**)
- [ ] Fiche Play Store complète (privacy, data safety, content rating)
- [ ] AAB signé uploadé et envoyé en revue
