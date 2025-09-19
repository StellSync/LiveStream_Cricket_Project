import { useEffect, useMemo, useState } from "react";
import { getTeams, createTeam, updateTeam, deleteTeam } from "../lib/api.js";

const emptyForm = { teamName: "", logo: "", contactNo: "", address: "" };

function initials(name = "") {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase())
    .join("");
}

export default function TeamsPage() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [query, setQuery] = useState("");
  const [sortAsc, setSortAsc] = useState(true);
  const [previewOk, setPreviewOk] = useState(true);

  async function load() {
    setLoading(true);
    try {
      const { data } = await getTeams();
      setItems(Array.isArray(data) ? data : []);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { load(); }, []);

  function onChange(e) {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    if (name === "logo") setPreviewOk(true);
  }

  async function onSubmit(e) {
    e.preventDefault();
    if (!form.teamName.trim()) return;

    const payload = {
      teamName: form.teamName.trim(),
      logo: form.logo.trim(),
      contactNo: form.contactNo.trim(),
      address: form.address.trim(),
    };

    if (editingId) await updateTeam(editingId, payload);
    else await createTeam(payload);

    setForm(emptyForm);
    setEditingId(null);
    load();
  }

  function onEdit(t) {
    setEditingId(t.id);
    setForm({
      teamName: t.teamName || "",
      logo: t.logo || "",
      contactNo: t.contactNo || "",
      address: t.address || "",
    });
    setPreviewOk(true);
  }

  async function onDeleteClick(id) {
    if (confirm("Delete team?")) {
      await deleteTeam(id);
      load();
    }
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const base = q
      ? items.filter(
          (t) =>
            t.teamName?.toLowerCase().includes(q) ||
            t.contactNo?.toLowerCase().includes(q) ||
            t.address?.toLowerCase().includes(q)
        )
      : items.slice();
    base.sort((a, b) =>
      (a.teamName || "").localeCompare(b.teamName || "", undefined, {
        sensitivity: "base",
      })
    );
    return sortAsc ? base : base.reverse();
  }, [items, query, sortAsc]);

  return (
    <div className="row g-4">
      {/* LEFT: Create/Edit */}
      <div className="col-lg-5">
        <div className="card shadow-sm border-0">
          <div className="card-body">
            <div className="d-flex align-items-center justify-content-between mb-3">
              <h5 className="card-title mb-0">
                {editingId ? "Edit Team" : "Add Team"}
              </h5>
              {editingId && (
                <span className="badge text-bg-secondary">ID #{editingId}</span>
              )}
            </div>

            {/* Logo preview */}
            <div className="d-flex align-items-center gap-3 mb-3">
              <div
                className="rounded-circle d-flex align-items-center justify-content-center"
                style={{
                  width: 64,
                  height: 64,
                  background: "#f1f3f5",
                  border: "1px solid #e9ecef",
                  overflow: "hidden",
                }}
              >
                {form.logo && previewOk ? (
                  <img
                    src={form.logo}
                    alt="logo preview"
                    width="64"
                    height="64"
                    style={{ objectFit: "cover" }}
                    onError={() => setPreviewOk(false)}
                  />
                ) : (
                  <span className="fw-semibold text-muted">
                    {initials(form.teamName) || "?"}
                  </span>
                )}
              </div>
              <div className="small text-muted">
                Optional logo URL. If empty or broken, initials are shown.
              </div>
            </div>

            <form onSubmit={onSubmit} className="row g-3">
              <div className="col-12">
                <label className="form-label">Team Name</label>
                <input
                  name="teamName"
                  className="form-control"
                  value={form.teamName}
                  onChange={onChange}
                  placeholder="e.g. Jaffna Lions"
                  required
                />
              </div>

              <div className="col-12">
                <label className="form-label">Logo URL</label>
                <div className="input-group">
                  <span className="input-group-text">https://</span>
                  <input
                    name="logo"
                    className="form-control"
                    value={form.logo}
                    onChange={onChange}
                    placeholder="cdn.domain.com/logo.png"
                  />
                  {form.logo && (
                    <button
                      type="button"
                      className="btn btn-outline-secondary"
                      onClick={() => setForm((p) => ({ ...p, logo: "" }))}
                      title="Clear logo"
                    >
                      Clear
                    </button>
                  )}
                </div>
              </div>

              <div className="col-md-6">
                <label className="form-label">Phone</label>
                <input
                  name="contactNo"
                  className="form-control"
                  value={form.contactNo}
                  onChange={onChange}
                  placeholder="+94 7X XXX XXXX"
                />
              </div>

              <div className="col-md-6">
                <label className="form-label">Address</label>
                <input
                  name="address"
                  className="form-control"
                  value={form.address}
                  onChange={onChange}
                  placeholder="City / Ground"
                />
              </div>

              <div className="col-12 d-flex gap-2">
                <button className="btn btn-primary">
                  {editingId ? "Update Team" : "Create Team"}
                </button>
                {editingId && (
                  <button
                    type="button"
                    className="btn btn-outline-secondary"
                    onClick={() => {
                      setEditingId(null);
                      setForm(emptyForm);
                      setPreviewOk(true);
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

      {/* RIGHT: List + toolbar */}
      <div className="col-lg-7">
        <div className="card shadow-sm border-0">
          <div className="card-body">
            <div className="d-flex flex-column flex-md-row gap-2 align-items-md-center justify-content-between mb-3">
              <h5 className="card-title mb-0">Teams</h5>
              <div className="d-flex gap-2 w-100 w-md-auto">
                <div className="input-group">
                  <span className="input-group-text">Search</span>
                  <input
                    className="form-control"
                    placeholder="by name / phone / address"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                  />
                </div>
                <button
                  className="btn btn-outline-secondary"
                  onClick={() => setSortAsc((s) => !s)}
                  title="Toggle sort"
                >
                  {sortAsc ? "A→Z" : "Z→A"}
                </button>
                <button
                  className="btn btn-outline-primary"
                  onClick={load}
                  title="Refresh"
                >
                  Refresh
                </button>
              </div>
            </div>

            {loading ? (
              <div className="py-5 text-center text-muted">Loading…</div>
            ) : (
              <div className="table-responsive">
                <table className="table align-middle table-hover">
                  <thead className="table-light">
                    <tr>
                      <th style={{ width: 80 }}>ID</th>
                      <th>Name</th>
                      <th style={{ width: 140 }}>Phone</th>
                      <th>Address</th>
                      <th style={{ width: 160 }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((t) => (
                      <tr key={t.id}>
                        <td>
                          <div className="d-flex align-items-center gap-2">
                            <span className="badge text-bg-light">#{t.id}</span>
                            <button
                              type="button"
                              className="btn btn-sm btn-outline-secondary"
                              onClick={() =>
                                navigator.clipboard?.writeText(String(t.id))
                              }
                              title="Copy ID"
                            >
                              Copy
                            </button>
                          </div>
                        </td>
                        <td>
                          <div className="d-flex align-items-center gap-2">
                            <div
                              className="rounded-circle d-flex align-items-center justify-content-center"
                              style={{
                                width: 32,
                                height: 32,
                                background: "#f1f3f5",
                                border: "1px solid #e9ecef",
                                overflow: "hidden",
                              }}
                            >
                              {t.logo ? (
                                <img
                                  src={t.logo}
                                  alt=""
                                  width="32"
                                  height="32"
                                  style={{ objectFit: "cover" }}
                                  onError={(e) => {
                                    e.currentTarget.onerror = null;
                                    e.currentTarget.style.display = "none";
                                  }}
                                />
                              ) : (
                                <small className="text-muted">
                                  {initials(t.teamName) || "?"}
                                </small>
                              )}
                            </div>
                            <div className="fw-semibold">{t.teamName}</div>
                          </div>
                        </td>
                        <td className="text-nowrap">{t.contactNo || "-"}</td>
                        <td className="text-truncate" style={{ maxWidth: 220 }}>
                          {t.address || "-"}
                        </td>
                        <td className="text-end">
                          <button
                            className="btn btn-sm btn-outline-primary me-2"
                            onClick={() => onEdit(t)}
                          >
                            Edit
                          </button>
                          <button
                            className="btn btn-sm btn-outline-danger"
                            onClick={() => onDeleteClick(t.id)}
                          >
                            Delete
                          </button>
                        </td>
                      </tr>
                    ))}
                    {!filtered.length && (
                      <tr>
                        <td colSpan="5" className="py-5">
                          <div className="text-center text-muted">
                            <div className="mb-2">No teams found</div>
                            <small>Try clearing the search or add a new team.</small>
                          </div>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
          {!loading && (
            <div className="card-footer bg-white d-flex justify-content-between small text-muted">
              <span>Total: {items.length}</span>
              <span>Showing: {filtered.length}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
