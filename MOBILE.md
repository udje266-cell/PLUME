# Publication mobile (Play Store & App Store)

PLUME est empaquetée en application native via **Capacitor**. La partie web
(`dist/`) est embarquée dans l'app native, qui appelle le backend déployé
(Render) via HTTPS.

## 1. Pré-requis

- **Android** : [Android Studio](https://developer.android.com/studio) + JDK 17.
- **iOS** : un **Mac** avec **Xcode** + CocoaPods (`sudo gem install cocoapods`).
  La génération du projet iOS n'est possible que sur macOS.
- Comptes développeur : **Google Play Console** (25 $, une fois) et
  **Apple Developer Program** (99 $/an).

## 2. Configurer l'URL du backend

L'app native n'a pas de serveur local : tous les appels `/api` sont réécrits
vers `VITE_API_URL`. **Définissez-la au build** (sinon les appels restent
relatifs et échouent) :

```bash
export VITE_API_URL="https://plume-app.onrender.com"   # votre backend déployé
```

## 3. Build du bundle web + synchronisation

```bash
npm install
VITE_API_URL="https://plume-app.onrender.com" npm run cap:sync
```

`cap:sync` lance `vite build` puis copie `dist/` dans les projets natifs.

## 4. Initialiser iOS (sur Mac, une seule fois)

Le dossier `android/` est déjà présent. Pour iOS :

```bash
npx cap add ios
```

## 5. Icônes & splash screens

Les sources sont dans `assets/` (`icon-only.png`, `icon-foreground.png`,
`icon-background.png`, `splash.png`, `splash-dark.png`). Les assets Android
sont déjà générés. Pour (re)générer :

```bash
npm run cap:assets            # toutes plateformes présentes
# ou ciblé :
npx capacitor-assets generate --android
npx capacitor-assets generate --ios     # sur Mac, après `cap add ios`
```

## 6. Ouvrir et builder

```bash
npm run cap:android    # build web + sync + ouvre Android Studio
npm run cap:ios        # build web + sync + ouvre Xcode (Mac)
```

- **Android** : Android Studio → *Build > Generate Signed Bundle/APK* → créez un
  **keystore**, produisez un **AAB** (`.aab`) signé pour le Play Store.
- **iOS** : Xcode → réglez le *Team* de signature → *Product > Archive* →
  *Distribute App* vers App Store Connect.

## 7. Backend de production

- Hébergez le backend en **HTTPS** (déjà le cas sur Render).
- Renseignez les variables d'environnement : `DATABASE_URL`, `JWT_SECRET`
  (≥ 16 caractères), `BREVO_API_KEY`, Cloudinary, et **`CORS_ORIGINS`** /
  `APP_URL` (l'app native est de toute façon autorisée via les origines
  Capacitor par défaut).
- Évitez le plan gratuit Render (mise en veille → démarrage à froid lent).

## 8. Checklist conformité stores

- [x] **Suppression de compte in-app** (Profil → Paramètres → Zone dangereuse).
- [x] **Politique de confidentialité** : `/privacy.html` (URL publique).
- [x] **CGU / EULA** avec tolérance zéro pour les contenus répréhensibles,
      signalement + blocage + traitement sous 24 h : `/terms.html`.
- [x] **Modération UGC** : signalement et blocage intégrés.
- [x] **Classification d'âge** des récits.
- [ ] **Captures d'écran** par taille d'appareil + (Android) *feature graphic*
      1024×500.
- [ ] Formulaires **Data Safety** (Google) et **App Privacy** (Apple).
- [ ] Renseigner l'URL de la politique de confidentialité dans les deux consoles.
