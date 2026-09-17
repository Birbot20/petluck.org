import "dotenv/config";
import crypto from "node:crypto";
import express from "express";
import jwt from "jsonwebtoken";

const required = ["WEB_ORIGIN", "SESSION_SECRET"];
const missing = required.filter((key) => !process.env[key]);
if (missing.length) throw new Error(`Missing required environment variable(s): ${missing.join(", ")}`);

const { DISCORD_CLIENT_ID, DISCORD_CLIENT_SECRET, DISCORD_REDIRECT_URI, WEB_ORIGIN, SESSION_SECRET, PORT = 3000, NODE_ENV = "development" } = process.env;
const phraseWords = "amber anchor apple apron atlas autumn bamboo banner beacon berry bird blossom breeze brook canyon candle cedar cherry cloud coast copper coral comet creek crystal dawn delta drift ember falcon feather fern field flame forest galaxy garden glacier golden harbor hazel island ivory jasmine lantern maple meadow meteor mist moon mountain ocean olive orchid pebble pine prairie quartz raven river rose ruby sage shadow silver solar sparrow star stone storm summit sunrise timber valley velvet violet willow winter".split(" ");

const app = express();
app.set("trust proxy", 1);
app.use(express.json({ limit: "4kb" }));

function parseCookies(request) {
  return Object.fromEntries((request.headers.cookie || "").split(";").filter(Boolean).map((part) => {
    const index = part.indexOf("=");
    return [part.slice(0, index).trim(), decodeURIComponent(part.slice(index + 1))];
  }));
}
function setCookie(response, name, value, options = {}) {
  const parts = [`${name}=${encodeURIComponent(value)}`, "Path=/", "HttpOnly", "SameSite=None"];
  if (NODE_ENV === "production") parts.push("Secure");
  if (options.maxAge) parts.push(`Max-Age=${options.maxAge}`);
  response.append("Set-Cookie", parts.join("; "));
}
function clearCookie(response, name) { setCookie(response, name, "", { maxAge: 1 }); }
function signSession(values) { return jwt.sign(values, SESSION_SECRET, { expiresIn: "7d" }); }
function getSession(request) {
  const token = parseCookies(request).petluck_session;
  return token ? jwt.verify(token, SESSION_SECRET) : {};
}
function makeRobloxPhrase() {
  const pool = [...phraseWords];
  const picked = [];
  while (picked.length < 12) picked.push(pool.splice(crypto.randomInt(pool.length), 1)[0]);
  return picked.join(" ");
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
app.get("/api/public/status", (_request, response) => response.json({ online: true, label: "PetLuck login ready" }));

app.get("/auth/discord", (_request, response) => {
  if (!DISCORD_CLIENT_ID || !DISCORD_CLIENT_SECRET || !DISCORD_REDIRECT_URI) return response.status(503).send("Discord login is not configured yet.");
  const state = crypto.randomBytes(32).toString("hex");
  setCookie(response, "petluck_oauth_state", state, { maxAge: 600 });
  response.redirect(`https://discord.com/oauth2/authorize?${new URLSearchParams({ client_id: DISCORD_CLIENT_ID, redirect_uri: DISCORD_REDIRECT_URI, response_type: "code", scope: "identify", state, prompt: "none" })}`);
});

app.get("/auth/discord/callback", async (request, response) => {
  try {
    const code = typeof request.query.code === "string" ? request.query.code : "";
    const returnedState = typeof request.query.state === "string" ? request.query.state : "";
    const storedState = parseCookies(request).petluck_oauth_state || "";
    const validState = returnedState.length === storedState.length && returnedState.length > 0 && crypto.timingSafeEqual(Buffer.from(returnedState), Buffer.from(storedState));
    if (!code || !validState) return response.status(400).send("Invalid or expired Discord sign-in request.");
    clearCookie(response, "petluck_oauth_state");
    const tokenResponse = await fetch("https://discord.com/api/oauth2/token", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ client_id: DISCORD_CLIENT_ID, client_secret: DISCORD_CLIENT_SECRET, grant_type: "authorization_code", code, redirect_uri: DISCORD_REDIRECT_URI }) });
    if (!tokenResponse.ok) throw new Error("Discord token exchange failed");
    const token = await tokenResponse.json();
    const profileResponse = await fetch("https://discord.com/api/users/@me", { headers: { Authorization: `Bearer ${token.access_token}` } });
    if (!profileResponse.ok) throw new Error("Discord profile request failed");
    const profile = await profileResponse.json();
    const prior = getSession(request);
    setCookie(response, "petluck_session", signSession({ ...prior, discordId: profile.id, username: profile.username, globalName: profile.global_name, avatar: profile.avatar }), { maxAge: 60 * 60 * 24 * 7 });
    response.redirect(`${WEB_ORIGIN}/?connected=1`);
  } catch (error) {
    console.error("Discord OAuth error:", error.message);
    response.redirect(`${WEB_ORIGIN}/?login_error=1`);
  }
});

app.post("/auth/roblox/start", async (request, response) => {
  try {
    const username = String(request.body?.username || "").trim();
    if (!username || username.length > 20) return response.status(400).json({ error: "Enter a valid Roblox username." });
    const lookup = await fetch("https://users.roblox.com/v1/usernames/users", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ usernames: [username], excludeBannedUsers: false }) });
    if (!lookup.ok) throw new Error("Roblox lookup failed");
    const data = await lookup.json();
    const account = data.data?.[0];
    if (!account) return response.status(404).json({ error: "That Roblox username could not be found." });
    const phrase = makeRobloxPhrase();
    const pending = jwt.sign({ robloxId: String(account.id), robloxUsername: account.name, phrase }, SESSION_SECRET, { expiresIn: "15m" });
    setCookie(response, "petluck_roblox_pending", pending, { maxAge: 900 });
    response.json({ username: account.name, phrase });
  } catch (error) {
    console.error("Roblox start error:", error.message);
    response.status(503).json({ error: "Roblox could not be reached. Please try again." });
  }
});

app.post("/auth/roblox/verify", async (request, response) => {
  try {
    const pending = parseCookies(request).petluck_roblox_pending;
    if (!pending) return response.status(400).json({ error: "Your phrase expired. Start again." });
    const link = jwt.verify(pending, SESSION_SECRET);
    const profileResponse = await fetch(`https://users.roblox.com/v1/users/${encodeURIComponent(link.robloxId)}`);
    if (!profileResponse.ok) throw new Error("Roblox profile request failed");
    const profile = await profileResponse.json();
    if (!String(profile.description || "").toLowerCase().includes(link.phrase.toLowerCase())) {
      return response.status(400).json({ error: "Phrase not found in your Roblox About section yet. Save it, wait a moment, then try again." });
    }
    const prior = getSession(request);
    const session = { ...prior, robloxId: link.robloxId, robloxUsername: profile.name || link.robloxUsername, robloxVerified: true };
    setCookie(response, "petluck_session", signSession(session), { maxAge: 60 * 60 * 24 * 7 });
    clearCookie(response, "petluck_roblox_pending");
    response.json({ user: { discordId: session.discordId, username: session.username, robloxId: session.robloxId, robloxUsername: session.robloxUsername, robloxVerified: true } });
  } catch (error) {
    console.error("Roblox verify error:", error.message);
    response.status(400).json({ error: "Verification session expired. Start again." });
  }
});

app.get("/api/me", (request, response) => {
  try {
    const user = getSession(request);
    if (!user.discordId && !user.robloxId) return response.status(401).json({ error: "Not signed in" });
    response.json({ user: { discordId: user.discordId, username: user.username, globalName: user.globalName, avatar: user.avatar, robloxId: user.robloxId, robloxUsername: user.robloxUsername, robloxVerified: Boolean(user.robloxVerified) } });
  } catch {
    response.status(401).json({ error: "Session expired" });
  }
});

app.post("/auth/logout", (_request, response) => { clearCookie(response, "petluck_session"); response.status(204).end(); });
app.listen(PORT, () => console.log(`PetLuck login API running on port ${PORT}`));
