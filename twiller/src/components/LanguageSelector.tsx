"use client";

import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/context/AuthContext";
import axiosInstance from "@/lib/axiosInstance";
import LanguageOTPModal from "./LanguageOTPModal";
import { Globe } from "lucide-react";
import { toast } from "sonner";

const LANGUAGES = [
  { code: "en", label: "English", flag: "🇺🇸" },
  { code: "es", label: "Español", flag: "🇪🇸" },
  { code: "hi", label: "हिन्दी", flag: "🇮🇳" },
  { code: "pt", label: "Português", flag: "🇧🇷" },
  { code: "zh", label: "中文", flag: "🇨🇳" },
  { code: "fr", label: "Français", flag: "🇫🇷" },
];

export default function LanguageSelector() {
  const { i18n, t } = useTranslation();
  const { user, refreshUser } = useAuth();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [targetLang, setTargetLang] = useState("");
  const [loading, setLoading] = useState<string | null>(null);

  const handleLanguageSelect = async (langCode: string) => {
    if (langCode === i18n.language) return;
    if (!user?.email) {
      // If not logged in, just change language
      i18n.changeLanguage(langCode);
      return;
    }

    setLoading(langCode);
    try {
      // Request OTP
      await axiosInstance.post("/send-language-otp", { email: user.email, language: langCode });
      setTargetLang(langCode);
      setIsModalOpen(true);
      toast.success(t('common.verify_otp') + " requested");
    } catch (err: any) {
      toast.error(err.response?.data?.error || "Failed to initiate language change");
    } finally {
      setLoading(null);
    }
  };

  const onVerified = () => {
    i18n.changeLanguage(targetLang);
    refreshUser(); // Sync the language from backend
    toast.success("Language changed successfully!");
  };

  return (
    <div className="mt-4 px-4">
      <div className="flex items-center gap-2 mb-3 text-[#6e767d] px-2">
        <Globe size={18} />
        <span className="text-sm font-semibold uppercase tracking-wider">{t('common.language')}</span>
      </div>
      
      <div className="grid grid-cols-1 gap-1">
        {LANGUAGES.map((lang) => (
          <button
            key={lang.code}
            onClick={() => handleLanguageSelect(lang.code)}
            disabled={loading !== null}
            className={`flex items-center justify-between px-3 py-2.5 rounded-xl transition-all group ${
              i18n.language === lang.code 
                ? "bg-[#1d9bf0]/10 text-[#1d9bf0]" 
                : "hover:bg-[#1d9bf0]/5 text-[#8b98a5] hover:text-white"
            }`}
          >
            <div className="flex items-center gap-3">
              <span className="text-xl">{lang.flag}</span>
              <span className="font-medium">{lang.label}</span>
            </div>
            {loading === lang.code ? (
              <div className="w-4 h-4 border-2 border-[#1d9bf0]/30 border-t-[#1d9bf0] rounded-full animate-spin" />
            ) : i18n.language === lang.code ? (
              <div className="w-2 h-2 rounded-full bg-[#1d9bf0] shadow-[0_0_8px_rgba(29,155,240,0.6)]" />
            ) : null}
          </button>
        ))}
      </div>

      {user?.email && (
        <LanguageOTPModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          email={user.email}
          targetLanguage={LANGUAGES.find(l => l.code === targetLang)?.label || targetLang}
          onVerified={onVerified}
        />
      )}
    </div>
  );
}
