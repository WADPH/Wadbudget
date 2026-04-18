import crypto from "crypto";
import path from "path";
import { fileURLToPath } from "url";
import express from "express";
import session from "express-session";
import { OAuth2Client } from "google-auth-library";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const publicDir = path.join(__dirname, "../public");

function getEnv(...names) {
  for (const name of names) {
    const value = process.env[name];
    if (value && String(value).trim()) return String(value).trim();
  }
  return "";
}

function parseAllowedUsers(raw) {
  return new Set(
    String(raw || "")
      .split(",")
      .map((v) => v.trim().toLowerCase())
      .filter(Boolean)
  );
}

function buildBaseUrl(req) {
  if (process.env.BASE_URL) return process.env.BASE_URL.trim().replace(/\/+$/, "");
  return `${req.protocol}://${req.get("host")}`;
}

function makeOAuthClient(req, clientId, clientSecret) {
  const redirectUri = `${buildBaseUrl(req)}/auth/callback`;
  return new OAuth2Client(clientId, clientSecret, redirectUri);
}

function isApiPath(pathname) {
  const prefixes = ["/plans", "/plan", "/item", "/type", "/reorder", "/next-month"];
  return prefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

export function setupAuth(app) {
  const clientId = getEnv("CLIENT_ID", "GOOGLE_CLIENT_ID");
  const clientSecret = getEnv("CLIENT_SECRET", "GOOGLE_CLIENT_SECRET");
  const allowedUsers = parseAllowedUsers(process.env.ALLOWED_USERS);

  if (!clientId || !clientSecret) {
    throw new Error("Google OAuth is not configured: set CLIENT_ID and CLIENT_SECRET in .env");
  }
  if (allowedUsers.size === 0) {
    throw new Error("ALLOWED_USERS is empty. Add at least one email in .env");
  }

  const sessionSecret =
    process.env.SESSION_SECRET ||
    (process.env.NODE_ENV === "production" ? "" : crypto.randomBytes(32).toString("hex"));
  if (!sessionSecret) {
    throw new Error("SESSION_SECRET is required in production");
  }

  const maxAgeDays = Number(process.env.SESSION_MAX_AGE_DAYS || 180);
  const maxAgeMs = Math.max(1, maxAgeDays) * 24 * 60 * 60 * 1000;

  app.use(
    session({
      name: "wadbudget.sid",
      secret: sessionSecret,
      resave: false,
      saveUninitialized: false,
      rolling: true,
      cookie: {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        maxAge: maxAgeMs
      }
    })
  );

  const authRouter = express.Router();

  authRouter.get("/login", (req, res) => {
    if (req.session?.user?.email) return res.redirect("/");
    return res.sendFile(path.join(publicDir, "login.html"));
  });

  authRouter.get("/google", (req, res) => {
    const state = crypto.randomBytes(24).toString("hex");
    req.session.oauthState = state;

    const client = makeOAuthClient(req, clientId, clientSecret);
    const url = client.generateAuthUrl({
      access_type: "online",
      scope: ["openid", "email", "profile"],
      response_type: "code",
      prompt: "select_account",
      state
    });
    res.redirect(url);
  });

  authRouter.get("/callback", async (req, res) => {
    try {
      const { code, state } = req.query;
      if (!code || !state || state !== req.session.oauthState) {
        return res.status(400).send("Invalid OAuth state. Please try login again.");
      }

      delete req.session.oauthState;

      const client = makeOAuthClient(req, clientId, clientSecret);
      const { tokens } = await client.getToken(String(code));
      if (!tokens.id_token) return res.status(401).send("Google login failed.");

      const ticket = await client.verifyIdToken({
        idToken: tokens.id_token,
        audience: clientId
      });
      const payload = ticket.getPayload();
      const email = String(payload?.email || "").toLowerCase();
      const verified = Boolean(payload?.email_verified);

      if (!email || !verified) {
        return res.status(403).send("Google account email is not verified.");
      }

      if (!allowedUsers.has(email)) {
        return res.redirect(`/auth/denied?email=${encodeURIComponent(email)}`);
      }

      req.session.user = {
        email,
        name: payload?.name || "",
        picture: payload?.picture || "",
        sub: payload?.sub || "",
        authenticatedAt: Date.now()
      };
      return res.redirect("/");
    } catch (err) {
      console.error("Google OAuth callback error:", err);
      return res.status(500).send("Authentication failed. Please try again.");
    }
  });

  authRouter.get("/denied", (req, res) => {
    const email = String(req.query.email || "").replace(/[<>"']/g, "");
    res
      .status(403)
      .send(`
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Access Denied</title>
  <style>
    body{margin:0;min-height:100vh;display:grid;place-items:center;background:#0f0f0f;color:#e0e0e0;font-family:Segoe UI,Tahoma,sans-serif}
    .card{max-width:560px;background:#1a1a2e;border:1px solid #2a2a4a;border-radius:12px;padding:24px}
    h1{margin:0 0 10px;color:#e74c3c;font-size:24px}
    p{margin:8px 0;color:#bfbfd6;line-height:1.45}
    a{display:inline-block;margin-top:14px;color:#7c6ff7;text-decoration:none}
  </style>
</head>
<body>
  <div class="card">
    <h1>Access denied</h1>
    <p>Account <strong>${email || "unknown"}</strong> is not in the allowlist.</p>
    <p>Please contact your administrator to request access (add your email to ALLOWED_USERS).</p>
    <a href="/auth/login">Back to login</a>
  </div>
</body>
</html>`);
  });

  authRouter.post("/logout", (req, res) => {
    req.session.destroy(() => {
      res.clearCookie("wadbudget.sid");
      res.json({ success: true });
    });
  });

  authRouter.get("/me", (req, res) => {
    if (!req.session?.user) return res.json({ authenticated: false });
    return res.json({ authenticated: true, user: req.session.user });
  });

  app.use("/auth", authRouter);

  function requireAuth(req, res, next) {
    if (req.session?.user?.email) return next();

    if (isApiPath(req.path)) {
      return res.status(401).json({
        error: "unauthorized",
        message: "Please login with an allowed Google account."
      });
    }

    return res.redirect("/auth/login");
  }

  return { requireAuth };
}

