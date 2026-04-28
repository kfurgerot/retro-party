const MODULE_META = {
  "retro-party": { id: "retro-party", label: "Retro Party", icon: "🎲" },
  "planning-poker": { id: "planning-poker", label: "Planning Poker", icon: "🃏" },
  "radar-party": { id: "radar-party", label: "Radar Party", icon: "📡" },
  "skills-matrix": { id: "skills-matrix", label: "Matrice de Compétences", icon: "🧩" },
};

function normalizeModuleId(value) {
  return value === "planning-poker" || value === "radar-party" || value === "skills-matrix"
    ? value
    : "retro-party";
}

function normalizeJsonObject(value) {
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
    } catch (_err) {
      return {};
    }
  }
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function mapRoomToActivity(row) {
  const snapshot = normalizeJsonObject(row.config_snapshot);
  const baseConfig = normalizeJsonObject(snapshot.baseConfig);
  const snapshotModule = typeof baseConfig.module === "string" ? baseConfig.module : null;
  const templateModule =
    typeof row.source_template_module === "string" ? row.source_template_module : null;
  const moduleId = normalizeModuleId(templateModule || snapshotModule);
  const moduleMeta = MODULE_META[moduleId];

  const templateName =
    typeof row.source_template_name === "string" && row.source_template_name.trim()
      ? row.source_template_name.trim()
      : null;
  const snapshotTemplateName =
    typeof snapshot.templateName === "string" && snapshot.templateName.trim()
      ? snapshot.templateName.trim()
      : null;
  const defaultTitle =
    moduleId === "planning-poker" ? "Session Planning Poker" : "Session Retro Party";
  const title = templateName || snapshotTemplateName || defaultTitle;

  return {
    id: `room:${row.id}`,
    rawId: row.id,
    kind: "room",
    moduleId,
    moduleLabel: moduleMeta.label,
    moduleIcon: moduleMeta.icon,
    activityType: "session",
    activityLabel: row.mode === "template" ? "Session depuis template" : "Session rapide",
    title,
    details: row.room_code ? `Code ${row.room_code}` : null,
    sessionCode: row.room_code || null,
    status: row.status || "open",
    teamId: row.team_id ?? null,
    occurredAt: row.ended_at || row.started_at || row.created_at,
    createdAt: row.created_at,
    startedAt: row.started_at,
    endedAt: row.ended_at,
  };
}

function mapRadarToActivity(row) {
  const moduleMeta = MODULE_META["radar-party"];
  const title =
    typeof row.title === "string" && row.title.trim() ? row.title.trim() : "Session Radar Party";

  return {
    id: `radar:${row.id}`,
    rawId: row.id,
    kind: "radar",
    moduleId: "radar-party",
    moduleLabel: moduleMeta.label,
    moduleIcon: moduleMeta.icon,
    activityType: "session",
    activityLabel: "Session Radar",
    title,
    details: row.session_code ? `Code ${row.session_code}` : null,
    sessionCode: row.session_code || null,
    status: row.status || "lobby",
    teamId: row.team_id ?? null,
    occurredAt: row.started_at || row.created_at,
    createdAt: row.created_at,
    startedAt: row.started_at,
    endedAt: null,
  };
}

function mapTemplateToActivity(row) {
  const baseConfig = normalizeJsonObject(row.base_config);
  const moduleId = normalizeModuleId(baseConfig.module);
  const moduleMeta = MODULE_META[moduleId];
  const title = typeof row.name === "string" && row.name.trim() ? row.name.trim() : "Template";
  const description =
    typeof row.description === "string" && row.description.trim() ? row.description.trim() : null;

  return {
    id: `template:${row.id}`,
    rawId: row.id,
    kind: "template",
    moduleId,
    moduleLabel: moduleMeta.label,
    moduleIcon: moduleMeta.icon,
    activityType: "template",
    activityLabel: "Template",
    title,
    details: description,
    sessionCode: null,
    status: row.is_archived ? "archived" : "active",
    teamId: row.team_id ?? null,
    occurredAt: row.updated_at || row.created_at,
    createdAt: row.created_at,
    startedAt: null,
    endedAt: null,
  };
}

function mapSkillsMatrixToActivity(row) {
  const moduleMeta = MODULE_META["skills-matrix"];
  const title =
    typeof row.title === "string" && row.title.trim() ? row.title.trim() : "Matrice de Compétences";

  return {
    id: `skills-matrix:${row.id}`,
    rawId: row.id,
    kind: "skills",
    moduleId: "skills-matrix",
    moduleLabel: moduleMeta.label,
    moduleIcon: moduleMeta.icon,
    activityType: "session",
    activityLabel: row.is_admin ? "Animateur" : "Participant",
    title,
    details: row.session_code ? `Code ${row.session_code}` : null,
    sessionCode: row.session_code || null,
    status: row.status || "lobby",
    teamId: row.team_id ?? null,
    occurredAt: row.ended_at || row.started_at || row.updated_at || row.created_at,
    createdAt: row.created_at,
    startedAt: row.started_at || null,
    endedAt: row.ended_at || null,
  };
}

function toTimestamp(value) {
  if (!value) return 0;
  const time = Date.parse(value);
  return Number.isFinite(time) ? time : 0;
}

import { sessionLifecycle } from "../services/sessionLifecycle.js";
import { S2C_EVENTS } from "../../../shared/contracts/socketEvents.js";

export function registerDashboardRoutes(context) {
  const { app, pool, requireAuth, crypto, io } = context;

  // Phase α — session lifecycle endpoints (module-agnostic, code-keyed).

  // Phase γ.1 — public session preview for the unified pre-join lobby.
  // Returns module + status + title + code. No PII, no auth.
  app.get("/api/sessions/:code/preview", async (req, res, next) => {
    try {
      const session = await sessionLifecycle.resolveSessionByCode(pool, req.params.code);
      if (!session) return res.status(404).json({ error: "Not found" });

      // Best-effort title resolution per module.
      let title = null;
      let participantCount = null;
      try {
        if (session.module === "retro-party" || session.module === "planning-poker") {
          const r = await pool.query(
            `SELECT
               (config_snapshot->>'templateName') AS template_name,
               state_snapshot->'lobby' AS lobby
             FROM rooms WHERE id = $1 LIMIT 1`,
            [session.id],
          );
          const row = r.rows[0];
          if (row) {
            title = row.template_name || null;
            if (Array.isArray(row.lobby)) participantCount = row.lobby.length;
          }
        } else if (session.module === "radar-party") {
          const r = await pool.query(
            `SELECT s.title, (SELECT COUNT(*)::int FROM radar_participants WHERE session_id = s.id) AS n
             FROM radar_sessions s WHERE s.id = $1 LIMIT 1`,
            [session.id],
          );
          if (r.rows[0]) {
            title = r.rows[0].title || null;
            participantCount = r.rows[0].n;
          }
        } else if (session.module === "skills-matrix") {
          const r = await pool.query(
            `SELECT s.title, (SELECT COUNT(*)::int FROM skills_matrix_participants WHERE session_id = s.id) AS n
             FROM skills_matrix_sessions s WHERE s.id = $1 LIMIT 1`,
            [session.id],
          );
          if (r.rows[0]) {
            title = r.rows[0].title || null;
            participantCount = r.rows[0].n;
          }
        }
      } catch (err) {
        console.error("[preview] metadata lookup failed", err.message);
      }

      return res.status(200).json({
        code: session.code,
        module: session.module,
        status: session.status,
        title,
        participantCount,
      });
    } catch (err) {
      next(err);
    }
  });

  // Heartbeat: bump last_active_at. Public-ish (anyone with the code can
  // signal activity — abuse is irrelevant since the code is the bearer).
  app.post("/api/sessions/:code/heartbeat", async (req, res, next) => {
    try {
      const session = await sessionLifecycle.resolveSessionByCode(pool, req.params.code);
      if (!session) return res.status(404).json({ error: "Not found" });
      if (session.status === "ended") return res.status(204).end();
      await sessionLifecycle.bumpActivity(pool, session);
      return res.status(204).end();
    } catch (err) {
      next(err);
    }
  });

  // Terminer la session — owner only, sets status=ended, freezes the row.
  app.post("/api/sessions/:code/end", requireAuth, async (req, res, next) => {
    try {
      const session = await sessionLifecycle.resolveSessionByCode(pool, req.params.code);
      if (!session) return res.status(404).json({ error: "Not found" });
      if (session.ownerUserId && session.ownerUserId !== req.currentUser.id) {
        return res.status(403).json({ error: "Forbidden" });
      }
      if (session.status === "ended") return res.status(204).end();
      await sessionLifecycle.transitionTo(pool, session, "ended", req.currentUser.id);
      // Phase β.2 — notify all live participants in the socket room.
      try {
        io?.to(session.code).emit(S2C_EVENTS.SESSION_ENDED, {
          code: session.code,
          module: session.module,
        });
      } catch (err) {
        console.error("[lifecycle] failed to emit SESSION_ENDED", err);
      }
      return res.status(204).end();
    } catch (err) {
      next(err);
    }
  });

  // Restaurer une session abandonnée — owner only, abandoned → live.
  app.post("/api/sessions/:code/restore", requireAuth, async (req, res, next) => {
    try {
      const session = await sessionLifecycle.resolveSessionByCode(pool, req.params.code);
      if (!session) return res.status(404).json({ error: "Not found" });
      if (session.ownerUserId && session.ownerUserId !== req.currentUser.id) {
        return res.status(403).json({ error: "Forbidden" });
      }
      if (session.status !== "abandoned") {
        return res.status(409).json({ error: "Not abandoned" });
      }
      await sessionLifecycle.transitionTo(pool, session, "live", req.currentUser.id);
      return res.status(204).end();
    } catch (err) {
      next(err);
    }
  });

  // Record an authenticated participation in a retro/poker room. Anonymous
  // joins are not persisted; this endpoint is best-effort and idempotent.
  app.post("/api/rooms/:code/participants", requireAuth, async (req, res, next) => {
    try {
      const raw = String(req.params.code || "")
        .trim()
        .toUpperCase();
      if (!raw) return res.status(400).json({ error: "Missing code" });

      const roomResult = await pool.query("SELECT id FROM rooms WHERE room_code = $1 LIMIT 1", [
        raw,
      ]);
      const room = roomResult.rows[0];
      if (!room) return res.status(404).json({ error: "Not found" });

      await pool.query(
        `
          INSERT INTO room_participants (id, room_id, user_id)
          VALUES ($1, $2, $3)
          ON CONFLICT (room_id, user_id)
          DO UPDATE SET last_seen_at = now()
        `,
        [crypto.randomUUID(), room.id, req.currentUser.id],
      );

      return res.status(204).end();
    } catch (err) {
      next(err);
    }
  });

  // Resolve any room code to its module so the client can redirect without
  // knowing which module the code belongs to.
  app.get("/api/resolve-room", async (req, res, next) => {
    try {
      const raw = typeof req.query.code === "string" ? req.query.code.trim().toUpperCase() : "";
      if (!raw) return res.status(400).json({ error: "Missing code" });

      const [smResult, radarResult, roomResult] = await Promise.all([
        pool.query(
          `SELECT session_code FROM skills_matrix_sessions WHERE session_code = $1 LIMIT 1`,
          [raw],
        ),
        pool.query(`SELECT session_code FROM radar_sessions WHERE session_code = $1 LIMIT 1`, [
          raw,
        ]),
        pool.query(`SELECT room_code FROM rooms WHERE room_code = $1 LIMIT 1`, [raw]),
      ]);

      if (smResult.rows.length > 0) {
        return res.status(200).json({ module: "skills-matrix", code: raw });
      }
      if (radarResult.rows.length > 0) {
        return res.status(200).json({ module: "radar-party", code: raw });
      }
      if (roomResult.rows.length > 0) {
        return res.status(200).json({ module: "play", code: raw });
      }

      return res.status(404).json({ error: "Code introuvable" });
    } catch (err) {
      next(err);
    }
  });

  app.get("/api/dashboard/activities", requireAuth, async (req, res, next) => {
    try {
      const userId = req.currentUser.id;
      const teamFilter =
        typeof req.query.teamId === "string" && req.query.teamId.trim()
          ? req.query.teamId.trim()
          : null;
      const [roomsResult, radarResult, templatesResult, skillsMatrixResult] = await Promise.all([
        pool.query(
          `
            SELECT DISTINCT ON (r.id)
              r.id,
              r.room_code,
              r.mode,
              r.status,
              r.team_id,
              r.created_at,
              r.started_at,
              r.ended_at,
              r.config_snapshot,
              t.name AS source_template_name,
              t.base_config->>'module' AS source_template_module
            FROM rooms r
            LEFT JOIN game_templates t ON t.id = r.source_template_id
            LEFT JOIN room_participants rp ON rp.room_id = r.id AND rp.user_id = $1
            WHERE (r.created_by_user_id = $1 OR rp.user_id = $1)
              AND ($2::uuid IS NULL OR r.team_id = $2::uuid)
            ORDER BY r.id, r.created_at DESC
            LIMIT 200
          `,
          [userId, teamFilter],
        ),
        pool.query(
          `
            SELECT DISTINCT ON (s.id)
              s.id,
              s.session_code,
              s.title,
              s.status,
              s.team_id,
              s.created_at,
              s.started_at
            FROM radar_sessions s
            LEFT JOIN radar_participants p
              ON p.session_id = s.id AND p.user_id = $1
            WHERE (s.created_by_user_id = $1 OR p.user_id = $1)
              AND ($2::uuid IS NULL OR s.team_id = $2::uuid)
            ORDER BY s.id, s.created_at DESC
            LIMIT 200
          `,
          [userId, teamFilter],
        ),
        pool.query(
          `
            SELECT
              id,
              name,
              description,
              base_config,
              is_archived,
              team_id,
              created_at,
              updated_at
            FROM game_templates
            WHERE user_id = $1
              AND ($2::uuid IS NULL OR team_id = $2::uuid)
            ORDER BY updated_at DESC
            LIMIT 300
          `,
          [userId, teamFilter],
        ),
        pool.query(
          `
            SELECT
              s.id,
              s.session_code,
              s.title,
              s.status,
              s.team_id,
              s.started_at,
              s.ended_at,
              s.created_at,
              s.updated_at,
              p.is_admin
            FROM skills_matrix_sessions s
            INNER JOIN skills_matrix_participants p
              ON p.session_id = s.id AND p.user_id = $1
            WHERE ($2::uuid IS NULL OR s.team_id = $2::uuid)
            ORDER BY s.updated_at DESC
            LIMIT 200
          `,
          [userId, teamFilter],
        ),
      ]);

      const activities = [
        ...roomsResult.rows.map(mapRoomToActivity),
        ...radarResult.rows.map(mapRadarToActivity),
        ...templatesResult.rows.map(mapTemplateToActivity),
        ...skillsMatrixResult.rows.map(mapSkillsMatrixToActivity),
      ].sort((a, b) => toTimestamp(b.occurredAt) - toTimestamp(a.occurredAt));

      const modules = Object.values(MODULE_META).map((moduleMeta) => {
        const moduleActivities = activities.filter(
          (activity) => activity.moduleId === moduleMeta.id,
        );
        return {
          moduleId: moduleMeta.id,
          moduleLabel: moduleMeta.label,
          moduleIcon: moduleMeta.icon,
          totalActivities: moduleActivities.length,
          lastActivityAt: moduleActivities[0]?.occurredAt ?? null,
          activities: moduleActivities,
        };
      });

      return res.status(200).json({
        generatedAt: new Date().toISOString(),
        modules,
        roadmap: {
          upcoming: [
            "Gestion des équipes",
            "Gestion avancée des templates",
            "Insights d'équipe et suivi des évolutions",
          ],
        },
      });
    } catch (err) {
      next(err);
    }
  });
}
