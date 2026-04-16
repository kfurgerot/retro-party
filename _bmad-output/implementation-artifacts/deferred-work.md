## Deferred from: code review of 1-1-set-up-initial-project-from-starter-template.md (2026-04-16)

- Absence de borne temporelle explicite au démarrage backend (`initializeDatabase` puis `listen`) dans `server/index.js:1974` : amélioration de résilience identifiée, mais pré-existante et hors scope direct de la story.
