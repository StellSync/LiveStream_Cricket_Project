import { useEffect, useMemo, useState } from "react";
import { saveDraw } from "../lib/api.js";

/* ────────────────────────────────────────────────────────────────────────────
   Helpers / Layout
──────────────────────────────────────────────────────────────────────────── */
const uid = () => Math.random().toString(36).slice(2, 9);
const LS_KEY = "draw-builder-v4-groups-independent-winners";

// Visual layout constants
const BOX_H = 90;
const BOX_W = 270;
const COL_W = 300;
const COL_GAP = 100;
const TOP_PAD = 56;
const V_GAP = 30;

function slotY(roundIdx, matchIdx) {
  const pitch = (BOX_H + V_GAP) * Math.pow(2, roundIdx || 0);
  return TOP_PAD + matchIdx * pitch + (roundIdx ? pitch / 2 - BOX_H / 2 : 0);
}
function slotX(roundIdx) {
  return roundIdx * (COL_W + COL_GAP);
}

/* ────────────────────────────────────────────────────────────────────────────
   Primitive UI
──────────────────────────────────────────────────────────────────────────── */
const inputBase = {
  height: 42,
  borderRadius: 10,
  border: "1px solid rgba(255,255,255,.14)",
  background: "rgba(15,23,42,.7)",
  color: "#e5eefc",
  padding: "8px 12px",
  outline: "none",
};

function Field({ label, children, width = 320 }) {
  return (
    <label style={{ display: "grid", gap: 6, fontSize: 13, color: "#cfd8e3", width }}>
      <span style={{ opacity: 0.9 }}>{label}</span>
      {children}
    </label>
  );
}

function Button({ children, tone = "primary", size = "md", ...props }) {
  const bg =
    tone === "danger"
      ? "linear-gradient(180deg,#ef4444,#b91c1c)"
      : tone === "muted"
      ? "linear-gradient(180deg,#263044,#1d2434)"
      : "linear-gradient(180deg,#2563eb,#1e3a8a)";
  const pad = size === "sm" ? "8px 12px" : "10px 16px";
  return (
    <button
      {...props}
      style={{
        border: `1px solid rgba(255,255,255,.18)`,
        borderRadius: 10,
        padding: pad,
        color: "#fff",
        fontWeight: 800,
        letterSpacing: ".02em",
        background: bg,
        boxShadow: "0 8px 20px rgba(0,0,0,.25)",
        cursor: "pointer",
      }}
    >
      {children}
    </button>
  );
}

function Card({ title, children }) {
  return (
    <div
      style={{
        background: "linear-gradient(180deg, rgba(15,23,42,.7), rgba(9,13,26,.76))",
        border: "1px solid rgba(255,255,255,.08)",
        boxShadow: "0 10px 32px rgba(0,0,0,.35)",
        borderRadius: 16,
        padding: 16,
      }}
    >
      {title ? (
        <div
          style={{
            fontWeight: 900,
            color: "#e2e8f0",
            marginBottom: 10,
            letterSpacing: ".02em",
          }}
        >
          {title}
        </div>
      ) : null}
      {children}
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────────────────
   Sources + Labels
──────────────────────────────────────────────────────────────────────────── */
const srcLabel = (src, ctx) => {
  if (!src) return "—";
  if (src.kind === "team") {
    const t = ctx.allTeams.find((x) => x.id === src.teamId);
    return t?.name || "—";
  }
  const mi = ctx.findMatch(src.srcBracket, src.matchId);
  const tag =
    (src.srcBracket === "upper"
      ? "U"
      : src.srcBracket === "lower"
      ? "L"
      : src.srcBracket === "final"
      ? "F"
      : "G") + (mi ? ` R${mi.round + 1} M${mi.index + 1}` : "");
  return (src.outcome === "W" ? "Winner" : "Loser") + " of " + tag;
};

/* ────────────────────────────────────────────────────────────────────────────
   Forms
──────────────────────────────────────────────────────────────────────────── */
function GroupForm({ onAdd }) {
  const [name, setName] = useState("");
  return (
    <div style={{ display: "flex", gap: 10, alignItems: "end" }}>
      <Field label="New Group Name">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Group A"
          style={inputBase}
        />
      </Field>
      <Button
        onClick={() => {
          const v = name.trim();
          if (!v) return;
          onAdd({ id: uid(), name: v, teams: [] });
          setName("");
        }}
      >
        Add Group
      </Button>
    </div>
  );
}

function TeamForm({ groups, onAdd }) {
  const [groupId, setGroupId] = useState(groups[0]?.id || "");
  const [teamName, setTeamName] = useState("");
  useEffect(() => {
    if (!groups.find((g) => g.id === groupId)) setGroupId(groups[0]?.id || "");
  }, [groups]);
  return (
    <div style={{ display: "flex", gap: 10, alignItems: "end" }}>
      <Field label="Group">
        <select value={groupId} onChange={(e) => setGroupId(e.target.value)} style={inputBase}>
          {groups.map((g) => (
            <option key={g.id} value={g.id}>
              {g.name}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Team name">
        <input
          value={teamName}
          onChange={(e) => setTeamName(e.target.value)}
          placeholder="Colombo Kings"
          style={inputBase}
        />
      </Field>
      <Button
        onClick={() => {
          if (!groupId || !teamName.trim()) return;
          onAdd(groupId, { id: uid(), name: teamName.trim() });
          setTeamName("");
        }}
      >
        Add Team
      </Button>
    </div>
  );
}

function buildTeamOptions(allTeams, takenTeamIds, filterToGroupId = null) {
  return allTeams
    .filter((t) => (filterToGroupId ? t.groupId === filterToGroupId : true))
    .filter((t) => !takenTeamIds.has(t.id))
    .map((t) => ({ value: `team:${t.id}`, label: t.name }));
}

// Build select options. For group stage we’ll pass an **empty set** for takenTeamIds
// so teams can be reused freely there.
function buildSourceOptions({ allTeams, bracketIndex, takenTeamIds, filterToGroupId }) {
  const opts = [
    {
      group: "Teams",
      items: buildTeamOptions(allTeams, takenTeamIds, filterToGroupId),
    },
  ];
  const pushBracket = (key, labelPrefix) => {
    const items = [];
    (bracketIndex[key] || []).forEach((m) => {
      const tag = `${labelPrefix} R${m.round + 1} M${m.index + 1}`;
      items.push({ value: `match:${key}:${m.id}:W`, label: `Winner of ${tag}` });
      items.push({ value: `match:${key}:${m.id}:L`, label: `Loser of ${tag}` });
    });
    if (items.length) opts.push({ group: `${labelPrefix} Bracket`, items });
  };
  pushBracket("group", "G");
  pushBracket("upper", "U");
  pushBracket("lower", "L");
  pushBracket("final", "F");
  return opts;
}

function parseSource(value) {
  if (!value) return null;
  const [kind, ...rest] = value.split(":");
  if (kind === "team") return { kind: "team", teamId: rest[0] };
  if (kind === "match") {
    const [srcBracket, matchId, outcome] = rest;
    return { kind: "match", srcBracket, matchId, outcome };
  }
  return null;
}

function SourceSelect({ label, value, onChange, options }) {
  return (
    <Field label={label}>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{ ...inputBase, width: 320 }}
      >
        <option value="">— Select —</option>
        {options.map((grp, i) => (
          <optgroup key={i} label={grp.group}>
            {grp.items.map((it) => (
              <option key={it.value} value={it.value}>
                {it.label}
              </option>
            ))}
          </optgroup>
        ))}
      </select>
    </Field>
  );
}

function AddMatchForm({
  title = "Add Match",
  rounds,
  onAdd,
  allTeams,
  bracketIndex,
  takenTeamIds,
  allowRound = true,
  groupFilter = null, // groupId for group-stage matches
}) {
  const [round, setRound] = useState(1);
  const [a, setA] = useState("");
  const [b, setB] = useState("");

  const opts = useMemo(
    () =>
      buildSourceOptions({
        allTeams,
        bracketIndex,
        takenTeamIds,
        filterToGroupId: groupFilter,
      }),
    [allTeams, bracketIndex, takenTeamIds, groupFilter]
  );

  return (
    <Card title={title}>
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "end" }}>
        {allowRound && (
          <Field label="Round #">
            <input
              type="number"
              min={1}
              value={round}
              onChange={(e) => setRound(parseInt(e.target.value || "1", 10))}
              style={{ ...inputBase, width: 140 }}
            />
          </Field>
        )}

        <SourceSelect label="Team A / Source A" value={a} onChange={setA} options={opts} />
        <SourceSelect label="Team B / Source B" value={b} onChange={setB} options={opts} />

        <Button
          onClick={() => {
            const srcA = parseSource(a);
            const srcB = parseSource(b);
            if (!srcA || !srcB) return;
            if (srcA.kind === "team" && srcB.kind === "team" && srcA.teamId === srcB.teamId) return;
            const rIdx = allowRound ? round - 1 : rounds.length - 1;
            onAdd(rIdx, {
              id: uid(),
              a: srcA,
              b: srcB,
              aAlias: "",
              bAlias: "",
              winner: null, // 'a' | 'b'
            });
            setA("");
            setB("");
          }}
        >
          Add Match
        </Button>
      </div>
    </Card>
  );
}

/* ────────────────────────────────────────────────────────────────────────────
   Bracket Canvas + Winner + Inline Alias Edit
──────────────────────────────────────────────────────────────────────────── */
function EditableName({ value, onSave, canEdit }) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(value);
  useEffect(() => setText(value), [value]);

  if (!canEdit) return <span title={value}>{value}</span>;

  return editing ? (
    <span style={{ display: "inline-flex", gap: 6, alignItems: "center" }}>
      <input
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={value}
        style={{ ...inputBase, height: 32, padding: "4px 8px", width: 160 }}
      />
      <Button size="sm" onClick={() => (setEditing(false), onSave(text.trim()))}>
        Save
      </Button>
      <Button size="sm" tone="muted" onClick={() => (setEditing(false), setText(value))}>
        Cancel
      </Button>
    </span>
  ) : (
    <span style={{ display: "inline-flex", gap: 6, alignItems: "center" }} title={value}>
      <span>{value}</span>
      <button
        onClick={() => setEditing(true)}
        title="Edit displayed name"
        style={{
          all: "unset",
          cursor: "pointer",
          fontWeight: 900,
          padding: "2px 6px",
          borderRadius: 6,
          border: "1px solid rgba(255,255,255,.18)",
          background: "linear-gradient(180deg,#263044,#1d2434)",
          color: "#dbe6ff",
        }}
      >
        ✎
      </button>
    </span>
  );
}

function WinnerButtons({ winner, onSet }) {
  return (
    <div style={{ display: "flex", gap: 6 }}>
      <Button size="sm" tone={winner === "a" ? "primary" : "muted"} onClick={() => onSet("a")}>
        A Wins
      </Button>
      <Button size="sm" tone={winner === "b" ? "primary" : "muted"} onClick={() => onSet("b")}>
        B Wins
      </Button>
      {winner && (
        <Button size="sm" tone="muted" onClick={() => onSet(null)}>
          Clear
        </Button>
      )}
    </div>
  );
}

function BracketCanvas({
  title,
  bracketKey, // 'upper' | 'lower' | 'final' | 'group'
  rounds,
  allTeams,
  indexLookup,
  onDeleteMatch,
  onEditAlias, // (roundIdx, matchId, side:'a'|'b', aliasString)
  onSetWinner, // (roundIdx, matchId, winner:'a'|'b'|null)
}) {
  const ctx = { allTeams, findMatch: indexLookup.findMatch };

  const totalCols = Math.max(1, rounds.length);
  const width = totalCols * (COL_W + COL_GAP) - COL_GAP + 10;
  const height =
    TOP_PAD +
    Math.max(
      250,
      ...rounds.map((r, idx) =>
        r.length ? slotY(idx, r.length - 1) + BOX_H + TOP_PAD : 0
      )
    );

  const posById = {};
  rounds.forEach((r, ri) =>
    r.forEach((m, mi) => {
      posById[m.id] = { x: slotX(ri), y: slotY(ri, mi), ri, mi };
    })
  );

  const effectiveName = (m, side) => {
    const alias = side === "a" ? m.aAlias : m.bAlias;
    if (alias && alias.trim()) return alias.trim();
    const src = side === "a" ? m.a : m.b;
    return srcLabel(src, ctx);
  };

  const paths = [];
  rounds.forEach((r, ri) =>
    r.forEach((m) => {
      const target = posById[m.id];
      const leftX = target.x;
      const topY = target.y;
      const inletA = { x: leftX, y: topY + BOX_H * 0.28 };
      const inletB = { x: leftX, y: topY + BOX_H * 0.72 };

      const addPath = (src, inlet) => {
        if (!src || src.kind !== "match") return;
        if (src.srcBracket !== bracketKey) return;
        const srcInfo = indexLookup.findMatch(src.srcBracket, src.matchId);
        if (!srcInfo) return;
        const sx = slotX(srcInfo.round) + BOX_W;
        const sy = slotY(srcInfo.round, srcInfo.index) + BOX_H / 2;
        const midX = (sx + inlet.x) / 2;
        const d = `M ${sx + 16} ${sy + 16} 
                   L ${midX + 16} ${sy + 16}
                   L ${midX + 16} ${inlet.y + 16}
                   L ${inlet.x + 16} ${inlet.y + 16}`;
        paths.push(d);
      };
      addPath(m.a, inletA);
      addPath(m.b, inletB);
    })
  );

  return (
    <div>
      <div style={{ fontWeight: 900, color: "#e5ecff", marginBottom: 8, letterSpacing: ".03em" }}>
        {title}
      </div>

      <div
        style={{
          position: "relative",
          borderRadius: 18,
          padding: 16,
          background: "linear-gradient(180deg, rgba(15,23,42,.65), rgba(9,12,22,.7))",
          border: "1px solid rgba(255,255,255,.08)",
          overflow: "auto",
        }}
      >
        <svg width={width} height={height} style={{ position: "absolute", inset: 16, pointerEvents: "none" }}>
          {paths.map((d, i) => (
            <path key={i} d={d} stroke="rgba(148,163,184,.55)" strokeWidth="3" fill="none" />
          ))}
        </svg>

        <div
          style={{
            display: "grid",
            gridAutoFlow: "column",
            gap: COL_GAP,
            position: "relative",
            minWidth: width,
            minHeight: height,
          }}
        >
          {rounds.map((matches, rIdx) => (
            <div key={rIdx} style={{ width: COL_W, position: "relative", height }}>
              <div
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  fontWeight: 800,
                  color: "#93a4bf",
                  letterSpacing: ".04em",
                  padding: "0 2px",
                }}
              >
                Round {rIdx + 1}
              </div>

              {matches.map((m, mi) => {
                const top = slotY(rIdx, mi);
                const canEditAlias = rIdx >= 1; // allow edits from R2 onward

                return (
                  <div key={m.id}>
                    <div
                      style={{
                        position: "absolute",
                        top,
                        left: 0,
                        width: BOX_W,
                        height: BOX_H,
                        borderRadius: 14,
                        padding: 12,
                        color: "#e6eefc",
                        background: "linear-gradient(180deg, rgba(30,41,78,.9), rgba(15,24,54,.95))",
                        border: "1px solid rgba(255,255,255,.12)",
                        boxShadow: "0 8px 18px rgba(0,0,0,.35)",
                        display: "grid",
                        gridTemplateRows: "auto auto",
                        gap: 8,
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          gap: 8,
                        }}
                      >
                        <div
                          style={{
                            maxWidth: "18ch",
                            whiteSpace: "nowrap",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            fontWeight: 900,
                          }}
                          title={effectiveName(m, "a")}
                        >
                          <EditableName
                            value={effectiveName(m, "a")}
                            canEdit={canEditAlias}
                            onSave={(txt) => onEditAlias(rIdx, m.id, "a", txt)}
                          />
                        </div>
                        <span style={{ opacity: 0.7 }}>vs</span>
                        <div
                          style={{
                            maxWidth: "18ch",
                            whiteSpace: "nowrap",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            fontWeight: 900,
                          }}
                          title={effectiveName(m, "b")}
                        >
                          <EditableName
                            value={effectiveName(m, "b")}
                            canEdit={canEditAlias}
                            onSave={(txt) => onEditAlias(rIdx, m.id, "b", txt)}
                          />
                        </div>
                      </div>

                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          gap: 8,
                          fontSize: 12,
                        }}
                      >
                        <span style={{ color: "#9fb3d9" }}>
                          Winner:{" "}
                          {m.winner ? (m.winner === "a" ? effectiveName(m, "a") : effectiveName(m, "b")) : "—"}
                        </span>

                        <WinnerButtons
                          winner={m.winner}
                          onSet={(w) => onSetWinner(rIdx, m.id, w)}
                        />

                        <button
                          onClick={() => onDeleteMatch(rIdx, m.id)}
                          style={{
                            border: "1px solid rgba(255,255,255,.18)",
                            background: "linear-gradient(180deg,#ef4444,#b91414)",
                            color: "#fff",
                            fontWeight: 800,
                            borderRadius: 10,
                            padding: "6px 10px",
                            cursor: "pointer",
                          }}
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────────────────
   Page
──────────────────────────────────────────────────────────────────────────── */
export default function DrawBuilder() {
  const [groups, setGroups] = useState([]);
  const [upper, setUpper] = useState([[]]);
  const [lower, setLower] = useState([[]]);
  const [finals, setFinals] = useState([[]]);

  // Group-stage matches per group: { [groupId]: Round[][] }
  const [groupRounds, setGroupRounds] = useState({});

  const [loading, setLoading] = useState(false);

  // seed
  useEffect(() => {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) {
      try {
        const v = JSON.parse(raw);
        setGroups(v.groups || []);
        setUpper(v.upper?.length ? v.upper : [[]]);
        setLower(v.lower?.length ? v.lower : [[]]);
        setFinals(v.finals?.length ? v.finals : [[]]);
        setGroupRounds(v.groupRounds || {});
        return;
      } catch {}
    }
    const g1 = { id: uid(), name: "Group A", teams: [] };
    setGroups([g1]);
    setGroupRounds({ [g1.id]: [[]] });
  }, []);

  // autosave
  useEffect(() => {
    localStorage.setItem(
      LS_KEY,
      JSON.stringify({
        groups,
        upper,
        lower,
        finals,
        groupRounds,
      })
    );
  }, [groups, upper, lower, finals, groupRounds]);

  const allTeams = useMemo(
    () => groups.flatMap((g) => g.teams.map((t) => ({ ...t, groupId: g.id }))),
    [groups]
  );

  // Build bracket indexes for cross-references
  const bracketIndex = useMemo(() => {
    const indexer = (rounds) => {
      const out = [];
      rounds.forEach((r, ri) =>
        r.forEach((m, mi) => out.push({ id: m.id, round: ri, index: mi }))
      );
      return out;
    };
    const groupIndexList = [];
    Object.entries(groupRounds).forEach(([gid, rounds]) => {
      rounds.forEach((r, ri) =>
        r.forEach((m, mi) => groupIndexList.push({ id: m.id, round: ri, index: mi, gid }))
      );
    });
    return {
      upper: indexer(upper),
      lower: indexer(lower),
      final: indexer(finals),
      group: groupIndexList,
    };
  }, [upper, lower, finals, groupRounds]);

  const indexLookup = {
    findMatch: (bracket, id) => {
      if (bracket === "group") return bracketIndex.group.find((m) => m.id === id) || null;
      const arr = bracketIndex[bracket] || [];
      return arr.find((m) => m.id === id) || null;
    },
  };

  // group ops
  const addGroup = (g) =>
    setGroups((x) => {
      const next = [...x, g];
      setGroupRounds((gr) => ({ ...gr, [g.id]: [[]] }));
      return next;
    });

  const addTeam = (groupId, team) =>
    setGroups((x) =>
      x.map((g) => (g.id === groupId ? { ...g, teams: [...g.teams, team] } : g))
    );
  const removeTeam = (groupId, teamId) =>
    setGroups((x) =>
      x.map((g) =>
        g.id === groupId
          ? { ...g, teams: g.teams.filter((t) => t.id !== teamId) }
          : g
      )
    );

  // rounds & matches utils
  const ensureRounds = (arr, r) => {
    const copy = arr.map((x) => [...x]);
    while (copy.length <= r) copy.push([]);
    return copy;
  };

  const pushMatch = (arr, roundIdx, m) => {
    const copy = ensureRounds(arr, roundIdx);
    copy[roundIdx] = [...copy[roundIdx], m];
    return copy;
  };
  const removeMatch = (arr, roundIdx, id) => {
    const round = arr[roundIdx] || [];
    const filtered = round.filter((m) => m.id !== id);
    const copy = arr.map((r, i) => (i === roundIdx ? filtered : r));
    return copy;
  };
  const aliasMatch = (arr, roundIdx, id, side, alias) => {
    const round = arr[roundIdx] || [];
    const mapped = round.map((m) => (m.id === id ? { ...m, ...(side === "a" ? { aAlias: alias } : { bAlias: alias }) } : m));
    const copy = arr.map((r, i) => (i === roundIdx ? mapped : r));
    return copy;
  };
  const setWinner = (arr, roundIdx, id, w) => {
    const round = arr[roundIdx] || [];
    const mapped = round.map((m) => (m.id === id ? { ...m, winner: w } : m));
    return arr.map((r, i) => (i === roundIdx ? mapped : r));
  };

  // add/del/alias/winner for each bracket
  const addUpper = (roundIdx, m) => setUpper((old) => pushMatch(old, roundIdx, m));
  const addLower = (roundIdx, m) => setLower((old) => pushMatch(old, roundIdx, m));
  const addFinal = (roundIdx, m) => setFinals((old) => pushMatch(old, roundIdx, m));

  const delUpper = (roundIdx, id) => setUpper((old) => removeMatch(old, roundIdx, id));
  const delLower = (roundIdx, id) => setLower((old) => removeMatch(old, roundIdx, id));
  const delFinal = (roundIdx, id) => setFinals((old) => removeMatch(old, roundIdx, id));

  const setUpperAlias = (roundIdx, id, side, alias) => setUpper((old) => aliasMatch(old, roundIdx, id, side, alias));
  const setLowerAlias = (roundIdx, id, side, alias) => setLower((old) => aliasMatch(old, roundIdx, id, side, alias));
  const setFinalAlias = (roundIdx, id, side, alias) => setFinals((old) => aliasMatch(old, roundIdx, id, side, alias));

  const setUpperWinner = (roundIdx, id, w) => setUpper((old) => setWinner(old, roundIdx, id, w));
  const setLowerWinner = (roundIdx, id, w) => setLower((old) => setWinner(old, roundIdx, id, w));
  const setFinalWinner = (roundIdx, id, w) => setFinals((old) => setWinner(old, roundIdx, id, w));

  // group-stage mutators (independent from upper/lower/finals)
  const addGroupMatch = (groupId, roundIdx, m) =>
    setGroupRounds((old) => {
      const rounds = old[groupId] || [[]];
      return { ...old, [groupId]: pushMatch(rounds, roundIdx, m) };
    });

  const delGroupMatch = (groupId, roundIdx, id) =>
    setGroupRounds((old) => {
      const rounds = old[groupId] || [[]];
      return { ...old, [groupId]: removeMatch(rounds, roundIdx, id) };
    });

  const setGroupAlias = (groupId, roundIdx, id, side, alias) =>
    setGroupRounds((old) => {
      const rounds = old[groupId] || [[]];
      return { ...old, [groupId]: aliasMatch(rounds, roundIdx, id, side, alias) };
    });

  const setGroupWinner = (groupId, roundIdx, id, w) =>
    setGroupRounds((old) => {
      const rounds = old[groupId] || [[]];
      return { ...old, [groupId]: setWinner(rounds, roundIdx, id, w) };
    });

  /* Team dropdown filtering:
     - For U/L/Finals: hide teams already used (as direct "team") in U/L/Finals.
     - For Group Stage: **no filtering** (teams can be reused within groups).
  */
  const takenTeamIdsULF = useMemo(() => {
    const s = new Set();
    const collect = (arr) => {
      arr.forEach((r) =>
        r.forEach((m) => {
          if (m.a?.kind === "team") s.add(m.a.teamId);
          if (m.b?.kind === "team") s.add(m.b.teamId);
        })
      );
    };
    collect(upper);
    collect(lower);
    collect(finals);
    return s;
  }, [upper, lower, finals]);

  async function submitToDB() {
    setLoading(true);
    try {
      await saveDraw({
        tournamentId: null,
        groups,
        groupMatches: groupRounds, // independent
        upperMatches: upper,
        lowerMatches: lower,
        finalMatches: finals,
        version: Date.now(),
      });
      alert("Draft submitted to DB.");
    } catch (e) {
      console.error(e);
      alert("Submit failed. Check console.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ padding: 20 }}>
      <style>{pageCSS}</style>

      <div className="page-head">
        <Button tone="muted" onClick={() => localStorage.removeItem(LS_KEY)}>
          Clear Local Draft
        </Button>
        <div style={{ flex: 1 }} />
        <Button onClick={submitToDB} disabled={loading}>
          {loading ? "Submitting…" : "Submit to DB"}
        </Button>
      </div>

      {/* Forms */}
      <div className="forms-row">
        <Card title="Groups / Teams">
          <GroupForm onAdd={addGroup} />
          <div style={{ height: 10 }} />
          <TeamForm groups={groups} onAdd={addTeam} />
          <div style={{ height: 16 }} />
          <div style={{ display: "grid", gap: 10 }}>
            {groups.map((g) => (
              <div key={g.id} className="group">
                <div className="group-title">{g.name}</div>
                <div className="team-list">
                  {g.teams.map((t) => (
                    <div key={t.id} className="team-pill">
                      <span>{t.name}</span>
                      <button
                        className="pill-x"
                        onClick={() => removeTeam(g.id, t.id)}
                        title="Remove team"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </Card>

        <AddMatchForm
          title="Add Upper Match"
          rounds={upper}
          onAdd={addUpper}
          allTeams={allTeams}
          bracketIndex={bracketIndex}
          takenTeamIds={takenTeamIdsULF} // filter here
        />
        <AddMatchForm
          title="Add Lower Match"
          rounds={lower}
          onAdd={addLower}
          allTeams={allTeams}
          bracketIndex={bracketIndex}
          takenTeamIds={takenTeamIdsULF} // filter here
        />
      </div>

      {/* Group Stage add form (independent; no filtering) */}
      <Card title="Add Group Stage Match">
        <GroupStageAdd
          groups={groups}
          allTeams={allTeams}
          onAdd={addGroupMatch}
          bracketIndex={bracketIndex}
        />
      </Card>

      {/* Brackets */}
      <div className="brackets">
        <Card>
          <BracketCanvas
            title="Upper Bracket"
            bracketKey="upper"
            rounds={upper}
            allTeams={allTeams}
            indexLookup={indexLookup}
            onDeleteMatch={delUpper}
            onEditAlias={setUpperAlias}
            onSetWinner={setUpperWinner}
          />
        </Card>

        <Card>
          <BracketCanvas
            title="Lower Bracket"
            bracketKey="lower"
            rounds={lower}
            allTeams={allTeams}
            indexLookup={indexLookup}
            onDeleteMatch={delLower}
            onEditAlias={setLowerAlias}
            onSetWinner={setLowerWinner}
          />
        </Card>
      </div>

      {/* Group Stage canvases */}
      <div className="groups-grid">
        {groups.map((g) => (
          <Card key={g.id}>
            <BracketCanvas
              title={`Group Stage – ${g.name}`}
              bracketKey="group"
              rounds={(groupRounds[g.id] || []).map((r) => r)}
              allTeams={allTeams}
              indexLookup={indexLookup}
              onDeleteMatch={(ri, id) => delGroupMatch(g.id, ri, id)}
              onEditAlias={(ri, id, side, alias) => setGroupAlias(g.id, ri, id, side, alias)}
              onSetWinner={(ri, id, w) => setGroupWinner(g.id, ri, id, w)}
            />
          </Card>
        ))}
      </div>

      {/* Finals */}
      <div className="finals">
        <AddMatchForm
          title="Add Final Match"
          rounds={finals}
          onAdd={addFinal}
          allTeams={allTeams}
          bracketIndex={bracketIndex}
          takenTeamIds={takenTeamIdsULF} // filter here too
          allowRound={false}
        />
        <Card>
          <BracketCanvas
            title="Finals"
            bracketKey="final"
            rounds={finals}
            allTeams={allTeams}
            indexLookup={indexLookup}
            onDeleteMatch={delFinal}
            onEditAlias={setFinalAlias}
            onSetWinner={setFinalWinner}
          />
        </Card>
      </div>

      <div style={{ marginTop: 12, color: "#9fb3d9" }}>
        Autosaves locally. You can add brackets in parts and submit anytime.
      </div>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────────────────
   Group Stage Add sub-form (no team filtering)
──────────────────────────────────────────────────────────────────────────── */
function GroupStageAdd({ groups, allTeams, onAdd, bracketIndex }) {
  const [gid, setGid] = useState(groups[0]?.id || "");
  const [round, setRound] = useState(1);
  const [a, setA] = useState("");
  const [b, setB] = useState("");

  useEffect(() => {
    if (!groups.find((g) => g.id === gid)) setGid(groups[0]?.id || "");
  }, [groups]);

  // Pass an **empty set** so teams are not filtered in groups
  const opts = useMemo(
    () =>
      buildSourceOptions({
        allTeams,
        bracketIndex,
        takenTeamIds: new Set(), // ← allow repeats in group stage
        filterToGroupId: gid || null,
      }),
    [allTeams, bracketIndex, gid]
  );

  return (
    <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "end" }}>
      <Field label="Group">
        <select value={gid} onChange={(e) => setGid(e.target.value)} style={{ ...inputBase, width: 200 }}>
          {groups.map((g) => (
            <option key={g.id} value={g.id}>
              {g.name}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Round #">
        <input
          type="number"
          min={1}
          value={round}
          onChange={(e) => setRound(parseInt(e.target.value || "1", 10))}
          style={{ ...inputBase, width: 140 }}
        />
      </Field>
      <SourceSelect label="Team A / Source A" value={a} onChange={setA} options={opts} />
      <SourceSelect label="Team B / Source B" value={b} onChange={setB} options={opts} />
      <Button
        onClick={() => {
          const srcA = parseSource(a);
          const srcB = parseSource(b);
          if (!srcA || !srcB) return;
          onAdd(gid, round - 1, { id: uid(), a: srcA, b: srcB, aAlias: "", bAlias: "", winner: null });
          setA("");
          setB("");
        }}
      >
        Add Match
      </Button>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────────────────
   Scoped CSS
──────────────────────────────────────────────────────────────────────────── */
const pageCSS = `
.page-head{ display:flex; align-items:center; gap:12px; margin-bottom:14px; }
.forms-row{
  display:grid;
  grid-template-columns: 1.6fr 1fr 1fr;
  gap:14px;
  margin-bottom: 14px;
}
.brackets{
  display:grid;
  grid-template-columns: 1fr 1fr;
  gap:14px;
  margin-bottom: 14px;
}
.groups-grid{
  display:grid;
  grid-template-columns: 1fr 1fr;
  gap:14px;
  margin-bottom: 14px;
}
@media (max-width: 1200px){
  .groups-grid{ grid-template-columns: 1fr; }
}
.finals{ display:grid; grid-template-columns: 1fr; gap:14px; }

.group{ 
  background: linear-gradient(180deg, rgba(22,32,55,.6), rgba(16,24,45,.8));
  border:1px solid rgba(255,255,255,.08);
  border-radius:12px; padding:12px;
}
.group-title{ font-weight:900; color:#dbe6fb; margin-bottom:8px; }
.team-list{ display:flex; gap:8px; flex-wrap:wrap; }
.team-pill{
  display:flex; align-items:center; gap:8px;
  padding:6px 10px; border-radius:999px;
  color:#e8f1ff; font-weight:800; letter-spacing:.02em;
  background: linear-gradient(180deg,#1e2a54,#132043);
  border:1px solid rgba(255,255,255,.12);
}
.pill-x{
  all:unset; cursor:pointer; width:18px; height:18px;
  display:grid; place-items:center; border-radius:50%;
  background:rgba(255,255,255,.12); color:#fff; font-weight:900;
}
`;
