// backend/controllers/playerController.js
import Player from "../models/Player.js";

// Create Player
export const createPlayer = async (req, res, next) => {
  try {
    const p = await Player.create(req.body);
    res.status(201).json(p);
  } catch (e) {
    next(e);
  }
};

// List Players (optionally filter by teamId)
export const listPlayers = async (req, res, next) => {
  try {
    const { teamId } = req.query;
    const filter = {};
    if (teamId != null) {
      const n = parseInt(teamId, 10);
      if (!Number.isNaN(n)) filter.teamId = n;
    }
    const list = await Player.find(filter).sort({ createdAt: -1 });
    res.json(list);
  } catch (e) {
    next(e);
  }
};

// Get Player by numeric id
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

// Update Player by numeric id
export const updatePlayer = async (req, res, next) => {
  try {
    const numId = parseInt(req.params.id, 10);
    if (Number.isNaN(numId)) return res.status(400).json({ message: "id must be a number" });
    const p = await Player.findOneAndUpdate({ id: numId }, req.body, { new: true });
    if (!p) return res.status(404).json({ message: "Player not found" });
    res.json(p);
  } catch (e) {
    next(e);
  }
};

// Delete Player by numeric id
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
