"use client";

import React, { useState, useRef, useEffect } from "react";
import axiosInstance from "@/lib/axiosInstance";
import { useTranslation } from "react-i18next";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  email: string;
  onVerified: (user: any) => void;
}

export default function LoginOTPModal({ isOpen, onClose, email, onVerified }: Props) {
  const { t } = useTranslation();
  const [otpCode, setOtpCode] = useState(["", "", "", "", "", ""]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const otpRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    if (isOpen) {
      setOtpCode(["", "", "", "", "", ""]);
      setError("");
    }
  }, [isOpen]);

  const handleOtpChange = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return;
    const newOtp = [...otpCode];
    newOtp[index] = value.slice(-1);
    setOtpCode(newOtp);
    setError("");
    if (value && index < 5) {
      otpRefs.current[index + 1]?.focus();
    }
  };

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === "Backspace" && !otpCode[index] && index > 0) {
      otpRefs.current[index - 1]?.focus();
    }
  };

  const verifyOtp = async () => {
    const otp = otpCode.join("");
    if (otp.length !== 6) {
      setError("Please enter the complete 6-digit OTP.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const res = await axiosInstance.post(`/verify-login-otp`, { email, otp });
      onVerified(res.data.user);
    } catch (err: any) {
      setError(err.response?.data?.error || "OTP verification failed.");
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-[10000] p-4">
      <div className="bg-[#0f1117] border border-[#2f3336] rounded-2xl w-full max-w-[400px] overflow-hidden shadow-2xl animate-in fade-in zoom-in duration-200">
        <div className="p-6">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-xl font-bold text-white">{t('common.verify_otp')}</h3>
            <button onClick={onClose} className="text-[#6e767d] hover:text-white transition-colors">
              ✕
            </button>
          </div>

          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-[#1d9bf0]/10 rounded-full flex items-center justify-center mx-auto mb-4 text-[#1d9bf0]">
              <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
            </div>
            <p className="text-[#8b98a5] mb-2">{t('common.enter_otp')}</p>
            <p className="text-sm text-[#536471]">
              A verification code was sent to your email because you are logging in from <span className="text-[#1d9bf0] font-bold">Google Chrome</span>.
            </p>
          </div>

          <div className="flex gap-2 justify-center mb-6">
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
                className={`w-12 h-14 text-center text-2xl font-bold text-white bg-[#1a1d21] border-2 rounded-xl outline-none transition-all ${
                  error ? "border-red-500/50" : "border-[#2f3336] focus:border-[#1d9bf0] focus:shadow-[0_0_0_4px_rgba(29,155,240,0.15)]"
                }`}
              />
            ))}
          </div>

          {error && (
            <div className="bg-red-500/10 border border-red-500/20 text-red-500 text-sm py-2 px-3 rounded-lg mb-6 text-center animate-in shake duration-300">
              {error}
            </div>
          )}

          <button
            onClick={verifyOtp}
            disabled={loading || otpCode.join("").length !== 6}
            className="w-full bg-[#1d9bf0] hover:bg-[#1a8cd8] text-white font-bold py-3 rounded-full transition-all disabled:opacity-50 disabled:cursor-not-allowed transform active:scale-[0.98]"
          >
            {loading ? (
              <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin mx-auto" />
            ) : (
              t('common.confirm')
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
