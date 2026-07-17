"use client";

import React, { createContext, useContext, useEffect, useCallback, useState, useRef } from "react";
import { toast } from "sonner";

const KEYWORDS = ["cricket", "science"];

interface AppNotification {
  id: string;
  authorName: string;
  content: string;
  timestamp: number;
  read: boolean;
}

interface NotificationContextType {
  requestPermission: () => Promise<NotificationPermission>;
  triggerTweetNotification: (tweetId: string, tweetContent: string, authorName: string) => void;
  notificationsList: AppNotification[];
  clearNotifications: () => void;
  markAsRead: (id: string) => void;
  unreadCount: number;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export const useNotification = () => {
  const context = useContext(NotificationContext);
  if (context === undefined) {
    throw new Error("useNotification must be used within a NotificationProvider");
  }
  return context;
};

export const NotificationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [notificationsList, setNotificationsList] = useState<AppNotification[]>([]);
  const processedTweets = useRef<Set<string>>(new Set());

  // Removed useEffect auto-request because browsers block it if not initiated by a user gesture.
  // The user should manually enable it from Profile Settings.

  const requestPermission = async (): Promise<NotificationPermission> => {
    if (typeof window === "undefined" || !("Notification" in window)) {
      return "denied";
    }
    if (Notification.permission !== "granted") {
      return await Notification.requestPermission();
    }
    return Notification.permission;
  };

  const clearNotifications = () => {
    setNotificationsList([]);
  };

  const markAsRead = (id: string) => {
    setNotificationsList((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n))
    );
  };

  const unreadCount = notificationsList.filter((n) => !n.read).length;

  /**
   * Fires a browser notification if:
   * 1. Browser Notification permission is granted
   * 2. The current user has notifications enabled (stored in localStorage)
   * 3. The tweet content contains one of the trigger keywords
   */
  const triggerTweetNotification = useCallback((tweetId: string, tweetContent: string, authorName: string) => {
    // Deduplicate: If we already processed this tweet, skip
    if (processedTweets.current.has(tweetId)) return;

    // Check user preference from localStorage
    const stored = localStorage.getItem("twitter-user");
    if (stored) {
      try {
        const parsedUser = JSON.parse(stored);
        if (parsedUser.notificationsEnabled === false) return;
      } catch {
        // Ignore parse errors
      }
    }

    // Check for keywords (case-insensitive)
    const lowerContent = tweetContent.toLowerCase();
    const matchedKeyword = KEYWORDS.find((kw) => lowerContent.includes(kw));
    if (!matchedKeyword) return;

    // Mark as processed
    processedTweets.current.add(tweetId);

    // Add to in-app notification state
    setNotificationsList(prev => [{
      id: tweetId,
      authorName,
      content: tweetContent,
      timestamp: Date.now(),
      read: false
    }, ...prev]);

    // Fire in-app toast notification as a visual fallback in case OS popups are suppressed
    toast.info(`Trending Tweet by ${authorName}`, {
      description: tweetContent,
      duration: 6000,
    });

    // Fire OS-level browser notification
    if (typeof window !== "undefined" && "Notification" in window && Notification.permission === "granted") {
      try {
        const notification = new Notification("Trending Tweet!", {
          body: `${authorName}: ${tweetContent}`,
          icon: "/favicon.ico",
          tag: `tweet-${Date.now()}`,
          badge: "/favicon.ico",
        });
        setTimeout(() => notification.close(), 6000);
      } catch (err) {
        console.error("Native notification failed:", err);
      }
    }
  }, []);

  return (
    <NotificationContext.Provider value={{ 
      requestPermission, 
      triggerTweetNotification, 
      notificationsList, 
      clearNotifications,
      markAsRead,
      unreadCount
    }}>
      {children}
    </NotificationContext.Provider>
  );
};
