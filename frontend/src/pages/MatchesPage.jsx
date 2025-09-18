import { useEffect, useState } from "react";
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
  matchNumber: "",            // <-- NEW as string in state
  overType: "",               // string (e.g., "4b", "T20", "50")
  noOfOvers: "",
  date: "",
  startTime: "",
};

export default function MatchesPage() {
  const [items, setItems] = useState([]);
  const [teams, setTeams] = useState([]);
  const [tournaments, setTournaments] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);

  async function load() {
    const [{ data: matches }, { data: teamsData }, { data: tourData }] =
      await Promise.all([getMatches(), getTeams(), getTournaments()]);
    console.log("Matches data:", matches);
    setItems(matches || []);
    setTeams(teamsData || []);
    setTournaments(tourData || []);
  }

  useEffect(() => { load(); }, []);

  function onChange(e) {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  }

  async function onSubmit(e) {
    e.preventDefault();

    if (form.team1Id && form.team1Id === form.team2Id) {
      alert("Team 1 and Team 2 must be different.");
      return;
    }

    const payload = {
      tournamentId: Number.parseInt(form.tournamentId, 10),
      team1Id: Number.parseInt(form.team1Id, 10),
      team2Id: Number.parseInt(form.team2Id, 10),
      matchNumber: Number.parseInt(form.matchNumber, 10), // <-- NEW send as number
      overType: form.overType.trim() || undefined,        // keep string
      noOfOvers: Number.parseInt(form.noOfOvers, 10),
      date: form.date,
      startTime: form.startTime,
    };

    console.log("Submitting match payload:", payload);

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
      matchNumber: m.matchNumber != null ? String(m.matchNumber) : "", // <-- NEW
      overType: m.overType != null ? String(m.overType) : "",
      noOfOvers: m.noOfOvers != null ? String(m.noOfOvers) : "",
      date: m.date ? m.date.slice(0, 10) : "",
      startTime: m.startTime || "",
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

  return (
    <div className="row g-4">
      <div className="col-lg-6">
        <div className="card shadow-sm">
          <div className="card-body">
            <h5 className="card-title">{editingId ? "Edit Match" : "Create Match"}</h5>
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
                  {teams.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.teamName} (#{t.id})
                    </option>
                  ))}
                </select>
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
                <label className="form-label">Over Type</label>
                <input
                  type="text"
                  name="overType"
                  className="form-control"
                  value={form.overType}
                  onChange={onChange}
                  placeholder='e.g. "4b", "T20", "ODI", "50"'
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

      <div className="col-lg-6">
        <div className="card shadow-sm">
          <div className="card-body">
            <h5 className="card-title">Matches</h5>
            <div className="table-responsive">
              <table className="table table-striped align-middle">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Match #</th> {/* NEW */}
                    <th>Tournament</th>
                    <th>Teams</th>
                    <th>Overs</th>
                    <th>Date</th>
                    <th>Start</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((m) => (
                    <tr key={m.id ?? m._id}>
                      <td>{m.id ?? m._id}</td>
                      <td>{m.matchNumber}</td> {/* NEW */}
                      <td>{tournamentName(m.tournamentId, m.tournamentName)}</td>
                      <td>
                        {teamName(m.team1Id, m.team1Name)} vs {teamName(m.team2Id, m.team2Name)}
                      </td>
                      <td>{(m.overType ?? "").toString().trim() || "-"} / {m.noOfOvers}</td>
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
                  {!items.length && (
                    <tr>
                      <td colSpan="8" className="text-center py-4">
                        No matches
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
