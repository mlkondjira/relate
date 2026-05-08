# Relate — Guide de déploiement Railway

## Prérequis
- Compte [Railway](https://railway.app) ✅ fait
- Compte [GitHub](https://github.com)
- Node.js 20+ en local
- `npm install -g eas-cli` (expo-cli est déprécié et ne doit plus être installé globalement)

---

## Étape 1 — Pousser sur GitHub

```bash
# À la racine du dossier relate/
git init
git add .
git commit -m "Initial commit — Relate v1.0"

# Créer un repo sur github.com puis :
git remote add origin https://github.com/mlkondjira/relate.git
git push -u origin main
```

---

## Étape 2 — Créer le service backend sur Railway

1. railway.app → **New Project** → **Deploy from GitHub repo**
2. Sélectionner ton repo `relate`
3. Railway te demande quel dossier → choisir **`backend`**
4. Il détecte le `Dockerfile` automatiquement → cliquer **Deploy**

---

## Étape 3 — Ajouter PostgreSQL

Dans le projet Railway :
1. Cliquer **+ New** → **Database** → **Add PostgreSQL**
2. Attendre la création (~30 sec)
3. Cliquer sur la base → onglet **Connect** → copier `DATABASE_URL`

---

## Étape 4 — Variables d'environnement

Service backend Railway → onglet **Variables** → **Raw Editor** :

```
DATABASE_URL=postgresql://...  ← copié depuis PostgreSQL Railway
JWT_SECRET=...                 ← générer ci-dessous
CYCLE_ENCRYPTION_KEY=...       ← générer ci-dessous
NODE_ENV=production
PORT=3000
```

### Générer les clés en local :
```bash
# JWT_SECRET (longue chaîne aléatoire)
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"

# CYCLE_ENCRYPTION_KEY (exactement 32 caractères)
node -e "console.log(require('crypto').randomBytes(16).toString('hex'))"
```

→ Railway redéploie automatiquement après avoir sauvegardé les variables.

---

## Étape 5 — Vérifier le déploiement

```bash
curl https://relate-production-8af0.up.railway.app/health
# Réponse attendue : {"status":"ok","app":"Relate API"}
```

Copier cette URL Railway — elle sera nécessaire pour le frontend.

---

## Étape 6 — Configurer le frontend

```bash
cd relate/frontend
cp .env.example .env.local
```

Éditer `.env.local` :
```
EXPO_PUBLIC_API_URL=https://TON-SERVICE.up.railway.app/api
EXPO_PUBLIC_PROJECT_ID=                                    ← voir ci-dessous
```

### Obtenir le Project ID Expo :
1. [expo.dev](https://expo.dev) → créer un compte → **New Project** → nommer `relate`
2. Copier le **Project ID** (format UUID)





### Lancer sur téléphone :
```bash
npm install # ou npm install --force --legacy-peer-deps si conflits
npx expo install --check # Pour aligner les versions avec le SDK
npx expo start -c # Lancer en nettoyant le cache de Metro
# Scanner le QR avec Expo Go (dispo sur App Store / Play Store)
```

---

## Étape 7 — Build APK Android (optionnel)

Pour un vrai .apk installable sans Expo Go :

```bash
eas login
eas build --platform android --profile preview
# → Lien de téléchargement .apk disponible sur expo.dev après ~5 min
```

---

## Checklist finale

- [ ] `/health` répond OK
- [ ] Inscription + connexion fonctionnent
- [ ] Code d'invitation généré + rejoindre fonctionne
- [ ] Check-in → distance affichée
- [ ] Message envoyé → reçu en temps réel (Socket.io)
- [ ] Moment créé → visible des deux côtés
- [ ] Entrée cycle → chiffrée + partage contrôlé

---

## Coût Railway estimé

Pour 2 utilisateurs (usage normal) :
- **Hobby plan : 5$/mois** — backend + PostgreSQL 1GB inclus
- Dépassements très peu probables en usage couple
