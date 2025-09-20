// backend/models/Player.js
import mongoose from "mongoose";
import AutoIncrementFactory from "mongoose-sequence";

const PlayerSchema = new mongoose.Schema(
  {
    // Auto-increment primary key for players
    id: { type: Number, unique: true },

    // FK by NUMERIC Team id (your Team model's auto-increment id)
    teamId: { type: Number, required: true, index: true },

    // Redundant team name snapshot (optional but handy for quick UI listing)
    teamName: { type: String, trim: true },

    // Core player fields
    playerName: { type: String, required: true, trim: true },
    playerAddress: { type: String, trim: true },
    phone: { type: String, trim: true }, // keep as string for +94, leading zeros

    position: { type: Number }, // "Batter", "Bowler", "All-rounder", "WK"...

    // Role flags
    isBatter: { type: Boolean, default: false },
    isBaller: { type: Boolean, default: false }, // keeping your spelling
    isWk: { type: Boolean, default: false },
    isCaptain: { type: Boolean, default: false },
  },
  { timestamps: true }
);

const AutoIncrement = AutoIncrementFactory(mongoose);
// IMPORTANT: give Player its OWN counter name
PlayerSchema.plugin(AutoIncrement, {
  inc_field: "id",
  id: "player_id_counter",
});

export default mongoose.model("Player", PlayerSchema);
