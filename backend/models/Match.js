// backend/models/Match.js
import mongoose from "mongoose";
import AutoIncrementFactory from "mongoose-sequence";

const MatchSchema = new mongoose.Schema(
  {
    // Auto-increment primary key for matches
    id: { type: Number, unique: true },

    // Manual match number (admin enters this)
    matchNumber: { type: Number, required: true },

    // Foreign keys by NUMERIC IDs
    tournamentId: { type: Number, required: true, index: true },

    // Teams
    team1Id: { type: Number, required: true },
    team2Id: { type: Number, required: true },

    // Match configuration
    // CHANGED: overType is now a Number (e.g., 20, 50, 4 for "4b" cases if you encode numerically)
    overType: { type: Number, required: true },

    noOfOvers: { type: Number, required: true },

    // NEW: flags to indicate whether wides/no-balls are counted in this tournament/match
    IsCountWideBall: { type: Boolean, default: false },  // default false for backward compatibility
    IsCountNoBall:  { type: Boolean, default: false },   // default false for backward compatibility

    date: { type: Date, required: true },
    startTime: { type: String, required: true }, // "HH:mm"
  },
  { timestamps: true }
);

// Prevent duplicate match numbers within a tournament
MatchSchema.index({ tournamentId: 1, matchNumber: 1 }, { unique: true });

const AutoIncrement = AutoIncrementFactory(mongoose);
MatchSchema.plugin(AutoIncrement, { inc_field: "id", id: "match_id_counter" });

export default mongoose.model("Match", MatchSchema);
