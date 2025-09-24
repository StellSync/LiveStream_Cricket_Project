
# OBS Scoreboard MERN (Minimal Demo)

This demo includes:
- **backend/** Express server with SSE (`/sse`), JSON API (`/api/score`), and an **OBS-ready overlay** at `/overlay`.
- **frontend/** React (Vite) admin page to update the score and see a live preview.

## Quick Start

### 1) Start the backend
```bash
cd backend
npm install
npm run dev
```
Server: http://localhost:4000  
Overlay (for OBS): http://localhost:4000/overlay

### 2) Start the frontend
```bash
npm install @mui/icons-material
cd ../frontend
npm install
npm run dev
```
Admin UI: http://localhost:5173

### 3) Add to OBS
- Add **Browser Source** with URL: `http://localhost:4000/overlay`
- Size the source (e.g., 1920x90). The bar has transparent-friendly style.

### Update Score
Use the Admin UI (or curl):
```bash
curl -X POST http://localhost:4000/api/score   -H "Content-Type: application/json"   -d '{ "teamA":"Warriors", "teamB":"Titans", "runsA":42, "wicketsA":1, "overs":"5.4", "runRate":"7.46" }'
```
Changes appear instantly on the overlay via SSE.

> Note: This is a **demo**. No auth, in-memory state only.



