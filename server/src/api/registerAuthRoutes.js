import https from "node:https";

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

  const OAUTH_STATE_TTL_MS = Number(process.env.OAUTH_STATE_TTL_MS || 10 * 60 * 1000);
  const OAUTH_DISCOVERY_CACHE_TTL_MS = Number(
    process.env.OAUTH_DISCOVERY_CACHE_TTL_MS || 60 * 60 * 1000,
  );
  const OAUTH_HTTP_TIMEOUT_MS = Number(process.env.OAUTH_HTTP_TIMEOUT_MS || 15000);
  const oauthStateSecretEnv = process.env.OAUTH_STATE_SECRET?.trim();
  const oauthStateSecret = oauthStateSecretEnv || crypto.randomBytes(32).toString("hex");
  const oauthDiscoveryCache = new Map();
  if (!oauthStateSecretEnv) {
    console.warn("OAUTH_STATE_SECRET is not set. Generated an ephemeral secret for this process.");
  }

  const oauthConfigs = {
    google: {
      provider: "google",
      clientId: process.env.OAUTH_GOOGLE_CLIENT_ID?.trim() || "",
      clientSecret: process.env.OAUTH_GOOGLE_CLIENT_SECRET?.trim() || "",
      discoveryUrl: "https://accounts.google.com/.well-known/openid-configuration",
      scope: "openid email profile",
    },
    microsoft: {
      provider: "microsoft",
      clientId: process.env.OAUTH_MICROSOFT_CLIENT_ID?.trim() || "",
      clientSecret: process.env.OAUTH_MICROSOFT_CLIENT_SECRET?.trim() || "",
      discoveryUrl: `https://login.microsoftonline.com/${
        process.env.OAUTH_MICROSOFT_TENANT_ID?.trim() || "common"
      }/v2.0/.well-known/openid-configuration`,
      scope: "openid profile email",
    },
  };

  const isOauthProviderEnabled = (provider) => {
    const config = oauthConfigs[provider];
    if (!config) return false;
    return Boolean(config.clientId && config.clientSecret);
  };

  const normalizeOauthProvider = (value) => {
    if (typeof value !== "string") return null;
    const normalized = value.trim().toLowerCase();
    if (normalized === "google" || normalized === "microsoft") return normalized;
    return null;
  };

  const normalizeOrigin = (value) => {
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
  };

  const DEFAULT_FRONTEND_ORIGIN = "http://localhost:8088";
  const allowedFrontendOrigins = (() => {
    const rawOrigins = (process.env.ORIGIN || "")
      .split(",")
      .map((entry) => normalizeOrigin(entry))
      .filter(Boolean);
    if (rawOrigins.length === 0) {
      return [DEFAULT_FRONTEND_ORIGIN];
    }
    return Array.from(new Set(rawOrigins));
  })();

  const isAllowedFrontendOrigin = (origin) => allowedFrontendOrigins.includes(origin);

  const resolveFrontendOriginFromRequest = (req) => {
    const queryOrigin = normalizeOrigin(req.query?.origin);
    if (queryOrigin && isAllowedFrontendOrigin(queryOrigin)) return queryOrigin;

    const requestOrigin = normalizeOrigin(req.get("origin"));
    if (requestOrigin && isAllowedFrontendOrigin(requestOrigin)) return requestOrigin;

    const refererRaw = req.get("referer");
    const refererOrigin = normalizeOrigin(typeof refererRaw === "string" ? refererRaw : "");
    if (refererOrigin && isAllowedFrontendOrigin(refererOrigin)) return refererOrigin;

    return allowedFrontendOrigins[0] || DEFAULT_FRONTEND_ORIGIN;
  };

  const resolveFrontendOriginForCallback = (req, statePayload) => {
    const stateOrigin = normalizeOrigin(statePayload?.frontendOrigin);
    if (stateOrigin && isAllowedFrontendOrigin(stateOrigin)) return stateOrigin;
    return resolveFrontendOriginFromRequest(req);
  };

  const normalizeNextPath = (value) => {
    if (typeof value !== "string") return "/";
    const trimmed = value.trim();
    if (!trimmed.startsWith("/") || trimmed.startsWith("//")) return "/";
    try {
      const parsed = new URL(trimmed, "http://localhost");
      return `${parsed.pathname}${parsed.search}${parsed.hash}`;
    } catch {
      return "/";
    }
  };

  const appendQueryToPath = (path, params) => {
    const safePath = normalizeNextPath(path);
    const parsed = new URL(safePath, "http://localhost");
    for (const [key, value] of Object.entries(params)) {
      if (typeof value === "string" && value.trim()) {
        parsed.searchParams.set(key, value.trim());
      }
    }
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  };

  const toFrontendUrl = (frontendOrigin, path) => {
    const safePath = normalizeNextPath(path);
    return new URL(safePath, `${frontendOrigin}/`).toString();
  };

  const normalizeDisplayName = (value, email) => {
    if (typeof value === "string") {
      const trimmed = value.trim().replace(/\s+/g, " ");
      if (trimmed.length >= 2) return trimmed.slice(0, 60);
    }
    if (typeof email === "string") {
      const localPart = email.split("@")[0]?.trim() || "";
      if (localPart.length >= 2) return localPart.slice(0, 60);
    }
    return "Utilisateur";
  };

  const getCallbackBaseUrl = (req) => {
    const explicit = process.env.OAUTH_CALLBACK_BASE_URL?.trim();
    if (explicit) {
      try {
        const parsed = new URL(explicit);
        if (parsed.protocol === "http:" || parsed.protocol === "https:") {
          return `${parsed.protocol}//${parsed.host}`;
        }
      } catch {
        // Ignore invalid explicit callback base URL.
      }
    }

    const forwardedProtoRaw = req.headers["x-forwarded-proto"];
    const forwardedHostRaw = req.headers["x-forwarded-host"];
    const forwardedProto =
      typeof forwardedProtoRaw === "string"
        ? forwardedProtoRaw.split(",")[0].trim().toLowerCase()
        : "";
    const forwardedHost =
      typeof forwardedHostRaw === "string" ? forwardedHostRaw.split(",")[0].trim() : "";
    if ((forwardedProto === "http" || forwardedProto === "https") && forwardedHost) {
      return `${forwardedProto}://${forwardedHost}`;
    }

    const host = req.get("host");
    if (host) {
      const protocol =
        forwardedProto === "http" || forwardedProto === "https"
          ? forwardedProto
          : req.secure
            ? "https"
            : "http";
      return `${protocol}://${host}`;
    }

    return "http://localhost:3001";
  };

  const getOAuthCallbackUrl = (req, provider) =>
    `${getCallbackBaseUrl(req)}/api/auth/oauth/${provider}/callback`;

  const encodeOauthState = (payload) => {
    const body = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
    const signature = crypto
      .createHmac("sha256", oauthStateSecret)
      .update(body)
      .digest("base64url");
    return `${body}.${signature}`;
  };

  const parseOauthState = (rawState, expectedProvider) => {
    if (typeof rawState !== "string" || !rawState) {
      const error = new Error("Invalid state");
      error.code = "invalid_state";
      throw error;
    }
    const parts = rawState.split(".");
    if (parts.length !== 2) {
      const error = new Error("Invalid state");
      error.code = "invalid_state";
      throw error;
    }
    const [body, signature] = parts;
    if (!body || !signature) {
      const error = new Error("Invalid state");
      error.code = "invalid_state";
      throw error;
    }

    const expectedSignature = crypto
      .createHmac("sha256", oauthStateSecret)
      .update(body)
      .digest("base64url");
    const receivedBuffer = Buffer.from(signature);
    const expectedBuffer = Buffer.from(expectedSignature);
    if (
      receivedBuffer.length !== expectedBuffer.length ||
      !crypto.timingSafeEqual(receivedBuffer, expectedBuffer)
    ) {
      const error = new Error("Invalid state");
      error.code = "invalid_state";
      throw error;
    }

    let payload = null;
    try {
      payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
    } catch {
      payload = null;
    }
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
      const error = new Error("Invalid state");
      error.code = "invalid_state";
      throw error;
    }

    const createdAt = Number(payload.createdAt);
    if (!Number.isFinite(createdAt) || Date.now() - createdAt > OAUTH_STATE_TTL_MS) {
      const error = new Error("Expired state");
      error.code = "expired_state";
      throw error;
    }

    if (payload.provider !== expectedProvider) {
      const error = new Error("State provider mismatch");
      error.code = "invalid_state";
      throw error;
    }

    if (
      typeof payload.nonce !== "string" ||
      !payload.nonce ||
      typeof payload.codeVerifier !== "string" ||
      !payload.codeVerifier
    ) {
      const error = new Error("Invalid state");
      error.code = "invalid_state";
      throw error;
    }

    return {
      provider: payload.provider,
      nonce: payload.nonce,
      codeVerifier: payload.codeVerifier,
      nextPath: normalizeNextPath(payload.nextPath),
      frontendOrigin: normalizeOrigin(payload.frontendOrigin),
    };
  };

  const performOauthHttpRequest = ({ url, method = "GET", headers = {}, body = null }) =>
    new Promise((resolve, reject) => {
      let parsedUrl = null;
      try {
        parsedUrl = new URL(url);
      } catch {
        reject(new Error("Invalid OAuth URL"));
        return;
      }
      if (parsedUrl.protocol !== "https:") {
        reject(new Error("OAuth HTTP requests must use HTTPS"));
        return;
      }

      const request = https.request(
        {
          protocol: parsedUrl.protocol,
          hostname: parsedUrl.hostname,
          port: parsedUrl.port || 443,
          path: `${parsedUrl.pathname}${parsedUrl.search}`,
          method,
          headers,
          family: 4,
        },
        (response) => {
          const chunks = [];
          response.on("data", (chunk) => chunks.push(chunk));
          response.on("end", () => {
            const rawBody = Buffer.concat(chunks).toString("utf8");
            resolve({
              ok: response.statusCode >= 200 && response.statusCode < 300,
              status: response.statusCode ?? 0,
              body: rawBody,
            });
          });
        },
      );

      request.setTimeout(OAUTH_HTTP_TIMEOUT_MS, () => {
        request.destroy(new Error("OAuth HTTP request timed out"));
      });
      request.on("error", reject);
      if (typeof body === "string" && body.length > 0) {
        request.write(body);
      }
      request.end();
    });

  const getOAuthDiscovery = async (provider) => {
    const config = oauthConfigs[provider];
    if (!config) throw new Error("Unknown provider");

    const cached = oauthDiscoveryCache.get(provider);
    if (cached && cached.expiresAt > Date.now()) return cached.value;

    const response = await performOauthHttpRequest({ url: config.discoveryUrl });
    if (!response.ok) {
      throw new Error(`Unable to load OAuth discovery for ${provider}`);
    }
    let discovery = null;
    try {
      discovery = JSON.parse(response.body);
    } catch {
      discovery = null;
    }
    if (
      !discovery ||
      typeof discovery.authorization_endpoint !== "string" ||
      typeof discovery.token_endpoint !== "string"
    ) {
      throw new Error(`Invalid OAuth discovery payload for ${provider}`);
    }

    oauthDiscoveryCache.set(provider, {
      value: discovery,
      expiresAt: Date.now() + OAUTH_DISCOVERY_CACHE_TTL_MS,
    });
    return discovery;
  };

  const decodeJwtPayload = (rawToken) => {
    if (typeof rawToken !== "string" || !rawToken) return null;
    const parts = rawToken.split(".");
    if (parts.length < 2) return null;
    try {
      const payloadRaw = Buffer.from(parts[1], "base64url").toString("utf8");
      const payload = JSON.parse(payloadRaw);
      if (!payload || typeof payload !== "object" || Array.isArray(payload)) return null;
      return payload;
    } catch {
      return null;
    }
  };

  const extractOauthProfile = ({ provider, profile }) => {
    if (!profile || typeof profile !== "object" || Array.isArray(profile)) return null;
    const subject = typeof profile.sub === "string" ? profile.sub.trim() : "";
    if (!subject) return null;

    const candidateEmails = [];
    if (typeof profile.email === "string") candidateEmails.push(profile.email);
    if (typeof profile.preferred_username === "string") {
      candidateEmails.push(profile.preferred_username);
    }
    if (Array.isArray(profile.emails)) {
      for (const value of profile.emails) {
        if (typeof value === "string") candidateEmails.push(value);
      }
    }
    const email = candidateEmails
      .map((value) => value.trim().toLowerCase())
      .find((value) => isValidEmail(value));
    if (!email) return null;

    if (provider === "google" && profile.email_verified === false) {
      return null;
    }

    const displayName = normalizeDisplayName(
      typeof profile.name === "string" ? profile.name : profile.given_name,
      email,
    );
    return { subject, email, displayName };
  };

  const mapOauthErrorReason = (reason) => {
    switch (reason) {
      case "provider_not_configured":
      case "provider_not_supported":
      case "access_denied":
      case "flow_expired":
      case "invalid_state":
      case "missing_code":
      case "missing_profile":
      case "missing_email":
        return reason;
      default:
        return "oauth_failed";
    }
  };

  const buildOauthErrorRedirect = (frontendOrigin, path, reason) => {
    const pathWithQuery = appendQueryToPath(path, {
      auth: "oauth_error",
      reason: mapOauthErrorReason(reason),
    });
    return toFrontendUrl(frontendOrigin, pathWithQuery);
  };

  const createUserSession = async (userId, req) => {
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
    return sessionToken;
  };

  const resolveUserForOauthProfile = async ({ provider, subject, email, displayName }) => {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      let userResult = await client.query(
        `
          SELECT u.id, u.email, u.display_name
          FROM oauth_identities oi
          JOIN users u ON u.id = oi.user_id
          WHERE oi.provider = $1 AND oi.provider_subject = $2
          LIMIT 1
        `,
        [provider, subject],
      );

      let user = userResult.rows[0] ?? null;

      if (!user) {
        const byEmailResult = await client.query(
          `
            SELECT id, email, display_name
            FROM users
            WHERE email = $1
            LIMIT 1
          `,
          [email],
        );
        user = byEmailResult.rows[0] ?? null;

        if (!user) {
          const passwordPlaceholder = crypto.randomBytes(48).toString("base64url");
          const passwordHash = await bcrypt.hash(passwordPlaceholder, BCRYPT_ROUNDS);
          const inserted = await client.query(
            `
              INSERT INTO users (id, email, password_hash, display_name)
              VALUES ($1, $2, $3, $4)
              RETURNING id, email, display_name
            `,
            [crypto.randomUUID(), email, passwordHash, displayName],
          );
          user = inserted.rows[0];
        }

        await client.query(
          `
            INSERT INTO oauth_identities (id, user_id, provider, provider_subject, email)
            VALUES ($1, $2, $3, $4, $5)
            ON CONFLICT (provider, provider_subject) DO NOTHING
          `,
          [crypto.randomUUID(), user.id, provider, subject, email],
        );

        userResult = await client.query(
          `
            SELECT u.id, u.email, u.display_name
            FROM oauth_identities oi
            JOIN users u ON u.id = oi.user_id
            WHERE oi.provider = $1 AND oi.provider_subject = $2
            LIMIT 1
          `,
          [provider, subject],
        );
        user = userResult.rows[0] ?? user;
      }

      await client.query(
        `
          UPDATE oauth_identities
          SET email = $1, updated_at = now()
          WHERE provider = $2 AND provider_subject = $3
        `,
        [email, provider, subject],
      );

      await client.query("COMMIT");
      return user;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  };

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

  app.get("/api/auth/oauth/providers", (_req, res) => {
    return res.status(200).json({
      providers: {
        google: isOauthProviderEnabled("google"),
        microsoft: isOauthProviderEnabled("microsoft"),
      },
    });
  });

  app.get("/api/auth/oauth/:provider/start", authLimiter, async (req, res) => {
    const frontendOrigin = resolveFrontendOriginFromRequest(req);
    const provider = normalizeOauthProvider(req.params.provider);
    try {
      if (!provider) {
        return res.redirect(
          302,
          buildOauthErrorRedirect(frontendOrigin, "/", "provider_not_supported"),
        );
      }
      if (!isOauthProviderEnabled(provider)) {
        return res.redirect(
          302,
          buildOauthErrorRedirect(frontendOrigin, "/", "provider_not_configured"),
        );
      }

      const config = oauthConfigs[provider];
      const discovery = await getOAuthDiscovery(provider);
      const callbackUrl = getOAuthCallbackUrl(req, provider);
      const nextPath = normalizeNextPath(req.query?.next);
      const nonce = crypto.randomBytes(18).toString("base64url");
      const codeVerifier = crypto.randomBytes(48).toString("base64url");
      const codeChallenge = crypto.createHash("sha256").update(codeVerifier).digest("base64url");
      const state = encodeOauthState({
        provider,
        nextPath,
        frontendOrigin,
        nonce,
        codeVerifier,
        createdAt: Date.now(),
      });

      const search = new URLSearchParams({
        client_id: config.clientId,
        response_type: "code",
        redirect_uri: callbackUrl,
        scope: config.scope,
        state,
        nonce,
        code_challenge: codeChallenge,
        code_challenge_method: "S256",
      });

      const redirectUrl = `${discovery.authorization_endpoint}?${search.toString()}`;
      return res.redirect(302, redirectUrl);
    } catch (error) {
      console.error(`[oauth/start/${provider ?? "unknown"}]`, error);
      return res.redirect(302, buildOauthErrorRedirect(frontendOrigin, "/", "oauth_failed"));
    }
  });

  app.get("/api/auth/oauth/:provider/callback", authLimiter, async (req, res) => {
    const fallbackFrontendOrigin = resolveFrontendOriginFromRequest(req);
    const provider = normalizeOauthProvider(req.params.provider);
    try {
      if (!provider) {
        return res.redirect(
          302,
          buildOauthErrorRedirect(fallbackFrontendOrigin, "/", "provider_not_supported"),
        );
      }
      if (!isOauthProviderEnabled(provider)) {
        return res.redirect(
          302,
          buildOauthErrorRedirect(fallbackFrontendOrigin, "/", "provider_not_configured"),
        );
      }

      const config = oauthConfigs[provider];
      const providerError = typeof req.query?.error === "string" ? req.query.error.trim() : "";
      const code = typeof req.query?.code === "string" ? req.query.code.trim() : "";
      const rawState = typeof req.query?.state === "string" ? req.query.state.trim() : "";

      let statePayload = null;
      let stateErrorCode = null;
      try {
        statePayload = parseOauthState(rawState, provider);
      } catch (error) {
        stateErrorCode = error?.code || "invalid_state";
      }

      const nextPath = statePayload?.nextPath ?? "/";
      const frontendOrigin = resolveFrontendOriginForCallback(req, statePayload);

      if (providerError) {
        const reason =
          providerError === "access_denied" || providerError === "interaction_required"
            ? "access_denied"
            : "oauth_failed";
        return res.redirect(302, buildOauthErrorRedirect(frontendOrigin, "/", reason));
      }

      if (!statePayload) {
        const reason = stateErrorCode === "expired_state" ? "flow_expired" : "invalid_state";
        return res.redirect(302, buildOauthErrorRedirect(frontendOrigin, "/", reason));
      }

      if (!code) {
        return res.redirect(302, buildOauthErrorRedirect(frontendOrigin, "/", "missing_code"));
      }

      const discovery = await getOAuthDiscovery(provider);
      const callbackUrl = getOAuthCallbackUrl(req, provider);

      const tokenRequestBody = new URLSearchParams({
        client_id: config.clientId,
        client_secret: config.clientSecret,
        grant_type: "authorization_code",
        code,
        redirect_uri: callbackUrl,
        code_verifier: statePayload.codeVerifier,
      }).toString();
      const tokenResponse = await performOauthHttpRequest({
        url: discovery.token_endpoint,
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "Content-Length": Buffer.byteLength(tokenRequestBody).toString(),
        },
        body: tokenRequestBody,
      });

      if (!tokenResponse.ok) {
        return res.redirect(302, buildOauthErrorRedirect(frontendOrigin, "/", "oauth_failed"));
      }

      let tokenPayload = null;
      try {
        tokenPayload = JSON.parse(tokenResponse.body);
      } catch {
        tokenPayload = null;
      }
      if (!tokenPayload || typeof tokenPayload !== "object") {
        return res.redirect(302, buildOauthErrorRedirect(frontendOrigin, "/", "oauth_failed"));
      }

      let profile = null;
      if (
        typeof discovery.userinfo_endpoint === "string" &&
        typeof tokenPayload.access_token === "string" &&
        tokenPayload.access_token
      ) {
        const userInfoResponse = await performOauthHttpRequest({
          url: discovery.userinfo_endpoint,
          headers: { Authorization: `Bearer ${tokenPayload.access_token}` },
        });
        if (userInfoResponse.ok) {
          try {
            profile = JSON.parse(userInfoResponse.body);
          } catch {
            profile = null;
          }
        }
      }

      if (!profile && typeof tokenPayload.id_token === "string") {
        profile = decodeJwtPayload(tokenPayload.id_token);
      }
      if (!profile || typeof profile !== "object" || Array.isArray(profile)) {
        return res.redirect(302, buildOauthErrorRedirect(frontendOrigin, "/", "missing_profile"));
      }

      if (typeof profile.nonce === "string" && profile.nonce !== statePayload.nonce) {
        return res.redirect(302, buildOauthErrorRedirect(frontendOrigin, "/", "invalid_state"));
      }

      const oauthProfile = extractOauthProfile({ provider, profile });
      if (!oauthProfile) {
        const candidateEmail =
          typeof profile.email === "string"
            ? profile.email
            : typeof profile.preferred_username === "string"
              ? profile.preferred_username
              : "";
        const reason = candidateEmail ? "missing_profile" : "missing_email";
        return res.redirect(302, buildOauthErrorRedirect(frontendOrigin, "/", reason));
      }

      const user = await resolveUserForOauthProfile({
        provider,
        subject: oauthProfile.subject,
        email: oauthProfile.email,
        displayName: oauthProfile.displayName,
      });

      const sessionToken = await createUserSession(user.id, req);
      setSessionCookie(res, sessionToken);
      return res.redirect(302, toFrontendUrl(frontendOrigin, nextPath));
    } catch (error) {
      console.error(`[oauth/callback/${provider ?? "unknown"}]`, error);
      return res.redirect(
        302,
        buildOauthErrorRedirect(fallbackFrontendOrigin, "/", "oauth_failed"),
      );
    }
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
