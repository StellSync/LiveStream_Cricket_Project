// backend/controllers/teamController.js
import Team from "../models/Team.js";

// Create Team
export const createTeam = async (req, res, next) => {
  try {
    const t = await Team.create(req.body);
    res.status(201).json(t);
  } catch (e) {
    next(e);
  }
};

// List all Teams
export const listTeams = async (_req, res, next) => {
  try {
    const list = await Team.find().sort({ createdAt: -1 });
    res.json(list);
  } catch (e) {
    next(e);
  }
};

// Get Team by numeric primary key (id)
export const getTeam = async (req, res, next) => {
  try {
    const numId = parseInt(req.params.id, 10);
    if (Number.isNaN(numId)) return res.status(400).json({ message: "id must be a number" });
    const t = await Team.findOne({ id: numId });
    if (!t) return res.status(404).json({ message: "Team not found" });
    res.json(t);
  } catch (e) {
    next(e);
  }
};

// Update Team by numeric primary key
export const updateTeam = async (req, res, next) => {
  try {
    const numId = parseInt(req.params.id, 10);
    if (Number.isNaN(numId)) return res.status(400).json({ message: "id must be a number" });
    const t = await Team.findOneAndUpdate({ id: numId }, req.body, { new: true });
    if (!t) return res.status(404).json({ message: "Team not found" });
    res.json(t);
  } catch (e) {
    next(e);
  }
};

// Delete Team by numeric primary key
export const deleteTeam = async (req, res, next) => {
  try {
    const numId = parseInt(req.params.id, 10);
    if (Number.isNaN(numId)) return res.status(400).json({ message: "id must be a number" });
    const t = await Team.findOneAndDelete({ id: numId });
    if (!t) return res.status(404).json({ message: "Team not found" });
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
};
