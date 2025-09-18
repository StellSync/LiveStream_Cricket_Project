// backend/routes/matchRoutes.js
import { Router } from "express";
import {
  createMatch,
  listMatches,
  getMatch,
  updateMatch,
  deleteMatch,
} from "../controllers/matchController.js";

const router = Router();

router.get("/", listMatches);       // GET /api/matches?tournamentId=1&teamId=2
router.post("/", createMatch);      // POST /api/matches

router.get("/:id(\\d+)", getMatch);     // numeric id
router.put("/:id(\\d+)", updateMatch);  // numeric id
router.delete("/:id(\\d+)", deleteMatch);

export default router;
