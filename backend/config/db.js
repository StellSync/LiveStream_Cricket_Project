// backend/config/db.js
import mongoose from "mongoose";

export async function connectDB(uri) {
  try {
    mongoose.set("strictQuery", true);
    await mongoose.connect(uri, { dbName: "livestream_cricket" });
    console.log(" MongoDB connected");
  } catch (err) {
    console.error(" Mongo connection error:", err.message);
    process.exit(1);
  }
}
