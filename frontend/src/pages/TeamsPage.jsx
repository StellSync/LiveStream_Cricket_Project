import { useEffect, useMemo, useState } from "react";
import { getTeams, createTeam, updateTeam, deleteTeam } from "../lib/api.js";
import { saveLogoToRTDB, readLogoFromRTDB } from "../lib/rtdb";

const emptyForm = { teamName: "", logo: "", contactNo: "", address: "", logoKey: "" };

// fixed height (px) for the right-hand list card
const LIST_PANEL_HEIGHT = 640;

function initials(name = "") {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase())
    .join("");
}

// helpers for phone validation/standardization
const digitsOnly = (s) => (s || "").replace(/\D/g, "");
const isTenDigits = (s) => digitsOnly(s).length === 10;

export default function TeamsPage() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [query, setQuery] = useState("");
  const [sortAsc, setSortAsc] = useState(true);
  const [previewOk, setPreviewOk] = useState(true);

  // upload UI state (processing + "upload" progress)
  const [uploadPct, setUploadPct] = useState(0);
  const [uploading, setUploading] = useState(false);

  // validation state
  const [errors, setErrors] = useState({});

  async function load() {
    setLoading(true);
    try {
      const { data } = await getTeams();
      setItems(Array.isArray(data) ? data : []);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    load();
  }, []);

  function validate(next) {
    const e = {};
    // Team name required
    if (!next.teamName.trim()) {
      e.teamName = "Team name is required.";
    } else if (next.teamName.trim().length < 2) {
      e.teamName = "Team name must be at least 2 characters.";
    }

    // Phone required, must be exactly 10 digits (allow formatting while typing)
   

    // Address optional (add a simple check if you want)
    // if (next.address && next.address.trim().length < 3) e.address = "Address is too short.";

    // Logo optional (you can enforce required by uncommenting)
    // if (!next.logo.trim()) e.logo = "Logo is required.";

    return e;
  }

  function onChange(e) {
    const { name, value } = e.target;
    const next = { ...form, [name]: value };
    setForm(next);
    if (name === "logo") setPreviewOk(true);

    // live-validate the changed field
    const fresh = validate(next);
    setErrors((prev) => ({ ...prev, [name]: fresh[name] }));
  }

  async function onSubmit(e) {
    e.preventDefault();

    const freshErrors = validate(form);
    setErrors(freshErrors);
    if (Object.keys(freshErrors).length > 0) return;

    const standardizedPhone = digitsOnly(form.contactNo); // store clean 10 digits

    const payload = {
      teamName: form.teamName.trim(),
      logo: form.logo.trim(),
      contactNo: standardizedPhone,
      address: form.address.trim(),
      ...(form.logoKey && { logoKey: form.logoKey }),
    };

    if (editingId) await updateTeam(editingId, payload);
    else await createTeam(payload);

    setForm(emptyForm);
    setEditingId(null);
    setErrors({});
    load();
  }

  function onEdit(t) {
    setEditingId(t.id);
    setForm({
      teamName: t.teamName || "",
      logo: t.logo || "",
      contactNo: t.contactNo || "",
      address: t.address || "",
      logoKey: t.logoKey || "",
    });
    setPreviewOk(true);
    // surface any validation issues when loading existing data
    setErrors(validate({
      teamName: t.teamName || "",
      logo: t.logo || "",
      contactNo: t.contactNo || "",
      address: t.address || "",
      logoKey: t.logoKey || "",
    }));
  }

  async function onDeleteClick(id) {
    if (confirm("Delete team?")) {
      await deleteTeam(id);
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
      setUploadPct(5);

      const { dataUrl, outBytes } = await compressImageToDataURL(file, {
        maxWidth: 256,
        maxHeight: 256,
        qualityStart: 0.8,
        minQuality: 0.5,
        maxBytes: 120 * 1024,
        step: 0.07,
      });

      setUploadPct(45);

      const logoObj = {
        name: file.name,
        mimeType: "image/jpeg",
        size: outBytes,
        dataUrl,
        createdAt: Date.now(),
      };
      const key = await saveLogoToRTDB(logoObj);

      setUploadPct(85);

      setForm((prev) => ({ ...prev, logo: dataUrl, logoKey: key }));
      setPreviewOk(true);

      setUploadPct(100);
      setTimeout(() => setUploadPct(0), 1000);
      console.log("[TeamsPage] logo stored at /logos/" + key);
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
    const obj = await readLogoFromRTDB(form.logoKey);
    if (!obj?.dataUrl) {
      alert("Logo not found in RTDB for key: " + form.logoKey);
      return;
    }
    setForm((prev) => ({ ...prev, logo: obj.dataUrl }));
    setPreviewOk(true);
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const base = q
      ? items.filter(
          (t) =>
            t.teamName?.toLowerCase().includes(q) ||
            String(t.contactNo || "").toLowerCase().includes(q) ||
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

  const invalid = (k) => Boolean(errors[k]);

  return (
    <div className="row g-5">
      {/* LEFT: Create/Edit */}
      <div className="col-lg-4">
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
                    onLoad={(e) =>
                      console.log(
                        "[TeamsPage] preview loaded:",
                        e.currentTarget.src.slice(0, 40) + "..."
                      )
                    }
                  />
                ) : (
                  <span className="fw-semibold text-muted">
                    {initials(form.teamName) || "?"}
                  </span>
                )}
              </div>
              <div className="small text-muted">
                Upload a small logo (PNG/JPG). We compress it on your device before saving.
              </div>
            </div>

            <form onSubmit={onSubmit} className="row g-3" noValidate>
              <div className="col-12">
                <label className="form-label">Team Name</label>
                <input
                  name="teamName"
                  className={`form-control ${invalid("teamName") ? "is-invalid" : ""}`}
                  value={form.teamName}
                  onChange={onChange}
                  placeholder="e.g. Jaffna Lions"
                  required
                />
                {invalid("teamName") && (
                  <div className="invalid-feedback">{errors.teamName}</div>
                )}
              </div>

              {/* Upload to RTDB as compressed Data URL */}
              <div className="col-12">
                <label className="form-label">Upload Logo</label>
                <input
                  type="file"
                  accept="image/*"
                  className={`form-control ${invalid("logo") ? "is-invalid" : ""}`}
                  onChange={handleLogoFile}
                  disabled={uploading}
                />
                {invalid("logo") && (
                  <div className="invalid-feedback">{errors.logo}</div>
                )}
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
                    Saved at <code>/logos/{form.logoKey}</code>{" "}
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
                    className={`form-control ${invalid("logo") ? "is-invalid" : ""}`}
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

              <div className="col-md-6">
                <label className="form-label">Phone</label>
                <input
                  type="tel"
                  name="contactNo"
                  inputMode="numeric"
                  // pattern enforces 10 digits if user presses Enter on the field, but we also do JS validation
                  pattern="\d{10}"
                  className={`form-control ${invalid("contactNo") ? "is-invalid" : ""}`}
                  value={form.contactNo}
                  onChange={(e) => {
                    // allow formatting while typing; if you want to force digits only, replace with digitsOnly(e.target.value)
                    onChange(e);
                  }}
                  placeholder="e.g. 0771234567"
                  
                />
                {invalid("contactNo") && (
                  <div className="invalid-feedback">{errors.contactNo}</div>
                )}
              </div>

              <div className="col-md-6">
                <label className="form-label">Address</label>
                <input
                  name="address"
                  className={`form-control ${invalid("address") ? "is-invalid" : ""}`}
                  value={form.address}
                  onChange={onChange}
                  placeholder="City / Ground"
                />
                {invalid("address") && (
                  <div className="invalid-feedback">{errors.address}</div>
                )}
              </div>

              <div className="col-12 d-flex gap-2">
                <button className="btn btn-primary" disabled={uploading}>
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
                      setErrors({});
                    }}
                    disabled={uploading}
                  >
                    Cancel
                  </button>
                )}
              </div>
            </form>
          </div>
        </div>
      </div>

      {/* RIGHT: List + toolbar with fixed-height scrollable table */}
      <div className="col-lg-8">
        <div className="card shadow-sm border-0" style={{ height: LIST_PANEL_HEIGHT }}>
          {/* Make the body a flex column so inner area can scroll */}
          <div className="card-body d-flex flex-column" style={{ minHeight: 0 }}>
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

            {/* Scrollable area */}
            <div style={{ overflow: "auto", minHeight: 0, flex: "1 1 auto" }}>
              {loading ? (
                <div className="py-5 text-center text-muted">Loading…</div>
              ) : (
                <div className="table-responsive">
                  <table className="table align-middle table-hover mb-0">
                    {/* Sticky header for better UX while scrolling */}
                    <thead
                      className="table-light"
                      style={{ position: "sticky", top: 0, zIndex: 1, background: "white" }}
                    >
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
                                      console.warn("[TeamsPage] row logo failed:", { id: t.id });
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

/* ---------- Helpers: client-side compression ---------- */
async function compressImageToDataURL(file, opts = {}) {
  const {
    maxWidth = 256,
    maxHeight = 256,
    qualityStart = 0.85,
    minQuality = 0.5,
    step = 0.05,
    maxBytes = 120 * 1024,
  } = opts;

  const img = await fileToImage(file);
  const { canvas } = drawToMaxSize(img, maxWidth, maxHeight);

  let quality = qualityStart;
  let dataUrl = canvas.toDataURL("image/jpeg", quality);
  let outBytes = dataURLByteLength(dataUrl);

  while (outBytes > maxBytes) {
    if (quality > minQuality + 0.01) {
      quality = Math.max(minQuality, quality - step);
      dataUrl = canvas.toDataURL("image/jpeg", quality);
      outBytes = dataURLByteLength(dataUrl);
    } else {
      const smaller = scaleCanvas(canvas, 0.85);
      canvas.width = smaller.width;
      canvas.height = smaller.height;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(smaller, 0, 0);
      quality = qualityStart;
      dataUrl = canvas.toDataURL("image/jpeg", quality);
      outBytes = dataURLByteLength(dataUrl);
      if (canvas.width < 64 || canvas.height < 64) break;
    }
  }

  return { dataUrl, outBytes };
}

function fileToImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Failed to load image"));
    };
    img.src = url;
  });
}

function drawToMaxSize(img, maxW, maxH) {
  let { width, height } = img;
  const ratio = Math.min(maxW / width, maxH / height, 1);
  width = Math.round(width * ratio);
  height = Math.round(height * ratio);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  ctx.drawImage(img, 0, 0, width, height);
  return { canvas, width, height };
}

function scaleCanvas(srcCanvas, factor) {
  const c = document.createElement("canvas");
  c.width = Math.max(1, Math.round(srcCanvas.width * factor));
  c.height = Math.max(1, Math.round(srcCanvas.height * factor));
  const ctx = c.getContext("2d");
  ctx.drawImage(srcCanvas, 0, 0, c.width, c.height);
  return c;
}

function dataURLByteLength(dataUrl) {
  const base64 = dataUrl.split(",")[1] || "";
  return Math.ceil((base64.length * 3) / 4);
}
