// backend/models/Match.js
import mongoose from "mongoose";
import AutoIncrementFactory from "mongoose-sequence";

const MatchSchema = new mongoose.Schema(
  {
    // Auto-increment primary key for matches
    id: { type: Number, unique: true },

    // Foreign keys by NUMERIC IDs (we store ONLY ids)
    tournamentId: { type: Number, required: true, index: true },

    // Teams (numeric ids from Team model)
    team1Id: { type: Number, required: true },
    team2Id: { type: Number, required: true },
    noOfOvers:{type: Number, required: true},
    // Match configuration
    overType: { type: String, required: true },       // e.g. 20 or 50
    date: { type: Date, required: true },             // match date
    startTime: { type: String, required: true },      // "HH:mm"
  },
  { timestamps: true }
);

const AutoIncrement = AutoIncrementFactory(mongoose);
MatchSchema.plugin(AutoIncrement, { inc_field: "id", id: "match_id_counter" });

export default mongoose.model("Match", MatchSchema);
