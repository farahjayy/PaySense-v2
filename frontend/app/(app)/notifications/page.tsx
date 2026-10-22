import type { Metadata } from "next";

import { NotificationsScreen } from "@/components/screens/NotificationsScreen";

export const metadata: Metadata = { title: "Notifications" };

export default function NotificationsPage() {
  return <NotificationsScreen />;
}
