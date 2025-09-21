// src/pages/PlayersPage.jsx
import { useEffect, useMemo, useState } from "react";
import {
  getPlayers,
  createPlayer,
  updatePlayer,
  deletePlayer,
  getTeams,
} from "../lib/api.js";

const emptyForm = {
  teamId: "",
  playerName: "",
  playerAddress: "",
  phone: "",
  position: 0,
  isBatter: false,
  isBaller: false,
  isWk: false,
  isCaptain: false,
};

// Fixed heights for scroll areas (tweak if you want)
const MAIN_PANEL_HEIGHT = 720; // right card height
const TEAM_SECTION_BODY_HEIGHT = 260; // inner per-team scroll height

export default function PlayersPage() {
  const [items, setItems] = useState([]);
  const [teams, setTeams] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [filterTeamId, setFilterTeamId] = useState(""); // '' = all
  const [query, setQuery] = useState(""); // optional player search

  async function load() {
    const [playersRes, teamsRes] = await Promise.all([
      getPlayers(),
      getTeams(),
    ]);
    setItems(playersRes.data || []);
    setTeams(teamsRes.data || []);
  }
  useEffect(() => {
    load();
  }, []);

  function onChange(e) {
    const { name, value, type, checked } = e.target;
    setForm((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
  }

  async function onSubmit(e) {
    e.preventDefault();
    const payload = {
      ...form,
      teamId: Number(form.teamId),
    };
    if (editingId) await updatePlayer(editingId, payload);
    else await createPlayer(payload);
    setEditingId(null);
    setForm(emptyForm);
    load();
  }

  function onEdit(p) {
    setEditingId(p.id);
    setForm({
      teamId: p.teamId ? String(p.teamId) : "",
      playerName: p.playerName || "",
      playerAddress: p.playerAddress || "",
      phone: p.phone || "",
      position: p.position || 0,
      isBatter: !!p.isBatter,
      isBaller: !!p.isBaller,
      isWk: !!p.isWk,
      isCaptain: !!p.isCaptain,
    });
  }

  async function onDelete(id) {
    if (confirm("Delete player?")) {
      await deletePlayer(id);
      load();
    }
  }

  // ---- helpers ----
  const teamMap = useMemo(() => {
    const m = new Map();
    for (const t of teams) m.set(t.id, t.teamName);
    return m;
  }, [teams]);

  const teamName = (id) => teamMap.get(id) || `#${id}`;

  // Optional search by player name/phone/position
  const searchFilter = (p) => {
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return (
      p.playerName?.toLowerCase().includes(q) ||
      p.phone?.toLowerCase().includes(q) ||
      p.position?.toLowerCase().includes(q) ||
      teamName(p.teamId)?.toLowerCase().includes(q)
    );
  };

  // Filter players by team & search
  const visiblePlayers = useMemo(() => {
    const teamFiltered = filterTeamId
      ? items.filter((p) => p.teamId === Number(filterTeamId))
      : items;
    return teamFiltered.filter(searchFilter);
  }, [items, filterTeamId, query]);

  // Group by teamId → section per team
  const groupedByTeam = useMemo(() => {
    const groups = new Map(); // teamId -> { name, rows: [] }
    for (const p of visiblePlayers) {
      const tid = p.teamId;
      const name = teamName(tid);
      if (!groups.has(tid)) groups.set(tid, { name, rows: [] });
      groups.get(tid).rows.push(p);
    }
    // sort teams alphabetically by name
    const arr = Array.from(groups.entries()).map(([tid, g]) => ({
      teamId: tid,
      name: g.name,
      rows: g.rows.sort((a, b) =>
        (a.playerName || "").localeCompare(b.playerName || "", undefined, {
          sensitivity: "base",
        })
      ),
    }));
    arr.sort((a, b) =>
      (a.name || "").localeCompare(b.name || "", undefined, {
        sensitivity: "base",
      })
    );
    return arr;
  }, [visiblePlayers, teamMap]);

  return (
    <div className="row g-4">
      {/* LEFT: create / edit form */}
      <div className="col-lg-5">
        <div className="card shadow-sm">
          <div className="card-body">
            <h5 className="card-title">
              {editingId ? "Edit Player" : "Add Player"}
            </h5>
            <form onSubmit={onSubmit} className="row g-3">
              <div className="col-12">
                <label className="form-label">Team</label>
                <select
                  name="teamId"
                  className="form-select"
                  value={form.teamId}
                  onChange={onChange}
                  required
                >
                  <option value="">-- Select Team --</option>
                  {teams.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.teamName} (#{t.id})
                    </option>
                  ))}
                </select>
              </div>

              <div className="col-6">
                <label className="form-label">Player Name</label>
                <input
                  name="playerName"
                  className="form-control"
                  value={form.playerName}
                  onChange={onChange}
                  required
                />
              </div>
              <div className="col-6">
                <label className="form-label">Position</label>
                <input
                  type="number"
                  name="position"
                  className="form-control"
                  value={form.position}
                  onChange={onChange}
                />
              </div>
              <div className="col-6">
                <label className="form-label">Phone</label>
                <input
                  name="phone"
                  className="form-control"
                  value={form.phone}
                  onChange={onChange}
                />
              </div>
              <div className="col-6">
                <label className="form-label">Address</label>
                <input
                  name="playerAddress"
                  className="form-control"
                  value={form.playerAddress}
                  onChange={onChange}
                />
              </div>

              <div className="col-12">
                <div className="form-check form-check-inline">
                  <input
                    id="isBatter"
                    className="form-check-input"
                    type="checkbox"
                    name="isBatter"
                    checked={form.isBatter}
                    onChange={onChange}
                  />
                  <label className="form-check-label" htmlFor="isBatter">
                    Batter
                  </label>
                </div>
                <div className="form-check form-check-inline">
                  <input
                    id="isBaller"
                    className="form-check-input"
                    type="checkbox"
                    name="isBaller"
                    checked={form.isBaller}
                    onChange={onChange}
                  />
                  <label className="form-check-label" htmlFor="isBaller">
                    Bowler
                  </label>
                </div>
                <div className="form-check form-check-inline">
                  <input
                    id="isWk"
                    className="form-check-input"
                    type="checkbox"
                    name="isWk"
                    checked={form.isWk}
                    onChange={onChange}
                  />
                  <label className="form-check-label" htmlFor="isWk">
                    Wicket Keeper
                  </label>
                </div>
                <div className="form-check form-check-inline">
                  <input
                    id="isCaptain"
                    className="form-check-input"
                    type="checkbox"
                    name="isCaptain"
                    checked={form.isCaptain}
                    onChange={onChange}
                  />
                  <label className="form-check-label" htmlFor="isCaptain">
                    Captain
                  </label>
                </div>
              </div>

              <div className="col-12 d-flex gap-2">
                <button className="btn btn-primary">
                  {editingId ? "Update" : "Create"}
                </button>
                {editingId && (
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => {
                      setEditingId(null);
                      setForm(emptyForm);
                    }}
                  >
                    Cancel
                  </button>
                )}
              </div>
            </form>
          </div>
        </div>
      </div>

      {/* RIGHT: grouped sections by team with dual scrollers */}
      <div className="col-lg-7">
        <div className="card shadow-sm" style={{ height: MAIN_PANEL_HEIGHT }}>
          <div
            className="card-body d-flex flex-column"
            style={{ height: "90%" }}
          >
            {/* Top bar: filters */}
            <div className="d-flex flex-wrap align-items-center justify-content-between mb-3">
              <h5 className="card-title mb-0">Players</h5>

              <div className="d-flex gap-2 flex-wrap">
                {/* Team filter */}
                <div className="d-flex align-items-center gap-2">
                  <label className="form-label mb-0">Team:</label>
                  <select
                    className="form-select"
                    style={{ minWidth: 220 }}
                    value={filterTeamId}
                    onChange={(e) => setFilterTeamId(e.target.value)}
                  >
                    <option value="">All teams</option>
                    {teams.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.teamName}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Optional: quick player search */}
                <div className="input-group">
                  <span className="input-group-text">Search</span>
                  <input
                    className="form-control"
                    placeholder="player / phone / position / team"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                  />
                </div>
              </div>
            </div>

            {/* MAIN SCROLLER (whole list of team sections) */}
            <div style={{ overflow: "auto" }}>
              {groupedByTeam.length === 0 ? (
                <div className="text-center text-muted py-4">No players</div>
              ) : (
                groupedByTeam.map((grp) => (
                  <div key={grp.teamId} className="mb-4">
                    {/* Section header */}
                    <div className="d-flex align-items-center justify-content-between bg-light px-3 py-2 rounded border">
                      <div className="fw-semibold">
                        {grp.name}{" "}
                        <span className="text-muted">#{grp.teamId}</span>
                      </div>
                      <div className="small text-muted">
                        {grp.rows.length} player
                        {grp.rows.length === 1 ? "" : "s"}
                      </div>
                    </div>

                    {/* TEAMWISE SCROLLER (players inside a fixed height area) */}
                    <div
                      className="mt-2"
                      style={{
                        maxHeight: TEAM_SECTION_BODY_HEIGHT,
                        overflow: "auto",
                      }}
                    >
                      <table className="table table-striped align-middle mb-0">
                        <thead
                          style={{ position: "sticky", top: 0, zIndex: 1 }}
                          className="table-light"
                        >
                          <tr>
                            <th style={{ width: 70 }}>ID</th>
                            <th>Name</th>
                            <th style={{ width: 120 }}>Phone</th>
                            <th style={{ width: 140 }}>Position</th>
                            <th style={{ width: 160 }}>Roles</th>
                            <th style={{ width: 140 }}></th>
                          </tr>
                        </thead>
                        <tbody>
                          {grp.rows.map((p) => (
                            <tr key={p.id}>
                              <td>{p.id}</td>
                              <td>{p.playerName}</td>
                              <td className="text-nowrap">{p.phone || "-"}</td>
                              <td className="text-nowrap">
                                {p.position || "-"}
                              </td>
                              <td>
                                {p.isCaptain && (
                                  <span className="badge text-bg-warning me-1">
                                    C
                                  </span>
                                )}
                                {p.isWk && (
                                  <span className="badge text-bg-info me-1">
                                    WK
                                  </span>
                                )}
                                {p.isBatter && (
                                  <span className="badge text-bg-primary me-1">
                                    Bat
                                  </span>
                                )}
                                {p.isBaller && (
                                  <span className="badge text-bg-success me-1">
                                    Bowl
                                  </span>
                                )}
                              </td>
                              <td className="text-end">
                                <button
                                  className="btn btn-sm btn-outline-primary me-2"
                                  onClick={() => onEdit(p)}
                                >
                                  Edit
                                </button>
                                <button
                                  className="btn btn-sm btn-outline-danger"
                                  onClick={() => onDelete(p.id)}
                                >
                                  Delete
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="card-footer bg-white small text-muted d-flex justify-content-between">
            <span>Total: {items.length}</span>
            <span>
              Showing: {visiblePlayers.length}
              {filterTeamId ? ` (team #${filterTeamId})` : ""}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
