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
} from "@mui/material";

import {
  getMatches,
  getPlayers,
  getTournament,
  setCurrentMatch,
  getCurrentMatch,
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
      team1Logo: match.team1Logo || "", // ✅ FIXED
      team2: match.team2Name,
      team2Logo: match.team2Logo || "", // ✅ FIXED
      matchNumber: match.matchNumber,
      overType: match.overType,
      noOfOvers: match.noOfOvers,
    };

    console.log("Selected Data", match);
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
  setOverType(""); // Reset to empty, will be set by match data
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

  (async () => {
    if (!currentMatch) return;

    setOverType(currentMatch.overType ?? "6"); // Default to 6 if no overType provided
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
    setBowlerOvers(0);
    setBowlerMaidens(0);
    setBowlerRuns(0);
    setBowlerWickets(0);
    setCurrentOverRuns(0);
    setBalls(0);
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
  const battingTeamLogo = battingTeamId === team1Id ? currentMatch?.team1Logo : currentMatch?.team2Logo;
  const bowlingTeamLogo = bowlingTeamId === team1Id ? currentMatch?.team1Logo : currentMatch?.team2Logo;
  const battingTeamCode = battingTeamName.substring(0, 3).toUpperCase();
  const bowlingTeamCode = bowlingTeamName.substring(0, 3).toUpperCase();

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
  const nonStrikerBalls = onStrike === "batsman1" ? batsman2Balls : batsman1Balls;

  // Build a fixed-size 3x3 grid (9 cells). Truncates extras and pads with "" if short.
  const makeGrid = (items, total = 9) => {
    const padded = [...items].slice(0, total);
    while (padded.length < total) padded.push("");
    return padded;
  };

  // 3x3 button sets
  const runButtons = makeGrid(["0", "1", "2", "3", "4", "5", "6", "7", "W"]); // keep W in this grid
  const wideButtons = makeGrid(["0", "1", "2", "3", "4", "5", "6", "7", "-"]);
  const noBallButtons = makeGrid(["0", "1", "2", "3", "4", "5", "6", "7", "-"]);

  const handleScore = (title, value) => {
    if (value === "-") return; // TODO: Implement cancel if needed

    const runs = Number(value);

    const ballsPerOver = Number(overType || 6);

    const setStrikerRuns = onStrike === "batsman1" ? setBatsman1Runs : setBatsman2Runs;
    const setStrikerBalls = onStrike === "batsman1" ? setBatsman1Balls : setBatsman2Balls;

    if (!isNaN(runs)) {
      if (title === "Normal Runs") {
        setStrikerRuns((prev) => prev + runs);
        setStrikerBalls((prev) => prev + 1);
        setInningsRuns((prev) => prev + runs);
        setBowlerRuns((prev) => prev + runs);
        setCurrentOverRuns((prev) => prev + runs);

        setBalls((prev) => {
          const newBalls = prev + 1;
          if (newBalls === ballsPerOver) {
            if (currentOverRuns + runs === 0) {
              setBowlerMaidens((m) => m + 1);
            }
            setBowlerOvers((o) => o + 1);
            setOvers((o) => o + 1);
            setCurrentOverRuns(0);
            return 0;
          }
          return newBalls;
        });

        if (runs % 2 === 1) {
          setOnStrike(onStrike === "batsman1" ? "batsman2" : "batsman1");
        }
      } else if (title === "Wides") {
        setInningsRuns((prev) => prev + runs + 1);
        if (runs % 2 === 1) {
          setOnStrike(onStrike === "batsman1" ? "batsman2" : "batsman1");
        }
      } else if (title === "No Balls") {
        setInningsRuns((prev) => prev + runs + 1);
        setBowlerRuns((prev) => prev + runs);
        if (runs > 0) {
          setStrikerRuns((prev) => prev + runs);
        }
        if ((runs + 1) % 2 === 1) {
          setOnStrike(onStrike === "batsman1" ? "batsman2" : "batsman1");
        }
      }
    } else if (value === "W" && title === "Normal Runs") {
      setInningsWickets((prev) => prev + 1);
      setBowlerWickets((prev) => prev + 1);
      setStrikerBalls((prev) => prev + 1);

      setBalls((prev) => {
        const newBalls = prev + 1;
        if (newBalls === ballsPerOver) {
          if (currentOverRuns === 0) {
            setBowlerMaidens((m) => m + 1);
          }
          setBowlerOvers((o) => o + 1);
          setOvers((o) => o + 1);
          setCurrentOverRuns(0);
          return 0;
        }
        return newBalls;
      });
    }
  };

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
          bgcolor: "background.paper",
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
                          value ? `Add ${title.toLowerCase()} ${value}` : ""
                        }
                      >
                        <span>
                          <Button
                            fullWidth
                            size="small"
                            variant="text"
                            disabled={!value}
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
                                backgroundColor: value
                                  ? "action.hover"
                                  : "transparent",
                              },
                              "&.Mui-disabled": { opacity: 0.4 },
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
        <Toolbar variant="dense" sx={{ gap: 1, minHeight: 48 }}>
          <Typography variant="subtitle2" fontWeight={800} letterSpacing={0.2}>
            Live Scoring Console
          </Typography>
          <Divider flexItem orientation="vertical" sx={{ mx: 1 }} />
          <Stack direction="row" spacing={1} alignItems="center">
            <Chip
              size="small"
              variant="outlined"
              label={team1Name || "Team 1"}
            />
            <Typography variant="caption" color="text.secondary">
              vs
            </Typography>
            <Chip
              size="small"
              variant="outlined"
              label={team2Name || "Team 2"}
            />
          </Stack>
        </Toolbar>
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
    titleTypographyProps={{ variant: "h6", fontWeight: 800,  }}
    title="Score Ticker Preview"
    sx={{
      py: 1.5,
      px: 2,
      
      color: "black",
    }}
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
          {battingTeamCode} {inningsRuns}-{inningsWickets} ({overs}.{balls})
        </Typography>
      </Box>
        <Typography variant="subtitle1" sx={{ minWidth: 120 }}>
      (RR: {(() => {
        const ballsPerOver = Number(overType) || 6; // Convert to number, default to 6 if invalid
        const totalOvers = overs + (balls / ballsPerOver);
        return inningsRuns >= 0 && !isNaN(totalOvers) && totalOvers > 0 
          ? (inningsRuns / totalOvers).toFixed(2) 
          : "0.00";
      })()})
    </Typography>
      <Typography variant="subtitle1" sx={{ minWidth: 120 }}>
        {strikerName.toUpperCase()} {strikerRuns} ({strikerBalls})
      </Typography>
      <Typography variant="subtitle1" sx={{ minWidth: 120 }}>
        {nonStrikerName.toUpperCase()} {nonStrikerRuns} ({nonStrikerBalls})
      </Typography>
      <Typography variant="subtitle1" sx={{ minWidth: 120 }}>
        {bowlerName.toUpperCase()} {bowlerWickets}-{bowlerOvers}-{bowlerRuns}
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
  </CardContent>
</Card>
      </AppBar>

      {/* Content */}
      <Container maxWidth="lg" sx={{ flex: 1, py: 2 }}>
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
                      const selected = matches.find((m) => String(m.id) === id);
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
                <FormControl fullWidth disabled={!currentMatch} size="small">
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
                      value={currentMatch ? Number(currentMatch.team1Id) : ""}
                    >
                      {team1Name}
                    </MenuItem>
                    <MenuItem
                      value={currentMatch ? Number(currentMatch.team2Id) : ""}
                    >
                      {team2Name}
                    </MenuItem>
                  </Select>
                </FormControl>
              </Grid>

              <Grid item xs={12} md={3.5}>
                <FormControl fullWidth disabled={!currentMatch} size="small">
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
                      value={currentMatch ? Number(currentMatch.team1Id) : ""}
                    >
                      {team1Name}
                    </MenuItem>
                    <MenuItem
                      value={currentMatch ? Number(currentMatch.team2Id) : ""}
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
          <Typography
            variant="body2"
            fontWeight={800}
            mb={1}
            color="text.secondary"
          >
            Players
          </Typography>
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
                      {batters.map((p) => (
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
                      {batters.map((p) => (
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
                  subheader="Tap a value to record runs or extras."
                  action={
                    <Stack direction="row" spacing={1}>
                      <Button variant="outlined" size="small">
                        Edit
                      </Button>
                      <Button variant="contained" color="success" size="small">
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
                  </Grid>
                </CardContent>
              </Card>
            </Grid>

            {/* RunOuts */}
            <Grid item xs={12} md={4}>
              <Card variant="outlined" sx={{ borderRadius: 3, height: "100%" }}>
                <CardHeader
                  titleTypographyProps={{ variant: "body2", fontWeight: 800 }}
                  title="Wickets"
                  sx={{ py: 1, px: 1.25 }}
                />
                <Divider />
                <CardContent sx={{ p: 1.25 }}>
                  <Stack
                    direction="column"
                    spacing={0.75}
                    sx={{ "& .MuiFormControlLabel-root": { m: 0 } }}
                  >
                    <FormControlLabel
                      control={<Checkbox size="small" />}
                      label="Wicket"
                    />
                    <FormControlLabel
                      control={<Checkbox size="small" />}
                      label="Run out (Batsman 1)"
                    />
                    <FormControlLabel
                      control={<Checkbox size="small" />}
                      label="Run out (Batsman 2)"
                    />
                  </Stack>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        </Box>
      </Container>
    </Box>
  );
}