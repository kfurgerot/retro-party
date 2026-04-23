# Skills Matrix

## Objectif

Le module **Matrice de Compétences** permet à une équipe de :

- structurer ses compétences par catégories
- s'auto-évaluer (niveau actuel / niveau cible)
- expliciter l'intention de progression
- définir un besoin cible par compétence (niveau requis + nombre de personnes)
- visualiser les risques de couverture

## Parcours MVP

1. Un utilisateur connecté crée une session.
2. Les membres rejoignent la session via un code.
3. Chaque membre choisit son pseudo et son avatar dans le lobby.
4. L'admin démarre la session puis configure les catégories, compétences et besoins attendus.
5. Chaque membre renseigne son niveau actuel, son niveau cible et son intention de progression.
6. Le dashboard montre :
   - les compétences à risque
   - les compétences couvertes
   - qui peut aider / qui veut apprendre

## API

Base path : `/api/skills-matrix`

- `POST /sessions`
- `POST /sessions/:code/join`
- `GET /sessions/:code`
- `POST /sessions/:code/start`
- `PATCH /sessions/:code`
- `POST /sessions/:code/categories`
- `PATCH /sessions/:code/categories/:categoryId`
- `DELETE /sessions/:code/categories/:categoryId`
- `POST /sessions/:code/skills`
- `PATCH /sessions/:code/skills/:skillId`
- `DELETE /sessions/:code/skills/:skillId`
- `PUT /sessions/:code/assessments/:skillId`

Tous les endpoints sont protégés par authentification cookie.

## Données persistées

- `skills_matrix_sessions`
- `skills_matrix_participants`
- `skills_matrix_categories`
- `skills_matrix_skills`
- `skills_matrix_assessments`

## Intégration Agile Suite

- Portail : nouveau module `skills-matrix` (catégories Insight + Pilotage)
- Routing frontend : `/skills-matrix`
- Dashboard global : activités "Matrice de Compétences" incluses dans l'agrégat utilisateur
