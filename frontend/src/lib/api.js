import axios from "axios";

export const API_BASE =
  import.meta.env.VITE_API_BASE || "http://localhost:5000";

export const api = axios.create({
  baseURL: `${API_BASE}/api`,
  headers: { "Content-Type": "application/json" },
});

// ---- Tournaments ----
export const getTournaments = () => api.get("/tournaments");
export const getTournament = (id) => api.get(`/tournaments/${id}`); // ⬅️ ADDED
export const createTournament = (data) => api.post("/tournaments", data);
export const updateTournament = (id, data) =>
  api.put(`/tournaments/${id}`, data);
export const deleteTournament = (id) => api.delete(`/tournaments/${id}`);

// ---- Teams ----
export const getTeams = () => api.get("/team");
export const createTeam = (data) => api.post("/team", data);
export const updateTeam = (id, data) => api.put(`/team/${id}`, data);
export const deleteTeam = (id) => api.delete(`/team/${id}`);

// ---- Players ----
export const getPlayers = (teamId) =>
  api.get(`/players${teamId ? `?teamId=${teamId}` : ""}`);
export const createPlayer = (data) => api.post("/players", data);
export const updatePlayer = (id, data) => api.put(`/players/${id}`, data);
export const deletePlayer = (id) => api.delete(`/players/${id}`);

// ---- Matches ----
export const getMatches = (params = {}) => api.get("/matches", { params });
export const createMatch = (data) => api.post("/matches", data);
export const updateMatch = (id, data) => api.put(`/matches/${id}`, data);
export const deleteMatch = (id) => api.delete(`/matches/${id}`);

export async function setCurrentMatch(matchInfo) {
  const res = await axios.post(`${API_BASE}/api/current-match`, matchInfo);
  return res.data;
}

export async function getCurrentMatch() {
  const res = await axios.get(`${API_BASE}/api/current-match`);
  return res.data;
}
