import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { runMigrations } from "./db.js";

test("runMigrations applique une migration SQL une seule fois (idempotent)", async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "retro-party-migrations-"));
  const migrationFileName = "0001_test_table.sql";
  const migrationSql = "CREATE TABLE IF NOT EXISTS test_table(id INT PRIMARY KEY);";

  await fs.writeFile(path.join(tempDir, migrationFileName), migrationSql, "utf8");

  const appliedVersions = new Set();
  const executedSql = [];
  const insertedVersions = [];

  const fakeClient = {
    async query(text, params = []) {
      const sql = String(text).trim();
      executedSql.push(sql);

      if (sql.startsWith("SELECT version FROM schema_migrations")) {
        const version = params[0];
        const exists = appliedVersions.has(version);
        return {
          rowCount: exists ? 1 : 0,
          rows: exists ? [{ version }] : [],
        };
      }

      if (sql.includes("INSERT INTO schema_migrations")) {
        const version = params[0];
        appliedVersions.add(version);
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

  const silentLogger = {
    log() {},
    warn() {},
  };

  try {
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
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true });
  }
});
