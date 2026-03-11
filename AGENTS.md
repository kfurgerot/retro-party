# AGENTS.md

## 1) Vue d'ensemble du projet
Retro Party est une application de retrospective agile gamifiee:
- Frontend: React + TypeScript + Vite (`src/`)
- Backend: Node.js + Express + Socket.IO (`server/`)
- DB: PostgreSQL (init auto via `server/db.js`)
- Deploiement: Docker (`Dockerfile`, `server/Dockerfile`, `docker-compose.yml`, `docker-compose-prod.yml`, `nginx.conf`)

Surfaces critiques:
- Auth/session (`/api/auth/*`, cookie session, reset password)
- Rooms/templates (`/api/rooms/*`, `/api/templates/*`)
- Flux temps reel Socket.IO (jeu multijoueur et minigames)

## 2) Regles generales
- Faire des changements petits, cibles, et facilement reversibles.
- Ne jamais casser le flux de jeu multijoueur ni la logique serveur autoritaire.
- Preserver les comportements existants si non demandes explicitement.
- Interface utilisateur en francais par defaut.
- Ne pas ajouter de dependance sans justification claire (besoin + impact).
- Ne jamais hardcoder de secrets; utiliser uniquement des variables d'environnement.
- Preserver la compatibilite Docker locale et production.

## 3) Workflow attendu avant/apres modification
Avant:
- Lire les zones impactees (frontend, API, Socket, DB) et identifier les effets de bord.
- Definir le plus petit changement possible.
- Verifier la configuration requise via `.env*.example` sans exposer de secret.

Pendant:
- Modifier uniquement les fichiers necessaires.
- Eviter les refactors larges non demandes.
- Maintenir les contrats API et evenements Socket existants, sauf demande explicite.

Apres:
- Executer les verifications disponibles:
  - racine: `npm run lint`, `npm run test`, `npm run build`
  - backend: `node server/whoSaidItEngine.test.js`
- Si une verification n'est pas executable, l'indiquer clairement.
- Lister les risques restants et les limites de validation.

## 4) Regles frontend
- Conserver UX/UI coherente avec l'existant (structure, composants, ton visuel retro).
- Garder les textes utilisateur en francais (fichiers `src/i18n` et pages/composants).
- Eviter les regressions de navigation et des ecrans principaux (`Home`, `Prepare`, `TemplateEditor`, `Index`).
- Ne pas introduire de logique metier critique uniquement cote client si deja geree cote serveur.

## 5) Regles backend
- Garder la logique de jeu multijoueur autoritaire cote serveur (`server/index.js`, `server/gameLogic.js`).
- Preserver les controles d'acces sur routes protegees (`requireAuth`) et la separation des donnees par utilisateur.
- Valider strictement les payloads REST/Socket (types, bornes, formats attendus).
- Conserver la compatibilite des routes existantes et du schema DB actuel.

## 6) Regles securite
- Secrets/config uniquement via variables d'environnement (`.env.local`, `.env.prod`), jamais en dur.
- Ne pas logguer de donnees sensibles (tokens, mots de passe, credentials SMTP, URL DB complete).
- Maintenir les protections existantes: hash mots de passe, hash tokens, cookies `HttpOnly`/`SameSite`, rate-limit login.
- Toute modification auth/session/reset-password doit etre traitee comme sensible et testee explicitement.

## 7) Priorites de tests
Priorite 1:
- Auth: register/login/logout/me/forgot-password/reset-password.
- Permissions: acces templates/questions uniquement proprietaire.
- Flux room multijoueur: create/join/reconnect/leave/start_game.

Priorite 2:
- Evenements Socket critiques: roll/move/choose_path/validate_question/minigames.
- Integrite de tour de jeu (pas d'action hors tour/role).

Priorite 3:
- Non-regression UI des ecrans principaux.
- Build frontend + demarrage backend + compose local.

## 8) Consignes de review
- Focus sur risques/regressions avant le style.
- Verifier: securite, comportements multiplayer, compatibilite API/Socket, impact Docker.
- Refuser les changements qui:
  - introduisent un secret en dur
  - cassent les contrats d'API/evenements sans migration
  - degradent l'UX existante sans besoin explicite
- Exiger au minimum une preuve de verification (lint/test/build ou justification d'impossibilite).

## 9) Format attendu de reponse finale
- Donner d'abord le resultat concret (ce qui a ete change).
- Lister les fichiers modifies et la raison de chaque changement.
- Resumer les verifications executees et leur statut (OK/KO/non lance + raison).
- Signaler explicitement les risques restants, impacts potentiels et points non verifies.
- Proposer 1-3 prochaines actions uniquement si elles sont naturelles pour la suite.
