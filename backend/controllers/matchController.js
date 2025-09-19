// backend/controllers/matchController.js
import Match from "../models/Match.js";
import Team from "../models/Team.js";
import Tournament from "../models/Tournament.js";

/**
 * ---- Helpers to resolve IDs when admin sends names ----
 * Admin can send: tournamentId OR tournamentName
 *                 team1Id / team1Name
 *                 team2Id / team2Name
 * We only store numeric IDs in DB.
 */
async function resolveTournamentId({ tournamentId, tournamentName }) {
  if (Number.isInteger(tournamentId)) return tournamentId;
  if (typeof tournamentId === "string" && /^\d+$/.test(tournamentId)) return parseInt(tournamentId, 10);
  if (tournamentName) {
    const t = await Tournament.findOne({ name: tournamentName.trim() }).lean();
    if (!t) throw Object.assign(new Error("Tournament not found by name"), { status: 400 });
    return t.id; // numeric pk from Tournament
  }
  throw Object.assign(new Error("tournamentId or tournamentName is required"), { status: 400 });
}

async function resolveTeamIdByEither(input, label) {
  const { [`${label}Id`]: idRaw, [`${label}Name`]: nameRaw } = input;
  if (Number.isInteger(idRaw)) return idRaw;
  if (typeof idRaw === "string" && /^\d+$/.test(idRaw)) return parseInt(idRaw, 10);
  if (nameRaw) {
    const team = await Team.findOne({ teamName: nameRaw.trim() }).lean();
    if (!team) throw Object.assign(new Error(`Team not found by ${label}Name`), { status: 400 });
    return team.id; // numeric pk from Team
  }
  throw Object.assign(new Error(`${label}Id or ${label}Name is required`), { status: 400 });
}

/**
 * ---- Helpers to enrich match doc(s) with names for response ----
 * DB stores only IDs; response also includes tournamentName, team1Name, team2Name.
 */
function toPlain(doc) {
  return doc?.toObject ? doc.toObject() : doc;
}

async function enrichMatchDoc(doc) {
  if (!doc) return doc;
  const m = toPlain(doc);

  const [t, t1, t2] = await Promise.all([
    Tournament.findOne({ id: m.tournamentId }, { id: 1, name: 1 }).lean(),
    Team.findOne({ id: m.team1Id }, { id: 1, teamName: 1 }).lean(),
    Team.findOne({ id: m.team2Id }, { id: 1, teamName: 1 }).lean(),
  ]);

  return {
    ...m,
    tournamentName: t?.name || null,
    team1Name: t1?.teamName || null,
    team2Name: t2?.teamName || null,
  };
}

async function enrichMatchList(docs) {
  const list = docs.map(toPlain);
  if (!list.length) return [];

  const tIds = [...new Set(list.map(d => d.tournamentId))];
  const teamIds = [...new Set(list.flatMap(d => [d.team1Id, d.team2Id]))];

  const [tournaments, teams] = await Promise.all([
    Tournament.find({ id: { $in: tIds } }, { id: 1, name: 1 }).lean(),
    Team.find({ id: { $in: teamIds } }, { id: 1, teamName: 1 }).lean(),
  ]);

  const tMap = new Map(tournaments.map(t => [t.id, t.name]));
  const teamMap = new Map(teams.map(tm => [tm.id, tm.teamName]));

  return list.map(d => ({
    ...d,
    tournamentName: tMap.get(d.tournamentId) ?? null,
    team1Name: teamMap.get(d.team1Id) ?? null,
    team2Name: teamMap.get(d.team2Id) ?? null,
  }));
}

/** -------------------- CREATE -------------------- */
export const createMatch = async (req, res, next) => {
  try {
    const {
      tournamentId, tournamentName,
      team1Id, team1Name,
      team2Id, team2Name,
      matchNumber,           // <-- NEW
      overType,              // string
      noOfOvers,
      date,
      startTime,
    } = req.body;

    // Resolve ids
    const tId  = await resolveTournamentId({ tournamentId, tournamentName });
    const t1Id = await resolveTeamIdByEither({ team1Id, team1Name }, "team1");
    const t2Id = await resolveTeamIdByEither({ team2Id, team2Name }, "team2");

    if (t1Id === t2Id) throw Object.assign(new Error("team1 and team2 cannot be the same"), { status: 400 });

    // ---- validate matchNumber (manual) ----
    if (matchNumber == null || isNaN(Number(matchNumber))) {
      throw Object.assign(new Error("matchNumber is required and must be a number"), { status: 400 });
    }

    if (noOfOvers == null || isNaN(Number(noOfOvers))) {
      throw Object.assign(new Error("noOfOvers is required and must be a number"), { status: 400 });
    }
    if (!date) {
      throw Object.assign(new Error("date is required (YYYY-MM-DD)"), { status: 400 });
    }
    if (!startTime || !/^\d{2}:\d{2}$/.test(startTime)) {
      throw Object.assign(new Error("startTime must be HH:mm"), { status: 400 });
    }

    const payload = {
      tournamentId: tId,
      team1Id: t1Id,
      team2Id: t2Id,
      matchNumber: Number(matchNumber),                  // <-- NEW
      overType: overType != null ? String(overType).trim() : null,
      noOfOvers: Number(noOfOvers),
      date,
      startTime,
    };

    const m = await Match.create(payload);
    const enriched = await enrichMatchDoc(m);
    res.status(201).json(enriched);
  } catch (e) {
    next(e);
  }
};


/** -------------------- LIST (optional filters: tournamentId, teamId) -------------------- */
export const listMatches = async (req, res, next) => {
  try {
    const { tournamentId, teamId } = req.query;
    const filter = {};
    if (tournamentId && /^\d+$/.test(tournamentId)) filter.tournamentId = parseInt(tournamentId, 10);
    if (teamId && /^\d+$/.test(teamId)) {
      const n = parseInt(teamId, 10);
      filter.$or = [{ team1Id: n }, { team2Id: n }];
    }

    const list = await Match.find(filter).sort({ createdAt: -1 });
    const enriched = await enrichMatchList(list);
    res.json(enriched);
  } catch (e) {
    next(e);
  }
};

/** -------------------- GET by numeric id -------------------- */
export const getMatch = async (req, res, next) => {
  try {
    const numId = parseInt(req.params.id, 10);
    if (Number.isNaN(numId)) return res.status(400).json({ message: "id must be a number" });

    const m = await Match.findOne({ id: numId });
    if (!m) return res.status(404).json({ message: "Match not found" });

    const enriched = await enrichMatchDoc(m);
    res.json(enriched);
  } catch (e) {
    next(e);
  }
};

/** -------------------- UPDATE by numeric id -------------------- */
export const updateMatch = async (req, res, next) => {
  try {
    const numId = parseInt(req.params.id, 10);
    if (Number.isNaN(numId)) return res.status(400).json({ message: "id must be a number" });

    const update = {};
    const body = req.body || {};

    // (tournament/team resolution stays the same)

    // matchNumber (manual)
    if (body.matchNumber != null) {
      if (isNaN(Number(body.matchNumber))) {
        throw Object.assign(new Error("matchNumber must be a number"), { status: 400 });
      }
      update.matchNumber = Number(body.matchNumber);
    }

    // overType / noOfOvers / date / startTime (unchanged)
    if (body.overType != null) update.overType = String(body.overType).trim();
    if (body.noOfOvers != null) {
      if (isNaN(Number(body.noOfOvers))) throw Object.assign(new Error("noOfOvers must be a number"), { status: 400 });
      update.noOfOvers = Number(body.noOfOvers);
    }
    if (body.date != null) update.date = body.date;
    if (body.startTime != null) {
      if (!/^\d{2}:\d{2}$/.test(body.startTime)) throw Object.assign(new Error("startTime must be HH:mm"), { status: 400 });
      update.startTime = body.startTime;
    }

    const m = await Match.findOneAndUpdate({ id: numId }, update, { new: true });
    if (!m) return res.status(404).json({ message: "Match not found" });

    const enriched = await enrichMatchDoc(m);
    res.json(enriched);
  } catch (e) {
    next(e);
  }
};


/** -------------------- DELETE by numeric id -------------------- */
export const deleteMatch = async (req, res, next) => {
  try {
    const numId = parseInt(req.params.id, 10);
    if (Number.isNaN(numId)) return res.status(400).json({ message: "id must be a number" });
    const m = await Match.findOneAndDelete({ id: numId });
    if (!m) return res.status(404).json({ message: "Match not found" });
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
};
