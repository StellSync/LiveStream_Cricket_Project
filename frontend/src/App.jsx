import { Routes, Route, Navigate } from "react-router-dom";
import Layout from "./components/Layout.jsx";
import Home from "./pages/Home.jsx";
import TournamentsPage from "./pages/TournamentsPage.jsx";
import TeamsPage from "./pages/TeamsPage.jsx";
import PlayersPage from "./pages/PlayersPage.jsx";
import MatchesPage from "./pages/MatchesPage.jsx";
import ScoreDashboard from "./pages/ScoreDashboard.jsx";

// NEW: Draw Builder page
import DrawBuilder from "./pages/DrawBuilder.jsx";

export default function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/tournaments" element={<TournamentsPage />} />
        <Route path="/teams" element={<TeamsPage />} />
        <Route path="/players" element={<PlayersPage />} />
        <Route path="/matches" element={<MatchesPage />} />
        <Route path="/scoreboard" element={<ScoreDashboard />} />

        {/* NEW ROUTE */}
        <Route path="/draw" element={<DrawBuilder />} />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Layout>
  );
}
