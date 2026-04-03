"use client";

import React, { createContext, useContext, useEffect, useCallback } from "react";

const KEYWORDS = ["cricket", "science"];

interface NotificationContextType {
  requestPermission: () => Promise<NotificationPermission>;
  triggerTweetNotification: (tweetContent: string, authorName: string) => void;
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
  // Request permission on mount if not yet decided
  useEffect(() => {
    if (typeof window !== "undefined" && "Notification" in window) {
      if (Notification.permission === "default") {
        Notification.requestPermission();
      }
    }
  }, []);

  const requestPermission = async (): Promise<NotificationPermission> => {
    if (typeof window === "undefined" || !("Notification" in window)) {
      return "denied";
    }
    if (Notification.permission !== "granted") {
      return await Notification.requestPermission();
    }
    return Notification.permission;
  };

  /**
   * Fires a browser notification if:
   * 1. Browser Notification permission is granted
   * 2. The current user has notifications enabled (stored in localStorage)
   * 3. The tweet content contains one of the trigger keywords
   */
  const triggerTweetNotification = useCallback((tweetContent: string, authorName: string) => {
    if (typeof window === "undefined" || !("Notification" in window)) return;
    if (Notification.permission !== "granted") return;

    // Check user preference from localStorage
    const stored = localStorage.getItem("twitter-user");
    if (stored) {
      try {
        const parsedUser = JSON.parse(stored);
        // Explicitly check: if the field is present and false, skip
        if (parsedUser.notificationsEnabled === false) return;
      } catch {
        // Ignore parse errors
      }
    }

    // Check for keywords (case-insensitive)
    const lowerContent = tweetContent.toLowerCase();
    const matchedKeyword = KEYWORDS.find((kw) => lowerContent.includes(kw));
    if (!matchedKeyword) return;

    // Fire the notification
    const notification = new Notification("Trending Tweet!", {
      body: `${authorName}: ${tweetContent}`,
      icon: "/favicon.ico",
      tag: `tweet-${Date.now()}`,
      badge: "/favicon.ico",
    });

    // Auto-close after 6 seconds
    setTimeout(() => notification.close(), 6000);
  }, []);

  return (
    <NotificationContext.Provider value={{ requestPermission, triggerTweetNotification }}>
      {children}
    </NotificationContext.Provider>
  );
};
