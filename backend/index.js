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
import Audio from "./models/audio.js";
import Razorpay from "razorpay";
import crypto from "crypto";
import twilio from "twilio";
import { UAParser } from "ua-parser-js";

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
// languageOtpStore: { email -> { otp, expiresAt, targetLanguage } }
const languageOtpStore = new Map();
// loginOtpStore: { email -> { otp, expiresAt, browser, os, device, ip } }
const loginOtpStore = new Map();

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

// ── Twilio initialization ────────────────────────────────────────────────────
const twilioClient = process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN
  ? twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN)
  : null;

// ── Razorpay initialization ──────────────────────────────────────────────────
const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID || "rzp_test_placeholder",
  key_secret: process.env.RAZORPAY_KEY_SECRET || "dummy_secret",
});

const PLAN_LIMITS = {
  Free: 1,
  Bronze: 3,
  Silver: 5,
  Gold: Infinity,
};

const PLAN_PRICES = {
  Bronze: 100,
  Silver: 300,
  Gold: 1000,
};

// ── Multer configuration ──────────────────────────────────────────────────────
const MAX_AUDIO_SIZE_BYTES = 100 * 1024 * 1024; // 100 MB

const audioStorage = multer.memoryStorage();

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

// ── Helper: is mobile login allowed (10 AM to 1 PM IST)? ──────────────────
function isMobileLoginAllowed() {
  const nowIST = new Date(
    new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" })
  );
  const hour = nowIST.getHours();
  // 10:00 = 10, 11:00 = 11, 12:00 = 12. Between 10 and 1 PM (13:00)
  return hour >= 10 && hour < 13;
}

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

// ── Helper: is current time within 10 AM – 11 AM IST? (for payments) ──────────
function isPaymentWindowOpen() {
  const nowIST = new Date(
    new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" })
  );
  const hour = nowIST.getHours();
  // 10:00 = 10, 11:00 is restricted
  return hour === 10;
}

// ── Helper: calculate tweet limit ─────────────────────────────────────────────
async function checkTweetLimit(userId) {
  const user = await User.findById(userId);
  if (!user) throw new Error("User not found");

  console.log(`DEBUG: User ${user.email} | Plan: ${user.plan} | Count: ${user.tweetCount} | Limit: ${PLAN_LIMITS[user.plan]}`);

  const limit = PLAN_LIMITS[user.plan] || 1;
  if (user.tweetCount >= limit) {
    throw new Error(
      `Post limit reached for ${user.plan} plan (${limit} tweets). Please upgrade to post more.`
    );
  }
  return user;
}

/**
 * Sanitizes and formats an Indian phone number to E.164 format (+91).
 * 
 * @param {string|number} phoneInput - The raw phone number from the client.
 * @returns {string|null} The E.164 formatted number, or null if invalid.
 */
const formatToE164 = (phoneInput) => {
  if (!phoneInput) return null;

  // 1. Convert to string and strip absolutely everything except digits
  let cleaned = phoneInput.toString().replace(/\D/g, '');

  // 2. Handle common Indian prefixes
  // If the user typed '91' at the start (making it 12 digits total)
  if (cleaned.startsWith('91') && cleaned.length === 12) {
    cleaned = cleaned.slice(2);
  } 
  // If the user typed a leading '0' (making it 11 digits total)
  else if (cleaned.startsWith('0') && cleaned.length === 11) {
    cleaned = cleaned.slice(1);
  }

  // 3. Validate that exactly 10 digits remain
  if (cleaned.length !== 10) {
    console.warn(`Invalid phone number: expected 10 digits, got ${cleaned.length}`);
    return null; // Or throw new Error("Invalid phone number format");
  }

  // 4. Return with the required Twilio E.164 formatting
  return `+91${cleaned}`;
};

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

// Login (Backend fallback for generated passwords)
app.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required" });
    }

    const user = await User.findOne({ email: email.trim() });
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    // Check if password matches the generatedPassword
    if (user.generatedPassword && user.generatedPassword === password.trim()) {
      return res.status(200).send(user);
    }

    return res.status(401).json({ error: "Invalid credentials" });
  } catch (error) {
    return res.status(500).json({ error: error.message });
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
//  LOGIN ENVIRONMENT & OTP ROUTES
// ════════════════════════════════════════════════════════════════════════════════

app.post("/login-environment", async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: "Email is required" });

    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ error: "User not found" });

    const parser = new UAParser(req.headers["user-agent"]);
    const result = parser.getResult();
    
    const browser = result.browser.name || "Unknown";
    const os = result.os.name || "Unknown";
    const device = result.device.type || "desktop";
    const ip = req.headers["x-forwarded-for"] || req.socket.remoteAddress || "Unknown";

    if (device === "mobile") {
      if (!isMobileLoginAllowed()) {
        return res.status(403).json({
          error: "Mobile logins are only allowed between 10:00 AM and 1:00 PM IST.",
          code: "TIME_RESTRICTED",
        });
      }
    }

    if (browser === "Chrome") {
      const otp = Math.floor(100000 + Math.random() * 900000).toString();
      const expiresAt = Date.now() + 5 * 1000 * 60; // 5 minutes
      loginOtpStore.set(email, { otp, expiresAt, browser, os, device, ip });

      let emailSent = false;
      try {
        await transporter.sendMail({
          from: `"Twiller Security" <${process.env.SMTP_EMAIL}>`,
          to: email,
          subject: "Twiller Login Verification",
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto; background: #000; color: #fff; border-radius: 12px; overflow: hidden;">
              <div style="background: linear-gradient(135deg, #1d9bf0, #7856ff); padding: 24px; text-align: center;">
                <h1 style="margin: 0; font-size: 28px; letter-spacing: -1px;">🐦 Twiller</h1>
              </div>
              <div style="padding: 32px;">
                <h2 style="color: #fff; margin-top: 0;">Login Verification</h2>
                <p style="color: #8b98a5;">We noticed a login from <strong>Google Chrome</strong>. Use the OTP below to verify your login attempt.</p>
                <div style="background: #16181c; border: 1px solid #2f3336; border-radius: 12px; padding: 24px; text-align: center; margin: 24px 0;">
                  <span style="font-size: 40px; font-weight: 700; letter-spacing: 8px; color: #1d9bf0;">${otp}</span>
                </div>
                <p style="color: #536471; font-size: 13px;">If this wasn't you, someone may be trying to access your account.</p>
              </div>
            </div>
          `,
        });
        emailSent = true;
        console.log(`Login OTP sent to ${email}`);
      } catch (emailErr) {
        console.warn(`Login OTP email delivery failed. OTP: ${otp}\n   ${emailErr.message}`);
      }

      return res.status(200).json({ requiresOtp: true, message: "OTP sent to your email for verification.", emailSent });
    }

    // Otherwise, record login and succeed
    user.loginHistory.push({ browser, os, device, ip, timestamp: new Date() });
    await user.save();

    return res.status(200).json({ requiresOtp: false, user, message: "Login environment verified." });
  } catch (error) {
    console.error("login-environment error:", error);
    return res.status(500).json({ error: error.message });
  }
});

app.post("/verify-login-otp", async (req, res) => {
  try {
    const { email, otp } = req.body;
    if (!email || !otp) return res.status(400).json({ error: "Email and OTP are required" });

    const record = loginOtpStore.get(email);
    if (!record) return res.status(400).json({ error: "No OTP found for this email. Please request a new one." });
    
    if (Date.now() > record.expiresAt) {
      loginOtpStore.delete(email);
      return res.status(400).json({ error: "OTP has expired. Please try logging in again." });
    }

    if (record.otp !== otp.trim()) {
      return res.status(400).json({ error: "Invalid OTP. Please try again." });
    }

    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ error: "User not found" });

    user.loginHistory.push({
      browser: record.browser,
      os: record.os,
      device: record.device,
      ip: record.ip,
      timestamp: new Date()
    });
    await user.save();

    loginOtpStore.delete(email);

    return res.status(200).json({ success: true, user, message: "OTP verified successfully." });
  } catch (error) {
    return res.status(500).json({ error: error.message });
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
    const { identifier, customPassword } = req.body; // email/phone and optional custom password
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

    // ── Determine new password (custom or generated) ───────────────────────────
    const newPassword = (customPassword && customPassword.trim())
      ? customPassword.trim()
      : generateLetterPassword(12);

    const isCustom = !!(customPassword && customPassword.trim());

    // ── Save reset date and password to DB ─────────────────────────────────────
    user.passwordResetDate = today;
    user.generatedPassword = newPassword;
    await user.save();

    // ── Always log to console ──────────────────────────────────────────────────
    console.log("\n╔══════════════════════════════════════════╗");
    console.log(`║    PASSWORD RESET (${isCustom ? "CUSTOM" : "AUTO-GEN"})    ║`);
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
//  SUBSCRIPTION & PAYMENT ROUTES
// ════════════════════════════════════════════════════════════════════════════════

// POST /create-subscription-order
app.post("/create-subscription-order", async (req, res) => {
  try {
    if (!isPaymentWindowOpen()) {
      return res.status(403).json({
        error: "Payments are only allowed between 10:00 AM and 11:00 AM IST.",
        code: "PAYMENT_TIME_RESTRICTED",
      });
    }

    const { plan, userId } = req.body;
    if (!PLAN_PRICES[plan]) {
      return res.status(400).json({ error: "Invalid plan selected" });
    }

    const amount = PLAN_PRICES[plan] * 100; // in paise
    const options = {
      amount,
      currency: "INR",
      receipt: `receipt_${uuidv4().slice(0, 8)}`,
    };

    const order = await razorpay.orders.create(options);
    return res.status(200).json(order);
  } catch (error) {
    console.error("create-subscription-order error:", error);
    return res.status(500).json({ error: error.message });
  }
});

// POST /verify-subscription-payment
app.post("/verify-subscription-payment", async (req, res) => {
  try {
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      userId,
      plan,
    } = req.body;

    const sign = razorpay_order_id + "|" + razorpay_payment_id;
    const expectedSign = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET || "dummy_secret")
      .update(sign.toString())
      .digest("hex");

    if (razorpay_signature === expectedSign) {
      console.log(`[PAYMENT VERIFIED] userId: ${userId} | Target Plan: ${plan}`);
      
      const user = await User.findByIdAndUpdate(
        userId,
        { $set: { plan, tweetCount: 0 } },
        { new: true }
      );

      if (!user) {
        console.error(`[PAYMENT ERROR] User not found during update: ${userId}`);
        return res.status(404).json({ error: "User not found during plan update." });
      }

      console.log(`[PLAN UPDATED] User: ${user.email} | New Plan: ${user.plan}`);

      // Send Invoice Email
      try {
        await transporter.sendMail({
          from: `"Twiller Premium" <${process.env.SMTP_EMAIL}>`,
          to: user.email,
          subject: `Invoice: ${plan} Plan Subscription`,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #000; color: #fff; border: 1px solid #2f3336; border-radius: 12px; overflow: hidden;">
              <div style="background: linear-gradient(135deg, #1d9bf0, #7856ff); padding: 30px; text-align: center;">
                <h1 style="margin: 0; font-size: 32px; letter-spacing: -1px;">🐦 Twiller Invoice</h1>
              </div>
              <div style="padding: 40px;">
                <h2 style="color: #fff; margin-top: 0;">Subscription Success!</h2>
                <p style="color: #8b98a5;">Hi <strong style="color: #fff;">${user.displayName}</strong>, your payment was successful. Your account has been upgraded to the <strong style="color: #1d9bf0;">${plan} Plan</strong>.</p>
                
                <div style="margin: 30px 0; padding: 20px; background: #16181c; border-radius: 8px; border: 1px solid #2f3336;">
                  <table style="width: 100%; border-collapse: collapse;">
                    <tr>
                      <td style="color: #536471; padding: 8px 0;">Order ID</td>
                      <td style="color: #fff; text-align: right; padding: 8px 0;">${razorpay_order_id}</td>
                    </tr>
                    <tr>
                      <td style="color: #536471; padding: 8px 0;">Payment ID</td>
                      <td style="color: #fff; text-align: right; padding: 8px 0;">${razorpay_payment_id}</td>
                    </tr>
                    <tr style="border-top: 1px solid #2f3336;">
                      <td style="color: #fff; font-weight: bold; padding: 15px 0 8px;">Total Amount</td>
                      <td style="color: #1d9bf0; font-weight: bold; font-size: 20px; text-align: right; padding: 15px 0 8px;">₹${PLAN_PRICES[plan]}</td>
                    </tr>
                  </table>
                </div>

                <div style="padding: 20px; background: rgba(29,155,240,0.1); border-radius: 8px; border-left: 4px solid #1d9bf0;">
                  <p style="margin: 0; color: #fff; font-weight: 600;">Plan Benefits:</p>
                  <p style="margin: 5px 0 0; color: #8b98a5; font-size: 14px;">Up to ${PLAN_LIMITS[plan] === Infinity ? "Unlimited" : PLAN_LIMITS[plan]} tweets per month.</p>
                </div>

                <p style="margin-top: 30px; font-size: 13px; color: #536471; text-align: center;">Thank you for supporting Twiller Premium!</p>
              </div>
            </div>
          `,
        });
      } catch (emailErr) {
        console.warn("Invoice email failed:", emailErr.message);
      }

      return res.status(200).json({ message: "Payment verified and plan updated", user });
    } else {
      console.error("Signature verification failed. Check if KEY_SECRET matches.");
      return res.status(400).json({ error: "Invalid signature" });
    }
  } catch (error) {
    console.error("verify-subscription-payment error:", error);
    return res.status(500).json({ error: error.message });
  }
});

// ════════════════════════════════════════════════════════════════════════════════
//  TWEET ROUTES
// ════════════════════════════════════════════════════════════════════════════════

// POST tweet
app.post("/post", async (req, res) => {
  try {
    const { author } = req.body;
    await checkTweetLimit(author);

    const tweet = new Tweet(req.body);
    await tweet.save();

    // Increment user's tweet count
    await User.findByIdAndUpdate(author, { $inc: { tweetCount: 1 } });

    return res.status(201).send(tweet);
  } catch (error) {
    return res.status(400).send({ error: error.message });
  }
});

// DELETE tweet
app.delete("/post/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({ error: "User ID is required for deletion." });
    }

    const tweet = await Tweet.findById(id);
    if (!tweet) {
      return res.status(404).json({ error: "Tweet not found." });
    }

    // Authorization check
    if (tweet.author.toString() !== userId) {
      return res.status(403).json({ error: "You are not authorized to delete this tweet." });
    }

    await Tweet.findByIdAndDelete(id);

    // Decrement user's tweet count
    await User.findByIdAndUpdate(userId, { $inc: { tweetCount: -1 } });

    return res.status(200).json({ message: "Tweet deleted successfully." });
  } catch (error) {
    return res.status(500).json({ error: error.message });
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
  try {
    const { authorId, content, token } = req.body;

    // 1. Time window check
    if (!isWithinAllowedWindow()) {
      return res.status(403).json({
        error: "Audio tweets are only allowed between 2:00 PM and 7:00 PM IST.",
        code: "TIME_RESTRICTED",
      });
    }

    // 2. Token validation
    if (!token) {
      return res.status(401).json({ error: "Verification token is required." });
    }
    const tokenRecord = verifiedTokens.get(token);
    if (!tokenRecord || Date.now() > tokenRecord.expiresAt) {
      verifiedTokens.delete(token);
      return res.status(401).json({ error: "Session expired or invalid. Please verify OTP again." });
    }

    // 3. File presence
    if (!req.file) {
      return res.status(400).json({ error: "Audio file is required." });
    }

    // 4. Duration check (≤ 5 minutes = 300 seconds)
    const metadata = await parseBuffer(req.file.buffer, { mimeType: req.file.mimetype });
    const durationSeconds = metadata.format.duration || 0;
    if (durationSeconds > 300) {
      return res.status(400).json({
        error: `Audio duration (${Math.ceil(durationSeconds)}s) exceeds the 5-minute limit.`,
        code: "DURATION_EXCEEDED",
      });
    }

    // 5. Author check
    if (!authorId) {
      return res.status(400).json({ error: "Author ID is required." });
    }

    // Check tweet limit
    await checkTweetLimit(authorId);

    // 6. Save Audio to DB
    const newAudio = new Audio({
      fileName: req.file.originalname,
      audioData: req.file.buffer,
      contentType: req.file.mimetype,
      author: authorId,
    });
    await newAudio.save();

    // 7. Create tweet
    const audioUrl = `/api/audio/${newAudio._id}`;
    const tweet = new Tweet({
      author: authorId,
      content: content || "🎙️ Audio Tweet",
      audio: audioUrl,
    });
    await tweet.save();

    // Increment user's tweet count
    await User.findByIdAndUpdate(authorId, { $inc: { tweetCount: 1 } });

    // Populate author for immediate response
    await tweet.populate("author");

    // Invalidate token after successful use
    verifiedTokens.delete(token);

    return res.status(201).json(tweet);
  } catch (error) {
    console.error("audio-tweet error:", error);
    return res.status(500).json({ error: error.message });
  }
});

// GET /api/audio/:id - stream audio file from DB
app.get("/api/audio/:id", async (req, res) => {
  try {
    const audio = await Audio.findById(req.params.id);
    if (!audio || !audio.audioData) {
      return res.status(404).send("Audio not found");
    }
    res.set("Content-Type", audio.contentType);
    res.send(audio.audioData);
  } catch (error) {
    console.error("audio streaming error:", error);
    res.status(500).send("Error retrieving audio");
  }
});
// ════════════════════════════════════════════════════════════════════════════════
//  LANGUAGE CHANGE — OTP ROUTES
// ════════════════════════════════════════════════════════════════════════════════

// POST /send-language-otp — generate & send OTP for language change
app.post("/send-language-otp", async (req, res) => {
  try {
    const { email, language } = req.body;
    if (!email || !language) return res.status(400).json({ error: "Email and target language are required" });

    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ error: "User not found" });

    // Generate OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = Date.now() + 5 * 1000 * 60; // 5 minutes
    languageOtpStore.set(email, { otp, expiresAt, targetLanguage: language });

    const isFrench = language === "fr";

    if (isFrench) {
      // Send to email
      console.log(`Sending language switch OTP to email: ${email}`);
      let emailSent = false;
      try {
        await transporter.sendMail({
          from: `"Twiller Security" <${process.env.SMTP_EMAIL}>`,
          to: email,
          subject: "Twiller Language Change Verification",
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto; background: #000; color: #fff; border-radius: 12px; overflow: hidden;">
              <div style="background: linear-gradient(135deg, #1d9bf0, #7856ff); padding: 24px; text-align: center;">
                <h1 style="margin: 0; font-size: 28px; letter-spacing: -1px;">🐦 Twiller</h1>
              </div>
              <div style="padding: 32px;">
                <h2 style="color: #fff; margin-top: 0;">Language Switch Verification</h2>
                <p style="color: #8b98a5;">You requested to change your language to <strong>French</strong>. Use the OTP below to verify your request.</p>
                <div style="background: #16181c; border: 1px solid #2f3336; border-radius: 12px; padding: 24px; text-align: center; margin: 24px 0;">
                  <span style="font-size: 40px; font-weight: 700; letter-spacing: 8px; color: #1d9bf0;">${otp}</span>
                </div>
                <p style="color: #536471; font-size: 13px;">This OTP will expire in 5 minutes.</p>
              </div>
            </div>
          `,
        });
        emailSent = true;
      } catch (err) {
        console.warn(`Language OTP email failed: ${err.message}`);
      }
      
      console.log("\n╔═══════════════════════════════════════╗");
      console.log("║         LANGUAGE CHANGE OTP (FR)      ║");
      console.log("╠═══════════════════════════════════════╣");
      console.log(`║  Email : ${email.padEnd(29)}║`);
      console.log(`║  OTP   : ${otp.padEnd(29)}║`);
      console.log("╚═══════════════════════════════════════╝\n");

      return res.status(200).json({ message: emailSent ? "OTP sent to your email" : "OTP generated (check console)", emailSent, method: "email" });
    } else {
      // Send to mobile logic
      let phoneNumber = user.phone ? user.phone.trim() : "";
      
      // Format to E.164
      phoneNumber = formatToE164(phoneNumber);
      
      if (!phoneNumber) {
        return res.status(400).json({ error: "A valid 10-digit registered Indian mobile number is required to switch to this language." });
      }

      let smsSent = false;
      if (twilioClient && process.env.TWILIO_FROM_NUMBER) {
        // Try real SMS
        console.log(`Sending language switch OTP via Twilio to: ${phoneNumber}`);
        try {
          await twilioClient.messages.create({
            body: `Twiller: Your language change OTP is ${otp}. It expires in 5 minutes.`,
            from: process.env.TWILIO_FROM_NUMBER,
            to: phoneNumber,
          });
          smsSent = true;
        } catch (err) {
          console.warn(` Twilio SMS failed: ${err.message}`);
          return res.status(500).json({ error: "Failed to send SMS. Please check mobile number or service." });
        }
      } else {
         console.warn(` Twilio is not configured. Showing OTP in console.`);
      }

      console.log("\n╔═══════════════════════════════════════╗");
      console.log("║      LANGUAGE CHANGE OTP (MOBILE)     ║");
      console.log("╠═══════════════════════════════════════╣");
      console.log(`║  Email : ${email.padEnd(29)}║`);
      console.log(`║  Phone : ${phoneNumber.padEnd(29)}║`);
      console.log(`║  OTP   : ${otp.padEnd(29)}║`);
      console.log(`║  Sent  : ${smsSent ? "Twilio SMS" : "Console Only"}  ║`);
      console.log("╚═══════════════════════════════════════╝\n");

      return res.status(200).json({ 
        message: smsSent ? "OTP sent to your mobile number" : "OTP generated (check console)", 
        smsSent, 
        method: "mobile"
      });
    }
  } catch (error) {
    console.error("send-language-otp error:", error);
    return res.status(500).json({ error: error.message });
  }
});

// POST /verify-language-otp — verify OTP and update language
app.post("/verify-language-otp", async (req, res) => {
  try {
    const { email, otp } = req.body;
    if (!email || !otp) return res.status(400).json({ error: "Email and OTP are required" });

    const record = languageOtpStore.get(email);
    if (!record) return res.status(400).json({ error: "No OTP found. Please request a new one." });
    if (Date.now() > record.expiresAt) {
      languageOtpStore.delete(email);
      return res.status(400).json({ error: "OTP has expired." });
    }
    if (record.otp !== otp.trim()) {
      return res.status(400).json({ error: "Invalid OTP." });
    }

    const { targetLanguage } = record;
    languageOtpStore.delete(email);

    // Update user language in DB
    const user = await User.findOneAndUpdate({ email }, { $set: { language: targetLanguage } }, { new: true });

    return res.status(200).json({ message: "Language updated successfully", user, language: targetLanguage });
  } catch (error) {
    console.error("verify-language-otp error:", error);
    return res.status(500).json({ error: error.message });
  }
});
