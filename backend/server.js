// backend/server.js
// ── load dotenv only if available (dev); skip in packaged prod ────────────────
try {
  const { default: dotenv } = await import("dotenv");
  dotenv.config();
  console.log("[dotenv] loaded");
} catch {
  // no-op in production (package missing is OK)
}

import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import { connectDB } from "./config/db.js";

import tournamentRoutes from "./routes/tournamentRoutes.js";
import teamRoutes from "./routes/teamRoutes.js";
import playerRoutes from "./routes/playerRoutes.js";
import matchRoutes from "./routes/matchRoutes.js";
import { errorHandler } from "./middleware/errorHandler.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 5000;

// ---------- middleware ----------
app.use(cors({ origin: true }));
app.use(express.json());

// ---------- DB (non-fatal on failure) ----------
const MONGO_URI = process.env.MONGO_URI || "mongodb://127.0.0.1:27017";
try {
  await connectDB(MONGO_URI);
  console.log("[server] MongoDB connected");
} catch (err) {
  console.error("[server] Mongo connection failed:", err?.message || err);
  console.error("[server] Continuing to serve HTTP (DB-backed routes may fail).");
}

// ---------- health check (Electron waits for this) ----------
app.get("/healthz", (_req, res) => res.json({ ok: true }));

// ---------- API ROUTES ----------
app.use("/api/tournaments", tournamentRoutes);
app.use("/api/team", teamRoutes);
app.use("/api/players", playerRoutes);
app.use("/api/matches", matchRoutes);

// ---------- In-memory score (demo) ----------
let score = {
  matchId: "demo-123",
  teamA: "Team A",
  teamB: "Team B",
  runsA: 0,
  wicketsA: 0,
  runsB: 0,
  wicketsB: 0,
  overs: "0.0",
  runRate: "0.00",
  lastUpdated: new Date().toISOString(),
};

const clients = new Set();
function broadcastScore(data) {
  const payload = `data: ${JSON.stringify(data)}\n\n`;
  for (const res of clients) res.write(payload);
}

app.get("/api/score", (_req, res) => res.json(score));

app.post("/api/score", (req, res) => {
  const body = req.body || {};
  score = {
    ...score,
    ...Object.fromEntries(Object.entries(body).filter(([_, v]) => v !== undefined)),
    lastUpdated: new Date().toISOString(),
  };
  broadcastScore(score);
  res.json({ ok: true, score });
});

app.get("/sse", (req, res) => {
  res.set({
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-store",
    Connection: "keep-alive",
  });
  res.flushHeaders?.();
  res.write(`data: ${JSON.stringify(score)}\n\n`);
  clients.add(res);
  req.on("close", () => clients.delete(res));
});

// ---------- OBS overlay: scoreboard bar ----------
app.get("/overlay", (_req, res) => {
  const html = `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>OBS Overlay - Scoreboard</title>
<style>
  html, body { margin:0; padding:0; background:transparent; }
  .bar {
    font-family: system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif;
    width: 100vw; height: 90px; display:flex; align-items:center; justify-content:center;
    gap:24px; box-sizing:border-box; padding:10px 20px; color:#fff;
    background: linear-gradient(90deg, #111 0%, #222 100%);
    border-top:2px solid #00b4ff; border-bottom:2px solid #00b4ff;
  }
  .team { font-weight:700; font-size:28px; }
  .score { font-weight:700; font-size:28px; }
  .meta { font-size:18px; opacity:.9; }
  .dot { width:8px; height:8px; background:#00b4ff; border-radius:50%; display:inline-block; margin:0 10px; }
</style>
</head>
<body>
  <div class="bar" id="bar">
    <span class="team" id="teamA">Team A</span>
    <span class="score" id="scoreA">0/0</span>
    <span class="dot"></span>
    <span class="team" id="teamB">Team B</span>
    <span class="score" id="scoreB">0/0</span>
    <span class="dot"></span>
    <span class="meta" id="overs">Ov: 0.0</span>
    <span class="meta" id="rr">RR: 0.00</span>
  </div>
<script>
  function render(s) {
    teamA.textContent = s.teamA;
    teamB.textContent = s.teamB;
    scoreA.textContent = s.runsA + "/" + s.wicketsA;
    scoreB.textContent = s.runsB + "/" + s.wicketsB;
    overs.textContent  = "Ov: " + s.overs;
    rr.textContent     = "RR: " + s.runRate;
  }
  const es = new EventSource("/sse");
  es.onmessage = (e) => render(JSON.parse(e.data));
</script>
</body>
</html>`;
  res.set("Content-Type", "text/html; charset=utf-8").send(html);
});

// ---------- Current match info (SSE) ----------
let currentMatchInfo = {
  matchId: null,
  tournamentName: "",
  tournamentLogo: "",
  ground: "",
  team1: "",
  team1Logo: "",
  team2: "",
  team2Logo: "",
  matchNumber: "",
  overType: "",
  noOfOvers: "",
};

const matchClients = new Set();
function broadcastMatchInfo(data) {
  const payload = `data: ${JSON.stringify(data)}\n\n`;
  for (const res of matchClients) res.write(payload);
}

app.get("/api/current-match", (_req, res) => res.json(currentMatchInfo));

app.post("/api/current-match", (req, res) => {
  currentMatchInfo = { ...currentMatchInfo, ...req.body };
  broadcastMatchInfo(currentMatchInfo);
  res.json({ ok: true, currentMatchInfo });
});

app.get("/sse-match", (req, res) => {
  res.set({
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-store",
    Connection: "keep-alive",
  });
  res.flushHeaders?.();
  res.write(`data: ${JSON.stringify(currentMatchInfo)}\n\n`);
  matchClients.add(res);
  req.on("close", () => matchClients.delete(res));
});

// ---------- Overlay: match info bar ----------
app.get("/overlay/match", (_req, res) => {
  const html = `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>OBS Overlay - Match Info</title>
<style>
  html, body { margin:0; padding:0; background:transparent; }
  .bar {
    font-family: system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif;
    width: 100vw; min-height: 100px; 
    display:flex; flex-direction:column; align-items:center; justify-content:center;
    box-sizing:border-box; padding:8px 16px; color:#fff;
    background: linear-gradient(90deg, #111 0%, #222 100%);
    border-top:2px solid #ff9800; border-bottom:2px solid #ff9800;
    text-align: center;
  }
  .tournament { font-weight:700; font-size:22px; margin-bottom:8px; display:flex; align-items:center; gap:10px; }
  .tournament img { height:32px; }
  .teams { display:flex; align-items:center; gap:30px; margin-bottom:6px; }
  .team { display:flex; align-items:center; gap:10px; font-size:20px; font-weight:600; }
  .team img { height:40px; }
  .details { font-size:16px; opacity:0.9; }
</style>
</head>
<body>
  <div class="bar" id="bar">
    <div class="tournament">
      <img id="tournamentLogo" src="" alt="Tournament" />
      <span id="tournament">Tournament Name</span>
    </div>
    <div class="teams">
      <div class="team">
        <img id="team1Logo" src="" alt="Team 1" />
        <span id="team1">Team A</span>
      </div>
      <span>vs</span>
      <div class="team">
        <img id="team2Logo" src="" alt="Team 2" />
        <span id="team2">Team B</span>
      </div>
    </div>
    <div class="details">
      <span id="matchNo">Match #1</span> —
      <span id="place">Ground</span> —
      <span id="overs">6 balls/over, 20 overs</span>
    </div>
  </div>
<script>
  function render(m) {
    tournament.textContent = m.tournamentName || "—";
    tournamentLogo.src = m.tournamentLogo || "";
    team1.textContent = m.team1 || "—";
    team2.textContent = m.team2 || "—";
    team1Logo.src = m.team1Logo || "";
    team2Logo.src = m.team2Logo || "";
    matchNo.textContent = "Match #" + (m.matchNumber || "—");
    place.textContent = m.ground || "—";
    overs.textContent = (m.overType || "-") + " balls/over, " + (m.noOfOvers || "-") + " overs";
  }
  const es = new EventSource("/sse-match");
  es.onmessage = (e) => render(JSON.parse(e.data));
</script>
</body>
</html>`;
  res.set("Content-Type", "text/html; charset=utf-8").send(html);
});

// ---------- Overlay: FOUR ----------
app.get("/overlay/four", (_req, res) => {
  res.set("Content-Type", "text/html; charset=utf-8").send(`<!doctype html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>FOUR</title>
<style>
  html,body{margin:0;height:100%;background:transparent;overflow:hidden}
  .stage{position:fixed;inset:0;display:grid;place-items:center;
         background:radial-gradient(60vmin 60vmin at 50% 50%,rgba(0,200,255,.15),transparent 70%)}
  .badge{
    --glow:#00e1ff;
    font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif;
    font-weight:900;font-size:22vmin;line-height:1;color:#fff;letter-spacing:.02em;
    padding:.15em .6em;border-radius:2rem;border:4px solid rgba(0,225,255,.8);
    background:
      radial-gradient(120% 180% at 0% 0%,#003048 0%,#005a93 45%,#002033 100%);
    box-shadow:0 0 0 0 var(--glow),0 0 40px 6px rgba(0,225,255,.25) inset;
    transform:scale(.2) rotate(-8deg);
    filter:drop-shadow(0 8px 24px rgba(0,0,0,.55));
    animation:enter .55s cubic-bezier(.18,.89,.32,1.28) forwards,
             glow 2.2s ease-in-out .6s infinite alternate;
  }
  .label{font:700 3.4vmin system-ui;color:#dff9ff;text-align:center;margin-top:10px;
         text-shadow:0 2px 10px rgba(0,0,0,.45);letter-spacing:.08em}
  .confetti{position:absolute;inset:0;pointer-events:none;overflow:hidden}
  .p{
    position:absolute;top:50%;left:50%;width:.8vmin;height:3.2vmin;border-radius:.3vmin;
    transform-origin:center -8vmin;opacity:0;
    animation:shoot 1.2s ease-out forwards;
  }
  .p:nth-child(odd){height:2.6vmin}
  .p:nth-child(3n){height:3.6vmin}
  .p.c1{background:#00e1ff}.p.c2{background:#ffde59}.p.c3{background:#ff4d6d}.p.c4{background:#7cff87}
  @keyframes shoot{
    0%{opacity:0;transform:translate(-50%,-50%) rotate(var(--r)) scale(.3)}
    10%{opacity:1}
    100%{opacity:0;transform:translate(calc(-50% + var(--dx)),calc(-50% + var(--dy))) rotate(var(--r)) scale(1)}
  }
  @keyframes enter{to{transform:scale(1) rotate(0)}}
  @keyframes glow{to{box-shadow:0 0 22px 6px var(--glow),0 0 60px 10px rgba(0,225,255,.35) inset}}
</style></head>
<body>
  <div class="stage">
    <div>
      <div class="badge">4</div>
      <div class="label">FOUR!</div>
    </div>
    <div class="confetti" id="c"></div>
  </div>
<script>
  const c = document.getElementById('c');
  const N = 40;
  for (let i=0;i<N;i++){
    const p = document.createElement('div');
    p.className = 'p c'+(1+(i%4));
    const a = (i/N)*Math.PI*2, r = 22 + Math.random()*25;
    p.style.setProperty('--r', (a*180/Math.PI)+'deg');
    p.style.setProperty('--dx',  Math.cos(a)*r+'vmin');
    p.style.setProperty('--dy',  Math.sin(a)*r+'vmin');
    p.style.animationDelay = (Math.random()*0.2)+'s';
    c.appendChild(p);
  }
</script>
</body></html>`);
});

// ---------- Overlay: SIX ----------
app.get("/overlay/six", (_req, res) => {
  res.set("Content-Type", "text/html; charset=utf-8").send(`<!doctype html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>SIX</title>
<style>
  html,body{margin:0;height:100%;background:transparent;overflow:hidden}
  .sky{position:fixed;inset:0;display:grid;place-items:center;
       background:radial-gradient(70vmin 70vmin at 50% 50%,rgba(255,255,255,.06),transparent 70%)}
  .ring{position:absolute;border-radius:50%;border:7px solid rgba(255,255,255,.28);animation:pulse 1.8s ease-out infinite}
  .r1{width:40vmin;height:40vmin}
  .r2{width:60vmin;height:60vmin;animation-delay:.25s}
  .r3{width:80vmin;height:80vmin;animation-delay:.5s}
  @keyframes pulse{from{transform:scale(.6);opacity:.6}to{transform:scale(1.25);opacity:0}}
  .trail{position:absolute;inset:0;pointer-events:none;overflow:hidden}
  .star{position:absolute;width:1.2vmin;height:1.2vmin;background:#fff;border-radius:50%;
        box-shadow:0 0 16px 6px rgba(255,255,255,.6);
        transform:translate(-50%,-50%);opacity:0;animation:fly 1.1s ease-out forwards}
  @keyframes fly{
    0%{opacity:0;transform:translate(10% ,110%) scale(.4)}
    10%{opacity:1}
    100%{opacity:0;transform:translate(80%,-20%) scale(1)}
  }
  .badge{
    font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif;
    font-weight:1000;font-size:24vmin;color:#fff;letter-spacing:.02em;
    padding:.15em .7em;border-radius:2rem;border:4px solid rgba(255,255,255,.6);
    background:linear-gradient(135deg,#1b0030,#7d00d4);
    text-shadow:0 6px 24px rgba(0,0,0,.55);
    filter:drop-shadow(0 10px 26px rgba(0,0,0,.55));
    transform:scale(.25) rotate(-10deg);
    animation:pop .6s cubic-bezier(.18,.89,.32,1.28) forwards, wobble 2.2s ease-in-out .7s infinite;
  }
  .label{font:800 3.6vmin system-ui;color:#ffe9ff;text-align:center;margin-top:10px;letter-spacing:.1em}
  @keyframes pop{to{transform:scale(1) rotate(0)}}
  @keyframes wobble{0%,100%{transform:scale(1) rotate(0)}50%{transform:scale(1.04) rotate(.6deg)}}
</style></head>
<body>
  <div class="sky">
    <div class="ring r1"></div><div class="ring r2"></div><div class="ring r3"></div>
    <div>
      <div class="badge">6</div>
      <div class="label">SIX!</div>
    </div>
    <div class="trail" id="t"></div>
  </div>
<script>
  const t = document.getElementById('t');
  for(let i=0;i<10;i++){
    const s=document.createElement('div'); s.className='star';
    s.style.left = (10 + i*8)+'%'; s.style.top = (100 - i*10)+'%';
    s.style.animationDelay = (i*0.04)+'s';
    t.appendChild(s);
  }
</script>
</body></html>`);
});

// ---------- Overlay: WICKET (no white flash) ----------
app.get("/overlay/wicket", (_req, res) => {
  res
    .set("Content-Type", "text/html; charset=utf-8")
    .send(`<!doctype html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>WICKET</title>
<style>
  html,body{margin:0;height:100%;background:transparent;overflow:hidden}
  .field{
    position:fixed;inset:0;display:grid;place-items:center;
    background:radial-gradient(65vmin 65vmin at 50% 50%,rgba(255,0,76,.17),transparent 70%);
  }
  .badge{
    font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif;
    font-weight:1000;letter-spacing:.08em;
    font-size:16vmin;color:#fff;
    padding:.35em 1.1em;border-radius:1.6rem;border:4px solid rgba(255,86,120,.95);
    background:linear-gradient(135deg,#2a0000,#b0002b 55%,#510010 100%);
    text-shadow:0 6px 22px rgba(0,0,0,.55);
    filter:drop-shadow(0 12px 26px rgba(0,0,0,.6));
    transform:translateY(-28px) scale(.96);
    animation:drop .55s cubic-bezier(.2,.9,.25,1.4) forwards,
             shake .9s ease-in-out .55s 1;
  }
  .label{
    font:800 3.4vmin system-ui;color:#ffd6df;text-align:center;margin-top:10px;letter-spacing:.1em
  }
  @keyframes drop{to{transform:translateY(0) scale(1)}}
  @keyframes shake{
    0%,100%{transform:translateY(0)}
    20%{transform:translate(-6px,0) rotate(-1.2deg)}
    40%{transform:translate(6px,0) rotate(1.2deg)}
    60%{transform:translate(-4px,0) rotate(-.8deg)}
    80%{transform:translate(4px,0) rotate(.8deg)}
  }
  .shards{position:absolute;inset:0;pointer-events:none}
  .shard{
    position:absolute;top:50%;left:50%;
    width:1.2vmin;height:6vmin;background:linear-gradient(#ff6b88,#ff2e54);
    transform-origin:50% 120%; border-radius:.4vmin; opacity:0;
    box-shadow:0 0 10px rgba(255,50,90,.5);
    animation:burst 1s ease-out forwards;
  }
  .shard:nth-child(2n){height:4.6vmin}
  .shard:nth-child(3n){background:linear-gradient(#ffd1da,#ff6b88)}
  @keyframes burst{
    0%{opacity:0;transform:translate(-50%,-50%) rotate(var(--a)) scale(.4)}
    15%{opacity:1}
    100%{opacity:0;transform:translate(calc(-50% + var(--x)),calc(-50% + var(--y)))
                         rotate(var(--a)) scale(1)}
  }
</style>
</head>
<body>
  <div class="field">
    <div>
      <div class="badge">W</div>
      <div class="label">WICKET!</div>
    </div>
    <div class="shards" id="s"></div>
  </div>
<script>
  const s = document.getElementById('s');
  const N = 28;
  for(let i=0;i<N;i++){
    const e = document.createElement('div'); e.className='shard';
    const ang = (i/N)*Math.PI*2, dist = 18 + Math.random()*18;
    e.style.setProperty('--a', (ang*180/Math.PI)+'deg');
    e.style.setProperty('--x', Math.cos(ang)*dist+'vmin');
    e.style.setProperty('--y', Math.sin(ang)*dist+'vmin');
    e.style.animationDelay = (i*0.01)+'s';
    s.appendChild(e);
  }
</script>
</body>
</html>`);
});

// uppercase alias
app.get("/overlay/Wicket", (req, res) => res.redirect(302, "/overlay/wicket"));

// ---------- Serve built React when Electron provides the path ----------
const distFromElectron = process.env.FRONTEND_DIST;
if (distFromElectron) {
  console.log("[server] Serving admin UI from:", distFromElectron);
  app.use(express.static(distFromElectron));
  app.get("/", (_req, res) => {
    res.sendFile(path.join(distFromElectron, "index.html"));
  });
}

// ---------- Errors ----------
app.use(errorHandler);

// ---------- Start ----------
app.listen(PORT, () => {
  console.log(`Scoreboard backend → http://localhost:${PORT}`);
  console.log(`Overlay for OBS   → http://localhost:${PORT}/overlay`);
});
