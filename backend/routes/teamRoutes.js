// backend/routes/teamRoutes.js
import { Router } from "express";
import {
  createTeam,
  listTeams,
  getTeam,
  updateTeam,
  deleteTeam,
} from "../controllers/teamController.js";

const router = Router();

router.get("/", listTeams);
router.post("/", createTeam);

// numeric id only to avoid colliding with Mongo _id routes
router.get("/:id(\\d+)", getTeam);
router.put("/:id(\\d+)", updateTeam);
router.delete("/:id(\\d+)", deleteTeam);

export default router;
