import { useEffect, useState, useMemo } from "react";
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

// Local (non-UTC) YYYY-MM-DD for min= and comparisons
function todayLocalStr() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
function isPastDateStr(yyyy_mm_dd) {
  if (!yyyy_mm_dd) return false;
  // Compare lexicographically because both are YYYY-MM-DD
  return yyyy_mm_dd < todayLocalStr();
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

  // validation state
  const [errors, setErrors] = useState({});

  // memoize today string
  const todayStr = useMemo(() => todayLocalStr(), []);


  const [pendingDeleteId, setPendingDeleteId] = useState(null);


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

  // ✅ Only Name and Date are required now
  function validate(nextForm) {
    const e = {};
    if (!nextForm.name.trim()) e.name = "Name is required.";

    if (!nextForm.date) {
      e.date = "Date is required.";
    } else if (isPastDateStr(nextForm.date)) {
      e.date = "Please select today or a future date.";
    }

    // Ground (place) and Logo are optional now → no errors
    return e;
  }

  function onChange(e) {
    const { name, value } = e.target;
    const next = { ...form, [name]: value };
    setForm(next);
    if (name === "logo") setPreviewOk(true);
    // live-validate changed field
    const fresh = validate(next);
    setErrors((prev) => ({ ...prev, [name]: fresh[name] }));
  }

  async function onSubmit(e) {
    e.preventDefault();
    const freshErrors = validate(form);
    setErrors(freshErrors);
    if (Object.keys(freshErrors).length > 0) return;

    const payload = {
      name: form.name.trim(),
      date: form.date, // already validated to be >= today
      // optional fields: allow blank
      place: form.place?.trim() || "",
      logo: form.logo?.trim() || "",
      ...(form.logoKey && { logoKey: form.logoKey }),
    };

    if (editingId) await updateTournament(editingId, payload);
    else await createTournament(payload);

    setForm(emptyForm);
    setEditingId(null);
    setErrors({});
    load();
  }

  function onEdit(t) {
    setEditingId(t.id);
    const dateStr = t.date ? t.date.slice(0, 10) : "";
    setForm({
      name: t.name || "",
      date: dateStr,
      place: t.place || "",
      logo: t.logo || "",
      logoKey: t.logoKey || "",
    });
    setPreviewOk(true);
    // If existing stored date is in the past, surface the error so admin must pick a new one
    setErrors((prev) => ({
      ...prev,
      date: dateStr && isPastDateStr(dateStr) ? "Please select today or a future date." : undefined,
    }));
  }

async function onDelete(id) {
  if (pendingDeleteId === id) {
    // User clicked "Confirm Delete"
    await deleteTournament(id);
    setPendingDeleteId(null);
    load();
  } else {
    // First click: mark for confirmation
    setPendingDeleteId(id);

    // Optional: auto-reset after 5 seconds if user doesn't confirm
    setTimeout(() => {
      setPendingDeleteId((current) => (current === id ? null : current));
    }, 3000);
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

  const invalid = (k) => Boolean(errors[k]);

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

            <form onSubmit={onSubmit} className="row g-3" noValidate>
              <div className="col-12">
                <label className="form-label">Name</label>
                <input
                  name="name"
                  className={`form-control ${invalid("name") ? "is-invalid" : ""}`}
                  value={form.name}
                  onChange={onChange}
                  required
                />
                {invalid("name") && (
                  <div className="invalid-feedback">{errors.name}</div>
                )}
              </div>

              <div className="col-6">
                <label className="form-label">Date</label>
                {/* 🚫 disables past days in the picker */}
                <input
                  type="date"
                  name="date"
                  className={`form-control ${invalid("date") ? "is-invalid" : ""}`}
                  value={form.date}
                  onChange={onChange}
                  min={todayStr}
                  required
                />
                {invalid("date") && (
                  <div className="invalid-feedback">{errors.date}</div>
                )}
              </div>

              <div className="col-6">
                <label className="form-label">Ground</label>
                <input
                  name="place"
                  className="form-control" // optional now
                  value={form.place}
                  onChange={onChange}
                />
                {/* no validation/error for Ground */}
              </div>

              {/* Upload to Firebase RTDB as Data URL */}
              <div className="col-12">
                <label className="form-label">Upload Logo (Firebase RTDB)</label>
                <input
                  type="file"
                  accept="image/*"
                  className="form-control" // optional now
                  onChange={handleLogoFile}
                  disabled={uploading}
                />
                {/* no validation/error for Logo */}
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
                    className="form-control" // optional now
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
                      setErrors({});
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
                              className={`btn btn-sm ${pendingDeleteId === (t.id ?? t._id) ? "btn-danger" : "btn-outline-danger"}`}
                              onClick={() => onDelete(t.id ?? t._id)}
                            >
                              {pendingDeleteId === (t.id ?? t._id) ? "Confirm Delete" : "Delete"}
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
