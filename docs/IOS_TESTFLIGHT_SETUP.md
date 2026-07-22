# PLUME sur iOS — bêta TestFlight (sans passer par une sortie App Store)

Ce guide te permet de distribuer PLUME en **bêta** à des testeurs iPhone via
**TestFlight**, sans posséder de Mac : tout est buildé, signé et téléversé par le
workflow GitHub Actions **`iOS TestFlight`** (`.github/workflows/ios-testflight.yml`).

Le projet iOS Capacitor est déjà dans le dépôt (`ios/`). Il ne te reste qu'à
créer un compte Apple Developer, générer quelques identifiants, et les coller
dans les **secrets GitHub**. Une fois fait, chaque « Run workflow » produit un
build qui atterrit dans **App Store Connect → TestFlight**.

---

## 0. Prérequis (une seule fois)

- **Apple Developer Program** : ~**99 $/an** — https://developer.apple.com/programs/
  (obligatoire pour TestFlight ; un Apple ID gratuit ne suffit pas pour distribuer
  à d'autres personnes).
- Aucun Mac nécessaire : le build tourne sur un runner **macOS** de GitHub.

---

## 1. Créer la fiche de l'app dans App Store Connect

1. https://appstoreconnect.apple.com → **Mes apps** → **＋** → **Nouvelle app**.
2. Plateforme **iOS**, nom **PLUME**, langue principale **Français**.
3. **Bundle ID** : `com.plume.app` (identique à Android). S'il n'apparaît pas dans
   la liste, crée-le d'abord dans le portail développeur :
   https://developer.apple.com/account/resources/identifiers → **＋** →
   **App IDs** → **App** → Bundle ID *explicit* `com.plume.app`.
4. Renseigne un SKU quelconque (ex. `plume-ios`).

> Tu n'as PAS besoin de remplir toute la fiche App Store pour faire du TestFlight :
> seule une revue « bêta » légère est requise pour les testeurs externes.

---

## 2. Team ID → secret `IOS_TEAM_ID`

https://developer.apple.com/account → **Membership** → copie le **Team ID**
(10 caractères, ex. `A1B2C3D4E5`).

---

## 3. Certificat de distribution → `IOS_DIST_CERT_P12_BASE64` + `IOS_DIST_CERT_PASSWORD`

Il faut un certificat **Apple Distribution** exporté en `.p12`.

### Sans Mac (recommandé, via openssl)
```bash
# a) Génère une clé privée + une demande de signature (CSR)
openssl genrsa -out ios_dist.key 2048
openssl req -new -key ios_dist.key -out ios_dist.csr -subj "/emailAddress=TON_EMAIL/CN=PLUME Distribution/C=FR"
```
- b) Sur https://developer.apple.com/account/resources/certificates → **＋** →
  **Apple Distribution** → téléverse `ios_dist.csr` → télécharge le certificat
  `distribution.cer`.
- c) Reconstitue le `.p12` :
```bash
openssl x509 -in distribution.cer -inform DER -out ios_dist.pem -outform PEM
# Le flag -legacy est IMPORTANT : sans lui, OpenSSL 3.x produit un .p12 en
# chiffrement récent que `security import` (macOS) peut refuser (« MAC
# verification failed ») lors du build CI.
openssl pkcs12 -export -legacy -inkey ios_dist.key -in ios_dist.pem -out ios_dist.p12
#   → choisis un mot de passe : ce sera IOS_DIST_CERT_PASSWORD
base64 -w0 ios_dist.p12 > ios_dist.p12.b64   # (macOS: base64 -i ios_dist.p12 | tr -d '\n')
```
- d) Secrets :
  - `IOS_DIST_CERT_P12_BASE64` = contenu de `ios_dist.p12.b64`
  - `IOS_DIST_CERT_PASSWORD`   = le mot de passe choisi en (c)

> **Garde `ios_dist.key` et `ios_dist.p12` précieusement** (comme le keystore
> Android) — ne les commits jamais.

---

## 4. Clé API App Store Connect → `ASC_KEY_ID`, `ASC_ISSUER_ID`, `ASC_KEY_P8_BASE64`

Cette clé sert au workflow pour créer les profils de provisioning automatiquement
ET téléverser sur TestFlight (pas de mot de passe Apple à stocker).

1. https://appstoreconnect.apple.com/access/integrations/api → **Clés API** →
   **＋**. Rôle **App Manager** (suffisant pour TestFlight).
2. Note le **Key ID** → `ASC_KEY_ID`.
3. Note l'**Issuer ID** (en haut de la page) → `ASC_ISSUER_ID`.
4. Télécharge le fichier **`AuthKey_XXXXXX.p8`** (téléchargeable **une seule fois**).
5. Encode-le :
   ```bash
   base64 -w0 AuthKey_XXXXXX.p8 > asc_key.b64   # (macOS: base64 -i AuthKey_XXXXXX.p8 | tr -d '\n')
   ```
   → `ASC_KEY_P8_BASE64` = contenu de `asc_key.b64`.

---

## 5. (Facultatif) `IOS_KEYCHAIN_PASSWORD`

Mot de passe d'un trousseau temporaire créé pendant le build. Laisse vide : le
workflow en génère un automatiquement. Tu peux en fixer un si tu préfères.

---

## 6. Récapitulatif des secrets GitHub

Settings → **Secrets and variables** → **Actions** → **New repository secret** :

| Secret | Source |
|---|---|
| `IOS_TEAM_ID` | §2 |
| `IOS_DIST_CERT_P12_BASE64` | §3 |
| `IOS_DIST_CERT_PASSWORD` | §3 |
| `ASC_KEY_ID` | §4 |
| `ASC_ISSUER_ID` | §4 |
| `ASC_KEY_P8_BASE64` | §4 |
| `IOS_KEYCHAIN_PASSWORD` | §5 (facultatif) |

Variables (facultatif, réutilisées de l'Android) : `VITE_API_URL`,
`VITE_GOOGLE_CLIENT_ID`, `VITE_CLOUDINARY_*`.

---

## 7. Lancer un build

Onglet **Actions** → **iOS TestFlight** → **Run workflow** (branche `main`).
Le workflow :
1. build le web (`npm run build:mobile`) + `cap sync ios`,
2. signe l'app (signature automatique via la clé API),
3. exporte l'IPA (aussi publié en artefact `PLUME-ios-ipa`),
4. téléverse sur TestFlight.

Après ~5–15 min de traitement Apple, le build apparaît dans **App Store Connect
→ TestFlight**. Ajoute-y tes **testeurs** (internes instantanés, ou externes via
lien/e-mail après une courte revue bêta). Les testeurs installent l'app
**TestFlight** puis PLUME.

> **Numéro de build** : le workflow utilise le numéro de run GitHub comme
> `CURRENT_PROJECT_VERSION`, garantissant l'unicité exigée par TestFlight. La
> version marketing reste `1.0` (modifiable dans `ios/App/App.xcodeproj`).

---

## 8. Limites connues pour la bêta iOS

- **Connexion Google native** : nécessite en plus un **OAuth client iOS** et un
  URL scheme (reversed client ID) dans `Info.plist`. Non configuré pour l'instant ;
  le reste de l'app fonctionne. À ajouter quand tu voudras activer Google sur iOS.
- **Notifications push (APNs)** : nécessitent la capability Push + une clé APNs.
  Non activées pour ce premier build bêta (l'app fonctionne sans).

Ces deux points pourront être ajoutés ensuite sans refaire toute la configuration.
