import { useEffect, useMemo, useState } from "react";

const API_URL = import.meta.env.VITE_API_URL?.replace(/\/$/, "");

const demoActivity = [
  { game: "Blackjack", detail: "Won 2.00×", amount: "+20.0M", kind: "win" },
  { game: "Daily reward", detail: "Streak reward", amount: "+5.0M", kind: "reward" },
  { game: "PvP Dice", detail: "Round completed", amount: "—", kind: "neutral" },
  { game: "Message reward", detail: "Milestone progress", amount: "+1", kind: "reward" },
];

const gameCards = [
  { icon: "♠", name: "Blackjack", text: "Split, double, hit, or stand.", accent: "purple" },
  { icon: "⌁", name: "Mines", text: "Choose your risk. Cash out anytime.", accent: "blue" },
  { icon: "◈", name: "Dice", text: "Set your target and roll.", accent: "orange" },
  { icon: "◉", name: "PvP", text: "Challenge another player.", accent: "pink" },
];

export default function App() {
  const [active, setActive] = useState("Home");
  const [status, setStatus] = useState({ online: false, text: "Connecting to PetLuck" });
  const [notice, setNotice] = useState("");
  const [user, setUser] = useState(null);
  const [robloxOpen, setRobloxOpen] = useState(false);
  const [robloxUsername, setRobloxUsername] = useState("");
  const [robloxPhrase, setRobloxPhrase] = useState("");
  const [robloxStep, setRobloxStep] = useState("start");
  const [robloxBusy, setRobloxBusy] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("connected")) {
      setNotice("Discord connected. Welcome to PetLuck!");
      window.history.replaceState({}, "", window.location.pathname);
    }
    if (!API_URL) {
      setStatus({ online: true, text: "Demo mode" });
      return;
    }
    let live = true;
    fetch(`${API_URL}/api/public/status`, { credentials: "include" })
      .then((response) => response.ok ? response.json() : Promise.reject())
      .then((data) => live && setStatus({ online: Boolean(data.online), text: data.label || "Live" }))
      .catch(() => live && setStatus({ online: false, text: "Service unavailable" }));
    fetch(`${API_URL}/api/me`, { credentials: "include" })
      .then((response) => response.ok ? response.json() : null)
      .then((data) => live && data?.user && setUser(data.user))
      .catch(() => {});
    return () => { live = false; };
  }, []);

  const headline = useMemo(() => active === "Home" ? "Your luck starts here." : active, [active]);

  function notify(message) {
    setNotice(message);
    window.setTimeout(() => setNotice(""), 3500);
  }

  function connectDiscord() {
    if (!API_URL) return notify("Discord sign-in will turn on when the private API is deployed.");
    window.location.assign(`${API_URL}/auth/discord`);
  }

  function openRoblox() {
    if (!API_URL) return notify("Roblox sign-in will turn on when the private API is deployed.");
    setRobloxOpen(true);
    setRobloxStep("start");
    setRobloxPhrase("");
  }

  async function startRoblox(event) {
    event.preventDefault();
    setRobloxBusy(true);
    try {
      const response = await fetch(`${API_URL}/auth/roblox/start`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: robloxUsername }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not find that Roblox account.");
      setRobloxUsername(data.username);
      setRobloxPhrase(data.phrase);
      setRobloxStep("verify");
    } catch (error) {
      notify(error.message);
    } finally {
      setRobloxBusy(false);
    }
  }

  async function verifyRoblox() {
    setRobloxBusy(true);
    try {
      const response = await fetch(`${API_URL}/auth/roblox/verify`, { method: "POST", credentials: "include" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Verification failed.");
      setUser(data.user);
      setRobloxOpen(false);
      notify(`Roblox verified as @${data.user.robloxUsername}.`);
    } catch (error) {
      notify(error.message);
    } finally {
      setRobloxBusy(false);
    }
  }

  function unavailable(feature) {
    notify(user ? `${feature} is coming to your dashboard soon.` : `${feature} opens after sign-in.`);
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <button className="brand" onClick={() => setActive("Home")} aria-label="PetLuck home">
          <span className="brand-mark">✦</span><span>pet<span>luck</span></span>
        </button>
        <nav className="nav-links" aria-label="Main navigation">
          {["Home", "Games", "PvP", "Rewards", "Leaderboard"].map((item) => (
            <button className={active === item ? "active" : ""} key={item} onClick={() => setActive(item)}>{item}</button>
          ))}
        </nav>
        <div className="top-actions">
          <span className={`service-pill ${status.online ? "live" : ""}`}><i /> {status.text}</span>
          <button className="discord-button" onClick={connectDiscord}>{user?.username ? `@${user.username}` : "Connect Discord"}</button>
        </div>
      </header>

      <main>
        {notice && <div className="notice" role="status">{notice}</div>}
        <section className="hero">
          <div className="hero-copy">
            <p className="eyebrow">PETLUCK · DISCORD COMMUNITY</p>
            <h1>{headline}</h1>
            <p className="hero-text">Games, rewards, live PvP, and your PetLuck community—now in one clear place.</p>
            <div className="hero-actions">
              <button className="primary" onClick={user ? () => unavailable("Your dashboard") : connectDiscord}>{user ? "Open dashboard" : "Connect Discord"} <span>→</span></button>
              <button className="secondary" onClick={openRoblox}>Connect Roblox</button>
            </div>
            <div className="trust-row"><span>✦ Fair play</span><span>◉ Live community</span><span>◌ Discord-first</span></div>
          </div>
          <div className="hero-card">
            <div className="card-top"><span>YOUR BALANCE</span><span className="gem">◆</span></div>
            <strong>—</strong>
            <p>{user?.robloxUsername ? `Roblox verified as @${user.robloxUsername}` : user ? `Signed in as @${user.username}` : "Connect Discord or Roblox to get started"}</p>
            <div className="card-divider" />
            <div className="quick-stats"><span><b>—</b> Wagered</span><span><b>—</b> Rewards</span></div>
          </div>
        </section>

        <section className="stats-grid" aria-label="Community stats">
          <article><p>ONLINE PLAYERS</p><b>—</b><span>Live after API connection</span></article>
          <article><p>DAILY JACKPOT</p><b>—</b><span>Updated in real time</span></article>
          <article><p>ACTIVE GAMES</p><b>—</b><span>Play through Discord</span></article>
          <article><p>COMMUNITY REWARDS</p><b>—</b><span>Earn by taking part</span></article>
        </section>

        <section className="section-head">
          <div><p className="eyebrow">PICK YOUR PLAY</p><h2>Built for every kind of luck.</h2></div>
          <button className="text-button" onClick={() => setActive("Games")}>View all games →</button>
        </section>

        <section className="games-grid">
          {gameCards.map((game) => (
            <button key={game.name} className={`game-card ${game.accent}`} onClick={() => unavailable(game.name)}>
              <span className="game-icon">{game.icon}</span>
              <span className="game-arrow">↗</span>
              <h3>{game.name}</h3><p>{game.text}</p>
            </button>
          ))}
        </section>

        <section className="lower-grid">
          <article className="activity-panel">
            <div className="panel-heading"><div><p className="eyebrow">YOUR ACTIVITY</p><h2>Recent movement</h2></div><button onClick={() => unavailable("History")}>View history</button></div>
            <div className="activity-list">
              {demoActivity.map((item) => <div className="activity" key={item.game}>
                <span className={`activity-icon ${item.kind}`}>◆</span>
                <span className="activity-copy"><b>{item.game}</b><small>{item.detail}</small></span>
                <strong className={item.kind}>{item.amount}</strong>
              </div>)}
            </div>
          </article>
          <aside className="community-card">
            <p className="eyebrow">DAILY LOOP</p><h2>Stay in the game.</h2>
            <p>Join the Discord to claim rewards, take part in events, and find your next opponent.</p>
            <button className="primary wide" onClick={openRoblox}>Verify Roblox <span>→</span></button>
          </aside>
        </section>
      </main>

      {robloxOpen && <div className="modal-backdrop" role="presentation" onMouseDown={() => !robloxBusy && setRobloxOpen(false)}>
        <section className="roblox-modal" role="dialog" aria-modal="true" aria-labelledby="roblox-title" onMouseDown={(event) => event.stopPropagation()}>
          <button className="modal-close" onClick={() => setRobloxOpen(false)} aria-label="Close">×</button>
          <p className="eyebrow">ROBLOX VERIFICATION</p>
          <h2 id="roblox-title">{robloxStep === "start" ? "Verify your Roblox account" : "Add your phrase to Roblox"}</h2>
          {robloxStep === "start" ? <form onSubmit={startRoblox}>
            <p>Enter your Roblox username. We’ll give you a private 12-word phrase to place in your Roblox bio.</p>
            <label>Roblox username<input value={robloxUsername} onChange={(event) => setRobloxUsername(event.target.value)} placeholder="YourRobloxName" autoFocus required /></label>
            <button className="primary wide" disabled={robloxBusy}>{robloxBusy ? "Checking..." : "Create verification phrase"} <span>→</span></button>
          </form> : <div>
            <p>Copy this exact phrase into the <b>About</b> section of your Roblox profile, save it, then verify.</p>
            <code className="phrase">{robloxPhrase}</code>
            <ol><li>Open your Roblox profile and choose Edit.</li><li>Paste the phrase in About and save.</li><li>Return here and select Verify now.</li></ol>
            <button className="primary wide" onClick={verifyRoblox} disabled={robloxBusy}>{robloxBusy ? "Checking Roblox..." : "Verify now"} <span>→</span></button>
            <button className="text-button modal-back" onClick={() => setRobloxStep("start")}>Use another username</button>
          </div>}
        </section>
      </div>}

      <footer><span>© {new Date().getFullYear()} PetLuck</span><span>Play responsibly · Community rules apply</span></footer>
    </div>
  );
}
