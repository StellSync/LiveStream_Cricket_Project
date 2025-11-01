// src/pages/Homs.jsx
import { useMemo } from "react";
import {
  Box,
  Grid,
  Card,
  CardHeader,
  CardContent,
  CardActions,
  Button,
  Chip,
  Stack,
  Typography,
  Divider,
  Tooltip,
  IconButton,
} from "@mui/material";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";

export default function Homs() {
  //  Always target backend on :5000 (same host)
  const base = useMemo(() => {
    const { protocol, hostname, port } = window.location;
    // if already on 5000, keep origin; else rewrite to :5000
    if (port === "5000") return window.location.origin;
    return `${protocol}//${hostname}:5000`;
  }, []);

  const overlays = [
    { title: "Scorebar lime", path: "/overlay/scorebar-tv-lime", desc: "Live ticker with current over bubbles, batters and bowler.", tag: "Live" },
    { title: "Scorebar gold", path: "/overlay/scorebar-tv-gold", desc: "Neon theme variant of the live ticker.", tag: "Live" },
     { title: "Scorebar sunset", path: "/overlay/scorebar-tv-sunset", desc: "Live ticker with current over bubbles, batters and bowler.", tag: "Live" },
    { title: "Scorebar aurora", path: "/overlay/scorebar-tv-aurora", desc: "Neon theme variant of the live ticker.", tag: "Live" },
    { title: "Scorebar blue", path: "/overlay/scorebar-tv-blue", desc: "Neon theme variant of the live ticker.", tag: "Live" },
    { title: "Match Intro", path: "/overlay/match", desc: "Tournament + teams header slate.", tag: "Header" },
    // NEW: Summary Scorecard (served by backend on :5000)
    {
      title: "Summary Scorecard",
      path: "/summary",
      desc: "Two-innings scorecard for OBS. POST completed match data to /api/summary from ScoreDashboard, then load this.",
      tag: "Summary",
    },
  ];

  const copy = async (text) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
    }
  };

  return (
    <Box sx={{ p: 2 }}>
      <Typography variant="h5" fontWeight={900} gutterBottom>
        Overlays & Tools
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Add any of these URLs as a Browser Source in OBS. Links are pinned to port <strong>5000</strong>.
      </Typography>

      <Card variant="outlined" sx={{ mb: 2, borderRadius: 3 }}>
        <CardContent sx={{ p: 2 }}>
          <Stack direction="row" spacing={1} alignItems="center">
            <Chip label="Base URL" size="small" />
            <Typography fontFamily="monospace">{base}</Typography>
            <Tooltip title="Copy base URL">
              <IconButton size="small" onClick={() => copy(base)}>
                <ContentCopyIcon fontSize="inherit" />
              </IconButton>
            </Tooltip>
          </Stack>
        </CardContent>
      </Card>

      <Grid container spacing={2}>
        {overlays.map((o) => {
          const url = `${base}${o.path}`;
          return (
            <Grid item xs={12} sm={6} md={4} key={o.path}>
              <Card variant="outlined" sx={{ borderRadius: 3, height: "100%", display: "flex", flexDirection: "column" }}>
                <CardHeader
                  titleTypographyProps={{ variant: "subtitle1", fontWeight: 800 }}
                  title={o.title}
                  action={<Chip label={o.tag} size="small" variant="outlined" />}
                  sx={{ pb: 0.5 }}
                />
                <CardContent sx={{ pt: 1, pb: 0 }}>
                  <Typography variant="body2" color="text.secondary">
                    {o.desc}
                  </Typography>
                  <Divider sx={{ my: 1 }} />
                  <Typography variant="caption" sx={{ wordBreak: "break-all", fontFamily: "monospace" }}>
                    {url}
                  </Typography>
                </CardContent>
                <CardActions sx={{ mt: "auto", p: 1.5, pt: 0.5 }}>
                  <Button
                    size="small"
                    variant="contained"
                    startIcon={<OpenInNewIcon />}
                    onClick={() => window.open(url, "_blank", "noopener")}
                  >
                    Open
                  </Button>
                  <Button
                    size="small"
                    variant="outlined"
                    startIcon={<ContentCopyIcon />}
                    onClick={() => copy(url)}
                  >
                    Copy URL
                  </Button>
                </CardActions>
              </Card>
            </Grid>
          );
        })}
      </Grid>

    </Box>
  );
}
