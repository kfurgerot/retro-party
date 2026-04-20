export function registerTemplateRoutes(context) {
  const {
    app,
    pool,
    requireAuth,
    serializeTemplate,
    serializeQuestion,
    getDefaultTemplateQuestions,
    crypto,
    getOwnedTemplate,
    generateUniqueRoomCode,
    rooms,
    makeCode,
    isCodeReserved,
    createRuntimeRoom,
    createPokerRoom,
    pokerRooms,
  } = context;

  app.get("/api/templates", requireAuth, async (req, res, next) => {
    try {
      const result = await pool.query(
        `
          SELECT * FROM game_templates
          WHERE user_id = $1
          ORDER BY updated_at DESC
        `,
        [req.currentUser.id],
      );
      return res.status(200).json({ items: result.rows.map(serializeTemplate) });
    } catch (err) {
      next(err);
    }
  });

  app.post("/api/templates", requireAuth, async (req, res, next) => {
    const client = await pool.connect();
    try {
      const { name, description, baseConfig } = req.body ?? {};
      if (typeof name !== "string" || name.trim().length < 1 || name.length > 120) {
        return res.status(400).json({ error: "Invalid payload" });
      }
      if (description != null && (typeof description !== "string" || description.length > 300)) {
        return res.status(400).json({ error: "Invalid payload" });
      }
      if (baseConfig != null && (typeof baseConfig !== "object" || Array.isArray(baseConfig))) {
        return res.status(400).json({ error: "Invalid payload" });
      }

      const templateId = crypto.randomUUID();
      await client.query("BEGIN");
      const result = await client.query(
        `
          INSERT INTO game_templates (id, user_id, name, description, base_config)
          VALUES ($1, $2, $3, $4, $5::jsonb)
          RETURNING *
        `,
        [
          templateId,
          req.currentUser.id,
          name.trim(),
          description?.trim() || null,
          JSON.stringify(baseConfig ?? {}),
        ],
      );
      const isPlanningPokerTemplate = baseConfig?.module === "planning-poker";
      const seedQuestions = isPlanningPokerTemplate ? [] : getDefaultTemplateQuestions();
      for (const question of seedQuestions) {
        await client.query(
          `
            INSERT INTO custom_questions (id, template_id, text, category, sort_order, is_active)
            VALUES ($1, $2, $3, $4, $5, true)
          `,
          [question.id, templateId, question.text, question.category, question.sortOrder],
        );
      }
      await client.query("COMMIT");
      return res.status(201).json({ template: serializeTemplate(result.rows[0]) });
    } catch (err) {
      await client.query("ROLLBACK");
      next(err);
    } finally {
      client.release();
    }
  });

  app.get("/api/templates/:templateId", requireAuth, async (req, res, next) => {
    try {
      const template = await getOwnedTemplate(pool, req.currentUser.id, req.params.templateId);
      if (!template) return res.status(404).json({ error: "Not found" });
      return res.status(200).json({ template: serializeTemplate(template) });
    } catch (err) {
      next(err);
    }
  });

  app.patch("/api/templates/:templateId", requireAuth, async (req, res, next) => {
    try {
      const { name, description, baseConfig, isArchived } = req.body ?? {};
      const updates = [];
      const values = [];
      let idx = 1;

      if (name !== undefined) {
        if (typeof name !== "string" || name.trim().length < 1 || name.length > 120) {
          return res.status(400).json({ error: "Invalid payload" });
        }
        updates.push(`name = $${idx++}`);
        values.push(name.trim());
      }
      if (description !== undefined) {
        if (description !== null && (typeof description !== "string" || description.length > 300)) {
          return res.status(400).json({ error: "Invalid payload" });
        }
        updates.push(`description = $${idx++}`);
        values.push(description === null ? null : description.trim());
      }
      if (baseConfig !== undefined) {
        if (typeof baseConfig !== "object" || baseConfig === null || Array.isArray(baseConfig)) {
          return res.status(400).json({ error: "Invalid payload" });
        }
        updates.push(`base_config = $${idx++}::jsonb`);
        values.push(JSON.stringify(baseConfig));
      }
      if (isArchived !== undefined) {
        if (typeof isArchived !== "boolean")
          return res.status(400).json({ error: "Invalid payload" });
        updates.push(`is_archived = $${idx++}`);
        values.push(isArchived);
      }

      if (updates.length === 0) return res.status(400).json({ error: "Invalid payload" });
      updates.push("updated_at = now()");
      values.push(req.params.templateId, req.currentUser.id);

      const result = await pool.query(
        `
          UPDATE game_templates
          SET ${updates.join(", ")}
          WHERE id = $${idx++} AND user_id = $${idx}
          RETURNING *
        `,
        values,
      );
      if (!result.rows[0]) return res.status(404).json({ error: "Not found" });
      return res.status(200).json({ template: serializeTemplate(result.rows[0]) });
    } catch (err) {
      next(err);
    }
  });

  app.delete("/api/templates/:templateId", requireAuth, async (req, res, next) => {
    try {
      const result = await pool.query("DELETE FROM game_templates WHERE id = $1 AND user_id = $2", [
        req.params.templateId,
        req.currentUser.id,
      ]);
      if (result.rowCount === 0) return res.status(404).json({ error: "Not found" });
      return res.status(204).send();
    } catch (err) {
      next(err);
    }
  });

  app.get("/api/templates/:templateId/questions", requireAuth, async (req, res, next) => {
    try {
      const template = await getOwnedTemplate(pool, req.currentUser.id, req.params.templateId);
      if (!template) return res.status(404).json({ error: "Not found" });

      const result = await pool.query(
        "SELECT * FROM custom_questions WHERE template_id = $1 ORDER BY sort_order ASC, created_at ASC",
        [req.params.templateId],
      );
      return res.status(200).json({ items: result.rows.map(serializeQuestion) });
    } catch (err) {
      next(err);
    }
  });

  app.post("/api/templates/:templateId/questions", requireAuth, async (req, res, next) => {
    try {
      const template = await getOwnedTemplate(pool, req.currentUser.id, req.params.templateId);
      if (!template) return res.status(404).json({ error: "Not found" });

      const { text, category, sortOrder } = req.body ?? {};
      if (typeof text !== "string" || text.trim().length < 1 || text.length > 500) {
        return res.status(400).json({ error: "Invalid payload" });
      }
      if (category != null && (typeof category !== "string" || category.length > 40)) {
        return res.status(400).json({ error: "Invalid payload" });
      }

      let resolvedSortOrder = Number.isInteger(sortOrder) ? sortOrder : null;
      if (resolvedSortOrder == null) {
        const maxResult = await pool.query(
          "SELECT COALESCE(MAX(sort_order), -1) AS max_order FROM custom_questions WHERE template_id = $1",
          [req.params.templateId],
        );
        resolvedSortOrder = Number(maxResult.rows[0].max_order) + 1;
      }

      const result = await pool.query(
        `
          INSERT INTO custom_questions (id, template_id, text, category, sort_order)
          VALUES ($1, $2, $3, $4, $5)
          RETURNING *
        `,
        [
          crypto.randomUUID(),
          req.params.templateId,
          text.trim(),
          category?.trim() || null,
          resolvedSortOrder,
        ],
      );
      return res.status(201).json({ question: serializeQuestion(result.rows[0]) });
    } catch (err) {
      if (err?.code === "23505") return res.status(409).json({ error: "Sort order already used" });
      next(err);
    }
  });

  app.patch(
    "/api/templates/:templateId/questions/:questionId",
    requireAuth,
    async (req, res, next) => {
      try {
        const template = await getOwnedTemplate(pool, req.currentUser.id, req.params.templateId);
        if (!template) return res.status(404).json({ error: "Not found" });

        const { text, category, sortOrder, isActive } = req.body ?? {};
        const updates = [];
        const values = [];
        let idx = 1;

        if (text !== undefined) {
          if (typeof text !== "string" || text.trim().length < 1 || text.length > 500) {
            return res.status(400).json({ error: "Invalid payload" });
          }
          updates.push(`text = $${idx++}`);
          values.push(text.trim());
        }
        if (category !== undefined) {
          if (category !== null && (typeof category !== "string" || category.length > 40)) {
            return res.status(400).json({ error: "Invalid payload" });
          }
          updates.push(`category = $${idx++}`);
          values.push(category === null ? null : category.trim());
        }
        if (sortOrder !== undefined) {
          if (!Number.isInteger(sortOrder))
            return res.status(400).json({ error: "Invalid payload" });
          updates.push(`sort_order = $${idx++}`);
          values.push(sortOrder);
        }
        if (isActive !== undefined) {
          if (typeof isActive !== "boolean")
            return res.status(400).json({ error: "Invalid payload" });
          updates.push(`is_active = $${idx++}`);
          values.push(isActive);
        }

        if (updates.length === 0) return res.status(400).json({ error: "Invalid payload" });
        updates.push("updated_at = now()");
        values.push(req.params.questionId, req.params.templateId);

        const result = await pool.query(
          `
          UPDATE custom_questions
          SET ${updates.join(", ")}
          WHERE id = $${idx++} AND template_id = $${idx}
          RETURNING *
        `,
          values,
        );
        if (!result.rows[0]) return res.status(404).json({ error: "Not found" });
        return res.status(200).json({ question: serializeQuestion(result.rows[0]) });
      } catch (err) {
        if (err?.code === "23505")
          return res.status(409).json({ error: "Sort order already used" });
        next(err);
      }
    },
  );

  app.delete(
    "/api/templates/:templateId/questions/:questionId",
    requireAuth,
    async (req, res, next) => {
      try {
        const template = await getOwnedTemplate(pool, req.currentUser.id, req.params.templateId);
        if (!template) return res.status(404).json({ error: "Not found" });

        const result = await pool.query(
          "DELETE FROM custom_questions WHERE id = $1 AND template_id = $2",
          [req.params.questionId, req.params.templateId],
        );
        if (result.rowCount === 0) return res.status(404).json({ error: "Not found" });
        return res.status(204).send();
      } catch (err) {
        next(err);
      }
    },
  );

  app.put("/api/templates/:templateId/questions/reorder", requireAuth, async (req, res, next) => {
    const client = await pool.connect();
    try {
      const template = await getOwnedTemplate(pool, req.currentUser.id, req.params.templateId);
      if (!template) return res.status(404).json({ error: "Not found" });

      const idsInOrder = req.body?.idsInOrder;
      if (!Array.isArray(idsInOrder) || idsInOrder.some((id) => typeof id !== "string")) {
        return res.status(400).json({ error: "Invalid payload" });
      }

      const existingResult = await pool.query(
        "SELECT id FROM custom_questions WHERE template_id = $1 ORDER BY sort_order ASC",
        [req.params.templateId],
      );
      const existingIds = existingResult.rows.map((row) => row.id);
      if (existingIds.length !== idsInOrder.length) {
        return res.status(400).json({ error: "Invalid payload" });
      }
      const existingSet = new Set(existingIds);
      if (idsInOrder.some((id) => !existingSet.has(id))) {
        return res.status(400).json({ error: "Invalid payload" });
      }

      await client.query("BEGIN");
      for (let i = 0; i < idsInOrder.length; i += 1) {
        await client.query(
          `
            UPDATE custom_questions
            SET sort_order = $1, updated_at = now()
            WHERE id = $2 AND template_id = $3
          `,
          [100000 + i, idsInOrder[i], req.params.templateId],
        );
      }
      for (let i = 0; i < idsInOrder.length; i += 1) {
        await client.query(
          `
            UPDATE custom_questions
            SET sort_order = $1, updated_at = now()
            WHERE id = $2 AND template_id = $3
          `,
          [i, idsInOrder[i], req.params.templateId],
        );
      }
      await client.query("COMMIT");

      const result = await pool.query(
        "SELECT * FROM custom_questions WHERE template_id = $1 ORDER BY sort_order ASC",
        [req.params.templateId],
      );
      return res.status(200).json({ items: result.rows.map(serializeQuestion) });
    } catch (err) {
      await client.query("ROLLBACK");
      next(err);
    } finally {
      client.release();
    }
  });

  app.post("/api/templates/:templateId/launch-room", requireAuth, async (req, res, next) => {
    try {
      const template = await getOwnedTemplate(pool, req.currentUser.id, req.params.templateId);
      if (!template) return res.status(404).json({ error: "Not found" });

      const questionsResult = await pool.query(
        `
          SELECT * FROM custom_questions
          WHERE template_id = $1 AND is_active = true
          ORDER BY sort_order ASC, created_at ASC
        `,
        [req.params.templateId],
      );

      const configSnapshot = {
        templateId: template.id,
        templateName: template.name,
        baseConfig: template.base_config || {},
        customQuestions: questionsResult.rows.map(serializeQuestion),
      };
      const code = await generateUniqueRoomCode({ pool, rooms, makeCode, isCodeReserved });
      const roomId = crypto.randomUUID();

      await pool.query(
        `
          INSERT INTO rooms (id, room_code, created_by_user_id, source_template_id, mode, config_snapshot)
          VALUES ($1, $2, $3, $4, 'template', $5::jsonb)
        `,
        [roomId, code, req.currentUser.id, template.id, JSON.stringify(configSnapshot)],
      );

      createRuntimeRoom({
        code,
        configSnapshot,
        mode: "template",
        sourceTemplateId: template.id,
        createdByUserId: req.currentUser.id,
      });

      return res.status(201).json({
        roomId,
        roomCode: code,
        mode: "template",
        sourceTemplateId: template.id,
      });
    } catch (err) {
      next(err);
    }
  });

  app.post("/api/templates/:templateId/launch-poker-room", requireAuth, async (req, res, next) => {
    try {
      const template = await getOwnedTemplate(pool, req.currentUser.id, req.params.templateId);
      if (!template) return res.status(404).json({ error: "Not found" });

      const questionsResult = await pool.query(
        `
          SELECT * FROM custom_questions
          WHERE template_id = $1 AND is_active = true
          ORDER BY sort_order ASC, created_at ASC
        `,
        [req.params.templateId],
      );

      const stories = questionsResult.rows.map((q) => ({
        id: q.id,
        title: q.text,
        description: q.category || null,
      }));

      const voteSystem = template.base_config?.voteSystem || "fibonacci";
      const code = await generateUniqueRoomCode({
        pool,
        rooms,
        makeCode,
        isCodeReserved: (c) => pokerRooms.has(c),
      });
      const roomId = crypto.randomUUID();

      const configSnapshot = {
        templateId: template.id,
        templateName: template.name,
        baseConfig: template.base_config || {},
        preparedStories: stories,
      };

      await pool.query(
        `
          INSERT INTO rooms (id, room_code, created_by_user_id, source_template_id, mode, config_snapshot)
          VALUES ($1, $2, $3, $4, 'template', $5::jsonb)
        `,
        [roomId, code, req.currentUser.id, template.id, JSON.stringify(configSnapshot)],
      );

      createPokerRoom({ code, voteSystem, preparedStories: stories, isPreparedSession: true });

      return res.status(201).json({
        roomId,
        roomCode: code,
        mode: "template",
        sourceTemplateId: template.id,
        voteSystem,
      });
    } catch (err) {
      next(err);
    }
  });

  app.post("/api/rooms/quick", async (req, res, next) => {
    try {
      const { baseConfig } = req.body ?? {};
      if (baseConfig != null && (typeof baseConfig !== "object" || Array.isArray(baseConfig))) {
        return res.status(400).json({ error: "Invalid payload" });
      }
      const code = await generateUniqueRoomCode({ pool, rooms, makeCode, isCodeReserved });
      const roomId = crypto.randomUUID();
      const configSnapshot = {
        baseConfig: baseConfig ?? {},
        customQuestions: [],
      };
      const currentUserId = req.currentUser?.id ?? null;

      await pool.query(
        `
          INSERT INTO rooms (id, room_code, created_by_user_id, source_template_id, mode, config_snapshot)
          VALUES ($1, $2, $3, NULL, 'quick', $4::jsonb)
        `,
        [roomId, code, currentUserId, JSON.stringify(configSnapshot)],
      );

      createRuntimeRoom({
        code,
        configSnapshot,
        mode: "quick",
        sourceTemplateId: null,
        createdByUserId: currentUserId,
      });

      return res.status(201).json({
        roomId,
        roomCode: code,
        mode: "quick",
      });
    } catch (err) {
      next(err);
    }
  });
}
