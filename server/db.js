import { Pool } from "pg";

const DATABASE_URL =
  process.env.DATABASE_URL || "postgresql://retro:retro_pwd@localhost:5432/retro_party";

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
    "CREATE INDEX IF NOT EXISTS idx_game_templates_user_id ON game_templates(user_id);",
  );
  await pool.query(
    "CREATE INDEX IF NOT EXISTS idx_game_templates_user_updated ON game_templates(user_id, updated_at DESC);",
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
    "CREATE INDEX IF NOT EXISTS idx_custom_questions_template_id ON custom_questions(template_id);",
  );
  await pool.query(
    "CREATE UNIQUE INDEX IF NOT EXISTS uniq_template_question_order ON custom_questions(template_id, sort_order);",
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
  await pool.query(
    "CREATE INDEX IF NOT EXISTS idx_rooms_created_by_user_id ON rooms(created_by_user_id);",
  );
  await pool.query(
    "CREATE INDEX IF NOT EXISTS idx_rooms_source_template_id ON rooms(source_template_id);",
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
    "CREATE INDEX IF NOT EXISTS idx_auth_sessions_user_id ON auth_sessions(user_id);",
  );
  await pool.query(
    "CREATE INDEX IF NOT EXISTS idx_auth_sessions_expires_at ON auth_sessions(expires_at);",
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
    "CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_user_id ON password_reset_tokens(user_id);",
  );
  await pool.query(
    "CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_expires_at ON password_reset_tokens(expires_at);",
  );

  await pool.query(`
    CREATE TABLE IF NOT EXISTS radar_sessions (
      id UUID PRIMARY KEY,
      session_code VARCHAR(8) NOT NULL UNIQUE,
      title TEXT NULL,
      facilitator_name TEXT NULL,
      created_by_user_id UUID NULL REFERENCES users(id) ON DELETE SET NULL,
      host_participates BOOLEAN NOT NULL DEFAULT true,
      status TEXT NOT NULL DEFAULT 'lobby' CHECK (status IN ('lobby', 'started')),
      started_at TIMESTAMPTZ NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);
  await pool.query(
    "ALTER TABLE radar_sessions ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'lobby';",
  );
  await pool.query(
    "ALTER TABLE radar_sessions ADD COLUMN IF NOT EXISTS started_at TIMESTAMPTZ NULL;",
  );
  await pool.query(
    "ALTER TABLE radar_sessions ADD COLUMN IF NOT EXISTS host_participates BOOLEAN NOT NULL DEFAULT true;",
  );
  await pool.query(
    "CREATE INDEX IF NOT EXISTS idx_radar_sessions_created_by_user_id ON radar_sessions(created_by_user_id);",
  );

  await pool.query(`
    CREATE TABLE IF NOT EXISTS radar_participants (
      id UUID PRIMARY KEY,
      session_id UUID NOT NULL REFERENCES radar_sessions(id) ON DELETE CASCADE,
      display_name TEXT NOT NULL,
      avatar INT NOT NULL DEFAULT 0,
      is_host BOOLEAN NOT NULL DEFAULT false,
      progress_answered INT NOT NULL DEFAULT 0,
      progress_total INT NOT NULL DEFAULT 50,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);
  await pool.query(
    "ALTER TABLE radar_participants ADD COLUMN IF NOT EXISTS avatar INT NOT NULL DEFAULT 0;",
  );
  await pool.query(
    "ALTER TABLE radar_participants ADD COLUMN IF NOT EXISTS is_host BOOLEAN NOT NULL DEFAULT false;",
  );
  await pool.query(
    "ALTER TABLE radar_participants ADD COLUMN IF NOT EXISTS progress_answered INT NOT NULL DEFAULT 0;",
  );
  await pool.query(
    "ALTER TABLE radar_participants ADD COLUMN IF NOT EXISTS progress_total INT NOT NULL DEFAULT 50;",
  );
  await pool.query(
    "CREATE INDEX IF NOT EXISTS idx_radar_participants_session_id ON radar_participants(session_id);",
  );

  await pool.query(`
    CREATE TABLE IF NOT EXISTS radar_responses (
      id UUID PRIMARY KEY,
      session_id UUID NOT NULL REFERENCES radar_sessions(id) ON DELETE CASCADE,
      participant_id UUID NOT NULL UNIQUE REFERENCES radar_participants(id) ON DELETE CASCADE,
      answers JSONB NOT NULL,
      radar JSONB NOT NULL,
      poles JSONB NOT NULL,
      summary TEXT NOT NULL,
      strengths JSONB NOT NULL,
      watchouts JSONB NOT NULL,
      workshop_questions JSONB NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);
  await pool.query(
    "CREATE INDEX IF NOT EXISTS idx_radar_responses_session_id ON radar_responses(session_id);",
  );

  await pool.query(`
    CREATE TABLE IF NOT EXISTS radar_team_results (
      session_id UUID PRIMARY KEY REFERENCES radar_sessions(id) ON DELETE CASCADE,
      member_count INT NOT NULL DEFAULT 0,
      radar JSONB NOT NULL,
      insight JSONB NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS skills_matrix_sessions (
      id UUID PRIMARY KEY,
      session_code VARCHAR(8) NOT NULL UNIQUE,
      title TEXT NOT NULL,
      scale_min INT NOT NULL DEFAULT 1,
      scale_max INT NOT NULL DEFAULT 5,
      status TEXT NOT NULL DEFAULT 'lobby' CHECK (status IN ('lobby', 'started')),
      started_at TIMESTAMPTZ NULL,
      created_by_user_id UUID NULL REFERENCES users(id) ON DELETE SET NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      CHECK (scale_min >= 0 AND scale_max <= 10 AND scale_min < scale_max)
    );
  `);
  await pool.query(
    "ALTER TABLE skills_matrix_sessions ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'lobby';",
  );
  await pool.query(
    "ALTER TABLE skills_matrix_sessions ADD COLUMN IF NOT EXISTS started_at TIMESTAMPTZ NULL;",
  );
  await pool.query(
    "CREATE INDEX IF NOT EXISTS idx_skills_matrix_sessions_created_by_user_id ON skills_matrix_sessions(created_by_user_id);",
  );
  await pool.query(
    "CREATE INDEX IF NOT EXISTS idx_skills_matrix_sessions_created_at ON skills_matrix_sessions(created_at DESC);",
  );

  await pool.query(`
    CREATE TABLE IF NOT EXISTS skills_matrix_participants (
      id UUID PRIMARY KEY,
      session_id UUID NOT NULL REFERENCES skills_matrix_sessions(id) ON DELETE CASCADE,
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      display_name TEXT NOT NULL,
      avatar INT NOT NULL DEFAULT 0,
      is_admin BOOLEAN NOT NULL DEFAULT false,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);
  await pool.query(
    "ALTER TABLE skills_matrix_participants DROP CONSTRAINT IF EXISTS skills_matrix_participants_session_id_user_id_key;",
  );
  await pool.query(
    "ALTER TABLE skills_matrix_participants ADD COLUMN IF NOT EXISTS avatar INT NOT NULL DEFAULT 0;",
  );
  await pool.query("ALTER TABLE skills_matrix_participants ALTER COLUMN user_id DROP NOT NULL;");
  await pool.query(
    "CREATE INDEX IF NOT EXISTS idx_skills_matrix_participants_session_id ON skills_matrix_participants(session_id);",
  );
  await pool.query(
    "CREATE INDEX IF NOT EXISTS idx_skills_matrix_participants_user_id ON skills_matrix_participants(user_id);",
  );

  await pool.query(`
    CREATE TABLE IF NOT EXISTS skills_matrix_categories (
      id UUID PRIMARY KEY,
      session_id UUID NOT NULL REFERENCES skills_matrix_sessions(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      sort_order INT NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);
  await pool.query(
    "CREATE INDEX IF NOT EXISTS idx_skills_matrix_categories_session_id ON skills_matrix_categories(session_id);",
  );

  await pool.query(`
    CREATE TABLE IF NOT EXISTS skills_matrix_skills (
      id UUID PRIMARY KEY,
      session_id UUID NOT NULL REFERENCES skills_matrix_sessions(id) ON DELETE CASCADE,
      category_id UUID NULL REFERENCES skills_matrix_categories(id) ON DELETE SET NULL,
      name TEXT NOT NULL,
      sort_order INT NOT NULL DEFAULT 0,
      required_level INT NOT NULL DEFAULT 1,
      required_people INT NOT NULL DEFAULT 1,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      CHECK (required_level >= 0),
      CHECK (required_people >= 0)
    );
  `);
  await pool.query(
    "CREATE INDEX IF NOT EXISTS idx_skills_matrix_skills_session_id ON skills_matrix_skills(session_id);",
  );
  await pool.query(
    "CREATE INDEX IF NOT EXISTS idx_skills_matrix_skills_category_id ON skills_matrix_skills(category_id);",
  );

  await pool.query(`
    CREATE TABLE IF NOT EXISTS skills_matrix_assessments (
      id UUID PRIMARY KEY,
      session_id UUID NOT NULL REFERENCES skills_matrix_sessions(id) ON DELETE CASCADE,
      skill_id UUID NOT NULL REFERENCES skills_matrix_skills(id) ON DELETE CASCADE,
      participant_id UUID NOT NULL REFERENCES skills_matrix_participants(id) ON DELETE CASCADE,
      current_level INT NULL,
      target_level INT NULL,
      wants_to_progress BOOLEAN NOT NULL DEFAULT false,
      wants_to_mentor BOOLEAN NOT NULL DEFAULT false,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE (skill_id, participant_id)
    );
  `);
  await pool.query(
    "ALTER TABLE skills_matrix_assessments ADD COLUMN IF NOT EXISTS wants_to_mentor BOOLEAN NOT NULL DEFAULT false;",
  );
  await pool.query(
    "CREATE INDEX IF NOT EXISTS idx_skills_matrix_assessments_session_id ON skills_matrix_assessments(session_id);",
  );
  await pool.query(
    "CREATE INDEX IF NOT EXISTS idx_skills_matrix_assessments_skill_id ON skills_matrix_assessments(skill_id);",
  );
  await pool.query(
    "CREATE INDEX IF NOT EXISTS idx_skills_matrix_assessments_participant_id ON skills_matrix_assessments(participant_id);",
  );
}
