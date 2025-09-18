// backend/models/Match.js
import mongoose from "mongoose";
import AutoIncrementFactory from "mongoose-sequence";

const MatchSchema = new mongoose.Schema(
  {
    // Auto-increment primary key for matches
    id: { type: Number, unique: true },

    // Manual match number (admin enters this)
    matchNumber: { type: Number, required: true }, // <-- added

    // Foreign keys by NUMERIC IDs
    tournamentId: { type: Number, required: true, index: true },

    // Teams
    team1Id: { type: Number, required: true },
    team2Id: { type: Number, required: true },

    // Match configuration
    overType: { type: String, required: true },       // e.g. "4b", "T20", "50"
    noOfOvers: { type: Number, required: true },
    date: { type: Date, required: true },
    startTime: { type: String, required: true },      // "HH:mm"
  },
  { timestamps: true }
);

// OPTIONAL but recommended: prevent duplicate match numbers within a tournament.
MatchSchema.index({ tournamentId: 1, matchNumber: 1 }, { unique: true });

const AutoIncrement = AutoIncrementFactory(mongoose);
MatchSchema.plugin(AutoIncrement, { inc_field: "id", id: "match_id_counter" });

export default mongoose.model("Match", MatchSchema);
