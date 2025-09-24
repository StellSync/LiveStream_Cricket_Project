import mongoose from "mongoose";
import AutoIncrementFactory from "mongoose-sequence";

const TournamentSchema = new mongoose.Schema(
  {
    id: { type: Number, unique: true }, // auto-increment primary key (tournaments)
    name: { type: String, required: true, trim: true },
    date: { type: Date, required: true },
     logo: { type: String,trim: true },      // e.g., "15:00"
    place: { type: String, trim: true },
  },
  { timestamps: true }
);

const AutoIncrement = AutoIncrementFactory(mongoose);
// give this model its OWN counter name
TournamentSchema.plugin(AutoIncrement, { inc_field: "id", id: "tournament_id_counter" });

export default mongoose.model("Tournament", TournamentSchema);
