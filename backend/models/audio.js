import mongoose from "mongoose";

const audioSchema = new mongoose.Schema({
  fileName: { type: String, required: true },
  audioData: { type: Buffer, required: true },
  contentType: { type: String, required: true },
  author: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  timestamp: { type: Date, default: Date.now },
});

export default mongoose.model("Audio", audioSchema);
