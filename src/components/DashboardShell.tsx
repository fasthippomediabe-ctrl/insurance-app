"use client";

import { useState } from "react";
import { Session } from "next-auth";
import Sidebar from "./Sidebar";
import TopBar from "./TopBar";

export default function DashboardShell({
  session,
  role,
  pendingEditRequests,
  children,
}: {
  session: Session;
  role: string;
  pendingEditRequests: number;
  children: React.ReactNode;
}) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      <Sidebar
        role={role}
        pendingEditRequests={pendingEditRequests}
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />
      <div className="flex flex-col flex-1 overflow-hidden min-w-0">
        <TopBar session={session} onMenuToggle={() => setSidebarOpen(!sidebarOpen)} />
        <main className="flex-1 overflow-auto p-3 sm:p-6">{children}</main>
      </div>
    </div>
  );
}
