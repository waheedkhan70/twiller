import React from 'react';
import {
  Home,
  Search,
  Bell,
  Mail,
  Bookmark,
  User,
  Zap,
  MoreHorizontal,
  Globe,
  Plus,
  LogOut
} from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';
import { Button } from '../ui/button';
import { useTranslation } from 'react-i18next';
import { useNotification } from '@/context/NotificationContext';

interface MobileDrawerProps {
  user: any;
  isOpen: boolean;
  onClose: () => void;
  onNavigate: (page: string) => void;
  onLogout: () => void;
  onOpenPremium: () => void;
  onOpenPost: () => void;
}

export default function MobileDrawer({ user, isOpen, onClose, onNavigate, onLogout, onOpenPremium, onOpenPost }: MobileDrawerProps) {
  const { t } = useTranslation();
  const { unreadCount } = useNotification();

  if (!isOpen) return null;

  const links = [
    { name: t('common.home'), icon: Home, action: () => onNavigate('home') },
    { name: t('common.explore'), icon: Search, action: () => onNavigate('explore') },
    { name: t('common.notifications'), icon: Bell, action: () => onNavigate('notifications'), badge: unreadCount > 0 ? unreadCount : null },
    { name: t('common.messages'), icon: Mail, action: () => onNavigate('messages') },
    { name: t('common.bookmarks'), icon: Bookmark, action: () => onNavigate('bookmarks') },
    { name: t('common.profile'), icon: User, action: () => onNavigate('profile') },
    { name: 'Premium', icon: Zap, action: onOpenPremium },
    { name: t('common.more'), icon: MoreHorizontal, action: () => {} },
    { name: t('common.language'), icon: Globe, action: () => {} },
    { name: 'Log out', icon: LogOut, action: onLogout },
  ];

  return (
    <div className="md:hidden fixed inset-0 z-[100] flex">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Drawer */}
      <div className="relative w-[280px] h-full bg-black border-r border-gray-800 flex flex-col animate-in slide-in-from-left duration-200 shadow-2xl">
        {/* Header */}
        <div className="p-4 border-b border-gray-800">
          <div className="flex justify-between items-start mb-2">
            <Avatar className="h-10 w-10 cursor-pointer" onClick={() => onNavigate('profile')}>
              <AvatarImage src={user?.avatar} />
              <AvatarFallback>{user?.displayName?.[0]}</AvatarFallback>
            </Avatar>
            <button className="h-8 w-8 rounded-full border border-gray-600 flex items-center justify-center text-white hover:bg-gray-800 transition">
              <Plus className="h-5 w-5" />
            </button>
          </div>

          <div className="mt-2">
            <h2 className="text-white font-bold text-lg leading-tight">{user?.displayName}</h2>
            <p className="text-gray-500 text-sm">@{user?.username}</p>
          </div>


        </div>

        {/* Links */}
        <div className="flex-1 overflow-y-auto py-2">
          {links.map((link, idx) => (
            <React.Fragment key={link.name}>
              <Button
                variant="ghost"
                onClick={() => {
                  link.action();
                  onClose();
                }}
                className="w-full justify-start text-lg py-4 px-4 rounded-none hover:bg-gray-900 text-white font-semibold"
              >
                <div className="relative">
                  <link.icon className="mr-4 h-7 w-7 text-white" strokeWidth={2.5} />
                  {link.badge && (
                    <span className="absolute -top-1 -right-1 bg-blue-500 text-white text-[10px] rounded-full h-4 w-4 flex items-center justify-center">
                      {link.badge}
                    </span>
                  )}
                </div>
                {link.name}
              </Button>
            </React.Fragment>
          ))}
          
          <div className="mt-6 px-4">
            <Button 
              className="w-full bg-blue-500 hover:bg-blue-600 text-white font-bold py-6 rounded-full text-xl"
              onClick={() => {
                onClose();
                onOpenPost();
              }}
            >
              {t('common.post')}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
