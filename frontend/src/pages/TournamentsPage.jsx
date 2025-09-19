import { useEffect, useState } from "react";
import { getTournaments, createTournament, updateTournament, deleteTournament } from "../lib/api.js";

const emptyForm = { name: "", date: "", startTime: "", place: "" };

export default function TournamentsPage() {
  const [items, setItems] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [loading, setLoading] = useState(false);

  async function load() {
    setLoading(true);
    const { data } = await getTournaments();
    setItems(data);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  function onChange(e) {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));
  }

  async function onSubmit(e) {
    e.preventDefault();
    if (editingId) {
      await updateTournament(editingId, form);
    } else {
      await createTournament(form);
    }
    setForm(emptyForm);
    setEditingId(null);
    load();
  }

  function onEdit(t) {
    setEditingId(t.id);
    setForm({
      name: t.name,
      date: t.date?.slice(0, 10) || "",
      startTime: t.startTime || "",
      place: t.place || "",
    });
  }

  async function onDelete(id) {
    if (confirm("Delete tournament?")) {
      await deleteTournament(id);
      load();
    }
  }

  return (
    <div className="row g-4">
      <div className="col-lg-5">
        <div className="card shadow-sm">
          <div className="card-body">
            <h5 className="card-title">{editingId ? "Edit Tournament" : "Add Tournament"}</h5>
            <form onSubmit={onSubmit} className="row g-3">
              <div className="col-12">
                <label className="form-label">Name</label>
                <input name="name" className="form-control" value={form.name} onChange={onChange} required />
              </div>
              <div className="col-6">
                <label className="form-label">Date</label>
                <input type="date" name="date" className="form-control" value={form.date} onChange={onChange} required />
              </div>
              <div className="col-6">
                <label className="form-label">Start Time</label>
                <input type="time" name="startTime" className="form-control" value={form.startTime} onChange={onChange} required />
              </div>
              <div className="col-12">
                <label className="form-label">Place</label>
                <input name="place" className="form-control" value={form.place} onChange={onChange} required />
              </div>
              <div className="col-12 d-flex gap-2">
                <button className="btn btn-primary" disabled={loading}>{editingId ? "Update" : "Create"}</button>
                {editingId && (
                  <button type="button" className="btn btn-secondary" onClick={() => { setEditingId(null); setForm(emptyForm); }}>
                    Cancel
                  </button>
                )}
              </div>
            </form>
          </div>
        </div>
      </div>

      <div className="col-lg-7">
        <div className="card shadow-sm">
          <div className="card-body">
            <h5 className="card-title">Tournaments</h5>
            {loading ? <div>Loading…</div> : (
              <div className="table-responsive">
                <table className="table table-striped align-middle">
                  <thead>
                    <tr>
                      <th>ID</th><th>Name</th><th>Date</th><th>Start</th><th>Place</th><th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map(t => (
                      <tr key={t.id}>
                        <td>{t.id}</td>
                        <td>{t.name}</td>
                        <td>{t.date?.slice(0,10)}</td>
                        <td>{t.startTime}</td>
                        <td>{t.place}</td>
                        <td className="text-end">
                          <button className="btn btn-sm btn-outline-primary me-2" onClick={() => onEdit(t)}>Edit</button>
                          <button className="btn btn-sm btn-outline-danger" onClick={() => onDelete(t.id)}>Delete</button>
                        </td>
                      </tr>
                    ))}
                    {!items.length && <tr><td colSpan="6" className="text-center py-4">No tournaments</td></tr>}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
