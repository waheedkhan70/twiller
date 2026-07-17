"use client";

import {
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
} from "firebase/auth";
import React, { createContext, useContext, useState, useEffect } from "react";
import { auth } from "./firebase";
import axiosInstance from "../lib/axiosInstance";
import "../lib/i18n";
import i18n from "../lib/i18n";
import LoginOTPModal from "../components/LoginOTPModal";

interface User {
  _id: string;
  username: string;
  displayName: string;
  avatar: string;
  bio?: string;
  joinedDate: string;
  email: string;
  phone?: string;
  website: string;
  location: string;
  notificationsEnabled: boolean;
  plan: "Free" | "Bronze" | "Silver" | "Gold";
  tweetCount: number;
  loginHistory?: Array<{
    browser: string;
    os: string;
    device: string;
    ip: string;
    timestamp: string;
  }>;
}

interface AuthContextType {
  user: User | null;
  login: (email: string, password: string) => Promise<void>;
  signup: (
    email: string,
    password: string,
    username: string,
    displayName: string
  ) => Promise<void>;
  updateProfile: (profileData: {
    displayName: string;
    bio: string;
    location: string;
    website: string;
    avatar: string;
  }) => Promise<void>;
  logout: () => void;
  isLoading: boolean;
  googlesignin: () => void;
  toggleNotifications: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // States for Login Environment OTP feature
  const [showLoginOtp, setShowLoginOtp] = useState(false);
  const [pendingLoginEmail, setPendingLoginEmail] = useState("");

  const handleOtpVerified = (userData: any) => {
    setShowLoginOtp(false);
    setPendingLoginEmail("");
    setUser(userData);
    localStorage.setItem("twitter-user", JSON.stringify(userData));
    if (userData.language && userData.language !== i18n.language) {
      i18n.changeLanguage(userData.language);
    }
  };

  // Load user from localStorage on mount (initial sync)
  useEffect(() => {
    const savedUser = localStorage.getItem("twitter-user");
    if (savedUser) {
      setUser(JSON.parse(savedUser));
    }
  }, []);

  useEffect(() => {
    // Check for existing session
    const unsubcribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser?.email) {
        try {
          const res = await axiosInstance.get("/loggedinuser", {
            params: { email: firebaseUser.email },
          });

          if (res.data) {
            setUser(res.data);
            localStorage.setItem("twitter-user", JSON.stringify(res.data));
            // Sync i18n language with user preference
            if (res.data.language && res.data.language !== i18n.language) {
              i18n.changeLanguage(res.data.language);
            }
          }
        } catch (err) {
          console.log("Failed to fetch user:", err);
        }
      } else {
        // Only clear user if no user exists in localStorage (which could be a backend-only session)
        const savedUser = localStorage.getItem("twitter-user");
        if (!savedUser) {
          setUser(null);
        }
      }
      setIsLoading(false);
    });
    return () => unsubcribe();
  }, []);

  const login = async (email: string, password: string) => {
    setIsLoading(true);
    let successfulEmail = "";
    
    try {
      // 1. Try Firebase authentication first
      const usercred = await signInWithEmailAndPassword(auth, email, password);
      successfulEmail = usercred.user.email || email;
    } catch (firebaseErr: any) {
      console.warn("Firebase login failed, trying backend fallback...", firebaseErr.message);
      
      // 2. Fallback to backend login
      try {
        const res = await axiosInstance.post("/login", { email, password });
        if (!res.data) {
          throw new Error("Invalid credentials");
        }
        successfulEmail = res.data.email || email;
      } catch (backendErr: any) {
        console.error("Backend login also failed:", backendErr.response?.data?.error || backendErr.message);
        throw new Error(backendErr.response?.data?.error || "Invalid email or password");
      }
    }

    if (successfulEmail) {
      try {
        const envRes = await axiosInstance.post("/login-environment", { email: successfulEmail });
        
        if (envRes.data.requiresOtp) {
          setPendingLoginEmail(successfulEmail);
          setShowLoginOtp(true);
        } else {
          setUser(envRes.data.user);
          localStorage.setItem("twitter-user", JSON.stringify(envRes.data.user));
          if (envRes.data.user.language && envRes.data.user.language !== i18n.language) {
            i18n.changeLanguage(envRes.data.user.language);
          }
        }
      } catch (envErr: any) {
        // Log out immediately if environment check fails (e.g. 403 Mobile limit)
        await signOut(auth);
        throw new Error(envErr.response?.data?.error || "Environment check failed. Login restricted.");
      }
    }
    
    setIsLoading(false);
  };

  const signup = async (
    email: string,
    password: string,
    username: string,
    displayName: string
  ) => {
    setIsLoading(true);
    try {
      const usercred = await createUserWithEmailAndPassword(auth, email, password);
      const user = usercred.user;
      const newuser: any = {
        username,
        displayName,
        avatar: user.photoURL || "https://images.pexels.com/photos/1139743/pexels-photo-1139743.jpeg?auto=compress&cs=tinysrgb&w=400",
        email: user.email,
      };
      
      const res = await axiosInstance.post("/register", newuser);

      if (res.data) {
        // Enforce the environment rules on initial signup login too
        try {
          const envRes = await axiosInstance.post("/login-environment", { email: user.email });
          if (envRes.data.requiresOtp) {
            setPendingLoginEmail(user.email || '');
            setShowLoginOtp(true);
          } else {
            setUser(envRes.data.user);
            localStorage.setItem("twitter-user", JSON.stringify(envRes.data.user));
            if (envRes.data.user.language && envRes.data.user.language !== i18n.language) {
              i18n.changeLanguage(envRes.data.user.language);
            }
          }
        } catch (envErr: any) {
          await signOut(auth);
          throw new Error(envErr.response?.data?.error || "Environment check failed. Login restricted.");
        }
      }
    } catch (error: any) {
      console.error("Signup error:", error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    setUser(null);
    await signOut(auth);
    localStorage.removeItem("twitter-user");
  };

  const updateProfile = async (profileData: {
    displayName: string;
    bio: string;
    location: string;
    website: string;
    avatar: string;
  }) => {
    if (!user) return;

    setIsLoading(true);
    // Mock API call - in real app, this would call an API
    // await new Promise((resolve) => setTimeout(resolve, 1000));

    const updatedUser: User = {
      ...user,
      ...profileData,
    };
    const res = await axiosInstance.patch(
      `/userupdate/${user.email}`,
      updatedUser
    );
    if (res.data) {
      setUser(updatedUser);
      localStorage.setItem("twitter-user", JSON.stringify(updatedUser));
    }

    setIsLoading(false);
  };
  const toggleNotifications = async () => {
    if (!user) return;
    const newValue = !user.notificationsEnabled;
    const updatedUser = { ...user, notificationsEnabled: newValue };
    try {
      await axiosInstance.patch(`/userupdate/${user.email}`, { notificationsEnabled: newValue });
      setUser(updatedUser);
      localStorage.setItem("twitter-user", JSON.stringify(updatedUser));
    } catch (err) {
      console.error("Failed to update notification preference:", err);
    }
  };

  const googlesignin = async () => {
    setIsLoading(true);

    try {
      const googleauthprovider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, googleauthprovider);
      const firebaseuser = result.user;

      if (!firebaseuser?.email) {
        throw new Error("No email found in Google account");
      }

      // First check if user exists in our DB, if not, register them
      try {
        await axiosInstance.get("/loggedinuser", {
          params: { email: firebaseuser.email },
        });
      } catch (err: any) {
        const newuser: any = {
          username: firebaseuser.email.split("@")[0],
          displayName: firebaseuser.displayName || "User",
          avatar: firebaseuser.photoURL || "https://images.pexels.com/photos/1139743/pexels-photo-1139743.jpeg?auto=compress&cs=tinysrgb&w=400",
          email: firebaseuser.email,
        };
        await axiosInstance.post("/register", newuser);
      }

      // Once user exists, check login environment
      try {
        const envRes = await axiosInstance.post("/login-environment", { email: firebaseuser.email });
        if (envRes.data.requiresOtp) {
          setPendingLoginEmail(firebaseuser.email);
          setShowLoginOtp(true);
        } else {
          setUser(envRes.data.user);
          localStorage.setItem("twitter-user", JSON.stringify(envRes.data.user));
          if (envRes.data.user.language && envRes.data.user.language !== i18n.language) {
            i18n.changeLanguage(envRes.data.user.language);
          }
        }
      } catch (envErr: any) {
        await signOut(auth);
        throw new Error(envErr.response?.data?.error || "Environment check failed. Login restricted.");
      }

    } catch (error: any) {
      console.error("Google Sign-In Error:", error);
      alert(error.response?.data?.error || error.message || "Login failed");
    } finally {
      setIsLoading(false);
    }
  };

  const refreshUser = async () => {
    if (!user?.email) return;
    try {
      // Add timestamp to bypass potential caching
      const res = await axiosInstance.get("/loggedinuser", {
        params: { email: user.email, t: Date.now() },
      });
      if (res.data) {
        localStorage.removeItem("twitter-user");
        setUser(res.data);
        localStorage.setItem("twitter-user", JSON.stringify(res.data));
      }
    } catch (err) {
      console.error("Refresh user failed:", err);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        login,
        signup,
        updateProfile,
        logout,
        isLoading,
        googlesignin,
        toggleNotifications,
        refreshUser,
      }}
    >
      {children}
      <LoginOTPModal 
        isOpen={showLoginOtp} 
        onClose={() => setShowLoginOtp(false)} 
        email={pendingLoginEmail} 
        onVerified={handleOtpVerified} 
      />
    </AuthContext.Provider>
  );
};
