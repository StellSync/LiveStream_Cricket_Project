// frontend/src/pages/ScoreDashboard.jsx
import { useEffect, useMemo, useState } from "react";
import {
  Box,
  Grid,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Button,
  Radio,
  RadioGroup,
  FormControlLabel,
  Checkbox,
  Typography,
  Paper,
  Table,
  TableHead,
  TableBody,
  TableCell,
  TableRow,
  TextField,
  Divider,
  Chip,
  Stack,
  AppBar,
  Toolbar,
  Tooltip,
  Card,
  CardHeader,
  CardContent,
  Container,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormGroup,
  FormHelperText,
  Fab   // ✅ add this line
} from "@mui/material";


import AddIcon from "@mui/icons-material/Add";

import {
  getMatches,
  getPlayers,
  getTournament,
  setCurrentMatch,
  getCurrentMatch,
  getTeams,
  createPlayer ,

} from "../lib/api";

export default function ScoreDashboard() {
  // ---- Master data ----
  const [matches, setMatches] = useState([]);
  const [currentMatchId, setCurrentMatchId] = useState("");
  const [currentMatchDetails, setCurrentMatchState] = useState(null);

  // Teams for the selected match (store as NUMBER)
  const [battingTeamId, setBattingTeamId] = useState(null);
  const [bowlingTeamId, setBowlingTeamId] = useState(null);

  // Players for selected teams
  const [batters, setBatters] = useState([]);
  const [bowlers, setBowlers] = useState([]);

  // Selections
  const [batsman1, setBatsman1] = useState("");
  const [batsman2, setBatsman2] = useState("");
  const [bowler, setBowler] = useState("");
  const [onStrike, setOnStrike] = useState("batsman1");

  // Read-only info
  const [ground, setGround] = useState("");
  const [overType, setOverType] = useState("");
  const [noOfOvers, setNoOfOvers] = useState("");

  // Score states
  const [inningsRuns, setInningsRuns] = useState(0);
  const [inningsWickets, setInningsWickets] = useState(0);
  const [overs, setOvers] = useState(0);
  const [balls, setBalls] = useState(0);
  const [currentOverRuns, setCurrentOverRuns] = useState(0);
  const [batsman1Runs, setBatsman1Runs] = useState(0);
  const [batsman1Balls, setBatsman1Balls] = useState(0);
  const [batsman2Runs, setBatsman2Runs] = useState(0);
  const [batsman2Balls, setBatsman2Balls] = useState(0);
  const [bowlerOvers, setBowlerOvers] = useState(0);
  const [bowlerMaidens, setBowlerMaidens] = useState(0);
  const [bowlerRuns, setBowlerRuns] = useState(0);
  const [bowlerWickets, setBowlerWickets] = useState(0);


  


// --- Player Registration Dialog state ---
const [addOpen, setAddOpen] = useState(false);
const [teams, setTeams] = useState([]);

const emptyPlayerForm = {
  teamId: "",
  playerName: "",
  playerAddress: "",
  phone: "",
  position: "", // keep as string
  isBatter: false,
  isBaller: false,
  isWk: false,
  isCaptain: false,
};
const [playerForm, setPlayerForm] = useState(emptyPlayerForm);
const [formErrors, setFormErrors] = useState({});


useEffect(() => {
  (async () => {
    try {
      const res = await getTeams();
      setTeams(res?.data || []);
    } catch (e) {
      console.warn("Failed to load teams", e);
      setTeams([]);
    }
  })();
}, []);



async function reloadBatters() {
  if (battingTeamId == null) return;
  try {
    const { data } = await getPlayers(battingTeamId);
    const list = Array.isArray(data) ? data : [];
    const byTeam = list.filter((p) => getPlayerTeamId(p) === Number(battingTeamId));
    const onlyBatters = byTeam.filter(isPlayerBatter);
    setBatters(onlyBatters.length ? onlyBatters : byTeam);
  } catch (e) {
    console.warn("Failed to reload batters", e);
  }
}

async function reloadBowlers() {
  if (bowlingTeamId == null) return;
  try {
    const { data } = await getPlayers(bowlingTeamId);
    const list = Array.isArray(data) ? data : [];
    const byTeam = list.filter((p) => getPlayerTeamId(p) === Number(bowlingTeamId));
    const onlyBowlers = byTeam.filter(isPlayerBowler);
    setBowlers(onlyBowlers.length ? onlyBowlers : byTeam);
  } catch (e) {
    console.warn("Failed to reload bowlers", e);
  }
}

function validatePlayer(values) {
  const e = {};

  if (!values.teamId) e.teamId = "Please select a team.";

  const name = (values.playerName || "").trim();
  if (!name) e.playerName = "Player name is required.";
  else if (name.length < 2) e.playerName = "Name must be at least 2 characters.";

  // position: required int 0..11
  const raw = values.position;
  if (raw === "" || raw === null || raw === undefined) {
    e.position = "Position is required.";
  } else {
    const num = Number(raw);
    if (!Number.isInteger(num)) e.position = "Position must be an integer.";
    else if (num < 0 || num > 11) e.position = "Position must be 0–11.";
  }

  if (!values.isBatter && !values.isBaller && !values.isWk) {
    e.roles = "Select at least one role.";
  }

  return e;
}

function onPlayerField(e) {
  const { name, value, type, checked } = e.target;
  const next = {
    ...playerForm,
    [name]: type === "checkbox" ? checked : value,
  };
  setPlayerForm(next);

  // live-validate the changed field
  const fresh = validatePlayer(next);
  setFormErrors((prev) => ({
    ...prev,
    [name]: fresh[name],
    ...(name.startsWith("is") ? { roles: fresh.roles } : {}),
  }));
}

async function onCreatePlayer(e) {
  e.preventDefault();

  const errs = validatePlayer(playerForm);
  setFormErrors(errs);
  if (Object.keys(errs).length > 0) return;

  const payload = {
    ...playerForm,
    teamId: Number(playerForm.teamId),
    position: Number(playerForm.position),
  };

  try {
    await createPlayer(payload);

    // refresh whichever list(s) needed
    if (payload.teamId === Number(battingTeamId)) {
      await reloadBatters();
    }
    if (payload.teamId === Number(bowlingTeamId)) {
      await reloadBowlers();
    }

    // clear + close
    setPlayerForm(emptyPlayerForm);
    setFormErrors({});
    setAddOpen(false);
  } catch (err) {
    console.warn("Create player failed:", err);
  }
}





  // Balling card
  const [overBallHistory, setOverBallHistory] = useState([]);

  // Lock scoring when an over completes until bowler changes
  const [scoringLocked, setScoringLocked] = useState(false);

  // Track dismissed batters so they don't appear again in dropdowns
  const [dismissedBatterIds, setDismissedBatterIds] = useState([]);

  useEffect(() => {
    // load existing active match when page loads
    getCurrentMatch().then((data) => setCurrentMatchState(data));
  }, []);

  const handleSelectMatch = (match) => {
    const matchInfo = {
      matchId: match.id,
      tournamentName: match.tournamentName,
      tournamentLogo: match.tournamentLogo || match.tournament?.logo || "",
      ground: match.tournamentPlace,
      team1: match.team1Name,
      team1Logo: match.team1Logo || "",
      team2: match.team2Name,
      team2Logo: match.team2Logo || "",
      matchNumber: match.matchNumber,
      overType: match.overType,
      noOfOvers: match.noOfOvers,
    };

    setCurrentMatch(matchInfo);
    setCurrentMatchState(matchInfo);
  };

  // ---- Load matches on mount (ONLY today's matches, in local time) ----
  useEffect(() => {
    const parseMatchDate = (val) => {
      if (!val) return null;
      if (/^\d{4}-\d{2}-\d{2}$/.test(val)) {
        const [y, m, d] = val.split("-").map(Number);
        return new Date(y, m - 1, d);
      }
      const t = Date.parse(val);
      return Number.isNaN(t) ? null : new Date(t);
    };

    (async () => {
      try {
        const { data } = await getMatches();

        const now = new Date();
        const startOfToday = new Date(
          now.getFullYear(),
          now.getMonth(),
          now.getDate(),
          0,
          0,
          0,
          0
        );
        const startOfTomorrow = new Date(
          now.getFullYear(),
          now.getMonth(),
          now.getDate() + 1,
          0,
          0,
          0,
          0
        );

        const todaysMatches = (data || []).filter((m) => {
          const dt = parseMatchDate(
            m.date || m.matchDate || m.startTime || m.scheduledAt
          );
          return dt && dt >= startOfToday && dt < startOfTomorrow;
        });

        setMatches(todaysMatches);
      } catch (e) {
        console.error("Failed to load matches", e);
        setMatches([]);
      }
    })();
  }, []);

  const currentMatch = useMemo(
    () => matches.find((m) => String(m.id) === String(currentMatchId)) || null,
    [matches, currentMatchId]
  );

  useEffect(() => {
    // reset selections
    setBattingTeamId(null);
    setBowlingTeamId(null);
    setBatters([]);
    setBowlers([]);
    setBatsman1("");
    setBatsman2("");
    setBowler("");
    setOnStrike("batsman1");

    // reset readonly
    setGround("");
    setOverType("");
    setNoOfOvers("");

    // reset scores
    setInningsRuns(0);
    setInningsWickets(0);
    setOvers(0);
    setBalls(0);
    setCurrentOverRuns(0);
    setBatsman1Runs(0);
    setBatsman1Balls(0);
    setBatsman2Runs(0);
    setBatsman2Balls(0);
    setBowlerOvers(0);
    setBowlerMaidens(0);
    setBowlerRuns(0);
    setBowlerWickets(0);

    setScoringLocked(false);
    setDismissedBatterIds([]);

    (async () => {
      if (!currentMatch) return;

      setOverType(currentMatch.overType ?? "6");
      setNoOfOvers(
        currentMatch.noOfOvers != null && currentMatch.noOfOvers !== ""
          ? String(currentMatch.noOfOvers)
          : ""
      );

      const fromMatch =
        currentMatch.ground ??
        currentMatch.venue ??
        currentMatch.place ??
        currentMatch.stadium ??
        "";
      if (String(fromMatch || "").trim()) {
        setGround(String(fromMatch));
        return;
      }

      const tournamentId =
        currentMatch.tournamentId ??
        currentMatch.tournamentID ??
        currentMatch.tourId ??
        null;

      if (tournamentId != null && typeof getTournament === "function") {
        try {
          const { data } = await getTournament(Number(tournamentId));
          const g = data?.place ?? "";
          if (String(g || "").trim()) setGround(String(g));
        } catch (err) {
          console.warn("Unable to fetch tournament for ground:", err);
        }
      }
    })();
  }, [currentMatchId]); // eslint-disable-line

  useEffect(() => {
    setBatsman1Runs(0);
    setBatsman1Balls(0);
  }, [batsman1]);

  useEffect(() => {
    setBatsman2Runs(0);
    setBatsman2Balls(0);
  }, [batsman2]);

  useEffect(() => {
    // bowler changed -> unlock scoring for next over
    setBowlerOvers(0);
    setBowlerMaidens(0);
    setBowlerRuns(0);
    setBowlerWickets(0);
    setCurrentOverRuns(0);
    setBalls(0);
    setScoringLocked(false);

    // clear last over's ball history now that new bowler is set
    setOverBallHistory([]);
  }, [bowler]);

  useEffect(() => {
    setInningsRuns(0);
    setInningsWickets(0);
    setOvers(0);
    setBalls(0);
    setCurrentOverRuns(0);
    setBatsman1Runs(0);
    setBatsman1Balls(0);
    setBatsman2Runs(0);
    setBatsman2Balls(0);
    setBowlerOvers(0);
    setBowlerMaidens(0);
    setBowlerRuns(0);
    setBowlerWickets(0);
    setScoringLocked(false);
    setDismissedBatterIds([]);
  }, [battingTeamId]);

  const normalizeBool = (v) =>
    v === true || v === "true" || v === 1 || v === "1";

  const isPlayerBatter = (p) =>
    normalizeBool(p.isBatter ?? p.Isbatter ?? p.isBatsman) ||
    normalizeBool(p.isWK ?? p.IsWk);

  const isPlayerBowler = (p) => normalizeBool(p.isBowler ?? p.Isballer);

  const getPlayerTeamId = (p) =>
    Number(p.teamId ?? p.teamid ?? p.teamID ?? p.team);

  const getPlayerName = (p) =>
    p.playerName ?? p.playername ?? p.name ?? `Player #${p.id}`;

  useEffect(() => {
    (async () => {
      if (battingTeamId == null) {
        setBatters([]);
        setBatsman1("");
        setBatsman2("");
        return;
      }
      try {
        const { data } = await getPlayers(battingTeamId);
        const list = Array.isArray(data) ? data : [];
        const byTeam = list.filter(
          (p) => getPlayerTeamId(p) === Number(battingTeamId)
        );
        const onlyBatters = byTeam.filter(isPlayerBatter);
        const finalList = onlyBatters.length ? onlyBatters : byTeam;

        setBatters(finalList);

        setBatsman1((prev) =>
          finalList.some((p) => String(p.id) === String(prev)) ? prev : ""
        );
        setBatsman2((prev) =>
          finalList.some((p) => String(p.id) === String(prev)) ? prev : ""
        );
      } catch (e) {
        console.error("Failed to load batting team players", e);
        setBatters([]);
      }
    })();
  }, [battingTeamId]); // eslint-disable-line

  useEffect(() => {
    (async () => {
      if (bowlingTeamId == null) {
        setBowlers([]);
        setBowler("");
        return;
      }
      try {
        const { data } = await getPlayers(bowlingTeamId);
        const list = Array.isArray(data) ? data : [];
        const byTeam = list.filter(
          (p) => getPlayerTeamId(p) === Number(bowlingTeamId)
        );
        const onlyBowlers = byTeam.filter(isPlayerBowler);
        const finalList = onlyBowlers.length ? onlyBowlers : byTeam;

        setBowlers(finalList);

        setBowler((prev) =>
          finalList.some((p) => String(p.id) === String(prev)) ? prev : ""
        );
      } catch (e) {
        console.error("Failed to load bowling team players", e);
        setBowlers([]);
      }
    })();
  }, [bowlingTeamId]); // eslint-disable-line

  const getMatchNumber = (m) =>
    m.matchNumber ?? m.match_no ?? m.matchNo ?? m.number ?? m.no ?? null;

  const matchLabel = (m) => {
    const num = getMatchNumber(m);
    return `Match #${num ?? m.id} — ${
      m.tournamentName || `#${m.tournamentId}`
    } — ${m.team1Name || `#${m.team1Id}`} vs ${m.team2Name || `#${m.team2Id}`}`;
  };

  const team1Name =
    currentMatch?.team1Name || `#${currentMatch?.team1Id ?? ""}`;
  const team2Name =
    currentMatch?.team2Name || `#${currentMatch?.team2Id ?? ""}`;
  const team1Id = currentMatch ? Number(currentMatch.team1Id) : null;
  const team2Id = currentMatch ? Number(currentMatch.team2Id) : null;

  // Derived team info
  const battingTeamName = battingTeamId === team1Id ? team1Name : team2Name;
  const bowlingTeamName = bowlingTeamId === team1Id ? team1Name : team2Name;
  const battingTeamLogo =
    battingTeamId === team1Id
      ? currentMatch?.team1Logo
      : currentMatch?.team2Logo;
  const bowlingTeamLogo =
    bowlingTeamId === team1Id
      ? currentMatch?.team1Logo
      : currentMatch?.team2Logo;
  const battingTeamCode = (battingTeamName || "").substring(0, 3).toUpperCase();
  const bowlingTeamCode = (bowlingTeamName || "").substring(0, 3).toUpperCase();

  // Derived player info
  const batsman1Obj = batters.find((p) => String(p.id) === batsman1);
  const batsman1Name = batsman1Obj ? getPlayerName(batsman1Obj) : "";
  const batsman2Obj = batters.find((p) => String(p.id) === batsman2);
  const batsman2Name = batsman2Obj ? getPlayerName(batsman2Obj) : "";
  const bowlerObj = bowlers.find((p) => String(p.id) === bowler);
  const bowlerName = bowlerObj ? getPlayerName(bowlerObj) : "";

  const strikerName = onStrike === "batsman1" ? batsman1Name : batsman2Name;
  const nonStrikerName = onStrike === "batsman1" ? batsman2Name : batsman1Name;
  const strikerRuns = onStrike === "batsman1" ? batsman1Runs : batsman2Runs;
  const strikerBalls = onStrike === "batsman1" ? batsman1Balls : batsman2Balls;
  const nonStrikerRuns = onStrike === "batsman1" ? batsman2Runs : batsman1Runs;
  const nonStrikerBalls =
    onStrike === "batsman1" ? batsman2Balls : batsman1Balls;

  // Build a fixed-size 3x3 grid (9 cells)
  const makeGrid = (items, total = 9) => {
    const padded = [...items].slice(0, total);
    while (padded.length < total) padded.push("");
    return padded;
  };

  // 3x3 button sets
  const runButtons = makeGrid(["0", "1", "2", "3", "4", "5", "6", "7"]);
  const wideButtons = makeGrid(["0", "1", "2", "3", "4", "5", "6", "7", "-"]);
  const noBallButtons = makeGrid(["0", "1", "2", "3", "4", "5", "6", "7", "-"]);
  const byesButtons = makeGrid(["0", "1", "2", "3", "4", "5", "6", "7", "-"]);

  const ballsPerOver = Number(overType || 6);

  // Filtered dropdown options
  const availableForBatsman1 = useMemo(
    () =>
      batters.filter(
        (p) =>
          String(p.id) !== String(batsman2) &&
          !dismissedBatterIds.includes(String(p.id))
      ),
    [batters, batsman2, dismissedBatterIds]
  );

  const availableForBatsman2 = useMemo(
    () =>
      batters.filter(
        (p) =>
          String(p.id) !== String(batsman1) &&
          !dismissedBatterIds.includes(String(p.id))
      ),
    [batters, batsman1, dismissedBatterIds]
  );

  // Ensure two dropdowns never end up with same player
  useEffect(() => {
    if (batsman1 && batsman2 && String(batsman1) === String(batsman2)) {
      setBatsman2("");
    }
  }, [batsman1, batsman2]);
  useEffect(() => {
    if (batsman1 && batsman2 && String(batsman1) === String(batsman2)) {
      setBatsman1("");
    }
  }, [batsman2, batsman1]);

  // Helper to finish a legal ball and lock if over finished
  const finishBallAndCheckOver = (addedRunsForMaidens = 0) => {
    setBalls((prev) => {
      const newBalls = prev + 1;
      if (newBalls === ballsPerOver) {
        // maiden if over had no runs this over (bat or byes)
        if (currentOverRuns + addedRunsForMaidens === 0) {
          setBowlerMaidens((m) => m + 1);
        }
        setBowlerOvers((o) => o + 1);
        setOvers((o) => o + 1);
        setCurrentOverRuns(0);
        setScoringLocked(true); // Lock scoring until bowler is changed
        return 0;
      }
      return newBalls;
    });
  };

  const handleScore = (title, value) => {
    if (value === "-") return;
    if (scoringLocked) return; // guard if UI didn't already prevent it

    const runs = Number(value);
    const ballsPerOver = Number(overType || 6);

    const setStrikerRunsFn =
      onStrike === "batsman1" ? setBatsman1Runs : setBatsman2Runs;
    const setStrikerBallsFn =
      onStrike === "batsman1" ? setBatsman1Balls : setBatsman2Balls;

    const strikerId = onStrike === "batsman1" ? batsman1 : batsman2;

    // inside handleScore, replace updateBallsAndOver with this:
    const updateBallsAndOver = (maidensRunsThisBall = 0) => {
      setBalls((prevBalls) => {
        const newBalls = prevBalls + 1;

        if (newBalls === ballsPerOver) {
          // Over completed on this legal delivery
          if (currentOverRuns + maidensRunsThisBall === 0) {
            setBowlerMaidens((m) => m + 1);
          }
          setBowlerOvers((o) => o + 1);
          setOvers((o) => o + 1);

          // keep the overBallHistory visible (DO NOT reset here)
          setCurrentOverRuns(0);
          setScoringLocked(true); // lock until bowler changes
          return 0; // .0 balls of next over
        }

        return newBalls;
      });
    };

    if (!isNaN(runs)) {
      if (title === "Normal Runs") {
        // Normal runs: add to batsman, bowler, team; ball counts
        setStrikerRunsFn((prev) => prev + runs);
        setStrikerBallsFn((prev) => prev + 1);
        setInningsRuns((prev) => prev + runs);
        setBowlerRuns((prev) => prev + runs);
        setCurrentOverRuns((prev) => prev + runs);

        // Log this legal ball in the current over
        setOverBallHistory((prev) => [...prev, String(runs)]);

        // Close over if needed (LOCK only)
        updateBallsAndOver(runs);

        // Swap strike on odd runs
        if (runs % 2 === 1) {
          setOnStrike(onStrike === "batsman1" ? "batsman2" : "batsman1");
        }
      } else if (title === "Wides") {
        // Wides: team only (+1 base wide plus extra wides), NO ball
        setInningsRuns((prev) => prev + runs + 1);
        setOverBallHistory((prev) => [...prev, `Wd${runs}`]);
        if ((runs + 1) % 2 === 1) {
          setOnStrike(onStrike === "batsman1" ? "batsman2" : "batsman1");
        }
      } else if (title === "No Balls") {
        // No-balls: team +1 and (optional bat runs), NO ball
        setInningsRuns((prev) => prev + runs + 1);
        setBowlerRuns((prev) => prev + runs);
        if (runs > 0) setStrikerRunsFn((prev) => prev + runs);
        setOverBallHistory((prev) => [...prev, `Nb${runs}`]);
        if ((runs + 1) % 2 === 1) {
          setOnStrike(onStrike === "batsman1" ? "batsman2" : "batsman1");
        }
      } else if (title === "Byes") {
        // Byes: team only, ball counts; rotate strike on odd byes
        setInningsRuns((prev) => prev + runs);
        setCurrentOverRuns((prev) => prev + runs);
        setStrikerBallsFn((prev) => prev + 1);
        setOverBallHistory((prev) => [...prev, `B${runs}`]);

        // Close over if needed (LOCK only)
        updateBallsAndOver(runs);

        if (runs % 2 === 1) {
          setOnStrike(onStrike === "batsman1" ? "batsman2" : "batsman1");
        }
      }
    } else if (value === "W" && title === "Normal Runs") {
      // Wicket on a legal delivery
      setInningsWickets((prev) => prev + 1);
      setBowlerWickets((prev) => prev + 1);
      setStrikerBallsFn((prev) => prev + 1);

      // Log wicket in current over
      setOverBallHistory((prev) => [...prev, "W"]);

      // Mark striker dismissed and remove from dropdowns
      if (strikerId) {
        setDismissedBatterIds((prev) => {
          const next = new Set(prev.map(String));
          next.add(String(strikerId));
          return Array.from(next);
        });
      }
      if (onStrike === "batsman1") {
        setBatsman1("");
        setOnStrike("batsman2");
      } else {
        setBatsman2("");
        setOnStrike("batsman1");
      }

      // Close over if needed (LOCK only)
      updateBallsAndOver(0);
    }
  };

  

// Run-out handler: ball counts, batter out, no bowler wicket or runs
const handleRunOut = (who /* 'batsman1' | 'batsman2' */) => {
  if (scoringLocked) return;
 
  const outId = who === "batsman1" ? batsman1 : batsman2;
  if (!outId) return;
 
  // Ball counts to the striker on a legal delivery
  if (onStrike === "batsman1") {
    setBatsman1Balls((b) => b + 1);
  } else {
    setBatsman2Balls((b) => b + 1);
  }
 
  // Team wicket + history (no change to bowler wickets or runs)
  setInningsWickets((w) => w + 1);
  setOverBallHistory((prev) => [...prev, "RO"]);
 
  // Mark dismissed so they don't appear again
  setDismissedBatterIds((prev) => {
    const next = new Set(prev.map(String));
    next.add(String(outId));
    return Array.from(next);
  });
 
  // Clear the dismissed batter slot and adjust strike only if striker was out
  if (who === "batsman1") {
    setBatsman1("");
    if (onStrike === "batsman1") setOnStrike("batsman2");
  } else {
    setBatsman2("");
    if (onStrike === "batsman2") setOnStrike("batsman1");
  }
 
  // Legal delivery completed (no runs for maiden calc)
  finishBallAndCheckOver(0);
};


  // ---------- PUSH SCOREBAR DATA TO BACKEND FOR OBS ----------
  const postOverlay = async () => {
    try {
      if (!battingTeamId || !bowlingTeamId) return;

      const bpo = Number(overType) || 6;
      const totalOversFloat = overs + (balls / bpo || 0);
      const runRate =
        totalOversFloat > 0 ? (inningsRuns / totalOversFloat).toFixed(2) : "0.00";

      await fetch("/api/overlay", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          battingTeam: battingTeamCode,
          battingTeamLogo,
          bowlingTeam: bowlingTeamCode,
          bowlingTeamLogo,

          runs: inningsRuns,
          wickets: inningsWickets,
          overs,
          balls,
          ballsPerOver: bpo,

          runRate,

          striker: { name: strikerName, runs: strikerRuns, balls: strikerBalls },
          nonStriker: {
            name: nonStrikerName,
            runs: nonStrikerRuns,
            balls: nonStrikerBalls,
          },

          bowler: {
            name: bowlerName,
            wickets: bowlerWickets,
            overs: bowlerOvers,
            runs: bowlerRuns,
          },

          overBalls: overBallHistory, // e.g., ["1","1","Wd1","Nb0","W","4"]
        }),
      });
    } catch (err) {
      console.warn("Failed to push overlay:", err);
    }
  };

  // Push overlay whenever scoring-relevant state changes
  useEffect(() => {
    postOverlay();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    // match/team context
    battingTeamId,
    bowlingTeamId,
    battingTeamLogo,
    bowlingTeamLogo,
    battingTeamCode,
    bowlingTeamCode,
    overType,

    // inning summary
    inningsRuns,
    inningsWickets,
    overs,
    balls,

    // players / strike
    onStrike,
    strikerName,
    nonStrikerName,
    strikerRuns,
    strikerBalls,
    nonStrikerRuns,
    nonStrikerBalls,

    // bowler
    bowlerName,
    bowlerOvers,
    bowlerRuns,
    bowlerWickets,

    // current over visuals
    overBallHistory,
  ]);

  // Also push whenever match header loaded (logos/names/ground ready)
  useEffect(() => {
    postOverlay();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentMatchDetails]);

  // 3x3 scoring table
  const renderTable = (title, items) => (
    <Grid item xs={12} sm={4}>
      <Typography
        fontWeight={700}
        mb={0.75}
        variant="body2"
        color="text.secondary"
      >
        {title}
      </Typography>
      <Paper
        elevation={0}
        sx={{
          borderRadius: 2,
          overflow: "hidden",
          border: "1px solid",
          borderColor: "divider",
          bgcolor: scoringLocked ? "action.disabledBackground" : "background.paper",
        }}
      >
        <Table
          size="small"
          sx={{
            borderCollapse: "separate",
            borderSpacing: 0,
            "& td": { p: 0, borderBottom: "1px solid", borderColor: "divider" },
            "& tr:last-child td": { borderBottom: 0 },
          }}
        >
          <TableBody>
            {[0, 1, 2].map((row) => (
              <TableRow key={row}>
                {[0, 1, 2].map((col) => {
                  const index = row * 3 + col;
                  const value = items[index] || "";
                  const isDanger = title === "Normal Runs" && value === "W";
                  return (
                    <TableCell
                      key={col}
                      align="center"
                      sx={{ width: "33.3333%" }}
                    >
                      <Tooltip
                        title={
                          scoringLocked
                            ? "Over complete — change bowler to continue"
                            : value
                            ? `Add ${title.toLowerCase()} ${value}`
                            : ""
                        }
                      >
                        <span>
                          <Button
                            fullWidth
                            size="small"
                            variant="text"
                            disabled={!value || scoringLocked}
                            onClick={() => handleScore(title, value)}
                            sx={{
                              minWidth: 40,
                              minHeight: 40,
                              py: 0.5,
                              fontWeight: 700,
                              fontSize: 14,
                              borderRadius: 0,
                              color: isDanger ? "error.main" : "text.primary",
                              "&:hover": {
                                backgroundColor:
                                  value && !scoringLocked
                                    ? "action.hover"
                                    : "transparent",
                              },
                              "&.Mui-disabled": { opacity: 0.5 },
                            }}
                          >
                            {value}
                          </Button>
                        </span>
                      </Tooltip>
                    </TableCell>
                  );
                })}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Paper>
    </Grid>
  );

  const handleBattingChange = (e) => {
    const val = e.target.value === "" ? null : Number(e.target.value);
    setBattingTeamId(val);

    setBatsman1("");
    setBatsman2("");
    setBowler("");
    setOnStrike("batsman1");
    setScoringLocked(false);
    setDismissedBatterIds([]);

    if (val == null || !currentMatch) {
      setBowlingTeamId(null);
      return;
    }
    const other =
      val === Number(currentMatch.team1Id)
        ? Number(currentMatch.team2Id)
        : Number(currentMatch.team1Id);
    setBowlingTeamId(other);
  };

  const handleBowlingChange = (e) => {
    const val = e.target.value === "" ? null : Number(e.target.value);
    setBowlingTeamId(val);

    setBatsman1("");
    setBatsman2("");
    setBowler("");
    setOnStrike("batsman1");
    setScoringLocked(false);

    if (val == null || !currentMatch) {
      setBattingTeamId(null);
      return;
    }
    const other =
      val === Number(currentMatch.team1Id)
        ? Number(currentMatch.team2Id)
        : Number(currentMatch.team1Id);
    setBattingTeamId(other);
  };

  return (
    <Box
      sx={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        bgcolor: (theme) =>
          theme.palette.mode === "light"
            ? "linear-gradient(180deg, #fafafa 0%, #ffffff 100%)"
            : "background.default",
      }}
    >
      {/* Top App Bar */}
      <AppBar
        position="sticky"
        elevation={0}
        sx={{
          bgcolor: "background.paper",
          color: "text.primary",
          borderBottom: "1px solid",
          borderColor: "divider",
        }}
      >
        {/* OBS Overlay Preview */}
        <Card
          variant="outlined"
          sx={{
            borderRadius: 3,
            overflow: "hidden",
            mb: 2.5,
            borderColor: "divider",
            bgcolor: "background.paper",
          }}
        >
          <CardHeader
            titleTypographyProps={{ variant: "body2", fontWeight: 800 }}
            title="OBS Overlay Preview"
            sx={{ py: 1.25, px: 1.5 }}
          />
          <Divider />
          <CardContent sx={{ p: 2 }}>
            {currentMatchDetails ? (
              <Stack
                direction="row"
                alignItems="center"
                justifyContent="center"
                spacing={3}
              >
                {/* Tournament */}
                <Stack alignItems="center" spacing={0.5}>
                  {currentMatchDetails.tournamentLogo && (
                    <Box
                      component="img"
                      src={currentMatchDetails.tournamentLogo}
                      alt="Tournament Logo"
                      sx={{ height: 40 }}
                    />
                  )}
                  <Typography variant="body2" fontWeight={700}>
                    {currentMatchDetails.tournamentName} at{" "}
                    {currentMatchDetails.ground}
                  </Typography>
                </Stack>

                <Divider orientation="vertical" flexItem />

                {/* Team 1 */}
                <Stack alignItems="center" spacing={0.5}>
                  {currentMatchDetails.team1Logo && (
                    <Box
                      component="img"
                      src={currentMatchDetails.team1Logo}
                      alt={currentMatchDetails.team1}
                      sx={{ height: 50 }}
                    />
                  )}
                  <Typography variant="subtitle2" fontWeight={700}>
                    {currentMatchDetails.team1}
                  </Typography>
                </Stack>

                <Typography variant="body1" fontWeight={800}>
                  VS
                </Typography>

                {/* Team 2 */}
                <Stack alignItems="center" spacing={0.5}>
                  {currentMatchDetails.team2Logo && (
                    <Box
                      component="img"
                      src={currentMatchDetails.team2Logo}
                      alt={currentMatchDetails.team2}
                      sx={{ height: 50 }}
                    />
                  )}
                  <Typography variant="subtitle2" fontWeight={700}>
                    {currentMatchDetails.team2}
                  </Typography>
                </Stack>
              </Stack>
            ) : (
              <Typography variant="body2" color="text.secondary">
                Select a match to preview overlay
              </Typography>
            )}
          </CardContent>
        </Card>

        {/* Score Ticker Preview */}
        <Card
          variant="outlined"
          sx={{
            borderRadius: 8,
            overflow: "hidden",
            mb: 3,
            border: "1px solid",
            borderColor: "divider",
            boxShadow: "0 4px 12px rgba(0, 0, 0, 0.1)",
            bgcolor: "background.paper",
            transition: "transform 0.2s ease-in-out",
            "&:hover": {
              transform: "translateY(-2px)",
            },
          }}
        >
          <CardHeader
            titleTypographyProps={{ variant: "h6", fontWeight: 800 }}
            title="Score Ticker Preview"
            sx={{ py: 1.5, px: 2, color: "black" }}
          />
          <Divider />
          <CardContent sx={{ p: 0 }}>
            <Box
              sx={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                bgcolor: "linear-gradient(90deg, #4a90e2 0%, #63b8ff 100%)",
                color: "black",
                p: 1.5,
                fontSize: 16,
                fontWeight: 700,
                textAlign: "center",
                gap: 1,
                flexDirection: "column", // stack score + over balls
              }}
            >
              {/* Score Row */}
              <Box
                sx={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  width: "100%",
                  gap: 1,
                }}
              >
                <Box sx={{ display: "flex", alignItems: "center", px: 1 }}>
                  {battingTeamLogo && (
                    <Box
                      component="img"
                      src={battingTeamLogo}
                      alt=""
                      sx={{ height: 24, mr: 1, borderRadius: "4px" }}
                    />
                  )}
                  <Typography variant="subtitle1" sx={{ fontWeight: 800 }}>
                    {battingTeamCode} {inningsRuns}-{inningsWickets} ({overs}.
                    {balls})
                  </Typography>
                </Box>

                <Typography variant="subtitle1" sx={{ minWidth: 120 }}>
                  (RR:{" "}
                  {(() => {
                    const ballsPerOver = Number(overType) || 6;
                    const totalOvers = overs + balls / ballsPerOver;
                    return inningsRuns >= 0 &&
                      !isNaN(totalOvers) &&
                      totalOvers > 0
                      ? (inningsRuns / totalOvers).toFixed(2)
                      : "0.00";
                  })()}
                  )
                </Typography>

                <Typography variant="subtitle1" sx={{ minWidth: 120 }}>
                  {strikerName.toUpperCase()} {strikerRuns} ({strikerBalls})
                </Typography>

                <Typography variant="subtitle1" sx={{ minWidth: 120 }}>
                  {nonStrikerName.toUpperCase()} {nonStrikerRuns} (
                  {nonStrikerBalls})
                </Typography>

                <Typography variant="subtitle1" sx={{ minWidth: 120 }}>
                  {bowlerName.toUpperCase()} {bowlerWickets}-{bowlerOvers}-
                  {bowlerRuns}
                </Typography>

                <Box sx={{ display: "flex", alignItems: "center", px: 1 }}>
                  {bowlingTeamLogo && (
                    <Box
                      component="img"
                      src={bowlingTeamLogo}
                      alt=""
                      sx={{ height: 24, ml: 1, borderRadius: "4px" }}
                    />
                  )}
                </Box>
              </Box>

              {/* Current Over Balls Strip */}
              <Box sx={{ display: "flex", gap: 1, mt: 1 }}>
                {overBallHistory.length > 0 ? (
                  overBallHistory.map((ball, i) => (
                    <Box
                      key={i}
                      sx={{
                        width: 28,
                        height: 28,
                        borderRadius: "50%",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontWeight: "bold",
                        fontSize: 13,
                        bgcolor:
                          ball === "W"
                            ? "error.main"
                            : ball.startsWith("Wd")
                            ? "orange"
                            : ball.startsWith("Nb")
                            ? "purple"
                            : "primary.main",
                        color: "#fff",
                      }}
                    >
                      {ball}
                    </Box>
                  ))
                ) : (
                  <Typography variant="body2" color="text.secondary">
                    No balls yet
                  </Typography>
                )}
              </Box>
            </Box>
          </CardContent>
        </Card>
      </AppBar>

      {/* Content */}
      <Grid container spacing={2} sx={{ px: 2, pb: 2 }}>
        <Grid item xs={12} md={6}>
          <Container
            maxWidth={false}
            disableGutters
            sx={{
              flex: 1,
              py: 2,
              display: "flex",
              flexDirection: "column",
              alignItems: "flex-start",
            }}
          >
            {/* Match Setup */}
            <Card
              variant="outlined"
              sx={{
                borderRadius: 3,
                overflow: "hidden",
                mb: 2.5,
                borderColor: "divider",
                bgcolor: "background.paper",
              }}
            >
              <CardHeader
                titleTypographyProps={{ variant: "body2", fontWeight: 800 }}
                title="Match Setup"
                action={
                  <Chip
                    variant="outlined"
                    color={currentMatch ? "success" : "default"}
                    label={currentMatch ? "Match loaded" : "No match selected"}
                    size="small"
                  />
                }
                sx={{ py: 1.25, px: 1.5 }}
              />
              <Divider />
              <CardContent sx={{ p: 1.5 }}>
                <Grid container spacing={1.25} alignItems="flex-end">
                  <Grid item xs={12} md={5}>
                    <FormControl fullWidth size="small">
                      <InputLabel id="match-label" shrink>
                        Current Match
                      </InputLabel>
                      <Select
                        labelId="match-label"
                        id="match-select"
                        value={currentMatchId}
                        label="Current Match"
                        onChange={(e) => {
                          const id = String(e.target.value);
                          setCurrentMatchId(id);
                          const selected = matches.find(
                            (m) => String(m.id) === id
                          );
                          if (selected) handleSelectMatch(selected);
                        }}
                        displayEmpty
                      >
                        <MenuItem value="">
                          <em>Select a match (today)</em>
                        </MenuItem>
                        {matches.map((m) => (
                          <MenuItem key={m.id} value={m.id}>
                            {matchLabel(m)}
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  </Grid>

                  <Grid item xs={12} md={3.5}>
                    <FormControl
                      fullWidth
                      disabled={!currentMatch}
                      size="small"
                    >
                      <InputLabel id="batting-label" shrink>
                        Batting Team
                      </InputLabel>
                      <Select
                        labelId="batting-label"
                        id="batting-select"
                        value={battingTeamId ?? ""}
                        label="Batting Team"
                        onChange={handleBattingChange}
                        displayEmpty
                      >
                        <MenuItem value="">
                          <em>Select batting team</em>
                        </MenuItem>
                        <MenuItem
                          value={
                            currentMatch ? Number(currentMatch.team1Id) : ""
                          }
                        >
                          {team1Name}
                        </MenuItem>
                        <MenuItem
                          value={
                            currentMatch ? Number(currentMatch.team2Id) : ""
                          }
                        >
                          {team2Name}
                        </MenuItem>
                      </Select>
                    </FormControl>
                  </Grid>

                  <Grid item xs={12} md={3.5}>
                    <FormControl
                      fullWidth
                      disabled={!currentMatch}
                      size="small"
                    >
                      <InputLabel id="bowling-label" shrink>
                        Bowling Team
                      </InputLabel>
                      <Select
                        labelId="bowling-label"
                        id="bowling-select"
                        value={bowlingTeamId ?? ""}
                        label="Bowling Team"
                        onChange={handleBowlingChange}
                        displayEmpty
                      >
                        <MenuItem value="">
                          <em>Select bowling team</em>
                        </MenuItem>
                        <MenuItem
                          value={
                            currentMatch ? Number(currentMatch.team1Id) : ""
                          }
                        >
                          {team1Name}
                        </MenuItem>
                        <MenuItem
                          value={
                            currentMatch ? Number(currentMatch.team2Id) : ""
                          }
                        >
                          {team2Name}
                        </MenuItem>
                      </Select>
                    </FormControl>
                  </Grid>
                </Grid>

                <Divider sx={{ my: 1.25 }} />

                <Grid container spacing={1.25}>
                  <Grid item xs={12} sm={6} md={6}>
                    <TextField
                      size="small"
                      label="Ground"
                      value={ground}
                      placeholder="—"
                      fullWidth
                      disabled
                      InputProps={{ readOnly: true }}
                    />
                  </Grid>
                  <Grid item xs={6} sm={3} md={3}>
                    <TextField
                      size="small"
                      label="Balls Per Over"
                      value={overType}
                      placeholder="—"
                      fullWidth
                      disabled
                      InputProps={{ readOnly: true }}
                    />
                  </Grid>
                  <Grid item xs={6} sm={3} md={3}>
                    <TextField
                      size="small"
                      label="No of Overs"
                      value={noOfOvers}
                      placeholder="—"
                      fullWidth
                      disabled
                      InputProps={{ readOnly: true }}
                    />
                  </Grid>
                </Grid>
              </CardContent>
            </Card>

            {/* Players */}
            <Box sx={{ mb: 2 }}>
               <Stack direction="row" alignItems="center" justifyContent="space-between" mb={1}>
    <Typography variant="body2" fontWeight={800} color="text.secondary">
      Players
    </Typography>

    <Fab
      size="small"
      color="primary"
      aria-label="add player"
      onClick={() => {
        // default the team to currently selected batting team if present,
        // otherwise bowling team, otherwise blank
        const defaultTeam =
          (battingTeamId && String(battingTeamId)) ||
          (bowlingTeamId && String(bowlingTeamId)) ||
          "";
        setPlayerForm((p) => ({ ...emptyPlayerForm, teamId: defaultTeam }));
        setFormErrors({});
        setAddOpen(true);
      }}
      sx={{ boxShadow: "none" }}
    >
      <AddIcon fontSize="small" />
    </Fab>
  </Stack>
              <Grid container spacing={1.25}>
                {/* Batsman 1 */}
                <Grid item xs={12} md={4}>
                  <Card variant="outlined" sx={{ borderRadius: 3, height: "100%" }}>
                    <CardHeader
                      titleTypographyProps={{ variant: "body2", fontWeight: 700 }}
                      title="Batsman 1"
                      action={
                        <Chip
                          size="small"
                          variant="outlined"
                          label={battingTeamId ? `T:${battingTeamId}` : "No team"}
                        />
                      }
                      sx={{ py: 1, px: 1.25 }}
                    />
                    <Divider />
                    <CardContent sx={{ p: 1.25 }}>
                      <FormControl
                        fullWidth
                        sx={{ mt: 0.25 }}
                        disabled={!battingTeamId}
                        size="small"
                      >
                        <InputLabel id="batsman1-label" shrink>
                          Select player
                        </InputLabel>
                        <Select
                          labelId="batsman1-label"
                          id="batsman1-select"
                          value={batsman1 || ""}
                          label="Select player"
                          onChange={(e) => setBatsman1(String(e.target.value))}
                          displayEmpty
                        >
                          <MenuItem value="">
                            <em>Select player</em>
                          </MenuItem>
                          {availableForBatsman1.map((p) => (
                            <MenuItem key={p.id} value={p.id}>
                              {getPlayerName(p)}
                            </MenuItem>
                          ))}
                        </Select>
                      </FormControl>
                      <RadioGroup
                        value={onStrike}
                        onChange={(e) => setOnStrike(e.target.value)}
                        sx={{
                          "& .MuiFormControlLabel-root": { my: 0.25 },
                          mt: 0.75,
                        }}
                      >
                        <FormControlLabel
                          value="batsman1"
                          control={<Radio size="small" />}
                          label="On Strike"
                        />
                      </RadioGroup>
                    </CardContent>
                  </Card>
                </Grid>

                {/* Batsman 2 */}
                <Grid item xs={12} md={4}>
                  <Card variant="outlined" sx={{ borderRadius: 3, height: "100%" }}>
                    <CardHeader
                      titleTypographyProps={{ variant: "body2", fontWeight: 700 }}
                      title="Batsman 2"
                      action={
                        <Chip
                          size="small"
                          variant="outlined"
                          label={battingTeamId ? `T:${battingTeamId}` : "No team"}
                        />
                      }
                      sx={{ py: 1, px: 1.25 }}
                    />
                    <Divider />
                    <CardContent sx={{ p: 1.25 }}>
                      <FormControl
                        fullWidth
                        sx={{ mt: 0.25 }}
                        disabled={!battingTeamId}
                        size="small"
                      >
                        <InputLabel id="batsman2-label" shrink>
                          Select player
                        </InputLabel>
                        <Select
                          labelId="batsman2-label"
                          id="batsman2-select"
                          value={batsman2 || ""}
                          label="Select player"
                          onChange={(e) => setBatsman2(String(e.target.value))}
                          displayEmpty
                        >
                          <MenuItem value="">
                            <em>Select player</em>
                          </MenuItem>
                          {availableForBatsman2.map((p) => (
                            <MenuItem key={p.id} value={p.id}>
                              {getPlayerName(p)}
                            </MenuItem>
                          ))}
                        </Select>
                      </FormControl>
                      <RadioGroup
                        value={onStrike}
                        onChange={(e) => setOnStrike(e.target.value)}
                        sx={{
                          "& .MuiFormControlLabel-root": { my: 0.25 },
                          mt: 0.75,
                        }}
                      >
                        <FormControlLabel
                          value="batsman2"
                          control={<Radio size="small" />}
                          label="On Strike"
                        />
                      </RadioGroup>
                    </CardContent>
                  </Card>
                </Grid>

                {/* Bowler */}
                <Grid item xs={12} md={4}>
                  <Card variant="outlined" sx={{ borderRadius: 3, height: "100%" }}>
                    <CardHeader
                      titleTypographyProps={{ variant: "body2", fontWeight: 700 }}
                      title="Bowler"
                      action={
                        <Chip
                          size="small"
                          variant="outlined"
                          label={bowlingTeamId ? `T:${bowlingTeamId}` : "No team"}
                        />
                      }
                      sx={{ py: 1, px: 1.25 }}
                    />
                    <Divider />
                    <CardContent sx={{ p: 1.25 }}>
                      <FormControl
                        fullWidth
                        sx={{ mt: 0.25 }}
                        disabled={!bowlingTeamId}
                        size="small"
                      >
                        <InputLabel id="bowler-label" shrink>
                          Select bowler
                        </InputLabel>
                        <Select
                          labelId="bowler-label"
                          id="bowler-select"
                          value={bowler || ""}
                          label="Select bowler"
                          onChange={(e) => setBowler(String(e.target.value))}
                          displayEmpty
                        >
                          <MenuItem value="">
                            <em>Select bowler</em>
                          </MenuItem>
                          {bowlers.map((p) => (
                            <MenuItem key={p.id} value={p.id}>
                              {getPlayerName(p)}
                            </MenuItem>
                          ))}
                        </Select>
                      </FormControl>
                    </CardContent>
                  </Card>
                </Grid>

                {/* Scoring + Wickets */}
                <Grid item xs={12} md={8}>
                  <Card variant="outlined" sx={{ borderRadius: 3, height: "100%" }}>
                    <CardHeader
                      titleTypographyProps={{ variant: "body2", fontWeight: 800 }}
                      title="Scoring"
                      subheaderTypographyProps={{ variant: "caption" }}
                      subheader={
                        scoringLocked
                          ? "Over complete — change bowler to continue"
                          : "Tap a value to record runs or extras."
                      }
                      action={
                        <Stack direction="row" spacing={1} alignItems="center">
                          {scoringLocked && (
                            <Chip
                              color="warning"
                              size="small"
                              label="Locked — change bowler"
                            />
                          )}
                          <Button variant="outlined" size="small" disabled>
                            Edit
                          </Button>
                          <Button variant="contained" color="success" size="small" disabled>
                            Save
                          </Button>
                        </Stack>
                      }
                      sx={{ py: 1, px: 1.25 }}
                    />
                    <Divider />
                    <CardContent sx={{ p: 1.25 }}>
                      <Grid container spacing={1}>
                        {renderTable("Normal Runs", runButtons)}
                        {renderTable("Wides", wideButtons)}
                        {renderTable("No Balls", noBallButtons)}
                        {renderTable("Byes", byesButtons)}
                      </Grid>
                    </CardContent>
                  </Card>
                </Grid>

                {/* Wickets */}
                <Grid item xs={12} md={4}>
                  <Card variant="outlined" sx={{ borderRadius: 3, height: "100%" }}>
                    <CardHeader
                      titleTypographyProps={{ variant: "body2", fontWeight: 800 }}
                      title="Wickets"
                      sx={{ py: 1, px: 1.25 }}
                    />
                    <Divider />
                    <CardContent sx={{ p: 1.25 }}>
                      <Stack direction="column" spacing={1}>
                        <Button
                          variant="contained"
                          size="small"
                          fullWidth
                          disabled={scoringLocked}
                          sx={{
                            bgcolor: "#ef5350",
                            color: "white",
                            "&:hover": { bgcolor: "#e53935" },
                          }}
                          onClick={() => handleScore("Normal Runs", "W")}
                        >
                          Wicket
                        </Button>

                       <Button
                        variant="contained"
                        size="small"
                        fullWidth
                        disabled={scoringLocked}
                        sx={{
                          bgcolor: "#d32f2f",
                          color: "white",
                          "&:hover": { bgcolor: "#c62828" },
                        }}
                        onClick={() => handleRunOut("batsman1")}
                      >
                        Run out (Batsman 1)
                      </Button>
 
                      <Button
                        variant="contained"
                        size="small"
                        fullWidth
                        disabled={scoringLocked}
                        sx={{
                          bgcolor: "#b71c1c",
                          color: "white",
                          "&:hover": { bgcolor: "#7f0000" },
                        }}
                        onClick={() => handleRunOut("batsman2")}
                      >
                        Run out (Batsman 2)
                      </Button>
 


                      </Stack>
                    </CardContent>
                  </Card>
                </Grid>
              </Grid>
            </Box>
          </Container>
        </Grid>

        <Grid item xs={12} md={6} pt={2}>
          <Container-fluid>
            <Card
              variant="outlined"
              sx={{
                borderRadius: 3,
                overflow: "hidden",
                mb: 2.5,
                borderColor: "divider",
                bgcolor: "background.paper",
              }}
            >
              <CardHeader
                titleTypographyProps={{ variant: "body2", fontWeight: 800 }}
                title="Match Summary"
                action={
                  <Chip
                    variant="outlined"
                    color={currentMatch ? "success" : "default"}
                    label={currentMatch ? "Match loaded" : "No match selected"}
                    size="small"
                  />
                }
                sx={{ py: 1.25, px: 1.5 }}
              />
              <Divider />
              <CardContent sx={{ p: 1.5 }}>
                <Grid container spacing={2}>
                  {/* Batting Team Table */}
                  <Grid item xs={12} md={6}>
                    <Typography
                      variant="subtitle2"
                      fontWeight={800}
                      gutterBottom
                      color="primary"
                    >
                      {battingTeamId
                        ? `${
                            battingTeamId === Number(currentMatch?.team1Id)
                              ? team1Name
                              : team2Name
                          } Batting`
                        : "Batting Team"}
                    </Typography>
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell>Player</TableCell>
                          <TableCell align="right">Runs</TableCell>
                          <TableCell align="right">Balls</TableCell>
                          <TableCell align="right">4s</TableCell>
                          <TableCell align="right">6s</TableCell>
                          <TableCell align="right">SR</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {batters.map((p) => (
                          <TableRow key={p.id}>
                            <TableCell>{getPlayerName(p)}</TableCell>
                            <TableCell align="right">{p.runs ?? 0}</TableCell>
                            <TableCell align="right">{p.balls ?? 0}</TableCell>
                            <TableCell align="right">{p.fours ?? 0}</TableCell>
                            <TableCell align="right">{p.sixes ?? 0}</TableCell>
                            <TableCell align="right">
                              {p.balls > 0
                                ? ((p.runs / p.balls) * 100).toFixed(2)
                                : "0.00"}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </Grid>

                  {/* Bowling Team Table */}
                  <Grid item xs={12} md={6}>
                    <Typography
                      variant="subtitle2"
                      fontWeight={800}
                      gutterBottom
                      color="secondary"
                    >
                      {bowlingTeamId
                        ? `${
                            bowlingTeamId === Number(currentMatch?.team1Id)
                              ? team1Name
                              : team2Name
                          } Bowling`
                        : "Bowling Team"}
                    </Typography>
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell>Player</TableCell>
                          <TableCell align="right">Overs</TableCell>
                          <TableCell align="right">Runs</TableCell>
                          <TableCell align="right">Wkts</TableCell>
                          <TableCell align="right">Econ</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {bowlers.map((p) => (
                          <TableRow key={p.id}>
                            <TableCell>{getPlayerName(p)}</TableCell>
                            <TableCell align="right">{p.overs ?? 0}</TableCell>
                            <TableCell align="right">{p.runs ?? 0}</TableCell>
                            <TableCell align="right">
                              {p.wickets ?? 0}
                            </TableCell>
                            <TableCell align="right">
                              {p.overs > 0
                                ? (p.runs / p.overs).toFixed(2)
                                : "0.00"}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </Grid>
                </Grid>
              </CardContent>
            </Card>
          </Container-fluid>
        </Grid>
      </Grid>



      
      {/* Player Registration Dialog */}
<Dialog
  open={addOpen}
  onClose={() => setAddOpen(false)}
  fullWidth
  maxWidth="sm"
  PaperProps={{ sx: { borderRadius: 3 } }}
>
  <DialogTitle sx={{ fontWeight: 800 }}>Register Player</DialogTitle>
  <DialogContent dividers>
    <Stack
      component="form"
      id="playerCreateForm"
      spacing={2}
      onSubmit={onCreatePlayer}
      sx={{ pt: 1 }}
    >
      {/* TEAM */}
      <FormControl size="small" fullWidth error={Boolean(formErrors.teamId)}>
        <InputLabel id="add-team-label">Team</InputLabel>
        <Select
          labelId="add-team-label"
          label="Team"
          name="teamId"
          value={playerForm.teamId}
          onChange={onPlayerField}
        >
          {teams.map((t) => (
            <MenuItem key={t.id} value={String(t.id)}>
              {t.teamName} (#{t.id})
            </MenuItem>
          ))}
        </Select>
        {formErrors.teamId && (
          <FormHelperText>{formErrors.teamId}</FormHelperText>
        )}
      </FormControl>

      {/* NAME / POSITION */}
      <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
        <TextField
          size="small"
          label="Player Name"
          name="playerName"
          value={playerForm.playerName}
          onChange={onPlayerField}
          error={Boolean(formErrors.playerName)}
          helperText={formErrors.playerName}
          fullWidth
        />
        <TextField
          size="small"
          label="Position (0–11)"
          type="number"
          name="position"
          value={playerForm.position}
          onChange={(e) => {
            let v = e.target.value;
            if (v !== "") {
              const n = Number(v);
              if (!Number.isNaN(n)) {
                if (n < 0) v = "0";
                if (n > 11) v = "11";
              }
            }
            onPlayerField({ target: { name: "position", value: v, type: "text" } });
          }}
          error={Boolean(formErrors.position)}
          helperText={formErrors.position}
          inputProps={{ min: 0, max: 11, step: 1 }}
          sx={{ width: { sm: 180 } }}
        />
      </Stack>

      {/* PHONE / ADDRESS */}
      <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
        <TextField
          size="small"
          label="Phone"
          name="phone"
          value={playerForm.phone}
          onChange={onPlayerField}
          fullWidth
        />
        <TextField
          size="small"
          label="Address"
          name="playerAddress"
          value={playerForm.playerAddress}
          onChange={onPlayerField}
          fullWidth
        />
      </Stack>

      {/* ROLES */}
      <FormGroup row>
        <FormControlLabel
          control={
            <Checkbox
              name="isBatter"
              checked={playerForm.isBatter}
              onChange={onPlayerField}
            />
          }
          label="Batter"
        />
        <FormControlLabel
          control={
            <Checkbox
              name="isBaller"
              checked={playerForm.isBaller}
              onChange={onPlayerField}
            />
          }
          label="Bowler"
        />
        <FormControlLabel
          control={
            <Checkbox
              name="isWk"
              checked={playerForm.isWk}
              onChange={onPlayerField}
            />
          }
          label="Wicket Keeper"
        />
        <FormControlLabel
          control={
            <Checkbox
              name="isCaptain"
              checked={playerForm.isCaptain}
              onChange={onPlayerField}
            />
          }
          label="Captain"
        />
      </FormGroup>
      {formErrors.roles && (
        <Typography variant="caption" color="error">
          {formErrors.roles}
        </Typography>
      )}
    </Stack>
  </DialogContent>

  <DialogActions sx={{ p: 2 }}>
    <Button onClick={() => setAddOpen(false)} color="inherit">
      Cancel
    </Button>
    <Button type="submit" form="playerCreateForm" variant="contained">
      Create
    </Button>
  </DialogActions>
</Dialog>

    </Box>

    
  );
}
