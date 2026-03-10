import { Pool } from "pg";

const DATABASE_URL = process.env.DATABASE_URL || "postgresql://retro:retro_pwd@localhost:5432/retro_party";

export const pool = new Pool({
  connectionString: DATABASE_URL,
});

export async function initDatabase() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id UUID PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      display_name TEXT NOT NULL,
      email_verified_at TIMESTAMPTZ NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS game_templates (
      id UUID PRIMARY KEY,
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      description TEXT NULL,
      base_config JSONB NOT NULL DEFAULT '{}'::jsonb,
      is_archived BOOLEAN NOT NULL DEFAULT false,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);
  await pool.query(
    "CREATE INDEX IF NOT EXISTS idx_game_templates_user_id ON game_templates(user_id);"
  );
  await pool.query(
    "CREATE INDEX IF NOT EXISTS idx_game_templates_user_updated ON game_templates(user_id, updated_at DESC);"
  );

  await pool.query(`
    CREATE TABLE IF NOT EXISTS custom_questions (
      id UUID PRIMARY KEY,
      template_id UUID NOT NULL REFERENCES game_templates(id) ON DELETE CASCADE,
      text TEXT NOT NULL,
      category TEXT NULL,
      sort_order INT NOT NULL DEFAULT 0,
      is_active BOOLEAN NOT NULL DEFAULT true,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);
  await pool.query(
    "CREATE INDEX IF NOT EXISTS idx_custom_questions_template_id ON custom_questions(template_id);"
  );
  await pool.query(
    "CREATE UNIQUE INDEX IF NOT EXISTS uniq_template_question_order ON custom_questions(template_id, sort_order);"
  );

  await pool.query(`
    CREATE TABLE IF NOT EXISTS rooms (
      id UUID PRIMARY KEY,
      room_code VARCHAR(8) NOT NULL UNIQUE,
      created_by_user_id UUID NULL REFERENCES users(id) ON DELETE SET NULL,
      source_template_id UUID NULL REFERENCES game_templates(id) ON DELETE SET NULL,
      mode TEXT NOT NULL CHECK (mode IN ('quick', 'template')),
      config_snapshot JSONB NOT NULL,
      status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'started', 'ended')),
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      started_at TIMESTAMPTZ NULL,
      ended_at TIMESTAMPTZ NULL
    );
  `);
  await pool.query("CREATE INDEX IF NOT EXISTS idx_rooms_created_by_user_id ON rooms(created_by_user_id);");
  await pool.query(
    "CREATE INDEX IF NOT EXISTS idx_rooms_source_template_id ON rooms(source_template_id);"
  );

  await pool.query(`
    CREATE TABLE IF NOT EXISTS auth_sessions (
      id UUID PRIMARY KEY,
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      session_token_hash TEXT NOT NULL UNIQUE,
      user_agent TEXT NULL,
      ip_address INET NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      expires_at TIMESTAMPTZ NOT NULL,
      revoked_at TIMESTAMPTZ NULL
    );
  `);
  await pool.query(
    "CREATE INDEX IF NOT EXISTS idx_auth_sessions_user_id ON auth_sessions(user_id);"
  );
  await pool.query(
    "CREATE INDEX IF NOT EXISTS idx_auth_sessions_expires_at ON auth_sessions(expires_at);"
  );

  await pool.query(`
    CREATE TABLE IF NOT EXISTS password_reset_tokens (
      id UUID PRIMARY KEY,
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      token_hash TEXT NOT NULL UNIQUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      expires_at TIMESTAMPTZ NOT NULL,
      used_at TIMESTAMPTZ NULL
    );
  `);
  await pool.query(
    "CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_user_id ON password_reset_tokens(user_id);"
  );
  await pool.query(
    "CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_expires_at ON password_reset_tokens(expires_at);"
  );
}
