# Relate — Application mobile pour couples

## Stack technique
- **Frontend** : React Native + Expo SDK 52, Expo Router, Zustand, Axios, Socket.io-client
- **Backend** : Node.js, Express, Socket.io, Prisma ORM
- **Base de données** : PostgreSQL
- **Auth** : JWT + bcrypt
- **Données de santé** : AES-256-GCM (chiffrement côté serveur avant insertion)

---

## Structure du projet

```
relate/
├── backend/
│   ├── prisma/
│   │   └── schema.prisma         # Modèles BDD
│   └── src/
│       ├── server.js             # Point d'entrée Express + Socket.io
│       ├── middleware/
│       │   └── auth.middleware.js
│       ├── routes/
│       │   ├── auth.routes.js    # Register, Login, Me, Logout
│       │   ├── couple.routes.js  # Invitation, join, leave
│       │   ├── checkin.routes.js # Check-in + calcul distance Haversine
│       │   ├── message.routes.js # Historique messages (REST)
│       │   ├── moment.routes.js  # Moments partagés
│       │   └── cycle.routes.js   # Cycle menstruel chiffré
│       └── services/
│           ├── socket.service.js       # Présence + messagerie temps réel
│           └── notification.service.js # Expo Push Notifications
│
└── frontend/
    ├── app/
    │   ├── _layout.tsx           # Root layout + auth guard
    │   ├── auth/login.tsx        # Login / Register
    │   └── app/home.tsx          # Dashboard couple
    ├── services/api.service.ts   # Axios + tous les appels API
    └── stores/index.ts           # Zustand : auth, chat, distance
```

---

## Lancement rapide

### Backend

```bash
cd backend
cp .env.example .env
# Éditer .env avec vos valeurs (DATABASE_URL, JWT_SECRET, etc.)
npm install
npx prisma migrate dev --name init
npm run dev
```

### Frontend

```bash
cd frontend
npm install
# Créer .env.local avec :
# EXPO_PUBLIC_API_URL=http://192.168.x.x:3000/api
npx expo start
```

> Utiliser l'IP locale de votre machine (pas localhost) pour que l'émulateur/device puisse accéder au backend.

---

## Fonctionnalités implémentées (V1)

| Fonctionnalité | Backend | Frontend |
|---|---|---|
| Inscription / Connexion JWT | ✅ | ✅ |
| Invitation couple par code | ✅ | 🔜 |
| Check-in + distance Haversine | ✅ | ✅ |
| Présence partenaire (Socket.io) | ✅ | ✅ |
| Messagerie temps réel | ✅ | 🔜 |
| Moments partagés + compte à rebours | ✅ | ✅ |
| Cycle menstruel chiffré AES-256 | ✅ | 🔜 |
| Notifications push Expo | ✅ | 🔜 |

---

## Prochaines étapes (à coder)

- [ ] Écran messagerie (avec Socket.io côté front)
- [ ] Écran moments (création + liste)
- [ ] Écran cycle menstruel
- [ ] Écran invitation couple (partage du code)
- [ ] Tab navigation (Home / Chat / Moments / Cycle)
- [ ] Écran profil / paramètres

---

## Sécurité

- Données cycle : chiffrées AES-256-GCM avant toute insertion en BDD
- Le partenaire ne reçoit que la **phase** (jamais les notes/symptômes privées)
- Tokens JWT stockés dans Expo SecureStore (Keychain iOS / Keystore Android)
- Pas de tracking GPS en arrière-plan : position one-shot au moment du check-in
