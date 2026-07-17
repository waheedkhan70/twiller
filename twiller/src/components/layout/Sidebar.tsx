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
  Feather
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
import { useNotification } from '@/context/NotificationContext';
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
  const { unreadCount } = useNotification();
  const { t, i18n } = useTranslation();

  const [isLangModalOpen, setIsLangModalOpen] = React.useState(false);
  const [targetLang, setTargetLang] = React.useState("");
  const [langLoading, setLangLoading] = React.useState<string | null>(null);
  const [otpMethod, setOtpMethod] = React.useState<string>("");

  const handleLanguageSelect = async (langCode: string) => {
    if (langCode === i18n.language) return;
    if (!user?.email) {
      i18n.changeLanguage(langCode);
      return;
    }

    setLangLoading(langCode);
    try {
      const res = await axiosInstance.post("/send-language-otp", { email: user.email, language: langCode });
      setTargetLang(langCode);
      setOtpMethod(res.data.method);
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
    { name: t('common.notifications'), icon: Bell, current: currentPage === 'notifications', page: 'notifications', badge: unreadCount > 0 ? unreadCount : false },
    { name: t('common.messages'), icon: Mail, current: currentPage === 'messages', page: 'messages' },
    { name: t('common.bookmarks'), icon: Bookmark, current: currentPage === 'bookmarks', page: 'bookmarks' },
    { name: t('common.profile'), icon: User, current: currentPage === 'profile', page: 'profile' },
    { name: 'Premium', icon: Zap, onClick: onOpenPremium },
    { name: t('common.more'), icon: MoreHorizontal, current: currentPage === 'more', page: 'more' },
  ];

  return (
    <div className="flex flex-col h-screen w-full bg-black">
      <div className="p-4 flex justify-center lg:justify-start">
        <TwitterLogo size="lg" className="text-white" />
      </div>

      <nav className="flex-1 px-2">
        <ul className="space-y-2">
          {navigation.map((item) => (
            <li key={item.name}>
              <Button
                variant="ghost"
                className={`w-full lg:justify-start justify-center text-xl py-6 px-4 rounded-full hover:bg-gray-900 ${item.current ? 'font-bold' : 'font-normal'
                  } text-white hover:text-white`}
                onClick={() => {
                  if (item.onClick) item.onClick();
                  else onNavigate?.(item.page!);
                }}
              >
                <div className="relative inline-flex">
                  <item.icon className="lg:mr-4 h-7 w-7" />
                  {item.badge && (
                    <span className="absolute -top-0.5 -right-0.5 bg-blue-500 rounded-full h-2.5 w-2.5 border-[1.5px] border-black lg:hidden" />
                  )}
                </div>
                <span className="hidden lg:inline">{item.name}</span>
                {item.badge && (
                  <span className="hidden lg:flex lg:ml-2 bg-blue-500 text-white text-xs rounded-full h-5 w-5 items-center justify-center">
                    {item.badge}
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
                className="w-full lg:justify-start justify-center text-xl py-6 px-4 rounded-full hover:bg-gray-900 text-white hover:text-white font-normal"
              >
                <Globe className="lg:mr-4 h-7 w-7" />
                <span className="hidden lg:inline">{t('common.language')}</span>
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

        <div className="mt-8 px-2 flex justify-center lg:block">
          <Button 
            className="w-14 h-14 lg:w-full lg:h-12 bg-blue-500 hover:bg-blue-600 text-white font-bold rounded-full text-lg flex items-center justify-center p-0 lg:py-3 lg:px-4"
            onClick={onOpenPost}
            aria-label={t('common.post')}
          >
            <span className="hidden lg:inline">{t('common.post')}</span>
            <Feather className="lg:hidden h-6 w-6" />
          </Button>
        </div>
      </nav>

      {user?.email && (
        <LanguageOTPModal
          isOpen={isLangModalOpen}
          onClose={() => setIsLangModalOpen(false)}
          email={user.email}
          targetLanguage={LANGUAGES.find(l => l.code === targetLang)?.label || targetLang}
          method={otpMethod}
          onVerified={onLangVerified}
        />
      )}

      {user && (
        <div className="p-4 border-t border-gray-800">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                className="w-full justify-center lg:justify-start p-3 rounded-full hover:bg-gray-900"
              >
                <Avatar className="h-10 w-10 lg:mr-3">
                  <AvatarImage src={user.avatar} alt={user.displayName} />
                  <AvatarFallback>{user.displayName[0]}</AvatarFallback>
                </Avatar>
                <div className="hidden lg:block flex-1 text-left">
                  <div className="text-white font-semibold">{user.displayName}</div>
                  <div className="text-gray-400 text-sm">@{user.username}</div>
                </div>
                <MoreHorizontal className="hidden lg:block h-5 w-5 text-gray-400" />
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