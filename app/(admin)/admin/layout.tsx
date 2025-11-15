import type { Metadata } from "next";
import "@/app/globals.css";
import { RouteReadyAnnouncer } from "@/components/route-ready-announcer";

export const metadata: Metadata = {
  title: "Админка — RINART",
  robots: {
    index: false,
    follow: false,
  },
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <RouteReadyAnnouncer />
    </>
  );
}
