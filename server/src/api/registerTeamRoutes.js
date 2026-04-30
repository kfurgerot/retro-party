import { sendTeamInvitationEmail } from "../../mailService.js";

function safeParse(s) {
  try {
    return JSON.parse(s);
  } catch {
    return {};
  }
}

function trimNonEmpty(value, max) {
  if (typeof value !== "string") return null;
  const t = value.trim();
  if (!t) return null;
  return t.slice(0, max);
}

function serializeTeam(row) {
  return {
    id: row.id,
    name: row.name,
    description: row.description ?? null,
    ownerUserId: row.owner_user_id,
    memberCount: row.member_count != null ? Number(row.member_count) : undefined,
    role: row.role ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function serializeMember(row) {
  return {
    id: row.id,
    teamId: row.team_id,
    userId: row.user_id,
    email: row.email,
    displayName: row.display_name,
    role: row.role,
    joinedAt: row.joined_at,
  };
}

function serializeInvitation(row) {
  return {
    id: row.id,
    teamId: row.team_id,
    email: row.email_lower,
    role: row.role,
    status: row.status,
    invitedByUserId: row.invited_by_user_id,
    createdAt: row.created_at,
    expiresAt: row.expires_at,
  };
}

const INVITATION_TTL_DAYS = 7;

export function registerTeamRoutes(context) {
  const { app, pool, requireAuth, crypto } = context;

  const ensureOwnerRole = async (teamId, userId) => {
    const result = await pool.query(
      "SELECT role FROM team_members WHERE team_id = $1 AND user_id = $2 LIMIT 1",
      [teamId, userId],
    );
    return result.rows[0]?.role === "owner" ? "owner" : null;
  };

  const ensureMembership = async (teamId, userId) => {
    const result = await pool.query(
      "SELECT role FROM team_members WHERE team_id = $1 AND user_id = $2 LIMIT 1",
      [teamId, userId],
    );
    return result.rows[0]?.role ?? null;
  };

  // List teams the current user owns or is a member of.
  app.get("/api/teams", requireAuth, async (req, res, next) => {
    try {
      const userId = req.currentUser.id;
      const result = await pool.query(
        `
          SELECT
            t.id, t.name, t.description, t.owner_user_id, t.created_at, t.updated_at,
            m.role,
            (SELECT COUNT(*)::int FROM team_members WHERE team_id = t.id) AS member_count
          FROM teams t
          INNER JOIN team_members m ON m.team_id = t.id AND m.user_id = $1
          ORDER BY t.updated_at DESC
        `,
        [userId],
      );
      return res.status(200).json({ items: result.rows.map(serializeTeam) });
    } catch (err) {
      next(err);
    }
  });

  // Create a new team. The current user becomes the owner.
  app.post("/api/teams", requireAuth, async (req, res, next) => {
    const client = await pool.connect();
    try {
      const userId = req.currentUser.id;
      const name = trimNonEmpty(req.body?.name, 80);
      const description = trimNonEmpty(req.body?.description, 280);
      if (!name) return res.status(400).json({ error: "Invalid payload" });

      await client.query("BEGIN");
      const teamId = crypto.randomUUID();
      const teamRes = await client.query(
        `
          INSERT INTO teams (id, name, description, owner_user_id)
          VALUES ($1, $2, $3, $4)
          RETURNING *
        `,
        [teamId, name, description, userId],
      );
      await client.query(
        `
          INSERT INTO team_members (id, team_id, user_id, role)
          VALUES ($1, $2, $3, 'owner')
        `,
        [crypto.randomUUID(), teamId, userId],
      );
      await client.query("COMMIT");

      const row = teamRes.rows[0];
      return res.status(201).json({
        team: serializeTeam({ ...row, role: "owner", member_count: 1 }),
      });
    } catch (err) {
      await client.query("ROLLBACK").catch(() => {});
      next(err);
    } finally {
      client.release();
    }
  });

  // Get team detail (must be a member).
  app.get("/api/teams/:teamId", requireAuth, async (req, res, next) => {
    try {
      const userId = req.currentUser.id;
      const { teamId } = req.params;
      const role = await ensureMembership(teamId, userId);
      if (!role) return res.status(404).json({ error: "Not found" });

      const teamRes = await pool.query("SELECT * FROM teams WHERE id = $1 LIMIT 1", [teamId]);
      const team = teamRes.rows[0];
      if (!team) return res.status(404).json({ error: "Not found" });

      const membersRes = await pool.query(
        `
          SELECT m.id, m.team_id, m.user_id, m.role, m.joined_at,
                 u.email, u.display_name
          FROM team_members m
          INNER JOIN users u ON u.id = m.user_id
          WHERE m.team_id = $1
          ORDER BY (m.role = 'owner') DESC, m.joined_at ASC
        `,
        [teamId],
      );

      // Pending invitations are owner-only data: list them only for owners.
      let pendingInvitations = [];
      if (role === "owner") {
        const invitesRes = await pool.query(
          `
            SELECT id, team_id, email_lower, role, status,
                   invited_by_user_id, created_at, expires_at
            FROM team_invitations
            WHERE team_id = $1 AND status = 'pending' AND expires_at > now()
            ORDER BY created_at DESC
          `,
          [teamId],
        );
        pendingInvitations = invitesRes.rows.map(serializeInvitation);
      }

      return res.status(200).json({
        team: serializeTeam({ ...team, role, member_count: membersRes.rows.length }),
        members: membersRes.rows.map(serializeMember),
        pendingInvitations,
      });
    } catch (err) {
      next(err);
    }
  });

  // Rename / update description (owner only).
  app.patch("/api/teams/:teamId", requireAuth, async (req, res, next) => {
    try {
      const userId = req.currentUser.id;
      const { teamId } = req.params;
      const isOwner = await ensureOwnerRole(teamId, userId);
      if (!isOwner) return res.status(403).json({ error: "Forbidden" });

      const name = trimNonEmpty(req.body?.name, 80);
      const description =
        req.body?.description === null ? null : trimNonEmpty(req.body?.description, 280);
      if (!name) return res.status(400).json({ error: "Invalid payload" });

      const result = await pool.query(
        `
          UPDATE teams
          SET name = $1, description = $2, updated_at = now()
          WHERE id = $3
          RETURNING *
        `,
        [name, description, teamId],
      );
      const team = result.rows[0];
      if (!team) return res.status(404).json({ error: "Not found" });
      return res.status(200).json({ team: serializeTeam({ ...team, role: "owner" }) });
    } catch (err) {
      next(err);
    }
  });

  // Delete a team (owner only).
  app.delete("/api/teams/:teamId", requireAuth, async (req, res, next) => {
    try {
      const userId = req.currentUser.id;
      const { teamId } = req.params;
      const isOwner = await ensureOwnerRole(teamId, userId);
      if (!isOwner) return res.status(403).json({ error: "Forbidden" });

      await pool.query("DELETE FROM teams WHERE id = $1", [teamId]);
      return res.status(204).end();
    } catch (err) {
      next(err);
    }
  });

  // Invite a member by email (owner only).
  // If the email already has a user account, they are added directly as a
  // member. Otherwise, a pending invitation is created (and on Lot B, an
  // email is sent). Re-inviting a pending email refreshes the token and
  // expiration.
  app.post("/api/teams/:teamId/members", requireAuth, async (req, res, next) => {
    try {
      const userId = req.currentUser.id;
      const { teamId } = req.params;
      const isOwner = await ensureOwnerRole(teamId, userId);
      if (!isOwner) return res.status(403).json({ error: "Forbidden" });

      const email = trimNonEmpty(req.body?.email, 200)?.toLowerCase();
      const role = req.body?.role === "admin" ? "admin" : "member";
      if (!email) return res.status(400).json({ error: "Invalid payload" });

      // Path 1 — user already exists: add directly as member.
      const userRes = await pool.query(
        "SELECT id, email, display_name FROM users WHERE LOWER(email) = $1 LIMIT 1",
        [email],
      );
      const target = userRes.rows[0];
      if (target) {
        try {
          const insertRes = await pool.query(
            `
              INSERT INTO team_members (id, team_id, user_id, role)
              VALUES ($1, $2, $3, $4)
              RETURNING *
            `,
            [crypto.randomUUID(), teamId, target.id, role],
          );
          const member = insertRes.rows[0];
          return res.status(201).json({
            kind: "member",
            member: serializeMember({
              ...member,
              email: target.email,
              display_name: target.display_name,
            }),
          });
        } catch (err) {
          if (err && err.code === "23505") {
            return res.status(409).json({ error: "Already a member" });
          }
          throw err;
        }
      }

      // Path 2 — no user yet: upsert a pending invitation.
      const teamRow = await pool.query("SELECT name FROM teams WHERE id = $1 LIMIT 1", [teamId]);
      const teamName = teamRow.rows[0]?.name ?? "votre équipe";

      const token = crypto.randomBytes(32).toString("hex");
      const expiresAt = new Date(Date.now() + INVITATION_TTL_DAYS * 24 * 60 * 60 * 1000);
      const upsertRes = await pool.query(
        `
          INSERT INTO team_invitations (
            id, team_id, email_lower, role, token, invited_by_user_id,
            status, expires_at
          )
          VALUES ($1, $2, $3, $4, $5, $6, 'pending', $7)
          ON CONFLICT (team_id, email_lower) DO UPDATE SET
            role = EXCLUDED.role,
            token = EXCLUDED.token,
            invited_by_user_id = EXCLUDED.invited_by_user_id,
            status = 'pending',
            created_at = now(),
            expires_at = EXCLUDED.expires_at,
            accepted_at = NULL,
            accepted_user_id = NULL
          RETURNING *
        `,
        [crypto.randomUUID(), teamId, email, role, token, userId, expiresAt.toISOString()],
      );
      const invitation = upsertRes.rows[0];

      // Send the invitation email. Best-effort: a failure here must not
      // block the API response — the owner can re-invite to retry.
      let emailSent = false;
      try {
        await sendTeamInvitationEmail({
          to: email,
          teamName,
          inviterName: req.currentUser?.displayName,
          inviterEmail: req.currentUser?.email,
          token,
          expiresAt: expiresAt.toISOString(),
        });
        emailSent = true;
      } catch (mailErr) {
        // eslint-disable-next-line no-console
        console.error(
          `[team-invitation] sendMail failed for ${email}:`,
          mailErr?.message || mailErr,
        );
      }

      // The token is intentionally NOT exposed in the API response.
      return res.status(201).json({
        kind: "invitation",
        invitation: serializeInvitation(invitation),
        emailSent,
      });
    } catch (err) {
      next(err);
    }
  });

  // Public preview of an invitation by token (no auth needed — the token
  // itself is the secret). Used by the /invite/:token landing page.
  app.get("/api/teams/invitations/:token", async (req, res, next) => {
    try {
      const { token } = req.params;
      if (!token || typeof token !== "string") {
        return res.status(400).json({ error: "Invalid token" });
      }
      const result = await pool.query(
        `
          SELECT i.email_lower, i.expires_at, i.status,
                 t.id AS team_id, t.name AS team_name,
                 u.display_name AS inviter_name, u.email AS inviter_email
          FROM team_invitations i
          INNER JOIN teams t ON t.id = i.team_id
          LEFT JOIN users u ON u.id = i.invited_by_user_id
          WHERE i.token = $1
          LIMIT 1
        `,
        [token],
      );
      const row = result.rows[0];
      if (!row) return res.status(404).json({ error: "Invitation not found" });
      if (row.status === "expired" || new Date(row.expires_at) <= new Date()) {
        return res.status(410).json({ error: "Invitation expired" });
      }
      // status === 'pending' or 'accepted': return team info either way.
      // Frontend uses the `status` field to drive the next step (auto-accept
      // or redirect to team page if already accepted).
      return res.status(200).json({
        invitation: {
          email: row.email_lower,
          expiresAt: row.expires_at,
          status: row.status,
          team: { id: row.team_id, name: row.team_name },
          inviterName: row.inviter_name ?? null,
          inviterEmail: row.inviter_email ?? null,
        },
      });
    } catch (err) {
      next(err);
    }
  });

  // Accept an invitation (auth required, email of current user must match).
  app.post("/api/teams/invitations/:token/accept", requireAuth, async (req, res, next) => {
    try {
      const { token } = req.params;
      const userId = req.currentUser.id;
      const userEmail = (req.currentUser.email || "").toLowerCase();

      const inviteRes = await pool.query(
        `
            SELECT id, team_id, email_lower, role, status, expires_at
            FROM team_invitations
            WHERE token = $1
            LIMIT 1
          `,
        [token],
      );
      const invite = inviteRes.rows[0];
      if (!invite) return res.status(404).json({ error: "Invitation not found" });
      if (invite.status !== "pending") {
        return res.status(410).json({ error: "Invitation already used" });
      }
      if (new Date(invite.expires_at) <= new Date()) {
        return res.status(410).json({ error: "Invitation expired" });
      }
      if (invite.email_lower !== userEmail) {
        return res.status(403).json({ error: "Email mismatch" });
      }

      await pool.query(
        `
            INSERT INTO team_members (id, team_id, user_id, role)
            VALUES ($1, $2, $3, $4)
            ON CONFLICT (team_id, user_id) DO NOTHING
          `,
        [crypto.randomUUID(), invite.team_id, userId, invite.role],
      );
      await pool.query(
        `
            UPDATE team_invitations
            SET status = 'accepted', accepted_at = now(), accepted_user_id = $1
            WHERE id = $2
          `,
        [userId, invite.id],
      );

      const teamRes = await pool.query("SELECT id, name FROM teams WHERE id = $1 LIMIT 1", [
        invite.team_id,
      ]);
      const team = teamRes.rows[0];
      return res.status(200).json({
        team: { id: team.id, name: team.name },
      });
    } catch (err) {
      next(err);
    }
  });

  // Cancel a pending invitation (owner only).
  app.delete("/api/teams/:teamId/invitations/:inviteId", requireAuth, async (req, res, next) => {
    try {
      const userId = req.currentUser.id;
      const { teamId, inviteId } = req.params;
      const isOwner = await ensureOwnerRole(teamId, userId);
      if (!isOwner) return res.status(403).json({ error: "Forbidden" });

      const result = await pool.query(
        `
            DELETE FROM team_invitations
            WHERE id = $1 AND team_id = $2 AND status = 'pending'
          `,
        [inviteId, teamId],
      );
      if (result.rowCount === 0) {
        return res.status(404).json({ error: "Not found" });
      }
      return res.status(204).end();
    } catch (err) {
      next(err);
    }
  });

  // Assign / unassign an item (session or template) to a team. The user must
  // own the item AND be a member of the target team (or null to unassign).
  // kind ∈ {room, radar, skills, template}
  app.patch("/api/items/team", requireAuth, async (req, res, next) => {
    try {
      const userId = req.currentUser.id;
      const kind = String(req.body?.kind || "");
      const itemId = String(req.body?.id || "");
      const teamId = req.body?.teamId == null ? null : String(req.body.teamId);
      if (!itemId || !["room", "radar", "skills", "template"].includes(kind)) {
        return res.status(400).json({ error: "Invalid payload" });
      }

      if (teamId) {
        const role = await ensureMembership(teamId, userId);
        if (!role) return res.status(403).json({ error: "Forbidden" });
      }

      const TABLE = {
        room: { table: "rooms", ownerCol: "created_by_user_id" },
        radar: { table: "radar_sessions", ownerCol: "created_by_user_id" },
        skills: { table: "skills_matrix_sessions", ownerCol: "created_by_user_id" },
        template: { table: "game_templates", ownerCol: "user_id" },
      }[kind];

      const ownerCheck = await pool.query(
        `SELECT id FROM ${TABLE.table} WHERE id = $1 AND ${TABLE.ownerCol} = $2 LIMIT 1`,
        [itemId, userId],
      );
      if (!ownerCheck.rows[0]) return res.status(403).json({ error: "Forbidden" });

      await pool.query(`UPDATE ${TABLE.table} SET team_id = $1 WHERE id = $2`, [teamId, itemId]);
      return res.status(204).end();
    } catch (err) {
      next(err);
    }
  });

  // Aggregated team insights: average team radar + latest skills session link.
  app.get("/api/teams/:teamId/insights", requireAuth, async (req, res, next) => {
    try {
      const userId = req.currentUser.id;
      const { teamId } = req.params;
      const role = await ensureMembership(teamId, userId);
      if (!role) return res.status(404).json({ error: "Not found" });

      const [radarRes, skillsRes] = await Promise.all([
        pool.query(
          `
            SELECT s.id, s.session_code, s.title, r.member_count, r.radar, r.updated_at
            FROM radar_sessions s
            INNER JOIN radar_team_results r ON r.session_id = s.id
            WHERE s.team_id = $1
            ORDER BY r.updated_at DESC
          `,
          [teamId],
        ),
        pool.query(
          `
            SELECT id, session_code, title, status, started_at, ended_at, updated_at
            FROM skills_matrix_sessions
            WHERE team_id = $1
            ORDER BY updated_at DESC
            LIMIT 1
          `,
          [teamId],
        ),
      ]);

      const radarRows = radarRes.rows;
      const radarSessions = radarRows.map((row) => {
        const radar = typeof row.radar === "string" ? safeParse(row.radar) : row.radar || {};
        return {
          sessionId: row.id,
          code: row.session_code,
          title: row.title,
          memberCount: Number(row.member_count) || 0,
          radar,
          updatedAt: row.updated_at,
        };
      });

      const dimensions = [
        "collaboration",
        "fun",
        "learning",
        "alignment",
        "ownership",
        "process",
        "resources",
        "roles",
        "speed",
        "value",
      ];

      const averagedRadar = dimensions.reduce((acc, dim) => {
        if (radarSessions.length === 0) {
          acc[dim] = 0;
          return acc;
        }
        const sum = radarSessions.reduce((s, r) => s + Number(r.radar?.[dim] || 0), 0);
        acc[dim] = Math.round((sum / radarSessions.length) * 10) / 10;
        return acc;
      }, {});

      const latestSkills = skillsRes.rows[0]
        ? {
            sessionId: skillsRes.rows[0].id,
            code: skillsRes.rows[0].session_code,
            title: skillsRes.rows[0].title,
            status: skillsRes.rows[0].status,
            startedAt: skillsRes.rows[0].started_at,
            endedAt: skillsRes.rows[0].ended_at,
            updatedAt: skillsRes.rows[0].updated_at,
          }
        : null;

      return res.status(200).json({
        radar: {
          sessionsCount: radarSessions.length,
          axes: averagedRadar,
          recent: radarSessions.slice(0, 3).map((s) => ({
            sessionId: s.sessionId,
            code: s.code,
            title: s.title,
            memberCount: s.memberCount,
            updatedAt: s.updatedAt,
          })),
        },
        skillsLatest: latestSkills,
      });
    } catch (err) {
      next(err);
    }
  });

  // Remove a member (owner can remove anyone; members can remove themselves).
  app.delete("/api/teams/:teamId/members/:memberUserId", requireAuth, async (req, res, next) => {
    try {
      const userId = req.currentUser.id;
      const { teamId, memberUserId } = req.params;
      const role = await ensureMembership(teamId, userId);
      if (!role) return res.status(404).json({ error: "Not found" });

      const removingSelf = memberUserId === userId;
      if (!removingSelf && role !== "owner") {
        return res.status(403).json({ error: "Forbidden" });
      }

      const targetRes = await pool.query(
        "SELECT role FROM team_members WHERE team_id = $1 AND user_id = $2 LIMIT 1",
        [teamId, memberUserId],
      );
      const target = targetRes.rows[0];
      if (!target) return res.status(404).json({ error: "Not found" });
      if (target.role === "owner") {
        return res.status(400).json({ error: "Cannot remove owner" });
      }

      await pool.query("DELETE FROM team_members WHERE team_id = $1 AND user_id = $2", [
        teamId,
        memberUserId,
      ]);
      return res.status(204).end();
    } catch (err) {
      next(err);
    }
  });
}
