import { useEffect, useState } from "react";

const API_URL = import.meta.env.VITE_API_URL?.replace(/\/$/, "") || (import.meta.env.PROD ? window.location.origin : "");
const navItems = [["⌂", "Home"], ["◈", "Games"], ["⚔", "PvP"], ["◉", "Jackpot"], ["♜", "Leaderboard"], ["✦", "Rewards"], ["◎", "Profile"]];
const games = [
  { icon: "♠", title: "Blackjack", text: "Hit, stand, double & split", hue: "violet" },
  { icon: "◌", title: "Mines", text: "Pick tiles. Cash out anytime.", hue: "cyan" },
  { icon: "◈", title: "Dice", text: "Set a target and roll.", hue: "amber" },
  { icon: "⚔", title: "PvP Duels", text: "Challenge the community.", hue: "rose" },
  { icon: "🎁", title: "Cases", text: "Open a little luck.", hue: "lime" },
];
const liveBets = [
  ["♠", "Blackjack", "NovaLuck", "250M", "2.00×", "+250M", "win"],
  ["◌", "Mines", "petmaster", "75M", "1.84×", "+63M", "win"],
  ["◈", "Dice", "StarBlox", "120M", "0.00×", "—", "loss"],
  ["⚔", "PvP Duel", "GemRunner", "1.5B", "2.00×", "+1.5B", "win"],
];
const chat = [
  ["CrownApe", "Any PvP duels open?", "purple"], ["LuckyTails", "blackjack paid today", "orange"],
  ["MintyGems", "ggs!", "green"], ["DiceWizard", "who wants a 100m dice?", "blue"],
  ["RubyRush", "daily jackpot is huge", "red"],
];

export default function App() {
  const [active, setActive] = useState("Home");
  const [notice, setNotice] = useState("");
  const [user, setUser] = useState(null);
  const [status, setStatus] = useState({ online: false, text: "Checking" });
  const [robloxOpen, setRobloxOpen] = useState(false);
  const [robloxUsername, setRobloxUsername] = useState("");
  const [robloxPhrase, setRobloxPhrase] = useState("");
  const [robloxStep, setRobloxStep] = useState("start");
  const [robloxBusy, setRobloxBusy] = useState(false);

  useEffect(() => {
    if (!API_URL) { setStatus({ online: true, text: "Demo mode" }); return; }
    let live = true;
    Promise.all([
      fetch(`${API_URL}/api/public/status`, { credentials: "include" }).then((r) => r.ok ? r.json() : null),
      fetch(`${API_URL}/api/me`, { credentials: "include" }).then((r) => r.ok ? r.json() : null),
    ]).then(([service, account]) => {
      if (!live) return;
      setStatus({ online: Boolean(service?.online), text: service?.label || "Service unavailable" });
      if (account?.user) setUser(account.user);
    }).catch(() => live && setStatus({ online: false, text: "Service unavailable" }));
    return () => { live = false; };
  }, []);

  function notify(message) { setNotice(message); window.setTimeout(() => setNotice(""), 3600); }
  function connectDiscord() { if (!API_URL) return notify("Discord login turns on when the private API is deployed."); window.location.assign(`${API_URL}/auth/discord`); }
  function openRoblox() { if (!API_URL) return notify("Roblox verification turns on when the private API is deployed."); setRobloxOpen(true); setRobloxStep("start"); setRobloxPhrase(""); }
  function unavailable(label) { notify(user ? `${label} is coming to your PetLuck dashboard.` : `Sign in to open ${label}.`); }

  async function startRoblox(event) {
    event.preventDefault(); setRobloxBusy(true);
    try {
      const response = await fetch(`${API_URL}/auth/roblox/start`, { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ username: robloxUsername }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not find that account.");
      setRobloxUsername(data.username); setRobloxPhrase(data.phrase); setRobloxStep("verify");
    } catch (error) { notify(error.message); } finally { setRobloxBusy(false); }
  }
  async function verifyRoblox() {
    setRobloxBusy(true);
    try {
      const response = await fetch(`${API_URL}/auth/roblox/verify`, { method: "POST", credentials: "include" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Verification failed.");
      setUser(data.user); setRobloxOpen(false); notify(`Roblox verified as @${data.user.robloxUsername}.`);
    } catch (error) { notify(error.message); } finally { setRobloxBusy(false); }
  }

  return <div className="dashboard">
    <aside className="sidebar">
      <button className="logo" onClick={() => setActive("Home")}><span>✦</span><b>pet<span>luck</span></b></button>
      <div className="side-label">PLAY</div>
      <nav>{navItems.slice(0, 5).map(([icon, label]) => <button key={label} className={active === label ? "selected" : ""} onClick={() => { setActive(label); unavailable(label); }}><i>{icon}</i><span>{label}</span></button>)}</nav>
      <div className="side-label">ACCOUNT</div>
      <nav>{navItems.slice(5).map(([icon, label]) => <button key={label} className={active === label ? "selected" : ""} onClick={() => { setActive(label); unavailable(label); }}><i>{icon}</i><span>{label}</span></button>)}</nav>
      <div className="side-bottom"><button onClick={connectDiscord}>◉ <span>Discord</span></button><button onClick={() => unavailable("Support")}>? <span>Support</span></button></div>
    </aside>

    <section className="workspace">
      <header className="header">
        <button className="mobile-logo" onClick={() => setActive("Home")}>✦ petluck</button>
        <div className="crumb"><span className={status.online ? "online" : ""} /> {status.text}</div>
        <div className="header-actions">
          <button className="balance" onClick={openRoblox}>◆ <b>—</b><small>GEMS</small></button>
          <button className="deposit" onClick={openRoblox}>+ Add gems</button>
          <button className="avatar" onClick={user ? () => unavailable("Profile") : connectDiscord}>{user?.robloxUsername?.[0] || user?.username?.[0] || "P"}</button>
        </div>
      </header>

      <main className="content">
        {notice && <div className="toast">{notice}</div>}
        <section className="welcome">
          <div><p className="tag">✦ PETLUCK IS LIVE</p><h1>Play smart.<br /><em>Get lucky.</em></h1><p>Play your favorite games, meet the community, and build your luck.</p><div className="welcome-buttons"><button className="orange" onClick={openRoblox}>Verify Roblox <b>→</b></button><button className="ghost" onClick={connectDiscord}>◉ Connect Discord</button></div></div>
          <div className="hero-orb"><span>◆</span><i>✦</i><i>✦</i><i>✦</i></div>
        </section>

        <section className="stats">
          <article><span>◉</span><div><small>ONLINE PLAYERS</small><b>—</b><p>Connect API for live count</p></div></article>
          <article><span>◆</span><div><small>DAILY JACKPOT</small><b>—</b><p>Updated by the bot</p></div></article>
          <article><span>◌</span><div><small>YOUR BALANCE</small><b>—</b><p>{user?.robloxUsername ? `@ ${user.robloxUsername} verified` : "Sign in to view"}</p></div></article>
        </section>

        <div className="section-title"><div><p className="tag">CHOOSE YOUR GAME</p><h2>Play your way</h2></div><button onClick={() => unavailable("Games")}>See all games →</button></div>
        <section className="game-grid">{games.map((game) => <button className={`game ${game.hue}`} key={game.title} onClick={() => unavailable(game.title)}><span className="game-icon">{game.icon}</span><span className="go">↗</span><h3>{game.title}</h3><p>{game.text}</p></button>)}</section>

        <section className="live-panel">
          <div className="live-head"><div><p className="tag">COMMUNITY ACTION</p><h2>Live bets <span>●</span></h2></div><div><button className="filter selected-filter">All bets</button><button className="filter">Big wins</button></div></div>
          <div className="bet-list">{liveBets.map(([icon, game, player, bet, multi, payout, result]) => <div className="bet-row" key={player}><span className="bet-icon">{icon}</span><b>{game}</b><span className="player">◉ {player}</span><span>{bet}</span><span className="multi">{multi}</span><strong className={result}>{payout}</strong></div>)}</div>
        </section>
      </main>
    </section>

    <aside className="chat-panel">
      <header><div><span className="chat-dot" /> LIVE CHAT</div><button>×</button></header>
      <div className="chat-messages">{chat.map(([name, message, color]) => <article key={name}><span className={`chat-avatar ${color}`}>{name[0]}</span><div><b>{name}</b><small>now</small><p>{message}</p></div></article>)}</div>
      <div className="chat-input"><span>{user ? "Say something..." : "Login to chat..."}</span><button onClick={connectDiscord}>→</button></div>
      <div className="chat-footer"><span>● 95 online</span><span>Be kind</span></div>
    </aside>

    {robloxOpen && <div className="modal-backdrop" onMouseDown={() => !robloxBusy && setRobloxOpen(false)}>
      <section className="roblox-modal" role="dialog" aria-modal="true" onMouseDown={(event) => event.stopPropagation()}>
        <button className="modal-close" onClick={() => setRobloxOpen(false)}>×</button>
        <div className="modal-art"><span>✦</span><b>PETLUCK</b><h2>Verify your<br />Roblox account.</h2><i>◆ ◆ ◆</i></div>
        <div className="modal-form"><p className="tag">ROBLOX SIGN IN</p><h2>{robloxStep === "start" ? "Start verification" : "Your private phrase"}</h2>
          {robloxStep === "start" ? <form onSubmit={startRoblox}><p>Enter your Roblox username. We’ll create a unique phrase only you can verify.</p><label>Roblox username<input value={robloxUsername} onChange={(event) => setRobloxUsername(event.target.value)} placeholder="YourRobloxUsername" autoFocus required /></label><button className="orange full" disabled={robloxBusy}>{robloxBusy ? "Checking..." : "Get verification phrase"} <b>→</b></button><div className="modal-or">OR</div><button type="button" className="discord-login" onClick={connectDiscord}>◉ Login with Discord</button></form> : <div><p>Put this phrase in your Roblox profile’s <b>About</b> section, save it, then come back.</p><code className="phrase">{robloxPhrase}</code><ol><li>Open your Roblox profile → Edit.</li><li>Paste the phrase into About and save.</li><li>Press Verify now below.</li></ol><button className="orange full" onClick={verifyRoblox} disabled={robloxBusy}>{robloxBusy ? "Checking Roblox..." : "Verify now"} <b>→</b></button><button className="link-button" onClick={() => setRobloxStep("start")}>Use a different username</button></div>}
        </div>
      </section>
    </div>}
  </div>;
}
