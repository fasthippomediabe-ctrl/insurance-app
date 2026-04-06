import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import Sidebar from "@/components/Sidebar";
import TopBar from "@/components/TopBar";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session) redirect("/login");

  const user = session.user as any;
  const pendingEditRequests = user.role === "ADMIN"
    ? (await db.paymentEditRequest.count({ where: { status: "PENDING" } }))
      + (await db.memberEditRequest.count({ where: { status: "PENDING" } }))
    : 0;

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      <Sidebar role={user.role} pendingEditRequests={pendingEditRequests} />
      <div className="flex flex-col flex-1 overflow-hidden">
        <TopBar session={session} />
        <main className="flex-1 overflow-auto p-6">{children}</main>
      </div>
    </div>
  );
}
