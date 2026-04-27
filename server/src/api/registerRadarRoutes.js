export function registerRadarRoutes(context) {
  const {
    app,
    pool,
    RADAR_QUESTIONS,
    generateUniqueRoomCode,
    rooms,
    makeCode,
    isCodeReserved,
    crypto,
    normalizeRadarAnswers,
    computeRadarScores,
    buildIndividualInsights,
    toJson,
    computeTeamAverageRadar,
    buildTeamInsights,
    serializeRadarParticipant,
    emitRadarSessionUpdate,
  } = context;

  app.get("/api/radar/questions", (_req, res) => {
    return res.status(200).json({ items: RADAR_QUESTIONS });
  });

  app.post("/api/radar/sessions", async (req, res, next) => {
    try {
      const title = typeof req.body?.title === "string" ? req.body.title.trim().slice(0, 120) : "";
      const facilitatorName =
        typeof req.body?.facilitatorName === "string"
          ? req.body.facilitatorName.trim().slice(0, 80)
          : "";
      const hostParticipates = req.body?.hostParticipates !== false;
      const code = await generateUniqueRoomCode({ pool, rooms, makeCode, isCodeReserved });
      const sessionId = crypto.randomUUID();

      await pool.query(
        `
          INSERT INTO radar_sessions (id, session_code, title, facilitator_name, created_by_user_id, host_participates, status)
          VALUES ($1, $2, $3, $4, $5, $6, 'lobby')
        `,
        [
          sessionId,
          code,
          title || null,
          facilitatorName || null,
          req.currentUser?.id ?? null,
          hostParticipates,
        ],
      );

      return res.status(201).json({
        session: {
          id: sessionId,
          code,
          title: title || null,
          facilitatorName: facilitatorName || null,
          hostParticipates,
          status: "lobby",
          startedAt: null,
        },
      });
    } catch (err) {
      next(err);
    }
  });

  app.post("/api/radar/sessions/:code/participants", async (req, res, next) => {
    try {
      const code = String(req.params.code || "")
        .trim()
        .toUpperCase();
      const displayName =
        typeof req.body?.displayName === "string" ? req.body.displayName.trim().slice(0, 80) : "";
      const avatarRaw = Number(req.body?.avatar);
      const avatar = Number.isFinite(avatarRaw)
        ? Math.max(0, Math.min(30, Math.round(avatarRaw)))
        : 0;
      if (displayName.length < 2) return res.status(400).json({ error: "Invalid payload" });

      const sessionResult = await pool.query(
        "SELECT id, session_code, title, facilitator_name, host_participates, status, started_at, created_at FROM radar_sessions WHERE session_code = $1 LIMIT 1",
        [code],
      );
      const session = sessionResult.rows[0];
      if (!session) return res.status(404).json({ error: "Not found" });

      const hostCountResult = await pool.query(
        "SELECT COUNT(*)::int AS count FROM radar_participants WHERE session_id = $1 AND is_host = true",
        [session.id],
      );
      const shouldBeHost = Number(hostCountResult.rows[0]?.count ?? 0) === 0;

      const participantId = crypto.randomUUID();
      const participantResult = await pool.query(
        `
          INSERT INTO radar_participants (id, session_id, display_name, avatar, is_host, user_id)
          VALUES ($1, $2, $3, $4, $5, $6)
          RETURNING *
        `,
        [participantId, session.id, displayName, avatar, shouldBeHost, req.currentUser?.id ?? null],
      );

      emitRadarSessionUpdate(session.session_code, "participant_joined");

      return res.status(201).json({
        session: {
          id: session.id,
          code: session.session_code,
          title: session.title,
          facilitatorName: session.facilitator_name,
          hostParticipates: session.host_participates !== false,
          status: session.status,
          startedAt: session.started_at,
          createdAt: session.created_at,
        },
        participant: serializeRadarParticipant(participantResult.rows[0]),
      });
    } catch (err) {
      next(err);
    }
  });

  app.post("/api/radar/sessions/:code/progress", async (req, res, next) => {
    try {
      const code = String(req.params.code || "")
        .trim()
        .toUpperCase();
      const participantId =
        typeof req.body?.participantId === "string" ? req.body.participantId : "";
      const answeredCountRaw = Number(req.body?.answeredCount);
      const answeredCount = Number.isFinite(answeredCountRaw) ? Math.round(answeredCountRaw) : NaN;
      const totalCount = RADAR_QUESTIONS.length;

      if (!participantId || !Number.isFinite(answeredCount)) {
        return res.status(400).json({ error: "Invalid payload" });
      }
      if (answeredCount < 0 || answeredCount > totalCount) {
        return res.status(400).json({ error: "Invalid payload" });
      }

      const sessionResult = await pool.query(
        "SELECT id, session_code, host_participates, status FROM radar_sessions WHERE session_code = $1 LIMIT 1",
        [code],
      );
      const session = sessionResult.rows[0];
      if (!session) return res.status(404).json({ error: "Not found" });

      const participantResult = await pool.query(
        "SELECT id, is_host FROM radar_participants WHERE id = $1 AND session_id = $2 LIMIT 1",
        [participantId, session.id],
      );
      const participant = participantResult.rows[0];
      if (!participant) return res.status(404).json({ error: "Not found" });

      if (participant.is_host && session.host_participates === false) {
        return res.status(200).json({
          participant: {
            id: participant.id,
            progressAnswered: 0,
            progressTotal: totalCount,
            progressPct: 0,
          },
        });
      }

      const updateResult = await pool.query(
        `
          UPDATE radar_participants
          SET progress_answered = $1, progress_total = $2
          WHERE id = $3 AND session_id = $4
          RETURNING id, progress_answered, progress_total
        `,
        [answeredCount, totalCount, participant.id, session.id],
      );

      const updated = updateResult.rows[0];
      const progressAnswered = Number(updated.progress_answered || 0);
      const progressTotal = Math.max(1, Number(updated.progress_total || totalCount));
      const progressPct = Math.max(
        0,
        Math.min(100, Math.round((progressAnswered / progressTotal) * 100)),
      );

      emitRadarSessionUpdate(session.session_code, "progress_updated");

      return res.status(200).json({
        participant: {
          id: updated.id,
          progressAnswered,
          progressTotal,
          progressPct,
        },
      });
    } catch (err) {
      next(err);
    }
  });

  app.post("/api/radar/sessions/:code/submissions", async (req, res, next) => {
    const client = await pool.connect();
    try {
      const code = String(req.params.code || "")
        .trim()
        .toUpperCase();
      const participantId =
        typeof req.body?.participantId === "string" ? req.body.participantId : "";
      const answers = normalizeRadarAnswers(req.body?.answers);
      if (!participantId || !answers) return res.status(400).json({ error: "Invalid payload" });

      const sessionResult = await client.query(
        "SELECT id, session_code, host_participates, status FROM radar_sessions WHERE session_code = $1 LIMIT 1",
        [code],
      );
      const session = sessionResult.rows[0];
      if (!session) return res.status(404).json({ error: "Not found" });
      if (session.status !== "started" && session.status !== "lobby") {
        return res.status(400).json({ error: "Invalid payload" });
      }

      const participantResult = await client.query(
        "SELECT * FROM radar_participants WHERE id = $1 AND session_id = $2 LIMIT 1",
        [participantId, session.id],
      );
      const participant = participantResult.rows[0];
      if (!participant) return res.status(404).json({ error: "Not found" });
      if (participant.is_host && session.host_participates === false) {
        return res.status(403).json({ error: "Unauthorized" });
      }

      const scoring = computeRadarScores(answers);
      const insights = buildIndividualInsights(scoring.radar);

      await client.query("BEGIN");
      const responseResult = await client.query(
        `
          INSERT INTO radar_responses (
            id, session_id, participant_id, answers, radar, poles, summary, strengths, watchouts, workshop_questions
          )
          VALUES ($1, $2, $3, $4::jsonb, $5::jsonb, $6::jsonb, $7, $8::jsonb, $9::jsonb, $10::jsonb)
          ON CONFLICT (participant_id) DO UPDATE SET
            answers = EXCLUDED.answers,
            radar = EXCLUDED.radar,
            poles = EXCLUDED.poles,
            summary = EXCLUDED.summary,
            strengths = EXCLUDED.strengths,
            watchouts = EXCLUDED.watchouts,
            workshop_questions = EXCLUDED.workshop_questions,
            updated_at = now()
          RETURNING *
        `,
        [
          crypto.randomUUID(),
          session.id,
          participant.id,
          toJson(answers),
          toJson(scoring.radar),
          toJson(scoring.polesPercent),
          insights.summary,
          toJson(insights.strengths),
          toJson(insights.watchouts),
          toJson(insights.workshopQuestions),
        ],
      );
      await client.query(
        `
          UPDATE radar_participants
          SET progress_answered = $1, progress_total = $1
          WHERE id = $2
        `,
        [RADAR_QUESTIONS.length, participant.id],
      );

      const allResponsesResult = await client.query(
        "SELECT radar FROM radar_responses WHERE session_id = $1 ORDER BY updated_at ASC",
        [session.id],
      );
      const memberRadars = allResponsesResult.rows
        .map((row) => row.radar)
        .filter((value) => value && typeof value === "object");
      const teamRadar = computeTeamAverageRadar(memberRadars);
      const teamInsights = buildTeamInsights(teamRadar, memberRadars);

      await client.query(
        `
          INSERT INTO radar_team_results (session_id, member_count, radar, insight, updated_at)
          VALUES ($1, $2, $3::jsonb, $4::jsonb, now())
          ON CONFLICT (session_id) DO UPDATE SET
            member_count = EXCLUDED.member_count,
            radar = EXCLUDED.radar,
            insight = EXCLUDED.insight,
            updated_at = now()
        `,
        [session.id, memberRadars.length, toJson(teamRadar), toJson(teamInsights)],
      );
      await client.query("COMMIT");

      emitRadarSessionUpdate(session.session_code, "submission_received");

      const row = responseResult.rows[0];
      return res.status(201).json({
        participant: { id: participant.id, displayName: participant.display_name },
        result: {
          radar: row.radar,
          polesPercent: row.poles,
          insights: {
            summary: row.summary,
            strengths: row.strengths,
            watchouts: row.watchouts,
            workshopQuestions: row.workshop_questions,
          },
        },
        team: {
          memberCount: memberRadars.length,
          radar: teamRadar,
          insights: teamInsights,
        },
      });
    } catch (err) {
      await client.query("ROLLBACK");
      next(err);
    } finally {
      client.release();
    }
  });

  app.get("/api/radar/sessions/:code", async (req, res, next) => {
    try {
      const code = String(req.params.code || "")
        .trim()
        .toUpperCase();
      const sessionResult = await pool.query(
        "SELECT id, session_code, title, facilitator_name, host_participates, status, started_at, created_at FROM radar_sessions WHERE session_code = $1 LIMIT 1",
        [code],
      );
      const session = sessionResult.rows[0];
      if (!session) return res.status(404).json({ error: "Not found" });

      const participantsResult = await pool.query(
        `
          SELECT
            p.id,
            p.display_name,
            p.avatar,
            p.is_host,
            p.progress_answered,
            p.progress_total,
            p.created_at,
            r.radar,
            r.poles,
            r.summary,
            r.strengths,
            r.watchouts,
            r.workshop_questions,
            r.updated_at AS submitted_at
          FROM radar_participants p
          LEFT JOIN radar_responses r ON r.participant_id = p.id
          WHERE p.session_id = $1
          ORDER BY p.created_at ASC
        `,
        [session.id],
      );

      const teamResult = await pool.query(
        "SELECT member_count, radar, insight, updated_at FROM radar_team_results WHERE session_id = $1 LIMIT 1",
        [session.id],
      );
      const team = teamResult.rows[0];

      return res.status(200).json({
        session: {
          id: session.id,
          code: session.session_code,
          title: session.title,
          facilitatorName: session.facilitator_name,
          hostParticipates: session.host_participates !== false,
          status: session.status,
          startedAt: session.started_at,
          createdAt: session.created_at,
        },
        participants: participantsResult.rows.map((row) => ({
          id: row.id,
          displayName: row.display_name,
          avatar: Number.isFinite(Number(row.avatar)) ? Number(row.avatar) : 0,
          isHost: !!row.is_host,
          progressAnswered: Number.isFinite(Number(row.progress_answered))
            ? Number(row.progress_answered)
            : 0,
          progressTotal: Number.isFinite(Number(row.progress_total))
            ? Number(row.progress_total)
            : RADAR_QUESTIONS.length,
          progressPct: Math.max(
            0,
            Math.min(
              100,
              Math.round(
                ((Number.isFinite(Number(row.progress_answered))
                  ? Number(row.progress_answered)
                  : 0) /
                  Math.max(
                    1,
                    Number.isFinite(Number(row.progress_total))
                      ? Number(row.progress_total)
                      : RADAR_QUESTIONS.length,
                  )) *
                  100,
              ),
            ),
          ),
          createdAt: row.created_at,
          submittedAt: row.submitted_at,
          result: row.radar
            ? {
                radar: row.radar,
                polesPercent: row.poles,
                insights: {
                  summary: row.summary,
                  strengths: row.strengths,
                  watchouts: row.watchouts,
                  workshopQuestions: row.workshop_questions,
                },
              }
            : null,
        })),
        team: team
          ? {
              memberCount: team.member_count,
              radar: team.radar,
              insights: team.insight,
              updatedAt: team.updated_at,
            }
          : null,
      });
    } catch (err) {
      next(err);
    }
  });

  app.post("/api/radar/sessions/:code/start", async (req, res, next) => {
    try {
      const code = String(req.params.code || "")
        .trim()
        .toUpperCase();
      const participantId =
        typeof req.body?.participantId === "string" ? req.body.participantId : "";
      const hostParticipates =
        typeof req.body?.hostParticipates === "boolean" ? req.body.hostParticipates : null;
      if (!participantId) return res.status(400).json({ error: "Invalid payload" });

      const sessionResult = await pool.query(
        "SELECT id, session_code, status, started_at, host_participates FROM radar_sessions WHERE session_code = $1 LIMIT 1",
        [code],
      );
      const session = sessionResult.rows[0];
      if (!session) return res.status(404).json({ error: "Not found" });

      const participantResult = await pool.query(
        "SELECT id, is_host FROM radar_participants WHERE id = $1 AND session_id = $2 LIMIT 1",
        [participantId, session.id],
      );
      const participant = participantResult.rows[0];
      if (!participant) return res.status(404).json({ error: "Not found" });
      if (!participant.is_host) return res.status(403).json({ error: "Unauthorized" });

      const updateResult = await pool.query(
        `
          UPDATE radar_sessions
          SET
            status = 'started',
            started_at = COALESCE(started_at, now()),
            host_participates = COALESCE($2::boolean, host_participates)
          WHERE id = $1
          RETURNING id, session_code, status, started_at, host_participates
        `,
        [session.id, hostParticipates],
      );
      const updated = updateResult.rows[0];

      if (updated.host_participates === false) {
        await pool.query(
          `
            UPDATE radar_participants
            SET progress_answered = 0, progress_total = $2
            WHERE session_id = $1 AND is_host = true
          `,
          [session.id, RADAR_QUESTIONS.length],
        );
      }

      emitRadarSessionUpdate(updated.session_code, "session_started");

      return res.status(200).json({
        session: {
          id: updated.id,
          code: updated.session_code,
          status: updated.status,
          startedAt: updated.started_at,
          hostParticipates: updated.host_participates !== false,
        },
      });
    } catch (err) {
      next(err);
    }
  });
}
