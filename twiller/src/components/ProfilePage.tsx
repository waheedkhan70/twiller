"use client";

import React, { useEffect, useState } from "react";
import {
  ArrowLeft,
  Calendar,
  MapPin,
  Link as LinkIcon,
  MoreHorizontal,
  Camera,
  Settings,
  Bell,
  BellOff,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useNotification } from "@/context/NotificationContext";
import { Button } from "./ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";
import TweetCard from "./TweetCard";
import { Card, CardContent } from "./ui/card";
import Editprofile from "./Editprofile";
import axiosInstance from "@/lib/axiosInstance";

interface Tweet {
  id: string;
  author: {
    id: string;
    username: string;
    displayName: string;
    avatar: string;
    verified?: boolean;
  };
  content: string;
  timestamp: string;
  likes: number;
  retweets: number;
  comments: number;
  liked?: boolean;
  retweeted?: boolean;
  image?: string;
}
const tweets: Tweet[] = [
  {
    id: "1",
    author: {
      id: "1",
      username: "elonmusk",
      displayName: "Elon Musk",
      avatar:
        "https://images.pexels.com/photos/2379005/pexels-photo-2379005.jpeg?auto=compress&cs=tinysrgb&w=400",
      verified: true,
    },
    content:
      "Just had an amazing conversation about the future of AI. The possibilities are endless!",
    timestamp: "2h",
    likes: 1247,
    retweets: 324,
    comments: 89,
    liked: false,
    retweeted: false,
  },
  {
    id: "2",
    author: {
      id: "1",
      username: "sarahtech",
      displayName: "Sarah Johnson",
      avatar:
        "https://images.pexels.com/photos/415829/pexels-photo-415829.jpeg?auto=compress&cs=tinysrgb&w=400",
      verified: false,
    },
    content:
      "Working on some exciting new features for our app. Can't wait to share what we've been building!",
    timestamp: "4h",
    likes: 89,
    retweets: 23,
    comments: 12,
    liked: true,
    retweeted: false,
  },
  {
    id: "3",
    author: {
      id: "4",
      username: "designguru",
      displayName: "Alex Chen",
      avatar:
        "https://images.pexels.com/photos/1681010/pexels-photo-1681010.jpeg?auto=compress&cs=tinysrgb&w=400",
      verified: true,
    },
    content:
      "The new design system is finally complete! It took 6 months but the results are incredible. Clean, consistent, and accessible.",
    timestamp: "6h",
    likes: 456,
    retweets: 78,
    comments: 34,
    liked: false,
    retweeted: true,
    image:
      "https://images.pexels.com/photos/196645/pexels-photo-196645.jpeg?auto=compress&cs=tinysrgb&w=800",
  },
];
import { useTranslation } from "react-i18next";

export default function ProfilePage() {
  const { user, toggleNotifications } = useAuth();
  const { t } = useTranslation();
  const { requestPermission } = useNotification();
  const [activeTab, setActiveTab] = useState("posts");
  const [showEditModal, setShowEditModal] = useState(false);
  const [browserPermission, setBrowserPermission] = useState<NotificationPermission>("default");

  useEffect(() => {
    if (typeof window !== "undefined" && "Notification" in window) {
      setBrowserPermission(Notification.permission);
    }
  }, []);

  const handleToggleNotifications = async () => {
    // If user is enabling notifications, also request browser permission
    if (!user?.notificationsEnabled) {
      const permission = await requestPermission();
      setBrowserPermission(permission);
    }
    await toggleNotifications();
  };

  if (!user) return null;
  const [tweets, setTweets] = useState<any>([]);
  const [loading, setloading] = useState(false);
  const fetchTweets = async () => {
    try {
      setloading(true);
      const res = await axiosInstance.get("/post");
      setTweets(res.data);
    } catch (error) {
      console.error(error);
    } finally {
      setloading(false);
    }
  };
  useEffect(() => {
    fetchTweets();
  }, []);
  const handletweetdelete = (tweetId: string) => {
    setTweets((prev: any) => prev.filter((t: any) => t._id !== tweetId));
  };
  // Filter tweets by current user
  const userTweets = tweets.filter((tweet: any) => tweet.author._id === user._id);

  return (
    <div className="min-h-screen">
      {/* Header */}
      <div className="sticky top-0 bg-black/90 backdrop-blur-md border-b border-gray-800 z-10">
        <div className="flex items-center px-4 py-3 space-x-8">
          <Button
            variant="ghost"
            size="sm"
            className="p-2 rounded-full hover:bg-gray-900"
          >
            <ArrowLeft className="h-5 w-5 text-white" />
          </Button>
          <div>
            <h1 className="text-xl font-bold text-white">{user.displayName}</h1>
            <p className="text-sm text-gray-400">{userTweets.length} {t('common.tweets')}</p>
          </div>
        </div>
      </div>

      {/* Cover Photo */}
      <div className="relative">
        <div className="h-48 bg-gradient-to-r from-blue-600 to-purple-600 relative">
          <Button
            variant="ghost"
            size="sm"
            className="absolute top-4 right-4 p-2 rounded-full bg-black/50 hover:bg-black/70"
          >
            <Camera className="h-5 w-5 text-white" />
          </Button>
        </div>

        {/* Profile Picture */}
        <div className="absolute -bottom-16 left-4">
          <div className="relative">
            <Avatar className="h-32 w-32 border-4 border-black">
              <AvatarImage src={user.avatar} alt={user.displayName} />
              <AvatarFallback className="text-2xl">
                {user.displayName[0]}
              </AvatarFallback>
            </Avatar>
            <Button
              variant="ghost"
              size="sm"
              className="absolute bottom-2 right-2 p-2 rounded-full bg-black/70 hover:bg-black/90"
            >
              <Camera className="h-4 w-4 text-white" />
            </Button>
          </div>
        </div>

        {/* Edit Profile Button */}
        <div className="flex justify-end p-4">
          <Button
            variant="outline"
            className="border-gray-600 text-white bg-gray-950 font-semibold rounded-full px-6"
            onClick={() => setShowEditModal(true)}
          >
            {t('common.edit_profile')}
          </Button>
        </div>
      </div>

      {/* Profile Info */}
      <div className="px-4 pb-4 mt-20">
        <div className="flex items-start justify-between mb-3">
          <div>
            <h1 className="text-2xl font-bold text-white">
              {user.displayName}
            </h1>
            <p className="text-gray-400">@{user.username}</p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="p-2 rounded-full hover:bg-gray-900"
          >
            <MoreHorizontal className="h-5 w-5 text-gray-400" />
          </Button>
        </div>

        {user.bio && (
          <p className="text-white mb-3 leading-relaxed">{user.bio}</p>
        )}

        <div className="flex items-center space-x-4 text-gray-400 text-sm mb-3">
          <div className="flex items-center space-x-1">
            <MapPin className="h-4 w-4" />
            <span>{user.location ? user.location : "Earth"}</span>
          </div>
          <div className="flex items-center space-x-1">
            <LinkIcon className="h-4 w-4" />
            <span className="text-blue-400">
              {user.website ? user.website : "example.com"}
            </span>
          </div>
          <div className="flex items-center space-x-1">
            <Calendar className="h-4 w-4" />
            <span>
              {t('common.joined')}{" "}
              {user.joinedDate &&
                new Date(user.joinedDate).toLocaleDateString("en-us", {
                  month: "long",
                  year: "numeric",
                })}
            </span>
          </div>
        </div>
      </div>

      {/* Notification Settings */}
      <div className="px-4 pb-2 mt-2">
        <div className="border border-gray-800 rounded-2xl p-4 bg-gradient-to-br from-gray-900/80 to-black">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div
                className={`p-2 rounded-full ${user.notificationsEnabled
                    ? "bg-blue-500/20 text-blue-400"
                    : "bg-gray-800 text-gray-500"
                  }`}
              >
                {user.notificationsEnabled ? (
                  <Bell className="h-5 w-5" />
                ) : (
                  <BellOff className="h-5 w-5" />
                )}
              </div>
              <div>
                <p className="text-white font-semibold text-sm">Tweet Notifications</p>
                <p className="text-gray-400 text-xs mt-0.5">
                  {user.notificationsEnabled
                    ? "Get notified for tweets with \"cricket\" or \"science\""
                    : "Notifications are currently disabled"}
                </p>
                {browserPermission === "denied" && (
                  <p className="text-yellow-500 text-xs mt-1">
                    Browser notifications are blocked. Allow them in browser settings.
                  </p>
                )}
              </div>
            </div>
            {/* Toggle Switch */}
            <button
              id="notification-toggle-btn"
              onClick={handleToggleNotifications}
              className={`relative w-12 h-6 rounded-full transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-black ${user.notificationsEnabled
                  ? "bg-blue-500"
                  : "bg-gray-700"
                }`}
              aria-label="Toggle notifications"
            >
              <span
                className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow-md transform transition-transform duration-300 ${user.notificationsEnabled ? "translate-x-6" : "translate-x-0"
                  }`}
              />
            </button>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-6 bg-transparent border-b border-gray-800 rounded-none h-auto">
          <TabsTrigger
            value="posts"
            className="relative flex items-center justify-center data-[state=active]:bg-transparent data-[state=active]:text-white text-gray-400 hover:bg-gray-800/40 transition-all py-4 font-bold border-none"
          >
            <span>{t('common.tweets')}</span>
            <div className="absolute bottom-0 h-[4px] w-1/2 bg-blue-500 rounded-full hidden [[data-state=active]_&]:block" />
          </TabsTrigger>
          <TabsTrigger
            value="replies"
            className="relative flex items-center justify-center data-[state=active]:bg-transparent data-[state=active]:text-white text-gray-400 hover:bg-gray-800/40 transition-all py-4 font-bold border-none"
          >
            <span>{t('common.replies')}</span>
            <div className="absolute bottom-0 h-[4px] w-1/2 bg-blue-500 rounded-full hidden [[data-state=active]_&]:block" />
          </TabsTrigger>
          <TabsTrigger
            value="highlights"
            className="relative flex items-center justify-center data-[state=active]:bg-transparent data-[state=active]:text-white text-gray-400 hover:bg-gray-800/40 transition-all py-4 font-bold border-none"
          >
            <span>Highlights</span>
            <div className="absolute bottom-0 h-[4px] w-1/2 bg-blue-500 rounded-full hidden [[data-state=active]_&]:block" />
          </TabsTrigger>
          <TabsTrigger
            value="articles"
            className="relative flex items-center justify-center data-[state=active]:bg-transparent data-[state=active]:text-white text-gray-400 hover:bg-gray-800/40 transition-all py-4 font-bold border-none"
          >
            <span>Articles</span>
            <div className="absolute bottom-0 h-[4px] w-1/2 bg-blue-500 rounded-full hidden [[data-state=active]_&]:block" />
          </TabsTrigger>
          <TabsTrigger
            value="media"
            className="relative flex items-center justify-center data-[state=active]:bg-transparent data-[state=active]:text-white text-gray-400 hover:bg-gray-800/40 transition-all py-4 font-bold border-none"
          >
            <span>Media</span>
            <div className="absolute bottom-0 h-[4px] w-1/2 bg-blue-500 rounded-full hidden [[data-state=active]_&]:block" />
          </TabsTrigger>
          <TabsTrigger
            value="security"
            className="relative flex items-center justify-center data-[state=active]:bg-transparent data-[state=active]:text-white text-gray-400 hover:bg-gray-800/40 transition-all py-4 font-bold border-none"
          >
            <span>Security</span>
            <div className="absolute bottom-0 h-[4px] w-1/2 bg-blue-500 rounded-full hidden [[data-state=active]_&]:block" />
          </TabsTrigger>
        </TabsList>

        <TabsContent value="posts" className="mt-0">
          <div className="divide-y divide-gray-800">
            {loading ? (
              <Card className="bg-black border-none">
                <CardContent className="py-12 text-center">
                  <div className="text-gray-400">
                    <h3 className="text-2xl font-bold mb-2">
                      You haven't posted yet
                    </h3>
                    <p>When you post, it will show up here.</p>
                  </div>
                </CardContent>
              </Card>
            ) : (
              userTweets.map((tweet: any) => (
                <TweetCard key={tweet._id} tweet={tweet} onTweetDeleted={handletweetdelete} />
              ))
            )}
          </div>
        </TabsContent>

        <TabsContent value="replies" className="mt-0">
          <Card className="bg-black border-none">
            <CardContent className="py-12 text-center">
              <div className="text-gray-400">
                <h3 className="text-2xl font-bold mb-2">
                  You haven't replied yet
                </h3>
                <p>When you reply to a post, it will show up here.</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="highlights" className="mt-0">
          <Card className="bg-black border-none">
            <CardContent className="py-12 text-center">
              <div className="text-gray-400">
                <h3 className="text-2xl font-bold mb-2">
                  Lights, camera … attachments!
                </h3>
                <p>When you post photos or videos, they will show up here.</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="articles" className="mt-0">
          <Card className="bg-black border-none">
            <CardContent className="py-12 text-center">
              <div className="text-gray-400">
                <h3 className="text-2xl font-bold mb-2">
                  You haven't written any articles
                </h3>
                <p>When you write articles, they will show up here.</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="media" className="mt-0">
          <Card className="bg-black border-none">
            <CardContent className="py-12 text-center">
              <div className="text-gray-400">
                <h3 className="text-2xl font-bold mb-2">
                  Lights, camera … attachments!
                </h3>
                <p>When you post photos or videos, they will show up here.</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="security" className="mt-0">
          <div className="p-4 sm:p-6 bg-black">
            <h2 className="text-2xl font-bold text-white mb-6 border-b border-gray-800 pb-2">Login History</h2>
            <Card className="bg-[#16181c] border border-gray-800 rounded-2xl overflow-hidden">
              <CardContent className="p-0">
                {!user.loginHistory || user.loginHistory.length === 0 ? (
                  <div className="text-center py-12 text-gray-400">
                    <p>No login history recorded yet.</p>
                  </div>
                ) : (
                  <ul className="divide-y divide-gray-800">
                    {user.loginHistory.slice().reverse().map((record: any, index: number) => (
                      <li key={index} className="p-4 flex items-center justify-between hover:bg-gray-900 transition-colors">
                        <div className="flex flex-col">
                          <span className="text-gray-100 font-medium tracking-wide">
                            <span className="text-blue-400 font-bold capitalize">{record.device}</span> ({record.os})
                          </span>
                          <span className="text-gray-400 text-sm mt-1">
                            Browser: <span className="text-white">{record.browser}</span> | IP: <span className="text-white">{record.ip}</span>
                          </span>
                        </div>
                        <span className="text-gray-500 text-xs text-right ml-4 whitespace-nowrap">
                          {new Date(record.timestamp).toLocaleString(undefined, {
                            year: 'numeric', month: 'short', day: 'numeric',
                            hour: '2-digit', minute: '2-digit'
                          })}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
      <Editprofile
        isopen={showEditModal}
        onclose={() => setShowEditModal(false)}
      />
    </div>
  );
}
