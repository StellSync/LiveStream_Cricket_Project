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
import { Autocomplete, TextField } from "@mui/material";

const emptyForm = {
  tournamentId: "",
  team1Id: "",
  team2Id: "",
  matchNumber: "",
  overType: "",
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
// MUI list max height
const LISTBOX_MAX_HEIGHT = 280;

export default function MatchesPage() {
  const [items, setItems] = useState([]);
  const [teams, setTeams] = useState([]);
  const [tournaments, setTournaments] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [pendingDeleteId, setPendingDeleteId] = useState(null);

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
  useEffect(() => {
    load();
  }, []);

  // Ensure team2 never equals team1
  useEffect(() => {
    if (form.team1Id && form.team1Id === form.team2Id) {
      setForm((prev) => ({ ...prev, team2Id: "" }));
    }
  }, [form.team1Id]);

  // ---- Options for Autocomplete ----
  const tournamentOptions = useMemo(() => {
    const arr = (tournaments || []).slice();
    arr.sort((a, b) =>
      (a.name || "").localeCompare(b.name || "", undefined, { sensitivity: "base" })
    );
    return arr.map((t) => ({ id: String(t.id), label: t.name }));
  }, [tournaments]);

  const teamOptionsAll = useMemo(() => {
    const arr = (teams || []).slice();
    arr.sort((a, b) =>
      (a.teamName || "").localeCompare(b.teamName || "", undefined, { sensitivity: "base" })
    );
    return arr.map((t) => ({ id: String(t.id), label: t.teamName }));
  }, [teams]);

  const team2Options = useMemo(() => {
    if (!form.team1Id) return teamOptionsAll;
    return teamOptionsAll.filter((o) => o.id !== String(form.team1Id));
  }, [teamOptionsAll, form.team1Id]);

  // ---- Helpers to resolve names in lists ----
  const teamName = (id, fallbackName) =>
    fallbackName ||
    teams.find((t) => String(t.id) === String(id))?.teamName ||
    `#${id}`;

  const tournamentName = (id, fallbackName) =>
    fallbackName ||
    tournaments.find((t) => String(t.id) === String(id))?.name ||
    `#${id}`;

  // ---- Form change ----
  function onChange(e) {
    const { name, value, type, checked } = e.target;
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
      // <<-- IMPORTANT: send null when startTime is empty so backend stores null
      startTime:
        form.startTime && String(form.startTime).trim() !== ""
          ? String(form.startTime).trim()
          : null,
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
      // show blank when backend stored null
      startTime: m.startTime ?? "",
      IsCountWideBall: !!m.IsCountWideBall,
      IsCountNoBall: !!m.IsCountNoBall,
    });
  }

  async function onDelete(id) {
    if (pendingDeleteId === id) {
      // User clicked "Confirm Delete"
      await deleteMatch(id);
      setPendingDeleteId(null);
      load();
    } else {
      // First click: mark for confirmation
      setPendingDeleteId(id);

      // Optional: auto-reset after 3s if user doesn't confirm
      setTimeout(() => {
        setPendingDeleteId((current) => (current === id ? null : current));
      }, 3000);
    }
  }

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

  // ---- Selected option mapping for Autocomplete (form) ----
  const selectedTournamentOpt =
    tournamentOptions.find((o) => o.id === (form.tournamentId || "")) || null;
  const selectedTeam1Opt =
    teamOptionsAll.find((o) => o.id === (form.team1Id || "")) || null;
  const selectedTeam2Opt =
    team2Options.find((o) => o.id === (form.team2Id || "")) || null;

  // ---- Selected option mapping for Autocomplete (filters) ----
  const selectedFilterTournamentOpt =
    tournamentOptions.find((o) => o.id === (filterTournamentId || "")) || null;

  // ---- Order filter options ----
  const orderOptions = [
    { id: "latest", label: "Latest entered first" },
    { id: "oldest", label: "Oldest first" },
  ];
  const selectedOrderOpt =
    orderOptions.find((o) => o.id === (groupSort || "")) || orderOptions[0];

  return (
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
                  <Autocomplete
                    options={tournamentOptions}
                    value={selectedTournamentOpt}
                    onChange={(_, v) =>
                      onChange({ target: { name: "tournamentId", value: v ? v.id : "", type: "text" } })
                    }
                    isOptionEqualToValue={(o, v) => o.id === v.id}
                    renderInput={(params) => (
                      <TextField {...params} label="Tournament" required />
                    )}
                    ListboxProps={{ style: { maxHeight: LISTBOX_MAX_HEIGHT, overflowY: "auto" } }}
                  />
                </div>

                <div className="col-6">
                  <Autocomplete
                    options={teamOptionsAll}
                    value={selectedTeam1Opt}
                    onChange={(_, v) =>
                      onChange({ target: { name: "team1Id", value: v ? v.id : "", type: "text" } })
                    }
                    isOptionEqualToValue={(o, v) => o.id === v.id}
                    renderInput={(params) => (
                      <TextField {...params} label="Team 1" required />
                    )}
                    ListboxProps={{ style: { maxHeight: LISTBOX_MAX_HEIGHT, overflowY: "auto" } }}
                  />
                </div>

                <div className="col-6">
                  <Autocomplete
                    options={team2Options}
                    value={selectedTeam2Opt}
                    onChange={(_, v) =>
                      onChange({ target: { name: "team2Id", value: v ? v.id : "", type: "text" } })
                    }
                    isOptionEqualToValue={(o, v) => o.id === v.id}
                    renderInput={(params) => (
                      <TextField {...params} label="Team 2" required />
                    )}
                    ListboxProps={{ style: { maxHeight: LISTBOX_MAX_HEIGHT, overflowY: "auto" } }}
                  />
                  {/* Team 2 list updates automatically when Team 1 changes */}
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
                    /* NOT required anymore - optional field */
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

                <div className="d-flex gap-2 flex-wrap align-items-center">
                  {/* Tournament filter (clear = All tournaments) */}
                  <Autocomplete
                    options={tournamentOptions}
                    value={selectedFilterTournamentOpt}
                    onChange={(_, v) => setFilterTournamentId(v ? v.id : "")}
                    isOptionEqualToValue={(o, v) => o.id === v.id}
                    clearOnEscape
                    renderInput={(params) => (
                      <TextField {...params} label="Tournament" placeholder="All tournaments" />
                    )}
                    ListboxProps={{ style: { maxHeight: LISTBOX_MAX_HEIGHT, overflowY: "auto" } }}
                    sx={{ minWidth: 240 }}
                  />

                  {/* Order filter */}
                  <Autocomplete
                    options={orderOptions}
                    value={selectedOrderOpt}
                    onChange={(_, v) => setGroupSort(v ? v.id : "latest")}
                    isOptionEqualToValue={(o, v) => o.id === v.id}
                    renderInput={(params) => (
                      <TextField {...params} label="Order" />
                    )}
                    ListboxProps={{ style: { maxHeight: LISTBOX_MAX_HEIGHT, overflowY: "auto" } }}
                    sx={{ minWidth: 220 }}
                  />
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
                                <td>{m.startTime ?? ""}</td>
                                <td className="text-end">
                                  <div className="d-inline-flex gap-2">
                                    <button
                                      className="btn btn-sm btn-outline-primary"
                                      onClick={() => onEdit(m)}
                                    >
                                      Edit
                                    </button>
                                    <button
                                      className={`btn btn-sm ${pendingDeleteId === (m.id ?? m._id) ? "btn-danger" : "btn-outline-danger"}`}
                                      onClick={() => onDelete(m.id ?? m._id)}
                                    >
                                      {pendingDeleteId === (m.id ?? m._id) ? "Confirm Delete" : "Delete"}
                                    </button>
                                  </div>
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
