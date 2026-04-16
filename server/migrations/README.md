# Stratégie des migrations SQL

## Convention de nommage

- Format unique: `NNNN_description.sql`
- `NNNN` est un numéro incrémental (ex: `0001`, `0002`).
- `description` est en snake_case lisible.

Exemple: `0002_add_room_indexes.sql`.

## Règles d'écriture

- Migrations **forward-only**: on corrige par une nouvelle migration, on n'édite pas une migration déjà exécutée.
- SQL idempotent autant que possible (`IF NOT EXISTS`, `ADD COLUMN IF NOT EXISTS`).
- Une migration = un changement cohérent et traçable.

## Exécution

- Le backend applique les migrations au démarrage avant `listen()` via `initDatabase()`.
- Exécution manuelle possible:

```bash
cd server
npm run migrate
```

## Local / CI / Prod

- Local: migrations exécutées au démarrage (`npm run dev` ou Docker).
- CI: exécuter `npm run migrate` avant les tests d'intégration backend.
- Prod: exécuter `npm run migrate` pendant le déploiement, avant exposition du service.

## Rollback minimal

- Pas de rollback automatique.
- En cas d'incident, appliquer une migration corrective (`000X_fix_...sql`) pour revenir à un état valide.
