// backend/controllers/matchController.js
import Match from "../models/Match.js";
import Team from "../models/Team.js";
import Tournament from "../models/Tournament.js";

/** ---------- Utilities ---------- */
function toPlain(doc) {
  return doc?.toObject ? doc.toObject() : doc;
}

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

/** ---------- Resolve IDs from either ids or names ---------- */
async function resolveTournamentId({ tournamentId, tournamentName }) {
  if (Number.isInteger(tournamentId)) return tournamentId;
  if (typeof tournamentId === "string" && /^\d+$/.test(tournamentId))
    return parseInt(tournamentId, 10);
  if (tournamentName) {
    const t = await Tournament.findOne({ name: tournamentName.trim() }).lean();
    if (!t)
      throw Object.assign(new Error("Tournament not found by name"), {
        status: 400,
      });
    return t.id;
  }
  throw Object.assign(new Error("tournamentId or tournamentName is required"), {
    status: 400,
  });
}

async function resolveTeamIdByEither(input, label) {
  const { [`${label}Id`]: idRaw, [`${label}Name`]: nameRaw } = input;
  if (Number.isInteger(idRaw)) return idRaw;
  if (typeof idRaw === "string" && /^\d+$/.test(idRaw))
    return parseInt(idRaw, 10);
  if (nameRaw) {
    const team = await Team.findOne({ teamName: nameRaw.trim() }).lean();
    if (!team)
      throw Object.assign(new Error(`Team not found by ${label}Name`), {
        status: 400,
      });
    return team.id;
  }
  throw Object.assign(new Error(`${label}Id or ${label}Name is required`), {
    status: 400,
  });
}

/** ---------- Enrichers (names + logos for ids) ---------- */
async function enrichMatchDoc(doc) {
  if (!doc) return doc;
  const m = toPlain(doc);

  const [t, t1, t2] = await Promise.all([
    Tournament.findOne(
      { id: m.tournamentId },
      { id: 1, name: 1, logo: 1, place: 1 } // ✅ include place
    ).lean(),
    Team.findOne({ id: m.team1Id }, { id: 1, teamName: 1, logo: 1 }).lean(),
    Team.findOne({ id: m.team2Id }, { id: 1, teamName: 1, logo: 1 }).lean(),
  ]);

  return {
    ...m,
    tournamentName: t?.name || null,
    tournamentLogo: t?.logo || null,
    tournamentPlace: t?.place || null, // ✅ now works
    team1Name: t1?.teamName || null,
    team1Logo: t1?.logo || null,
    team2Name: t2?.teamName || null,
    team2Logo: t2?.logo || null,
  };
}

async function enrichMatchList(docs) {
  const list = docs.map(toPlain);
  if (!list.length) return [];

  const tIds = [...new Set(list.map((d) => d.tournamentId))];
  const teamIds = [...new Set(list.flatMap((d) => [d.team1Id, d.team2Id]))];

  const [tournaments, teams] = await Promise.all([
    Tournament.find(
      { id: { $in: tIds } },
      { id: 1, name: 1, logo: 1, place: 1 } // ✅ include place
    ).lean(),
    Team.find({ id: { $in: teamIds } }, { id: 1, teamName: 1, logo: 1 }).lean(),
  ]);

  const tMap = new Map(
    tournaments.map((t) => [
      t.id,
      { name: t.name, logo: t.logo, place: t.place },
    ])
  );
  const teamMap = new Map(
    teams.map((tm) => [tm.id, { name: tm.teamName, logo: tm.logo }])
  );

  return list.map((d) => ({
    ...d,
    tournamentName: tMap.get(d.tournamentId)?.name ?? null,
    tournamentLogo: tMap.get(d.tournamentId)?.logo ?? null,
    tournamentPlace: tMap.get(d.tournamentId)?.place ?? null, // ✅ now included
    team1Name: teamMap.get(d.team1Id)?.name ?? null,
    team1Logo: teamMap.get(d.team1Id)?.logo ?? null,
    team2Name: teamMap.get(d.team2Id)?.name ?? null,
    team2Logo: teamMap.get(d.team2Id)?.logo ?? null,
  }));
}

/** -------------------- CREATE -------------------- */
export const createMatch = async (req, res, next) => {
  try {
    const {
      tournamentId,
      tournamentName,
      team1Id,
      team1Name,
      team2Id,
      team2Name,
      matchNumber,
      overType,
      noOfOvers,
      date,
      startTime,
      IsCountWideBall,
      IsCountNoBall,
    } = req.body;

    const tId = await resolveTournamentId({ tournamentId, tournamentName });
    const t1Id = await resolveTeamIdByEither({ team1Id, team1Name }, "team1");
    const t2Id = await resolveTeamIdByEither({ team2Id, team2Name }, "team2");

    if (t1Id === t2Id) {
      throw Object.assign(new Error("team1 and team2 cannot be the same"), {
        status: 400,
      });
    }

    if (matchNumber == null || isNaN(Number(matchNumber))) {
      throw Object.assign(
        new Error("matchNumber is required and must be a number"),
        { status: 400 }
      );
    }
    if (overType == null || isNaN(Number(overType))) {
      throw Object.assign(
        new Error("overType is required and must be a number"),
        { status: 400 }
      );
    }
    if (noOfOvers == null || isNaN(Number(noOfOvers))) {
      throw Object.assign(
        new Error("noOfOvers is required and must be a number"),
        { status: 400 }
      );
    }
    if (!date) {
      throw Object.assign(new Error("date is required (YYYY-MM-DD)"), {
        status: 400,
      });
    }
    if (!startTime || !/^\d{2}:\d{2}$/.test(startTime)) {
      throw Object.assign(new Error("startTime must be HH:mm"), {
        status: 400,
      });
    }

    const payload = {
      tournamentId: tId,
      team1Id: t1Id,
      team2Id: t2Id,
      matchNumber: Number(matchNumber),
      overType: Number(overType),
      noOfOvers: Number(noOfOvers),
      IsCountWideBall: parseBoolLoose(IsCountWideBall, false),
      IsCountNoBall: parseBoolLoose(IsCountNoBall, false),
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

/** -------------------- LIST -------------------- */
export const listMatches = async (req, res, next) => {
  try {
    const { tournamentId, teamId } = req.query;
    const filter = {};
    if (tournamentId && /^\d+$/.test(tournamentId))
      filter.tournamentId = parseInt(tournamentId, 10);
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

/** -------------------- GET -------------------- */
export const getMatch = async (req, res, next) => {
  try {
    const numId = parseInt(req.params.id, 10);
    if (Number.isNaN(numId))
      return res.status(400).json({ message: "id must be a number" });

    const m = await Match.findOne({ id: numId });
    if (!m) return res.status(404).json({ message: "Match not found" });

    const enriched = await enrichMatchDoc(m);
    res.json(enriched);
  } catch (e) {
    next(e);
  }
};

/** -------------------- UPDATE -------------------- */
export const updateMatch = async (req, res, next) => {
  try {
    const numId = parseInt(req.params.id, 10);
    if (Number.isNaN(numId))
      return res.status(400).json({ message: "id must be a number" });

    const body = req.body || {};
    const update = {};

    if (body.tournamentId != null || body.tournamentName) {
      update.tournamentId = await resolveTournamentId({
        tournamentId: body.tournamentId,
        tournamentName: body.tournamentName,
      });
    }
    if (body.team1Id != null || body.team1Name) {
      update.team1Id = await resolveTeamIdByEither(body, "team1");
    }
    if (body.team2Id != null || body.team2Name) {
      update.team2Id = await resolveTeamIdByEither(body, "team2");
    }
    if (
      update.team1Id != null &&
      update.team2Id != null &&
      update.team1Id === update.team2Id
    ) {
      throw Object.assign(new Error("team1 and team2 cannot be the same"), {
        status: 400,
      });
    }

    if (body.matchNumber != null) {
      if (isNaN(Number(body.matchNumber))) {
        throw Object.assign(new Error("matchNumber must be a number"), {
          status: 400,
        });
      }
      update.matchNumber = Number(body.matchNumber);
    }
    if (body.overType != null) {
      if (isNaN(Number(body.overType))) {
        throw Object.assign(new Error("overType must be a number"), {
          status: 400,
        });
      }
      update.overType = Number(body.overType);
    }
    if (body.noOfOvers != null) {
      if (isNaN(Number(body.noOfOvers))) {
        throw Object.assign(new Error("noOfOvers must be a number"), {
          status: 400,
        });
      }
      update.noOfOvers = Number(body.noOfOvers);
    }
    if (body.date != null) update.date = body.date;
    if (body.startTime != null) {
      if (!/^\d{2}:\d{2}$/.test(body.startTime)) {
        throw Object.assign(new Error("startTime must be HH:mm"), {
          status: 400,
        });
      }
      update.startTime = body.startTime;
    }
    if (body.IsCountWideBall != null) {
      update.IsCountWideBall = parseBoolLoose(body.IsCountWideBall, false);
    }
    if (body.IsCountNoBall != null) {
      update.IsCountNoBall = parseBoolLoose(body.IsCountNoBall, false);
    }

    const m = await Match.findOneAndUpdate({ id: numId }, update, {
      new: true,
    });
    if (!m) return res.status(404).json({ message: "Match not found" });

    const enriched = await enrichMatchDoc(m);
    res.json(enriched);
  } catch (e) {
    next(e);
  }
};

/** -------------------- DELETE -------------------- */
export const deleteMatch = async (req, res, next) => {
  try {
    const numId = parseInt(req.params.id, 10);
    if (Number.isNaN(numId))
      return res.status(400).json({ message: "id must be a number" });
    const m = await Match.findOneAndDelete({ id: numId });
    if (!m) return res.status(404).json({ message: "Match not found" });
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
};
