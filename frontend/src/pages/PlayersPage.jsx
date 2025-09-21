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
  position: "", // keep as string in the form for easier validation
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

  // NEW: remember the last selected team for convenience
  const [lastTeamId, setLastTeamId] = useState("");

  // NEW: form validation state
  const [errors, setErrors] = useState({});

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

  // --- Validation helpers ---
  function validate(values) {
    const e = {};

    // Team required
    if (!values.teamId) {
      e.teamId = "Please select a team.";
    }

    // Player Name required (min 2 chars)
    const name = (values.playerName || "").trim();
    if (!name) {
      e.playerName = "Player name is required.";
    } else if (name.length < 2) {
      e.playerName = "Player name must be at least 2 characters.";
    }

    // Position: required, integer, 0..11
    let posMsg = "";
    const raw = values.position;
    if (raw === "" || raw === null || raw === undefined) {
      posMsg = "Position is required.";
    } else {
      const num = Number(raw);
      if (!Number.isInteger(num)) posMsg = "Position must be an integer.";
      else if (num < 0 || num > 11) posMsg = "Position must be between 0 and 11.";
    }
    if (posMsg) e.position = posMsg;

    // At least one role among Batter/Bowler/WK
    if (!values.isBatter && !values.isBaller && !values.isWk) {
      e.roles = "Select at least one role: Batter, Bowler, or Wicket Keeper.";
    }

    return e;
  }

  function onChange(e) {
    const { name, value, type, checked } = e.target;
    const next = {
      ...form,
      [name]: type === "checkbox" ? checked : value,
    };

    // If team changed by admin, remember it as last selection
    if (name === "teamId") {
      setLastTeamId(value);
    }

    setForm(next);
    setErrors((prev) => {
      // re-validate the single field (and dependent 'roles' group if relevant)
      const fresh = validate(next);
      return { ...prev, [name]: fresh[name], ...(name.startsWith("is") ? { roles: fresh.roles } : {}) };
    });
  }

  async function onSubmit(e) {
    e.preventDefault();

    const freshErrors = validate(form);
    setErrors(freshErrors);
    if (Object.keys(freshErrors).length > 0) {
      return; // don't submit if invalid
    }

    // Build payload with proper types
    const payload = {
      ...form,
      teamId: Number(form.teamId),
      position: Number(form.position),
    };

    if (editingId) await updatePlayer(editingId, payload);
    else await createPlayer(payload);

    // Remember the team used on successful submit
    const usedTeamId = String(payload.teamId);
    setLastTeamId(usedTeamId);

    // Reset form BUT keep previously selected team as default
    setEditingId(null);
    setForm({
      ...emptyForm,
      teamId: usedTeamId,
    });
    setErrors({}); // clear errors
    load();
  }

  function onEdit(p) {
    setEditingId(p.id);
    const tid = p.teamId ? String(p.teamId) : "";
    setLastTeamId(tid); // make this the remembered team as well
    setForm({
      teamId: tid,
      playerName: p.playerName || "",
      playerAddress: p.playerAddress || "",
      phone: p.phone || "",
      position: (p.position ?? "") === "" ? "" : String(p.position),
      isBatter: !!p.isBatter,
      isBaller: !!p.isBaller,
      isWk: !!p.isWk,
      isCaptain: !!p.isCaptain,
    });
    setErrors({});
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
      (p.phone ? String(p.phone).toLowerCase().includes(q) : false) ||
      (p.position !== undefined && p.position !== null
        ? String(p.position).toLowerCase().includes(q)
        : false) ||
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

  // utility: Bootstrap invalid state helper
  const invalid = (key) => Boolean(errors[key]);

  return (
    <div className="row g-4">
      {/* LEFT: create / edit form */}
      <div className="col-lg-5">
        <div className="card shadow-sm">
          <div className="card-body">
            <h5 className="card-title">
              {editingId ? "Edit Player" : "Add Player"}
            </h5>
            <form onSubmit={onSubmit} className="row g-3" noValidate>
              <div className="col-12">
                <label className="form-label">Team</label>
                <select
                  name="teamId"
                  className={`form-select ${invalid("teamId") ? "is-invalid" : ""}`}
                  value={form.teamId || lastTeamId /* safety: show remembered if form empty */}
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
                {invalid("teamId") && (
                  <div className="invalid-feedback">{errors.teamId}</div>
                )}
              </div>

              <div className="col-6">
                <label className="form-label">Player Name</label>
                <input
                  name="playerName"
                  className={`form-control ${invalid("playerName") ? "is-invalid" : ""}`}
                  value={form.playerName}
                  onChange={onChange}
                  required
                />
                {invalid("playerName") && (
                  <div className="invalid-feedback">{errors.playerName}</div>
                )}
              </div>

              <div className="col-6">
                <label className="form-label">Position</label>
                <input
                  type="number"
                  name="position"
                  className={`form-control ${invalid("position") ? "is-invalid" : ""}`}
                  value={form.position}
                  onChange={(e) => {
                    // keep as string but clamp visually
                    let v = e.target.value;
                    // allow empty (so required kicks in), otherwise clamp
                    if (v !== "") {
                      const n = Number(v);
                      if (!Number.isNaN(n)) {
                        if (n < 0) v = "0";
                        if (n > 11) v = "11";
                      }
                    }
                    onChange({ target: { name: "position", value: v, type: "text", checked: undefined } });
                  }}
                  min={0}
                  max={11}
                  step={1}
                  required
                />
                {invalid("position") && (
                  <div className="invalid-feedback">{errors.position}</div>
                )}
              </div>

              <div className="col-6">
                <label className="form-label">Phone</label>
                <input
                  name="phone"
                  className="form-control"
                  value={form.phone}
                  onChange={onChange}
                  placeholder=""
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

                {/* Roles validation message */}
                {invalid("roles") && (
                  <div className="text-danger small mt-1">{errors.roles}</div>
                )}
              </div>

              <div className="col-12 d-flex gap-2">
                <button className="btn btn-primary" type="submit">
                  {editingId ? "Update" : "Create"}
                </button>
                {editingId && (
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => {
                      setEditingId(null);
                      // Keep last selected team as default when cancelling
                      setForm({ ...emptyForm, teamId: lastTeamId || "" });
                      setErrors({});
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
          <div className="card-body d-flex flex-column" style={{ height: "90%" }}>
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
                        {grp.name} <span className="text-muted">#{grp.teamId}</span>
                      </div>
                      <div className="small text-muted">
                        {grp.rows.length} player{grp.rows.length === 1 ? "" : "s"}
                      </div>
                    </div>

                    {/* TEAMWISE SCROLLER */}
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
                                {p.position ?? "-"}
                              </td>
                              <td>
                                {p.isCaptain && (
                                  <span className="badge text-bg-warning me-1">C</span>
                                )}
                                {p.isWk && (
                                  <span className="badge text-bg-info me-1">WK</span>
                                )}
                                {p.isBatter && (
                                  <span className="badge text-bg-primary me-1">Bat</span>
                                )}
                                {p.isBaller && (
                                  <span className="badge text-bg-success me-1">Bowl</span>
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
