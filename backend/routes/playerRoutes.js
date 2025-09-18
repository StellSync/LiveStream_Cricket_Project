// backend/routes/playerRoutes.js
import { Router } from "express";
import {
  createPlayer,
  listPlayers,
  getPlayer,
  updatePlayer,
  deletePlayer,
} from "../controllers/playerController.js";

const router = Router();

router.get("/", listPlayers);      // GET /api/players?teamId=2
router.post("/", createPlayer);    // POST /api/players

// numeric id routes (avoid colliding with any _id routes you might add)
router.get("/:id(\\d+)", getPlayer);
router.put("/:id(\\d+)", updatePlayer);
router.delete("/:id(\\d+)", deletePlayer);

export default router;
