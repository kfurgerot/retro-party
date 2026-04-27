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
    moduleId,
    moduleLabel: moduleMeta.label,
    moduleIcon: moduleMeta.icon,
    activityType: "session",
    activityLabel: row.mode === "template" ? "Session depuis template" : "Session rapide",
    title,
    details: row.room_code ? `Code ${row.room_code}` : null,
    status: row.status || "open",
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
    moduleId: "radar-party",
    moduleLabel: moduleMeta.label,
    moduleIcon: moduleMeta.icon,
    activityType: "session",
    activityLabel: "Session Radar",
    title,
    details: row.session_code ? `Code ${row.session_code}` : null,
    status: row.status || "lobby",
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
    moduleId,
    moduleLabel: moduleMeta.label,
    moduleIcon: moduleMeta.icon,
    activityType: "template",
    activityLabel: "Template",
    title,
    details: description,
    status: row.is_archived ? "archived" : "active",
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
    moduleId: "skills-matrix",
    moduleLabel: moduleMeta.label,
    moduleIcon: moduleMeta.icon,
    activityType: "session",
    activityLabel: row.is_admin ? "Animateur" : "Participant",
    title,
    details: row.session_code ? `Code ${row.session_code}` : null,
    sessionCode: row.session_code || null,
    status: row.status || "lobby",
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

export function registerDashboardRoutes(context) {
  const { app, pool, requireAuth } = context;

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
      const [roomsResult, radarResult, templatesResult, skillsMatrixResult] = await Promise.all([
        pool.query(
          `
            SELECT
              r.id,
              r.room_code,
              r.mode,
              r.status,
              r.created_at,
              r.started_at,
              r.ended_at,
              r.config_snapshot,
              t.name AS source_template_name,
              t.base_config->>'module' AS source_template_module
            FROM rooms r
            LEFT JOIN game_templates t ON t.id = r.source_template_id
            WHERE r.created_by_user_id = $1
            ORDER BY r.created_at DESC
            LIMIT 200
          `,
          [userId],
        ),
        pool.query(
          `
            SELECT DISTINCT ON (s.id)
              s.id,
              s.session_code,
              s.title,
              s.status,
              s.created_at,
              s.started_at
            FROM radar_sessions s
            LEFT JOIN radar_participants p
              ON p.session_id = s.id AND p.user_id = $1
            WHERE s.created_by_user_id = $1 OR p.user_id = $1
            ORDER BY s.id, s.created_at DESC
            LIMIT 200
          `,
          [userId],
        ),
        pool.query(
          `
            SELECT
              id,
              name,
              description,
              base_config,
              is_archived,
              created_at,
              updated_at
            FROM game_templates
            WHERE user_id = $1
            ORDER BY updated_at DESC
            LIMIT 300
          `,
          [userId],
        ),
        pool.query(
          `
            SELECT
              s.id,
              s.session_code,
              s.title,
              s.status,
              s.started_at,
              s.ended_at,
              s.created_at,
              s.updated_at,
              p.is_admin
            FROM skills_matrix_sessions s
            INNER JOIN skills_matrix_participants p
              ON p.session_id = s.id AND p.user_id = $1
            ORDER BY s.updated_at DESC
            LIMIT 200
          `,
          [userId],
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
