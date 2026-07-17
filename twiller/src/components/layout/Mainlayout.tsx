"use client";
import { useAuth } from "@/context/AuthContext";
import React, { useState } from "react";
import LoadingSpinner from "../loading-spinner";
import Sidebar from "./Sidebar";
import RightSidebar from "./Rightsidebar";
import ProfilePage from "../ProfilePage";
import SubscriptionModal from "../SubscriptionModal";
import PostModal from "../PostModal";
import NotificationsPage from "../NotificationsPage";
import BottomNav from "./BottomNav";
import MobileDrawer from "./MobileDrawer";
import { Feather } from "lucide-react";

const Mainlayout = ({ children }: { children: React.ReactNode }) => {
  const { user, isLoading, logout } = useAuth();
  const [currentPage, setCurrentPage] = React.useState("home");
  const [isSubModalOpen, setIsSubModalOpen] = React.useState(false);
  const [isPostModalOpen, setIsPostModalOpen] = React.useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = React.useState(false);

  React.useEffect(() => {
    const handleOpen = () => setIsMobileMenuOpen(true);
    window.addEventListener('open-mobile-menu', handleOpen);
    return () => window.removeEventListener('open-mobile-menu', handleOpen);
  }, []);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center">
          <div className="text-white text-4xl font-bold mb-4">X</div>
          <LoadingSpinner size="lg" />
        </div>
      </div>
    );
  }

  // If user is not logged in → show children (like login/signup pages)
  if (!user) {
    return <>{children}</>;
  }

  return (
    <div className="min-h-screen bg-black text-white flex justify-center relative">
      {/* Left Sidebar - Hidden on mobile, Icons on tablet, Full on desktop */}
      <div className="hidden md:flex flex-col md:w-20 lg:w-64 border-r border-gray-800 sticky top-0 h-screen overflow-y-auto scrollbar-hide">
        <Sidebar
          currentPage={currentPage}
          onNavigate={setCurrentPage}
          onOpenPremium={() => setIsSubModalOpen(true)}
          onOpenPost={() => setIsPostModalOpen(true)}
        />
      </div>

      {/* Main Content - Full width on mobile, 600px fixed on tablet+ */}
      <main className="w-full md:w-[600px] flex-none border-x border-gray-800 pb-20 md:pb-0 relative min-h-screen">
        {currentPage === "profile" ? (
          <ProfilePage />
        ) : currentPage === "notifications" ? (
          <NotificationsPage />
        ) : (
          children
        )}
      </main>

      {/* Right Sidebar - Hidden until desktop */}
      <div className="hidden lg:block w-80 p-4 sticky top-0 h-screen overflow-y-auto scrollbar-hide">
        <RightSidebar onOpenPremium={() => setIsSubModalOpen(true)} />
      </div>

      {/* Mobile Bottom Navigation */}
      <BottomNav currentPage={currentPage} onNavigate={setCurrentPage} />

      {/* Mobile Floating Action Button (FAB) for composing tweets */}
      <div className="md:hidden fixed bottom-20 right-4 z-50">
        <button
          onClick={() => setIsPostModalOpen(true)}
          className="w-14 h-14 bg-blue-500 hover:bg-blue-600 rounded-full flex items-center justify-center shadow-lg transition-transform active:scale-95"
          aria-label="Compose Tweet"
        >
          <svg viewBox="0 0 24 24" aria-hidden="true" className="w-6 h-6 fill-white"><g><path d="M23 3c-6.62-.1-10.38 2.421-13.05 6.095C7.98 12.86 6 15.69 6 18.77c0 1.956.88 3.738 2.46 4.965C9.43 24.502 10.66 25 12 25c1.33 0 2.57-.498 3.54-1.265 1.58-1.227 2.46-3.009 2.46-4.965 0-3.08-1.98-5.91-3.95-9.675C16.71 5.421 20.48 2.9 23 3zm-9.05 15.935C12.98 19.732 12.51 20 12 20c-.51 0-.98-.268-1.95-1.065-1.07-.828-1.55-1.992-1.55-3.165 0-2.392 1.34-4.542 2.76-6.662.61-.92 1.25-1.85 1.92-2.825C13.88 7.378 14.65 8.423 15.34 9.475c1.42 2.12 2.76 4.27 2.76 6.662 0 1.173-.48 2.337-1.55 3.165-.97.797-1.44 1.065-1.95 1.065-.65 0-.82-.268-1.55-1.065zm2.75-8.23c-1.39-2.072-2.79-4.148-3.92-6.31 2.32-1.282 4.41-1.905 7.02-2.03-1.63 2.584-2.88 5.253-4.11 8.34H20v2h-3.34c.14 1.246.22 2.514.24 3.8.01.696-.06 1.385-.2 2.06.66-.54 1.16-1.21 1.48-1.96.2-.47.16-1.01-.1-1.45-.26-.45-.73-.72-1.25-.72H16v-2h.83c-1.2-1.62-2.58-3.23-3.95-4.84v2.79c-.06.74-.53 1.37-1.24 1.63-.71.26-1.49.03-1.96-.58-.46-.61-.5-1.46-.08-2.11.41-.65 1.15-1.01 1.92-.95v-.86zm-2.07 9.87c.28.21.61.32.96.32s.68-.11.96-.32c.57-.44.89-1.12.89-1.87s-.32-1.43-.89-1.87c-.28-.21-.61-.32-.96-.32s-.68.11-.96.32c-.57.44-.89 1.12-.89 1.87s.32 1.43.89 1.87z"/></g></svg>
        </button>
      </div>

      {/* Mobile Sidebar Drawer */}
      <MobileDrawer
        user={user}
        isOpen={isMobileMenuOpen}
        onClose={() => setIsMobileMenuOpen(false)}
        onNavigate={(page) => setCurrentPage(page)}
        onLogout={logout}
        onOpenPremium={() => setIsSubModalOpen(true)}
        onOpenPost={() => setIsPostModalOpen(true)}
      />

      <SubscriptionModal
        isOpen={isSubModalOpen}
        onClose={() => setIsSubModalOpen(false)}
      />

      <PostModal 
        isOpen={isPostModalOpen} 
        onClose={() => setIsPostModalOpen(false)} 
        onTweetPosted={() => {
          // If we had a global refresh, we'd call it here
          // For now, TweetComposer handles local state
        }}
      />
    </div>
  );
};

export default Mainlayout;
