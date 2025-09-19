// src/pages/MatchesPage.jsx
import { useEffect, useMemo, useState } from "react";
import {
  getMatches,
  createMatch,
  updateMatch,
  deleteMatch,
  getTeams,
  getTournaments,
} from "../lib/api.js";

const emptyForm = {
  tournamentId: "",
  team1Id: "",
  team2Id: "",
  matchNumber: "",
  overType: "",                  // numeric string in form; cast on submit
  noOfOvers: "",
  date: "",
  startTime: "",
  IsCountWideBall: false,
  IsCountNoBall: false,
};

// Fixed scrollable area height for the right card (px)
const MATCHES_PANEL_HEIGHT = 850;

// inner per-tournament section scroll height (px)
const GROUP_TABLE_MAX_HEIGHT = 320;

export default function MatchesPage() {
  const [items, setItems] = useState([]);
  const [teams, setTeams] = useState([]);
  const [tournaments, setTournaments] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);

  // Filters
  const [filterTournamentId, setFilterTournamentId] = useState(""); // '' = All
  const [groupSort, setGroupSort] = useState("latest"); // 'latest' | 'oldest'

  async function load() {
    const [{ data: matches }, { data: teamsData }, { data: tourData }] =
      await Promise.all([getMatches(), getTeams(), getTournaments()]);
    setItems(matches || []);
    setTeams(teamsData || []);
    setTournaments(tourData || []);
  }

  useEffect(() => { load(); }, []);

  // --- Ensure team2 never equals team1 ---
  useEffect(() => {
    if (form.team1Id && form.team1Id === form.team2Id) {
      setForm((prev) => ({ ...prev, team2Id: "" }));
    }
  }, [form.team1Id]); // runs when team1 changes

  // Filtered list for Team 2 (excludes Team 1)
  const team2Options = useMemo(() => {
    if (!form.team1Id) return teams;
    return teams.filter((t) => String(t.id) !== String(form.team1Id));
  }, [teams, form.team1Id]);

  function onChange(e) {
    const { name, value, type, checked } = e.target;

    // Special handling for team1Id: also clear team2Id if same
    if (name === "team1Id") {
      setForm((prev) => {
        const next = { ...prev, team1Id: value };
        if (String(prev.team2Id) === String(value)) next.team2Id = "";
        return next;
      });
      return;
    }

    setForm((prev) => ({ ...prev, [name]: type === "checkbox" ? checked : value }));
  }

  async function onSubmit(e) {
    e.preventDefault();

    if (form.team1Id && form.team1Id === form.team2Id) {
      alert("Team 1 and Team 2 must be different.");
      return;
    }
    if (!form.overType || Number.isNaN(Number(form.overType))) {
      alert("Over Type must be a number (e.g., 6, 8).");
      return;
    }

    const payload = {
      tournamentId: Number.parseInt(form.tournamentId, 10),
      team1Id: Number.parseInt(form.team1Id, 10),
      team2Id: Number.parseInt(form.team2Id, 10),
      matchNumber: Number.parseInt(form.matchNumber, 10),
      overType: Number.parseInt(form.overType, 10),
      noOfOvers: Number.parseInt(form.noOfOvers, 10),
      date: form.date,
      startTime: form.startTime,
      IsCountWideBall: !!form.IsCountWideBall,
      IsCountNoBall: !!form.IsCountNoBall,
    };

    if (editingId) await updateMatch(editingId, payload);
    else await createMatch(payload);

    setEditingId(null);
    setForm(emptyForm);
    load();
  }

  function onEdit(m) {
    setEditingId(m.id ?? m._id);
    setForm({
      tournamentId: m.tournamentId?.toString() ?? "",
      team1Id: m.team1Id?.toString() ?? "",
      team2Id: m.team2Id?.toString() ?? "",
      matchNumber: m.matchNumber != null ? String(m.matchNumber) : "",
      overType: m.overType != null ? String(m.overType) : "",
      noOfOvers: m.noOfOvers != null ? String(m.noOfOvers) : "",
      date: m.date ? m.date.slice(0, 10) : "",
      startTime: m.startTime || "",
      IsCountWideBall: !!m.IsCountWideBall,
      IsCountNoBall: !!m.IsCountNoBall,
    });
  }

  async function onDelete(id) {
    if (confirm("Delete match?")) {
      await deleteMatch(id);
      load();
    }
  }

  const teamName = (id, fallbackName) =>
    fallbackName || teams.find((t) => t.id === id)?.teamName || `#${id}`;

  const tournamentName = (id, fallbackName) =>
    fallbackName || tournaments.find((t) => t.id === id)?.name || `#${id}`;

  // -------- Filtered items by tournament ----------
  const filteredItems = useMemo(() => {
    if (!filterTournamentId) return items;
    const idNum = Number(filterTournamentId);
    return items.filter((m) => m.tournamentId === idNum);
  }, [items, filterTournamentId]);

  // Helper: get tournament createdAt if present; otherwise derive from matches or id
  const getTournamentSortKey = (tournamentId, groupRows) => {
    const t = tournaments.find((x) => x.id === tournamentId);
    const tCreatedTs = t?.createdAt ? Date.parse(t.createdAt) : undefined;

    if (!Number.isNaN(tCreatedTs)) return tCreatedTs;

    // fallback: newest match createdAt in this group
    const maxMatchTs = groupRows
      .map((r) => (r.createdAt ? Date.parse(r.createdAt) : undefined))
      .filter((x) => !Number.isNaN(x))
      .reduce((a, b) => (a == null ? b : Math.max(a, b)), undefined);

    if (maxMatchTs != null) return maxMatchTs;

    // final fallback: tournamentId (assume increasing)
    return tournamentId;
  };

  // ---------- Grouped view -----------
  const grouped = useMemo(() => {
    const groups = new Map(); // id -> { name, rows: [], sortKey }
    for (const m of filteredItems) {
      const key = m.tournamentId;
      const name = tournamentName(m.tournamentId, m.tournamentName);
      if (!groups.has(key)) groups.set(key, { name, rows: [] });
      groups.get(key).rows.push(m);
    }

    const arr = Array.from(groups.entries()).map(([id, g]) => {
      const sortKey = getTournamentSortKey(id, g.rows);
      return {
        id,
        name: g.name,
        rows: g.rows
          .slice()
          .sort(
            (x, y) =>
              (x.matchNumber ?? 0) - (y.matchNumber ?? 0) ||
              (y.id ?? 0) - (x.id ?? 0)
          ),
        sortKey,
      };
    });

    // Apply group order: latest (desc) or oldest (asc)
    arr.sort((a, b) =>
      groupSort === "latest" ? b.sortKey - a.sortKey : a.sortKey - b.sortKey
    );

    return arr;
  }, [filteredItems, tournaments, groupSort]);

  return (
    // full-width, minimal outer padding; bigger gutter between the two cards
    <div className="container-fluid px-2 px-md-3">
      <div className="row gy-3 gx-5">
        {/* Form (wider: 5/12) */}
        <div className="col-12 col-lg-5">
          <div className="card shadow-sm h-100">
            <div className="card-body">
              <h5 className="card-title">
                {editingId ? "Edit Match" : "Create Match"}
              </h5>

              <form onSubmit={onSubmit} className="row g-3">
                <div className="col-12">
                  <label className="form-label">Tournament</label>
                  <select
                    name="tournamentId"
                    className="form-select"
                    value={form.tournamentId}
                    onChange={onChange}
                    required
                  >
                    <option value="">-- Select Tournament --</option>
                    {tournaments.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name} (#{t.id})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="col-6">
                  <label className="form-label">Team 1</label>
                  <select
                    name="team1Id"
                    className="form-select"
                    value={form.team1Id}
                    onChange={onChange}
                    required
                  >
                    <option value="">-- Select Team 1 --</option>
                    {teams.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.teamName} (#{t.id})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="col-6">
                  <label className="form-label">Team 2</label>
                  <select
                    name="team2Id"
                    className="form-select"
                    value={form.team2Id}
                    onChange={onChange}
                    required
                  >
                    <option value="">-- Select Team 2 --</option>
                    {team2Options.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.teamName} (#{t.id})
                      </option>
                    ))}
                  </select>
                  {/* If team1 not chosen yet, team2 shows all. Once team1 picked, that team disappears here. */}
                </div>

                <div className="col-6">
                  <label className="form-label">Match Number</label>
                  <input
                    type="number"
                    name="matchNumber"
                    className="form-control"
                    value={form.matchNumber}
                    onChange={onChange}
                    required
                    min="1"
                    step="1"
                    placeholder="e.g. 1"
                  />
                </div>

                <div className="col-6">
                  <label className="form-label">No of Balls per Over</label>
                  <input
                    type="number"
                    name="overType"
                    className="form-control"
                    value={form.overType}
                    onChange={onChange}
                    required
                    min="1"
                    step="1"
                    placeholder="e.g. 6"
                  />
                </div>

                <div className="col-6">
                  <label className="form-label">No. of Overs</label>
                  <input
                    type="number"
                    name="noOfOvers"
                    className="form-control"
                    value={form.noOfOvers}
                    onChange={onChange}
                    required
                    min="1"
                    step="1"
                  />
                </div>

                <div className="col-6">
                  <label className="form-label">Date</label>
                  <input
                    type="date"
                    name="date"
                    className="form-control"
                    value={form.date}
                    onChange={onChange}
                    required
                  />
                </div>

                <div className="col-6">
                  <label className="form-label">Start Time</label>
                  <input
                    type="time"
                    name="startTime"
                    className="form-control"
                    value={form.startTime}
                    onChange={onChange}
                    required
                  />
                </div>

                <div className="col-6 d-flex align-items-center gap-3" />

                <div className="col-6 d-flex align-items-center gap-3">
                  <div className="form-check">
                    <input
                      id="noballFlag"
                      className="form-check-input"
                      type="checkbox"
                      name="IsCountNoBall"
                      checked={form.IsCountNoBall}
                      onChange={onChange}
                    />
                    <label className="form-check-label" htmlFor="noballFlag">
                      Count No Ball
                    </label>
                  </div>
                  <div className="form-check">
                    <input
                      id="wideFlag"
                      className="form-check-input"
                      type="checkbox"
                      name="IsCountWideBall"
                      checked={form.IsCountWideBall}
                      onChange={onChange}
                    />
                    <label className="form-check-label" htmlFor="wideFlag">
                      Count Wide Ball
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

        {/* List + Filters + Grouping (wider: 7/12) */}
        <div className="col-12 col-lg-7">
          <div className="card shadow-sm" style={{ height: MATCHES_PANEL_HEIGHT }}>
            <div className="card-body d-flex flex-column" style={{ height: "100%", minHeight: 0 }}>
              {/* Filters row */}
              <div className="d-flex flex-wrap align-items-center justify-content-between mb-3">
                <h5 className="card-title mb-0">Matches</h5>

                <div className="d-flex gap-2 flex-wrap">
                  {/* Tournament filter */}
                  <div className="d-flex align-items-center gap-2">
                    <label className="form-label mb-0">Tournament:</label>
                    <select
                      className="form-select"
                      style={{ minWidth: 220 }}
                      value={filterTournamentId}
                      onChange={(e) => setFilterTournamentId(e.target.value)}
                    >
                      <option value="">All tournaments</option>
                      {tournaments.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Group order filter */}
                  <div className="d-flex align-items-center gap-2">
                    <label className="form-label mb-0">Order:</label>
                    <select
                      className="form-select"
                      style={{ minWidth: 200 }}
                      value={groupSort}
                      onChange={(e) => setGroupSort(e.target.value)}
                    >
                      <option value="latest">Latest entered first</option>
                      <option value="oldest">Oldest first</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Outer scrollable content area (card-level) */}
              <div style={{ overflow: "auto", minHeight: 0, flex: "1 1 auto" }}>
                {grouped.length === 0 ? (
                  <div className="text-center text-muted py-4">No matches</div>
                ) : (
                  grouped.map((grp) => (
                    <div key={grp.id} className="mb-4">
                      {/* Group header */}
                      <div className="d-flex align-items-center justify-content-between bg-light px-3 py-2 rounded border">
                        <div className="fw-semibold">
                          {grp.name} <span className="text-muted">#{grp.id}</span>
                        </div>
                        <div className="small text-muted">
                          {grp.rows.length} match(es)
                        </div>
                      </div>

                      {/* INNER scroll area for this tournament's matches */}
                      <div
                        className="mt-2 border rounded"
                        style={{
                          maxHeight: GROUP_TABLE_MAX_HEIGHT,
                          overflow: "auto",
                          WebkitOverflowScrolling: "touch",
                        }}
                      >
                        <table className="table table-striped align-middle mb-0">
                          <thead
                            className="table-light"
                            style={{ position: "sticky", top: 0, zIndex: 1, background: "white" }}
                          >
                            <tr>
                              <th style={{ width: 70 }}>ID</th>
                              <th style={{ width: 90 }}>Match #</th>
                              <th>Teams</th>
                              <th style={{ width: 120 }}>Balls/Over</th>
                              <th style={{ width: 90 }}>Overs</th>
                              <th style={{ width: 80 }}>Wide?</th>
                              <th style={{ width: 80 }}>NoBall?</th>
                              <th style={{ width: 110 }}>Date</th>
                              <th style={{ width: 90 }}>Start</th>
                              <th style={{ width: 140 }}></th>
                            </tr>
                          </thead>
                          <tbody>
                            {grp.rows.map((m) => (
                              <tr key={m.id ?? m._id}>
                                <td>{m.id ?? m._id}</td>
                                <td>{m.matchNumber}</td>
                                <td>
                                  {teamName(m.team1Id, m.team1Name)} vs{" "}
                                  {teamName(m.team2Id, m.team2Name)}
                                </td>
                                <td>{m.overType}</td>
                                <td>{m.noOfOvers}</td>
                                <td>{m.IsCountWideBall ? "Yes" : "No"}</td>
                                <td>{m.IsCountNoBall ? "Yes" : "No"}</td>
                                <td>{m.date?.slice(0, 10)}</td>
                                <td>{m.startTime}</td>
                                <td className="text-end">
                                  <button
                                    className="btn btn-sm btn-outline-primary me-2"
                                    onClick={() => onEdit(m)}
                                  >
                                    Edit
                                  </button>
                                  <button
                                    className="btn btn-sm btn-outline-danger"
                                    onClick={() => onDelete(m.id ?? m._id)}
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
              {/* /Outer scrollable area */}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
