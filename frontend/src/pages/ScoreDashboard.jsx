import { useState } from "react";
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
} from "@mui/material";

export default function ScoreDashboard() {
  const [currentMatch, setCurrentMatch] = useState("");
  const [battingTeam, setBattingTeam] = useState("");
  const [batsman1, setBatsman1] = useState("");
  const [batsman2, setBatsman2] = useState("");
  const [bowler, setBowler] = useState("");
  const [onStrike, setOnStrike] = useState("batsman1");

  // 🔹 Helper: always create a 4x4 grid (16 cells)
  const makeGrid = (items) => {
    const total = 16;
    const padded = [...items];
    while (padded.length < total) padded.push("");
    return padded;
  };

  const runButtons = makeGrid([
    "0",
    "1",
    "2",
    "3",
    "4",
    "5",
    "6",
    "7",
    "-",
    "W",
  ]);
  const wideButtons = makeGrid(["0", "1", "2", "3", "4", "5", "6", "7", "-"]);
  const noBallButtons = makeGrid(["0", "1", "2", "3", "4", "5", "6", "7", "-"]);

  // 🔹 Reusable table renderer
  const renderTable = (title, items) => (
    <Grid item xs={12} sm={4}>
      <Typography fontWeight="bold" mb={1}>
        {title}
      </Typography>
      <Table
        sx={{
          borderCollapse: "collapse",
          "& td": { border: "1px solid black", padding: 0 },
        }}
      >
        <TableBody>
          {[0, 1, 2, 3].map((row) => (
            <TableRow key={row}>
              {[0, 1, 2, 3].map((col) => {
                const index = row * 4 + col;
                const value = items[index] || "";
                return (
                  <TableCell key={col} align="center">
                    <Button
                      fullWidth
                      variant="text"
                      disabled={!value}
                      sx={{
                        minWidth: "60px",
                        minHeight: "60px",
                        color: "black",
                        backgroundColor: value ? "#e0e0e0" : "transparent",
                        "&:hover": {
                          backgroundColor: value ? "#d5d5d5" : "transparent",
                        },
                      }}
                    >
                      {value}
                    </Button>
                  </TableCell>
                );
              })}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Grid>
  );

  return (
    <Box p={4}>
      {/* Top Dropdowns */}
      <Grid container spacing={2} mb={4}>
        <Grid item xs={12} sm={4}>
          <FormControl fullWidth>
            <InputLabel>Current Match</InputLabel>
            <Select
              value={currentMatch}
              label="Current Match"
              onChange={(e) => setCurrentMatch(e.target.value)}
            >
              <MenuItem value="1">Match 1</MenuItem>
              <MenuItem value="2">Match 2</MenuItem>
            </Select>
          </FormControl>
        </Grid>
        <Grid item xs={12} sm={4}>
          <FormControl fullWidth>
            <InputLabel>Batting Team</InputLabel>
            <Select
              value={battingTeam}
              label="Batting Team"
              onChange={(e) => setBattingTeam(e.target.value)}
            >
              <MenuItem value="team1">Team 1</MenuItem>
              <MenuItem value="team2">Team 2</MenuItem>
            </Select>
          </FormControl>
        </Grid>
        <Grid item xs={12} sm={4}>
          <FormControl fullWidth>
            <InputLabel>Bowler</InputLabel>
            <Select
              value={bowler}
              label="Bowler"
              onChange={(e) => setBowler(e.target.value)}
            >
              <MenuItem value="bowler1">Bowler 1</MenuItem>
              <MenuItem value="bowler2">Bowler 2</MenuItem>
            </Select>
          </FormControl>
        </Grid>
      </Grid>

      {/* Batsmen */}
      <Grid container spacing={2} mb={4}>
        <Grid item xs={12} sm={6}>
          <Paper variant="outlined" sx={{ p: 2 }}>
            <Typography fontWeight="bold">Batsman 1</Typography>
            <FormControl fullWidth sx={{ mt: 1 }}>
              <Select
                value={batsman1}
                onChange={(e) => setBatsman1(e.target.value)}
              >
                <MenuItem value="player1">Player 1</MenuItem>
                <MenuItem value="player2">Player 2</MenuItem>
              </Select>
            </FormControl>
            <RadioGroup
              value={onStrike}
              onChange={(e) => setOnStrike(e.target.value)}
            >
              <FormControlLabel
                value="batsman1"
                control={<Radio />}
                label="On Strike"
              />
            </RadioGroup>
          </Paper>
        </Grid>
        <Grid item xs={12} sm={6}>
          <Paper variant="outlined" sx={{ p: 2 }}>
            <Typography fontWeight="bold">Batsman 2</Typography>
            <FormControl fullWidth sx={{ mt: 1 }}>
              <Select
                value={batsman2}
                onChange={(e) => setBatsman2(e.target.value)}
              >
                <MenuItem value="player3">Player 3</MenuItem>
                <MenuItem value="player4">Player 4</MenuItem>
              </Select>
            </FormControl>
            <RadioGroup
              value={onStrike}
              onChange={(e) => setOnStrike(e.target.value)}
            >
              <FormControlLabel
                value="batsman2"
                control={<Radio />}
                label="On Strike"
              />
            </RadioGroup>
          </Paper>
        </Grid>
      </Grid>

      {/* Runs & Extras - 3 Tables Side by Side */}
      <Grid container spacing={3} mb={4}>
        {renderTable("Normal Runs", runButtons)}
        {renderTable("Wides", wideButtons)}
        {renderTable("No Balls", noBallButtons)}
      </Grid>

      {/* Wickets */}
      <Box mb={4}>
        <FormControlLabel control={<Checkbox />} label="Wicket" />
        <FormControlLabel control={<Checkbox />} label="Run out (Batsman 1)" />
        <FormControlLabel control={<Checkbox />} label="Run out (Batsman 2)" />
      </Box>

      {/* Actions */}
      <Box display="flex" gap={2}>
        <Button variant="outlined">Edit</Button>
        <Button variant="contained" color="success">
          Save
        </Button>
      </Box>
    </Box>
  );
}
