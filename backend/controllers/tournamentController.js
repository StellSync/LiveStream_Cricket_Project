// backend/controllers/tournamentController.js
import Tournament from "../models/Tournament.js";

// Create Tournament
export const createTournament = async (req, res, next) => {
  try {
    const t = await Tournament.create(req.body);
    res.status(201).json(t);
  } catch (e) {
    next(e);
  }
};

// List all Tournaments
export const listTournaments = async (_req, res, next) => {
  try {
    const list = await Tournament.find().sort({ createdAt: -1 });
    res.json(list);
  } catch (e) {
    next(e);
  }
};

// Get Tournament by numeric primary key (id)
export const getTournament = async (req, res, next) => {
  try {
    const numId = parseInt(req.params.id, 10);
    const t = await Tournament.findOne({ id: numId });
    if (!t) return res.status(404).json({ message: "Tournament not found" });
    res.json(t);
  } catch (e) {
    next(e);
  }
};

// Update Tournament by numeric primary key
export const updateTournament = async (req, res, next) => {
  try {
    const numId = parseInt(req.params.id, 10);
    const t = await Tournament.findOneAndUpdate({ id: numId }, req.body, {
      new: true,
    });
    if (!t) return res.status(404).json({ message: "Tournament not found" });
    res.json(t);
  } catch (e) {
    next(e);
  }
};

// Delete Tournament by numeric primary key
export const deleteTournament = async (req, res, next) => {
  try {
    const numId = parseInt(req.params.id, 10);
    const t = await Tournament.findOneAndDelete({ id: numId });
    if (!t) return res.status(404).json({ message: "Tournament not found" });
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
};
