"use client";

import React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";
import TweetComposer from "./TweetComposer";
import { X } from "lucide-react";

import { useTranslation } from "react-i18next";

interface PostModalProps {
  isOpen: boolean;
  onClose: () => void;
  onTweetPosted?: (tweet: any) => void;
}

export default function PostModal({ isOpen, onClose, onTweetPosted }: PostModalProps) {
  const { t } = useTranslation();
  
  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[600px] bg-black border-gray-800 p-0 overflow-hidden">
        <DialogHeader className="p-4 border-b border-gray-800 flex flex-row items-center justify-between">
          <DialogTitle className="text-white font-bold">{t('common.tweet')}</DialogTitle>
        </DialogHeader>
        <div className="max-h-[80vh] overflow-y-auto">
          <TweetComposer 
            onTweetPosted={(tweet: any) => {
              onTweetPosted?.(tweet);
              onClose();
            }} 
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
