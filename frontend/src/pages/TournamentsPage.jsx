import { useEffect, useState } from "react";
import {
  getTournaments,
  createTournament,
  updateTournament,
  deleteTournament,
} from "../lib/api.js";
import { rtdbPush, rtdbGet } from "../lib/rtdb.js"; // generic helpers

// Backend model: { id, name, date, logo, place }
const emptyForm = { name: "", date: "", place: "", logo: "", logoKey: "" };

// fixed height (px) for the right card
const LIST_PANEL_HEIGHT = 640;

function initials(name = "") {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase())
    .join("");
}

/** file -> small JPEG dataURL */
async function fileToOptimizedDataURL(file, maxDim = 256, quality = 0.85) {
  const bmp = await createImageBitmap(file);
  const scale = Math.min(1, maxDim / Math.max(bmp.width, bmp.height));
  const outW = Math.max(1, Math.round(bmp.width * scale));
  const outH = Math.max(1, Math.round(bmp.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = outW; canvas.height = outH;
  const ctx = canvas.getContext("2d");
  ctx.drawImage(bmp, 0, 0, outW, outH);
  const dataUrl = canvas.toDataURL("image/jpeg", quality);
  return { dataUrl, width: outW, height: outH };
}

function estimateDataUrlBytes(dataUrl) {
  const base64 = (dataUrl.split(",")[1] || "").trim();
  const len = base64.length;
  const padding = (base64.endsWith("==") ? 2 : base64.endsWith("=") ? 1 : 0);
  return Math.floor((len * 3) / 4) - padding;
}

export default function TournamentsPage() {
  const [items, setItems] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [loading, setLoading] = useState(false);

  // upload state
  const [uploading, setUploading] = useState(false);
  const [uploadPct, setUploadPct] = useState(0);
  const [previewOk, setPreviewOk] = useState(true);

  async function load() {
    setLoading(true);
    try {
      const { data } = await getTournaments();
      setItems(Array.isArray(data) ? data : []);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { load(); }, []);

  function onChange(e) {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
    if (e.target.name === "logo") setPreviewOk(true);
  }

  async function onSubmit(e) {
    e.preventDefault();
    if (!form.name.trim() || !form.date || !form.place.trim()) return;
    if (!form.logo.trim()) {
      alert("Tournament logo is required.");
      return;
    }

    const payload = {
      name: form.name.trim(),
      date: form.date,
      place: form.place.trim(),
      logo: form.logo.trim(),
      ...(form.logoKey && { logoKey: form.logoKey }),
    };

    if (editingId) await updateTournament(editingId, payload);
    else await createTournament(payload);

    setForm(emptyForm);
    setEditingId(null);
    load();
  }

  function onEdit(t) {
    setEditingId(t.id);
    setForm({
      name: t.name || "",
      date: t.date ? t.date.slice(0, 10) : "",
      place: t.place || "",
      logo: t.logo || "",
      logoKey: t.logoKey || "",
    });
    setPreviewOk(true);
  }

  async function onDelete(id) {
    if (confirm("Delete tournament?")) {
      await deleteTournament(id);
      load();
    }
  }

  async function handleLogoFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      if (!file.type.startsWith("image/")) {
        alert("Only image files are allowed");
        e.target.value = "";
        return;
      }
      setUploading(true);
      setUploadPct(10);

      const { dataUrl, width, height } = await fileToOptimizedDataURL(file, 256, 0.85);
      const estBytes = estimateDataUrlBytes(dataUrl);
      if (estBytes > 300 * 1024) {
        if (!confirm("Optimized image > 300KB. Continue?")) {
          setUploading(false);
          e.target.value = "";
          setUploadPct(0);
          return;
        }
      }

      setUploadPct(60);

      const logoObj = {
        name: file.name,
        mimeType: "image/jpeg",
        size: estBytes,
        width, height,
        dataUrl,
        createdAt: Date.now(),
      };
      const key = await rtdbPush("/tournamentLogos", logoObj);

      setForm((prev) => ({ ...prev, logo: dataUrl, logoKey: key }));
      setPreviewOk(true);

      setUploadPct(100);
      setTimeout(() => setUploadPct(0), 1000);
      console.log("[TournamentsPage] logo stored at /tournamentLogos/" + key);
    } catch (err) {
      console.error(err);
      alert(err.message || "Upload failed");
      setUploadPct(0);
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  }

  async function retrieveLogoByKey() {
    if (!form.logoKey) {
      alert("No saved logoKey on this form.");
      return;
    }
    const obj = await rtdbGet(`/tournamentLogos/${form.logoKey}`);
    if (!obj?.dataUrl) {
      alert("Logo not found in RTDB for key: " + form.logoKey);
      return;
    }
    setForm((prev) => ({ ...prev, logo: obj.dataUrl }));
    setPreviewOk(true);
  }

  return (
    <div className="row g-4">
      {/* LEFT: form */}
      <div className="col-lg-5">
        <div className="card shadow-sm">
          <div className="card-body">
            <h5 className="card-title">
              {editingId ? "Edit Tournament" : "Add Tournament"}
            </h5>

            {/* Logo preview */}
            <div className="d-flex align-items-center gap-3 mb-3">
              <div
                className="rounded-circle d-flex align-items-center justify-content-center"
                style={{
                  width: 64, height: 64, background: "#f1f3f5",
                  border: "1px solid #e9ecef", overflow: "hidden",
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
                    {initials(form.name) || "?"}
                  </span>
                )}
              </div>
              <div className="small text-muted">
                Upload a small PNG/JPG (auto-shrinks to 256px) or paste a URL below.
              </div>
            </div>

            <form onSubmit={onSubmit} className="row g-3">
              <div className="col-12">
                <label className="form-label">Name</label>
                <input
                  name="name"
                  className="form-control"
                  value={form.name}
                  onChange={onChange}
                  required
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
                <label className="form-label">Ground</label>
                <input
                  name="place"
                  className="form-control"
                  value={form.place}
                  onChange={onChange}
                  required
                />
              </div>

              {/* Upload to Firebase RTDB as Data URL */}
              <div className="col-12">
                <label className="form-label">Upload Logo (Firebase RTDB)</label>
                <input
                  type="file"
                  accept="image/*"
                  className="form-control"
                  onChange={handleLogoFile}
                  disabled={uploading}
                />
                {uploadPct > 0 && uploadPct < 100 && (
                  <div className="progress mt-2">
                    <div
                      className="progress-bar"
                      role="progressbar"
                      style={{ width: `${uploadPct}%` }}
                    >
                      {uploadPct}%
                    </div>
                  </div>
                )}
                {form.logoKey && (
                  <div className="form-text">
                    Stored at <code>/tournamentLogos/{form.logoKey}</code>{" "}
                    <button
                      type="button"
                      className="btn btn-link btn-sm"
                      onClick={retrieveLogoByKey}
                    >
                      Retrieve again
                    </button>
                  </div>
                )}
              </div>

              {/* OR: direct URL */}
              <div className="col-12">
                <label className="form-label">Logo URL (optional)</label>
                <div className="input-group">
                  <span className="input-group-text">URL</span>
                  <input
                    name="logo"
                    className="form-control"
                    value={form.logo}
                    onChange={onChange}
                    placeholder="Paste an image URL or leave blank"
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

              <div className="col-12 d-flex gap-2">
                <button className="btn btn-primary" disabled={loading || uploading}>
                  {editingId ? "Update" : "Create"}
                </button>
                {editingId && (
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => {
                      setEditingId(null);
                      setForm(emptyForm);
                      setPreviewOk(true);
                    }}
                    disabled={loading || uploading}
                  >
                    Cancel
                  </button>
                )}
              </div>
            </form>
          </div>
        </div>
      </div>

      {/* RIGHT: list with fixed-height scroll */}
      <div className="col-lg-7">
        <div className="card shadow-sm" style={{ height: LIST_PANEL_HEIGHT }}>
          {/* make the body a flex column so inner area can scroll */}
          <div className="card-body d-flex flex-column" style={{ minHeight: 0 }}>
            <h5 className="card-title mb-3">Tournaments</h5>

            {/* scrollable table area */}
            <div style={{ overflow: "auto", minHeight: 0, flex: "1 1 auto" }}>
              {loading ? (
                <div className="py-5 text-center text-muted">Loading…</div>
              ) : (
                <div className="table-responsive">
                  <table className="table table-striped align-middle mb-0">
                    <thead
                      style={{
                        position: "sticky",
                        top: 0,
                        background: "white",
                        zIndex: 1,
                      }}
                    >
                      <tr>
                        <th>ID</th>
                        <th>Name</th>
                        <th>Date</th>
                        <th>Ground</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {items.map((t) => (
                        <tr key={t.id}>
                          <td>{t.id}</td>
                          <td>
                            <div className="d-flex align-items-center gap-2">
                              <div
                                className="rounded-circle d-flex align-items-center justify-content-center"
                                style={{
                                  width: 28,
                                  height: 28,
                                  background: "#f1f3f5",
                                  border: "1px solid #e9ecef",
                                  overflow: "hidden",
                                }}
                              >
                                {t.logo ? (
                                  <img
                                    src={t.logo}
                                    alt=""
                                    width="28"
                                    height="28"
                                    style={{ objectFit: "cover" }}
                                    onError={(e) => {
                                      e.currentTarget.onerror = null;
                                      e.currentTarget.style.display = "none";
                                    }}
                                  />
                                ) : (
                                  <small className="text-muted">
                                    {initials(t.name) || "?"}
                                  </small>
                                )}
                              </div>
                              <span className="fw-semibold">{t.name}</span>
                            </div>
                          </td>
                          <td>{t.date?.slice(0, 10)}</td>
                          <td className="text-truncate" style={{ maxWidth: 220 }}>
                            {t.place}
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
                              onClick={() => onDelete(t.id)}
                            >
                              Delete
                            </button>
                          </td>
                        </tr>
                      ))}
                      {!items.length && (
                        <tr>
                          <td colSpan="5" className="text-center py-4">
                            No tournaments
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
          {/* optional footer could go here */}
        </div>
      </div>
    </div>
  );
}
