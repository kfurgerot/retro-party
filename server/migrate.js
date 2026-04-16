import { pool, runMigrations } from "./db.js";

async function main() {
  try {
    await runMigrations();
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error("[migrations] Échec du runner:", error);
  process.exit(1);
});
