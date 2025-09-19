import { useEffect, useState } from "react";
import { getPlayers, createPlayer, updatePlayer, deletePlayer, getTeams } from "../lib/api.js";

const emptyForm = {
  teamId: "",
  playerName: "",
  playerAddress: "",
  phone: "",
  position: "",
  isBatter: false,
  isBaller: false,
  isWk: false,
  isCaptain: false,
};

export default function PlayersPage() {
  const [items, setItems] = useState([]);
  const [teams, setTeams] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);

  async function load() {
    const [playersRes, teamsRes] = await Promise.all([getPlayers(), getTeams()]);
    setItems(playersRes.data);
    setTeams(teamsRes.data);
  }
  useEffect(() => { load(); }, []);

  function onChange(e) {
    const { name, value, type, checked } = e.target;
    setForm(prev => ({ ...prev, [name]: type === "checkbox" ? checked : value }));
  }

  async function onSubmit(e) {
    e.preventDefault();
    const payload = { ...form, teamId: Number(form.teamId) };
    if (editingId) await updatePlayer(editingId, payload);
    else await createPlayer(payload);
    setEditingId(null);
    setForm(emptyForm);
    load();
  }

  function onEdit(p) {
    setEditingId(p.id);
    setForm({
      teamId: p.teamId || "",
      playerName: p.playerName || "",
      playerAddress: p.playerAddress || "",
      phone: p.phone || "",
      position: p.position || "",
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

  return (
    <div className="row g-4">
      <div className="col-lg-6">
        <div className="card shadow-sm">
          <div className="card-body">
            <h5 className="card-title">{editingId ? "Edit Player" : "Add Player"}</h5>
            <form onSubmit={onSubmit} className="row g-3">
              <div className="col-12">
                <label className="form-label">Team</label>
                <select name="teamId" className="form-select" value={form.teamId} onChange={onChange} required>
                  <option value="">-- Select Team --</option>
                  {teams.map(t => <option key={t.id} value={t.id}>{t.teamName} (#{t.id})</option>)}
                </select>
              </div>
              <div className="col-6">
                <label className="form-label">Player Name</label>
                <input name="playerName" className="form-control" value={form.playerName} onChange={onChange} required />
              </div>
              <div className="col-6">
                <label className="form-label">Position</label>
                <input name="position" className="form-control" value={form.position} onChange={onChange} />
              </div>
              <div className="col-6">
                <label className="form-label">Phone</label>
                <input name="phone" className="form-control" value={form.phone} onChange={onChange} />
              </div>
              <div className="col-6">
                <label className="form-label">Address</label>
                <input name="playerAddress" className="form-control" value={form.playerAddress} onChange={onChange} />
              </div>

              <div className="col-12">
                <div className="form-check form-check-inline">
                  <input id="isBatter" className="form-check-input" type="checkbox" name="isBatter" checked={form.isBatter} onChange={onChange} />
                  <label className="form-check-label" htmlFor="isBatter">Batter</label>
                </div>
                <div className="form-check form-check-inline">
                  <input id="isBaller" className="form-check-input" type="checkbox" name="isBaller" checked={form.isBaller} onChange={onChange} />
                  <label className="form-check-label" htmlFor="isBaller">Bowler</label>
                </div>
                <div className="form-check form-check-inline">
                  <input id="isWk" className="form-check-input" type="checkbox" name="isWk" checked={form.isWk} onChange={onChange} />
                  <label className="form-check-label" htmlFor="isWk">Wicket Keeper</label>
                </div>
                <div className="form-check form-check-inline">
                  <input id="isCaptain" className="form-check-input" type="checkbox" name="isCaptain" checked={form.isCaptain} onChange={onChange} />
                  <label className="form-check-label" htmlFor="isCaptain">Captain</label>
                </div>
              </div>

              <div className="col-12 d-flex gap-2">
                <button className="btn btn-primary">{editingId ? "Update" : "Create"}</button>
                {editingId && <button type="button" className="btn btn-secondary" onClick={() => { setEditingId(null); setForm(emptyForm); }}>Cancel</button>}
              </div>
            </form>
          </div>
        </div>
      </div>

      <div className="col-lg-6">
        <div className="card shadow-sm">
          <div className="card-body">
            <h5 className="card-title">Players</h5>
            <div className="table-responsive">
              <table className="table table-striped align-middle">
                <thead>
                  <tr><th>ID</th><th>Name</th><th>TeamId</th><th>Phone</th><th>Roles</th><th></th></tr>
                </thead>
                <tbody>
                  {items.map(p => (
                    <tr key={p.id}>
                      <td>{p.id}</td>
                      <td>{p.playerName}</td>
                      <td>#{p.teamId}</td>
                      <td>{p.phone}</td>
                      <td>
                        {p.isCaptain && <span className="badge text-bg-warning me-1">C</span>}
                        {p.isWk && <span className="badge text-bg-info me-1">WK</span>}
                        {p.isBatter && <span className="badge text-bg-primary me-1">Bat</span>}
                        {p.isBaller && <span className="badge text-bg-success me-1">Bowl</span>}
                      </td>
                      <td className="text-end">
                        <button className="btn btn-sm btn-outline-primary me-2" onClick={() => onEdit(p)}>Edit</button>
                        <button className="btn btn-sm btn-outline-danger" onClick={() => onDelete(p.id)}>Delete</button>
                      </td>
                    </tr>
                  ))}
                  {!items.length && <tr><td colSpan="6" className="text-center py-4">No players</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
