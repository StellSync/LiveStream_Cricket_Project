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

import { getMatches, getPlayers, getTournament } from "../lib/api";

export default function ScoreDashboard() {
  // ---- Master data ----
  const [matches, setMatches] = useState([]);
  const [currentMatchId, setCurrentMatchId] = useState("");

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
        const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
        const startOfTomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 0, 0);

        const todaysMatches = (data || []).filter((m) => {
          const dt = parseMatchDate(m.date || m.matchDate || m.startTime || m.scheduledAt);
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

    (async () => {
      if (!currentMatch) return;

      setOverType(currentMatch.overType ?? "");
      setNoOfOvers(
        currentMatch.noOfOvers != null && currentMatch.noOfOvers !== "" ? String(currentMatch.noOfOvers) : ""
      );

      const fromMatch =
        currentMatch.ground ?? currentMatch.venue ?? currentMatch.place ?? currentMatch.stadium ?? "";
      if (String(fromMatch || "").trim()) {
        setGround(String(fromMatch));
        return;
      }

      const tournamentId =
        currentMatch.tournamentId ?? currentMatch.tournamentID ?? currentMatch.tourId ?? null;

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

  const normalizeBool = (v) => v === true || v === "true" || v === 1 || v === "1";

  const isPlayerBatter = (p) =>
    normalizeBool(p.isBatter ?? p.Isbatter ?? p.isBatsman) || normalizeBool(p.isWK ?? p.IsWk);

  const isPlayerBowler = (p) => normalizeBool(p.isBowler ?? p.Isballer);

  const getPlayerTeamId = (p) => Number(p.teamId ?? p.teamid ?? p.teamID ?? p.team);

  const getPlayerName = (p) => p.playerName ?? p.playername ?? p.name ?? `Player #${p.id}`;

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
        const byTeam = list.filter((p) => getPlayerTeamId(p) === Number(battingTeamId));
        const onlyBatters = byTeam.filter(isPlayerBatter);
        const finalList = onlyBatters.length ? onlyBatters : byTeam;

        setBatters(finalList);

        setBatsman1((prev) => (finalList.some((p) => String(p.id) === String(prev)) ? prev : ""));
        setBatsman2((prev) => (finalList.some((p) => String(p.id) === String(prev)) ? prev : ""));
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
        const byTeam = list.filter((p) => getPlayerTeamId(p) === Number(bowlingTeamId));
        const onlyBowlers = byTeam.filter(isPlayerBowler);
        const finalList = onlyBowlers.length ? onlyBowlers : byTeam;

        setBowlers(finalList);

        setBowler((prev) => (finalList.some((p) => String(p.id) === String(prev)) ? prev : ""));
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

  const team1Name = currentMatch?.team1Name || `#${currentMatch?.team1Id ?? ""}`;
  const team2Name = currentMatch?.team2Name || `#${currentMatch?.team2Id ?? ""}`;
  const team1Id = currentMatch ? Number(currentMatch.team1Id) : null;
  const team2Id = currentMatch ? Number(currentMatch.team2Id) : null;

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

  // 3x3 scoring table
  const renderTable = (title, items) => (
    <Grid item xs={12} sm={4}>
      <Typography fontWeight={700} mb={0.75} variant="body2" color="text.secondary">
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
                    <TableCell key={col} align="center" sx={{ width: "33.3333%" }}>
                      <Tooltip title={value ? `Add ${title.toLowerCase()} ${value}` : ""}>
                        <span>
                          <Button
                            fullWidth
                            size="small"
                            variant="text"
                            disabled={!value}
                            sx={{
                              minWidth: 40,
                              minHeight: 40,
                              py: 0.5,
                              fontWeight: 700,
                              fontSize: 14,
                              borderRadius: 0,
                              color: isDanger ? "error.main" : "text.primary",
                              "&:hover": {
                                backgroundColor: value ? "action.hover" : "transparent",
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
      val === Number(currentMatch.team1Id) ? Number(currentMatch.team2Id) : Number(currentMatch.team1Id);
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
      val === Number(currentMatch.team1Id) ? Number(currentMatch.team2Id) : Number(currentMatch.team1Id);
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
            <Chip size="small" variant="outlined" label={team1Name || "Team 1"} />
            <Typography variant="caption" color="text.secondary">
              vs
            </Typography>
            <Chip size="small" variant="outlined" label={team2Name || "Team 2"} />
          </Stack>
        </Toolbar>
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
                    onChange={(e) => setCurrentMatchId(String(e.target.value))}
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
                    <MenuItem value={currentMatch ? Number(currentMatch.team1Id) : ""}>{team1Name}</MenuItem>
                    <MenuItem value={currentMatch ? Number(currentMatch.team2Id) : ""}>{team2Name}</MenuItem>
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
                    <MenuItem value={currentMatch ? Number(currentMatch.team1Id) : ""}>{team1Name}</MenuItem>
                    <MenuItem value={currentMatch ? Number(currentMatch.team2Id) : ""}>{team2Name}</MenuItem>
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
          <Typography variant="body2" fontWeight={800} mb={1} color="text.secondary">
            Players
          </Typography>
          <Grid container spacing={1.25}>
            {/* Batsman 1 */}
            <Grid item xs={12} md={4}>
              <Card variant="outlined" sx={{ borderRadius: 3, height: "100%" }}>
                <CardHeader
                  titleTypographyProps={{ variant: "body2", fontWeight: 700 }}
                  title="Batsman 1"
                  action={<Chip size="small" variant="outlined" label={battingTeamId ? `T:${battingTeamId}` : "No team"} />}
                  sx={{ py: 1, px: 1.25 }}
                />
                <Divider />
                <CardContent sx={{ p: 1.25 }}>
                  <FormControl fullWidth sx={{ mt: 0.25 }} disabled={!battingTeamId} size="small">
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
                    sx={{ "& .MuiFormControlLabel-root": { my: 0.25 }, mt: 0.75 }}
                  >
                    <FormControlLabel value="batsman1" control={<Radio size="small" />} label="On Strike" />
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
                  action={<Chip size="small" variant="outlined" label={battingTeamId ? `T:${battingTeamId}` : "No team"} />}
                  sx={{ py: 1, px: 1.25 }}
                />
                <Divider />
                <CardContent sx={{ p: 1.25 }}>
                  <FormControl fullWidth sx={{ mt: 0.25 }} disabled={!battingTeamId} size="small">
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
                    sx={{ "& .MuiFormControlLabel-root": { my: 0.25 }, mt: 0.75 }}
                  >
                    <FormControlLabel value="batsman2" control={<Radio size="small" />} label="On Strike" />
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
                  action={<Chip size="small" variant="outlined" label={bowlingTeamId ? `T:${bowlingTeamId}` : "No team"} />}
                  sx={{ py: 1, px: 1.25 }}
                />
                <Divider />
                <CardContent sx={{ p: 1.25 }}>
                  <FormControl fullWidth sx={{ mt: 0.25 }} disabled={!bowlingTeamId} size="small">
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
                    <Button variant="outlined" size="small">Edit</Button>
                    <Button variant="contained" color="success" size="small">Save</Button>
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
                <Stack direction="column" spacing={0.75} sx={{ "& .MuiFormControlLabel-root": { m: 0 } }}>
                  <FormControlLabel control={<Checkbox size="small" />} label="Wicket" />
                  <FormControlLabel control={<Checkbox size="small" />} label="Run out (Batsman 1)" />
                  <FormControlLabel control={<Checkbox size="small" />} label="Run out (Batsman 2)" />
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
