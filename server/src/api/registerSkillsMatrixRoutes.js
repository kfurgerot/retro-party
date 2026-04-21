import { computeSkillsMatrixInsights } from "../../skillsMatrixEngine.js";

const DEFAULT_SCALE_MIN = 1;
const DEFAULT_SCALE_MAX = 5;
const MIN_SCALE_BOUND = 0;
const MAX_SCALE_BOUND = 10;

function normalizeCode(rawValue) {
  if (typeof rawValue !== "string") return "";
  return rawValue.trim().toUpperCase();
}

function normalizeName(rawValue, maxLength = 120) {
  if (typeof rawValue !== "string") return "";
  return rawValue.trim().slice(0, maxLength);
}

function resolveParticipantId(req) {
  const fromBody =
    req.body && typeof req.body.participantId === "string" ? req.body.participantId : "";
  const fromQuery =
    req.query && typeof req.query.participantId === "string" ? req.query.participantId : "";
  const headerValue = req.headers?.["x-participant-id"];
  const fromHeader = Array.isArray(headerValue)
    ? String(headerValue[0] ?? "")
    : typeof headerValue === "string"
      ? headerValue
      : "";

  return (
    [fromBody, fromQuery, fromHeader]
      .map((value) => String(value || "").trim())
      .find((value) => value.length > 0) || ""
  );
}

function parseNullableLevel(rawValue, scaleMin, scaleMax) {
  if (rawValue === null || rawValue === undefined || rawValue === "") return null;
  const value = Number(rawValue);
  if (!Number.isFinite(value)) return NaN;
  const rounded = Math.round(value);
  if (rounded < scaleMin || rounded > scaleMax) return NaN;
  return rounded;
}

function parseInteger(
  rawValue,
  { min = Number.MIN_SAFE_INTEGER, max = Number.MAX_SAFE_INTEGER } = {},
) {
  if (rawValue === null || rawValue === undefined || rawValue === "") return null;
  const value = Number(rawValue);
  if (!Number.isFinite(value)) return NaN;
  const rounded = Math.round(value);
  if (rounded < min || rounded > max) return NaN;
  return rounded;
}

function isPlainObject(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizeTemplateConfig(rawConfig) {
  if (!isPlainObject(rawConfig)) return null;
  const moduleId =
    typeof rawConfig.module === "string" ? rawConfig.module.trim().toLowerCase() : "";
  if (moduleId !== "skills-matrix") return null;

  const scaleMin = parseInteger(rawConfig.scaleMin ?? DEFAULT_SCALE_MIN, {
    min: MIN_SCALE_BOUND,
    max: MAX_SCALE_BOUND,
  });
  const scaleMax = parseInteger(rawConfig.scaleMax ?? DEFAULT_SCALE_MAX, {
    min: MIN_SCALE_BOUND,
    max: MAX_SCALE_BOUND,
  });
  if (!Number.isFinite(scaleMin) || !Number.isFinite(scaleMax) || scaleMin >= scaleMax) {
    return null;
  }

  const rawCategories = Array.isArray(rawConfig.categories) ? rawConfig.categories : [];
  const categories = [];
  rawCategories.forEach((entry, index) => {
    if (!isPlainObject(entry)) return;
    const name = normalizeName(entry.name, 80);
    if (name.length < 2) return;
    const templateKey =
      typeof entry.id === "string" && entry.id.trim().length > 0
        ? entry.id.trim().slice(0, 80)
        : `cat-${index}`;
    const sortOrder = parseInteger(entry.sortOrder, { min: 0, max: 10000 });
    categories.push({
      templateKey,
      name,
      sortOrder: Number.isFinite(sortOrder) ? Number(sortOrder) : categories.length,
    });
  });
  categories.sort(
    (left, right) => left.sortOrder - right.sortOrder || left.name.localeCompare(right.name),
  );
  categories.forEach((category, index) => {
    category.sortOrder = index;
  });

  const categoryKeySet = new Set(categories.map((category) => category.templateKey));
  const rawSkills = Array.isArray(rawConfig.skills) ? rawConfig.skills : [];
  const skills = [];
  rawSkills.forEach((entry, index) => {
    if (!isPlainObject(entry)) return;
    const name = normalizeName(entry.name, 120);
    if (name.length < 2) return;

    const categoryTemplateKey =
      typeof entry.categoryId === "string" && categoryKeySet.has(entry.categoryId.trim())
        ? entry.categoryId.trim()
        : null;
    const requiredLevel = parseInteger(entry.requiredLevel, {
      min: Number(scaleMin),
      max: Number(scaleMax),
    });
    const requiredPeople = parseInteger(entry.requiredPeople, { min: 0, max: 500 });
    const sortOrder = parseInteger(entry.sortOrder, { min: 0, max: 10000 });

    skills.push({
      name,
      categoryTemplateKey,
      requiredLevel: Number.isFinite(requiredLevel) ? Number(requiredLevel) : Number(scaleMin),
      requiredPeople: Number.isFinite(requiredPeople) ? Number(requiredPeople) : 1,
      sortOrder: Number.isFinite(sortOrder) ? Number(sortOrder) : skills.length,
    });
  });
  skills.sort(
    (left, right) => left.sortOrder - right.sortOrder || left.name.localeCompare(right.name),
  );
  skills.forEach((skill, index) => {
    skill.sortOrder = index;
  });

  return {
    scaleMin: Number(scaleMin),
    scaleMax: Number(scaleMax),
    categories,
    skills,
  };
}

function serializeSession(row) {
  return {
    id: row.id,
    code: row.session_code,
    title: row.title,
    scaleMin: Number(row.scale_min),
    scaleMax: Number(row.scale_max),
    status: row.status === "started" ? "started" : "lobby",
    startedAt: row.started_at ?? null,
    createdByUserId: row.created_by_user_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function serializeParticipant(row) {
  return {
    id: row.id,
    userId: row.user_id,
    displayName: row.display_name,
    avatar: Number.isFinite(Number(row.avatar)) ? Number(row.avatar) : 0,
    isAdmin: row.is_admin === true,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function serializeCategory(row) {
  return {
    id: row.id,
    sessionId: row.session_id,
    name: row.name,
    sortOrder: Number(row.sort_order),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function serializeSkill(row) {
  return {
    id: row.id,
    sessionId: row.session_id,
    categoryId: row.category_id,
    name: row.name,
    sortOrder: Number(row.sort_order),
    requiredLevel: Number(row.required_level),
    requiredPeople: Number(row.required_people),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function serializeAssessment(row) {
  const currentLevel = Number(row.current_level);
  const targetLevel = Number(row.target_level);
  return {
    id: row.id,
    sessionId: row.session_id,
    skillId: row.skill_id,
    participantId: row.participant_id,
    currentLevel: Number.isFinite(currentLevel) ? currentLevel : null,
    targetLevel: Number.isFinite(targetLevel) ? targetLevel : null,
    wantsToProgress: row.wants_to_progress === true,
    wantsToMentor: row.wants_to_mentor === true,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function generateUniqueSkillsMatrixCode({ pool, makeCode }) {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    const code = makeCode();
    const existing = await pool.query(
      "SELECT 1 FROM skills_matrix_sessions WHERE session_code = $1 LIMIT 1",
      [code],
    );
    if (existing.rowCount === 0) return code;
  }
  throw new Error("Unable to generate room code");
}

async function getSessionByCode(pool, code) {
  const result = await pool.query(
    `
      SELECT
        id,
        session_code,
        title,
        scale_min,
        scale_max,
        status,
        started_at,
        created_by_user_id,
        created_at,
        updated_at
      FROM skills_matrix_sessions
      WHERE session_code = $1
      LIMIT 1
    `,
    [code],
  );
  return result.rows[0] ?? null;
}

async function getParticipantById(pool, sessionId, participantId) {
  const result = await pool.query(
    `
      SELECT
        id,
        session_id,
        user_id,
        display_name,
        avatar,
        is_admin,
        created_at,
        updated_at
      FROM skills_matrix_participants
      WHERE session_id = $1 AND id = $2
      LIMIT 1
    `,
    [sessionId, participantId],
  );
  return result.rows[0] ?? null;
}

async function getSessionContext(pool, code, participantId) {
  const session = await getSessionByCode(pool, code);
  if (!session) return { session: null, me: null };
  const me = participantId ? await getParticipantById(pool, session.id, participantId) : null;
  return { session, me };
}

async function buildSessionSnapshot({ pool, session, currentParticipantId }) {
  const [participantsResult, categoriesResult, skillsResult, assessmentsResult] = await Promise.all(
    [
      pool.query(
        `
        SELECT
          id,
          session_id,
          user_id,
          display_name,
          avatar,
          is_admin,
          created_at,
          updated_at
        FROM skills_matrix_participants
        WHERE session_id = $1
        ORDER BY created_at ASC
      `,
        [session.id],
      ),
      pool.query(
        `
        SELECT
          id,
          session_id,
          name,
          sort_order,
          created_at,
          updated_at
        FROM skills_matrix_categories
        WHERE session_id = $1
        ORDER BY sort_order ASC, created_at ASC
      `,
        [session.id],
      ),
      pool.query(
        `
        SELECT
          id,
          session_id,
          category_id,
          name,
          sort_order,
          required_level,
          required_people,
          created_at,
          updated_at
        FROM skills_matrix_skills
        WHERE session_id = $1
        ORDER BY sort_order ASC, created_at ASC
      `,
        [session.id],
      ),
      pool.query(
        `
        SELECT
          id,
          session_id,
          skill_id,
          participant_id,
          current_level,
          target_level,
          wants_to_progress,
          wants_to_mentor,
          created_at,
          updated_at
        FROM skills_matrix_assessments
        WHERE session_id = $1
        ORDER BY updated_at DESC
      `,
        [session.id],
      ),
    ],
  );

  const participants = participantsResult.rows.map(serializeParticipant);
  const categories = categoriesResult.rows.map(serializeCategory);
  const skills = skillsResult.rows.map(serializeSkill);
  const assessments = assessmentsResult.rows.map(serializeAssessment);
  const me = participants.find((participant) => participant.id === currentParticipantId) ?? null;

  const categoryById = new Map(categories.map((category) => [category.id, category]));
  const skillById = new Map(skills.map((skill) => [skill.id, skill]));
  const participantById = new Map(participants.map((participant) => [participant.id, participant]));

  const insights = computeSkillsMatrixInsights({
    skills,
    participants,
    assessments,
  });

  const matrix = insights.matrixRows
    .map((row) => {
      const skill = skillById.get(row.skillId);
      if (!skill) return null;
      const category = skill.categoryId ? (categoryById.get(skill.categoryId) ?? null) : null;
      return {
        skillId: skill.id,
        skillName: skill.name,
        categoryId: skill.categoryId,
        categoryName: category?.name ?? "Sans categorie",
        requiredLevel: row.requiredLevel,
        requiredPeople: row.requiredPeople,
        coverageCount: row.coverageCount,
        missingCount: row.missingCount,
        cells: row.cells,
      };
    })
    .filter(Boolean);

  const mapDashboardSkill = (item) => {
    const skill = skillById.get(item.skillId);
    const category = skill?.categoryId ? (categoryById.get(skill.categoryId) ?? null) : null;
    return {
      skillId: item.skillId,
      skillName: skill?.name ?? "Competence",
      categoryName: category?.name ?? "Sans categorie",
      requiredLevel: item.requiredLevel,
      requiredPeople: item.requiredPeople,
      coverageCount: item.coverageCount,
      missingCount: item.missingCount,
    };
  };

  const mentoringBySkill = insights.dashboard.mentoringBySkill.map((entry) => {
    const skill = skillById.get(entry.skillId);
    const category = skill?.categoryId ? (categoryById.get(skill.categoryId) ?? null) : null;
    const helpers = entry.helpers
      .map((helper) => {
        const participant = participantById.get(helper.participantId);
        if (!participant) return null;
        return {
          participantId: participant.id,
          displayName: participant.displayName,
          currentLevel: helper.currentLevel,
          wantsToMentor: helper.wantsToMentor === true,
        };
      })
      .filter(Boolean);
    const learners = entry.learners
      .map((learner) => {
        const participant = participantById.get(learner.participantId);
        if (!participant) return null;
        return {
          participantId: participant.id,
          displayName: participant.displayName,
          currentLevel: learner.currentLevel,
          targetLevel: learner.targetLevel,
          wantsToProgress: learner.wantsToProgress,
        };
      })
      .filter(Boolean);

    return {
      skillId: entry.skillId,
      skillName: skill?.name ?? "Competence",
      categoryName: category?.name ?? "Sans categorie",
      helpers,
      learners,
    };
  });

  return {
    session: serializeSession(session),
    me: me
      ? {
          participantId: me.id,
          isAdmin: me.isAdmin,
        }
      : null,
    participants,
    categories,
    skills,
    assessments,
    matrix,
    dashboard: {
      summary: insights.dashboard.summary,
      riskySkills: insights.dashboard.riskySkills.map(mapDashboardSkill),
      coveredSkills: insights.dashboard.coveredSkills.map(mapDashboardSkill),
      mentoringBySkill,
    },
  };
}

export function registerSkillsMatrixRoutes(context) {
  const {
    app,
    pool,
    crypto,
    makeCode,
    requireAuth,
    emitSkillsMatrixSessionUpdate = () => {},
  } = context;

  app.post("/api/skills-matrix/sessions", async (req, res, next) => {
    const client = await pool.connect();
    try {
      const title = normalizeName(req.body?.title, 120);
      const displayName = normalizeName(req.body?.displayName, 80);
      const avatarRaw = parseInteger(req.body?.avatar ?? 0, { min: 0, max: 30 });
      const scaleMin = parseInteger(req.body?.scaleMin ?? DEFAULT_SCALE_MIN, {
        min: MIN_SCALE_BOUND,
        max: MAX_SCALE_BOUND,
      });
      const scaleMax = parseInteger(req.body?.scaleMax ?? DEFAULT_SCALE_MAX, {
        min: MIN_SCALE_BOUND,
        max: MAX_SCALE_BOUND,
      });

      if (
        !Number.isFinite(scaleMin) ||
        !Number.isFinite(scaleMax) ||
        scaleMin >= scaleMax ||
        !Number.isFinite(avatarRaw)
      ) {
        return res.status(400).json({ error: "Invalid payload" });
      }
      const avatar = Number(avatarRaw);
      const currentUserId = req.currentUser?.id ?? null;
      const currentDisplayName = normalizeName(req.currentUser?.displayName ?? "Equipe", 80);
      const participantDisplayName =
        displayName.length >= 2 ? displayName : currentDisplayName || "Equipe";

      const code = await generateUniqueSkillsMatrixCode({ pool, makeCode });
      const sessionId = crypto.randomUUID();
      const participantId = crypto.randomUUID();

      await client.query("BEGIN");
      await client.query(
        `
          INSERT INTO skills_matrix_sessions (
            id,
            session_code,
            title,
            scale_min,
            scale_max,
            status,
            created_by_user_id
          )
          VALUES ($1, $2, $3, $4, $5, 'lobby', $6)
        `,
        [sessionId, code, title || "Matrice de competences", scaleMin, scaleMax, currentUserId],
      );
      await client.query(
        `
          INSERT INTO skills_matrix_participants (
            id,
            session_id,
            user_id,
            display_name,
            avatar,
            is_admin
          )
          VALUES ($1, $2, $3, $4, $5, true)
        `,
        [participantId, sessionId, currentUserId, participantDisplayName, avatar],
      );
      await client.query("COMMIT");

      const session = await getSessionByCode(pool, code);
      const payload = await buildSessionSnapshot({
        pool,
        session,
        currentParticipantId: participantId,
      });

      emitSkillsMatrixSessionUpdate(code, "session_created");
      return res.status(201).json(payload);
    } catch (err) {
      await client.query("ROLLBACK");
      next(err);
    } finally {
      client.release();
    }
  });

  app.post("/api/skills-matrix/sessions/:code/join", async (req, res, next) => {
    try {
      const code = normalizeCode(req.params.code);
      const displayName = normalizeName(req.body?.displayName, 80);
      const avatarRaw = parseInteger(req.body?.avatar ?? 0, { min: 0, max: 30 });
      if (!code) return res.status(400).json({ error: "Invalid payload" });
      if (!Number.isFinite(avatarRaw)) return res.status(400).json({ error: "Invalid payload" });
      const avatar = Number(avatarRaw);
      const currentUserId = req.currentUser?.id ?? null;
      const currentDisplayName = normalizeName(req.currentUser?.displayName ?? "Equipe", 80);
      const participantDisplayName =
        displayName.length >= 2 ? displayName : currentDisplayName || "Equipe";

      const session = await getSessionByCode(pool, code);
      if (!session) return res.status(404).json({ error: "Not found" });
      const participantId = crypto.randomUUID();

      await pool.query(
        `
          INSERT INTO skills_matrix_participants (
            id,
            session_id,
            user_id,
            display_name,
            avatar,
            is_admin
          )
          VALUES ($1, $2, $3, $4, $5, false)
        `,
        [participantId, session.id, currentUserId, participantDisplayName, avatar],
      );

      const payload = await buildSessionSnapshot({
        pool,
        session,
        currentParticipantId: participantId,
      });
      emitSkillsMatrixSessionUpdate(code, "participant_joined");
      return res.status(200).json(payload);
    } catch (err) {
      next(err);
    }
  });

  app.get("/api/skills-matrix/sessions/:code", async (req, res, next) => {
    try {
      const code = normalizeCode(req.params.code);
      const participantId = resolveParticipantId(req);
      if (!code) return res.status(400).json({ error: "Invalid payload" });
      if (!participantId) return res.status(400).json({ error: "Invalid payload" });

      const { session, me } = await getSessionContext(pool, code, participantId);
      if (!session) return res.status(404).json({ error: "Not found" });
      if (!me) return res.status(403).json({ error: "Unauthorized" });

      const payload = await buildSessionSnapshot({
        pool,
        session,
        currentParticipantId: participantId,
      });
      return res.status(200).json(payload);
    } catch (err) {
      next(err);
    }
  });

  app.post("/api/skills-matrix/sessions/:code/start", async (req, res, next) => {
    try {
      const code = normalizeCode(req.params.code);
      const participantId = resolveParticipantId(req);
      if (!code) return res.status(400).json({ error: "Invalid payload" });
      if (!participantId) return res.status(400).json({ error: "Invalid payload" });

      const { session, me } = await getSessionContext(pool, code, participantId);
      if (!session) return res.status(404).json({ error: "Not found" });
      if (!me || !me.is_admin) return res.status(403).json({ error: "Unauthorized" });

      await pool.query(
        `
          UPDATE skills_matrix_sessions
          SET
            status = 'started',
            started_at = COALESCE(started_at, now()),
            updated_at = now()
          WHERE id = $1
        `,
        [session.id],
      );

      const nextSession = await getSessionByCode(pool, code);
      const payload = await buildSessionSnapshot({
        pool,
        session: nextSession,
        currentParticipantId: participantId,
      });
      emitSkillsMatrixSessionUpdate(code, "session_started");
      return res.status(200).json(payload);
    } catch (err) {
      next(err);
    }
  });

  app.post(
    "/api/skills-matrix/sessions/:code/apply-template",
    requireAuth,
    async (req, res, next) => {
      const client = await pool.connect();
      try {
        const code = normalizeCode(req.params.code);
        const participantId = resolveParticipantId(req);
        const templateId =
          typeof req.body?.templateId === "string" ? req.body.templateId.trim() : "";
        if (!code || !templateId || !participantId)
          return res.status(400).json({ error: "Invalid payload" });

        const { session, me } = await getSessionContext(pool, code, participantId);
        if (!session) return res.status(404).json({ error: "Not found" });
        if (!me || !me.is_admin) return res.status(403).json({ error: "Unauthorized" });

        const templateResult = await pool.query(
          `
          SELECT id, name, base_config
          FROM game_templates
          WHERE id = $1 AND user_id = $2
          LIMIT 1
        `,
          [templateId, req.currentUser.id],
        );
        const template = templateResult.rows[0] ?? null;
        if (!template) return res.status(404).json({ error: "Not found" });

        const normalizedConfig = normalizeTemplateConfig(template.base_config);
        if (!normalizedConfig) return res.status(400).json({ error: "Invalid payload" });

        const sessionTitle = normalizeName(template.name, 120) || "Matrice de competences";
        const categoryIdByTemplateKey = new Map();

        await client.query("BEGIN");
        await client.query(
          `
          UPDATE skills_matrix_sessions
          SET
            title = $2,
            scale_min = $3,
            scale_max = $4,
            updated_at = now()
          WHERE id = $1
        `,
          [session.id, sessionTitle, normalizedConfig.scaleMin, normalizedConfig.scaleMax],
        );
        await client.query("DELETE FROM skills_matrix_skills WHERE session_id = $1", [session.id]);
        await client.query("DELETE FROM skills_matrix_categories WHERE session_id = $1", [
          session.id,
        ]);

        for (const category of normalizedConfig.categories) {
          const categoryId = crypto.randomUUID();
          categoryIdByTemplateKey.set(category.templateKey, categoryId);
          await client.query(
            `
            INSERT INTO skills_matrix_categories (id, session_id, name, sort_order)
            VALUES ($1, $2, $3, $4)
          `,
            [categoryId, session.id, category.name, category.sortOrder],
          );
        }

        for (const skill of normalizedConfig.skills) {
          const resolvedCategoryId = skill.categoryTemplateKey
            ? (categoryIdByTemplateKey.get(skill.categoryTemplateKey) ?? null)
            : null;
          await client.query(
            `
            INSERT INTO skills_matrix_skills (
              id,
              session_id,
              category_id,
              name,
              sort_order,
              required_level,
              required_people
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7)
          `,
            [
              crypto.randomUUID(),
              session.id,
              resolvedCategoryId,
              skill.name,
              skill.sortOrder,
              skill.requiredLevel,
              skill.requiredPeople,
            ],
          );
        }

        await client.query("COMMIT");

        const nextSession = await getSessionByCode(pool, code);
        const payload = await buildSessionSnapshot({
          pool,
          session: nextSession,
          currentParticipantId: participantId,
        });
        emitSkillsMatrixSessionUpdate(code, "template_applied");
        return res.status(200).json(payload);
      } catch (err) {
        await client.query("ROLLBACK");
        next(err);
      } finally {
        client.release();
      }
    },
  );

  app.patch("/api/skills-matrix/sessions/:code", async (req, res, next) => {
    const client = await pool.connect();
    try {
      const code = normalizeCode(req.params.code);
      const participantId = resolveParticipantId(req);
      if (!code || !participantId) return res.status(400).json({ error: "Invalid payload" });

      const { session, me } = await getSessionContext(pool, code, participantId);
      if (!session) return res.status(404).json({ error: "Not found" });
      if (!me || !me.is_admin) return res.status(403).json({ error: "Unauthorized" });

      const nextTitle =
        req.body && Object.prototype.hasOwnProperty.call(req.body, "title")
          ? normalizeName(req.body.title, 120)
          : session.title;
      const proposedScaleMin = parseInteger(
        req.body && Object.prototype.hasOwnProperty.call(req.body, "scaleMin")
          ? req.body.scaleMin
          : session.scale_min,
        { min: MIN_SCALE_BOUND, max: MAX_SCALE_BOUND },
      );
      const proposedScaleMax = parseInteger(
        req.body && Object.prototype.hasOwnProperty.call(req.body, "scaleMax")
          ? req.body.scaleMax
          : session.scale_max,
        { min: MIN_SCALE_BOUND, max: MAX_SCALE_BOUND },
      );

      if (
        !Number.isFinite(proposedScaleMin) ||
        !Number.isFinite(proposedScaleMax) ||
        proposedScaleMin >= proposedScaleMax
      ) {
        return res.status(400).json({ error: "Invalid payload" });
      }

      await client.query("BEGIN");
      await client.query(
        `
          UPDATE skills_matrix_sessions
          SET
            title = $2,
            scale_min = $3,
            scale_max = $4,
            updated_at = now()
          WHERE id = $1
        `,
        [session.id, nextTitle || "Matrice de competences", proposedScaleMin, proposedScaleMax],
      );
      await client.query(
        `
          UPDATE skills_matrix_skills
          SET required_level = LEAST($3, GREATEST($2, required_level))
          WHERE session_id = $1
        `,
        [session.id, proposedScaleMin, proposedScaleMax],
      );
      await client.query(
        `
          UPDATE skills_matrix_assessments
          SET
            current_level = CASE
              WHEN current_level IS NULL THEN NULL
              ELSE LEAST($3, GREATEST($2, current_level))
            END,
            target_level = CASE
              WHEN target_level IS NULL THEN NULL
              ELSE LEAST($3, GREATEST($2, target_level))
            END,
            updated_at = now()
          WHERE session_id = $1
        `,
        [session.id, proposedScaleMin, proposedScaleMax],
      );
      await client.query("COMMIT");

      const nextSession = await getSessionByCode(pool, code);
      const payload = await buildSessionSnapshot({
        pool,
        session: nextSession,
        currentParticipantId: participantId,
      });
      emitSkillsMatrixSessionUpdate(code, "session_updated");
      return res.status(200).json(payload);
    } catch (err) {
      await client.query("ROLLBACK");
      next(err);
    } finally {
      client.release();
    }
  });

  app.post("/api/skills-matrix/sessions/:code/categories", async (req, res, next) => {
    try {
      const code = normalizeCode(req.params.code);
      const participantId = resolveParticipantId(req);
      const name = normalizeName(req.body?.name, 80);
      if (!code || !participantId || name.length < 2)
        return res.status(400).json({ error: "Invalid payload" });

      const { session, me } = await getSessionContext(pool, code, participantId);
      if (!session) return res.status(404).json({ error: "Not found" });
      if (!me || !me.is_admin) return res.status(403).json({ error: "Unauthorized" });

      const orderResult = await pool.query(
        `
          SELECT COALESCE(MAX(sort_order), -1) + 1 AS next_order
          FROM skills_matrix_categories
          WHERE session_id = $1
        `,
        [session.id],
      );
      const nextOrder = Number(orderResult.rows[0]?.next_order ?? 0);

      await pool.query(
        `
          INSERT INTO skills_matrix_categories (id, session_id, name, sort_order)
          VALUES ($1, $2, $3, $4)
        `,
        [crypto.randomUUID(), session.id, name, nextOrder],
      );

      const payload = await buildSessionSnapshot({
        pool,
        session,
        currentParticipantId: participantId,
      });
      emitSkillsMatrixSessionUpdate(code, "category_created");
      return res.status(201).json(payload);
    } catch (err) {
      next(err);
    }
  });

  app.patch("/api/skills-matrix/sessions/:code/categories/:categoryId", async (req, res, next) => {
    try {
      const code = normalizeCode(req.params.code);
      const participantId = resolveParticipantId(req);
      const categoryId = req.params.categoryId;
      if (!code || !categoryId || !participantId)
        return res.status(400).json({ error: "Invalid payload" });

      const { session, me } = await getSessionContext(pool, code, participantId);
      if (!session) return res.status(404).json({ error: "Not found" });
      if (!me || !me.is_admin) return res.status(403).json({ error: "Unauthorized" });

      const categoryResult = await pool.query(
        `
            SELECT id
            FROM skills_matrix_categories
            WHERE id = $1 AND session_id = $2
            LIMIT 1
          `,
        [categoryId, session.id],
      );
      if (!categoryResult.rows[0]) return res.status(404).json({ error: "Not found" });

      const nextName =
        req.body && Object.prototype.hasOwnProperty.call(req.body, "name")
          ? normalizeName(req.body.name, 80)
          : null;
      const nextSortOrder = parseInteger(
        req.body && Object.prototype.hasOwnProperty.call(req.body, "sortOrder")
          ? req.body.sortOrder
          : null,
        { min: 0, max: 10000 },
      );

      if (nextName !== null && nextName.length < 2) {
        return res.status(400).json({ error: "Invalid payload" });
      }
      if (Number.isNaN(nextSortOrder)) return res.status(400).json({ error: "Invalid payload" });

      await pool.query(
        `
            UPDATE skills_matrix_categories
            SET
              name = COALESCE($3, name),
              sort_order = COALESCE($4, sort_order),
              updated_at = now()
            WHERE id = $1 AND session_id = $2
          `,
        [categoryId, session.id, nextName, nextSortOrder],
      );

      const payload = await buildSessionSnapshot({
        pool,
        session,
        currentParticipantId: participantId,
      });
      emitSkillsMatrixSessionUpdate(code, "category_updated");
      return res.status(200).json(payload);
    } catch (err) {
      next(err);
    }
  });

  app.delete("/api/skills-matrix/sessions/:code/categories/:categoryId", async (req, res, next) => {
    try {
      const code = normalizeCode(req.params.code);
      const participantId = resolveParticipantId(req);
      const categoryId = req.params.categoryId;
      if (!code || !categoryId || !participantId)
        return res.status(400).json({ error: "Invalid payload" });

      const { session, me } = await getSessionContext(pool, code, participantId);
      if (!session) return res.status(404).json({ error: "Not found" });
      if (!me || !me.is_admin) return res.status(403).json({ error: "Unauthorized" });

      await pool.query(
        `
            DELETE FROM skills_matrix_categories
            WHERE id = $1 AND session_id = $2
          `,
        [categoryId, session.id],
      );

      const payload = await buildSessionSnapshot({
        pool,
        session,
        currentParticipantId: participantId,
      });
      emitSkillsMatrixSessionUpdate(code, "category_deleted");
      return res.status(200).json(payload);
    } catch (err) {
      next(err);
    }
  });

  app.post("/api/skills-matrix/sessions/:code/skills", async (req, res, next) => {
    try {
      const code = normalizeCode(req.params.code);
      const participantId = resolveParticipantId(req);
      const name = normalizeName(req.body?.name, 120);
      if (!code || !participantId || name.length < 2)
        return res.status(400).json({ error: "Invalid payload" });

      const { session, me } = await getSessionContext(pool, code, participantId);
      if (!session) return res.status(404).json({ error: "Not found" });
      if (!me || !me.is_admin) return res.status(403).json({ error: "Unauthorized" });

      const categoryIdRaw =
        req.body && Object.prototype.hasOwnProperty.call(req.body, "categoryId")
          ? req.body.categoryId
          : null;
      const categoryId =
        typeof categoryIdRaw === "string" && categoryIdRaw.trim().length > 0
          ? categoryIdRaw.trim()
          : null;
      if (categoryId) {
        const categoryResult = await pool.query(
          `
            SELECT id
            FROM skills_matrix_categories
            WHERE id = $1 AND session_id = $2
            LIMIT 1
          `,
          [categoryId, session.id],
        );
        if (!categoryResult.rows[0]) return res.status(400).json({ error: "Invalid payload" });
      }

      const requiredLevel = parseInteger(req.body?.requiredLevel ?? session.scale_min, {
        min: Number(session.scale_min),
        max: Number(session.scale_max),
      });
      const requiredPeople = parseInteger(req.body?.requiredPeople ?? 1, {
        min: 0,
        max: 500,
      });
      if (!Number.isFinite(requiredLevel) || !Number.isFinite(requiredPeople)) {
        return res.status(400).json({ error: "Invalid payload" });
      }

      const orderResult = await pool.query(
        `
          SELECT COALESCE(MAX(sort_order), -1) + 1 AS next_order
          FROM skills_matrix_skills
          WHERE session_id = $1
        `,
        [session.id],
      );
      const nextOrder = Number(orderResult.rows[0]?.next_order ?? 0);

      await pool.query(
        `
          INSERT INTO skills_matrix_skills (
            id,
            session_id,
            category_id,
            name,
            sort_order,
            required_level,
            required_people
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7)
        `,
        [
          crypto.randomUUID(),
          session.id,
          categoryId,
          name,
          nextOrder,
          requiredLevel,
          requiredPeople,
        ],
      );

      const payload = await buildSessionSnapshot({
        pool,
        session,
        currentParticipantId: participantId,
      });
      emitSkillsMatrixSessionUpdate(code, "skill_created");
      return res.status(201).json(payload);
    } catch (err) {
      next(err);
    }
  });

  app.patch("/api/skills-matrix/sessions/:code/skills/:skillId", async (req, res, next) => {
    try {
      const code = normalizeCode(req.params.code);
      const participantId = resolveParticipantId(req);
      const skillId = req.params.skillId;
      if (!code || !skillId || !participantId)
        return res.status(400).json({ error: "Invalid payload" });

      const { session, me } = await getSessionContext(pool, code, participantId);
      if (!session) return res.status(404).json({ error: "Not found" });
      if (!me || !me.is_admin) return res.status(403).json({ error: "Unauthorized" });

      const skillResult = await pool.query(
        `
          SELECT id
          FROM skills_matrix_skills
          WHERE id = $1 AND session_id = $2
          LIMIT 1
        `,
        [skillId, session.id],
      );
      if (!skillResult.rows[0]) return res.status(404).json({ error: "Not found" });

      const nextName =
        req.body && Object.prototype.hasOwnProperty.call(req.body, "name")
          ? normalizeName(req.body.name, 120)
          : null;
      if (nextName !== null && nextName.length < 2) {
        return res.status(400).json({ error: "Invalid payload" });
      }

      let nextCategoryId = null;
      let shouldUpdateCategory = false;
      if (req.body && Object.prototype.hasOwnProperty.call(req.body, "categoryId")) {
        shouldUpdateCategory = true;
        const rawCategoryId = req.body.categoryId;
        nextCategoryId =
          typeof rawCategoryId === "string" && rawCategoryId.trim().length > 0
            ? rawCategoryId.trim()
            : null;
        if (nextCategoryId) {
          const categoryResult = await pool.query(
            `
              SELECT id
              FROM skills_matrix_categories
              WHERE id = $1 AND session_id = $2
              LIMIT 1
            `,
            [nextCategoryId, session.id],
          );
          if (!categoryResult.rows[0]) return res.status(400).json({ error: "Invalid payload" });
        }
      }

      const nextRequiredLevel = parseInteger(
        req.body && Object.prototype.hasOwnProperty.call(req.body, "requiredLevel")
          ? req.body.requiredLevel
          : null,
        { min: Number(session.scale_min), max: Number(session.scale_max) },
      );
      if (Number.isNaN(nextRequiredLevel))
        return res.status(400).json({ error: "Invalid payload" });

      const nextRequiredPeople = parseInteger(
        req.body && Object.prototype.hasOwnProperty.call(req.body, "requiredPeople")
          ? req.body.requiredPeople
          : null,
        { min: 0, max: 500 },
      );
      if (Number.isNaN(nextRequiredPeople))
        return res.status(400).json({ error: "Invalid payload" });

      const nextSortOrder = parseInteger(
        req.body && Object.prototype.hasOwnProperty.call(req.body, "sortOrder")
          ? req.body.sortOrder
          : null,
        { min: 0, max: 10000 },
      );
      if (Number.isNaN(nextSortOrder)) return res.status(400).json({ error: "Invalid payload" });

      await pool.query(
        `
          UPDATE skills_matrix_skills
          SET
            name = COALESCE($3, name),
            category_id = CASE WHEN $4 THEN $5 ELSE category_id END,
            required_level = COALESCE($6, required_level),
            required_people = COALESCE($7, required_people),
            sort_order = COALESCE($8, sort_order),
            updated_at = now()
          WHERE id = $1 AND session_id = $2
        `,
        [
          skillId,
          session.id,
          nextName,
          shouldUpdateCategory,
          nextCategoryId,
          nextRequiredLevel,
          nextRequiredPeople,
          nextSortOrder,
        ],
      );

      const payload = await buildSessionSnapshot({
        pool,
        session,
        currentParticipantId: participantId,
      });
      emitSkillsMatrixSessionUpdate(code, "skill_updated");
      return res.status(200).json(payload);
    } catch (err) {
      next(err);
    }
  });

  app.delete("/api/skills-matrix/sessions/:code/skills/:skillId", async (req, res, next) => {
    try {
      const code = normalizeCode(req.params.code);
      const participantId = resolveParticipantId(req);
      const skillId = req.params.skillId;
      if (!code || !skillId || !participantId)
        return res.status(400).json({ error: "Invalid payload" });

      const { session, me } = await getSessionContext(pool, code, participantId);
      if (!session) return res.status(404).json({ error: "Not found" });
      if (!me || !me.is_admin) return res.status(403).json({ error: "Unauthorized" });

      await pool.query(
        `
            DELETE FROM skills_matrix_skills
            WHERE id = $1 AND session_id = $2
          `,
        [skillId, session.id],
      );

      const payload = await buildSessionSnapshot({
        pool,
        session,
        currentParticipantId: participantId,
      });
      emitSkillsMatrixSessionUpdate(code, "skill_deleted");
      return res.status(200).json(payload);
    } catch (err) {
      next(err);
    }
  });

  app.put("/api/skills-matrix/sessions/:code/assessments/:skillId", async (req, res, next) => {
    try {
      const code = normalizeCode(req.params.code);
      const participantId = resolveParticipantId(req);
      const skillId = req.params.skillId;
      if (!code || !skillId || !participantId)
        return res.status(400).json({ error: "Invalid payload" });

      const { session, me } = await getSessionContext(pool, code, participantId);
      if (!session) return res.status(404).json({ error: "Not found" });
      if (!me) return res.status(403).json({ error: "Unauthorized" });

      const skillResult = await pool.query(
        `
            SELECT id
            FROM skills_matrix_skills
            WHERE id = $1 AND session_id = $2
            LIMIT 1
          `,
        [skillId, session.id],
      );
      if (!skillResult.rows[0]) return res.status(404).json({ error: "Not found" });

      const currentLevel = parseNullableLevel(
        req.body?.currentLevel,
        Number(session.scale_min),
        Number(session.scale_max),
      );
      const targetLevel = parseNullableLevel(
        req.body?.targetLevel,
        Number(session.scale_min),
        Number(session.scale_max),
      );
      if (Number.isNaN(currentLevel) || Number.isNaN(targetLevel)) {
        return res.status(400).json({ error: "Invalid payload" });
      }

      const wantsToProgress = req.body?.wantsToProgress === true;
      const wantsToMentor = req.body?.wantsToMentor === true;

      await pool.query(
        `
            INSERT INTO skills_matrix_assessments (
              id,
              session_id,
              skill_id,
              participant_id,
              current_level,
              target_level,
              wants_to_progress,
              wants_to_mentor
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            ON CONFLICT (skill_id, participant_id)
            DO UPDATE SET
              current_level = EXCLUDED.current_level,
              target_level = EXCLUDED.target_level,
              wants_to_progress = EXCLUDED.wants_to_progress,
              wants_to_mentor = EXCLUDED.wants_to_mentor,
              updated_at = now()
          `,
        [
          crypto.randomUUID(),
          session.id,
          skillId,
          me.id,
          currentLevel,
          targetLevel,
          wantsToProgress,
          wantsToMentor,
        ],
      );

      const payload = await buildSessionSnapshot({
        pool,
        session,
        currentParticipantId: participantId,
      });
      emitSkillsMatrixSessionUpdate(code, "assessment_updated");
      return res.status(200).json(payload);
    } catch (err) {
      next(err);
    }
  });
}
