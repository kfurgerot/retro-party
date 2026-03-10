# Retro Party

Jeu de retrospective d'equipe en mode plateau, avec:
- mode local (un seul navigateur)
- mode online temps reel (rooms + Socket.IO)

## Stack
- Frontend: React + TypeScript + Vite + Tailwind + shadcn/ui
- Backend: Node.js + Express + Socket.IO
- Conteneurisation: Docker + Docker Compose + Nginx

## Structure du repo
```text
.
|- src/                 # Frontend
|- server/              # Backend Socket.IO + logique de jeu
|- Dockerfile           # Image frontend
|- server/Dockerfile    # Image backend
|- docker-compose.yml   # Orchestration locale
`- nginx.conf           # Reverse proxy frontend -> backend/socket.io
```

## Lancer en local (sans Docker)

### 1) Frontend
```bash
npm install
npm run dev
```
Frontend: `http://localhost:5173`

### 2) Backend
```bash
cd server
npm install
npm run dev
```
Backend: `http://localhost:3001`

### Variables utiles
- Frontend:
  - `VITE_BACKEND_URL` (optionnel): URL du backend Socket.IO/HTTP
- Backend:
  - `PORT` (defaut: `3001`)
  - `ORIGIN` (defaut: `*`) pour CORS

## Lancer avec Docker
```bash
docker compose build --no-cache
docker compose up -d
```

Services:
- Frontend: `http://localhost:8088`
- Backend: `http://localhost:3001`

Arret:
```bash
docker compose down
```

## Production: secrets et variables

Le fichier `docker-compose-prod.yml` est prevu pour que les secrets soient injectes via variables
d'environnement (Portainer ou fichier `.env.prod` non versionne).

1. Copier le modele:
```bash
cp .env.prod.example .env.prod
```
2. Remplir les vraies valeurs (mots de passe DB, Gmail app password, URLs publiques).
3. Deployer:
```bash
docker compose --env-file .env.prod -f docker-compose-prod.yml up -d --build
```

### Variables critiques a definir en production
- `ORIGIN`
- `DATABASE_URL`
- `POSTGRES_PASSWORD`
- `GMAIL_USER`
- `GMAIL_APP_PASSWORD`
- `RESET_PASSWORD_URL_BASE`

### Portainer
- Ouvrir la stack `docker-compose-prod.yml`
- Renseigner les variables dans **Environment variables** (ou via `stack.env`)
- Ne jamais saisir de secrets en dur dans le compose

## Scripts principaux

A la racine:
- `npm run dev` lance Vite
- `npm run build` build frontend
- `npm run test` lance les tests Vitest

Dans `server/`:
- `npm run dev` lance le backend Node
- `npm run start` lance le backend en mode standard

## Fonctionnalites
- Creation et partage de room (code court)
- Rejoindre une room existante
- Demarrage de partie par le host
- Des, deplacement, questions retro, votes
- Reconnexion avec delai de grace
- Gestion host et fermeture room si host quitte
- Bouton d'annulation de room dans le lobby online

## Notes techniques
- Le serveur est autoritaire sur l'etat online (`server/gameLogic.js`).
- Le frontend supporte aussi un mode local (`src/hooks/useGameState.ts`).
- Le flux Socket.IO est gere cote client dans `src/hooks/useOnlineGameState.ts`.

## Tests
```bash
npm run test
```

## Licence
A definir.
