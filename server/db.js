import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Pool } from "pg";

const DATABASE_URL = process.env.DATABASE_URL || "postgresql://retro:retro_pwd@localhost:5432/retro_party";
const DEFAULT_MIGRATIONS_DIR = fileURLToPath(new URL("./migrations", import.meta.url));
const MIGRATION_FILENAME_REGEX = /^(\d{4,})_([a-z0-9_]+)\.sql$/;
const MIGRATIONS_LOCK_NAMESPACE = 4242;
const MIGRATIONS_LOCK_KEY = 1;

export const pool = new Pool({
  connectionString: DATABASE_URL,
});

function parseMigrationFilename(fileName) {
  const match = MIGRATION_FILENAME_REGEX.exec(fileName);
  if (!match) return null;
  return {
    version: match[1],
    description: match[2],
    fileName,
  };
}

async function listMigrationFiles(migrationsDir) {
  const entries = await fs.readdir(migrationsDir, { withFileTypes: true });
  const fileNames = entries.filter((entry) => entry.isFile()).map((entry) => entry.name);
  const migrations = [];
  const invalidFileNames = [];
  for (const fileName of fileNames) {
    const parsed = parseMigrationFilename(fileName);
    if (!parsed) {
      invalidFileNames.push(fileName);
      continue;
    }
    migrations.push(parsed);
  }

  if (invalidFileNames.length > 0) {
    throw new Error(
      `[migrations] Fichier(s) invalide(s): ${invalidFileNames.join(
        ", "
      )}. Format attendu: NNNN_description.sql`
    );
  }

  if (migrations.length === 0) {
    throw new Error(`[migrations] Aucun fichier SQL valide trouvé dans ${migrationsDir}`);
  }

  const versions = new Map();
  for (const migration of migrations) {
    const existingFile = versions.get(migration.version);
    if (existingFile) {
      throw new Error(
        `[migrations] Version dupliquée ${migration.version} détectée: ${existingFile} et ${migration.fileName}`
      );
    }
    versions.set(migration.version, migration.fileName);
  }

  migrations.sort((a, b) => {
    const left = BigInt(a.version);
    const right = BigInt(b.version);
    if (left === right) {
      return a.fileName.localeCompare(b.fileName);
    }
    return left < right ? -1 : 1;
  });
  return migrations;
}

async function ensureSchemaMigrationsTable(client) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      checksum_sha256 TEXT NOT NULL,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);
}

export async function runMigrations({
  pool: poolInstance = pool,
  migrationsDir = DEFAULT_MIGRATIONS_DIR,
  logger = console,
} = {}) {
  const migrations = await listMigrationFiles(migrationsDir);

  const client = await poolInstance.connect();
  let advisoryLockAcquired = false;
  const applied = [];
  try {
    await client.query("SELECT pg_advisory_lock($1, $2);", [
      MIGRATIONS_LOCK_NAMESPACE,
      MIGRATIONS_LOCK_KEY,
    ]);
    advisoryLockAcquired = true;

    await ensureSchemaMigrationsTable(client);

    for (const migration of migrations) {
      const filePath = path.join(migrationsDir, migration.fileName);
      const sql = await fs.readFile(filePath, "utf8");
      const checksum = crypto.createHash("sha256").update(sql).digest("hex");

      const existing = await client.query(
        "SELECT version, checksum_sha256 FROM schema_migrations WHERE version = $1;",
        [migration.version]
      );
      if (existing.rowCount > 0) {
        const existingChecksum = existing.rows[0].checksum_sha256;
        if (existingChecksum !== checksum) {
          throw new Error(
            `[migrations] Checksum incompatible pour ${migration.fileName}: attendu ${existingChecksum}, obtenu ${checksum}`
          );
        }
        continue;
      }

      await client.query("BEGIN");
      try {
        await client.query(sql);
        await client.query(
          `
            INSERT INTO schema_migrations (version, name, checksum_sha256)
            VALUES ($1, $2, $3);
          `,
          [migration.version, migration.description, checksum]
        );
        await client.query("COMMIT");
      } catch (error) {
        await client.query("ROLLBACK");
        throw new Error(`Migration échouée (${migration.fileName}): ${error.message}`);
      }

      applied.push(migration.fileName);
    }
  } finally {
    if (advisoryLockAcquired) {
      try {
        await client.query("SELECT pg_advisory_unlock($1, $2);", [
          MIGRATIONS_LOCK_NAMESPACE,
          MIGRATIONS_LOCK_KEY,
        ]);
      } catch (unlockError) {
        logger.warn?.(
          `[migrations] Impossible de libérer le verrou advisory: ${unlockError.message}`
        );
      }
    }
    client.release();
  }

  if (applied.length > 0) {
    logger.log?.(`[migrations] ${applied.length} migration(s) appliquée(s): ${applied.join(", ")}`);
  } else {
    logger.log?.("[migrations] Aucune nouvelle migration à appliquer.");
  }

  return applied;
}

export async function initDatabase() {
  return runMigrations();
}
