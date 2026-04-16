import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { runMigrations } from "./db.js";

function createFakePool({ existingChecksums = new Map() } = {}) {
  const appliedChecksums = new Map(existingChecksums);
  const executedSql = [];
  const insertedVersions = [];

  const fakeClient = {
    async query(text, params = []) {
      const sql = String(text).trim();
      executedSql.push(sql);

      if (sql.startsWith("SELECT pg_advisory_lock")) {
        return { rowCount: 1, rows: [{ pg_advisory_lock: true }] };
      }

      if (sql.startsWith("SELECT pg_advisory_unlock")) {
        return { rowCount: 1, rows: [{ pg_advisory_unlock: true }] };
      }

      if (sql.startsWith("SELECT version, checksum_sha256 FROM schema_migrations")) {
        const version = params[0];
        const checksum = appliedChecksums.get(version);
        return {
          rowCount: checksum ? 1 : 0,
          rows: checksum ? [{ version, checksum_sha256: checksum }] : [],
        };
      }

      if (sql.includes("INSERT INTO schema_migrations")) {
        const version = params[0];
        const checksum = params[2];
        appliedChecksums.set(version, checksum);
        insertedVersions.push(version);
        return { rowCount: 1, rows: [] };
      }

      return { rowCount: 0, rows: [] };
    },
    release() {},
  };

  const fakePool = {
    async connect() {
      return fakeClient;
    },
  };

  return { fakePool, executedSql, insertedVersions };
}

async function withTempMigrations(files, fn) {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "retro-party-migrations-"));
  try {
    for (const [name, content] of files) {
      await fs.writeFile(path.join(tempDir, name), content, "utf8");
    }
    await fn(tempDir);
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true });
  }
}

const silentLogger = {
  log() {},
  warn() {},
};

test("runMigrations applique une migration SQL une seule fois (idempotent)", async () => {
  const migrationFileName = "0001_test_table.sql";
  const migrationSql = "CREATE TABLE IF NOT EXISTS test_table(id INT PRIMARY KEY);";
  const { fakePool, executedSql, insertedVersions } = createFakePool();

  await withTempMigrations([[migrationFileName, migrationSql]], async (tempDir) => {
    const firstRun = await runMigrations({
      pool: fakePool,
      migrationsDir: tempDir,
      logger: silentLogger,
    });
    const secondRun = await runMigrations({
      pool: fakePool,
      migrationsDir: tempDir,
      logger: silentLogger,
    });

    assert.deepEqual(firstRun, [migrationFileName]);
    assert.deepEqual(secondRun, []);

    const migrationExecCount = executedSql.filter((sql) => sql === migrationSql).length;
    assert.equal(migrationExecCount, 1);
    assert.deepEqual(insertedVersions, ["0001"]);

    const lockCalls = executedSql.filter((sql) => sql.startsWith("SELECT pg_advisory_lock")).length;
    const unlockCalls = executedSql.filter((sql) => sql.startsWith("SELECT pg_advisory_unlock")).length;
    assert.equal(lockCalls, 2);
    assert.equal(unlockCalls, 2);
  });
});

test("runMigrations échoue sur un fichier hors convention de nommage", async () => {
  await withTempMigrations(
    [
      ["0001_ok.sql", "SELECT 1;"],
      ["migration.sql", "SELECT 2;"],
    ],
    async (tempDir) => {
      await assert.rejects(
        runMigrations({
          migrationsDir: tempDir,
          logger: silentLogger,
        }),
        /Fichier\(s\) invalide\(s\)/
      );
    }
  );
});

test("runMigrations échoue en cas de version de migration dupliquée", async () => {
  await withTempMigrations(
    [
      ["0001_first.sql", "SELECT 1;"],
      ["0001_second.sql", "SELECT 2;"],
    ],
    async (tempDir) => {
      await assert.rejects(
        runMigrations({
          migrationsDir: tempDir,
          logger: silentLogger,
        }),
        /Version dupliquée/
      );
    }
  );
});

test("runMigrations échoue si le checksum d'une migration déjà appliquée diverge", async () => {
  const migrationSql = "SELECT 42;";
  const { fakePool } = createFakePool({
    existingChecksums: new Map([["0001", crypto.createHash("sha256").update("SELECT 41;").digest("hex")]]),
  });

  await withTempMigrations([["0001_checksum_guard.sql", migrationSql]], async (tempDir) => {
    await assert.rejects(
      runMigrations({
        pool: fakePool,
        migrationsDir: tempDir,
        logger: silentLogger,
      }),
      /Checksum incompatible/
    );
  });
});

test("runMigrations exécute les migrations selon l'ordre numérique de version", async () => {
  const sql9999 = "SELECT 9999 AS migration_order;";
  const sql10000 = "SELECT 10000 AS migration_order;";
  const { fakePool, executedSql } = createFakePool();

  await withTempMigrations(
    [
      ["9999_before.sql", sql9999],
      ["10000_after.sql", sql10000],
    ],
    async (tempDir) => {
      await runMigrations({
        pool: fakePool,
        migrationsDir: tempDir,
        logger: silentLogger,
      });
    }
  );

  const observedSqlOrder = executedSql.filter((sql) => sql === sql9999 || sql === sql10000);
  assert.deepEqual(observedSqlOrder, [sql9999, sql10000]);
});

test("runMigrations fail-fast quand le dossier de migrations est vide", async () => {
  await withTempMigrations([], async (tempDir) => {
    await assert.rejects(
      runMigrations({
        migrationsDir: tempDir,
        logger: silentLogger,
      }),
      /Aucun fichier SQL valide/
    );
  });
});
