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
    /* Much lighter gradient */
    background:linear-gradient(180deg, rgba(13,27,42,0.35) 0%, rgba(27,38,59,0.35) 100%);
    overflow:hidden;
  }
  *{box-sizing:border-box}
  :root{
    --accent:#ffb703;
    --txt:#ffffff;
    --mut:#dce3ec;
    --shadow:rgba(0,0,0,.40);
    --panel: rgba(255,255,255,0.04);  /* was .06 -> now .04 */
    --edge: rgba(255,255,255,0.10);   /* was .14 -> now .10 */
  }
  .stage{
    position:fixed; inset:0; display:flex; flex-direction:column; align-items:center; justify-content:flex-start;
    font-family:"Segoe UI",Roboto,Inter,sans-serif; color:var(--txt);
  }
  .tour{
    margin-top:4vh; display:flex; align-items:center; gap:18px;
    font-weight:900; font-size:clamp(26px,4.5vmin,60px); letter-spacing:.03em; text-transform:uppercase;
    text-shadow:0 3px 6px rgba(0,0,0,.5);
    background: var(--panel);
    border: 1px solid var(--edge);
    border-radius: 12px;
    padding: 8px 12px;
  }
  .tour-logo{
    height:clamp(60px,8vmin,110px);
    border-radius:12px;
    box-shadow:0 4px 16px var(--shadow);
    background: rgba(255,255,255,0.72); /* lighter */
  }
  .rule{
    margin-top:10px; width:min(700px,80%); height:5px;
    background:linear-gradient(90deg,transparent,var(--accent),transparent);
    border-radius:999px; filter:drop-shadow(0 0 10px rgba(255,183,3,0.45));
  }
  .teams{
    margin-top:8vh; display:grid; grid-template-columns:1fr auto 1fr; align-items:end; gap:60px; width:100%;
  }
  .team{
    display:flex; flex-direction:column; align-items:center; gap:20px;
    background: var(--panel);
    border: 1px solid var(--edge);
    border-radius: 16px;
    padding: 12px;
  }
  .logo{
    height:clamp(170px,24vmin,300px); width:clamp(170px,24vmin,300px);
    border-radius:16px; object-fit:contain; background:#fff;
    box-shadow:0 6px 22px rgba(0,0,0,.4);
  }
  .name{
    font-weight:1000; font-size:clamp(36px,6vmin,90px); text-transform:uppercase;
    text-shadow:0 4px 8px rgba(0,0,0,.55);
  }
  .vs{
    align-self:center; display:grid; place-items:center; min-width:90px; height:90px; border-radius:50%;
    font-weight:900; font-size:clamp(28px,4vmin,46px); color:#000;
    background:radial-gradient(circle at center, rgba(255,183,3,0.82) 0%, rgba(255,115,0,0.82) 100%);
    box-shadow:0 0 20px rgba(255,183,3,.5);
  }
  .details{
    margin-top:6vh; display:flex; flex-wrap:wrap; gap:20px; justify-content:center;
    color:var(--mut); font-size:clamp(20px,3vmin,38px); font-weight:700; text-shadow:0 3px 6px rgba(0,0,0,.5);
    background: var(--panel);
    border: 1px solid var(--edge);
    border-radius: 12px;
    padding: 8px 12px;
  }
  .sep{opacity:.65}
</style>
</head>
<body>
  <div class="stage">
    <div class="tour">
      <img id="tournamentLogo" class="tour-logo" alt="">
      <span id="tournament">TOURNAMENT NAME</span>
    </div>
    <div class="rule"></div>
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

   target: null,
  // players
  striker:    { name: "", runs: 0, balls: 0 },
  nonStriker: { name: "", runs: 0, balls: 0 },

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
    striker:    { ...overlayState.striker,    ...(b.striker || {}) },
    nonStriker: { ...overlayState.nonStriker, ...(b.nonStriker || {}) },
    bowler:     { ...overlayState.bowler,     ...(b.bowler || {}) },
    overBalls:  Array.isArray(b.overBalls) ? b.overBalls : overlayState.overBalls,
  };
  // Auto-calc RR if not supplied
  const bpo = Number(overlayState.ballsPerOver || 6);
  const tovers = Number(overlayState.overs || 0) + Number(overlayState.balls || 0) / bpo;
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
// SCOREBAR (your previous glass/gradient style)  → /overlay/scorebar
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
    --blue:#1e3a8a;
    --blue2:#0f1e4d;
    --sky:#2563eb;
    --orange:#ef4444;
    --chip:#14b8a6;
    --mut:#6b7280;
    --white:rgba(255,255,255,.96);
  }

  .wrap {
    width: 100vw;
    padding: 16px 20px;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 20px;
    background: rgba(15, 23, 42, 0.55);
    backdrop-filter: blur(18px) saturate(140%);
    -webkit-backdrop-filter: blur(18px) saturate(140%);
    background-image: linear-gradient(90deg, rgba(0,0,0,.37), rgba(81,36,144,.37), rgba(0,0,0,.36));
    border-top: 2px solid rgba(255,255,255,.08);
    border-bottom: 2px solid rgba(255,255,255,.08);
    box-shadow: 0 4px 24px rgba(0,0,0,.45);
    font-family: system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif;
    color: #f8fafc;
  }

  .card{
    border-radius:18px; min-width:280px; display:flex; align-items:center; gap:14px; padding:14px 18px;
  }
  .card.right {
    background: rgba(255,255,255,.1);
    border: 1px solid rgba(0,0,0,.5);
    backdrop-filter: blur(14px) saturate(160%);
    -webkit-backdrop-filter: blur(14px) saturate(160%);
    background-image: linear-gradient(135deg, rgba(34,37,197,.25), rgba(22,125,163,.25));
    box-shadow: 0 8px 24px rgba(0,0,0,.35), inset 0 0 12px rgba(34,34,197,.25);
  }
  .card.left {
    background: rgba(255,255,255,.1);
    border: 1px solid rgba(0,0,0,.46);
    backdrop-filter: blur(14px) saturate(160%);
    -webkit-backdrop-filter: blur(14px) saturate(160%);
    background-image: linear-gradient(135deg, rgba(34,37,197,.25), rgba(22,125,163,.25));
    box-shadow: 0 8px 24px rgba(0,0,0,.35), inset 0 0 12px rgba(0,0,0,.25);
  }

  .teamlogo,.opp-logo{
    width:42px;height:42px;border-radius:10px;background:#fff;object-fit:contain;
    box-shadow:0 1px 4px rgba(0,0,0,.15);
  }
  .bats{display:flex;flex-direction:column;gap:2px;min-width:0;}
  .line{display:flex;align-items:center;gap:8px;white-space:nowrap}
  .nm{font-weight:800;font-size:14px;max-width:18ch;overflow:hidden;text-overflow:ellipsis}
  .fig{font-weight:800;font-size:14px}
  .strike{width:7px;height:7px;border-radius:50%;background:#ef4444}
  .mut{color:var(--mut)}

  .pillbox{
    display:flex; flex-direction:column; align-items:center; gap:2px; /* tighter */
    flex:1 1 auto; min-width:420px;
  }
  .pill{
    display:flex; align-items:center; gap:6px; /* small gap between blocks */
    background:linear-gradient(180deg,#1f2d67 0%, #0f1f56 100%);
    border-radius:18px; overflow:hidden; color:#fff;
    box-shadow:0 2px 12px rgba(0,0,0,.28);
    border:1px solid rgba(255,255,255,.15);
    padding-right:8px; /* allow inline target chip to sit snug */
  }
  .pill .match{
    padding:10px 12px; font-weight:900; font-size:13px; background:rgba(255,255,255,.08); letter-spacing:.04em;
  }
  .pill .score{
    display:flex; align-items:center; gap:8px;
    padding:8px 12px; /* slightly tighter */
    background:linear-gradient(135deg,#2563eb,#1e3a8a);
    font-weight:1000; font-size:20px; letter-spacing:.02em;
    border-radius:12px; /* visual separation from match block */
  }
  .ov-badge{
    background:#1b294f; color:#dbeafe; font:800 10px/1 system-ui;
    padding:3px 8px; border-radius:12px; margin-left:4px; /* less padding */
  }
  .chiprow{display:flex;align-items:center;gap:6px;min-height:22px}
  .chip{width:22px;height:22px;border-radius:50%;display:grid;place-items:center;font:900 11px/1 system-ui;color:#fff}
  .chip.r{background:var(--chip)} .chip.wd{background:#fb8c00} .chip.nb{background:#8e24aa} .chip.w{background:#ef4444}

  .rr{
    margin-top:0; /* remove extra top spacing */
    background:linear-gradient(90deg,#0e2a7a,#0a1d53);
    color:#cfe0ff; border-radius:10px; padding:2px 8px; /* tighter */
    font-weight:900; font-size:11px; letter-spacing:.06em;
    border:1px solid rgba(255,255,255,.15);
  }
  /* Target chip shown inline to the right of the score */
  .target{
    background:linear-gradient(90deg,#0a1d53,#0e2a7a);
    color:#e7ffef; border-radius:10px; padding:2px 8px; /* tight chip */
    font-weight:900; font-size:11px; letter-spacing:.04em;
    border:1px solid rgba(255,255,255,.15);
    white-space:nowrap;
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
        <div class="match" id="mt">— v —</div>
        <div class="score">
          <span id="tot">0-0</span>
          <span class="ov-badge" id="ovb">0.0 overs</span>
        </div>
        <span class="target" id="tg" style="display:none">TARGET —</span> <!-- inline, minimal gap -->
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
        fieldTeam=$('fieldTeam'), fLogo=$('fLogo');
  const tg = $('tg');

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

    tot.textContent = (s.runs||0) + '-' + (s.wickets||0);
    ovb.textContent = (s.overs||0) + '.' + (s.balls||0) + ' overs';
    rr.textContent = 'RUN RATE ' + (s.runRate || '0.00');

    // inline target next to score
    const target = s.target ?? s.chaseTarget;
    if (typeof target === 'number' && !Number.isNaN(target)) {
      tg.style.display = 'inline-block';
      tg.textContent = 'TARGET ' + target;
    } else {
      tg.style.display = 'none';
    }

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


// --- NEW: trigger FREE-HIT banner without altering over history ---
app.post("/api/overlay/fr", (req, res) => {
  const label = (req.body?.label || "FREE HIT").toString().toUpperCase();
  const durationMs = Number(req.body?.durationMs || 20000);

  // attach a transient specialEvent; DO NOT touch overBalls
  const special = { type: "FR", label, ts: Date.now(), durationMs };

  // Keep overlayState intact but broadcast a payload that includes the special
  const payload = { ...overlayState, specialEvent: special };
  broadcastOverlay(payload);

  // Optionally clear after duration so late joiners don’t see stale flag
  setTimeout(() => {
    // Only clear if still the same event
    if (overlayState?.specialEvent?.type === "FR") {
      delete overlayState.specialEvent;
    }
    broadcastOverlay({ ...overlayState, specialEvent: null });
  }, durationMs);

  res.json({ ok: true });
});








app.get("/overlay/scorebar-tv", (_req, res) => {
  res.set("Content-Type", "text/html; charset=utf-8").send(`<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>Scorebar TV</title>
<style>
  html,body{margin:0;background:transparent}
  *{box-sizing:border-box}
  :root{
    --teal1:#116c64; --teal2:#0b524c; --teal3:#0a3f3a;
    --ring:#ffffff33; --mut:#d6e7ec; --fg:#fff;
    --dotScale:1;
    --dotBase:44px;
    --eventDur:10000ms;
  }
  .shell{display:flex;justify-content:center;padding:0}
  .strip{
    width:min(1920px,100vw);
    display:grid;
    grid-template-columns: 92px 360px 1fr 700px 92px;
    align-items:stretch;
    border-radius:20px; overflow:hidden; color:var(--fg);
    font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif;
    background:linear-gradient(180deg,var(--teal1),var(--teal2));
    box-shadow:0 16px 40px rgba(0,0,0,.32);
    border:1px solid #00000030; position:relative;
    margin:4px 0;
  }

  .event{position:absolute;left:0;top:0;width:calc(92px + 360px);height:100%;display:none;align-items:center;justify-content:center;padding:8px;pointer-events:none;z-index:40}
  .event.show{display:flex}
  .badge{width:100%;height:100%;border-radius:18px;display:flex;align-items:center;justify-content:center;gap:18px;font:1000 36px/1 system-ui;letter-spacing:.04em;color:#001014;white-space:nowrap;transform:scale(1);opacity:0;position:relative;overflow:hidden;animation:popIn .35s cubic-bezier(.18,.89,.32,1.28) forwards,badgePulse var(--eventDur) ease-in-out}
  .badge::after{content:"";position:absolute;inset:-30% -120%;background:linear-gradient(120deg,transparent 45%,rgba(255,255,255,.85) 50%,transparent 55%);transform:translateX(-60%);animation:sweep calc(var(--eventDur)/4) ease-in-out .45s infinite}
  .ico{width:72px;height:72px;border-radius:50%;display:grid;place-items:center;font:1000 32px/1 system-ui;color:#001014;background:#fff;box-shadow:0 0 14px rgba(0,0,0,.25), inset 0 0 10px rgba(255,255,255,.5)}
  .four  .badge{background:linear-gradient(135deg,#1e9ef8,#60a5fa);box-shadow:0 0 28px rgba(96,165,250,.8),0 0 46px rgba(30,158,248,.55)}
  .six   .badge{background:linear-gradient(135deg,#00f5d4,#00ff9a);box-shadow:0 0 28px rgba(0,245,212,.85),0 0 46px rgba(0,255,154,.55)}
  .wicket .badge{background:linear-gradient(135deg,#ef4444,#ff7a7a);box-shadow:0 0 28px rgba(239,68,68,.85),0 0 46px rgba(255,122,122,.55)}
  .freehit .badge{background:linear-gradient(135deg,#ffd54f,#ffb300);box-shadow:0 0 28px rgba(255,179,0,.85),0 0 46px rgba(255,213,79,.55)}
  @keyframes popIn{to{opacity:1}}
  @keyframes sweep{to{transform:translateX(160%)}}
  @keyframes badgePulse{0%,100%{filter:drop-shadow(0 0 0 rgba(255,255,255,0))}20%,40%,60%{filter:drop-shadow(0 0 16px rgba(255,255,255,.55))}80%{filter:drop-shadow(0 0 24px rgba(255,255,255,.65))}}

  .lcrest,.rcrest{display:grid;place-items:center;background:linear-gradient(180deg,var(--teal2),var(--teal3))}
  .lcrest{border-right:1px solid #0000003a}
  .rcrest{border-left:1px solid #0000003a}
  .lcrest img,.rcrest img{width:78px;height:78px;border-radius:14px;background:#fff;object-fit:contain;margin:6px 0}

  #linfo{display:grid;grid-template-rows:auto auto auto auto;background:linear-gradient(180deg,var(--teal1),var(--teal3));border-right:1px solid #0000003a;transition:opacity .18s; position:relative;}
  #linfo.hide{opacity:0;visibility:hidden}
  .aTop{display:flex;align-items:flex-end;gap:8px;padding:12px 12px 4px 14px;min-width:0}
  .teamA{font-weight:1000;font-size:36px;line-height:1.12;text-transform:uppercase;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .aBot{display:grid;grid-template-columns:auto 1fr;align-items:flex-start;gap:8px;padding:0 12px 10px 14px}
  .vs{font:900 20px/1.2 system-ui}
  .teamB{font:900 20px/1.2 system-ui;text-transform:uppercase;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}

  .edgeTop{padding:4px 12px 4px 14px;display:flex;justify-content:flex-end}
  .edgeBottom{padding:4px 12px 10px 14px;display:flex;justify-content:flex-end}
  .pill.target{color:#001014;background:linear-gradient(135deg,#00f5d4,#00ff9a);box-shadow:0 0 22px rgba(0,245,212,.55),0 0 26px rgba(0,255,154,.3);border:1px solid rgba(0,0,0,.08);font-size:20px;padding:8px 14px}
  .pill.need{color:#1a0c00;background:linear-gradient(135deg,#ffb703,#ffd166);box-shadow:0 0 18px rgba(255,183,3,.45),0 0 22px rgba(255,209,102,.28);border:1px solid rgba(0,0,0,.08);font-size:20px;padding:8px 14px}

  .mid{display:grid;grid-template-rows:auto auto;background:linear-gradient(180deg,rgba(0,0,0,.10),rgba(0,0,0,.16));border-right:1px solid #0000003a}
  .r{display:grid;align-items:center;padding:6px 12px}
  .r1{grid-template-columns:150px 10px 1fr max-content;gap:6px;border-bottom:1px solid #00000030}
  .r2{grid-template-columns:150px 10px 1fr max-content;gap:6px}
  .score{border-radius:16px;background:#fff;color:#0a2326;display:grid;place-items:center;font:1000 50px/1.02 system-ui;padding:10px 0}
  .chev{width:12px;height:12px;border:2px solid #fff;border-left:0;border-bottom:0;transform:rotate(45deg)}
  .nm{font:1000 26px/1.2 system-ui;text-transform:uppercase;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-right:2px}
  .mut{color:var(--mut);font-weight:900}
  .fig{font:1000 26px/1.15 system-ui;margin-left:0}
  .sup{font-size:15px;opacity:.9;vertical-align:top}

  .rrMid{justify-self:start}
  .pill{background:#fff;color:#0b2326;border-radius:999px;padding:6px 12px;font:1000 18px/1 system-ui;white-space:nowrap}
  .pill.alt{background:linear-gradient(180deg,#0b2b2f,#0a2124);color:#cfe5ea;border:1px solid #ffffff22}

  .right{
    display:grid;
    grid-template-columns: 1fr;
    grid-template-rows: auto auto;
    background:linear-gradient(180deg,rgba(0,0,0,.08),rgba(0,0,0,.18));
    border-right:1px solid #0000003a;
  }

  .bowRow{
    grid-column: 1 / -1;
    grid-row: 1;
    display: grid;
    grid-auto-flow: column;
    grid-auto-columns: max-content;
    align-items: center;
    justify-content: center;
    gap: 10px;
    padding: 10px 10px 4px 10px;
    text-align: center;
  }
  .bowName{font:1000 26px/1.2 system-ui;text-transform:uppercase;white-space:nowrap;max-width:40ch;overflow:hidden;text-overflow:ellipsis;text-align:center}
  .bf{font:1000 24px/1.1 system-ui;text-align:center}

  .dotsRow{grid-column:1;grid-row:2;display:flex;justify-content:flex-end;align-items:center;gap:12px;padding:4px 10px 10px 10px}
  .dots{display:flex;align-items:center;gap:12px;background:linear-gradient(180deg,#0b2b2f,#0a2124);padding:10px 14px;border-radius:999px;max-width:100%}

  .dot{height:calc(var(--dotBase) * var(--dotScale));min-width:calc(var(--dotBase) * var(--dotScale));padding:0 calc(18px * var(--dotScale));border-radius:10px;background:#0a1a1e;box-shadow:inset 0 0 0 2px var(--ring);display:flex;align-items:center;justify-content:center;color:#fff;font:1000 calc(var(--dotBase)*0.58*var(--dotScale)) / 1 system-ui;letter-spacing:.02em;line-height:1;white-space:nowrap}
  .dot.blue{background:#1e9ef8;color:#03121b}
  .dot.green{background:#22c55e;color:#05140a}
  .dot.red{background:#ef4444}
  .dot.badge{min-width:auto;padding:0 calc(5px * var(--dotScale));font-size:calc(var(--dotBase) * 0.20 * var(--dotScale));letter-spacing:.002em;}
</style>
</head>
<body>
  <div class="shell">
    <div class="strip">
      <div class="event" id="event"><div class="badge" id="badge"><span class="ico" id="evI">6</span><span class="txt" id="evT">SIX</span></div></div>

      <div class="lcrest"><img id="logoA" alt=""></div>

      <div class="linfo" id="linfo">
        <div class="aTop"><div class="teamA" id="teamA">TEAM A</div></div>
        <div class="aBot"><div class="vs">VS</div><div class="teamB" id="teamB">TEAM B</div></div>
        <div class="edgeTop"><div class="pill need" id="need" style="display:none">NEED 0 FROM 0</div></div>
        <div class="edgeTop"><div class="pill target" id="tg" style="display:none">TARGET 0</div></div>
      </div>

      <div class="mid">
        <div class="r r1">
          <div class="score" id="score">0-0</div>
          <div class="chev"></div>
          <div class="nm" id="b1">BATTER 1</div>
          <div class="fig" id="b1f">0 <span class="sup">(0)</span></div>
        </div>
        <div class="r r2">
          <div class="pill rrMid" id="rr">RR 0.00</div>
          <div class="chev"></div>
          <div class="nm mut" id="b2">BATTER 2</div>
          <div class="fig mut" id="b2f">0 <span class="sup">(0)</span></div>
        </div>
      </div>

      <div class="right">
        <div class="bowRow">
          <div class="bowName" id="bowName">BOWLER NAME</div>
          <div class="bf" id="bowf">0-0.0-0</div>
        </div>
        <div class="dotsRow"><div class="dots" id="dots"></div></div>
      </div>

      <div class="rcrest"><img id="logoB" alt=""></div>
    </div>
  </div>

<script>
  const $ = id => document.getElementById(id);
  const logoA=$('logoA'), logoB=$('logoB');
  const teamA=$('teamA'), teamB=$('teamB');
  const score=$('score'), b1=$('b1'), b1f=$('b1f'), b2=$('b2'), b2f=$('b2f');
  const bowName=$('bowName'), bowf=$('bowf'), dots=$('dots');
  const rr=$('rr'), tg=$('tg'), need=$('need');
  const eventWrap=$('event'), evI=$('evI'), evT=$('evT');
  const linfo=$('linfo');

  const up=s=>(s||'').toString().toUpperCase();
  const first=s=>up(String(s||'').trim().split(/\\s+/)[0]);

  function renderDots(list){
    const arr=Array.isArray(list)?list:[];
    dots.innerHTML='';
    const targetVisible=14;
    const scale=arr.length<=targetVisible?1:Math.max(0.56,targetVisible/arr.length);
    document.documentElement.style.setProperty('--dotScale',String(scale));
    for(const raw of arr){
      let t=String(raw??'').trim();
      const d=document.createElement('div'); d.className='dot';
      if(!t||t==='0'||t==='•'){t='·';}
      if(t==='4') d.classList.add('blue');
      else if(t==='6') d.classList.add('green');
      else if(t==='W') d.classList.add('red');
      else if(/^Wd/i.test(t)||/^Nb/i.test(t)||/^Ro/i.test(t)||/run\\s*out/i.test(t)){d.classList.add('badge');t=t.toUpperCase();}
      d.textContent=t; dots.appendChild(d);
    }
  }

  let lastEventKey=null,bannerTimer=null;
  function isRunOutToken(x){const L=String(x||'').toUpperCase().replace(/[^A-Z]/g,''); return L==='RO'||L==='RUNOUT';}

  function renderTargetAndNeed(s, m) {
    try {
      console.debug('Overlay debug:', { overlay: s, match: m });

      const bpo = Number(s.ballsPerOver ?? s.bpo ?? 6);

      // target from multiple possible keys
      const target = (s.target ?? s.chaseTarget ?? s.chase ?? m?.target ?? m?.chaseTarget ?? null);

      // needRuns from many keys or compute from target
      let needRuns = (s.needRuns ?? s.runsNeeded ?? s.req_runs ?? s.runsToWin ?? m?.needRuns ?? null);
      if (needRuns == null && (typeof target === 'number' || !isNaN(Number(target)))) {
        needRuns = Math.max(Number(target) - Number(s.runs || 0), 0);
      }
      if (needRuns != null) needRuns = Number(needRuns);

      // try many variants for ballsLeft / oversLeft / totalOvers
      const ballsLeftDirect = (s.ballsLeft ?? s.ballsRemaining ?? s.balls_to_go ?? s.balls_left ?? s.balls_remaining ?? m?.ballsLeft ?? m?.ballsRemaining ?? null);
      const oversLeftDirect = (s.oversLeft ?? s.oversRemaining ?? s.overs_to_go ?? s.overs_left ?? m?.oversLeft ?? m?.oversRemaining ?? null);
      const totalOvers = (m?.noOfOvers ?? m?.totalOvers ?? m?.oversLimit ?? s.totalOvers ?? s.oversLimit ?? s.noOfOvers ?? null);

      const bowledBalls = (Number(s.overs || 0) * bpo) + Number(s.balls || 0);

      let ballsLeft = null;
      if (ballsLeftDirect != null && !Number.isNaN(Number(ballsLeftDirect))) {
        ballsLeft = Number(ballsLeftDirect);
      } else if (oversLeftDirect != null && !Number.isNaN(Number(oversLeftDirect))) {
        ballsLeft = Math.max(0, Number(oversLeftDirect) * bpo);
      } else if (totalOvers != null && !Number.isNaN(Number(totalOvers))) {
        ballsLeft = Math.max(0, Number(totalOvers) * bpo - bowledBalls);
      }

      // Show/hide target
      if (typeof target === 'number' && !Number.isNaN(target)) {
        tg.style.display = 'inline-block';
        tg.textContent = 'TARGET ' + target;
      } else {
        tg.style.display = 'none';
      }

      // Show need only in 2nd innings (when target is set)
      if (target && needRuns != null && ballsLeft != null) {
        need.style.display = 'inline-block';
        need.textContent = 'NEED ' + needRuns + ' FROM ' + ballsLeft;
      } else if (target && needRuns != null && ballsLeft == null) {
        need.style.display = 'inline-block';
        need.textContent = 'NEED ' + needRuns;
      } else {
        need.style.display = 'none';
      }
    } catch (err) {
      console.error('renderTargetAndNeed error', err);
      tg.style.display = 'none';
      need.style.display = 'none';
    }
  }

  function maybeEvent(s, m){
    if(s.specialEvent && (s.specialEvent.type === 'FR' || s.specialEvent.type === 'FREEHIT')){
      const dur = Number(s.specialEvent.durationMs || 10000);
      eventWrap.className='event freehit'; evI.textContent='FH'; evT.textContent=s.specialEvent.label||'FREE HIT';
      eventWrap.classList.add('show'); linfo.classList.add('hide');
      tg.style.display='none'; need.style.display='none';
      clearTimeout(bannerTimer);
      bannerTimer=setTimeout(()=>{ eventWrap.classList.remove('show','four','six','wicket','freehit'); linfo.classList.remove('hide'); renderTargetAndNeed(s,m); }, dur);
      return;
    }

    const list = Array.isArray(s.overBalls) ? s.overBalls : [];
    const last = String(list[list.length-1] ?? '').trim();
    if (!last) return;
    const key = String(Number(s.overs || 0)) + '.' + String(Number(s.balls || 0)) + '-' + last;
    if (key === lastEventKey) return;
    lastEventKey = key;

    eventWrap.className='event';
    const token = last.toUpperCase();

    if (token === '4' || token === '6' || token === 'W' || isRunOutToken(token)) {
      if (token === '4') { eventWrap.classList.add('four'); evI.textContent='4'; evT.textContent='FOUR'; }
      else if (token === '6') { eventWrap.classList.add('six'); evI.textContent='6'; evT.textContent='SIX'; }
      else { eventWrap.classList.add('wicket'); evI.textContent='W'; evT.textContent='WICKET'; }

      eventWrap.classList.add('show'); linfo.classList.add('hide');
      tg.style.display='none'; need.style.display='none';
      clearTimeout(bannerTimer);
      bannerTimer=setTimeout(()=>{ eventWrap.classList.remove('show','four','six','wicket','freehit'); linfo.classList.remove('hide'); renderTargetAndNeed(s,m); }, 10000);
    }
  }

  const state={overlay:null,match:null};

  function render(){
    const s = state.overlay || {};
    const m = state.match || {};

    teamA.textContent = up(s.battingTeam || m.team1 || '—');
    teamB.textContent = up(s.bowlingTeam || m.team2 || '—');
    logoA.src = s.battingTeamLogo || m.team1Logo || '';
    logoB.src = s.bowlingTeamLogo || m.team2Logo || '';
    score.textContent = (s.runs || 0) + '-' + (s.wickets || 0);

    const st = s.striker || {}, ns = s.nonStriker || {};
    b1.textContent = first(st.name || '—');
    b1f.innerHTML = (st.runs || 0) + ' <span class="sup">(' + (st.balls || 0) + ')</span>';
    b2.textContent = first(ns.name || '—');
    b2f.innerHTML = (ns.runs || 0) + ' <span class="sup">(' + (ns.balls || 0) + ')</span>';

    const bw = s.bowler || {};
    bowName.textContent = first(bw.name || '—');
    const w = Number(bw.wickets || 0), r = Number(bw.runs || 0);
    const ov = (bw.overs != null ? bw.overs : 0);
    bowf.textContent = w + '-' + ov + '-' + r;

    rr.textContent = 'RR ' + (s.runRate || '0.00');

    renderDots(s.overBalls);

    if (!eventWrap.classList.contains('show')) {
      renderTargetAndNeed(s, m);
    }

    maybeEvent(s, m);
  }

  try {
    const es1 = new EventSource('/sse-overlay');
    es1.onmessage = e => { state.overlay = JSON.parse(e.data) || {}; render(); };
  } catch (err) { console.error(err); }

  try {
    const es2 = new EventSource('/sse-match');
    es2.onmessage = e => { state.match = JSON.parse(e.data) || {}; render(); };
  } catch (err) { console.error(err); }
</script>
</body>
</html>`);
});










app.get("/overlay/scorebar-tv-orange", (_req, res) => { 
  res.set("Content-Type", "text/html; charset=utf-8").send(`<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>Scorebar TV – Orange</title>
<style>
  html,body{margin:0;background:transparent}
  *{box-sizing:border-box}
  :root{
    --o1:#ff8a00; --o2:#ff6a00; --o3:#cc5200;
    --ring:#ffffff33; --mut:#d6e7ec; --fg:#fff;
    --dotScale:1;
    --dotBase:44px;
    --eventDur:20000ms;
  }

  .shell{display:flex;justify-content:center;padding:0}

  .strip{
    width:min(1920px,100vw);
    display:grid;
    grid-template-columns: 92px 360px 1fr 700px 92px;
    align-items:stretch;
    border-radius:20px; overflow:hidden; color:var(--fg);
    font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif;
    background:linear-gradient(180deg,var(--o1),var(--o2));
    box-shadow:0 16px 40px rgba(0,0,0,.32);
    border:1px solid #00000030; position:relative;
    margin:4px 0;
  }

  /* Event banner */
  .event{position:absolute; left:0; top:0; width:calc(92px + 360px); height:100%; display:none; align-items:center; justify-content:center; padding:8px; pointer-events:none; z-index:4}
  .event.show{display:flex}
  .badge{width:100%; height:100%; border-radius:18px; display:flex; align-items:center; justify-content:center; gap:18px; font:1000 36px/1 system-ui; letter-spacing:.04em; color:#001014; white-space:nowrap; transform:scale(1); opacity:0; position:relative; overflow:hidden; animation:popIn .35s cubic-bezier(.18,.89,.32,1.28) forwards, badgePulse var(--eventDur) ease-in-out}
  .badge::after{content:""; position:absolute; inset:-30% -120%; background:linear-gradient(120deg,transparent 45%,rgba(255,255,255,.85) 50%,transparent 55%); transform:translateX(-60%); animation:sweep calc(var(--eventDur)/4) ease-in-out .45s infinite}
  .ico{width:72px;height:72px;border-radius:50%;display:grid;place-items:center;font:1000 32px/1 system-ui;color:#001014;background:#fff;box-shadow:0 0 14px rgba(0,0,0,.25), inset 0 0 10px rgba(255,255,255,.5)}
  .four  .badge{background:linear-gradient(135deg,#1e9ef8,#60a5fa); box-shadow:0 0 28px rgba(96,165,250,.8),0 0 46px rgba(30,158,248,.55)}
  .six   .badge{background:linear-gradient(135deg,#00f5d4,#00ff9a); box-shadow:0 0 28px rgba(0,245,212,.85),0 0 46px rgba(0,255,154,.55)}
  .wicket .badge{background:linear-gradient(135deg,#ef4444,#ff7a7a); box-shadow:0 0 28px rgba(239,68,68,.85),0 0 46px rgba(255,122,122,.55)}
  /* FREE HIT style (orange theme) */
  .freehit .badge{background:linear-gradient(135deg,#ffe082,#ffca28); box-shadow:0 0 28px rgba(255,202,40,.85), 0 0 46px rgba(255,224,130,.55)}
  @keyframes popIn{to{opacity:1}}
  @keyframes sweep{to{transform:translateX(160%)}}
  @keyframes badgePulse{0%,100%{filter:drop-shadow(0 0 0 rgba(255,255,255,0))}20%,40%,60%{filter:drop-shadow(0 0 16px rgba(255,255,255,.55))}80%{filter:drop-shadow(0 0 24px rgba(255,255,255,.65))}}

  .lcrest,.rcrest{display:grid;place-items:center;background:linear-gradient(180deg,var(--o2),var(--o3))}
  .lcrest{border-right:1px solid #0000003a}
  .rcrest{border-left:1px solid #0000003a}
  .lcrest img,.rcrest img{width:78px;height:78px;border-radius:14px;background:#fff;object-fit:contain;margin:6px 0}

  #linfo{display:grid;grid-template-rows:auto auto;background:linear-gradient(180deg,var(--o1),var(--o3));border-right:1px solid #0000003a;transition:opacity .18s}
  #linfo.hide{opacity:0;visibility:hidden}
  .aTop{display:flex;align-items:flex-end;gap:8px;padding:12px 12px 4px 14px;min-width:0}
  .teamA{font-weight:1000;font-size:36px;line-height:1.12;text-transform:uppercase;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .aBot{display:grid;grid-template-columns:auto 1fr;align-items:flex-start;gap:8px;padding:0 12px 10px 14px}
  .vs{font:900 20px/1.2 system-ui}
  .teamB{font:900 20px/1.2 system-ui;text-transform:uppercase;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}

  .mid{display:grid;grid-template-rows:auto auto;background:linear-gradient(180deg,rgba(0,0,0,.10),rgba(0,0,0,.16));border-right:1px solid #0000003a}
  .r{display:grid;align-items:center;padding:6px 12px}
  .r1{grid-template-columns:150px 10px 1fr max-content;gap:6px;border-bottom:1px solid #00000030}
  .r2{grid-template-columns:150px 10px 1fr max-content;gap:6px}
  .score{border-radius:16px;background:#fff;color:#0a2326;display:grid;place-items:center;font:1000 50px/1.02 system-ui;padding:10px 0}
  .chev{width:12px;height:12px;border:2px solid #fff;border-left:0;border-bottom:0;transform:rotate(45deg)}
  .nm{font:1000 26px/1.2 system-ui;text-transform:uppercase;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-right:2px}
  .mut{color:var(--mut);font-weight:900}
  .fig{font:1000 26px/1.15 system-ui;margin-left:0}
  .sup{font-size:15px;opacity:.9;vertical-align:top}

  .rrMid{justify-self:start}
  .pill{background:#fff;color:#0b2326;border-radius:999px;padding:6px 12px;font:1000 18px/1 system-ui;white-space:nowrap}
  .pill.alt{background:linear-gradient(180deg,#0b2b2f,#0a2124);color:#cfe5ea;border:1px solid #ffffff22}

  .right{
    display:grid;
    grid-template-columns: 1fr auto;
    grid-template-rows: auto auto;
    background:linear-gradient(180deg,rgba(0,0,0,.08),rgba(0,0,0,.18));
    border-right:1px solid #0000003a;
  }

  /* Center bowler name + figures across right container */
  .bowRow{
    grid-column: 1 / -1;
    grid-row: 1;
    display: grid;
    grid-auto-flow: column;
    grid-auto-columns: max-content;
    align-items: center;
    justify-content: center;
    gap: 10px;
    padding: 10px 10px 4px 10px;
    text-align: center;
  }
  .bowName{font:1000 26px/1.2 system-ui;text-transform:uppercase;white-space:nowrap;max-width:40ch;overflow:hidden;text-overflow:ellipsis;text-align:center}
  .bf{font:1000 24px/1.1 system-ui;text-align:center}

  .edgeTop{grid-column:2; grid-row:1; display:flex; align-items:center; justify-content:flex-end; padding:10px 10px 4px 6px}
  .edgeBottom{grid-column:2; grid-row:2; display:flex; align-items:center; justify-content:flex-end; padding:4px 10px 10px 6px}

  .pill.target{color:#001014;background:linear-gradient(135deg,#00f5d4,#00ff9a);box-shadow:0 0 22px rgba(0,245,212,.55), 0 0 26px rgba(0,255,154,.3);border:1px solid rgba(0,0,0,.08); font-size:20px; padding:8px 14px}
  .pill.need{color:#1a0c00;background:linear-gradient(135deg,#ffb703,#ffd166);box-shadow:0 0 18px rgba(255,183,3,.45), 0 0 22px rgba(255,209,102,.28);border:1px solid rgba(0,0,0,.08); font-size:20px; padding:8px 14px}

  .dotsRow{grid-column:1; grid-row:2; display:flex;justify-content:flex-end;align-items:center; gap:12px;padding:4px 10px 10px 10px}
  .dots{display:flex;align-items:center;gap:12px;background:linear-gradient(180deg,#0b2b2f,#0a2124);padding:10px 14px;border-radius:999px;max-width:100%}

  .dot{
    height:calc(var(--dotBase) * var(--dotScale));
    min-width:calc(var(--dotBase) * var(--dotScale));
    padding:0 calc(18px * var(--dotScale));
    border-radius:10px;
    background:#0a1a1e; box-shadow:inset 0 0 0 2px var(--ring);
    display:flex; align-items:center; justify-content:center; color:#fff;
    font:1000 calc(var(--dotBase)*0.58*var(--dotScale)) / 1 system-ui;
    letter-spacing:.02em;
    line-height:1;
    white-space:nowrap;
  }
  .dot.blue{background:#1e9ef8;color:#03121b}
  .dot.green{background:#22c55e;color:#05140a}
  .dot.red{background:#ef4444}

  /* NB/WD/RO badges — matched to green bar */
  .dot.badge{
    min-width:auto;
    padding:0 calc(5px * var(--dotScale));
    font-size:calc(var(--dotBase) * 0.20 * var(--dotScale));
    letter-spacing:.002em;
  }
</style>
</head>
<body>
  <div class="shell">
    <div class="strip">
      <div class="event" id="event"><div class="badge" id="badge"><span class="ico" id="evI">6</span><span class="txt" id="evT">SIX</span></div></div>

      <div class="lcrest"><img id="logoA" alt=""></div>

      <div class="linfo" id="linfo">
        <div class="aTop"><div class="teamA" id="teamA">TEAM A</div></div>
        <div class="aBot"><div class="vs">VS</div><div class="teamB" id="teamB">TEAM B</div></div>
      </div>

      <div class="mid">
        <div class="r r1">
          <div class="score" id="score">0-0</div>
          <div class="chev"></div>
          <div class="nm" id="b1">BATTER 1</div>
          <div class="fig" id="b1f">0 <span class="sup">(0)</span></div>
        </div>
        <div class="r r2">
          <div class="pill rrMid" id="rr">RR 0.00</div>
          <div class="chev"></div>
          <div class="nm mut" id="b2">BATTER 2</div>
          <div class="fig mut" id="b2f">0 <span class="sup">(0)</span></div>
        </div>
      </div>

      <div class="right">
        <div class="bowRow">
          <div class="bowName" id="bowName">BOWLER NAME</div>
          <div class="bf" id="bowf">0-0.0-0</div>
        </div>
        <div class="edgeTop"><div class="pill target" id="tg" style="display:none">TARGET 0</div></div>

        <div class="dotsRow"><div class="dots" id="dots"></div></div>
        <div class="edgeBottom"><div class="pill need" id="need" style="display:none">NEED 0 FROM 0</div></div>
      </div>

      <div class="rcrest"><img id="logoB" alt=""></div>
    </div>
  </div>

<script>
  const $ = id => document.getElementById(id);
  const logoA=$('logoA'), logoB=$('logoB');
  const teamA=$('teamA'), teamB=$('teamB');
  const score=$('score'), b1=$('b1'), b1f=$('b1f'), b2=$('b2'), b2f=$('b2f');
  const bowName=$('bowName'), bowf=$('bowf'), dots=$('dots');
  const rr=$('rr'), tg=$('tg'), need=$('need');
  const eventWrap=$('event'), evI=$('evI'), evT=$('evT');
  const linfo=$('linfo');

  const up=s=>(s||'').toString().toUpperCase();
  const first=s=>up(String(s||'').trim().split(/\\s+/)[0]);

  function renderDots(list){
    const arr=Array.isArray(list)?list:[];
    dots.innerHTML='';
    const targetVisible=14;
    const scale=arr.length<=targetVisible?1:Math.max(0.56,targetVisible/arr.length);
    document.documentElement.style.setProperty('--dotScale',String(scale));
    for(const raw of arr){
      let t=String(raw??'').trim();
      const d=document.createElement('div'); d.className='dot';
      if(!t||t==='0'||t==='•'){ t='·'; }
      if(t==='4') d.classList.add('blue');
      else if(t==='6') d.classList.add('green');
      else if(t==='W') d.classList.add('red');
      else if(/^Wd/i.test(t)||/^Nb/i.test(t)||/^Ro/i.test(t)||/run\\s*out/i.test(t)){ d.classList.add('badge'); t=t.toUpperCase(); }
      d.textContent=t; dots.appendChild(d);
    }
  }

  // Event banners (4/6/W/RO + admin FREE-HIT)
  let lastEventKey=null, bannerTimer=null;
  function isRunOutToken(x){ const L=String(x||'').toUpperCase().replace(/[^A-Z]/g,''); return L==='RO'||L==='RUNOUT'; }
  function maybeEvent(s){
    if(s.specialEvent&&(s.specialEvent.type==='FR'||s.specialEvent.type==='FREEHIT')){
      eventWrap.className='event freehit'; evI.textContent='FH'; evT.textContent=s.specialEvent.label||'FREE HIT';
      eventWrap.classList.add('show'); linfo.classList.add('hide');
      clearTimeout(bannerTimer);
      const dur=Number(s.specialEvent.durationMs||20000);
      bannerTimer=setTimeout(()=>{eventWrap.classList.remove('show','four','six','wicket','freehit'); linfo.classList.remove('hide');},dur);
      return;
    }
    const list=Array.isArray(s.overBalls)?s.overBalls:[]; const last=String(list[list.length-1]??'').trim(); if(!last) return;
    const key=\`\${Number(s.overs||0)}.\${Number(s.balls||0)}-\${last}\`; if(key===lastEventKey) return; lastEventKey=key;
    eventWrap.className='event'; const token=last.toUpperCase();
    if(token==='4'||token==='6'||token==='W'||isRunOutToken(token)){
      if(token==='4'){ eventWrap.classList.add('four'); evI.textContent='4'; evT.textContent='FOUR'; }
      else if(token==='6'){ eventWrap.classList.add('six'); evI.textContent='6'; evT.textContent='SIX'; }
      else { eventWrap.classList.add('wicket'); evI.textContent='W'; evT.textContent='WICKET'; }
      eventWrap.classList.add('show'); linfo.classList.add('hide');
      clearTimeout(bannerTimer);
      bannerTimer=setTimeout(()=>{eventWrap.classList.remove('show','four','six','wicket','freehit'); linfo.classList.remove('hide');},20000);
    }
  }

  const state={overlay:null,match:null};

  function render(){
    const s=state.overlay||{}; const m=state.match||{};
    teamA.textContent=up(s.battingTeam||m.team1||'—');
    teamB.textContent=up(s.bowlingTeam||m.team2||'—');
    logoA.src=s.battingTeamLogo||m.team1Logo||''; logoB.src=s.bowlingTeamLogo||m.team2Logo||'';
    score.textContent=(s.runs||0)+'-'+(s.wickets||0);

    const st=s.striker||{}, ns=s.nonStriker||{};
    b1.textContent=first(st.name||'—'); b1f.innerHTML=(st.runs||0)+' <span class="sup">('+(st.balls||0)+')</span>';
    b2.textContent=first(ns.name||'—'); b2f.innerHTML=(ns.runs||0)+' <span class="sup">('+(ns.balls||0)+')</span>';

    const bw=s.bowler||{};
    bowName.textContent=first(bw.name||'—');
    const w=Number(bw.wickets||0), r=Number(bw.runs||0);
    const ov=(bw.overs!=null?bw.overs:0);
    bowf.textContent=w+'-'+ov+'-'+r;

    rr.textContent='RR '+(s.runRate||'0.00');

    const bpo=Number(s.ballsPerOver||6);
    const target=(s.target??s.chaseTarget);

    let needRuns=(s.needRuns??s.runsNeeded??s.req_runs);
    if(needRuns==null&&typeof target==='number'){ needRuns=Math.max(Number(target)-Number(s.runs||0),0); }
    if(needRuns!=null) needRuns=Math.max(Number(needRuns),0);

    const ballsLeftDirect=(s.ballsLeft??s.ballsRemaining??s.balls_to_go??null);
    const oversLeftDirect=(s.oversLeft??s.oversRemaining??null);
    const totalOvers=(m.noOfOvers??s.totalOvers??s.oversLimit??null);
    const bowledBalls=Number(s.overs||0)*bpo+Number(s.balls||0);

    let ballsLeft=null;
    if(ballsLeftDirect!=null) ballsLeft=Number(ballsLeftDirect);
    else if(oversLeftDirect!=null) ballsLeft=Math.max(0,Number(oversLeftDirect)*bpo);
    else if(totalOvers!=null) ballsLeft=Math.max(0,Number(totalOvers)*bpo-bowledBalls);

    if(typeof target==='number'&&!Number.isNaN(target)){ tg.style.display='inline-block'; tg.textContent='TARGET '+target; } else { tg.style.display='none'; }
    if(needRuns!=null&&ballsLeft!=null){ need.style.display='inline-block'; need.textContent='NEED '+needRuns+' FROM '+ballsLeft; } else { need.style.display='none'; }

    renderDots(s.overBalls);
    maybeEvent(s);
  }

  try{ const es1=new EventSource('/sse-overlay'); es1.onmessage=e=>{ state.overlay=JSON.parse(e.data)||{}; render(); }; }catch{}
  try{ const es2=new EventSource('/sse-match');   es2.onmessage=e=>{ state.match  =JSON.parse(e.data)||{}; render(); }; }catch{}
</script>
</body>
</html>`);
});













// ===== SUMMARY SCORECARD STATE + SSE =======================================
let summaryState = null; // { match, innings1, innings2, receivedAt }

const summaryClients = new Set();
function broadcastSummary(data) {
  const payload = `data: ${JSON.stringify(data)}\n\n`;
  for (const res of summaryClients) res.write(payload);
}



// POST full match summary once both innings are completed
app.post("/api/summary", (req, res) => {
  try {
    const p = req.body || {};
    if (!p.match || !p.innings1 || !p.innings2) {
      return res.status(400).json({ ok: false, error: "Need { match, innings1, innings2 }" });
    }
    summaryState = { receivedAt: Date.now(), ...p };
    broadcastSummary(summaryState);
    return res.json({ ok: true });
  } catch (err) {
    console.error("POST /api/summary:", err);
    return res.status(500).json({ ok: false });
  }
});

// Read current summary (useful for debugging/polling)
app.get("/api/summary", (_req, res) => {
  res.json(summaryState || { ok: false, error: "No summary yet" });
});

// Server-Sent Events stream (instant updates to the overlay)
app.get("/sse-summary", (req, res) => {
  res.set({
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-store",
    "Connection": "keep-alive",
  });
  res.flushHeaders?.();
  res.write(`data: ${JSON.stringify(summaryState)}\n\n`);
  summaryClients.add(res);
  req.on("close", () => summaryClients.delete(res));
});


// ===== SUMMARY OVERLAY PAGE (OBS) ==========================================
app.get("/summary", (_req, res) => {
  res
    .set("Content-Type", "text/html; charset=utf-8")
    .send(renderSummaryOverlayHtml());
});

function renderSummaryOverlayHtml() {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>Score Summary</title>
<style>
  /* Much lighter translucency */
  :root {
    --bg: rgba(11, 15, 20, 1);      /* keep fully transparent page */
    --card: rgba(18, 24, 33, 1);   /* was .60 -> now .35 */
    --blkbg: rgba(15, 20, 28, 1);  /* was .50 -> now .25 */
    --bd: rgba(34, 48, 66, 1);     /* was .40 -> now .22 */
    --mut: #9fb0c3;
    --txt: #e8f1ff;
    --accent: #4aa5ff;
  }

  html,body{margin:0;background:transparent;color:var(--txt);font-family:ui-sans-serif,system-ui,Segoe UI,Roboto,Arial}
  .wrap{padding:12px}
  .card{
    background:var(--card);
    border:1px solid var(--bd);
    border-radius:12px;
    max-width:1200px;
    margin:0 auto 14px;
    box-shadow:0 6px 24px rgba(0,0,0,.12); /* softer */
  }
  .head{
    display:flex;justify-content:space-between;align-items:center;
    padding:10px 14px;border-bottom:1px solid var(--bd)
  }
  .ttl{font-weight:900;letter-spacing:.02em}
  .pill{
    font-size:12px;color:var(--mut);
    border:1px solid var(--bd);
    padding:4px 8px;border-radius:999px;
    background: rgba(255,255,255,0.035); /* lighter */
  }
  .body{padding:12px}
  .teams{display:flex;align-items:center;justify-content:center;gap:12px;margin-bottom:8px}
  .teams img{
    height:32px;border-radius:6px;border:1px solid var(--bd);
    background: rgba(255,255,255,0.75); /* logo plate a bit see-through */
  }
  .vs{font-weight:900;opacity:.85}
  .mut{color:var(--mut)}
  .blk{
    background:var(--blkbg);
    border:1px solid var(--bd);
    border-radius:10px;
    padding:10px
  }
  .grid{display:grid;grid-template-columns:1fr 1fr;gap:12px}
  table{width:100%;border-collapse:collapse;margin-top:6px}
  th,td{padding:6px 8px;border-bottom:1px solid var(--bd);font-size:13px}
  th{color:var(--mut);text-align:left}
  td.right, th.right{text-align:right}
  .empty{padding:36px 0;text-align:center;color:var(--mut)}
</style>
</head>
<body>
<div class="wrap">
  <div class="card">
    <div class="head">
      <div class="ttl">Score Summary</div>
      <div id="status" class="pill">Waiting for summary…</div>
    </div>
    <div class="body">
      <div id="hdr"></div>
      <div id="inn1"></div>
      <div id="inn2"></div>
    </div>
  </div>
</div>
<script>
  const $ = (id)=>document.getElementById(id);

  function headerView(m){
    if(!m) return '';
    return \`
      <div class="teams">
        \${m.tournamentLogo ? \`<img src="\${m.tournamentLogo}" alt="">\` : ''}
        <div><strong>\${m.tournamentName || ''}</strong> <span class="mut">at</span> \${m.ground || '-'}</div>
      </div>
      <div class="teams">
        \${m.team1Logo ? \`<img src="\${m.team1Logo}" alt="">\` : ''}
        <strong>\${m.team1 || ('#'+(m.team1Id??''))}</strong>
        <span class="vs">VS</span>
        <strong>\${m.team2 || ('#'+(m.team2Id??''))}</strong>
        \${m.team2Logo ? \`<img src="\${m.team2Logo}" alt="">\` : ''}
      </div>\`;
  }

  function batTable(title, list){
    if(!list?.length) return '<div class="blk empty">No batting data</div>';
    return \`
      <div class="blk">
        <strong>\${title} Batting</strong>
        <table><thead>
          <tr><th>Player</th><th class="right">R</th><th class="right">B</th><th class="right">4s</th><th class="right">6s</th><th class="right">SR</th></tr>
        </thead><tbody>
          \${list.map(r=>{
            const R=r.runs??0, B=r.balls??0, F=r.fours??0, S=r.sixes??0, SR=B>0?((R/B)*100).toFixed(2):'0.00';
            return \`<tr>
              <td>\${r.name||('#'+(r.id??''))}</td>
              <td class="right">\${R}</td><td class="right">\${B}</td><td class="right">\${F}</td><td class="right">\${S}</td><td class="right">\${SR}</td>
            </tr>\`
          }).join('')}
        </tbody></table>
      </div>\`;
  }

  function bowlTable(title, list){
    if(!list?.length) return '<div class="blk empty">No bowling data</div>';
    return \`
      <div class="blk">
        <strong>\${title} Bowling</strong>
        <table><thead>
          <tr><th>Player</th><th class="right">Ov</th><th class="right">R</th><th class="right">W</th><th class="right">Econ</th></tr>
        </thead><tbody>
          \${list.map(r=>{
            const O=r.overs??0, R=r.runs??0, W=r.wickets??0, E=O>0?(R/O).toFixed(2):'0.00';
            return \`<tr>
              <td>\${r.name||('#'+(r.id??''))}</td>
              <td class="right">\${O}</td><td class="right">\${R}</td><td class="right">\${W}</td><td class="right">\${E}</td>
            </tr>\`
          }).join('')}
        </tbody></table>
      </div>\`;
  }

  function inningsView(label, inn, batName, bowlName){
    if(!inn) return '<div class="blk empty">Waiting for innings…</div>';
    return \`
      <div class="card" style="margin:10px 0">
        <div class="head">
          <div class="ttl">\${label} — \${batName} <span class="mut">\${inn.runs}/\${inn.wickets} (\${inn.totalOvers} ov)</span></div>
          <div class="pill">\${bowlName} bowling</div>
        </div>
        <div class="body">
          <div class="grid">
            \${batTable(batName, inn.batterStatsWithNames)}
            \${bowlTable(bowlName, inn.bowlerStatsWithNames)}
          </div>
        </div>
      </div>\`;
  }

  function resolveTeamName(match, teamId){
    if(teamId === match.team1Id) return match.team1 || ('#'+(match.team1Id??''));
    return match.team2 || ('#'+(match.team2Id??''));
  }

  function render(data){
    if(!data?.match){ $('status').textContent='Waiting for summary…'; $('hdr').innerHTML=''; $('inn1').innerHTML=''; $('inn2').innerHTML=''; return; }
    $('status').textContent = 'Summary ready';
    $('hdr').innerHTML = headerView(data.match);

    const i1Bat = resolveTeamName(data.match, data.innings1?.battingTeamId ?? data.match.team1Id);
    const i1Bwl = resolveTeamName(data.match, data.innings1?.bowlingTeamId ?? data.match.team2Id);
    const i2Bat = resolveTeamName(data.match, data.innings2?.battingTeamId ?? data.match.team2Id);
    const i2Bwl = resolveTeamName(data.match, data.innings2?.bowlingTeamId ?? data.match.team1Id);

    $('inn1').innerHTML = inningsView('1st Innings', data.innings1, i1Bat, i1Bwl);
    $('inn2').innerHTML = inningsView('2nd Innings', data.innings2, i2Bat, i2Bwl);
  }

  try{
    const es = new EventSource('/sse-summary');
    es.onmessage = (e)=> render(JSON.parse(e.data));
  }catch{
    async function poll(){ try{ const r=await fetch('/api/summary',{cache:'no-store'}); render(await r.json()); }catch{} }
    poll(); setInterval(poll, 2000);
  }
</script>
</body>
</html>`;
}





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
  console.log(`Overlay (FREEHIT) → http://localhost:${PORT}/overlay/freehit`);
});