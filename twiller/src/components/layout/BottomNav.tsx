import React from 'react';
import { Home, Search, Bell, Mail } from 'lucide-react';
import { useNotification } from '@/context/NotificationContext';
import { useTranslation } from 'react-i18next';

interface BottomNavProps {
  currentPage: string;
  onNavigate: (page: string) => void;
}

export default function BottomNav({ currentPage, onNavigate }: BottomNavProps) {
  const { unreadCount } = useNotification();
  const { t } = useTranslation();

  const navItems = [
    { id: 'home', icon: Home, label: t('common.home') },
    { id: 'explore', icon: Search, label: t('common.explore') },
    { id: 'notifications', icon: Bell, label: t('common.notifications'), badge: unreadCount > 0 ? unreadCount : null },
    { id: 'messages', icon: Mail, label: t('common.messages') },
  ];

  return (
    <div className="md:hidden fixed bottom-0 left-0 right-0 bg-black/90 backdrop-blur-md border-t border-gray-800 z-50">
      <div className="flex justify-around items-center h-16 px-4">
        {navItems.map((item) => (
          <button
            key={item.id}
            onClick={() => onNavigate(item.id)}
            className="relative p-3 flex flex-col items-center justify-center text-gray-400 hover:text-white transition-colors"
          >
            <div className="relative inline-flex">
              <item.icon
                className={`h-7 w-7 transition-transform ${
                  currentPage === item.id ? 'text-white scale-110 stroke-[2.5px]' : ''
                }`}
              />
              {item.badge && (
                <span className="absolute -top-0.5 -right-0.5 bg-blue-500 rounded-full h-2.5 w-2.5 border-[1.5px] border-black" />
              )}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
