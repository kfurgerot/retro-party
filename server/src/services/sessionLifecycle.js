// Phase α — module-agnostic session lifecycle service.
// Resolves a session by code into the right table, then performs the
// requested transition. Single point of mutation for status.

const TABLES = {
  "retro-party": { table: "rooms", codeCol: "room_code", ownerCol: "created_by_user_id" },
  "planning-poker": { table: "rooms", codeCol: "room_code", ownerCol: "created_by_user_id" },
  "radar-party": {
    table: "radar_sessions",
    codeCol: "session_code",
    ownerCol: "created_by_user_id",
  },
  "skills-matrix": {
    table: "skills_matrix_sessions",
    codeCol: "session_code",
    ownerCol: "created_by_user_id",
  },
};

const VALID_STATUSES = new Set(["lobby", "live", "ended", "abandoned"]);

async function resolveSessionByCode(pool, code) {
  const raw = String(code || "")
    .trim()
    .toUpperCase();
  if (!raw) return null;
  const candidates = [
    { module: "skills-matrix", ...TABLES["skills-matrix"] },
    { module: "radar-party", ...TABLES["radar-party"] },
    { module: "retro-party", ...TABLES["retro-party"] }, // covers planning-poker too
  ];
  for (const c of candidates) {
    const result = await pool.query(
      `SELECT id, status, ${c.ownerCol} AS owner_user_id FROM ${c.table} WHERE ${c.codeCol} = $1 LIMIT 1`,
      [raw],
    );
    if (result.rows[0]) {
      return {
        module: c.module,
        table: c.table,
        codeCol: c.codeCol,
        ownerCol: c.ownerCol,
        id: result.rows[0].id,
        status: result.rows[0].status,
        ownerUserId: result.rows[0].owner_user_id,
        code: raw,
      };
    }
  }
  return null;
}

async function transitionTo(pool, session, nextStatus, actorUserId) {
  if (!VALID_STATUSES.has(nextStatus)) {
    throw new Error(`Invalid status: ${nextStatus}`);
  }
  const sets = ["status = $1", "last_active_at = now()"];
  const values = [nextStatus, session.id];
  if (nextStatus === "ended") {
    sets.push("ended_at = now()");
    values.push(actorUserId ?? null);
    sets.push(`ended_by_user_id = $${values.length}`);
  } else if (nextStatus === "live" && session.status !== "live") {
    sets.push("started_at = COALESCE(started_at, now())");
  }
  await pool.query(`UPDATE ${session.table} SET ${sets.join(", ")} WHERE id = $2`, values);
}

async function bumpActivity(pool, session) {
  await pool.query(`UPDATE ${session.table} SET last_active_at = now() WHERE id = $1`, [
    session.id,
  ]);
}

const ABANDON_THRESHOLD_MINUTES = 720; // 12 hours

async function markAbandonedSessions(pool) {
  const tables = ["rooms", "radar_sessions", "skills_matrix_sessions"];
  let total = 0;
  for (const table of tables) {
    const result = await pool.query(
      `UPDATE ${table}
       SET status = 'abandoned'
       WHERE status IN ('lobby','live')
         AND last_active_at < now() - ($1::int || ' minutes')::interval
       RETURNING id`,
      [ABANDON_THRESHOLD_MINUTES],
    );
    total += result.rowCount;
  }
  return total;
}

export const sessionLifecycle = {
  resolveSessionByCode,
  transitionTo,
  bumpActivity,
  markAbandonedSessions,
  ABANDON_THRESHOLD_MINUTES,
};
