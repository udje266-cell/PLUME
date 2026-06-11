# Héberger PLUME gratuitement 24h/24 — Oracle Cloud « Always Free »

Oracle Cloud offre une VM **gratuite à vie**, jamais en veille (contrairement au
plan gratuit Render). Ce guide déploie PLUME (backend + frontend + PostgreSQL +
HTTPS) sur une VM Ubuntu. Comptez ~30-45 min.

> 💳 Oracle demande une **carte bancaire pour vérification**, mais les ressources
> « Always Free » ne sont **pas facturées**.

---

## 1. Créer le compte et la VM

1. Inscris-toi sur **https://www.oracle.com/cloud/free/**.
2. Console Oracle → **Compute → Instances → Create Instance**.
3. **Image** : Ubuntu 22.04 (ou 24.04).
4. **Shape** : clique *Change Shape* → **Ampere (ARM)** → `VM.Standard.A1.Flex`
   → règle **2 OCPU / 12 Go RAM** (dans l'enveloppe Always Free : 4 OCPU/24 Go).
   *(« Always Free eligible » doit être affiché.)*
5. **SSH keys** : laisse Oracle générer une clé et **télécharge la clé privée**
   (ou colle ta clé publique).
6. **Create**. Note l'**IP publique** de la VM.

## 2. Ouvrir les ports 80 et 443

Oracle bloque tout par défaut, à **deux** niveaux :

**a) Security List (réseau Oracle)** : VM → *Virtual Cloud Network* → *Security
Lists* → *Default* → **Add Ingress Rules** :
- Source `0.0.0.0/0`, IP Protocol **TCP**, Destination port **80**
- Source `0.0.0.0/0`, IP Protocol **TCP**, Destination port **443**

**b) Pare-feu de la VM** (Ubuntu Oracle utilise iptables) — après SSH (étape 3) :
```bash
sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 80 -j ACCEPT
sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 443 -j ACCEPT
sudo netfilter-persistent save
```

## 3. Se connecter en SSH

```bash
chmod 600 ta-cle-privee.key
ssh -i ta-cle-privee.key ubuntu@IP_PUBLIQUE
```

## 4. Installer les dépendances (Node, PostgreSQL, Git, Caddy)

```bash
sudo apt update && sudo apt upgrade -y
# Node.js 20 (ARM64 supporté)
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs git postgresql
# Caddy (reverse proxy + HTTPS auto)
sudo apt install -y debian-keyring debian-archive-keyring apt-transport-https curl
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | sudo tee /etc/apt/sources.list.d/caddy-stable.list
sudo apt update && sudo apt install -y caddy
```

## 5. Configurer PostgreSQL

```bash
sudo -u postgres psql <<'SQL'
CREATE DATABASE plume;
CREATE USER plume WITH PASSWORD 'METS_UN_VRAI_MOT_DE_PASSE';
GRANT ALL PRIVILEGES ON DATABASE plume TO plume;
\c plume
CREATE EXTENSION IF NOT EXISTS unaccent;
GRANT ALL ON SCHEMA public TO plume;
SQL
```

## 6. Récupérer et préparer PLUME

```bash
cd ~
git clone https://github.com/udje266-cell/plume.git PLUME
cd PLUME
npm install
npm run build          # build web (same-origin) + serveur + seed
```

## 7. Variables d'environnement

```bash
sudo cp deploy/plume.env.example /etc/plume.env
sudo nano /etc/plume.env        # renseigne DATABASE_URL (le mot de passe ci-dessus),
                                # JWT_SECRET, BREVO_API_KEY, Cloudinary, ADMIN_PASSWORD,
                                # APP_URL (ton domaine)
sudo chmod 600 /etc/plume.env
```

## 8. Domaine gratuit + HTTPS

1. Va sur **https://www.duckdns.org** (connexion Google/GitHub) → crée un
   sous-domaine (ex. `plume-app`) → mets l'**IP publique** de ta VM → *update*.
   Tu obtiens `plume-app.duckdns.org`.
2. Configure Caddy :
```bash
sudo cp deploy/Caddyfile.example /etc/caddy/Caddyfile
sudo nano /etc/caddy/Caddyfile   # remplace par ton-sous-domaine.duckdns.org
sudo systemctl restart caddy
```
Caddy obtient automatiquement un certificat HTTPS (Let's Encrypt).

## 9. Lancer PLUME en service (toujours actif, redémarrage auto)

```bash
sudo cp deploy/plume.service /etc/systemd/system/plume.service
sudo systemctl daemon-reload
sudo systemctl enable --now plume
sudo systemctl status plume          # doit être "active (running)"
sudo journalctl -u plume -f          # logs (cherche [ADMIN] ✅ et "en écoute")
```

## 10. Vérifier

```bash
curl https://ton-sous-domaine.duckdns.org/api/stories     # -> du JSON
```
Ouvre `https://ton-sous-domaine.duckdns.org` dans un navigateur → l'app PLUME.

## 11. Pointer l'app mobile vers ce backend

Rebuild l'APK / l'AAB avec la nouvelle URL :
```bash
VITE_API_URL="https://ton-sous-domaine.duckdns.org" npm run cap:android
```
(ou mets `VITE_API_URL` en variable du dépôt pour les workflows CI).

---

## Mises à jour ultérieures
```bash
cd ~/PLUME && git pull && npm install && npm run build && sudo systemctl restart plume
```

## Avantages / limites
- ✅ **Gratuit à vie, always-on**, pas de cold start, base **non expirable** (tu
  la maîtrises), 24 Go RAM possibles.
- ⚠️ **Sauvegardes** à ta charge : planifie un `pg_dump` régulier.
  ```bash
  pg_dump -U plume plume | gzip > ~/backup-$(date +%F).sql.gz
  ```
- ⚠️ **Maintenance** (sécurité OS, mises à jour) à ta charge — contrairement à un
  hébergeur managé.
