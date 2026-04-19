import bcrypt from "bcryptjs";
import crypto from "node:crypto";
import rateLimit, { ipKeyGenerator } from "express-rate-limit";
import { QUESTIONS } from "../../questions.js";
import { testMail } from "../../mailService.js";
import { sendMail } from "../../mailService.js";
import { RADAR_QUESTIONS } from "../../radarPartyQuestions.js";
import {
  buildIndividualInsights,
  buildTeamInsights,
  computeRadarScores,
  computeTeamAverageRadar,
} from "../../radarPartyEngine.js";

import { registerAuthRoutes } from "./registerAuthRoutes.js";
import { registerTemplateRoutes } from "./registerTemplateRoutes.js";
import { registerRadarRoutes } from "./registerRadarRoutes.js";
import { S2C_EVENTS } from "../../../shared/contracts/socketEvents.js";
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
const MAIL_TEST_RATE_LIMIT_WINDOW_MS = Number(
  process.env.MAIL_TEST_RATE_LIMIT_WINDOW_MS || 10 * 60 * 1000,
);
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
    typeof forwardedHostHeader === "string" ? forwardedHostHeader.split(",")[0].trim() : "";

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
  const parts = [`${SESSION_COOKIE_NAME}=`, "Path=/", "Max-Age=0", "HttpOnly", "SameSite=Lax"];
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
    [tokenHash],
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
    [templateId, userId],
  );
  return result.rows[0] ?? null;
}

function serializeRadarParticipant(row) {
  const progressAnsweredRaw = Number(row.progress_answered);
  const progressTotalRaw = Number(row.progress_total);
  const progressAnswered = Number.isFinite(progressAnsweredRaw)
    ? Math.max(0, Math.round(progressAnsweredRaw))
    : 0;
  const progressTotal = Number.isFinite(progressTotalRaw)
    ? Math.max(1, Math.round(progressTotalRaw))
    : RADAR_QUESTIONS.length;
  const progressPct = Math.max(
    0,
    Math.min(100, Math.round((progressAnswered / progressTotal) * 100)),
  );
  return {
    id: row.id,
    displayName: row.display_name,
    avatar: Number.isFinite(Number(row.avatar)) ? Number(row.avatar) : 0,
    isHost: !!row.is_host,
    progressAnswered,
    progressTotal,
    progressPct,
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

export function registerApiRoutes({
  app,
  pool,
  rooms,
  createRuntimeRoom,
  makeCode,
  isCodeReserved,
  io,
}) {
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

  function emitRadarSessionUpdate(rawCode, reason) {
    if (!io) return;
    const code = typeof rawCode === "string" ? rawCode.trim().toUpperCase() : "";
    if (!code) return;
    io.to(`radar:${code}`).emit(S2C_EVENTS.RADAR_SESSION_UPDATE, {
      code,
      reason,
      at: Date.now(),
    });
  }

  registerAuthRoutes({
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
  });

  registerTemplateRoutes({
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
  });

  registerRadarRoutes({
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
  });

  app.use("/api", (err, _req, res, _next) => {
    console.error(err);
    return res.status(500).json({ error: "Internal server error" });
  });
}
