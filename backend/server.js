import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 4000;

// CORS + JSON
app.use(cors({ origin: true }));
app.use(express.json());

// ---------- In-memory match state ----------
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

// ---------- SSE clients ----------
const clients = new Set();
function broadcast(data) {
  const payload = `data: ${JSON.stringify(data)}\n\n`;
  for (const res of clients) res.write(payload);
}

app.get("/api/score", (req, res) => {
  res.json(score);
});

app.post("/api/score", (req, res) => {
  const body = req.body || {};
  score = {
    ...score,
    ...Object.fromEntries(Object.entries(body).filter(([k, v]) => v !== undefined)),
    lastUpdated: new Date().toISOString(),
  };
  broadcast(score);
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

// ---------- OBS overlay (browser source) ----------
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
  res.set("Content-Type", "text/html; charset=utf-8");
  res.send(html);
});

// ---------- Serve React build in production (when Electron passes the path) ----------
const distFromElectron = process.env.FRONTEND_DIST;
if (distFromElectron) {
  console.log("Serving admin UI from:", distFromElectron);
  app.use(express.static(distFromElectron));
  app.get("/", (_req, res) => {
    res.sendFile(path.join(distFromElectron, "index.html"));
  });
}

app.listen(PORT, () => {
  console.log(`Scoreboard backend running on http://localhost:${PORT}`);
  console.log(`Overlay for OBS at http://localhost:${PORT}/overlay`);
});
