import type { Metadata } from "next";

import { AdminScreen } from "@/components/screens/AdminScreen";

export const metadata: Metadata = { title: "Admin" };

export default function AdminPage() {
  return <AdminScreen />;
}
