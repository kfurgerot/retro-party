---
project_name: "retro-party-dev"
user_name: "Karl FURGEROT"
date: "2026-04-13"
sections_completed: ["technology_stack", "language_rules", "framework_rules", "testing_rules", "quality_rules", "workflow_rules", "anti_patterns"]
status: "complete"
rule_count: 41
optimized_for_llm: true
existing_patterns_found: 12
---

# Contexte Projet pour les Agents IA

_Ce fichier rassemble les règles et patterns critiques que les agents IA doivent suivre lors de l'implémentation. Il se concentre sur les points non évidents et à fort impact._

---

## Stack technique et versions

- Frontend:
  - React `18.3.1`
  - TypeScript `5.8.3`
  - Vite `7.3.1`
  - Tailwind CSS `3.4.17`
  - React Router DOM `6.30.1`
  - TanStack React Query `5.83.0`
  - Radix UI (ensemble de composants `^1.x/2.x`)
  - Pixi.js `7.4.2`
  - Phaser `3.90.0`
  - Socket.IO client `4.7.5`
- Backend:
  - Node.js `20` (runtime Docker `node:20-alpine`)
  - Express `4.19.2`
  - pg `8.13.1`
  - bcryptjs `2.4.3`
  - Socket.IO `4.7.5`
- Base de données:
  - PostgreSQL `16` (`postgres:16-alpine`)
- Tests:
  - Vitest `3.2.4`
  - Testing Library React `16.0.0`
  - jsdom `28.1.0`
- Build/qualité:
  - ESLint `9.32.0`
  - TypeScript ESLint `8.38.0`
  - `@vitejs/plugin-react-swc` `3.11.0`
- Déploiement local:
  - Docker Compose (services `frontend`, `backend`, `postgres`)
  - Nginx (frontend statique + proxy `/api` et `/socket.io`)

## Règles critiques d'implémentation

### Règles langage (TypeScript/JavaScript)

- Utiliser l'ESM partout:
  - Frontend TS/TSX via imports standards Vite.
  - Backend Node en imports ESM avec extension `.js` pour les modules locaux.
- Conserver l'alias de chemin frontend `@/* -> ./src/*` pour les imports internes.
- Respecter la baseline TypeScript actuelle:
  - `strict: false`, `noImplicitAny: false`, `strictNullChecks: false`.
  - Ne pas introduire de refonte globale de typage strict sans demande explicite.
- Préserver le pattern d'appel API frontend:
  - centraliser les requêtes via `src/net/api.ts` (`request<T>`),
  - inclure `credentials: "include"`,
  - remonter des erreurs utilisateur via `Error(message)` localisé.
- En backend, garder un flux d'erreurs cohérent:
  - validation d'input explicite en entrée,
  - `return res.status(...).json({ error: "..." })` pour erreurs métier,
  - `next(err)` dans les `catch`,
  - fallback global `/api` en `500 Internal server error`.
- Pour PostgreSQL, utiliser uniquement des requêtes paramétrées (`$1`, `$2`, ...) avec `pg`:
  - ne jamais interpoler directement des valeurs utilisateur dans SQL.
- Préserver les conventions de style déjà en place:
  - guillemets doubles,
  - points-virgules,
  - fonctions courtes et lisibles par responsabilité.

### Règles framework (React + Socket.IO)

- Préserver la séparation des modes de jeu:
  - logique locale dans `useGameState`,
  - logique online autoritaire dans `useOnlineGameState` + événements Socket.IO.
- Conserver le pattern de routing React:
  - pages chargées via `lazy(...)` + loaders dédiés (`src/lib/routeLoaders.ts`),
  - fallback `Suspense` explicite,
  - route catch-all `*` maintenue en dernier.
- Garder les providers globaux au niveau `App`:
  - `QueryClientProvider`, `TooltipProvider`, `Toaster`, `Sonner`, `BrowserRouter`.
- Pour React Query:
  - conserver une instance `QueryClient` unique au niveau module,
  - éviter la recréation à chaque render.
- Pour Socket.IO côté frontend:
  - enregistrer les handlers dans un `useEffect` unique,
  - toujours retirer les listeners (`socket.off(...)`) en cleanup,
  - gérer reconnect/résilience via `visibilitychange`, `focus`, `online`.
- Pour la persistance de session online:
  - conserver le contrat `localStorage` (`retro-party:online-session`),
  - valider la forme avant usage (`isOnlineSession`).
- Éviter les duplications de logique état:
  - les transitions de phase (lobby/playing/results, minigames, turnPhase) doivent rester centralisées dans les hooks d'état, pas dispersées dans les composants UI.

### Règles de tests

- Frontend:
  - utiliser Vitest (`npm run test`) avec environnement `jsdom`,
  - nommer les fichiers `*.test.ts` ou `*.test.tsx`,
  - placer les tests au plus près de la feature/composant concerné.
- Composants React:
  - utiliser `@testing-library/react`,
  - tester le rendu observable (texte, présence d'éléments, comportements utilisateur) plutôt que l'implémentation interne.
- Logique métier frontend (ex: `features/radarParty`):
  - privilégier des tests unitaires purs avec cas limites explicites (égalité, déduplication, bornes).
- Backend:
  - conserver les tests unitaires ciblés en Node natif (`node:test`, `assert/strict`) pour les moteurs de règles.
- Règle de robustesse:
  - tout changement de règles de scoring, de transitions d'état de jeu, ou de recommandations Radar doit inclure/adapter des tests.
- Scope test:
  - éviter les tests E2E lourds pour des ajustements locaux; privilégier tests unitaires + vérification manuelle ciblée.

### Règles qualité & style de code

- Respecter l'organisation des dossiers existante:
  - `components/` pour UI et écrans,
  - `features/` pour logique métier orientée domaine,
  - `hooks/` pour orchestration d'état,
  - `net/` pour accès backend/socket,
  - `lib/` pour utilitaires transverses,
  - `data/` pour banques de contenu statique,
  - `types/` pour contrats TS partagés.
- Respecter les conventions de nommage:
  - composants React en `PascalCase.tsx`,
  - utilitaires/modules en `camelCase.ts` ou `kebab-case.ts` selon l'existant local,
  - tests en `*.test.ts(x)`.
- Utiliser l'alias `@/` pour les imports internes frontend (éviter les chemins relatifs longs).
- Pour les classes CSS/Tailwind:
  - passer par `cn(...)` (`src/lib/utils.ts`) pour fusion conditionnelle,
  - réutiliser les tokens/constants UI (`src/lib/uiTokens.ts`) avant d'ajouter de nouvelles chaînes de classes.
- Maintenir la cohérence visuelle transverse AgileSuite:
  - privilégier composants shell (`src/components/app-shell`) et primitives UI (`src/components/ui`) existants.
- Garder des fonctions courtes à responsabilité unique:
  - extraire la logique non triviale hors composants UI quand elle grossit.
- Éviter la sur-ingénierie:
  - priorité à des changements simples, lisibles, testables et réversibles (mode Delivery).

### Règles workflow développement

- Avant tout run Docker local, vérifier la présence de `.env.local` (copie depuis `.env.local.example` si absent).
- Pour le développement frontend standard:
  - `npm run dev` (Vite),
  - valider via `npm run lint`, `npm run test`, puis `npm run build` avant livraison.
- Pour le backend local:
  - exécution depuis `server/` avec `npm run dev` / `npm run start`.
- Pour la stack locale intégrée:
  - utiliser `docker compose up -d --build`,
  - vérifier l'état via `docker compose ps`,
  - en cas d'incohérence DB (credentials/schema), reconstruire proprement avec `docker compose down -v` puis `up`.
- En production:
  - utiliser `docker-compose-prod.yml` + `.env.prod`,
  - ne jamais committer les secrets (`.env.prod`),
  - s'assurer que `ORIGIN` et `POSTGRES_PASSWORD` sont correctement renseignés.
- Règle de livraison:
  - tout changement fonctionnel doit rester compatible desktop/mobile et compatible Docker (selon `docs/tech-context.md`).

### Règles critiques à ne pas rater (anti-patterns, edge cases, sécurité, perf)

- Ne pas rendre le client autoritaire pour la logique de partie online:
  - les transitions de jeu/scoring doivent rester validées côté serveur.
- Ne pas casser la stratégie de reconnexion:
  - conserver `RECONNECT_GRACE_MS`,
  - conserver les timers de cleanup et leur purge (`disconnectTimers`) pour éviter fuite mémoire et expulsions prématurées.
- Ne pas enlever les garde-fous de capacité:
  - conserver la limite de joueurs (`MAX_PLAYERS` / `POKER_MAX_PLAYERS` = 20) et les messages d'erreur associés.
- Sécurité session/auth:
  - conserver cookie session `HttpOnly` + `SameSite=Lax` (+ `Secure` en production),
  - ne jamais stocker de token brut en base (hash SHA-256 uniquement),
  - conserver la révocation des sessions lors de logout/reset password.
- Sécurité API:
  - maintenir validation d'entrée stricte (`Invalid payload`) sur chaque route,
  - maintenir les rate limits API/auth/mail/login,
  - conserver les requêtes SQL paramétrées uniquement.
- Sécurité réseau:
  - ne pas assouplir CORS sans justification explicite,
  - garder la logique `ORIGIN`/origines autorisées alignée avec l'environnement.
- Edge cases Radar Party:
  - préserver les règles `hostParticipates`,
  - préserver les statuts de session (`lobby`/`started`) et contrôles d'autorisation host.
- Anti-pattern à éviter:
  - ajouter des side-effects lourds dans handlers socket/API chauds sans mesurer l'impact (latence multi-joueurs).

---

## Guide d'utilisation

**Pour les agents IA:**

- Lire ce fichier avant toute implémentation.
- Appliquer toutes les règles ci-dessus par défaut.
- En cas de doute, choisir l'option la plus restrictive (sécurité, robustesse, compatibilité Docker/mobile).
- Proposer une mise à jour de ce fichier lorsqu'un nouveau pattern stable apparaît.

**Pour les humains:**

- Garder ce document concis et orienté règles non évidentes.
- Mettre à jour lors d'un changement de stack, workflow, ou contraintes produit/temps réel.
- Supprimer les règles devenues implicites ou obsolètes.
- Revoir périodiquement la pertinence des règles (au moins trimestriellement).

Dernière mise à jour: 2026-04-13
