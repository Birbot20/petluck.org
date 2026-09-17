import "dotenv/config";
import crypto from "node:crypto";
import express from "express";
import jwt from "jsonwebtoken";

const required = ["DISCORD_CLIENT_ID", "DISCORD_CLIENT_SECRET", "DISCORD_REDIRECT_URI", "WEB_ORIGIN", "SESSION_SECRET"];
const missing = required.filter((key) => !process.env[key]);
if (missing.length) throw new Error(`Missing required environment variable(s): ${missing.join(", ")}`);

const {
  DISCORD_CLIENT_ID,
  DISCORD_CLIENT_SECRET,
  DISCORD_REDIRECT_URI,
  WEB_ORIGIN,
  SESSION_SECRET,
  PORT = 3000,
  NODE_ENV = "development",
} = process.env;

const app = express();
app.set("trust proxy", 1);

function parseCookies(request) {
  return Object.fromEntries(
    (request.headers.cookie || "").split(";").filter(Boolean).map((part) => {
      const index = part.indexOf("=");
      return [part.slice(0, index).trim(), decodeURIComponent(part.slice(index + 1))];
    }),
  );
}

function setCookie(response, name, value, options = {}) {
  const parts = [`${name}=${encodeURIComponent(value)}`, "Path=/", "HttpOnly", "SameSite=None"];
  if (NODE_ENV === "production") parts.push("Secure");
  if (options.maxAge) parts.push(`Max-Age=${options.maxAge}`);
  response.append("Set-Cookie", parts.join("; "));
}

function clearCookie(response, name) {
  setCookie(response, name, "", { maxAge: 1 });
}

app.use((request, response, next) => {
  const origin = request.headers.origin;
  if (origin === WEB_ORIGIN) {
    response.setHeader("Access-Control-Allow-Origin", origin);
    response.setHeader("Access-Control-Allow-Credentials", "true");
    response.setHeader("Vary", "Origin");
  }
  if (request.method === "OPTIONS") return response.sendStatus(204);
  next();
});

app.get("/health", (_request, response) => response.json({ ok: true }));

app.get("/api/public/status", (_request, response) => {
  response.json({ online: true, label: "PetLuck login ready" });
});

app.get("/auth/discord", (_request, response) => {
  const state = crypto.randomBytes(32).toString("hex");
  setCookie(response, "petluck_oauth_state", state, { maxAge: 600 });
  const query = new URLSearchParams({
    client_id: DISCORD_CLIENT_ID,
    redirect_uri: DISCORD_REDIRECT_URI,
    response_type: "code",
    scope: "identify",
    state,
    prompt: "none",
  });
  response.redirect(`https://discord.com/oauth2/authorize?${query}`);
});

app.get("/auth/discord/callback", async (request, response) => {
  try {
    const { code, state } = request.query;
    const cookies = parseCookies(request);
    if (!code || !state || !crypto.timingSafeEqual(Buffer.from(String(state)), Buffer.from(cookies.petluck_oauth_state || "x"))) {
      return response.status(400).send("Invalid or expired Discord sign-in request.");
    }
    clearCookie(response, "petluck_oauth_state");

    const tokenResponse = await fetch("https://discord.com/api/oauth2/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: DISCORD_CLIENT_ID,
        client_secret: DISCORD_CLIENT_SECRET,
        grant_type: "authorization_code",
        code: String(code),
        redirect_uri: DISCORD_REDIRECT_URI,
      }),
    });
    if (!tokenResponse.ok) throw new Error("Discord token exchange failed");
    const token = await tokenResponse.json();

    const profileResponse = await fetch("https://discord.com/api/users/@me", {
      headers: { Authorization: `Bearer ${token.access_token}` },
    });
    if (!profileResponse.ok) throw new Error("Discord profile request failed");
    const profile = await profileResponse.json();

    const session = jwt.sign(
      { discordId: profile.id, username: profile.username, globalName: profile.global_name, avatar: profile.avatar },
      SESSION_SECRET,
      { expiresIn: "7d" },
    );
    setCookie(response, "petluck_session", session, { maxAge: 60 * 60 * 24 * 7 });
    response.redirect(`${WEB_ORIGIN}/?connected=1`);
  } catch (error) {
    console.error("Discord OAuth error:", error.message);
    response.redirect(`${WEB_ORIGIN}/?login_error=1`);
  }
});

app.get("/api/me", (request, response) => {
  try {
    const session = parseCookies(request).petluck_session;
    if (!session) return response.status(401).json({ error: "Not signed in" });
    const user = jwt.verify(session, SESSION_SECRET);
    response.json({ user: { discordId: user.discordId, username: user.username, globalName: user.globalName, avatar: user.avatar } });
  } catch {
    response.status(401).json({ error: "Session expired" });
  }
});

app.post("/auth/logout", (_request, response) => {
  clearCookie(response, "petluck_session");
  response.status(204).end();
});

app.listen(PORT, () => console.log(`PetLuck login API running on port ${PORT}`));
