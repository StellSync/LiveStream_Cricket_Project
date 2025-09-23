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

// ---------- health check ----------
app.get("/healthz", (_req, res) => res.json({ ok: true }));

// ---------- API ROUTES ----------
app.use("/api/tournaments", tournamentRoutes);
app.use("/api/team", teamRoutes);
app.use("/api/players", playerRoutes);
app.use("/api/matches", matchRoutes);

// ---------- Legacy demo score (kept for compatibility) ----------
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

// ---------- Legacy simple overlay (kept) ----------
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

// ---------- Current match info (logos, ground, overs, etc.) ----------
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

// ---------- (RESTORED) MATCH HEADER OVERLAY ----------
app.get("/overlay/match", (_req, res) => {
  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>OBS Overlay – Match Intro</title>
<style>
  html,body{
    margin:0;padding:0;height:100%;width:100%;
    background:linear-gradient(180deg, #0d1b2a 0%, #1b263b 100%);
    overflow:hidden;
  }
  *{box-sizing:border-box}

  :root{
    --accent:#ffb703; /* golden accent */
    --txt:#ffffff;
    --mut:#dce3ec;
    --shadow:rgba(0,0,0,.5);
  }

  .stage{
    position:fixed; inset:0;
    display:flex; flex-direction:column; align-items:center; justify-content:flex-start;
    font-family:"Segoe UI",Roboto,Inter,sans-serif;
    color:var(--txt);
  }

  /* Tournament */
  .tour{
    margin-top:4vh;
    display:flex; align-items:center; gap:18px;
    font-weight:900; font-size:clamp(26px,4.5vmin,60px);
    letter-spacing:.03em; text-transform:uppercase;
    text-shadow:0 3px 6px rgba(0,0,0,.6);
  }
  .tour-logo{
    height:clamp(60px,8vmin,110px);
    border-radius:12px;
    box-shadow:0 4px 16px var(--shadow);
  }
  .rule{
    margin-top:10px;
    width:min(700px,80%); height:5px;
    background:linear-gradient(90deg,transparent,var(--accent),transparent);
    border-radius:999px;
    filter:drop-shadow(0 0 10px var(--accent));
  }

  /* Teams */
  .teams{
    margin-top:8vh;
    display:grid; grid-template-columns:1fr auto 1fr;
    align-items:end; gap:60px;
    width:100%;
  }
  .team{display:flex; flex-direction:column; align-items:center; gap:20px;}
  .logo{
    height:clamp(170px,24vmin,300px);
    width:clamp(170px,24vmin,300px);
    border-radius:16px; object-fit:contain;
    background:#fff;
    box-shadow:0 6px 22px rgba(0,0,0,.5);
  }
  .name{
    font-weight:1000;
    font-size:clamp(36px,6vmin,90px);
    text-transform:uppercase;
    text-shadow:0 4px 8px rgba(0,0,0,.7);
  }

  /* VS badge */
  .vs{
    align-self:center;
    display:grid; place-items:center;
    min-width:90px; height:90px;
    border-radius:50%;
    font-weight:900; font-size:clamp(28px,4vmin,46px);
    color:#000;
    background:radial-gradient(circle at center, var(--accent) 0%, #ff7300 100%);
    box-shadow:0 0 20px rgba(255,183,3,.8);
  }

  /* Details */
  .details{
    margin-top:6vh;
    display:flex; flex-wrap:wrap; gap:20px; justify-content:center;
    color:var(--mut);
    font-size:clamp(20px,3vmin,38px);
    font-weight:700;
    text-shadow:0 3px 6px rgba(0,0,0,.7);
  }
  .sep{opacity:.7}
</style>
</head>
<body>
  <div class="stage">
    <!-- Tournament -->
    <div class="tour">
      <img id="tournamentLogo" class="tour-logo" alt="">
      <span id="tournament">TOURNAMENT NAME</span>
    </div>
    <div class="rule"></div>

    <!-- Teams -->
    <div class="teams">
      <div class="team">
        <img id="team1Logo" class="logo" alt="">
        <div class="name" id="team1">TEAM A</div>
      </div>
      <div class="vs">VS</div>
      <div class="team">
        <img id="team2Logo" class="logo" alt="">
        <div class="name" id="team2">TEAM B</div>
      </div>
    </div>

    <!-- Details -->
    <div class="details">
      <span id="matchNo">MATCH #1</span>
      <span class="sep">•</span>
      <span id="place">GROUND</span>
      <span class="sep">•</span>
      <span id="overs">6 BALLS/OVER, 20 OVERS</span>
    </div>
  </div>

<script>
  function setLogo(el,src){ if(src){el.src=src}else{el.removeAttribute('src')} }
  function render(m){
    tournament.textContent=(m.tournamentName||"—").toUpperCase();
    setLogo(tournamentLogo,m.tournamentLogo||"");
    team1.textContent=(m.team1||"—").toUpperCase();
    team2.textContent=(m.team2||"—").toUpperCase();
    setLogo(team1Logo,m.team1Logo||"");
    setLogo(team2Logo,m.team2Logo||"");
    matchNo.textContent="MATCH #"+(m.matchNumber||"—");
    place.textContent=(m.ground||"—").toUpperCase();
    overs.textContent=((m.overType||"-")+" BALLS/OVER, "+(m.noOfOvers||"-")+" OVERS").toUpperCase();
  }
  const es=new EventSource("/sse-match");
  es.onmessage=e=>render(JSON.parse(e.data));
</script>
</body>
</html>`;
  res.set("Content-Type","text/html; charset=utf-8").send(html);
});







// ---------- Event overlays (UPGRADED ANIMATIONS) ----------
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
    font-weight:1000;font-size:22vmin;line-height:1;color:#fff;letter-spacing:.02em;
    padding:.15em .6em;border-radius:2rem;border:5px solid rgba(0,225,255,.9);
    background:
      radial-gradient(120% 180% at 0% 0%,#003048 0%,#005a93 45%,#002033 100%);
    box-shadow:0 0 0 0 var(--glow),0 0 40px 6px rgba(0,225,255,.25) inset,0 10px 35px rgba(0,0,0,.55);
    transform:scale(.2) rotate(-8deg);
    filter:drop-shadow(0 8px 24px rgba(0,0,0,.55));
    animation:enter .55s cubic-bezier(.18,.89,.32,1.28) forwards,
             glow 2s ease-in-out .6s infinite alternate,
             wobble 2.2s ease-in-out 1.1s infinite;
  }
  .label{font:900 3.8vmin system-ui;color:#dff9ff;text-align:center;margin-top:10px;
         text-shadow:0 2px 10px rgba(0,0,0,.45);letter-spacing:.08em}
  .confetti{position:absolute;inset:0;pointer-events:none;overflow:hidden}
  .p{
    position:absolute;top:50%;left:50%;width:1vmin;height:3.6vmin;border-radius:.3vmin;
    transform-origin:center -8vmin;opacity:0;
    animation:shoot 1.15s ease-out forwards;
  }
  .p:nth-child(odd){height:2.8vmin}
  .p:nth-child(3n){height:4vmin}
  .trail{
    position:absolute;inset:0;pointer-events:none
  }
  .meteor{
    position:absolute;width:1.2vmin;height:1.2vmin;border-radius:50%;background:#fff;
    box-shadow:0 0 16px 6px rgba(255,255,255,.6);
    opacity:0; animation:meteor 1.1s ease-out forwards;
  }
  .p.c1{background:#00e1ff}.p.c2{background:#ffde59}.p.c3{background:#ff4d6d}.p.c4{background:#7cff87}
  @keyframes shoot{
    0%{opacity:0;transform:translate(-50%,-50%) rotate(var(--r)) scale(.3)}
    12%{opacity:1}
    100%{opacity:0;transform:translate(calc(-50% + var(--dx)),calc(-50% + var(--dy))) rotate(var(--r)) scale(1)}
  }
  @keyframes enter{to{transform:scale(1) rotate(0)}}
  @keyframes glow{to{box-shadow:0 0 22px 6px var(--glow),0 0 60px 10px rgba(0,225,255,.35) inset}}
  @keyframes wobble{0%,100%{transform:rotate(0)}50%{transform:rotate(.8deg)}}
  @keyframes meteor{
    0%{opacity:0;transform:translate(10%,110%) scale(.5)}
    10%{opacity:1}
    100%{opacity:0;transform:translate(80%,-20%) scale(1)}
  }
</style></head>
<body>
  <div class="stage">
    <div>
      <div class="badge">4</div>
      <div class="label">FOUR!</div>
    </div>
    <div class="confetti" id="c"></div>
    <div class="trail" id="t"></div>
  </div>
<script>
  const c = document.getElementById('c');
  const t = document.getElementById('t');
  const N = 80; // more confetti
  for (let i=0;i<N;i++){
    const p = document.createElement('div');
    p.className = 'p c'+(1+(i%4));
    const a = (i/N)*Math.PI*2, r = 20 + Math.random()*35;
    p.style.setProperty('--r', (a*180/Math.PI)+'deg');
    p.style.setProperty('--dx',  Math.cos(a)*r+'vmin');
    p.style.setProperty('--dy',  Math.sin(a)*r+'vmin');
    p.style.animationDelay = (Math.random()*0.25)+'s';
    c.appendChild(p);
  }
  for(let i=0;i<14;i++){
    const s=document.createElement('div'); s.className='meteor';
    s.style.left = (6 + i*7)+'%'; s.style.top = (100 - i*9)+'%';
    s.style.animationDelay = (i*0.05)+'s';
    t.appendChild(s);
  }
</script>
</body></html>`);
});

app.get("/overlay/six", (_req, res) => {
  res.set("Content-Type", "text/html; charset=utf-8").send(`<!doctype html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>SIX</title>
<style>
  html,body{margin:0;height:100%;background:transparent;overflow:hidden}
  .sky{position:fixed;inset:0;display:grid;place-items:center;
       background:radial-gradient(70vmin 70vmin at 50% 50%,rgba(255,255,255,.08),transparent 70%)}
  .ring{position:absolute;border-radius:50%;border:7px solid rgba(255,255,255,.28);animation:pulse 1.6s ease-out infinite}
  .r1{width:40vmin;height:40vmin}
  .r2{width:60vmin;height:60vmin;animation-delay:.2s}
  .r3{width:80vmin;height:80vmin;animation-delay:.4s}
  .r4{width:100vmin;height:100vmin;animation-delay:.6s}
  @keyframes pulse{from{transform:scale(.6);opacity:.6}to{transform:scale(1.35);opacity:0}}
  .trail{position:absolute;inset:0;pointer-events:none;overflow:hidden}
  .star{position:absolute;width:1.2vmin;height:1.2vmin;background:#fff;border-radius:50%;
        box-shadow:0 0 16px 6px rgba(255,255,255,.6);
        transform:translate(-50%,-50%);opacity:0;animation:fly 1.05s ease-out forwards}
  @keyframes fly{
    0%{opacity:0;transform:translate(10% ,110%) scale(.45)}
    10%{opacity:1}
    100%{opacity:0;transform:translate(85%,-25%) scale(1)}
  }
  .badge{
    font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif;
    font-weight:1000;font-size:24vmin;color:#fff;letter-spacing:.02em;
    padding:.15em .7em;border-radius:2rem;border:5px solid rgba(255,255,255,.7);
    background:conic-gradient(from 210deg,#33004b,#8a00ff,#33004b);
    text-shadow:0 6px 24px rgba(0,0,0,.55);
    filter:drop-shadow(0 10px 26px rgba(0,0,0,.55));
    transform:scale(.25) rotate(-10deg);
    animation:pop .5s cubic-bezier(.18,.89,.32,1.28) forwards, wobble 2.2s ease-in-out .6s infinite;
  }
  .label{font:900 3.6vmin system-ui;color:#ffe9ff;text-align:center;margin-top:10px;letter-spacing:.1em}
  @keyframes pop{to{transform:scale(1) rotate(0)}}
  @keyframes wobble{0%,100%{transform:scale(1) rotate(0)}50%{transform:scale(1.04) rotate(.6deg)}}
  .sparks{position:absolute;inset:0;pointer-events:none}
  .spark{
    position:absolute;top:50%;left:50%;width:.8vmin;height:.8vmin;border-radius:50%;
    background:radial-gradient(#fff,#ffd3ff);
    opacity:0; animation:spark 1s ease-out forwards;
  }
  @keyframes spark{
    0%{opacity:0;transform:translate(-50%,-50%) scale(.4)}
    15%{opacity:1}
    100%{opacity:0;transform:translate(calc(-50% + var(--sx)),calc(-50% + var(--sy))) scale(1)}
  }
</style></head>
<body>
  <div class="sky">
    <div class="ring r1"></div><div class="ring r2"></div><div class="ring r3"></div><div class="ring r4"></div>
    <div>
      <div class="badge">6</div>
      <div class="label">SIX!</div>
    </div>
    <div class="trail" id="t"></div>
    <div class="sparks" id="sp"></div>
  </div>
<script>
  const t = document.getElementById('t');
  for(let i=0;i<14;i++){
    const s=document.createElement('div'); s.className='star';
    s.style.left = (8 + i*7)+'%'; s.style.top = (100 - i*8)+'%';
    s.style.animationDelay = (i*0.045)+'s';
    t.appendChild(s);
  }
  const sp = document.getElementById('sp');
  for(let i=0;i<40;i++){
    const s=document.createElement('div'); s.className='spark';
    const ang = (i/40)*Math.PI*2, dist = 14 + Math.random()*22;
    s.style.setProperty('--sx', Math.cos(ang)*dist+'vmin');
    s.style.setProperty('--sy', Math.sin(ang)*dist+'vmin');
    s.style.animationDelay = (Math.random()*0.2)+'s';
    sp.appendChild(s);
  }
</script>
</body></html>`);
});

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
    background:
      radial-gradient(65vmin 65vmin at 50% 50%,rgba(255,0,76,.18),transparent 70%),
      radial-gradient(30vmin 30vmin at 20% 85%,rgba(255,80,120,.15),transparent 70%),
      radial-gradient(30vmin 30vmin at 80% 20%,rgba(255,80,120,.12),transparent 70%);
  }
  .badge{
    font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif;
    font-weight:1000;letter-spacing:.08em;
    font-size:16vmin;color:#fff;
    padding:.35em 1.1em;border-radius:1.6rem;border:5px solid rgba(255,86,120,.95);
    background:linear-gradient(135deg,#2a0000,#b0002b 55%,#510010 100%);
    text-shadow:0 6px 22px rgba(0,0,0,.55);
    filter:drop-shadow(0 12px 26px rgba(0,0,0,.6));
    transform:translateY(-28px) scale(.96);
    animation:drop .5s cubic-bezier(.2,.9,.25,1.4) forwards,
             quake 1s ease-in-out .5s 1,
             pulse 1.4s ease-in-out 1.4s 3;
  }
  .label{
    font:900 3.4vmin system-ui;color:#ffd6df;text-align:center;margin-top:10px;letter-spacing:.1em
  }
  @keyframes drop{to{transform:translateY(0) scale(1)}}
  @keyframes quake{
    0%,100%{transform:translate(0,0)}
    20%{transform:translate(-10px,0) rotate(-1.4deg)}
    40%{transform:translate(10px,0) rotate(1.4deg)}
    60%{transform:translate(-6px,0) rotate(-.8deg)}
    80%{transform:translate(6px,0) rotate(.8deg)}
  }
  @keyframes pulse{
    0%{box-shadow:0 0 0 0 rgba(255,86,120,.7)}
    100%{box-shadow:0 0 0 24px rgba(255,86,120,0)}
  }
  .shards{position:absolute;inset:0;pointer-events:none}
  .shard{
    position:absolute;top:50%;left:50%;
    width:1.2vmin;height:6vmin;background:linear-gradient(#ff6b88,#ff2e54);
    transform-origin:50% 120%; border-radius:.4vmin; opacity:0;
    box-shadow:0 0 10px rgba(255,50,90,.5);
    animation:burst 1.05s ease-out forwards;
  }
  .shard:nth-child(2n){height:4.6vmin}
  .shard:nth-child(3n){background:linear-gradient(#ffd1da,#ff6b88)}
  @keyframes burst{
    0%{opacity:0;transform:translate(-50%,-50%) rotate(var(--a)) scale(.4)}
    15%{opacity:1}
    100%{opacity:0;transform:translate(calc(-50% + var(--x)),calc(-50% + var(--y)))
                         rotate(var(--a)) scale(1)}
  }
  .dust{position:absolute;inset:0;pointer-events:none}
  .d{
    position:absolute;top:50%;left:50%;width:10vmin;height:10vmin;border-radius:50%;
    background:radial-gradient(rgba(255,86,120,.25),rgba(255,86,120,0) 70%);
    opacity:0;animation:dust 1.4s ease-out forwards;
  }
  @keyframes dust{
    0%{opacity:0;transform:translate(-50%,-50%) scale(.6)}
    20%{opacity:1}
    100%{opacity:0;transform:translate(-50%,-50%) scale(1.8)}
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
    <div class="dust" id="dust"></div>
  </div>
<script>
  const s = document.getElementById('s');
  const N = 44; // more shards
  for(let i=0;i<N;i++){
    const e = document.createElement('div'); e.className='shard';
    const ang = (i/N)*Math.PI*2, dist = 18 + Math.random()*20;
    e.style.setProperty('--a', (ang*180/Math.PI)+'deg');
    e.style.setProperty('--x', Math.cos(ang)*dist+'vmin');
    e.style.setProperty('--y', Math.sin(ang)*dist+'vmin');
    e.style.animationDelay = (i*0.008)+'s';
    s.appendChild(e);
  }
  const d = document.getElementById('dust');
  for(let i=0;i<3;i++){
    const c=document.createElement('div'); c.className='d';
    c.style.animationDelay = (0.5 + i*0.1)+'s';
    d.appendChild(c);
  }
</script>
</body>
</html>`);
});
app.get("/overlay/Wicket", (req, res) => res.redirect(302, "/overlay/wicket"));

// ============================================================================
// Live overlay state for scorebars (same structure as before)
// ============================================================================
let overlayState = {
  matchId: null,

  // teams
  battingTeam: "",
  battingTeamLogo: "",
  bowlingTeam: "",
  bowlingTeamLogo: "",

  // totals
  runs: 0,
  wickets: 0,
  overs: 0,     // completed overs (integer)
  balls: 0,     // balls in current over (0..ballsPerOver-1)
  ballsPerOver: 6,
  runRate: "0.00",

  // players
  striker:     { name: "", runs: 0, balls: 0 },
  nonStriker:  { name: "", runs: 0, balls: 0 },

  // bowler
  bowler: { name: "", wickets: 0, overs: 0, runs: 0 },

  // current-over bubbles (e.g., ["1","1","Wd1","Nb0","W","4"])
  overBalls: [],
};

const overlayClients = new Set();
function broadcastOverlay(data) {
  const payload = `data: ${JSON.stringify(data)}\n\n`;
  for (const res of overlayClients) res.write(payload);
}

app.get("/api/overlay", (_req, res) => res.json(overlayState));

app.post("/api/overlay", (req, res) => {
  const b = req.body || {};
  overlayState = {
    ...overlayState,
    ...Object.fromEntries(Object.entries(b).filter(([_, v]) => v !== undefined)),
    striker:     { ...overlayState.striker,    ...(b.striker || {}) },
    nonStriker:  { ...overlayState.nonStriker, ...(b.nonStriker || {}) },
    bowler:      { ...overlayState.bowler,     ...(b.bowler || {}) },
    overBalls:   Array.isArray(b.overBalls) ? b.overBalls : overlayState.overBalls,
  };
  // Auto-calc RR if not supplied
  const bpo = Number(overlayState.ballsPerOver || 6);
  const tovers = Number(overlayState.overs || 0) + Number(overlayState.balls || 0)/bpo;
  if (!b.runRate) {
    overlayState.runRate = tovers > 0 ? (Number(overlayState.runs || 0) / tovers).toFixed(2) : "0.00";
  }
  broadcastOverlay(overlayState);
  res.json({ ok: true, overlay: overlayState });
});

app.get("/sse-overlay", (req, res) => {
  res.set({
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-store",
    Connection: "keep-alive",
  });
  res.flushHeaders?.();
  res.write(`data: ${JSON.stringify(overlayState)}\n\n`);
  overlayClients.add(res);
  req.on("close", () => overlayClients.delete(res));
});

// ============================================================================
// SCOREBAR THEME #1 (Glass + Indigo)  → /overlay/scorebar
// ============================================================================
app.get("/overlay/scorebar", (_req, res) => {
  res.set("Content-Type", "text/html; charset=utf-8").send(`<!doctype html>
<html>
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>Scorebar</title>
<style>
  html,body{margin:0;background:transparent}
  *{box-sizing:border-box}
  :root{
    --bg-grad: linear-gradient(120deg, rgba(8,13,33,.55), rgba(10,22,61,.55));
    --glass: rgba(255,255,255,.14);
    --stroke: rgba(255,255,255,.25);
    --accent: #ef4444; /* red score pill */
    --chip:#14b8a6;    /* teal chips */
    --mut:#94a3b8;
    --glow: 0 8px 28px rgba(0,0,0,.35);
  }

  .wrap{
    width:100vw;
    padding:10px 16px;
    font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif;
    display:flex;align-items:center;justify-content:center;gap:14px;
    color:#e5ecff;
    background: radial-gradient(60vmin 60vmin at 50% 50%, rgba(255,255,255,.05), transparent 70%);
  }

  .card{
    background: var(--bg-grad);
    border: 1px solid var(--stroke);
    border-radius:18px;
    padding:10px 12px;
    min-width:300px;
    display:flex;align-items:center;gap:12px;
    box-shadow: var(--glow);
    backdrop-filter: blur(12px) saturate(1.2);
  }
  .teamlogo, .opp-logo{
    width:44px;height:44px;border-radius:10px;background:#0b1027;object-fit:contain;
    box-shadow:0 0 0 1px rgba(255,255,255,.12), 0 2px 10px rgba(0,0,0,.35);
  }
  .bats{display:flex;flex-direction:column;gap:3px;min-width:0}
  .line{display:flex;align-items:center;gap:8px;white-space:nowrap}
  .nm{font-weight:900;font-size:14px;max-width:18ch;overflow:hidden;text-overflow:ellipsis}
  .fig{font-weight:900;font-size:14px}
  .strike{width:8px;height:8px;border-radius:50%;background:#22d3ee;box-shadow:0 0 10px #22d3ee}

  .pillbox{display:flex;flex-direction:column;align-items:center;gap:8px;flex:1 1 auto;min-width:460px}
  .pill{
    position:relative;display:flex;align-items:center;gap:0;overflow:hidden;
    border-radius:18px;color:#fff;box-shadow: var(--glow);
    border:1px solid var(--stroke);
    background:
      linear-gradient(180deg, rgba(48,59,130,.85), rgba(22,33,99,.9)),
      var(--bg-grad);
    backdrop-filter: blur(10px) saturate(1.2);
  }
  .shine{
    position:absolute;inset:0;pointer-events:none;
    background: linear-gradient(90deg, transparent, rgba(255,255,255,.18), transparent);
    transform: translateX(-120%);
    animation: shine 6s linear infinite;
  }
  @keyframes shine{
    0%{transform: translateX(-120%)}
    50%{transform: translateX(120%)}
    100%{transform: translateX(120%)}
  }

  .pill .match{
    padding:10px 12px;font-weight:900;font-size:13px;letter-spacing:.05em;opacity:.95
  }
  .pill .score{

  }
  .ov-badge{
    background:rgba(12,19,59,.8);
    color:#dbeafe;
    font:900 11px/1 system-ui;
    padding:6px 10px;border-radius:12px;margin-left:8px;border:1px solid rgba(255,255,255,.16)
  }
  .chiprow{display:flex;align-items:center;gap:6px;min-height:24px}
  .chip{width:24px;height:24px;border-radius:50%;display:grid;place-items:center;
        font:1000 11px/1 system-ui;color:#fff;box-shadow:0 2px 10px rgba(0,0,0,.35)}
  .chip.r{background:var(--chip)}
  .chip.wd{background:#fb8c00}
  .chip.nb{background:#8e24aa}
  .chip.w{background:#ef4444}

  .rr{
    background:linear-gradient(90deg,rgba(14,42,122,.9),rgba(10,29,83,.95));
    color:#cfe0ff;border-radius:10px;padding:6px 12px;font-weight:900;font-size:12px;letter-spacing:.08em;
    border:1px solid var(--stroke);
    box-shadow: var(--glow);
  }

  .right .bwl{display:flex;flex-direction:column;gap:3px;min-width:0}
  .right .nm{max-width:16ch}

</style>
</head>
<body>
  <div class="wrap">
    <div class="card left">
      <img id="bLogo" class="teamlogo" alt="">
      <div class="bats">
        <div class="line">
          <span class="strike" id="strikeDot" style="visibility:hidden"></span>
          <span class="nm" id="b1Name">—</span>
          <span class="fig" id="b1Fig">0 (0)</span>
        </div>
        <div class="line mut">
          <span class="nm" id="b2Name">—</span>
          <span class="fig" id="b2Fig">0 (0)</span>
        </div>
      </div>
    </div>

    <div class="pillbox">
      <div class="pill" id="pill">
        <span class="shine"></span>
        <div class="match" id="mt">— v —</div>
        <div class="score" id="scorePill">
          <span id="tot">0-0</span>
          <span class="ov-badge" id="ovb">0.0 overs</span>
        </div>
      </div>
      <div class="chiprow" id="chips"></div>
      <div class="rr" id="rr">RUN RATE 0.00</div>
    </div>

    <div class="card right">
      <div class="bwl">
        <div class="line">
          <span class="nm" id="bowlerName">—</span>
          <span class="fig" id="bowlerFig">0-0-0</span>
        </div>
        <div class="line mut">
          <span id="fieldTeam">—</span>
        </div>
      </div>
      <img id="fLogo" class="opp-logo" alt="">
    </div>
  </div>

<script>
  const $ = (id) => document.getElementById(id);
  const bLogo=$('bLogo'), b1Name=$('b1Name'), b1Fig=$('b1Fig'),
        b2Name=$('b2Name'), b2Fig=$('b2Fig'), strikeDot=$('strikeDot');
  const mt=$('mt'), tot=$('tot'), ovb=$('ovb'), rr=$('rr'), chips=$('chips');
  const bowlerName=$('bowlerName'), bowlerFig=$('bowlerFig'),
        fieldTeam=$('fieldTeam'), fLogo=$('fLogo'), scorePill=$('scorePill');

  let last = { runs:0, wickets:0 };

  function mkChip(label){
    const d=document.createElement('div'); d.className='chip r'; d.textContent=label;
    if(label==='W'){ d.className='chip w'; }
    else if(label.startsWith('Wd')){ d.className='chip wd'; }
    else if(label.startsWith('Nb')){ d.className='chip nb'; }
    return d;
  }

  function render(s){
    const batCode = (s.battingTeam||'').toUpperCase();
    const fldCode = (s.bowlingTeam||'').toUpperCase();
    mt.textContent = batCode + ' v ' + fldCode;

    // flash when total or wickets change
    if (s.runs!==last.runs || s.wickets!==last.wickets) {
      scorePill.classList.remove('flash');
      void scorePill.offsetWidth; // restart animation
      scorePill.classList.add('flash');
      last = { runs:s.runs, wickets:s.wickets };
    }

    tot.textContent = (s.runs||0) + '-' + (s.wickets||0);
    ovb.textContent = (s.overs||0) + '.' + (s.balls||0) + ' overs';
    rr.textContent = 'RUN RATE ' + (s.runRate || '0.00');

    chips.innerHTML = '';
    (s.overBalls||[]).forEach(b => chips.appendChild(mkChip(b)));

    const st = s.striker || {};
    const ns = s.nonStriker || {};
    strikeDot.style.visibility = (st.name ? 'visible' : 'hidden');
    b1Name.textContent = (st.name||'').toUpperCase();
    b1Fig.textContent  = (st.runs||0) + ' (' + (st.balls||0) + ')';
    b2Name.textContent = (ns.name||'').toUpperCase();
    b2Fig.textContent  = (ns.runs||0) + ' (' + (ns.balls||0) + ')';

    bLogo.src = s.battingTeamLogo || '';
    fLogo.src = s.bowlingTeamLogo || '';

    bowlerName.textContent = (s.bowler?.name||'').toUpperCase();
    bowlerFig.textContent  = (s.bowler?.wickets||0) + '-' + (s.bowler?.overs||0) + '-' + (s.bowler?.runs||0);
    fieldTeam.textContent  = fldCode || '—';
  }

  const es = new EventSource('/sse-overlay');
  es.onmessage = (e) => render(JSON.parse(e.data));
</script>
</body>
</html>`);
});

// ============================================================================
// SCOREBAR THEME #2 (Neon + Dark) → /overlay/scorebar-neon
// Same data feed, different colors/feel for easy OBS switching
// ============================================================================
app.get("/overlay/scorebar-neon", (_req, res) => {
  res.set("Content-Type", "text/html; charset=utf-8").send(`<!doctype html>
<html>
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>Scorebar Neon</title>
<style>
  html,body{margin:0;background:transparent}
  *{box-sizing:border-box}
  :root{
    --bg: linear-gradient(120deg, rgba(10,10,18,.6), rgba(10,10,18,.6));
    --glass: rgba(255,255,255,.1);
    --stroke: rgba(255,255,255,.18);
    --accent: #00f5d4; /* cyan score pill */
    --chip:#00c2ff;    /* blue chips */
    --mut:#a5adcc;
    --glow: 0 10px 30px rgba(0,0,0,.45);
    --neon: 0 0 18px rgba(0,245,212,.65), 0 0 32px rgba(0,245,212,.35);
  }

  .wrap{
    width:100vw;padding:10px 16px;
    font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif;
    display:flex;align-items:center;justify-content:center;gap:14px;color:#e8f7ff;
    background: radial-gradient(60vmin 60vmin at 50% 50%, rgba(0,245,212,.07), transparent 75%);
  }

  .card{
    background: var(--bg);
    border: 1px solid var(--stroke);
    border-radius:18px;
    padding:10px 12px; min-width:300px; display:flex; align-items:center; gap:12px;
    box-shadow: var(--glow);
    backdrop-filter: blur(10px) saturate(1.3);
  }
  .teamlogo, .opp-logo{
    width:44px;height:44px;border-radius:10px;background:#0b0f17;object-fit:contain;
    box-shadow:0 0 0 1px rgba(0,245,212,.25), 0 4px 16px rgba(0,245,212,.25);
  }
  .bats{display:flex;flex-direction:column;gap:3px;min-width:0}
  .line{display:flex;align-items:center;gap:8px;white-space:nowrap}
  .nm{font-weight:900;font-size:14px;max-width:18ch;overflow:hidden;text-overflow:ellipsis}
  .fig{font-weight:900;font-size:14px}
  .strike{width:8px;height:8px;border-radius:50%;background:#00f5d4;box-shadow:var(--neon)}

  .pillbox{display:flex;flex-direction:column;align-items:center;gap:8px;flex:1 1 auto;min-width:460px}
  .pill{
    position:relative;display:flex;align-items:center;gap:0;overflow:hidden;
    border-radius:18px;color:#fff;box-shadow: var(--glow);
    border:1px solid var(--stroke);
    background: linear-gradient(180deg,#101626,#0b0f19);
  }
  .grid{
    position:absolute;inset:0;background:
      radial-gradient(circle at 20% 20%, rgba(0,245,212,.08), transparent 35%),
      radial-gradient(circle at 80% 80%, rgba(0,194,255,.08), transparent 35%);
    pointer-events:none;
  }

  .pill .match{
    padding:10px 12px;font-weight:900;font-size:13px;letter-spacing:.05em;opacity:.95
  }
  .pill .score{
    padding:10px 16px;margin-left:8px;
    background:linear-gradient(135deg,rgba(0,245,212,.95),rgba(0,194,255,.95));
    color:#001014;
    font-weight:1000;font-size:22px;letter-spacing:.02em;display:flex;align-items:center;gap:10px;
    border-left:1px solid rgba(0,0,0,.15);
    box-shadow:inset 0 0 25px rgba(255,255,255,.18);
  }
  .ov-badge{
    background:rgba(0,245,212,.15);
    color:#b8fff3;
    font:1000 11px/1 system-ui;
    padding:6px 10px;border-radius:12px;margin-left:8px;border:1px solid rgba(0,245,212,.35)
  }
  .chiprow{display:flex;align-items:center;gap:6px;min-height:24px}
  .chip{width:24px;height:24px;border-radius:6px;display:grid;place-items:center;
        font:1000 11px/1 system-ui;color:#001014;box-shadow:0 2px 10px rgba(0,0,0,.35)}
  .chip.r{background:linear-gradient(135deg,#00f5d4,#00c2ff); color:#001014}
  .chip.wd{background:#ffb703; color:#1a0c00}
  .chip.nb{background:#a855f7; color:#14001a}
  .chip.w{background:#ff4d6d; color:#1a0008}

  .rr{
    background:linear-gradient(90deg,rgba(0,245,212,.12),rgba(0,194,255,.16));
    color:#cffff7;border-radius:10px;padding:6px 12px;font-weight:900;font-size:12px;letter-spacing:.08em;
    border:1px solid rgba(0,245,212,.28);
    box-shadow: var(--glow);
  }

  .right .bwl{display:flex;flex-direction:column;gap:3px;min-width:0}
  .right .nm{max-width:16ch}
  .mut{color:var(--mut)}

  .pulse{animation:pulse 1.2s ease}
  @keyframes pulse{
    0%{box-shadow:var(--neon)}
    100%{box-shadow:none}
  }
</style>
</head>
<body>
  <div class="wrap">
    <div class="card left">
      <img id="bLogo" class="teamlogo" alt="">
      <div class="bats">
        <div class="line">
          <span class="strike" id="strikeDot" style="visibility:hidden"></span>
          <span class="nm" id="b1Name">—</span>
          <span class="fig" id="b1Fig">0 (0)</span>
        </div>
        <div class="line mut">
          <span class="nm" id="b2Name">—</span>
          <span class="fig" id="b2Fig">0 (0)</span>
        </div>
      </div>
    </div>

    <div class="pillbox">
      <div class="pill">
        <span class="grid"></span>
        <div class="match" id="mt">— v —</div>
        <div class="score" id="scorePill">
          <span id="tot">0-0</span>
          <span class="ov-badge" id="ovb">0.0 overs</span>
        </div>
      </div>
      <div class="chiprow" id="chips"></div>
      <div class="rr" id="rr">RUN RATE 0.00</div>
    </div>

    <div class="card right">
      <div class="bwl">
        <div class="line">
          <span class="nm" id="bowlerName">—</span>
          <span class="fig" id="bowlerFig">0-0-0</span>
        </div>
        <div class="line mut">
          <span id="fieldTeam">—</span>
        </div>
      </div>
      <img id="fLogo" class="opp-logo" alt="">
    </div>
  </div>

<script>
  const $ = (id) => document.getElementById(id);
  const bLogo=$('bLogo'), b1Name=$('b1Name'), b1Fig=$('b1Fig'),
        b2Name=$('b2Name'), b2Fig=$('b2Fig'), strikeDot=$('strikeDot');
  const mt=$('mt'), tot=$('tot'), ovb=$('ovb'), rr=$('rr'), chips=$('chips');
  const bowlerName=$('bowlerName'), bowlerFig=$('bowlerFig'),
        fieldTeam=$('fieldTeam'), fLogo=$('fLogo'), scorePill=$('scorePill');

  let last = { runs:0, wickets:0 };

  function mkChip(label){
    const d=document.createElement('div'); d.className='chip r'; d.textContent=label;
    if(label==='W'){ d.className='chip w'; }
    else if(label.startsWith('Wd')){ d.className='chip wd'; }
    else if(label.startsWith('Nb')){ d.className='chip nb'; }
    return d;
  }

  function render(s){
    const batCode = (s.battingTeam||'').toUpperCase();
    const fldCode = (s.bowlingTeam||'').toUpperCase();
    mt.textContent = batCode + ' v ' + fldCode;

    if (s.runs!==last.runs || s.wickets!==last.wickets) {
      scorePill.classList.remove('pulse');
      void scorePill.offsetWidth;
      scorePill.classList.add('pulse');
      last = { runs:s.runs, wickets:s.wickets };
    }

    tot.textContent = (s.runs||0) + '-' + (s.wickets||0);
    ovb.textContent = (s.overs||0) + '.' + (s.balls||0) + ' overs';
    rr.textContent = 'RUN RATE ' + (s.runRate || '0.00');

    chips.innerHTML = '';
    (s.overBalls||[]).forEach(b => chips.appendChild(mkChip(b)));

    const st = s.striker || {};
    const ns = s.nonStriker || {};
    strikeDot.style.visibility = (st.name ? 'visible' : 'hidden');
    b1Name.textContent = (st.name||'').toUpperCase();
    b1Fig.textContent  = (st.runs||0) + ' (' + (st.balls||0) + ')';
    b2Name.textContent = (ns.name||'').toUpperCase();
    b2Fig.textContent  = (ns.runs||0) + ' (' + (ns.balls||0) + ')';

    bLogo.src = s.battingTeamLogo || '';
    fLogo.src = s.bowlingTeamLogo || '';

    bowlerName.textContent = (s.bowler?.name||'').toUpperCase();
    bowlerFig.textContent  = (s.bowler?.wickets||0) + '-' + (s.bowler?.overs||0) + '-' + (s.bowler?.runs||0);
    fieldTeam.textContent  = fldCode || '—';
  }

  const es = new EventSource('/sse-overlay');
  es.onmessage = (e) => render(JSON.parse(e.data));
</script>
</body>
</html>`);
});

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
  console.log(`Overlay (legacy)  → http://localhost:${PORT}/overlay`);
  console.log(`Overlay (match)   → http://localhost:${PORT}/overlay/match`);
  console.log(`Overlay (scorebar)→ http://localhost:${PORT}/overlay/scorebar`);
  console.log(`Overlay (neon)    → http://localhost:${PORT}/overlay/scorebar-neon`);
  console.log(`Overlay (FOUR)    → http://localhost:${PORT}/overlay/four`);
  console.log(`Overlay (SIX)     → http://localhost:${PORT}/overlay/six`);
  console.log(`Overlay (WICKET)  → http://localhost:${PORT}/overlay/wicket`);
});
