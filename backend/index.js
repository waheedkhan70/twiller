import express from "express";
import cors from "cors";
import mongoose from "mongoose";
import dotenv from "dotenv";
import nodemailer from "nodemailer";
import multer from "multer";
import { parseBuffer } from "music-metadata";
import { v4 as uuidv4 } from "uuid";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";
import User from "./models/user.js";
import Tweet from "./models/tweet.js";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(cors());
app.use(express.json());

// Serve uploaded audio files as static assets
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

const port = process.env.PORT || 5000;
const url = process.env.MONGODB_URL;

// ── In-memory stores ──────────────────────────────────────────────────────────
// otpStore: { email -> { otp, expiresAt } }
const otpStore = new Map();
// verifiedTokens: { token -> { email, expiresAt } }
const verifiedTokens = new Map();

// ── Nodemailer transporter ────────────────────────────────────────────────────
const transporter = nodemailer.createTransport({
  host: "smtp.gmail.com",
  port: 465,
  secure: true, // SSL
  auth: {
    user: process.env.SMTP_EMAIL?.trim(),
    // App Passwords are sometimes copied with spaces — strip them
    pass: process.env.SMTP_PASSWORD?.replace(/\s/g, ""),
  },
});

// ── Multer configuration ──────────────────────────────────────────────────────
const MAX_AUDIO_SIZE_BYTES = 100 * 1024 * 1024; // 100 MB

const audioStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, "uploads", "audio"));
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname) || ".webm";
    cb(null, `audio_${Date.now()}_${uuidv4().slice(0, 8)}${ext}`);
  },
});

const audioUpload = multer({
  storage: audioStorage,
  limits: { fileSize: MAX_AUDIO_SIZE_BYTES },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith("audio/")) {
      cb(null, true);
    } else {
      cb(new Error("Only audio files are allowed"), false);
    }
  },
});

// ── Helper: is current time within 2 PM – 7 PM IST? ─────────────────────────
function isWithinAllowedWindow() {
  const nowIST = new Date(
    new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" })
  );
  const hour = nowIST.getHours();
  const minute = nowIST.getMinutes();
  const totalMinutes = hour * 60 + minute;
  // 14:00 = 840 min, 19:00 = 1140 min
  return totalMinutes >= 840 && totalMinutes < 1140;
}

// ── DB connect + server listen ────────────────────────────────────────────────
mongoose
  .connect(url)
  .then(() => {
    console.log("Connected to MongoDB");
    app.listen(port, () => {
      console.log(`Server running on port ${port}`);
    });
  })
  .catch((err) => {
    console.error("MongoDB connection error:", err.message);
  });

// ── Basic health check ────────────────────────────────────────────────────────
app.get("/", (req, res) => {
  res.send("Twiller backend is running successfully");
});

// ════════════════════════════════════════════════════════════════════════════════
//  USER ROUTES
// ════════════════════════════════════════════════════════════════════════════════

// Register
app.post("/register", async (req, res) => {
  try {
    const existinguser = await User.findOne({ email: req.body.email });
    if (existinguser) {
      return res.status(200).send(existinguser);
    }
    const newUser = new User(req.body);
    await newUser.save();
    return res.status(201).send(newUser);
  } catch (error) {
    return res.status(400).send({ error: error.message });
  }
});

// Logged-in user
app.get("/loggedinuser", async (req, res) => {
  try {
    const { email } = req.query;
    if (!email) {
      return res.status(400).send({ error: "Email required" });
    }
    const user = await User.findOne({ email });
    return res.status(200).send(user);
  } catch (error) {
    return res.status(400).send({ error: error.message });
  }
});

// Update profile
app.patch("/userupdate/:email", async (req, res) => {
  try {
    const { email } = req.params;
    const updated = await User.findOneAndUpdate(
      { email },
      { $set: req.body },
      { new: true, upsert: false }
    );
    return res.status(200).send(updated);
  } catch (error) {
    return res.status(400).send({ error: error.message });
  }
});

// ════════════════════════════════════════════════════════════════════════════════
//  FORGOT PASSWORD ROUTES
// ════════════════════════════════════════════════════════════════════════════════

// Helper: generate a random password using ONLY upper & lowercase letters (no numbers/special chars)
function generateLetterPassword(length = 12) {
  const upper = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const lower = "abcdefghijklmnopqrstuvwxyz";
  const all = upper + lower;
  let password = "";
  // Guarantee at least one uppercase and one lowercase
  password += upper[Math.floor(Math.random() * upper.length)];
  password += lower[Math.floor(Math.random() * lower.length)];
  for (let i = 2; i < length; i++) {
    password += all[Math.floor(Math.random() * all.length)];
  }
  // Shuffle the password characters
  return password.split("").sort(() => Math.random() - 0.5).join("");
}

// Helper: get today's date as YYYY-MM-DD string (local date)
function getTodayString() {
  const now = new Date();
  return now.toISOString().split("T")[0];
}

// POST /forgot-password — request a password reset (once per day)
app.post("/forgot-password", async (req, res) => {
  try {
    const { identifier } = req.body; // email or phone
    if (!identifier || !identifier.trim()) {
      return res.status(400).json({ error: "Email or phone number is required." });
    }

    const trimmed = identifier.trim();

    // Find user by email OR phone
    const user = await User.findOne({
      $or: [{ email: trimmed }, { phone: trimmed }],
    });

    if (!user) {
      return res.status(404).json({ error: "No account found with that email or phone number." });
    }

    // ── One-per-day check ──────────────────────────────────────────────────────
    const today = getTodayString();
    if (user.passwordResetDate === today) {
      return res.status(429).json({
        error: "You can use this option only one time per day.",
        code: "DAILY_LIMIT_REACHED",
      });
    }

    // ── Generate new password (letters only) ───────────────────────────────────
    const newPassword = generateLetterPassword(12);

    // ── Save reset date and generated password to DB ───────────────────────────
    user.passwordResetDate = today;
    user.generatedPassword = newPassword;
    await user.save();

    // ── Always log to console ──────────────────────────────────────────────────
    console.log("\n╔══════════════════════════════════════════╗");
    console.log("║         PASSWORD RESET REQUESTED        ║");
    console.log("╠══════════════════════════════════════════╣");
    console.log(`║  User  : ${user.email.padEnd(32)}║`);
    console.log(`║  Pass  : ${newPassword.padEnd(32)}║`);
    console.log("╚══════════════════════════════════════════╝\n");

    // ── Try to send email (non-fatal) ──────────────────────────────────────────
    let emailSent = false;
    if (user.email) {
      try {
        await transporter.sendMail({
          from: `"Twiller" <${process.env.SMTP_EMAIL}>`,
          to: user.email,
          subject: "Your Twiller Password Reset",
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 520px; margin: 0 auto; background: #000; color: #fff; border-radius: 14px; overflow: hidden;">
              <div style="background: linear-gradient(135deg, #1d9bf0, #7856ff); padding: 28px; text-align: center;">
                <h1 style="margin: 0; font-size: 30px; letter-spacing: -1px;">🐦 Twiller</h1>
                <p style="margin: 6px 0 0; color: rgba(255,255,255,0.85); font-size: 14px;">Password Reset</p>
              </div>
              <div style="padding: 36px;">
                <h2 style="color: #fff; margin-top: 0;">Your New Temporary Password</h2>
                <p style="color: #8b98a5;">Hi <strong style="color:#fff">${user.displayName}</strong>, here is your temporary password. Use it to sign in, then update your password from your profile settings.</p>
                <div style="background: #16181c; border: 1px solid #2f3336; border-radius: 12px; padding: 24px; text-align: center; margin: 24px 0;">
                  <span style="font-size: 28px; font-weight: 700; letter-spacing: 4px; color: #1d9bf0; font-family: monospace;">${newPassword}</span>
                </div>
                <p style="color: #536471; font-size: 13px;">This password was generated automatically and contains only letters. You can request a new one once per day.</p>
                <p style="color: #536471; font-size: 13px;">If you didn't request this, please ignore this email.</p>
              </div>
            </div>
          `,
        });
        emailSent = true;
        console.log(`Password reset email sent to ${user.email}`);
      } catch (emailErr) {
        console.warn(`Email delivery failed. New password is shown in console.\n   ${emailErr.message}`);
      }
    }

    return res.status(200).json({
      message: emailSent
        ? "A new temporary password has been sent to your email."
        : "Password reset successful — check the backend console for your new password (email delivery failed).",
      emailSent,
      // Only expose the password in response when email failed (for dev/testing)
      ...(emailSent ? {} : { generatedPassword: newPassword }),
    });
  } catch (error) {
    console.error("forgot-password error:", error);
    return res.status(500).json({ error: error.message });
  }
});

// ════════════════════════════════════════════════════════════════════════════════
//  TWEET ROUTES
// ════════════════════════════════════════════════════════════════════════════════

// POST tweet
app.post("/post", async (req, res) => {
  try {
    const tweet = new Tweet(req.body);
    await tweet.save();
    return res.status(201).send(tweet);
  } catch (error) {
    return res.status(400).send({ error: error.message });
  }
});

// GET all tweets
app.get("/post", async (req, res) => {
  try {
    const tweet = await Tweet.find().sort({ timestamp: -1 }).populate("author");
    return res.status(200).send(tweet);
  } catch (error) {
    return res.status(400).send({ error: error.message });
  }
});

// LIKE tweet
app.post("/like/:tweetid", async (req, res) => {
  try {
    const { userId } = req.body;
    const tweet = await Tweet.findById(req.params.tweetid);
    if (!tweet.likedBy.includes(userId)) {
      tweet.likes += 1;
      tweet.likedBy.push(userId);
      await tweet.save();
    }
    res.send(tweet);
  } catch (error) {
    return res.status(400).send({ error: error.message });
  }
});

// RETWEET
app.post("/retweet/:tweetid", async (req, res) => {
  try {
    const { userId } = req.body;
    const tweet = await Tweet.findById(req.params.tweetid);
    if (!tweet.retweetedBy.includes(userId)) {
      tweet.retweets += 1;
      tweet.retweetedBy.push(userId);
      await tweet.save();
    }
    res.send(tweet);
  } catch (error) {
    return res.status(400).send({ error: error.message });
  }
});

// ════════════════════════════════════════════════════════════════════════════════
//  AUDIO TWEET — OTP ROUTES
// ════════════════════════════════════════════════════════════════════════════════

// POST /send-otp — generate & email a 6-digit OTP
app.post("/send-otp", async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: "Email is required" });

    // Check time window first
    if (!isWithinAllowedWindow()) {
      return res.status(403).json({
        error: "Audio tweets are only allowed between 2:00 PM and 7:00 PM IST.",
        code: "TIME_RESTRICTED",
      });
    }

    // Verify user exists
    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ error: "User not found" });

    // Generate OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = Date.now() + 10 * 60 * 1000; // 10 minutes
    otpStore.set(email, { otp, expiresAt });

    // ── Always log OTP to console (works even when email fails) ──────────────
    console.log("\n╔═══════════════════════════════════════╗");
    console.log("║           AUDIO TWEET OTP            ║");
    console.log("╠═══════════════════════════════════════╣");
    console.log(`║  Email : ${email.padEnd(29)}║`);
    console.log(`║  OTP   : ${otp.padEnd(29)}║`);
    console.log(`║  Valid : 10 minutes                   ║`);
    console.log("╚═══════════════════════════════════════╝\n");

    // ── Try to send email — failure is non-fatal ──────────────────────────────
    let emailSent = false;
    try {
      await transporter.sendMail({
        from: `"Twiller" <${process.env.SMTP_EMAIL}>`,
        to: email,
        subject: "Your Twiller Audio Tweet OTP",
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto; background: #000; color: #fff; border-radius: 12px; overflow: hidden;">
            <div style="background: linear-gradient(135deg, #1d9bf0, #7856ff); padding: 24px; text-align: center;">
              <h1 style="margin: 0; font-size: 28px; letter-spacing: -1px;">🎙️ Twiller</h1>
            </div>
            <div style="padding: 32px;">
              <h2 style="color: #fff; margin-top: 0;">Audio Tweet Verification</h2>
              <p style="color: #8b98a5;">Use the OTP below to verify your identity before posting an audio tweet. It expires in <strong style="color: #1d9bf0;">10 minutes</strong>.</p>
              <div style="background: #16181c; border: 1px solid #2f3336; border-radius: 12px; padding: 24px; text-align: center; margin: 24px 0;">
                <span style="font-size: 40px; font-weight: 700; letter-spacing: 8px; color: #1d9bf0;">${otp}</span>
              </div>
              <p style="color: #536471; font-size: 13px;">If you didn't request this OTP, please ignore this email.</p>
            </div>
          </div>
        `,
      });
      emailSent = true;
      console.log(` OTP email sent to ${email}`);
    } catch (emailErr) {
      console.warn(` Email delivery failed (check Gmail App Password). OTP is shown above in the console.\n   ${emailErr.message}`);
    }

    return res.status(200).json({
      message: emailSent
        ? "OTP sent to your email"
        : "OTP generated — check the backend console if email did not arrive",
      emailSent,
    });
  } catch (error) {
    console.error("send-otp error:", error);
    return res.status(500).json({ error: error.message });
  }
});

// POST /verify-otp — verify OTP and return a session token
app.post("/verify-otp", async (req, res) => {
  try {
    const { email, otp } = req.body;
    if (!email || !otp)
      return res.status(400).json({ error: "Email and OTP are required" });

    const record = otpStore.get(email);
    if (!record) return res.status(400).json({ error: "No OTP found for this email. Please request a new one." });
    if (Date.now() > record.expiresAt) {
      otpStore.delete(email);
      return res.status(400).json({ error: "OTP has expired. Please request a new one." });
    }
    if (record.otp !== otp.trim()) {
      return res.status(400).json({ error: "Invalid OTP. Please try again." });
    }

    // OTP valid — issue a session token (valid for 15 minutes)
    otpStore.delete(email);
    const token = uuidv4();
    verifiedTokens.set(token, { email, expiresAt: Date.now() + 15 * 60 * 1000 });

    return res.status(200).json({ token, message: "OTP verified successfully" });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

// ════════════════════════════════════════════════════════════════════════════════
//  AUDIO TWEET — UPLOAD ROUTE
// ════════════════════════════════════════════════════════════════════════════════

// POST /audio-tweet — upload audio file and create tweet
app.post("/audio-tweet", audioUpload.single("audio"), async (req, res) => {
  const uploadedFilePath = req.file?.path;
  try {
    const { authorId, content, token } = req.body;

    // 1. Time window check
    if (!isWithinAllowedWindow()) {
      if (uploadedFilePath) fs.unlinkSync(uploadedFilePath);
      return res.status(403).json({
        error: "Audio tweets are only allowed between 2:00 PM and 7:00 PM IST.",
        code: "TIME_RESTRICTED",
      });
    }

    // 2. Token validation
    if (!token) {
      if (uploadedFilePath) fs.unlinkSync(uploadedFilePath);
      return res.status(401).json({ error: "Verification token is required." });
    }
    const tokenRecord = verifiedTokens.get(token);
    if (!tokenRecord || Date.now() > tokenRecord.expiresAt) {
      verifiedTokens.delete(token);
      if (uploadedFilePath) fs.unlinkSync(uploadedFilePath);
      return res.status(401).json({ error: "Session expired or invalid. Please verify OTP again." });
    }

    // 3. File presence
    if (!req.file) {
      return res.status(400).json({ error: "Audio file is required." });
    }

    // 4. Duration check (≤ 5 minutes = 300 seconds)
    const fileBuffer = fs.readFileSync(uploadedFilePath);
    const metadata = await parseBuffer(fileBuffer, { mimeType: req.file.mimetype });
    const durationSeconds = metadata.format.duration || 0;
    if (durationSeconds > 300) {
      fs.unlinkSync(uploadedFilePath);
      return res.status(400).json({
        error: `Audio duration (${Math.ceil(durationSeconds)}s) exceeds the 5-minute limit.`,
        code: "DURATION_EXCEEDED",
      });
    }

    // 5. Author check
    if (!authorId) {
      fs.unlinkSync(uploadedFilePath);
      return res.status(400).json({ error: "Author ID is required." });
    }

    // 6. Build public URL for the audio file
    const audioUrl = `/uploads/audio/${req.file.filename}`;

    // 7. Create tweet — content is optional for audio tweets
    const tweet = new Tweet({
      author: authorId,
      content: content || "🎙️ Audio Tweet",
      audio: audioUrl,
    });
    await tweet.save();

    // Populate author for immediate response
    await tweet.populate("author");

    // Invalidate token after successful use
    verifiedTokens.delete(token);

    return res.status(201).json(tweet);
  } catch (error) {
    if (uploadedFilePath && fs.existsSync(uploadedFilePath)) {
      fs.unlinkSync(uploadedFilePath);
    }
    console.error("audio-tweet error:", error);
    return res.status(500).json({ error: error.message });
  }
});