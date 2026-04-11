"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import { useAuth } from "@/context/AuthContext";
import axiosInstance from "@/lib/axiosInstance";
import axios from "axios";
import { Zap } from "lucide-react";

const PLAN_LIMITS: Record<string, number> = {
  Free: 1,
  Bronze: 3,
  Silver: 5,
  Gold: Infinity,
};

// ─── Types ─────────────────────────────────────────────────────────────────────
type Step = "time-check" | "request-otp" | "verify-otp" | "upload";
type UploadTab = "record" | "upload";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onTweetPosted: (tweet: any) => void;
}

// ─── Helpers ───────────────────────────────────────────────────────────────────
function isWithinAllowedWindow(): boolean {
  const nowIST = new Date(
    new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" })
  );
  const h = nowIST.getHours();
  const m = nowIST.getMinutes();
  const total = h * 60 + m;
  return total >= 14 * 60 && total < 19 * 60;
}

function formatTime(secs: number) {
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function maskEmail(email: string) {
  const [user, domain] = email.split("@");
  const visible = user.slice(0, 2);
  const stars = "*".repeat(Math.max(user.length - 2, 3));
  return `${visible}${stars}@${domain}`;
}

const MAX_DURATION_SECONDS = 300; // 5 min
const MAX_FILE_SIZE_BYTES = 100 * 1024 * 1024; // 100 MB
const BACKEND_URL = "http://localhost:5005";

// ─── Component ─────────────────────────────────────────────────────────────────
export default function AudioTweetModal({ isOpen, onClose, onTweetPosted }: Props) {
  const { user, refreshUser } = useAuth();

  const [step, setStep] = useState<Step>("request-otp");
  const [activeTab, setActiveTab] = useState<UploadTab>("record");

  const currentLimit = PLAN_LIMITS[user?.plan || "Free"];
  const isAtTweetLimit = (user?.tweetCount || 0) >= currentLimit;

  // OTP state
  const [otpCode, setOtpCode] = useState(["", "", "", "", "", ""]);
  const [otpError, setOtpError] = useState("");
  const [otpLoading, setOtpLoading] = useState(false);
  const [resendCountdown, setResendCountdown] = useState(0);
  const [verifiedToken, setVerifiedToken] = useState("");
  const [emailSentHint, setEmailSentHint] = useState(false); // true = email failed, OTP is in backend console

  // Recording state
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
  const [recordedUrl, setRecordedUrl] = useState("");

  // Upload state
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [uploadedUrl, setUploadedUrl] = useState("");
  const [uploadError, setUploadError] = useState("");

  // Caption
  const [caption, setCaption] = useState("");

  // Submission
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");

  // Waveform bars
  const [waveformBars, setWaveformBars] = useState<number[]>(Array(30).fill(4));

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const recordingTimerRef = useRef<NodeJS.Timeout | null>(null);
  const resendTimerRef = useRef<NodeJS.Timeout | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animFrameRef = useRef<number>(0);
  const otpRefs = useRef<(HTMLInputElement | null)[]>([]);

  // ── Reset when modal opens/closes ────────────────────────────────────────────
  useEffect(() => {
    if (isOpen) {
      const allowed = isWithinAllowedWindow();
      setStep(allowed ? "request-otp" : "time-check");
      setOtpCode(["", "", "", "", "", ""]);
      setOtpError("");
      setVerifiedToken("");
      setRecordedBlob(null);
      setRecordedUrl("");
      setUploadedFile(null);
      setUploadedUrl("");
      setUploadError("");
      setCaption("");
      setSubmitError("");
      setIsRecording(false);
      setRecordingSeconds(0);
      setResendCountdown(0);
    } else {
      stopRecording();
    }
  }, [isOpen]);

  // ── Resend countdown ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (resendCountdown <= 0) return;
    resendTimerRef.current = setTimeout(() => setResendCountdown((c) => c - 1), 1000);
    return () => { if (resendTimerRef.current) clearTimeout(resendTimerRef.current); };
  }, [resendCountdown]);

  // ── Recording timer ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (isRecording) {
      recordingTimerRef.current = setInterval(() => {
        setRecordingSeconds((prev) => {
          if (prev >= MAX_DURATION_SECONDS - 1) {
            stopRecording();
            return prev;
          }
          return prev + 1;
        });
      }, 1000);
    } else {
      if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
    }
    return () => { if (recordingTimerRef.current) clearInterval(recordingTimerRef.current); };
  }, [isRecording]);

  // ── Waveform animation ───────────────────────────────────────────────────────
  const animateWaveform = useCallback(() => {
    if (!analyserRef.current) return;
    const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
    analyserRef.current.getByteFrequencyData(dataArray);
    const bars = Array.from({ length: 30 }, (_, i) => {
      const idx = Math.floor((i / 30) * dataArray.length);
      return Math.max(4, (dataArray[idx] / 255) * 56);
    });
    setWaveformBars(bars);
    animFrameRef.current = requestAnimationFrame(animateWaveform);
  }, []);

  // ── OTP Input handlers ───────────────────────────────────────────────────────
  const handleOtpChange = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return;
    const newOtp = [...otpCode];
    newOtp[index] = value.slice(-1);
    setOtpCode(newOtp);
    setOtpError("");
    if (value && index < 5) {
      otpRefs.current[index + 1]?.focus();
    }
  };

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === "Backspace" && !otpCode[index] && index > 0) {
      otpRefs.current[index - 1]?.focus();
    }
  };

  const handleOtpPaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const paste = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    const newOtp = paste.split("").concat(Array(6).fill("")).slice(0, 6);
    setOtpCode(newOtp);
    otpRefs.current[Math.min(paste.length, 5)]?.focus();
  };

  // ── Send OTP ─────────────────────────────────────────────────────────────────
  const sendOtp = async () => {
    if (!user?.email) return;
    if (isAtTweetLimit) {
      setOtpError(`Limit reached for ${user?.plan} plan. Please upgrade.`);
      return;
    }
    setOtpLoading(true);
    setOtpError("");
    try {
      const res = await axios.post(`${BACKEND_URL}/send-otp`, { email: user.email });
      // emailSent=false means Gmail creds failed but OTP was printed to backend console
      setEmailSentHint(res.data.emailSent === false);
      setStep("verify-otp");
      setResendCountdown(60);
    } catch (err: any) {
      const msg = err.response?.data?.error || "Failed to send OTP. Please try again.";
      setOtpError(msg);
    } finally {
      setOtpLoading(false);
    }
  };

  // ── Verify OTP ───────────────────────────────────────────────────────────────
  const verifyOtp = async () => {
    const otp = otpCode.join("");
    if (otp.length !== 6) {
      setOtpError("Please enter the complete 6-digit OTP.");
      return;
    }
    setOtpLoading(true);
    setOtpError("");
    try {
      const res = await axios.post(`${BACKEND_URL}/verify-otp`, { email: user?.email, otp });
      setVerifiedToken(res.data.token);
      setStep("upload");
    } catch (err: any) {
      setOtpError(err.response?.data?.error || "OTP verification failed.");
    } finally {
      setOtpLoading(false);
    }
  };

  // ── Start Recording ──────────────────────────────────────────────────────────
  const startRecording = async () => {
    try {
      setRecordedBlob(null);
      setRecordedUrl("");
      setRecordingSeconds(0);
      chunksRef.current = [];

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      // Set up analyser for waveform
      const audioCtx = new AudioContext();
      const source = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      analyserRef.current = analyser;
      animFrameRef.current = requestAnimationFrame(animateWaveform);

      const recorder = new MediaRecorder(stream, { mimeType: "audio/webm" });
      recorder.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        setRecordedBlob(blob);
        setRecordedUrl(URL.createObjectURL(blob));
        cancelAnimationFrame(animFrameRef.current);
        setWaveformBars(Array(30).fill(4));
        stream.getTracks().forEach((t) => t.stop());
      };
      recorder.start(100);
      mediaRecorderRef.current = recorder;
      setIsRecording(true);
    } catch {
      setUploadError("Could not access microphone. Please grant microphone permission.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current?.state === "recording") {
      mediaRecorderRef.current.stop();
    }
    setIsRecording(false);
    cancelAnimationFrame(animFrameRef.current);
  };

  // ── File Upload validation ───────────────────────────────────────────────────
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadError("");

    if (file.size > MAX_FILE_SIZE_BYTES) {
      setUploadError(`File size (${(file.size / 1024 / 1024).toFixed(1)} MB) exceeds the 100 MB limit.`);
      return;
    }

    // Client-side duration check
    try {
      const duration = await getAudioDuration(file);
      if (duration > MAX_DURATION_SECONDS) {
        setUploadError(`Audio duration (${Math.ceil(duration)}s) exceeds the 5-minute limit.`);
        return;
      }
    } catch {
      // If we can't parse, let the server validate
    }

    setUploadedFile(file);
    setUploadedUrl(URL.createObjectURL(file));
  };

  const getAudioDuration = (file: File): Promise<number> => {
    return new Promise((resolve, reject) => {
      const audio = new Audio();
      audio.src = URL.createObjectURL(file);
      audio.onloadedmetadata = () => resolve(audio.duration);
      audio.onerror = reject;
    });
  };

  // ── Submit Audio Tweet ───────────────────────────────────────────────────────
  const submitAudioTweet = async () => {
    const audioFile = activeTab === "record" ? recordedBlob : uploadedFile;
    if (!audioFile || !user?._id || !verifiedToken) return;

    setSubmitting(true);
    setSubmitError("");

    const formData = new FormData();
    formData.append("audio", audioFile, activeTab === "record" ? "recording.webm" : (uploadedFile as File).name);
    formData.append("authorId", user._id);
    formData.append("content", caption.trim() || "Audio Tweet");
    formData.append("token", verifiedToken);

    try {
      const res = await axios.post(`${BACKEND_URL}/audio-tweet`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      onTweetPosted(res.data);
      refreshUser(); // Sync tweetCount
      onClose();
    } catch (err: any) {
      setSubmitError(err.response?.data?.error || "Failed to post audio tweet.");
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen || !user) return null;

  // ── Computed values ───────────────────────────────────────────────────────────
  const hasAudio = activeTab === "record" ? !!recordedBlob : !!uploadedFile;
  const recordProgress = (recordingSeconds / MAX_DURATION_SECONDS) * 100;

  return (
    <div className="audio-modal-overlay" onClick={(e) => { if ((e.target as HTMLElement).classList.contains("audio-modal-overlay")) onClose(); }}>
      <div className="audio-modal">
        {/* ── Header ── */}
        <div className="audio-modal-header">
          <div className="audio-modal-title">
            <span className="audio-modal-icon"></span>
            <span>Audio Tweet</span>
          </div>
          <button className="audio-modal-close" onClick={onClose} aria-label="Close">✕</button>
        </div>

        {/* ══════════════════════════════════════════════════════════════════════
            STEP: TIME RESTRICTED
        ══════════════════════════════════════════════════════════════════════ */}
        {step === "time-check" && (
          <div className="audio-step">
            <div className="audio-time-restricted">
              <div className="audio-time-icon"></div>
              <h3>Feature Unavailable Right Now</h3>
              <p>Audio tweets can only be posted between</p>
              <div className="audio-time-window">2:00 PM – 7:00 PM IST</div>
              <p className="audio-time-sub">Please come back during this window to post your audio tweet.</p>
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════════════
            STEP: REQUEST OTP
        ══════════════════════════════════════════════════════════════════════ */}
        {step === "request-otp" && (
          <div className="audio-step">
            <div className="audio-otp-intro">
              <div className="audio-shield-icon"></div>
              <h3>Verify Your Identity</h3>
              <p>
                To post an audio tweet, we'll send a one-time passcode to
              </p>
              <div className="audio-email-badge">{maskEmail(user.email)}</div>
            </div>

            {otpError && <div className="audio-error">{otpError}</div>}

            <button
              className="audio-btn-primary"
              onClick={sendOtp}
              disabled={otpLoading}
            >
              {otpLoading ? <span className="audio-spinner" /> : "Send OTP to my Email"}
            </button>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════════════
            STEP: VERIFY OTP
        ══════════════════════════════════════════════════════════════════════ */}
        {step === "verify-otp" && (
          <div className="audio-step">
            <div className="audio-otp-intro">
              <div className="audio-shield-icon"></div>
              <h3>Enter your OTP</h3>
              <p>We sent a 6-digit code to <strong>{maskEmail(user.email)}</strong></p>
            </div>

            {/* Console-hint banner when email delivery failed */}
            {emailSentHint && (
              <div className="audio-console-hint">
                <span className="audio-console-hint-icon"></span>
                <div>
                  <p className="audio-console-hint-title">Email not delivered</p>
                  <p className="audio-console-hint-body">
                    Check your <strong>backend terminal</strong> for the OTP — it was printed there.
                  </p>
                </div>
              </div>
            )}

            <div className="audio-otp-inputs" onPaste={handleOtpPaste}>
              {otpCode.map((digit, i) => (
                <input
                  key={i}
                  ref={(el) => { otpRefs.current[i] = el; }}
                  type="text"
                  inputMode="numeric"
                  maxLength={1}
                  value={digit}
                  onChange={(e) => handleOtpChange(i, e.target.value)}
                  onKeyDown={(e) => handleOtpKeyDown(i, e)}
                  className={`audio-otp-box ${otpError ? "audio-otp-error" : ""}`}
                  id={`otp-${i}`}
                />
              ))}
            </div>

            {otpError && <div className="audio-error">{otpError}</div>}

            <button
              className="audio-btn-primary"
              onClick={verifyOtp}
              disabled={otpLoading || otpCode.join("").length !== 6}
            >
              {otpLoading ? <span className="audio-spinner" /> : "Verify OTP"}
            </button>

            <div className="audio-resend-row">
              {resendCountdown > 0 ? (
                <span className="audio-resend-timer">Resend in {resendCountdown}s</span>
              ) : (
                <button
                  className="audio-btn-ghost"
                  onClick={() => { setStep("request-otp"); sendOtp(); }}
                >
                  Resend OTP
                </button>
              )}
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════════════
            STEP: UPLOAD / RECORD
        ══════════════════════════════════════════════════════════════════════ */}
        {step === "upload" && (
          <div className="audio-step">
            {/* Tab switcher */}
            <div className="audio-tabs">
              <button
                className={`audio-tab ${activeTab === "record" ? "audio-tab-active" : ""}`}
                onClick={() => setActiveTab("record")}
              >
                Record
              </button>
              <button
                className={`audio-tab ${activeTab === "upload" ? "audio-tab-active" : ""}`}
                onClick={() => setActiveTab("upload")}
              >
                Upload File
              </button>
            </div>

            {/* ── RECORD TAB ── */}
            {activeTab === "record" && (
              <div className="audio-record-panel">
                {/* Waveform */}
                <div className="audio-waveform">
                  {waveformBars.map((h, i) => (
                    <div
                      key={i}
                      className={`audio-bar ${isRecording ? "audio-bar-active" : ""}`}
                      style={{ height: `${h}px` }}
                    />
                  ))}
                </div>

                {/* Timer */}
                <div className="audio-record-timer">
                  <span className={`audio-timer-text ${isRecording ? "audio-timer-recording" : ""}`}>
                    {formatTime(recordingSeconds)}
                  </span>
                  <span className="audio-timer-max">/ 5:00</span>
                </div>

                {/* Progress bar */}
                {isRecording && (
                  <div className="audio-progress-track">
                    <div className="audio-progress-fill" style={{ width: `${recordProgress}%` }} />
                  </div>
                )}

                {/* Controls */}
                <div className="audio-record-controls">
                  {!isRecording && !recordedBlob && (
                    <button className="audio-btn-record" onClick={startRecording}>
                      <span className="audio-rec-dot" /> Start Recording
                    </button>
                  )}
                  {isRecording && (
                    <button className="audio-btn-stop" onClick={stopRecording}>
                      ⏹ Stop Recording
                    </button>
                  )}
                  {recordedBlob && !isRecording && (
                    <div className="audio-recorded-actions">
                      <audio src={recordedUrl} controls className="audio-player" />
                      <button
                        className="audio-btn-ghost"
                        onClick={() => { setRecordedBlob(null); setRecordedUrl(""); setRecordingSeconds(0); }}
                      >
                        Re-record
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ── UPLOAD TAB ── */}
            {activeTab === "upload" && (
              <div className="audio-upload-panel">
                {!uploadedFile ? (
                  <label className="audio-dropzone" htmlFor="audioFileInput">
                    <div className="audio-dropzone-icon">🎵</div>
                    <p className="audio-dropzone-text">Click to choose an audio file</p>
                    <p className="audio-dropzone-sub">MP3, WAV, OGG, M4A, WebM · Max 100 MB · Max 5 min</p>
                    <input
                      id="audioFileInput"
                      type="file"
                      accept="audio/*"
                      className="hidden"
                      onChange={handleFileChange}
                    />
                  </label>
                ) : (
                  <div className="audio-file-preview">
                    <div className="audio-file-info">
                      <span className="audio-file-icon"></span>
                      <div>
                        <p className="audio-file-name">{uploadedFile.name}</p>
                        <p className="audio-file-size">{(uploadedFile.size / 1024 / 1024).toFixed(2)} MB</p>
                      </div>
                    </div>
                    <audio src={uploadedUrl} controls className="audio-player" />
                    <button
                      className="audio-btn-ghost-sm"
                      onClick={() => { setUploadedFile(null); setUploadedUrl(""); }}
                    >
                      Remove
                    </button>
                  </div>
                )}
                {uploadError && <div className="audio-error">{uploadError}</div>}
              </div>
            )}

            {/* Caption */}
            {hasAudio && (
              <div className="audio-caption-section">
                <textarea
                  className="audio-caption"
                  placeholder="Add a caption... (optional)"
                  value={caption}
                  onChange={(e) => setCaption(e.target.value)}
                  maxLength={200}
                  rows={2}
                />
                <span className="audio-caption-count">{caption.length}/200</span>
              </div>
            )}

            {submitError && <div className="audio-error">{submitError}</div>}

            <button
              className="audio-btn-primary"
              onClick={submitAudioTweet}
              disabled={!hasAudio || submitting}
            >
              {submitting ? <span className="audio-spinner" /> : "Post Audio Tweet"}
            </button>
          </div>
        )}
      </div>

      {/* ── Styles ── */}
      <style jsx>{`
        /* ── Overlay ── */
        .audio-modal-overlay {
          position: fixed;
          inset: 0;
          background: rgba(0, 0, 0, 0.78);
          backdrop-filter: blur(6px);
          display: flex;
          align-items: flex-end;
          justify-content: center;
          z-index: 9999;
          padding: 0;
        }

        /* ── Modal shell — bottom-sheet on mobile ── */
        .audio-modal {
          background: #0f1117;
          border: 1px solid #2f3336;
          border-radius: 20px 20px 0 0;
          width: 100%;
          max-width: 100%;
          max-height: 95vh;
          overflow-y: auto;
          overflow-x: hidden;
          box-shadow: 0 -8px 40px rgba(0, 0, 0, 0.7), 0 0 0 1px rgba(29, 155, 240, 0.08);
          animation: sheetUp 0.28s cubic-bezier(0.34, 1.4, 0.64, 1);
          -webkit-overflow-scrolling: touch;
        }
        @keyframes sheetUp {
          from { opacity: 0; transform: translateY(40px); }
          to   { opacity: 1; transform: translateY(0);    }
        }

        /* ── ≥ 540 px → centred dialog ── */
        @media (min-width: 540px) {
          .audio-modal-overlay { align-items: center; padding: 16px; }
          .audio-modal {
            border-radius: 20px;
            max-width: 480px;
            max-height: 90vh;
            animation: modalIn 0.25s cubic-bezier(0.34, 1.56, 0.64, 1);
          }
        }
        @keyframes modalIn {
          from { opacity: 0; transform: scale(0.92) translateY(16px); }
          to   { opacity: 1; transform: scale(1)    translateY(0);    }
        }

        /* ── Header ── */
        .audio-modal-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 16px 16px 12px;
          border-bottom: 1px solid #1f2225;
          position: sticky;
          top: 0;
          background: #0f1117;
          z-index: 2;
        }
        .audio-modal-title {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 16px;
          font-weight: 700;
          color: #fff;
        }
        .audio-modal-icon { font-size: 18px; }
        .audio-modal-close {
          background: none;
          border: none;
          color: #6e767d;
          cursor: pointer;
          font-size: 15px;
          min-width: 36px;
          min-height: 36px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: background 0.15s, color 0.15s;
          flex-shrink: 0;
        }
        .audio-modal-close:hover { background: #1f2225; color: #fff; }
        @media (min-width: 540px) {
          .audio-modal-header { padding: 20px 24px 16px; }
          .audio-modal-title  { font-size: 18px; }
          .audio-modal-icon   { font-size: 20px; }
        }

        /* ── Step container ── */
        .audio-step {
          padding: 16px;
          display: flex;
          flex-direction: column;
          gap: 14px;
        }
        @media (min-width: 540px) {
          .audio-step { padding: 24px; gap: 16px; }
        }

        /* ── Time restricted ── */
        .audio-time-restricted { text-align: center; padding: 12px 0; }
        .audio-time-icon { font-size: 40px; margin-bottom: 10px; }
        .audio-time-restricted h3 { color: #fff; font-size: 17px; font-weight: 700; margin: 0 0 6px; }
        .audio-time-restricted p  { color: #6e767d; margin: 0 0 10px; font-size: 14px; }
        .audio-time-window {
          display: inline-block;
          background: linear-gradient(135deg, #1d9bf0, #7856ff);
          color: #fff; font-weight: 700; font-size: 16px;
          padding: 7px 20px; border-radius: 999px; margin: 4px 0;
        }
        .audio-time-sub { font-size: 12px !important; color: #536471 !important; }
        @media (min-width: 540px) {
          .audio-time-icon { font-size: 48px; }
          .audio-time-restricted h3 { font-size: 20px; }
          .audio-time-restricted p  { font-size: 15px; }
          .audio-time-window { font-size: 18px; padding: 8px 24px; }
          .audio-time-sub { font-size: 13px !important; }
        }

        /* ── OTP intro ── */
        .audio-otp-intro { text-align: center; }
        .audio-shield-icon { font-size: 38px; margin-bottom: 10px; }
        .audio-otp-intro h3 { color: #fff; font-size: 17px; font-weight: 700; margin: 0 0 6px; }
        .audio-otp-intro p  { color: #6e767d; font-size: 14px; margin: 0; }
        .audio-email-badge {
          display: inline-block; margin-top: 10px;
          background: #1f2225; border: 1px solid #2f3336; color: #1d9bf0;
          font-weight: 600; padding: 5px 14px; border-radius: 999px;
          font-size: 13px; word-break: break-all;
        }
        @media (min-width: 540px) {
          .audio-shield-icon  { font-size: 44px; }
          .audio-otp-intro h3 { font-size: 20px; }
          .audio-otp-intro p  { font-size: 15px; }
          .audio-email-badge  { font-size: 14px; padding: 6px 16px; }
        }

        /* ── OTP boxes — fluid width so all 6 fit any screen ── */
        .audio-otp-inputs { display: flex; gap: 6px; justify-content: center; }
        .audio-otp-box {
          width: clamp(36px, 13vw, 52px);
          height: clamp(44px, 14vw, 60px);
          text-align: center;
          font-size: clamp(18px, 5vw, 24px);
          font-weight: 700;
          color: #fff;
          background: #1a1d21;
          border: 2px solid #2f3336;
          border-radius: 10px;
          outline: none;
          transition: border-color 0.15s, box-shadow 0.15s;
          caret-color: #1d9bf0;
          flex-shrink: 0;
        }
        .audio-otp-box:focus {
          border-color: #1d9bf0;
          box-shadow: 0 0 0 3px rgba(29,155,240,0.15);
        }
        .audio-otp-error { border-color: #f4212e !important; }
        @media (min-width: 540px) {
          .audio-otp-inputs { gap: 10px; }
          .audio-otp-box { border-radius: 12px; }
        }

        /* ── Resend row ── */
        .audio-resend-row { text-align: center; }
        .audio-resend-timer { color: #6e767d; font-size: 14px; }

        /* ── Tabs ── */
        .audio-tabs {
          display: flex; gap: 6px;
          background: #1a1d21; border-radius: 12px; padding: 4px;
        }
        .audio-tab {
          flex: 1; padding: 9px 6px;
          background: none; border: none; color: #6e767d;
          font-size: 13px; font-weight: 600; border-radius: 10px;
          cursor: pointer; transition: background 0.15s, color 0.15s; white-space: nowrap;
        }
        .audio-tab:hover { color: #fff; }
        .audio-tab-active { background: #1d9bf0 !important; color: #fff !important; }
        @media (min-width: 540px) {
          .audio-tab { padding: 10px; font-size: 14px; }
        }

        /* ── Record panel ── */
        .audio-record-panel { display: flex; flex-direction: column; align-items: center; gap: 14px; }

        /* ── Waveform ── */
        .audio-waveform {
          display: flex; align-items: center; gap: 3px;
          height: 56px; background: #1a1d21; border-radius: 12px;
          padding: 8px 12px; width: 100%; justify-content: center; box-sizing: border-box;
        }
        .audio-bar {
          width: 4px; background: #2f3336; border-radius: 2px;
          transition: height 0.05s ease, background 0.3s; min-height: 4px;
        }
        .audio-bar-active { background: linear-gradient(to top, #1d9bf0, #7856ff); }
        @media (min-width: 540px) { .audio-waveform { height: 64px; padding: 8px 16px; } }

        /* ── Timer ── */
        .audio-record-timer { display: flex; align-items: baseline; gap: 4px; }
        .audio-timer-text {
          font-size: 24px; font-weight: 700; color: #6e767d;
          font-variant-numeric: tabular-nums; transition: color 0.3s;
        }
        .audio-timer-recording { color: #f4212e; }
        .audio-timer-max { font-size: 13px; color: #536471; }
        @media (min-width: 540px) {
          .audio-timer-text { font-size: 28px; }
          .audio-timer-max  { font-size: 14px; }
        }

        /* ── Progress ── */
        .audio-progress-track { width: 100%; height: 3px; background: #1f2225; border-radius: 2px; overflow: hidden; }
        .audio-progress-fill { height: 100%; background: linear-gradient(90deg, #1d9bf0, #f4212e); border-radius: 2px; transition: width 1s linear; }

        /* ── Record controls ── */
        .audio-record-controls { width: 100%; }
        .audio-recorded-actions { display: flex; flex-direction: column; gap: 8px; width: 100%; align-items: center; }

        /* ── Upload panel ── */
        .audio-upload-panel { display: flex; flex-direction: column; gap: 12px; }
        .audio-dropzone {
          display: flex; flex-direction: column; align-items: center; justify-content: center;
          border: 2px dashed #2f3336; border-radius: 16px; padding: 24px 16px;
          cursor: pointer; transition: border-color 0.2s, background 0.2s; text-align: center;
        }
        .audio-dropzone:hover { border-color: #1d9bf0; background: rgba(29,155,240,0.05); }
        .audio-dropzone-icon { font-size: 34px; margin-bottom: 8px; }
        .audio-dropzone-text { color: #fff; font-weight: 600; margin: 0; font-size: 14px; }
        .audio-dropzone-sub  { color: #536471; font-size: 11px; margin: 4px 0 0; }
        @media (min-width: 540px) {
          .audio-dropzone  { padding: 32px 20px; }
          .audio-dropzone-icon { font-size: 40px; }
          .audio-dropzone-text { font-size: 15px; }
          .audio-dropzone-sub  { font-size: 12px; }
        }

        /* ── File preview ── */
        .audio-file-preview { display: flex; flex-direction: column; gap: 10px; background: #1a1d21; border-radius: 12px; padding: 14px; }
        .audio-file-info { display: flex; align-items: center; gap: 10px; }
        .audio-file-icon { font-size: 24px; flex-shrink: 0; }
        .audio-file-name { color: #fff; font-weight: 600; font-size: 13px; margin: 0; word-break: break-all; }
        .audio-file-size { color: #6e767d; font-size: 12px; margin: 2px 0 0; }
        @media (min-width: 540px) {
          .audio-file-icon { font-size: 28px; }
          .audio-file-name { font-size: 14px; }
        }

        /* ── Audio player ── */
        .audio-player { width: 100%; height: 40px; border-radius: 8px; accent-color: #1d9bf0; }

        /* ── Caption ── */
        .audio-caption-section { position: relative; }
        .audio-caption {
          width: 100%; background: #1a1d21; border: 1px solid #2f3336;
          border-radius: 12px; color: #fff; font-size: 14px; padding: 12px;
          resize: none; outline: none; font-family: inherit;
          box-sizing: border-box; transition: border-color 0.15s;
        }
        .audio-caption::placeholder { color: #536471; }
        .audio-caption:focus { border-color: #1d9bf0; }
        .audio-caption-count { position: absolute; bottom: 8px; right: 12px; font-size: 11px; color: #536471; }
        @media (min-width: 540px) {
          .audio-caption       { font-size: 15px; }
          .audio-caption-count { font-size: 12px; }
        }

        /* ── Errors ── */
        .audio-error {
          background: rgba(244,33,46,0.1); border: 1px solid rgba(244,33,46,0.3);
          color: #f4212e; border-radius: 10px; padding: 10px 14px; font-size: 13px;
        }
        @media (min-width: 540px) { .audio-error { font-size: 14px; } }

        /* ── Console hint banner ── */
        .audio-console-hint {
          display: flex; align-items: flex-start; gap: 10px;
          background: rgba(255, 176, 0, 0.1); border: 1px solid rgba(255, 176, 0, 0.35);
          border-radius: 10px; padding: 12px 14px;
        }
        .audio-console-hint-icon { font-size: 18px; flex-shrink: 0; margin-top: 1px; }
        .audio-console-hint-title {
          color: #ffb300; font-weight: 700; font-size: 13px; margin: 0 0 3px;
        }
        .audio-console-hint-body {
          color: #a89060; font-size: 12px; margin: 0; line-height: 1.5;
        }
        .audio-console-hint-body strong { color: #ffb300; }

        /* ── Buttons ── */
        .audio-btn-primary {
          width: 100%; padding: 13px 14px;
          background: linear-gradient(135deg, #1d9bf0, #1a86d0);
          color: #fff; font-weight: 700; font-size: 15px;
          border: none; border-radius: 999px; cursor: pointer;
          transition: opacity 0.15s, transform 0.1s;
          display: flex; align-items: center; justify-content: center; gap: 8px;
          min-height: 48px;
        }
        .audio-btn-primary:hover:not(:disabled) { opacity: 0.9; transform: translateY(-1px); }
        .audio-btn-primary:disabled { opacity: 0.4; cursor: not-allowed; transform: none; }
        @media (min-width: 540px) { .audio-btn-primary { padding: 14px; font-size: 16px; } }

        .audio-btn-record {
          width: 100%; padding: 13px;
          background: linear-gradient(135deg, #f4212e, #c0392b);
          color: #fff; font-weight: 700; font-size: 14px;
          border: none; border-radius: 999px; cursor: pointer;
          display: flex; align-items: center; justify-content: center;
          gap: 10px; transition: opacity 0.15s; min-height: 48px;
        }
        .audio-btn-record:hover { opacity: 0.9; }
        .audio-rec-dot {
          width: 10px; height: 10px; background: #fff; border-radius: 50%;
          animation: blink 1s infinite; flex-shrink: 0;
        }
        @keyframes blink { 0%, 100% { opacity: 1; } 50% { opacity: 0; } }
        @media (min-width: 540px) { .audio-btn-record { font-size: 15px; } }

        .audio-btn-stop {
          width: 100%; padding: 13px; background: #2f3336;
          color: #fff; font-weight: 700; font-size: 14px;
          border: none; border-radius: 999px; cursor: pointer;
          transition: background 0.15s; min-height: 48px;
        }
        .audio-btn-stop:hover { background: #3a3e42; }
        @media (min-width: 540px) { .audio-btn-stop { font-size: 15px; } }

        .audio-btn-ghost {
          background: none; border: 1px solid #2f3336; color: #1d9bf0;
          font-weight: 600; font-size: 13px; padding: 8px 18px;
          border-radius: 999px; cursor: pointer; transition: background 0.15s; min-height: 40px;
        }
        .audio-btn-ghost:hover { background: rgba(29,155,240,0.1); }
        @media (min-width: 540px) { .audio-btn-ghost { font-size: 14px; padding: 8px 20px; } }

        .audio-btn-ghost-sm {
          background: none; border: none; color: #f4212e; font-size: 13px;
          cursor: pointer; padding: 4px 0; text-align: center; text-decoration: underline;
        }

        /* ── Spinner ── */
        .audio-spinner {
          display: inline-block; width: 18px; height: 18px;
          border: 2px solid rgba(255,255,255,0.3); border-top-color: #fff;
          border-radius: 50%; animation: spin 0.7s linear infinite; flex-shrink: 0;
        }
        @keyframes spin { to { transform: rotate(360deg); } }

        /* ── Hidden ── */
        .hidden { display: none; }
      `}</style>
    </div>
  );
}
