// backend/controllers/playerController.js
import Player from "../models/Player.js";

/**
 * Helper: loosely parse boolean-ish values to boolean
 */
function parseBoolLoose(v, fallback = false) {
  if (v === undefined || v === null) return fallback;
  if (typeof v === "boolean") return v;
  if (typeof v === "number") return v !== 0;
  if (typeof v === "string") {
    const s = v.trim().toLowerCase();
    if (["true", "1", "yes", "y", "on"].includes(s)) return true;
    if (["false", "0", "no", "n", "off"].includes(s)) return false;
  }
  return fallback;
}

/**
 * Coerce numeric-ish values to Number or null (empty string -> null)
 */
function parseNumberOrNull(v) {
  if (v === undefined || v === null || v === "") return null;
  const n = Number(v);
  return Number.isNaN(n) ? null : n;
}

/** ---------------- CREATE ---------------- */
export const createPlayer = async (req, res, next) => {
  try {
    const body = req.body || {};

    // Basic required validation
    const teamIdRaw = body.teamId;
    const teamId = parseNumberOrNull(teamIdRaw);
    if (teamId == null) {
      return res.status(400).json({ message: "teamId is required and must be a number" });
    }

    const playerName = (body.playerName || "").toString().trim();
    if (!playerName) {
      return res.status(400).json({ message: "playerName is required" });
    }

    // Position: optional. If provided and valid -> number, otherwise null
    const position = parseNumberOrNull(body.position);

    // Roles: booleans
    const isBatter = parseBoolLoose(body.isBatter, false);
    const isBaller = parseBoolLoose(body.isBaller, false);
    const isWk = parseBoolLoose(body.isWk, false);
    const isCaptain = parseBoolLoose(body.isCaptain, false);

    // If 'all' behavior is being controlled in front-end, both will already be true.
    // But ensure model stores as booleans
    const payload = {
      teamId,
      teamName: body.teamName ? String(body.teamName).trim() : undefined,
      playerName,
      playerAddress: body.playerAddress ? String(body.playerAddress).trim() : undefined,
      phone: body.phone ? String(body.phone).trim() : undefined,
      position, // number or null
      isBatter,
      isBaller,
      isWk,
      isCaptain,
    };

    const p = await Player.create(payload);
    res.status(201).json(p);
  } catch (e) {
    next(e);
  }
};

/** ---------------- LIST ---------------- */
export const listPlayers = async (req, res, next) => {
  try {
    const { teamId } = req.query;
    const filter = {};
    if (teamId != null && teamId !== "") {
      const n = parseInt(teamId, 10);
      if (!Number.isNaN(n)) filter.teamId = n;
    }
    const list = await Player.find(filter).sort({ createdAt: -1 });
    res.json(list);
  } catch (e) {
    next(e);
  }
};

/** ---------------- GET ---------------- */
export const getPlayer = async (req, res, next) => {
  try {
    const numId = parseInt(req.params.id, 10);
    if (Number.isNaN(numId)) return res.status(400).json({ message: "id must be a number" });
    const p = await Player.findOne({ id: numId });
    if (!p) return res.status(404).json({ message: "Player not found" });
    res.json(p);
  } catch (e) {
    next(e);
  }
};

/** ---------------- UPDATE ---------------- */
export const updatePlayer = async (req, res, next) => {
  try {
    const numId = parseInt(req.params.id, 10);
    if (Number.isNaN(numId)) return res.status(400).json({ message: "id must be a number" });

    const body = req.body || {};
    const update = {};

    if (body.teamId !== undefined) {
      const t = parseNumberOrNull(body.teamId);
      if (t == null) {
        return res.status(400).json({ message: "teamId must be a number" });
      }
      update.teamId = t;
    }

    if (body.playerName !== undefined) {
      const pn = String(body.playerName || "").trim();
      if (!pn) return res.status(400).json({ message: "playerName cannot be empty" });
      update.playerName = pn;
    }

    if (body.playerAddress !== undefined) update.playerAddress = body.playerAddress ? String(body.playerAddress).trim() : "";
    if (body.phone !== undefined) update.phone = body.phone ? String(body.phone).trim() : "";

    // Position: allow clearing (null) or setting numeric value
    if (Object.prototype.hasOwnProperty.call(body, "position")) {
      const pos = parseNumberOrNull(body.position);
      update.position = pos; // could be number or null
    }

    // Roles: if present, coerce to boolean
    if (body.isBatter !== undefined) update.isBatter = parseBoolLoose(body.isBatter, false);
    if (body.isBaller !== undefined) update.isBaller = parseBoolLoose(body.isBaller, false);
    if (body.isWk !== undefined) update.isWk = parseBoolLoose(body.isWk, false);
    if (body.isCaptain !== undefined) update.isCaptain = parseBoolLoose(body.isCaptain, false);

    const p = await Player.findOneAndUpdate({ id: numId }, update, { new: true });
    if (!p) return res.status(404).json({ message: "Player not found" });
    res.json(p);
  } catch (e) {
    next(e);
  }
};

/** ---------------- DELETE ---------------- */
export const deletePlayer = async (req, res, next) => {
  try {
    const numId = parseInt(req.params.id, 10);
    if (Number.isNaN(numId)) return res.status(400).json({ message: "id must be a number" });
    const p = await Player.findOneAndDelete({ id: numId });
    if (!p) return res.status(404).json({ message: "Player not found" });
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
};
