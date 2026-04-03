import mongoose from "mongoose";
const UserSchema = mongoose.Schema({
  username: { type: String, required: true },
  displayName: { type: String, required: true },
  avatar: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  phone: { type: String, default: "" },
  bio: { type: String, default: "" },
  location: { type: String, default: "" },
  website: { type: String, default: "" },
  joinedDate: { type: Date, default: Date.now() },
  notificationsEnabled: { type: Boolean, default: true },
  // Tracks the date of the last password-reset request (YYYY-MM-DD string)
  passwordResetDate: { type: String, default: "" },
  // Stores the generated reset password so user can log in with it
  generatedPassword: { type: String, default: "" },
});

export default mongoose.model("User", UserSchema);
