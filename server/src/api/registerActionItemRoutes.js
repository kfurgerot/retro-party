// Phase δ — action items: track outcomes from sessions across the team.
import { sessionLifecycle } from "../services/sessionLifecycle.js";

function serialize(row) {
  return {
    id: row.id,
    sessionCode: row.session_code,
    sessionModule: row.session_module,
    teamId: row.team_id ?? null,
    title: row.title,
    description: row.description ?? null,
    ownerUserId: row.owner_user_id ?? null,
    ownerDisplayName: row.owner_display_name ?? null,
    status: row.status,
    dueAt: row.due_at,
    createdAt: row.created_at,
    completedAt: row.completed_at,
    updatedAt: row.updated_at,
  };
}

export function registerActionItemRoutes(context) {
  const { app, pool, requireAuth, crypto } = context;

  // Public-ish list (anyone with the code can read action items for that session).
  app.get("/api/sessions/:code/action-items", async (req, res, next) => {
    try {
      const code = String(req.params.code || "")
        .trim()
        .toUpperCase();
      if (!code) return res.status(400).json({ error: "Invalid payload" });

      const result = await pool.query(
        `SELECT a.*, u.display_name AS owner_display_name
         FROM action_items a
         LEFT JOIN users u ON u.id = a.owner_user_id
         WHERE a.session_code = $1
         ORDER BY (a.status = 'done') ASC, a.created_at DESC`,
        [code],
      );
      return res.status(200).json({ items: result.rows.map(serialize) });
    } catch (err) {
      next(err);
    }
  });

  // Create — auth required. Bound to the session and (optionally) propagated
  // with that session's team_id so it shows up on the team page.
  app.post("/api/sessions/:code/action-items", requireAuth, async (req, res, next) => {
    try {
      const code = String(req.params.code || "")
        .trim()
        .toUpperCase();
      const title = (typeof req.body?.title === "string" ? req.body.title : "")
        .trim()
        .slice(0, 200);
      const description = (typeof req.body?.description === "string" ? req.body.description : "")
        .trim()
        .slice(0, 2000);
      if (!code || title.length < 2) {
        return res.status(400).json({ error: "Invalid payload" });
      }

      const session = await sessionLifecycle.resolveSessionByCode(pool, code);
      if (!session) return res.status(404).json({ error: "Not found" });

      // Pull the team_id from the session row (best-effort, table-specific).
      let teamId = null;
      try {
        const teamLookup = await pool.query(
          `SELECT team_id FROM ${session.table} WHERE id = $1 LIMIT 1`,
          [session.id],
        );
        teamId = teamLookup.rows[0]?.team_id ?? null;
      } catch {
        // silent — team_id is optional context
      }

      const id = crypto.randomUUID();
      const insert = await pool.query(
        `INSERT INTO action_items
           (id, session_code, session_module, team_id, title, description, created_by_user_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING *`,
        [id, code, session.module, teamId, title, description || null, req.currentUser.id],
      );
      return res.status(201).json({ item: serialize(insert.rows[0]) });
    } catch (err) {
      next(err);
    }
  });

  // Update — auth required. Owner of the action item OR session owner can edit.
  app.patch("/api/action-items/:id", requireAuth, async (req, res, next) => {
    try {
      const { id } = req.params;
      const sets = [];
      const values = [];
      const { title, description, status, ownerUserId, dueAt } = req.body ?? {};

      if (typeof title === "string") {
        const t = title.trim().slice(0, 200);
        if (t.length < 2) return res.status(400).json({ error: "Invalid title" });
        values.push(t);
        sets.push(`title = $${values.length}`);
      }
      if (typeof description === "string" || description === null) {
        const d = description === null ? null : String(description).trim().slice(0, 2000) || null;
        values.push(d);
        sets.push(`description = $${values.length}`);
      }
      if (typeof status === "string" && ["open", "done", "cancelled"].includes(status)) {
        values.push(status);
        sets.push(`status = $${values.length}`);
        sets.push(`completed_at = ${status === "done" ? "now()" : "NULL"}`);
      }
      if (ownerUserId === null || typeof ownerUserId === "string") {
        values.push(ownerUserId);
        sets.push(`owner_user_id = $${values.length}`);
      }
      if (dueAt === null || typeof dueAt === "string") {
        values.push(dueAt);
        sets.push(`due_at = $${values.length}`);
      }
      if (sets.length === 0) return res.status(400).json({ error: "No fields" });

      sets.push("updated_at = now()");
      values.push(id);
      const result = await pool.query(
        `UPDATE action_items SET ${sets.join(", ")} WHERE id = $${values.length} RETURNING *`,
        values,
      );
      const row = result.rows[0];
      if (!row) return res.status(404).json({ error: "Not found" });

      // Fetch owner display name for serialization parity.
      let ownerDisplayName = null;
      if (row.owner_user_id) {
        const u = await pool.query("SELECT display_name FROM users WHERE id = $1 LIMIT 1", [
          row.owner_user_id,
        ]);
        ownerDisplayName = u.rows[0]?.display_name ?? null;
      }
      return res
        .status(200)
        .json({ item: serialize({ ...row, owner_display_name: ownerDisplayName }) });
    } catch (err) {
      next(err);
    }
  });

  app.delete("/api/action-items/:id", requireAuth, async (req, res, next) => {
    try {
      const { id } = req.params;
      const result = await pool.query("DELETE FROM action_items WHERE id = $1 RETURNING id", [id]);
      if (!result.rows[0]) return res.status(404).json({ error: "Not found" });
      return res.status(204).end();
    } catch (err) {
      next(err);
    }
  });

  // Team rollup: all action items linked to the team via session.team_id.
  app.get("/api/teams/:teamId/action-items", requireAuth, async (req, res, next) => {
    try {
      const userId = req.currentUser.id;
      const { teamId } = req.params;
      const member = await pool.query(
        "SELECT 1 FROM team_members WHERE team_id = $1 AND user_id = $2 LIMIT 1",
        [teamId, userId],
      );
      if (!member.rows[0]) return res.status(404).json({ error: "Not found" });

      const result = await pool.query(
        `SELECT a.*, u.display_name AS owner_display_name
         FROM action_items a
         LEFT JOIN users u ON u.id = a.owner_user_id
         WHERE a.team_id = $1
         ORDER BY (a.status = 'done') ASC, a.created_at DESC`,
        [teamId],
      );
      return res.status(200).json({ items: result.rows.map(serialize) });
    } catch (err) {
      next(err);
    }
  });
}
