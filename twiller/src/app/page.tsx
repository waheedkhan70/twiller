import Landing from "@/components/Landing";
import Mainlayout from "@/components/layout/Mainlayout";
import { AuthProvider } from "@/context/AuthContext";
import { NotificationProvider } from "@/context/NotificationContext";

export default function Home() {
  return (
    <AuthProvider>
      <NotificationProvider>
        <Mainlayout>
          {" "}
          <Landing />
        </Mainlayout>
      </NotificationProvider>
    </AuthProvider>
  );
}
