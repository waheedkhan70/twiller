import ForgotPasswordPage from "@/components/ForgotPasswordPage";
import { AuthProvider } from "@/context/AuthContext";
import { NotificationProvider } from "@/context/NotificationContext";

export const metadata = {
  title: "Forgot Password — Twiller",
  description: "Reset your Twiller account password securely using your email or phone number.",
};

export default function ForgotPassword() {
  return (
    <AuthProvider>
      <NotificationProvider>
        <ForgotPasswordPage />
      </NotificationProvider>
    </AuthProvider>
  );
}
