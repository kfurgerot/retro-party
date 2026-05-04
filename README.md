# AgileSuite

AgileSuite est une suite web pour animer des rituels Agile en equipe, avec une experience temps reel et une interface orientee facilitation.

Modules principaux :

- **Retro Party** : retrospective multijoueur en mode jeu.
- **Planning Party** : planning poker collaboratif.
- **Radar Party** : diagnostic Agile avec scores individuels, radar equipe et insights.
- **Skills Matrix** : cartographie de competences et templates associes.

## Stack

- Frontend : React 18, TypeScript, Vite 7, Tailwind CSS, Radix/shadcn UI, Pixi.js.
- Backend : Node.js 20, Express 4, Socket.IO, PostgreSQL.
- Realtime : Socket.IO, serveur autoritaire pour les sessions online.
- Build/deploiement : Docker, Docker Compose, Nginx.
- Qualite : ESLint, Prettier, Vitest, tests Node natifs cote serveur.

## Arborescence

```text
.
|- src/                    # Frontend React
|  |- components/          # UI partagee, shell, ecrans et composants metier
|  |- pages/               # Pages routees
|  |- features/            # Logique metier frontend par domaine
|  |- hooks/               # Orchestration d'etat
|  |- net/                 # Acces API et Socket.IO
|  |- lib/                 # Utilitaires transverses
|  |- data/                # Donnees statiques frontend
|  `- design-system/       # Tokens et exports design system
|- server/                 # Backend Express, Socket.IO, DB et moteurs metier
|  `- src/
|     |- api/              # Routes REST modulaires
|     |- services/         # Services backend partages
|     `- socket/           # Handlers Socket.IO
|- shared/                 # Contrats partages frontend/backend
|- public/                 # Assets statiques servis par le frontend
|- docs/                   # Documentation produit et technique
|- scripts/                # Scripts de maintenance
|- Dockerfile              # Image frontend Nginx
|- server/Dockerfile       # Image backend Node
|- docker-compose.yml      # Stack locale
|- docker-compose-prod.yml # Stack production
`- nginx.conf              # Proxy Nginx vers backend
```

Les dossiers d'outillage local ou agent (`node_modules`, `dist`, `playwright-report`, `test-results`, `tmp`, caches, fichiers `.env` reels) ne doivent pas etre pousses.

## Prerequis

- Node.js 20+
- npm
- Docker et Docker Compose pour l'execution integree
- PostgreSQL si le backend est lance sans Docker

## Installation locale

```bash
npm install
cd server
npm install
```

Copier les variables locales si necessaire :

```bash
cp .env.local.example .env.local
```

## Developpement sans Docker

Terminal 1, frontend :

```bash
npm run dev
```

Terminal 2, backend :

```bash
cd server
npm run dev
```

URLs par defaut :

- Frontend : `http://localhost:5173`
- Backend : `http://localhost:3001`
- Healthcheck : `http://localhost:3001/health`

## Developpement avec Docker

```bash
docker compose up -d --build
```

Services locaux :

- Frontend : `http://localhost:8088`
- Backend : `http://localhost:3001`
- PostgreSQL : `localhost:5432`

Arret :

```bash
docker compose down
```

Arret avec suppression des volumes locaux :

```bash
docker compose down -v
```

## Production

Le deploiement production utilise `docker-compose-prod.yml`.

1. Copier le template :

```bash
cp .env.prod.example .env.prod
```

2. Renseigner au minimum :

- `ORIGIN` : URL publique autorisee en CORS.
- `POSTGRES_PASSWORD` : mot de passe PostgreSQL.
- `RESET_PASSWORD_URL_BASE` : URL publique de reset password.
- `GMAIL_USER`, `GMAIL_APP_PASSWORD`, `MAIL_FROM` si les emails transactionnels sont actifs.
- `OAUTH_STATE_SECRET`, `OAUTH_CALLBACK_BASE_URL` et les secrets Google/Microsoft si le SSO est actif.

3. Adapter le volume PostgreSQL dans `docker-compose-prod.yml` si le chemin serveur differe :

```yml
/volume1/docker/retro-postgres-db:/var/lib/postgresql/data
```

4. Valider puis deployer :

```bash
docker compose --env-file .env.prod -f docker-compose-prod.yml config
docker compose --env-file .env.prod -f docker-compose-prod.yml up -d --build
```

## Scripts

Racine :

```bash
npm run dev
npm run lint
npm run test
npm run build
npm run preview
npm run format
npm run format:check
```

Backend :

```bash
cd server
npm run dev
npm run start
npm test
```

## Variables d'environnement

Templates versionnes :

- `.env.example` : variables frontend et rappel SMTP.
- `.env.local.example` : developpement local.
- `.env.prod.example` : production.
- `server/.env.example` : variables backend.

Les fichiers reels (`.env`, `.env.local`, `.env.prod`, secrets locaux) ne doivent pas etre commit.

Variables backend importantes :

- `PORT`
- `ORIGIN`
- `DATABASE_URL`
- `POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD`
- `SESSION_COOKIE_NAME`, `SESSION_TTL_DAYS`
- `BCRYPT_ROUNDS`
- `LOGIN_RATE_LIMIT_*`, `API_RATE_LIMIT_*`, `AUTH_RATE_LIMIT_*`
- `GMAIL_USER`, `GMAIL_APP_PASSWORD`, `MAIL_FROM`
- `RESET_PASSWORD_URL_BASE`, `RESET_TOKEN_TTL_MINUTES`
- `OAUTH_STATE_SECRET`, `OAUTH_CALLBACK_BASE_URL`
- `OAUTH_GOOGLE_CLIENT_ID`, `OAUTH_GOOGLE_CLIENT_SECRET`
- `OAUTH_MICROSOFT_CLIENT_ID`, `OAUTH_MICROSOFT_CLIENT_SECRET`, `OAUTH_MICROSOFT_TENANT_ID`

## API et temps reel

Surfaces REST principales :

- Auth : `/api/auth/*`
- Templates : `/api/templates/*`
- Rooms : `/api/rooms/quick`
- Dashboard : `/api/dashboard/*`
- Teams : `/api/teams/*`
- Radar : `/api/radar/*`
- Skills Matrix : `/api/skills-matrix/*`

Socket.IO gere les parcours online : creation/join/reconnexion de room, lobby, presence, lancement, actions de jeu et synchronisation d'etat.

## Hygiene Git

Avant de committer :

```bash
git status -sb
git status --ignored
npm run build
cd server && npm test
```

Ne pas ajouter :

- `node_modules/`
- `dist/`
- `playwright-report/`
- `test-results/`
- `tmp/`
- fichiers `.env` reels
- caches locaux et configuration machine

Si un artefact genere a deja ete suivi par Git, le retirer du suivi sans supprimer le fichier local :

```bash
git rm --cached <chemin>
```

## Notes d'architecture

- Le client ne doit pas etre autoritaire sur la logique de partie online.
- Les routes backend doivent valider les payloads et utiliser des requetes SQL parametrees.
- Les hooks frontend centralisent les transitions de session et nettoient les listeners Socket.IO.
- Les refactors d'arborescence source doivent rester separes des commits de nettoyage Git/README pour garder les reviews lisibles.

## Licence

Copyright (c) 2026 Karl FURGEROT.
Contact : karl.furgerot@gmail.com
