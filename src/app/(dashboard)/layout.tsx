import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import DashboardShell from "@/components/DashboardShell";

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
    <DashboardShell
      session={session}
      role={user.role}
      pendingEditRequests={pendingEditRequests}
    >
      {children}
    </DashboardShell>
  );
}
