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

      return res.status(200).json({
        team: serializeTeam({ ...team, role, member_count: membersRes.rows.length }),
        members: membersRes.rows.map(serializeMember),
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

  // Invite an existing user by email (owner only).
  app.post("/api/teams/:teamId/members", requireAuth, async (req, res, next) => {
    try {
      const userId = req.currentUser.id;
      const { teamId } = req.params;
      const isOwner = await ensureOwnerRole(teamId, userId);
      if (!isOwner) return res.status(403).json({ error: "Forbidden" });

      const email = trimNonEmpty(req.body?.email, 200)?.toLowerCase();
      const role = req.body?.role === "admin" ? "admin" : "member";
      if (!email) return res.status(400).json({ error: "Invalid payload" });

      const userRes = await pool.query(
        "SELECT id, email, display_name FROM users WHERE LOWER(email) = $1 LIMIT 1",
        [email],
      );
      const target = userRes.rows[0];
      if (!target) return res.status(404).json({ error: "User not found" });

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
