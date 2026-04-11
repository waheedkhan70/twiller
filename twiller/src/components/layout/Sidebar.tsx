"use client";

import React from 'react';

import {
  Home,
  Search,
  Bell,
  Mail,
  Bookmark,
  User,
  MoreHorizontal,
  Settings,
  LogOut,
  Zap,
  Globe,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu';

import { Button } from '../ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';
import TwitterLogo from '../Twitterlogo';
import { useTranslation } from 'react-i18next';
import LanguageOTPModal from '../LanguageOTPModal';
import { useAuth } from '@/context/AuthContext';
import axiosInstance from '@/lib/axiosInstance';
import { toast } from 'sonner';

const LANGUAGES = [
  { code: "en", label: "English", flag: "🇺🇸" },
  { code: "es", label: "Español", flag: "🇪🇸" },
  { code: "hi", label: "हिन्दी", flag: "🇮🇳" },
  { code: "pt", label: "Português", flag: "🇧🇷" },
  { code: "zh", label: "中文", flag: "🇨🇳" },
  { code: "fr", label: "Français", flag: "🇫🇷" },
];

interface SidebarProps {
  currentPage?: string;
  onNavigate?: (page: string) => void;
  onOpenPremium?: () => void;
  onOpenPost?: () => void;
}

export default function Sidebar({ currentPage = 'home', onNavigate, onOpenPremium, onOpenPost }: SidebarProps) {
  const { user, logout, refreshUser } = useAuth();
  const { t, i18n } = useTranslation();

  const [isLangModalOpen, setIsLangModalOpen] = React.useState(false);
  const [targetLang, setTargetLang] = React.useState("");
  const [langLoading, setLangLoading] = React.useState<string | null>(null);

  const handleLanguageSelect = async (langCode: string) => {
    if (langCode === i18n.language) return;
    if (!user?.email) {
      i18n.changeLanguage(langCode);
      return;
    }

    setLangLoading(langCode);
    try {
      await axiosInstance.post("/send-language-otp", { email: user.email, language: langCode });
      setTargetLang(langCode);
      setIsLangModalOpen(true);
    } catch (err: any) {
      toast.error(err.response?.data?.error || "Failed to initiate language change");
    } finally {
      setLangLoading(null);
    }
  };

  const onLangVerified = () => {
    i18n.changeLanguage(targetLang);
    refreshUser();
    toast.success("Language changed successfully!");
  };

  const navigation = [
    { name: t('common.home'), icon: Home, current: currentPage === 'home', page: 'home' },
    { name: t('common.explore'), icon: Search, current: currentPage === 'explore', page: 'explore' },
    { name: t('common.notifications'), icon: Bell, current: currentPage === 'notifications', page: 'notifications', badge: true },
    { name: t('common.messages'), icon: Mail, current: currentPage === 'messages', page: 'messages' },
    { name: t('common.bookmarks'), icon: Bookmark, current: currentPage === 'bookmarks', page: 'bookmarks' },
    { name: t('common.profile'), icon: User, current: currentPage === 'profile', page: 'profile' },
    { name: 'Premium', icon: Zap, onClick: onOpenPremium },
    { name: t('common.more'), icon: MoreHorizontal, current: currentPage === 'more', page: 'more' },
  ];

  return (
    <div className="flex flex-col h-screen w-64 border-r border-gray-800 bg-black">
      <div className="p-4">
        <TwitterLogo size="lg" className="text-white" />
      </div>

      <nav className="flex-1 px-2">
        <ul className="space-y-2">
          {navigation.map((item) => (
            <li key={item.name}>
              <Button
                variant="ghost"
                className={`w-full justify-start text-xl py-6 px-4 rounded-full hover:bg-gray-900 ${item.current ? 'font-bold' : 'font-normal'
                  } text-white hover:text-white`}
                onClick={() => {
                  if (item.onClick) item.onClick();
                  else onNavigate?.(item.page!);
                }}
              >
                <item.icon className="mr-4 h-7 w-7" />
                {item.name}
                {item.badge && (
                  <span className="ml-2 bg-blue-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
                    3
                  </span>
                )}
              </Button>
            </li>
          ))}
        </ul>

        <div className="mt-4">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                className="w-full justify-start text-xl py-6 px-4 rounded-full hover:bg-gray-900 text-white hover:text-white font-normal"
              >
                <Globe className="mr-4 h-7 w-7" />
                {t('common.language')}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-56 bg-black border-gray-800 text-white">
              {LANGUAGES.map((lang) => (
                <DropdownMenuItem
                  key={lang.code}
                  className={`flex items-center justify-between p-3 cursor-pointer hover:bg-gray-900 ${
                    i18n.language === lang.code ? "text-blue-400 font-bold" : ""
                  }`}
                  onClick={() => handleLanguageSelect(lang.code)}
                >
                  <div className="flex items-center gap-2">
                    <span>{lang.flag}</span>
                    <span>{lang.label}</span>
                  </div>
                  {langLoading === lang.code && (
                    <div className="w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
                  )}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <div className="mt-8 px-2">
          <Button 
            className="w-full bg-blue-500 hover:bg-blue-600 text-white font-bold py-3 rounded-full text-lg"
            onClick={onOpenPost}
          >
            {t('common.post')}
          </Button>
        </div>
      </nav>

      {user?.email && (
        <LanguageOTPModal
          isOpen={isLangModalOpen}
          onClose={() => setIsLangModalOpen(false)}
          email={user.email}
          targetLanguage={LANGUAGES.find(l => l.code === targetLang)?.label || targetLang}
          onVerified={onLangVerified}
        />
      )}

      {user && (
        <div className="p-4 border-t border-gray-800">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                className="w-full justify-start p-3 rounded-full hover:bg-gray-900"
              >
                <Avatar className="h-10 w-10 mr-3">
                  <AvatarImage src={user.avatar} alt={user.displayName} />
                  <AvatarFallback>{user.displayName[0]}</AvatarFallback>
                </Avatar>
                <div className="flex-1 text-left">
                  <div className="text-white font-semibold">{user.displayName}</div>
                  <div className="text-gray-400 text-sm">@{user.username}</div>
                </div>
                <MoreHorizontal className="h-5 w-5 text-gray-400" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-56 bg-black border-gray-800">
              <DropdownMenuItem className="text-white hover:bg-gray-900">
                <Settings className="mr-2 h-4 w-4" />
                Settings
              </DropdownMenuItem>
              <DropdownMenuSeparator className="bg-gray-800" />
              <DropdownMenuItem
                className="text-white hover:bg-gray-900"
                onClick={logout}
              >
                <LogOut className="mr-2 h-4 w-4" />
                Log out @{user.username}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )}
    </div>
  );
}