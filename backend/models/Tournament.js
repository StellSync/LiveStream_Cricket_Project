// backend/models/Tournament.js
import mongoose from "mongoose";
import AutoIncrementFactory from "mongoose-sequence";

const TournamentSchema = new mongoose.Schema(
  {
    id: { type: Number, unique: true },               // auto-increment primary key
    name: { type: String, required: true, trim: true },
    date: { type: Date, required: true },             // calendar date
    startTime: {
      type: String,                                   // time-only, e.g., "14:30"
      required: true,
    },
    place: { type: String, required: true },
  },
  { timestamps: true }
);

const AutoIncrement = AutoIncrementFactory(mongoose);
TournamentSchema.plugin(AutoIncrement, { inc_field: "id" });

export default mongoose.model("Tournament", TournamentSchema);
