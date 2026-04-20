export function registerAuthRoutes(context) {
  const {
    app,
    pool,
    authLimiter,
    requireAuth,
    mailTestLimiter,
    isValidEmail,
    BCRYPT_ROUNDS,
    hashToken,
    SESSION_TTL_DAYS,
    getClientIp,
    setSessionCookie,
    canAttemptLogin,
    registerFailedLoginAttempt,
    loginAttempts,
    getResetPasswordBaseUrl,
    sendMail,
    clearSessionCookie,
    testMail,
    crypto,
    bcrypt,
    RESET_TOKEN_TTL_MINUTES,
  } = context;

  app.get("/api/auth/me", (req, res) => {
    if (!req.currentUser) return res.status(401).json({ error: "Unauthorized" });
    return res.status(200).json({
      user: {
        id: req.currentUser.id,
        email: req.currentUser.email,
        displayName: req.currentUser.displayName,
      },
    });
  });

  app.post("/api/auth/register", authLimiter, async (req, res, next) => {
    try {
      const { email, password, displayName } = req.body ?? {};
      if (!isValidEmail(email)) return res.status(400).json({ error: "Invalid payload" });
      if (typeof password !== "string" || password.length < 8 || password.length > 72) {
        return res.status(400).json({ error: "Invalid payload" });
      }
      if (
        typeof displayName !== "string" ||
        displayName.trim().length < 2 ||
        displayName.length > 60
      ) {
        return res.status(400).json({ error: "Invalid payload" });
      }

      const userId = crypto.randomUUID();
      const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
      const normalizedEmail = email.trim().toLowerCase();

      await pool.query(
        `
          INSERT INTO users (id, email, password_hash, display_name)
          VALUES ($1, $2, $3, $4)
        `,
        [userId, normalizedEmail, passwordHash, displayName.trim()],
      );

      const sessionToken = crypto.randomBytes(32).toString("hex");
      const sessionTokenHash = hashToken(sessionToken);
      const sessionExpiresAt = new Date(Date.now() + SESSION_TTL_DAYS * 24 * 60 * 60 * 1000);
      await pool.query(
        `
          INSERT INTO auth_sessions (id, user_id, session_token_hash, user_agent, ip_address, expires_at)
          VALUES ($1, $2, $3, $4, $5::inet, $6)
        `,
        [
          crypto.randomUUID(),
          userId,
          sessionTokenHash,
          req.headers["user-agent"] ?? null,
          getClientIp(req),
          sessionExpiresAt.toISOString(),
        ],
      );

      setSessionCookie(res, sessionToken);
      return res.status(201).json({
        user: { id: userId, email: normalizedEmail, displayName: displayName.trim() },
      });
    } catch (err) {
      if (err?.code === "23505") return res.status(409).json({ error: "Unable to create account" });
      next(err);
    }
  });

  app.post("/api/auth/login", authLimiter, async (req, res, next) => {
    try {
      const { email, password } = req.body ?? {};
      if (!isValidEmail(email) || typeof password !== "string") {
        return res.status(400).json({ error: "Invalid payload" });
      }

      const normalizedEmail = email.trim().toLowerCase();
      const limiterKey = `${getClientIp(req)}:${normalizedEmail}`;
      if (!canAttemptLogin(limiterKey)) {
        return res.status(429).json({ error: "Too many attempts" });
      }

      const result = await pool.query("SELECT * FROM users WHERE email = $1 LIMIT 1", [
        normalizedEmail,
      ]);
      const user = result.rows[0];
      if (!user) {
        registerFailedLoginAttempt(limiterKey);
        return res.status(401).json({ error: "Invalid credentials" });
      }

      const ok = await bcrypt.compare(password, user.password_hash);
      if (!ok) {
        registerFailedLoginAttempt(limiterKey);
        return res.status(401).json({ error: "Invalid credentials" });
      }

      loginAttempts.delete(limiterKey);

      const sessionToken = crypto.randomBytes(32).toString("hex");
      const sessionTokenHash = hashToken(sessionToken);
      const sessionExpiresAt = new Date(Date.now() + SESSION_TTL_DAYS * 24 * 60 * 60 * 1000);
      await pool.query(
        `
          INSERT INTO auth_sessions (id, user_id, session_token_hash, user_agent, ip_address, expires_at)
          VALUES ($1, $2, $3, $4, $5::inet, $6)
        `,
        [
          crypto.randomUUID(),
          user.id,
          sessionTokenHash,
          req.headers["user-agent"] ?? null,
          getClientIp(req),
          sessionExpiresAt.toISOString(),
        ],
      );

      setSessionCookie(res, sessionToken);
      return res.status(200).json({
        user: {
          id: user.id,
          email: user.email,
          displayName: user.display_name,
        },
      });
    } catch (err) {
      next(err);
    }
  });

  app.post("/api/auth/forgot-password", authLimiter, async (req, res, next) => {
    const client = await pool.connect();
    try {
      const email = req.body?.email;
      if (!isValidEmail(email)) {
        return res.status(400).json({ error: "Invalid payload" });
      }

      const normalizedEmail = email.trim().toLowerCase();
      const result = await pool.query(
        "SELECT id, email, display_name FROM users WHERE email = $1 LIMIT 1",
        [normalizedEmail],
      );
      const user = result.rows[0] ?? null;

      // Always return success to avoid account enumeration.
      const genericResponse = {
        ok: true,
        message: "If this account exists, a reset email has been sent.",
      };

      if (!user) return res.status(200).json(genericResponse);

      const resetBaseUrl = getResetPasswordBaseUrl(req);
      const rawToken = crypto.randomBytes(32).toString("hex");
      const tokenHash = hashToken(rawToken);
      const expiresAt = new Date(Date.now() + RESET_TOKEN_TTL_MINUTES * 60 * 1000).toISOString();
      const resetUrl = `${resetBaseUrl}?token=${encodeURIComponent(rawToken)}`;

      await client.query("BEGIN");
      await client.query(
        `
          UPDATE password_reset_tokens
          SET used_at = now()
          WHERE user_id = $1 AND used_at IS NULL
        `,
        [user.id],
      );
      await client.query(
        `
          INSERT INTO password_reset_tokens (id, user_id, token_hash, expires_at)
          VALUES ($1, $2, $3, $4)
        `,
        [crypto.randomUUID(), user.id, tokenHash, expiresAt],
      );
      await client.query("COMMIT");

      try {
        await sendMail({
          to: user.email,
          subject: "Retro Party - Password reset request",
          text: [
            `Hello ${user.display_name || "host"},`,
            "",
            "You requested a password reset for your Retro Party account.",
            `Reset link: ${resetUrl}`,
            "",
            "If you did not request this, you can ignore this email.",
          ].join("\n"),
          html: [
            `<p>Hello ${user.display_name || "host"},</p>`,
            "<p>You requested a password reset for your Retro Party account.</p>",
            `<p><a href="${resetUrl}">Reset your password</a></p>`,
            "<p>If you did not request this, you can ignore this email.</p>",
          ].join(""),
        });
      } catch (mailErr) {
        if (mailErr?.code === "MAIL_NOT_CONFIGURED") {
          // Keep generic response for security and avoid failing the endpoint in local setups.
          return res.status(200).json(genericResponse);
        }
        throw mailErr;
      }

      return res.status(200).json(genericResponse);
    } catch (err) {
      await client.query("ROLLBACK");
      next(err);
    } finally {
      client.release();
    }
  });

  app.post("/api/auth/reset-password", authLimiter, async (req, res, next) => {
    const client = await pool.connect();
    try {
      const token = typeof req.body?.token === "string" ? req.body.token.trim() : "";
      const password = req.body?.password;

      if (!token || typeof password !== "string" || password.length < 8 || password.length > 72) {
        return res.status(400).json({ error: "Invalid payload" });
      }

      await client.query("BEGIN");
      const tokenHash = hashToken(token);
      const tokenResult = await client.query(
        `
          UPDATE password_reset_tokens
          SET used_at = now()
          WHERE token_hash = $1
            AND used_at IS NULL
            AND expires_at > now()
          RETURNING id, user_id
        `,
        [tokenHash],
      );
      const row = tokenResult.rows[0];
      if (!row) {
        await client.query("ROLLBACK");
        return res.status(400).json({ error: "Invalid or expired token" });
      }

      const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);

      await client.query(
        `
          UPDATE users
          SET password_hash = $1, updated_at = now()
          WHERE id = $2
        `,
        [passwordHash, row.user_id],
      );
      await client.query(
        `
          UPDATE auth_sessions
          SET revoked_at = now()
          WHERE user_id = $1 AND revoked_at IS NULL
        `,
        [row.user_id],
      );
      await client.query("COMMIT");

      return res.status(200).json({ ok: true, message: "Password has been reset." });
    } catch (err) {
      await client.query("ROLLBACK");
      next(err);
    } finally {
      client.release();
    }
  });

  app.patch("/api/auth/profile", requireAuth, async (req, res, next) => {
    try {
      const displayName =
        typeof req.body?.displayName === "string" ? req.body.displayName.trim() : "";
      if (displayName.length < 2 || displayName.length > 60) {
        return res.status(400).json({ error: "Invalid payload" });
      }

      const result = await pool.query(
        `
          UPDATE users
          SET display_name = $1, updated_at = now()
          WHERE id = $2
          RETURNING id, email, display_name
        `,
        [displayName, req.currentUser.id],
      );

      const updated = result.rows[0];
      if (!updated) return res.status(404).json({ error: "Not found" });

      return res.status(200).json({
        user: {
          id: updated.id,
          email: updated.email,
          displayName: updated.display_name,
        },
      });
    } catch (err) {
      next(err);
    }
  });

  app.post("/api/auth/change-password", requireAuth, authLimiter, async (req, res, next) => {
    try {
      const currentPassword = req.body?.currentPassword;
      const newPassword = req.body?.newPassword;
      if (
        typeof currentPassword !== "string" ||
        typeof newPassword !== "string" ||
        newPassword.length < 8 ||
        newPassword.length > 72
      ) {
        return res.status(400).json({ error: "Invalid payload" });
      }

      const userResult = await pool.query("SELECT password_hash FROM users WHERE id = $1 LIMIT 1", [
        req.currentUser.id,
      ]);
      const user = userResult.rows[0];
      if (!user) return res.status(404).json({ error: "Not found" });

      const ok = await bcrypt.compare(currentPassword, user.password_hash);
      if (!ok) return res.status(401).json({ error: "Invalid credentials" });

      const passwordHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
      await pool.query(
        `
          UPDATE users
          SET password_hash = $1, updated_at = now()
          WHERE id = $2
        `,
        [passwordHash, req.currentUser.id],
      );
      await pool.query(
        `
          UPDATE auth_sessions
          SET revoked_at = now()
          WHERE user_id = $1
            AND revoked_at IS NULL
            AND ($2::uuid IS NULL OR id <> $2)
        `,
        [req.currentUser.id, req.currentUser.sessionId ?? null],
      );

      return res.status(200).json({ ok: true, message: "Password updated." });
    } catch (err) {
      next(err);
    }
  });

  app.post("/api/auth/logout", async (req, res, next) => {
    try {
      if (req.currentUser?.sessionId) {
        await pool.query("UPDATE auth_sessions SET revoked_at = now() WHERE id = $1", [
          req.currentUser.sessionId,
        ]);
      }
      clearSessionCookie(res);
      return res.status(204).send();
    } catch (err) {
      next(err);
    }
  });

  app.post("/api/mail/test", requireAuth, mailTestLimiter, async (req, res, next) => {
    try {
      const requestedTo = req.body?.to;
      const to =
        typeof requestedTo === "string" && requestedTo.trim()
          ? requestedTo.trim()
          : req.currentUser.email;

      await testMail({ to });
      return res.status(200).json({ ok: true, message: `Test email sent to ${to}` });
    } catch (err) {
      if (err?.code === "MAIL_NOT_CONFIGURED") {
        return res.status(503).json({ error: "Mail service not configured" });
      }
      next(err);
    }
  });
}
