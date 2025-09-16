
# Scoreboard Backend (Express + SSE)

## Run
```bash
cd backend
npm install
npm run dev
```
- API: http://localhost:4000/api/score
- SSE: http://localhost:4000/sse
- OBS Overlay: http://localhost:4000/overlay

## Update Score (example)
```bash
curl -X POST http://localhost:4000/api/score   -H "Content-Type: application/json"   -d '{ "teamA":"Warriors", "teamB":"Titans", "runsA":85, "wicketsA":2, "overs":"10.3", "runRate":"8.25" }'
```
All connected overlays update instantly.
