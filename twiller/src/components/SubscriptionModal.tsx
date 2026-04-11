"use client";

import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "./ui/dialog";
import { Button } from "./ui/button";
import { Check, Zap, Star, Shield, Clock } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import axiosInstance from "@/lib/axiosInstance";
import { toast } from "sonner";

interface SubscriptionModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const PLANS = [
  {
    name: "Free",
    price: "₹0",
    features: ["1 Tweet limit", "Basic Support", "Standard Features"],
    color: "gray",
    icon: Shield,
    limit: "1 Tweet",
  },
  {
    name: "Bronze",
    price: "₹100",
    features: ["Up to 3 Tweets", "Priority Feed", "Bronze Badge"],
    color: "orange",
    icon: Zap,
    limit: "3 Tweets",
  },
  {
    name: "Silver",
    price: "₹300",
    features: ["Up to 5 Tweets", "Ad-Free Experience", "Silver Badge"],
    color: "blue",
    icon: Star,
    limit: "5 Tweets",
  },
  {
    name: "Gold",
    price: "₹1000",
    features: ["Unlimited Tweets", "Premium Analytics", "Verified Gold Badge", "24/7 Support"],
    color: "yellow",
    icon: Star,
    limit: "Unlimited",
  },
];

export default function SubscriptionModal({ isOpen, onClose }: SubscriptionModalProps) {
  const { user, refreshUser } = useAuth();
  const [loading, setLoading] = useState<string | null>(null);
  const [isWindowOpen, setIsWindowOpen] = useState(true);

  useEffect(() => {
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.async = true;
    document.body.appendChild(script);

    return () => {
      document.body.removeChild(script);
    };
  }, []);

  useEffect(() => {
    // Check if within 10-11 AM IST
    const checkTime = () => {
      const nowIST = new Date(
        new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" })
      );
      const hour = nowIST.getHours();
      setIsWindowOpen(hour === 10);
    };
    checkTime();
    const timer = setInterval(checkTime, 60000);
    return () => clearInterval(timer);
  }, []);

  const handleSubscription = async (planName: string) => {
    if (planName === "Free") return;
    if (!isWindowOpen) {
      toast.error("Subscriptions are only available between 10:00 AM and 11:00 AM IST.");
      return;
    }

    setLoading(planName);
    try {
      // 1. Create order
      const { data: order } = await axiosInstance.post("/create-subscription-order", {
        plan: planName,
        userId: user?._id,
      });

      // 2. Load Razorpay
      const options = {
        key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID || "rzp_test_placeholder",
        amount: order.amount,
        currency: "INR",
        name: "Twiller Premium",
        description: `${planName} Plan Subscription`,
        order_id: order.id,
        handler: async (response: any) => {
          try {
            const { data } = await axiosInstance.post("/verify-subscription-payment", {
              ...response,
              userId: user?._id,
              plan: planName,
            });
            toast.success(`Welcome to ${planName}! Check your email for the invoice.`);
            onClose();
            // Pull latest plan data
            await refreshUser();
          } catch (err: any) {
            console.error("Payment verification failed details:", err.response?.data || err.message);
            toast.error("Payment verification failed.");
          }
        },
        prefill: {
          name: user?.displayName,
          email: user?.email,
        },
        theme: {
          color: "#1d9bf0",
        },
      };

      const rzp = new (window as any).Razorpay(options);
      rzp.open();
    } catch (error: any) {
      toast.error(error.response?.data?.error || "Failed to initiate payment.");
    } finally {
      setLoading(null);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl bg-black border-gray-800 text-white p-0 overflow-hidden">
        <div className="p-6">
          <DialogHeader className="mb-6">
            <DialogTitle className="text-3xl font-bold flex items-center gap-2">
              Upgrade Your Experience <Zap className="text-blue-500" />
            </DialogTitle>
            <DialogDescription className="text-gray-400 text-lg">
              Choose a plan that fits your posting needs.
            </DialogDescription>
          </DialogHeader>

          {!isWindowOpen && (
            <div className="bg-yellow-900/20 border border-yellow-700/50 rounded-lg p-4 mb-6 flex items-start gap-3">
              <Clock className="text-yellow-500 mt-1 flex-shrink-0" />
              <div>
                <p className="text-yellow-500 font-semibold italic">Limited Payment Window</p>
                <p className="text-yellow-600/80 text-sm">
                  Payments are currently restricted. Please return between **10:00 AM and 11:00 AM IST** to upgrade your plan.
                </p>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {PLANS.map((plan) => {
              const isCurrent = user?.plan === plan.name;
              
              return (
                <div
                  key={plan.name}
                  className={`relative p-5 rounded-2xl border ${
                    isCurrent ? "border-blue-500 bg-blue-500/5" : "border-gray-800 bg-gray-900/30"
                  } flex flex-col transition-all hover:border-gray-700`}
                >
                  {isCurrent && (
                    <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-blue-500 text-white text-[10px] uppercase font-bold px-2 py-1 rounded">
                      Current Plan
                    </span>
                  )}
                  
                  <div className="mb-4">
                    <plan.icon className={`h-8 w-8 mb-2 ${
                      plan.name === 'Gold' ? 'text-yellow-500' : 
                      plan.name === 'Silver' ? 'text-blue-400' : 
                      plan.name === 'Bronze' ? 'text-orange-400' : 'text-gray-400'
                    }`} />
                    <h3 className="text-xl font-bold">{plan.name}</h3>
                    <p className="text-2xl font-bold mt-1">
                      {plan.price}<span className="text-sm text-gray-500 font-normal">/mo</span>
                    </p>
                    <p className="text-sm text-blue-500 font-semibold mt-1">{plan.limit} limit</p>
                  </div>

                  <ul className="flex-1 space-y-3 mb-6">
                    {plan.features.map((feature) => (
                      <li key={feature} className="flex items-start gap-2 text-sm text-gray-400">
                        <Check className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                        {feature}
                      </li>
                    ))}
                  </ul>

                  <Button
                    disabled={isCurrent || plan.name === "Free" || loading !== null || !isWindowOpen}
                    onClick={() => handleSubscription(plan.name)}
                    className={`w-full rounded-full font-bold ${
                      isCurrent ? "bg-gray-800 text-white cursor-not-allowed" : "bg-blue-500 hover:bg-blue-600"
                    }`}
                  >
                    {loading === plan.name ? "Processing..." : isCurrent ? "Active" : `Upgrade to ${plan.name}`}
                  </Button>
                </div>
              );
            })}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

const PLAN_PRICES = {
  Free: 0,
  Bronze: 100,
  Silver: 300,
  Gold: 1000,
};
