"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Mail,
  Phone,
  ArrowLeft,
  RefreshCw,
  CheckCircle,
  AlertTriangle,
  Eye,
  EyeOff,
  Sparkles,
  Lock,
} from "lucide-react";
import TwitterLogo from "./Twitterlogo";
import axiosInstance from "@/lib/axiosInstance";
import { useTranslation } from "react-i18next";

type Step = "form" | "success";

export default function ForgotPasswordPage() {
  const router = useRouter();
  const { t } = useTranslation();

  const [step, setStep] = useState<Step>("form");
  const [identifierType, setIdentifierType] = useState<"email" | "phone">("email");
  const [identifier, setIdentifier] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [warningMessage, setWarningMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [generatedPassword, setGeneratedPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const [customPassword, setCustomPassword] = useState("");
  const [showCustomPassword, setShowCustomPassword] = useState(false);

  // ── Preview password generator (client-side, letters only) ──────────────────
  const generatePreviewPassword = () => {
    const upper = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    const lower = "abcdefghijklmnopqrstuvwxyz";
    const all = upper + lower;
    let pw = upper[Math.floor(Math.random() * upper.length)];
    pw += lower[Math.floor(Math.random() * lower.length)];
    for (let i = 2; i < 12; i++) {
      pw += all[Math.floor(Math.random() * all.length)];
    }
    return pw
      .split("")
      .sort(() => Math.random() - 0.5)
      .join("");
  };

  const [previewPassword, setPreviewPassword] = useState(() =>
    generatePreviewPassword()
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setWarningMessage("");

    if (!identifier.trim()) {
      setError(
        identifierType === "email"
          ? t('auth.enter_id_email')
          : t('auth.enter_id_phone')
      );
      return;
    }

    if (
      identifierType === "email" &&
      !/\S+@\S+\.\S+/.test(identifier.trim())
    ) {
      setError(t('errors.email_invalid'));
      return;
    }

    setIsLoading(true);
    try {
      const res = await axiosInstance.post("/forgot-password", {
        identifier: identifier.trim(),
        customPassword: customPassword.trim() || undefined,
      });

      const data = res.data;
      setSuccessMessage(data.message);
      setEmailSent(data.emailSent);
      if (data.generatedPassword) {
        setGeneratedPassword(data.generatedPassword);
      }
      setStep("success");
    } catch (err: any) {
      const msg =
        err?.response?.data?.error || t('errors.generic_error');
      const code = err?.response?.data?.code;

      if (code === "DAILY_LIMIT_REACHED") {
        setWarningMessage(msg);
      } else {
        setError(msg);
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-black flex items-center justify-center p-4 relative overflow-hidden">
      {/* Animated background glows */}
      <div
        style={{
          position: "absolute",
          top: "-10rem",
          left: "-10rem",
          width: "28rem",
          height: "28rem",
          background:
            "radial-gradient(circle, rgba(29,155,240,0.18) 0%, transparent 70%)",
          borderRadius: "50%",
          animation: "pulse 6s ease-in-out infinite",
          pointerEvents: "none",
        }}
      />
      <div
        style={{
          position: "absolute",
          bottom: "-10rem",
          right: "-8rem",
          width: "32rem",
          height: "32rem",
          background:
            "radial-gradient(circle, rgba(120,86,255,0.14) 0%, transparent 70%)",
          borderRadius: "50%",
          animation: "pulse 8s ease-in-out infinite reverse",
          pointerEvents: "none",
        }}
      />

      <style>{`
        @keyframes pulse {
          0%, 100% { transform: scale(1); opacity: 0.7; }
          50% { transform: scale(1.15); opacity: 1; }
        }
        @keyframes fadeSlideIn {
          from { opacity: 0; transform: translateY(24px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes shimmer {
          0% { background-position: -200% center; }
          100% { background-position: 200% center; }
        }
        .card-enter {
          animation: fadeSlideIn 0.45s cubic-bezier(0.22, 1, 0.36, 1) both;
        }
        .tab-active {
          background: #1d9bf0;
          color: #fff;
          box-shadow: 0 0 16px rgba(29,155,240,0.45);
        }
        .tab-inactive {
          background: transparent;
          color: #8b98a5;
        }
        .tab-inactive:hover {
          background: rgba(29,155,240,0.08);
          color: #fff;
        }
        .btn-primary {
          background: linear-gradient(135deg, #1d9bf0, #7856ff);
          color: #fff;
          border: none;
          cursor: pointer;
          transition: opacity 0.2s, transform 0.15s;
        }
        .btn-primary:hover:not(:disabled) {
          opacity: 0.9;
          transform: translateY(-1px);
        }
        .btn-primary:disabled {
          opacity: 0.55;
          cursor: not-allowed;
        }
        .input-field {
          width: 100%;
          background: #16181c;
          border: 1.5px solid #2f3336;
          border-radius: 10px;
          padding: 12px 14px 12px 44px;
          color: #fff;
          font-size: 15px;
          outline: none;
          transition: border-color 0.2s, box-shadow 0.2s;
          box-sizing: border-box;
        }
        .input-field:focus {
          border-color: #1d9bf0;
          box-shadow: 0 0 0 3px rgba(29,155,240,0.18);
        }
        .input-field::placeholder {
          color: #536471;
        }
        .password-display {
          font-family: monospace;
          font-size: 22px;
          letter-spacing: 3px;
          color: #1d9bf0;
          background: linear-gradient(90deg, #1d9bf0, #7856ff, #1d9bf0);
          background-size: 200% auto;
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
          animation: shimmer 3s linear infinite;
        }
      `}</style>

      <div
        className="card-enter"
        style={{
          width: "100%",
          maxWidth: "440px",
          background: "#000",
          border: "1px solid #2f3336",
          borderRadius: "18px",
          overflow: "hidden",
          boxShadow: "0 24px 80px rgba(0,0,0,0.7), 0 0 0 1px rgba(255,255,255,0.04)",
          position: "relative",
          zIndex: 10,
        }}
      >
        {/* Header */}
        <div
          style={{
            background: "linear-gradient(135deg, #1d9bf0 0%, #7856ff 100%)",
            padding: "28px 28px 24px",
            textAlign: "center",
            position: "relative",
          }}
        >
          <button
            onClick={() => router.push("/")}
            style={{
              position: "absolute",
              left: "16px",
              top: "50%",
              transform: "translateY(-50%)",
              background: "rgba(255,255,255,0.15)",
              border: "none",
              borderRadius: "50%",
              width: "36px",
              height: "36px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              color: "#fff",
              transition: "background 0.2s",
            }}
            onMouseEnter={(e) =>
              ((e.currentTarget as HTMLElement).style.background =
                "rgba(255,255,255,0.25)")
            }
            onMouseLeave={(e) =>
              ((e.currentTarget as HTMLElement).style.background =
                "rgba(255,255,255,0.15)")
            }
            aria-label="Go back to home"
          >
            <ArrowLeft size={18} />
          </button>
          <div style={{ display: "flex", justifyContent: "center", marginBottom: "8px" }}>
            <TwitterLogo size="xl" className="text-white" />
          </div>
          <h1
            style={{
              color: "#fff",
              margin: 0,
              fontSize: "22px",
              fontWeight: 700,
              letterSpacing: "-0.5px",
            }}
          >
            {step === "form" ? t('auth.reset_title') : t('auth.reset_success_title')}
          </h1>
          <p
            style={{
              color: "rgba(255,255,255,0.75)",
              margin: "6px 0 0",
              fontSize: "13px",
            }}
          >
            {step === "form"
              ? t('auth.reset_subheader')
              : t('auth.reset_success_subheader')}
          </p>
        </div>

        {/* Body */}
        <div style={{ padding: "28px" }}>
          {step === "form" ? (
            <>
              {/* Warning (daily limit) */}
              {warningMessage && (
                <div
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    gap: "10px",
                    background: "rgba(255,180,0,0.08)",
                    border: "1px solid rgba(255,180,0,0.4)",
                    borderRadius: "10px",
                    padding: "12px 14px",
                    marginBottom: "18px",
                    color: "#f5a623",
                    fontSize: "14px",
                  }}
                >
                  <AlertTriangle size={18} style={{ flexShrink: 0, marginTop: "1px" }} />
                  <span>{warningMessage}</span>
                </div>
              )}

              {/* Error */}
              {error && (
                <div
                  style={{
                    background: "rgba(220,38,38,0.08)",
                    border: "1px solid rgba(220,38,38,0.35)",
                    borderRadius: "10px",
                    padding: "12px 14px",
                    marginBottom: "18px",
                    color: "#f87171",
                    fontSize: "14px",
                  }}
                >
                  {error}
                </div>
              )}

              {/* Identifier type toggle */}
              <div
                style={{
                  display: "flex",
                  background: "#16181c",
                  borderRadius: "10px",
                  padding: "4px",
                  marginBottom: "20px",
                  gap: "4px",
                }}
              >
                {(["email", "phone"] as const).map((type) => (
                  <button
                    key={type}
                    onClick={() => {
                      setIdentifierType(type);
                      setIdentifier("");
                      setError("");
                    }}
                    className={identifierType === type ? "tab-active" : "tab-inactive"}
                    style={{
                      flex: 1,
                      padding: "9px",
                      borderRadius: "8px",
                      border: "none",
                      cursor: "pointer",
                      fontSize: "14px",
                      fontWeight: 600,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: "6px",
                      transition: "all 0.2s",
                    }}
                    id={`toggle-${type}`}
                  >
                    {type === "email" ? <Mail size={15} /> : <Phone size={15} />}
                    {type === "email" ? t('common.messages') : t('auth.enter_id_phone')}
                  </button>
                ))}
              </div>

              <form onSubmit={handleSubmit}>
                <div style={{ position: "relative", marginBottom: "20px" }}>
                  <div
                    style={{
                      position: "absolute",
                      left: "14px",
                      top: "50%",
                      transform: "translateY(-50%)",
                      color: "#536471",
                      pointerEvents: "none",
                    }}
                  >
                    {identifierType === "email" ? (
                      <Mail size={18} />
                    ) : (
                      <Phone size={18} />
                    )}
                  </div>
                  <input
                    id="identifier-input"
                    type={identifierType === "email" ? "email" : "tel"}
                    className="input-field"
                    placeholder={
                      identifierType === "email"
                        ? t('auth.enter_id_email')
                        : t('auth.enter_id_phone')
                    }
                    value={identifier}
                    onChange={(e) => {
                      setIdentifier(e.target.value);
                      setError("");
                    }}
                    disabled={isLoading}
                    autoComplete={identifierType === "email" ? "email" : "tel"}
                  />
                </div>

                <div style={{ position: "relative", marginBottom: "20px" }}>
                  <div
                    style={{
                      position: "absolute",
                      left: "14px",
                      top: "50%",
                      transform: "translateY(-50%)",
                      color: "#536471",
                      pointerEvents: "none",
                    }}
                  >
                    <Lock size={18} />
                  </div>
                  <input
                    id="custom-password-input"
                    type={showCustomPassword ? "text" : "password"}
                    className="input-field"
                    placeholder={t('auth.enter_new_password')}
                    value={customPassword}
                    onChange={(e) => setCustomPassword(e.target.value)}
                    disabled={isLoading}
                  />
                  <button
                    type="button"
                    onClick={() => setShowCustomPassword(!showCustomPassword)}
                    style={{
                      position: "absolute",
                      right: "12px",
                      top: "50%",
                      transform: "translateY(-50%)",
                      background: "none",
                      border: "none",
                      color: "#536471",
                      cursor: "pointer",
                      padding: "4px",
                    }}
                  >
                    {showCustomPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>

                <p
                  style={{
                    color: "#536471",
                    fontSize: "12px",
                    margin: "-14px 0 20px",
                    paddingLeft: "4px",
                  }}
                >
                  {t('auth.leave_blank_hint')}
                </p>

                <button
                  id="submit-reset-btn"
                  type="submit"
                  className="btn-primary"
                  disabled={isLoading}
                  style={{
                    width: "100%",
                    padding: "13px",
                    borderRadius: "999px",
                    fontSize: "15px",
                    fontWeight: 700,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "8px",
                    marginBottom: "16px",
                  }}
                >
                  {isLoading ? (
                    <>
                      <RefreshCw size={17} style={{ animation: "spin 0.9s linear infinite" }} />
                      {t('auth.updating_password')}
                      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
                    </>
                  ) : (
                    <>
                      <Sparkles size={17} />
                      {customPassword.trim() ? t('auth.update_password_btn') : t('auth.send_password_btn')}
                    </>
                  )}
                </button>
              </form>

              {/* Password generator preview */}
              <div
                style={{
                  background: "#0d0d0d",
                  border: "1px dashed #2f3336",
                  borderRadius: "12px",
                  padding: "16px",
                  marginBottom: "20px",
                }}
              >
                <p
                  style={{
                    color: "#536471",
                    fontSize: "12px",
                    margin: "0 0 10px",
                    textTransform: "uppercase",
                    letterSpacing: "0.8px",
                    fontWeight: 600,
                  }}
                >
                  {t('auth.password_preview')}
                </p>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: "10px",
                  }}
                >
                  <span className="password-display">
                    {showPassword ? previewPassword : "••••••••••••"}
                  </span>
                  <div style={{ display: "flex", gap: "8px", flexShrink: 0 }}>
                    <button
                      onClick={() => setShowPassword(!showPassword)}
                      title={showPassword ? "Hide" : "Show"}
                      style={{
                        background: "#1a1a1a",
                        border: "1px solid #2f3336",
                        borderRadius: "8px",
                        padding: "6px 10px",
                        color: "#8b98a5",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        transition: "color 0.2s",
                      }}
                      onMouseEnter={(e) =>
                        ((e.currentTarget as HTMLElement).style.color = "#fff")
                      }
                      onMouseLeave={(e) =>
                        ((e.currentTarget as HTMLElement).style.color = "#8b98a5")
                      }
                      id="toggle-preview-visibility"
                    >
                      {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                    <button
                      onClick={() => setPreviewPassword(generatePreviewPassword())}
                      title="Generate another example"
                      style={{
                        background: "#1a1a1a",
                        border: "1px solid #2f3336",
                        borderRadius: "8px",
                        padding: "6px 10px",
                        color: "#8b98a5",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        transition: "color 0.2s",
                      }}
                      onMouseEnter={(e) =>
                        ((e.currentTarget as HTMLElement).style.color = "#1d9bf0")
                      }
                      onMouseLeave={(e) =>
                        ((e.currentTarget as HTMLElement).style.color = "#8b98a5")
                      }
                      id="regenerate-preview-btn"
                    >
                      <RefreshCw size={14} />
                    </button>
                  </div>
                </div>
                <p
                  style={{
                    color: "#536471",
                    fontSize: "11px",
                    margin: "8px 0 0",
                  }}
                >
                  {t('auth.password_hint')}
                </p>
              </div>

              {/* Back to login */}
              <div style={{ textAlign: "center" }}>
                <button
                  onClick={() => router.push("/")}
                  id="back-to-login-btn"
                  style={{
                    background: "none",
                    border: "none",
                    color: "#1d9bf0",
                    fontSize: "14px",
                    fontWeight: 600,
                    cursor: "pointer",
                    textDecoration: "none",
                    transition: "color 0.2s",
                  }}
                  onMouseEnter={(e) =>
                    ((e.currentTarget as HTMLElement).style.color = "#1a8cd8")
                  }
                  onMouseLeave={(e) =>
                    ((e.currentTarget as HTMLElement).style.color = "#1d9bf0")
                  }
                >
                    {t('auth.back_to_signin')}
                </button>
              </div>
            </>
          ) : (
            /* ── Success State ── */
            <div style={{ textAlign: "center" }}>
              <div
                style={{
                  width: "64px",
                  height: "64px",
                  background: "rgba(29,155,240,0.12)",
                  borderRadius: "50%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  margin: "0 auto 20px",
                  animation: "fadeSlideIn 0.4s ease both",
                }}
              >
                <CheckCircle size={34} color="#1d9bf0" />
              </div>

              <h2
                style={{
                  color: "#fff",
                  fontSize: "20px",
                  fontWeight: 700,
                  margin: "0 0 10px",
                }}
              >
                {t('auth.reset_successful')}
              </h2>

              <p style={{ color: "#8b98a5", fontSize: "14px", marginBottom: "24px" }}>
                {successMessage}
              </p>

              {/* Show password in response if email failed */}
              {generatedPassword && (
                <div
                  style={{
                    background: "#16181c",
                    border: "1px solid #2f3336",
                    borderRadius: "12px",
                    padding: "20px",
                    marginBottom: "24px",
                  }}
                >
                  <p
                    style={{
                      color: "#536471",
                      fontSize: "12px",
                      margin: "0 0 12px",
                      textTransform: "uppercase",
                      letterSpacing: "0.8px",
                      fontWeight: 600,
                    }}
                  >
                    {t('auth.temp_password_label')}
                  </p>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: "10px",
                    }}
                  >
                    <span className="password-display" style={{ fontSize: "26px" }}>
                      {showPassword ? generatedPassword : "••••••••••••"}
                    </span>
                    <button
                      onClick={() => setShowPassword(!showPassword)}
                      style={{
                        background: "#1a1a1a",
                        border: "1px solid #2f3336",
                        borderRadius: "8px",
                        padding: "6px 10px",
                        color: "#8b98a5",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                      }}
                      id="toggle-result-visibility"
                    >
                      {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                  </div>
                  <p
                    style={{
                      color: "#536471",
                      fontSize: "11px",
                      margin: "10px 0 0",
                    }}
                  >
                    {t('auth.password_copy_hint')}
                  </p>
                </div>
              )}

              {!emailSent && !generatedPassword && (
                <div
                  style={{
                    background: "rgba(255,180,0,0.07)",
                    border: "1px solid rgba(255,180,0,0.3)",
                    borderRadius: "10px",
                    padding: "12px 14px",
                    marginBottom: "24px",
                    color: "#f5a623",
                    fontSize: "13px",
                  }}
                >
                  {t('auth.email_fail_warning')}
                </div>
              )}

              <div
                style={{
                  background: "rgba(29,155,240,0.06)",
                  border: "1px solid rgba(29,155,240,0.2)",
                  borderRadius: "10px",
                  padding: "12px 14px",
                  marginBottom: "24px",
                  color: "#8b98a5",
                  fontSize: "13px",
                  textAlign: "left",
                }}
              >
                {t('auth.daily_limit_tip')}
              </div>

              <button
                id="go-to-signin-btn"
                onClick={() => router.push("/")}
                className="btn-primary"
                style={{
                  width: "100%",
                  padding: "13px",
                  borderRadius: "999px",
                  fontSize: "15px",
                  fontWeight: 700,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "8px",
                  cursor: "pointer",
                }}
              >
                {t('auth.go_to_signin')}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
