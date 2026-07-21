# Configuration « Continuer avec Google »

Cette fonctionnalité est **prête dans le code** mais **inactive** tant que les
identifiants OAuth Google ne sont pas renseignés. Sans configuration :

- le bouton « Continuer avec Google » **ne s'affiche pas** ;
- l'endpoint `POST /api/auth/google` renvoie `503` ;
- **tout le reste de l'application continue de fonctionner normalement.**

Une fois configuré : création/connexion de compte en un clic, avec vérification
du jeton **côté serveur** (aucun mot de passe Google n'est manipulé).

---

## 1. Google Cloud Console — créer les identifiants OAuth

1. Va sur <https://console.cloud.google.com/> → crée (ou choisis) un projet.
2. **APIs & Services → OAuth consent screen** : configure l'écran de consentement
   (type « External », nom de l'app « PLUME », e-mail d'assistance, domaines).
   Ajoute-toi comme *test user* tant que l'app est en mode test.
3. **APIs & Services → Credentials → Create Credentials → OAuth client ID**, une
   fois par plateforme :

   ### a) Web (obligatoire — sert aussi de « serverClientId » au natif)
   - Type : **Web application**
   - **Authorized JavaScript origins** :
     - `https://plume-app-fudd.onrender.com`
     - `http://localhost:3000` (dev)
   - **Authorized redirect URIs** : (aucune nécessaire pour Google Identity
     Services, on peut laisser vide)
   - → tu obtiens un **Web Client ID** `xxxx.apps.googleusercontent.com`.
     C'est LE plus important.

   ### b) Android (pour l'app APK)
   - Type : **Android**
   - **Package name** : `com.plume.app`
   - **SHA-1** de la clé de signature. Récupère-le depuis ton keystore :
     ```bash
     keytool -list -v -keystore plume-release.jks -alias plume
     ```
     copie la ligne `SHA1:` (format `AB:CD:...`).
   - → Android Client ID. (Le token natif est vérifié avec le **Web** Client ID
     comme audience — voir §2.)

   ### c) iOS (si/quand un build iOS existe)
   - Type : **iOS**, **Bundle ID** : `com.plume.app`
   - → iOS Client ID + un « reversed client ID » à mettre dans `Info.plist`.

---

## 2. Variables d'environnement

### Serveur (Render → Environment)
| Variable | Valeur |
|---|---|
| `GOOGLE_CLIENT_ID` | le **Web** Client ID |
| `GOOGLE_CLIENT_IDS` *(optionnel)* | `web,android,ios` séparés par des virgules si tu ajoutes les natifs |

> Le serveur accepte un ID token dont l'`aud` est **l'un** de ces IDs. Sur
> Android, le plugin natif présente un token dont l'audience est le **Web**
> Client ID (`webClientId`), donc `GOOGLE_CLIENT_ID` = Web suffit dans la
> plupart des cas.

### Web + build mobile (build-time, préfixe `VITE_`)
| Où | Variable | Valeur |
|---|---|---|
| Render (service web) → Environment | `VITE_GOOGLE_CLIENT_ID` | le **Web** Client ID |
| GitHub → Settings → Secrets and variables → Actions → **Variables** | `VITE_GOOGLE_CLIENT_ID` | le **Web** Client ID (pour l'APK) |

> `VITE_GOOGLE_CLIENT_ID` est lu **au build**. Après l'avoir posé sur Render,
> redéploie ; pour l'APK, relance le workflow *Android release*.

---

## 3. Android — dernière étape

Le plugin `@capgo/capacitor-social-login` est déjà installé et synchronisé par
le workflow (`npx cap sync android`). Il utilise le **Web Client ID** comme
`webClientId` (transmis à l'exécution). Il faut juste que le **SHA-1** de la clé
de signature (§1.b) soit enregistré dans le client OAuth Android, sinon Google
refuse la connexion sur l'appareil.

> Astuce : Google Play App Signing peut re-signer l'app avec une autre clé.
> Si tu publies sur le Play Store, enregistre AUSSI le SHA-1 fourni par la
> console Play (Setup → App signing).

---

## 4. Vérifier que ça marche

- **Web** : ouvre le site, écran de connexion → le bouton officiel Google
  apparaît. Un clic → compte créé/connecté.
- **Serveur** : `POST /api/auth/google` avec un `idToken` valide renvoie
  `{ token, user }`. Sans `GOOGLE_CLIENT_ID`, il renvoie `503`.
- **Android** : dans l'app, le bouton « Continuer avec Google » ouvre le
  sélecteur de compte natif.

---

## 5. Ce que fait le serveur (sécurité)

1. Reçoit l'**ID token** (jamais de mot de passe).
2. Le **vérifie** via `google-auth-library` (signature Google + audience +
   expiration).
3. Retrouve le compte par `googleId`, sinon par **e-mail** (anti-doublon : on
   lie le `googleId` au compte existant), sinon **crée** un compte.
4. Ouvre une session (même JWT + cookie httpOnly `plume_token` que la connexion
   classique) → la session **persiste** après fermeture de l'app jusqu'à la
   déconnexion volontaire.
