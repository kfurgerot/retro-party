import bcrypt from "bcryptjs";
import crypto from "node:crypto";
import rateLimit, { ipKeyGenerator } from "express-rate-limit";
import { QUESTIONS } from "./questions.js";
import { testMail } from "./mailService.js";
import { sendMail } from "./mailService.js";
import { RADAR_QUESTIONS } from "./radarPartyQuestions.js";
import {
  buildIndividualInsights,
  buildTeamInsights,
  computeRadarScores,
  computeTeamAverageRadar,
} from "./radarPartyEngine.js";

const SESSION_COOKIE_NAME = process.env.SESSION_COOKIE_NAME || "rp_session";
const SESSION_TTL_DAYS = Number(process.env.SESSION_TTL_DAYS || 7);
const BCRYPT_ROUNDS = Number(process.env.BCRYPT_ROUNDS || 12);
const LOGIN_RATE_LIMIT_WINDOW_MS = Number(process.env.LOGIN_RATE_LIMIT_WINDOW_MS || 15 * 60 * 1000);
const LOGIN_RATE_LIMIT_MAX = Number(process.env.LOGIN_RATE_LIMIT_MAX || 10);
const RESET_TOKEN_TTL_MINUTES = Number(process.env.RESET_TOKEN_TTL_MINUTES || 60);
const API_RATE_LIMIT_WINDOW_MS = Number(process.env.API_RATE_LIMIT_WINDOW_MS || 60 * 1000);
const API_RATE_LIMIT_MAX = Number(process.env.API_RATE_LIMIT_MAX || 300);
const AUTH_RATE_LIMIT_WINDOW_MS = Number(process.env.AUTH_RATE_LIMIT_WINDOW_MS || 15 * 60 * 1000);
const AUTH_RATE_LIMIT_MAX = Number(process.env.AUTH_RATE_LIMIT_MAX || 30);
const MAIL_TEST_RATE_LIMIT_WINDOW_MS = Number(process.env.MAIL_TEST_RATE_LIMIT_WINDOW_MS || 10 * 60 * 1000);
const MAIL_TEST_RATE_LIMIT_MAX = Number(process.env.MAIL_TEST_RATE_LIMIT_MAX || 5);

const loginAttempts = new Map();

function parseCookies(cookieHeader) {
  if (!cookieHeader) return {};
  return cookieHeader.split(";").reduce((acc, chunk) => {
    const [rawName, ...rest] = chunk.trim().split("=");
    if (!rawName) return acc;
    acc[rawName] = decodeURIComponent(rest.join("="));
    return acc;
  }, {});
}

function hashToken(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

function isValidEmail(value) {
  if (typeof value !== "string") return false;
  const email = value.trim();
  if (!email || email.length > 254) return false;
  if (email.includes(" ")) return false;

  const atIndex = email.indexOf("@");
  if (atIndex <= 0 || atIndex !== email.lastIndexOf("@")) return false;

  const localPart = email.slice(0, atIndex);
  const domainPart = email.slice(atIndex + 1);
  if (!localPart || !domainPart) return false;
  if (domainPart.startsWith(".") || domainPart.endsWith(".")) return false;
  if (!domainPart.includes(".")) return false;
  if (domainPart.includes("..")) return false;

  return true;
}

function normalizeOrigin(value) {
  if (typeof value !== "string") return null;
  const raw = value.trim();
  if (!raw) return null;
  try {
    const parsed = new URL(raw);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
    return parsed.origin;
  } catch {
    return null;
  }
}

function getResetPasswordBaseUrl(req) {
  const explicitBase = process.env.RESET_PASSWORD_URL_BASE?.trim();
  if (explicitBase) return explicitBase;

  const requestOrigin = normalizeOrigin(req.get("origin"));
  if (requestOrigin) return `${requestOrigin}/reset-password`;

  const envOrigin = normalizeOrigin(process.env.ORIGIN);
  if (envOrigin) return `${envOrigin}/reset-password`;

  const forwardedProtoHeader = req.headers["x-forwarded-proto"];
  const forwardedHostHeader = req.headers["x-forwarded-host"] ?? req.headers.host;
  const forwardedProto =
    typeof forwardedProtoHeader === "string"
      ? forwardedProtoHeader.split(",")[0].trim().toLowerCase()
      : "";
  const forwardedHost =
    typeof forwardedHostHeader === "string"
      ? forwardedHostHeader.split(",")[0].trim()
      : "";

  if ((forwardedProto === "http" || forwardedProto === "https") && forwardedHost) {
    return `${forwardedProto}://${forwardedHost}/reset-password`;
  }

  return "http://localhost:8088/reset-password";
}

function getClientIp(req) {
  const forwardedFor = req.headers["x-forwarded-for"];
  if (typeof forwardedFor === "string" && forwardedFor.length > 0) {
    return forwardedFor.split(",")[0].trim();
  }
  return req.socket?.remoteAddress || null;
}

function setSessionCookie(res, token) {
  const secure = process.env.NODE_ENV === "production";
  const maxAge = SESSION_TTL_DAYS * 24 * 60 * 60;
  const parts = [
    `${SESSION_COOKIE_NAME}=${encodeURIComponent(token)}`,
    "Path=/",
    `Max-Age=${maxAge}`,
    "HttpOnly",
    "SameSite=Lax",
  ];
  if (secure) parts.push("Secure");
  res.setHeader("Set-Cookie", parts.join("; "));
}

function clearSessionCookie(res) {
  const secure = process.env.NODE_ENV === "production";
  const parts = [
    `${SESSION_COOKIE_NAME}=`,
    "Path=/",
    "Max-Age=0",
    "HttpOnly",
    "SameSite=Lax",
  ];
  if (secure) parts.push("Secure");
  res.setHeader("Set-Cookie", parts.join("; "));
}

function cleanupRateLimitBucket(bucket, now) {
  const kept = bucket.filter((ts) => now - ts < LOGIN_RATE_LIMIT_WINDOW_MS);
  return kept;
}

function registerFailedLoginAttempt(key) {
  const now = Date.now();
  const current = cleanupRateLimitBucket(loginAttempts.get(key) ?? [], now);
  current.push(now);
  loginAttempts.set(key, current);
  return current.length;
}

function canAttemptLogin(key) {
  const now = Date.now();
  const current = cleanupRateLimitBucket(loginAttempts.get(key) ?? [], now);
  loginAttempts.set(key, current);
  return current.length < LOGIN_RATE_LIMIT_MAX;
}

async function generateUniqueRoomCode({ pool, rooms, makeCode, isCodeReserved }) {
  for (let i = 0; i < 30; i += 1) {
    const code = makeCode();
    if (rooms.has(code)) continue;
    if (typeof isCodeReserved === "function" && isCodeReserved(code)) continue;
    const existing = await pool.query("SELECT 1 FROM rooms WHERE room_code = $1 LIMIT 1", [code]);
    if (existing.rowCount === 0) return code;
  }
  throw new Error("Unable to generate room code");
}

async function getUserFromRequest(req, pool) {
  const cookies = parseCookies(req.headers.cookie);
  const rawToken = cookies[SESSION_COOKIE_NAME];
  if (!rawToken) return null;

  const tokenHash = hashToken(rawToken);
  const result = await pool.query(
    `
      SELECT u.id, u.email, u.display_name, s.id AS session_id
      FROM auth_sessions s
      JOIN users u ON u.id = s.user_id
      WHERE s.session_token_hash = $1
        AND s.revoked_at IS NULL
        AND s.expires_at > now()
      LIMIT 1
    `,
    [tokenHash]
  );

  if (!result.rows[0]) return null;

  return {
    id: result.rows[0].id,
    email: result.rows[0].email,
    displayName: result.rows[0].display_name,
    sessionId: result.rows[0].session_id,
    tokenHash,
  };
}

function serializeTemplate(row) {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    baseConfig: row.base_config || {},
    isArchived: row.is_archived,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function serializeQuestion(row) {
  return {
    id: row.id,
    text: row.text,
    category: row.category,
    sortOrder: row.sort_order,
    isActive: row.is_active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function getDefaultTemplateQuestions() {
  const categoryOrder = ["blue", "green", "red", "violet", "bonus"];
  const items = [];
  let sortOrder = 0;
  for (const category of categoryOrder) {
    const list = Array.isArray(QUESTIONS[category]) ? QUESTIONS[category] : [];
    for (const text of list) {
      if (typeof text !== "string" || !text.trim()) continue;
      items.push({
        id: crypto.randomUUID(),
        category,
        text: text.trim(),
        sortOrder,
      });
      sortOrder += 1;
    }
  }
  return items;
}

async function getOwnedTemplate(pool, userId, templateId) {
  const result = await pool.query(
    "SELECT * FROM game_templates WHERE id = $1 AND user_id = $2 LIMIT 1",
    [templateId, userId]
  );
  return result.rows[0] ?? null;
}

function serializeRadarParticipant(row) {
  return {
    id: row.id,
    displayName: row.display_name,
    avatar: Number.isFinite(Number(row.avatar)) ? Number(row.avatar) : 0,
    isHost: !!row.is_host,
    createdAt: row.created_at,
  };
}

function normalizeRadarAnswers(payload) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return null;
  const answers = {};
  for (const question of RADAR_QUESTIONS) {
    const raw = payload[String(question.id)] ?? payload[question.id];
    const value = Number(raw);
    if (!Number.isFinite(value)) return null;
    const rounded = Math.round(value);
    if (rounded < 1 || rounded > 5) return null;
    answers[String(question.id)] = rounded;
  }
  return answers;
}

function toJson(value) {
  return JSON.stringify(value ?? {});
}

export function registerApiRoutes({ app, pool, rooms, createRuntimeRoom, makeCode, isCodeReserved }) {
  app.use("/api", async (req, res, next) => {
    try {
      req.currentUser = await getUserFromRequest(req, pool);
      next();
    } catch (err) {
      next(err);
    }
  });

  const apiLimiter = rateLimit({
    windowMs: API_RATE_LIMIT_WINDOW_MS,
    max: API_RATE_LIMIT_MAX,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => ipKeyGenerator(getClientIp(req) || req.ip || ""),
    message: { error: "Too many requests" },
  });

  const authLimiter = rateLimit({
    windowMs: AUTH_RATE_LIMIT_WINDOW_MS,
    max: AUTH_RATE_LIMIT_MAX,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => ipKeyGenerator(getClientIp(req) || req.ip || ""),
    message: { error: "Too many requests" },
  });

  const mailTestLimiter = rateLimit({
    windowMs: MAIL_TEST_RATE_LIMIT_WINDOW_MS,
    max: MAIL_TEST_RATE_LIMIT_MAX,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => req.currentUser?.id || ipKeyGenerator(getClientIp(req) || req.ip || ""),
    message: { error: "Too many requests" },
  });

  app.use("/api", apiLimiter);

  function requireAuth(req, res, next) {
    if (!req.currentUser) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    next();
  }

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
      if (typeof displayName !== "string" || displayName.trim().length < 2 || displayName.length > 60) {
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
        [userId, normalizedEmail, passwordHash, displayName.trim()]
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
        ]
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

      const result = await pool.query("SELECT * FROM users WHERE email = $1 LIMIT 1", [normalizedEmail]);
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
        ]
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
        [normalizedEmail]
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
        [user.id]
      );
      await client.query(
        `
          INSERT INTO password_reset_tokens (id, user_id, token_hash, expires_at)
          VALUES ($1, $2, $3, $4)
        `,
        [crypto.randomUUID(), user.id, tokenHash, expiresAt]
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
        [tokenHash]
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
        [passwordHash, row.user_id]
      );
      await client.query(
        `
          UPDATE auth_sessions
          SET revoked_at = now()
          WHERE user_id = $1 AND revoked_at IS NULL
        `,
        [row.user_id]
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

  app.post("/api/auth/logout", async (req, res, next) => {
    try {
      if (req.currentUser?.sessionId) {
        await pool.query("UPDATE auth_sessions SET revoked_at = now() WHERE id = $1", [req.currentUser.sessionId]);
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

  app.get("/api/templates", requireAuth, async (req, res, next) => {
    try {
      const result = await pool.query(
        `
          SELECT * FROM game_templates
          WHERE user_id = $1
          ORDER BY updated_at DESC
        `,
        [req.currentUser.id]
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
        ]
      );
      const seedQuestions = getDefaultTemplateQuestions();
      for (const question of seedQuestions) {
        await client.query(
          `
            INSERT INTO custom_questions (id, template_id, text, category, sort_order, is_active)
            VALUES ($1, $2, $3, $4, $5, true)
          `,
          [question.id, templateId, question.text, question.category, question.sortOrder]
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
        if (typeof isArchived !== "boolean") return res.status(400).json({ error: "Invalid payload" });
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
        values
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
        [req.params.templateId]
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
          [req.params.templateId]
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
        ]
      );
      return res.status(201).json({ question: serializeQuestion(result.rows[0]) });
    } catch (err) {
      if (err?.code === "23505") return res.status(409).json({ error: "Sort order already used" });
      next(err);
    }
  });

  app.patch("/api/templates/:templateId/questions/:questionId", requireAuth, async (req, res, next) => {
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
        if (!Number.isInteger(sortOrder)) return res.status(400).json({ error: "Invalid payload" });
        updates.push(`sort_order = $${idx++}`);
        values.push(sortOrder);
      }
      if (isActive !== undefined) {
        if (typeof isActive !== "boolean") return res.status(400).json({ error: "Invalid payload" });
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
        values
      );
      if (!result.rows[0]) return res.status(404).json({ error: "Not found" });
      return res.status(200).json({ question: serializeQuestion(result.rows[0]) });
    } catch (err) {
      if (err?.code === "23505") return res.status(409).json({ error: "Sort order already used" });
      next(err);
    }
  });

  app.delete("/api/templates/:templateId/questions/:questionId", requireAuth, async (req, res, next) => {
    try {
      const template = await getOwnedTemplate(pool, req.currentUser.id, req.params.templateId);
      if (!template) return res.status(404).json({ error: "Not found" });

      const result = await pool.query(
        "DELETE FROM custom_questions WHERE id = $1 AND template_id = $2",
        [req.params.questionId, req.params.templateId]
      );
      if (result.rowCount === 0) return res.status(404).json({ error: "Not found" });
      return res.status(204).send();
    } catch (err) {
      next(err);
    }
  });

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
        [req.params.templateId]
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
          [100000 + i, idsInOrder[i], req.params.templateId]
        );
      }
      for (let i = 0; i < idsInOrder.length; i += 1) {
        await client.query(
          `
            UPDATE custom_questions
            SET sort_order = $1, updated_at = now()
            WHERE id = $2 AND template_id = $3
          `,
          [i, idsInOrder[i], req.params.templateId]
        );
      }
      await client.query("COMMIT");

      const result = await pool.query(
        "SELECT * FROM custom_questions WHERE template_id = $1 ORDER BY sort_order ASC",
        [req.params.templateId]
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
        [req.params.templateId]
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
        [roomId, code, req.currentUser.id, template.id, JSON.stringify(configSnapshot)]
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
        [roomId, code, currentUserId, JSON.stringify(configSnapshot)]
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

  app.get("/api/radar/questions", (_req, res) => {
    return res.status(200).json({ items: RADAR_QUESTIONS });
  });

  app.post("/api/radar/sessions", async (req, res, next) => {
    try {
      const title = typeof req.body?.title === "string" ? req.body.title.trim().slice(0, 120) : "";
      const facilitatorName =
        typeof req.body?.facilitatorName === "string" ? req.body.facilitatorName.trim().slice(0, 80) : "";
      const code = await generateUniqueRoomCode({ pool, rooms, makeCode, isCodeReserved });
      const sessionId = crypto.randomUUID();

      await pool.query(
        `
          INSERT INTO radar_sessions (id, session_code, title, facilitator_name, created_by_user_id)
          VALUES ($1, $2, $3, $4, $5)
        `,
        [sessionId, code, title || null, facilitatorName || null, req.currentUser?.id ?? null]
      );

      return res.status(201).json({
        session: {
          id: sessionId,
          code,
          title: title || null,
          facilitatorName: facilitatorName || null,
        },
      });
    } catch (err) {
      next(err);
    }
  });

  app.post("/api/radar/sessions/:code/participants", async (req, res, next) => {
    try {
      const code = String(req.params.code || "").trim().toUpperCase();
      const displayName =
        typeof req.body?.displayName === "string" ? req.body.displayName.trim().slice(0, 80) : "";
      const avatarRaw = Number(req.body?.avatar);
      const avatar = Number.isFinite(avatarRaw) ? Math.max(0, Math.min(30, Math.round(avatarRaw))) : 0;
      if (displayName.length < 2) return res.status(400).json({ error: "Invalid payload" });

      const sessionResult = await pool.query(
        "SELECT id, session_code, title, facilitator_name, created_at FROM radar_sessions WHERE session_code = $1 LIMIT 1",
        [code]
      );
      const session = sessionResult.rows[0];
      if (!session) return res.status(404).json({ error: "Not found" });

      const hostCountResult = await pool.query(
        "SELECT COUNT(*)::int AS count FROM radar_participants WHERE session_id = $1 AND is_host = true",
        [session.id]
      );
      const shouldBeHost = Number(hostCountResult.rows[0]?.count ?? 0) === 0;

      const participantId = crypto.randomUUID();
      const participantResult = await pool.query(
        `
          INSERT INTO radar_participants (id, session_id, display_name, avatar, is_host)
          VALUES ($1, $2, $3, $4, $5)
          RETURNING *
        `,
        [participantId, session.id, displayName, avatar, shouldBeHost]
      );

      return res.status(201).json({
        session: {
          id: session.id,
          code: session.session_code,
          title: session.title,
          facilitatorName: session.facilitator_name,
          createdAt: session.created_at,
        },
        participant: serializeRadarParticipant(participantResult.rows[0]),
      });
    } catch (err) {
      next(err);
    }
  });

  app.post("/api/radar/sessions/:code/submissions", async (req, res, next) => {
    const client = await pool.connect();
    try {
      const code = String(req.params.code || "").trim().toUpperCase();
      const participantId = typeof req.body?.participantId === "string" ? req.body.participantId : "";
      const answers = normalizeRadarAnswers(req.body?.answers);
      if (!participantId || !answers) return res.status(400).json({ error: "Invalid payload" });

      const sessionResult = await client.query(
        "SELECT id, session_code FROM radar_sessions WHERE session_code = $1 LIMIT 1",
        [code]
      );
      const session = sessionResult.rows[0];
      if (!session) return res.status(404).json({ error: "Not found" });

      const participantResult = await client.query(
        "SELECT * FROM radar_participants WHERE id = $1 AND session_id = $2 LIMIT 1",
        [participantId, session.id]
      );
      const participant = participantResult.rows[0];
      if (!participant) return res.status(404).json({ error: "Not found" });

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
        ]
      );

      const allResponsesResult = await client.query(
        "SELECT radar FROM radar_responses WHERE session_id = $1 ORDER BY updated_at ASC",
        [session.id]
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
        [session.id, memberRadars.length, toJson(teamRadar), toJson(teamInsights)]
      );
      await client.query("COMMIT");

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
      const code = String(req.params.code || "").trim().toUpperCase();
      const sessionResult = await pool.query(
        "SELECT id, session_code, title, facilitator_name, created_at FROM radar_sessions WHERE session_code = $1 LIMIT 1",
        [code]
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
        [session.id]
      );

      const teamResult = await pool.query(
        "SELECT member_count, radar, insight, updated_at FROM radar_team_results WHERE session_id = $1 LIMIT 1",
        [session.id]
      );
      const team = teamResult.rows[0];

      return res.status(200).json({
        session: {
          id: session.id,
          code: session.session_code,
          title: session.title,
          facilitatorName: session.facilitator_name,
          createdAt: session.created_at,
        },
        participants: participantsResult.rows.map((row) => ({
          id: row.id,
          displayName: row.display_name,
          avatar: Number.isFinite(Number(row.avatar)) ? Number(row.avatar) : 0,
          isHost: !!row.is_host,
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

  app.use("/api", (err, _req, res, _next) => {
    console.error(err);
    return res.status(500).json({ error: "Internal server error" });
  });
}
