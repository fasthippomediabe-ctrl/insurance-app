import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import AdminPanel from "@/components/AdminPanel";

export default async function AdminPage() {
  const session = await auth();
  const user = session!.user as any;
  if (user.role !== "ADMIN") redirect("/dashboard");

  const [branches, users] = await Promise.all([
    db.branch.findMany({ orderBy: { name: "asc" } }),
    db.user.findMany({ include: { branch: true }, orderBy: { username: "asc" } }),
  ]);

  return (
    <div className="max-w-5xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Administration</h1>
        <p className="text-gray-500 text-sm mt-1">Manage branches, users, agents, and collectors.</p>
      </div>
      <AdminPanel
        branches={branches as any}
        users={users as any}
        agents={[]}
        collectors={[]}
      />
    </div>
  );
}
