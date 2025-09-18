// backend/routes/tournamentRoutes.js
import { Router } from "express";
import {
  createTournament,
  listTournaments,
  getTournament,
  updateTournament,
  deleteTournament,
} from "../controllers/tournamentController.js";

const router = Router();

router.route("/")
  .get(listTournaments)
  .post(createTournament);

router.route("/:id")
  .get(getTournament)
  .put(updateTournament)
  .delete(deleteTournament);

export default router;
