// src/pages/Home.jsx
import React from "react";

function copy(text) {
  navigator.clipboard?.writeText(text).catch(() => {});
}

function CardRow({ title, items }) {
  return (
    <div className="card shadow-sm">
      <div className="card-body">
        <h6 className="card-subtitle text-uppercase text-muted mb-2">OBS</h6>
        <h4 className="card-title mb-3">{title}</h4>

        <div className="row g-3">
          {items.map((it) => (
            <OverlayCard key={it.path} {...it} />
          ))}
        </div>
      </div>
    </div>
  );
}

function OverlayCard({ path, label, blurb, emoji, openInSameTab = false }) {
  // Always point overlays to the backend (port 5000)
  const base =
    typeof window !== "undefined"
      ? `${window.location.protocol}//${window.location.hostname}:5000`
      : "http://localhost:5000";
  const url = `${base}${path}`;

  return (
    <div className="col-12 col-md-6">
      <div className="border rounded-3 p-3 h-100 d-flex">
        <div
          className="me-3 d-flex align-items-center justify-content-center rounded-circle"
          style={{
            width: 44,
            height: 44,
            background: "linear-gradient(135deg,#e3f2ff,#f5f9ff)",
            border: "1px solid #e6eef7",
            fontSize: 22,
          }}
          aria-hidden
        >
          {emoji}
        </div>

        <div className="flex-grow-1">
          <div className="d-flex align-items-center justify-content-between">
            <div className="fw-semibold">{label}</div>
            <span className="badge bg-primary-subtle text-primary-emphasis">
              Overlay
            </span>
          </div>

          <div className="text-muted small mt-1">{blurb}</div>

          {/* Actions */}
          <div className="mt-3 d-flex gap-2">
            <a
              className="btn btn-sm btn-primary"
              href={url}
              target={openInSameTab ? "_self" : "_blank"}
              rel="noreferrer"
              title={url}
            >
              Preview
            </a>
            <button
              type="button"
              className="btn btn-sm btn-outline-secondary"
              onClick={() => copy(url)}
              title={`Copy full URL:\n${url}`}
            >
              Copy URL
            </button>
            <details className="ms-auto">
              <summary className="small text-muted" style={{ cursor: "pointer" }}>
                Show URL
              </summary>
              <code className="small d-block mt-1 text-wrap">{url}</code>
            </details>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Home() {
  const overlayPages = [
    {
      path: "/overlay/scorebar",
      label: "Scorebar (Live)",
      blurb:
        "Professional single-line scoreboard with batters, bowler and current-over chips.",
      emoji: "📊",
    },
    {
      path: "/overlay/match",
      label: "Match Header",
      blurb:
        "Tournament logo/name, teams, ground and overs. Great for pre-game or innings start.",
      emoji: "🎟️",
    },
    {
      path: "/overlay",
      label: "Legacy Bar",
      blurb: "Simple legacy scoreboard bar (kept for compatibility).",
      emoji: "🧰",
    },
  ];

  const eventOverlays = [
    {
      path: "/overlay/four",
      label: "FOUR!",
      blurb: "Neon pop + confetti burst.",
      emoji: "💥",
    },
    {
      path: "/overlay/six",
      label: "SIX!",
      blurb: "Cosmic rings + star trail animation.",
      emoji: "🚀",
    },
    {
      path: "/overlay/wicket",
      label: "WICKET!",
      blurb: "Flash + drop + shake + shards.",
      emoji: "⚡",
    },
    {
      path: "/overlay/freehit",
      label: "FREE HIT",
      blurb: "Green rings + twinkling stars animation.",
      emoji: "🟢",
    },
  ];

  const streams = [
    {
      path: "/sse-overlay",
      label: "Scorebar Stream (SSE)",
      blurb: "Live JSON stream used by the scorebar overlay.",
      emoji: "🔌",
    },
    {
      path: "/sse-match",
      label: "Match Header Stream (SSE)",
      blurb: "Live JSON stream for tournament/teams header overlay.",
      emoji: "🛰️",
    },
    {
      path: "/sse",
      label: "Legacy Score Stream (SSE)",
      blurb: "Legacy demo SSE used by the old overlay.",
      emoji: "📡",
    },
  ];

  return (
    <div className="row g-3">
      {/* Hero / tip */}
      <div className="col-12">
        <div className="card shadow-sm border-0">
          <div className="card-body">
            <h4 className="card-title mb-2">OBS Overlays</h4>
            <p className="text-muted mb-0">
              Click <strong>Preview</strong> to open in a new tab, or{" "}
              <strong>Copy URL</strong> to paste into an OBS Browser Source.
            </p>
          </div>
        </div>
      </div>

      {/* Overlay Pages */}
      <div className="col-12">
        <CardRow title="Overlay Pages" items={overlayPages} />
      </div>

      {/* Event Overlays */}
      <div className="col-12">
        <div className="card shadow-sm">
          <div className="card-body">
            <h6 className="card-subtitle text-uppercase text-muted mb-2">OBS</h6>
            <h4 className="card-title mb-3">Event Overlays</h4>
            <div className="row g-3">
              {eventOverlays.map((it) => (
                <OverlayCard key={it.path} {...it} />
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Streams */}
      <div className="col-12">
        <div className="card shadow-sm">
          <div className="card-body">
            <h6 className="card-subtitle text-uppercase text-muted mb-2">Live</h6>
            <h4 className="card-title mb-3">SSE Streams</h4>
            <div className="row g-3">
              {streams.map((it) => (
                <OverlayCard key={it.path} {...it} />
              ))}
            </div>
            <div className="small text-muted mt-3">
              Tip: you usually don’t add these directly to OBS—they power the overlay pages above.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
