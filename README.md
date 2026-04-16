# Retro Party

Application web de retrospective d'equipe en mode jeu de plateau retro, jouable en ligne (temps reel via Socket.IO) et en local.

## Apercu

Retro Party contient:
- un frontend React/TypeScript (Vite, Tailwind, shadcn/ui)
- un backend Node.js/Express avec Socket.IO
- une base PostgreSQL
- un deploiement conteneurise (Docker + Docker Compose + Nginx)

Fonctions principales:
- parties online avec code de room
- logique de jeu autoritaire cote serveur
- authentification (inscription/connexion/logout)
- gestion de templates de partie + questions personnalisees
- creation de room rapide ou basee sur template
- reset de mot de passe via email (SMTP Gmail)
- module Radar Party (questionnaire Agile, radar individuel/equipe, insights atelier)

## Stack technique

- Frontend: React 18, TypeScript, Vite 7, TailwindCSS, shadcn/ui
- Realtime: Socket.IO (client + serveur)
- Backend: Node.js 20, Express 4
- Base de donnees: PostgreSQL 16
- Reverse proxy: Nginx (frontend statique + proxy `/api` et `/socket.io`)
- Tests:
  - frontend: Vitest
  - backend: test unitaire `server/whoSaidItEngine.test.js`

## Architecture du repository

```text
.
|- src/                    # Frontend React
|- server/                 # Backend Express + Socket.IO + migrations SQL
|- public/                 # Assets statiques
|- Dockerfile              # Build frontend + image Nginx
|- server/Dockerfile       # Image backend Node
|- docker-compose.yml      # Stack locale
|- docker-compose-prod.yml # Stack production
|- nginx.conf              # Proxy Nginx vers backend
`- .env*.example           # Exemples de variables d'environnement
```

## Demarrage rapide (dev sans Docker)

### 1) Frontend

```bash
npm install
npm run dev
```

Frontend disponible sur `http://localhost:5173`.

### 2) Backend

```bash
cd server
npm install
npm run dev
```

Backend disponible sur `http://localhost:3001`.

## Demarrage avec Docker (local)

1. Copier les variables locales:

```bash
cp .env.local.example .env.local
```

2. Lancer la stack:

```bash
docker compose up -d --build
```

3. Acceder aux services:
- frontend: `http://localhost:8088`
- backend: `http://localhost:3001`
- postgres: `localhost:5432` (expose uniquement en compose local)

Arret:

```bash
docker compose down
```

Arret + suppression des volumes locaux:

```bash
docker compose down -v
```

## Deploiement production (`docker-compose-prod.yml`)

Le compose de production demarre 3 services:
- `frontend` (Nginx, port `8088:80`)
- `backend` (Node.js, port `3001:3001`)
- `postgres` (non expose publiquement par defaut)

### 1) Variables d'environnement

Copier le template:

```bash
cp .env.prod.example .env.prod
```

Renseigner au minimum:
- `ORIGIN` (URL publique autorisee en CORS)
- `POSTGRES_PASSWORD`
- `GMAIL_USER` et `GMAIL_APP_PASSWORD` (si reset password actif)
- `RESET_PASSWORD_URL_BASE`

### 2) Volume PostgreSQL

Dans `docker-compose-prod.yml`, le volume DB est actuellement:

```yml
/volume1/docker/retro-postgres-db:/var/lib/postgresql/data
```

Adapter ce chemin a votre serveur avant de deployer.

### 3) Lancer en production

```bash
docker compose --env-file .env.prod -f docker-compose-prod.yml up -d --build
```

### 4) Sante des services

- endpoint backend: `GET /health`
- verification rapide:

```bash
curl http://localhost:3001/health
```

## Variables d'environnement

### Frontend

- `VITE_BACKEND_URL` (optionnel)
  - en local sans proxy: `http://localhost:3001`
  - en prod derriere meme domaine: peut etre omis

### Backend

Variables principales:
- `PORT` (defaut `3001`)
- `ORIGIN` (CORS, URL frontend)
- `DATABASE_URL`
- `SESSION_COOKIE_NAME` (defaut `rp_session`)
- `SESSION_TTL_DAYS` (defaut `7`)
- `BCRYPT_ROUNDS` (defaut `12`)
- `LOGIN_RATE_LIMIT_WINDOW_MS` (defaut `900000`)
- `LOGIN_RATE_LIMIT_MAX` (defaut `10`)
- `RESET_TOKEN_TTL_MINUTES` (defaut `60`)
- `GMAIL_USER`, `GMAIL_APP_PASSWORD`, `MAIL_FROM`
- `RESET_PASSWORD_URL_BASE`

Voir:
- `.env.local.example`
- `.env.prod.example`

## Endpoints API (resume)

Auth:
- `POST /api/auth/register`
- `POST /api/auth/login`
- `POST /api/auth/logout`
- `GET /api/auth/me`
- `POST /api/auth/forgot-password`
- `POST /api/auth/reset-password`

Templates (auth requis):
- `GET/POST /api/templates`
- `GET/PATCH/DELETE /api/templates/:templateId`
- `GET/POST /api/templates/:templateId/questions`
- `PATCH/DELETE /api/templates/:templateId/questions/:questionId`
- `PUT /api/templates/:templateId/questions/reorder`
- `POST /api/templates/:templateId/launch-room`

Rooms:
- `POST /api/rooms/quick`

Radar Party:
- `GET /api/radar/questions`
- `POST /api/radar/sessions`
- `POST /api/radar/sessions/:code/participants`
- `POST /api/radar/sessions/:code/submissions`
- `GET /api/radar/sessions/:code`

Documentation module:
- `docs/radar-party.md`

## Socket.IO (evenements principaux)

- Room: `create_room`, `join_room`, `reconnect_room`, `leave_room`
- Partie: `start_game`, `roll_dice`, `move_player`, `choose_path`, `validate_question`, `reset_game`
- Minigames: `BUZZWORD_SUBMIT`, `WSI_SUBMIT`, `point_duel_roll`, `BUG_SMASH_*`
- Flux serveur: `state_update`, `lobby_update`, `room_closed`, `error_msg`

## Scripts utiles

A la racine:

```bash
npm run dev
npm run build
npm run preview
npm run lint
npm run test
```

Dans `server/`:

```bash
npm run dev
npm run start
npm run migrate
npm run test
```

## Notes d'implementation

- Le mode online est actif par defaut dans le frontend.
- Le mode local reste disponible via le parametre `?online=0`.
- L'etat de jeu online est gere cote serveur (`server/gameLogic.js`).
- Les migrations SQL sont appliquees au demarrage backend (`runMigrations()` via `initDatabase()`).

## Strategie migrations SQL

- Dossier: `server/migrations/`
- Convention de nommage: `NNNN_description.sql` (ex: `0001_initial_schema.sql`)
- Regle: migrations forward-only (on ajoute une migration corrective, on ne modifie pas une migration deja executee)
- Idempotence: table de suivi `schema_migrations` + SQL defensif (`IF NOT EXISTS` quand applicable)

Execution manuelle:

```bash
cd server
npm run migrate
```

Execution recommandee:
- local: migration appliquee automatiquement au demarrage backend
- CI: lancer `npm run migrate` avant tests backend/integration
- production: lancer `npm run migrate` avant exposition du service

## Recommandations production

- Ne jamais committer `.env.prod`.
- Utiliser des mots de passe forts et uniques.
- Restreindre `ORIGIN` a votre domaine public.
- Placer un reverse proxy TLS (Nginx/Traefik/Caddy) devant les ports exposes.
- Sauvegarder regulierement le volume PostgreSQL.

## Licence

Copyright (c) 2026 Karl FURGEROT.
Contact: karl.furgerot@gmail.com
