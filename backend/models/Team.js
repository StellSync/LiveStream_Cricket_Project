import mongoose from "mongoose";
import AutoIncrementFactory from "mongoose-sequence";

const TeamSchema = new mongoose.Schema(
  {
    id: { type: Number, unique: true },                 // auto-increment primary key (teams)
    teamName: { type: String, required: true, trim: true },
    logo: { type: String, required: true, trim: true },
    contactNo: { type: String, required: true, trim: true }, // keep as string for leading 0, +94, etc.
    address: { type: String, required: true, trim: true }
  },
  { timestamps: true }
);

const AutoIncrement = AutoIncrementFactory(mongoose);
// different counter name from Tournament
TeamSchema.plugin(AutoIncrement, { inc_field: "id", id: "team_id_counter" });

export default mongoose.model("Team", TeamSchema);
