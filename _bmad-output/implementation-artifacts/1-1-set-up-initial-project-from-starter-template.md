# Story 1.1: Set up initial project from starter template

Status: review

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a développeur,
I want initialiser la base technique depuis le starter retenu et préparer les fondations d'exécution,
so that les stories produit suivantes s'appuient sur un socle stable et versionnable.

## Hypothèses

- Le repository courant est la base de référence à conserver (pas de recréation de projet depuis zéro).
- L'objectif de cette story est une fondation technique, sans changement fonctionnel visible côté utilisateur.
- La stratégie de migration DB doit être mise en place sans casser le bootstrap local existant (Docker + Nginx + backend startup).

## Acceptance Criteria

1. **Given** l'architecture valide la continuité `Vite + React + TypeScript`
   **When** le socle de projet est préparé pour delivery
   **Then** aucune migration de framework n'est introduite
   **And** la compatibilité Docker/Nginx existante est préservée.
2. **Given** le backend doit évoluer de manière incrémentale
   **When** la base technique est finalisée
   **Then** le dossier `server/migrations/` est en place avec convention de nommage/exécution
   **And** la stratégie d'évolution DB est prête pour les stories qui créent/modifient des entités.

## Tasks / Subtasks

- [x] Task 1 - Verrouiller la baseline technique sans migration de framework (AC: 1)
- [x] Subtask 1.1 - Vérifier et conserver les foundations actuelles: React + TypeScript + Vite côté frontend, Express + Socket.IO côté backend.
- [x] Subtask 1.2 - Mettre à jour la documentation technique si nécessaire pour aligner les versions réellement utilisées (`README.md` vs `package.json` / `server/package.json`).
- [x] Subtask 1.3 - Confirmer que les flux Docker/Nginx restent inchangés et compatibles (`docker-compose.yml`, `nginx.conf`).

- [x] Task 2 - Introduire la fondation migrations SQL (AC: 2)
- [x] Subtask 2.1 - Créer `server/migrations/` avec convention de nommage explicite (ex: `YYYYMMDDHHMM__description.sql` ou `0001_description.sql`, convention unique et documentée).
- [x] Subtask 2.2 - Ajouter un mécanisme d'exécution idempotent des migrations (ex: table de suivi `schema_migrations` + runner Node ESM sans nouvelle dépendance).
- [x] Subtask 2.3 - Ajouter une migration initiale représentant l'état de schéma de référence pour les prochaines évolutions.
- [x] Subtask 2.4 - Connecter le démarrage backend pour exécuter les migrations avant exposition du service, sans casser le comportement local actuel.

- [x] Task 3 - Sécuriser la réversibilité et la qualité (AC: 1, 2)
- [x] Subtask 3.1 - Documenter la stratégie d'évolution DB (règles de création, ordre, rollback minimal, usage en local/CI/prod).
- [x] Subtask 3.2 - Ajouter un test de non-régression minimal sur le démarrage backend (migrations appliquées puis serveur opérationnel).
- [x] Subtask 3.3 - Vérifier que les commandes standard (`lint`, `test`, `build`) restent vertes.

## Dev Notes

### Story Foundation

- Scope produit: cette story sert de socle pour tout l'Epic 1 (entrée unifiée, onboarding, lobby, reconnexion), donc la stabilité de base est prioritaire.
- Valeur attendue: accélérer et fiabiliser les stories suivantes en évitant les changements de stack ou d'architecture non nécessaires.

### Technical Requirements

- Conserver l'approche "continuity baseline": pas de migration vers Next.js/T3/etc. en V1.
- Backend en Node ESM; ne pas introduire d'outil ORM/migration lourd sans justification explicite.
- Utiliser PostgreSQL 16.x et requêtes paramétrées uniquement.
- Préserver le contrat d'exécution local Docker Compose et le proxy Nginx `/api` + `/socket.io`.

### Architecture Compliance

- Respecter le monolithe modulaire existant: SPA frontend + backend API/realtime unique.
- Ne pas modifier les frontières runtime REST/Socket.IO dans cette story.
- Garder le serveur autoritaire sur l'état collaboratif (pas de logique autoritaire déplacée côté client).

### Library / Framework Requirements

- Frontend: React + TypeScript + Vite existants conservés.
- Backend: Express + Socket.IO + pg existants conservés.
- État de référence confirmé dans le dépôt:
- `vite`: `^7.3.1`
- `react`: `^18.3.1`
- `typescript`: `^5.8.3`
- `express`: `^4.19.2`
- `socket.io`: `^4.7.5`
- `pg`: `^8.13.1`

### Latest Tech Information (Web research - 2026-04-16)

- Vite (docs officielles): la baseline moderne exige Node `20.19+` ou `22.12+`; conserver Node 20 reste valide pour ce projet.
- Node.js officiel: la branche 20 est toujours marquée LTS (même si des LTS plus récentes existent), compatible avec l'objectif "pas de migration de framework".
- PostgreSQL officiel: `16` reste une version supportée; la version "Current" est `18`.

### File Structure Requirements

- Créer uniquement les fichiers nécessaires au système de migrations sous `server/migrations/` et scripts backend associés.
- Éviter toute dispersion des scripts de migration hors du dossier `server/`.
- Maintenir la structure actuelle du projet et les alias/imports existants.

### Testing Requirements

- Frontend: exécuter `npm run lint`, `npm run test`, `npm run build`.
- Backend: démarrer le serveur après migration et vérifier `GET /health`.
- Docker: valider `docker compose up -d --build` puis vérifier que frontend, backend et postgres démarrent sans régression.

### Project Structure Notes

- État actuel: `server/db.js` contient le bootstrap SQL inline; `server/migrations/` n'existe pas encore.
- Décision de transition recommandée: introduire d'abord l'infrastructure migration de façon additive et réversible, puis rationaliser le bootstrap SQL dans une story dédiée si nécessaire.

### Risks and Guardrails

- Risque: duplication ou divergence entre bootstrap SQL existant et nouvelles migrations.
- Garde-fou: définir une source de vérité explicite (runner + table de version) et éviter les modifications concurrentes non tracées.
- Risque: casser le démarrage local.
- Garde-fou: garder un chemin d'exécution simple, idempotent et testable localement avant toute optimisation.

### References

- Epic et AC: `_bmad-output/planning-artifacts/epics.md` (Epic 1, Story 1.1).
- Cadrage produit: `_bmad-output/planning-artifacts/prd.md` (sections objectifs, contraintes, FR/NFR).
- Contraintes architecture: `_bmad-output/planning-artifacts/architecture.md` (Starter Template Evaluation, Data Architecture, Infrastructure & Deployment).
- Règles projet: `_bmad-output/project-context.md` (stack versions, règles ESM, SQL paramétré, Docker/Nginx).
- Contexte global produit/tech: `docs/product-context.md`, `docs/tech-context.md`.
- Vite migration guide: https://vite.dev/guide/migration.html
- Node.js download/LTS info: https://nodejs.org/en/download/prebuilt-binaries/current
- PostgreSQL docs/support lines: https://www.postgresql.org/docs/16/

## Vérifications manuelles

1. Vérifier qu'aucune dépendance ou framework de remplacement n'a été introduit.
2. Vérifier la présence de `server/migrations/` avec une convention de nommage claire et documentée.
3. Vérifier qu'un démarrage backend applique les migrations sans erreur puis expose `/health`.
4. Vérifier que le flux Docker local (`frontend`, `backend`, `postgres`) reste opérationnel.
5. Vérifier qu'aucune régression API/socket liée à l'initialisation DB n'est observée.

## Questions Ouvertes (à trancher avant implémentation si besoin)

- Convention de versionnement choisie pour les migrations: timestamp (`YYYYMMDDHHMM`) ou incrémental (`0001`, `0002`)?
- Stratégie de coexistence court terme entre bootstrap SQL historique (`initDatabase`) et runner migrations: double-run idempotent ou bascule directe?

## Dev Agent Record

### Agent Model Used

gpt-5

### Debug Log References

- Analyse exhaustive des artefacts: epics, PRD, architecture, UX, project-context, AGENTS.md.
- Vérification du dépôt réel: `package.json`, `server/package.json`, `docker-compose.yml`, `nginx.conf`, `server/db.js`.
- Validation backend: `cd server && npm test` (5 tests passés).
- Validation frontend/repo: `npm run lint` (0 error), `npm run test` (9 tests passés), `npm run build` (OK).
- Validation compose: `docker compose config` (OK).

### Completion Notes List

- Story context créée avec guardrails techniques, contraintes d'architecture, stratégie migration et vérifications manuelles.
- Story alignée sur le mode Delivery (simple, testable, réversible) tout en préparant les stories suivantes de l'Epic 1.
- Ultimate context engine analysis completed - comprehensive developer guide created.
- Baseline technique conservée (React + TypeScript + Vite, Express + Socket.IO + pg), aucun changement de framework.
- Fondations migrations SQL ajoutées: runner idempotent Node ESM + table `schema_migrations` + migration initiale `0001_initial_schema.sql`.
- Démarrage backend branché sur exécution migrations avant `listen()` avec `startServer` exporté et testable.
- Stratégie d'évolution DB documentée (naming, forward-only, exécution local/CI/prod, rollback minimal).
- Test non-régression ajouté pour garantir `migrations` puis disponibilité `GET /health`.

### File List

- _bmad-output/implementation-artifacts/1-1-set-up-initial-project-from-starter-template.md
- README.md
- server/db.js
- server/index.js
- server/package.json
- server/migrate.js
- server/db.migrations.test.js
- server/startup.test.js
- server/migrations/0001_initial_schema.sql
- server/migrations/README.md
- src/pages/Index.tsx

### Change Log

- 2026-04-16: Implémentation complète Story 1.1 (baseline validée, migrations SQL introduites, tests de non-régression ajoutés, documentation mise à jour).
