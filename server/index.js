import "dotenv/config";
import crypto from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";
import jwt from "jsonwebtoken";

const required = ["WEB_ORIGIN", "SESSION_SECRET"];
const missing = required.filter((key) => !process.env[key]);
if (missing.length) throw new Error(`Missing required environment variable(s): ${missing.join(", ")}`);

const { DISCORD_CLIENT_ID, DISCORD_CLIENT_SECRET, DISCORD_REDIRECT_URI, WEB_ORIGIN, SESSION_SECRET, MONGODB_URI, MONGODB_DB = "petluck", ADMIN_USERNAME, ADMIN_PASSWORD, PORT = 3000, NODE_ENV = "development" } = process.env;
const phraseWords = "amber anchor apple apron atlas autumn bamboo banner beacon berry bird blossom breeze brook canyon candle cedar cherry cloud coast copper coral comet creek crystal dawn delta drift ember falcon feather fern field flame forest galaxy garden glacier golden harbor hazel island ivory jasmine lantern maple meadow meteor mist moon mountain ocean olive orchid pebble pine prairie quartz raven river rose ruby sage shadow silver solar sparrow star stone storm summit sunrise timber valley velvet violet willow winter".split(" ");

const app = express();
app.set("trust proxy", 1);
app.use(express.json({ limit: "4kb" }));

let databasePromise = null;
async function getDatabase() {
  if (!MONGODB_URI) return null;
  if (!databasePromise) {
    databasePromise = import("mongodb").then(async ({ MongoClient }) => {
      const client = new MongoClient(MONGODB_URI, { serverSelectionTimeoutMS: 5000 });
      await client.connect();
      console.log("MongoDB connected");
      return client.db(MONGODB_DB);
    }).catch((error) => {
      databasePromise = null;
      console.error("MongoDB connection failed:", error.message);
      return null;
    });
  }
  return databasePromise;
}

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
function secureEquals(left, right) {
  const leftBuffer = Buffer.from(String(left || ""));
  const rightBuffer = Buffer.from(String(right || ""));
  return leftBuffer.length === rightBuffer.length && leftBuffer.length > 0 && crypto.timingSafeEqual(leftBuffer, rightBuffer);
}
function requireAdmin(request, response, next) {
  try {
    const session = getSession(request);
    if (session?.admin === true) return next();
  } catch { /* expired or malformed session */ }
  return response.status(401).json({ error: "Admin sign-in required." });
}
function getPlayerSession(request, response) {
  let session;
  try { session = getSession(request); } catch { session = {}; }
  if (!session.guestId && !session.robloxId) {
    session = { ...session, guestId: crypto.randomUUID(), username: "Practice player" };
    setCookie(response, "petluck_session", signSession(session), { maxAge: 60 * 60 * 24 * 30 });
  }
  const id = session.robloxId ? `roblox:${session.robloxId}` : `guest:${session.guestId}`;
  const displayName = session.robloxUsername || session.globalName || session.username || "Practice player";
  return { session, id, displayName };
}
function practiceState(document, player) {
  return {
    user: { id: player.id, displayName: player.displayName, robloxVerified: Boolean(player.session.robloxVerified) },
    balance: Math.max(0, Math.min(Number(document?.balance ?? 10000), 1000000000)),
    inventory: Array.isArray(document?.inventory) ? document.inventory : [],
    history: Array.isArray(document?.history) ? document.history : [],
  };
}
function sanitizePracticeState(input) {
  const balance = Math.max(0, Math.min(Math.floor(Number(input?.balance) || 0), 1000000000));
  const inventory = Array.isArray(input?.inventory) ? input.inventory.slice(0, 250).map((item) => ({
    id: String(item?.id || crypto.randomUUID()).slice(0, 120), name: String(item?.name || "Unknown item").slice(0, 80),
    case: String(item?.case || "Case").slice(0, 80), value: Math.max(0, Math.min(Math.floor(Number(item?.value) || 0), 1000000000)),
  })) : [];
  const history = Array.isArray(input?.history) ? input.history.slice(0, 100).map((entry) => ({
    game: String(entry?.game || "Game").slice(0, 50), amount: Math.max(0, Math.min(Math.floor(Number(entry?.amount) || 0), 1000000000)),
    result: String(entry?.result || "Completed").slice(0, 80), payout: Math.max(0, Math.min(Math.floor(Number(entry?.payout) || 0), 1000000000)),
    at: String(entry?.at || "").slice(0, 30),
  })) : [];
  return { balance, inventory, history };
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
app.get("/api/public/status", async (_request, response) => {
  const database = await getDatabase();
  response.json({ online: true, database: Boolean(database), label: database ? "MongoDB connected" : "Practice mode — database not configured" });
});

app.get("/api/admin/session", (request, response) => {
  try {
    const session = getSession(request);
    response.json({ authenticated: session?.admin === true, username: session?.adminUsername || null, configured: Boolean(ADMIN_USERNAME && ADMIN_PASSWORD) });
  } catch {
    response.json({ authenticated: false, username: null, configured: Boolean(ADMIN_USERNAME && ADMIN_PASSWORD) });
  }
});

app.post("/api/admin/login", (request, response) => {
  if (!ADMIN_USERNAME || !ADMIN_PASSWORD) return response.status(503).json({ error: "Admin credentials have not been configured on the server." });
  const username = String(request.body?.username || "");
  const password = String(request.body?.password || "");
  if (!secureEquals(username, ADMIN_USERNAME) || !secureEquals(password, ADMIN_PASSWORD)) return response.status(401).json({ error: "Incorrect username or password." });
  let prior = {};
  try { prior = getSession(request); } catch { /* reset invalid session */ }
  setCookie(response, "petluck_session", signSession({ ...prior, admin: true, adminUsername: ADMIN_USERNAME }), { maxAge: 60 * 60 * 8 });
  response.json({ authenticated: true, username: ADMIN_USERNAME });
});

app.post("/api/admin/logout", (request, response) => {
  let prior = {};
  try { prior = getSession(request); } catch { /* reset invalid session */ }
  delete prior.admin;
  delete prior.adminUsername;
  if (Object.keys(prior).length) setCookie(response, "petluck_session", signSession(prior), { maxAge: 60 * 60 * 24 * 7 });
  else clearCookie(response, "petluck_session");
  response.status(204).end();
});

app.get("/api/practice/state", async (request, response) => {
  const database = await getDatabase();
  if (!database) return response.status(503).json({ error: "MongoDB is not configured yet." });
  const player = getPlayerSession(request, response);
  const players = database.collection("players");
  await players.updateOne(
    { _id: player.id },
    { $setOnInsert: { displayName: player.displayName, balance: 10000, inventory: [], history: [], createdAt: new Date() }, $set: { updatedAt: new Date() } },
    { upsert: true },
  );
  const document = await players.findOne({ _id: player.id });
  response.json({ database: true, state: practiceState(document, player) });
});

app.put("/api/practice/state", async (request, response) => {
  const database = await getDatabase();
  if (!database) return response.status(503).json({ error: "MongoDB is not configured yet." });
  const player = getPlayerSession(request, response);
  const state = sanitizePracticeState(request.body);
  await database.collection("players").updateOne(
    { _id: player.id },
    { $set: { ...state, displayName: player.displayName, updatedAt: new Date() }, $setOnInsert: { createdAt: new Date() } },
    { upsert: true },
  );
  response.json({ database: true, state: { user: { id: player.id, displayName: player.displayName, robloxVerified: Boolean(player.session.robloxVerified) }, ...state } });
});

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

// Render serves the built dashboard and API together. This keeps all browser
// requests same-origin and avoids relying on a separate static-site host.
const serverDirectory = path.dirname(fileURLToPath(import.meta.url));
const siteDirectory = path.resolve(serverDirectory, "..", "dist");
app.use(express.static(siteDirectory));
app.get("*", (request, response, next) => {
  if (request.path === "/health" || request.path.startsWith("/api/") || request.path.startsWith("/auth/")) return next();
  response.sendFile(path.join(siteDirectory, "index.html"));
});

app.listen(PORT, () => {
  console.log(`PetLuck login API running on port ${PORT}`);
  // Connect eagerly so Render deploy logs immediately state whether the
  // configured database is reachable, instead of waiting for a browser request.
  getDatabase();
});
