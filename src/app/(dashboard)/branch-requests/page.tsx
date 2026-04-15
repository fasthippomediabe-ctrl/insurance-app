import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatCurrency } from "@/lib/utils";
import Link from "next/link";
import BranchRequestsTable from "@/components/branch-requests/BranchRequestsTable";

export default async function BranchRequestsPage() {
  const session = await auth();
  const user = session!.user as any;

  const where: any = {};
  if (user.role === "BRANCH_STAFF") where.branchId = user.branchId;

  const [requests, branches] = await Promise.all([
    db.branchRequest.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 200,
    }),
    db.branch.findMany({ select: { id: true, name: true } }),
  ]);

  const branchMap = new Map(branches.map((b) => [b.id, b.name]));

  const pendingCount = requests.filter((r) => r.status === "PENDING").length;
  const approvedCount = requests.filter((r) => r.status === "APPROVED").length;
  const releasedCount = requests.filter((r) => r.status === "RELEASED").length;
  const totalPending = requests.filter((r) => r.status === "PENDING").reduce((s, r) => s + Number(r.amount), 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Branch Requests</h1>
          <p className="text-gray-500 text-sm mt-0.5">
            {user.role === "BRANCH_STAFF" ? "Your branch requests" : "All branch requests"} · {requests.length} total
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/branch-requests/new"
            className="bg-purple-600 hover:bg-purple-700 text-white text-sm font-semibold px-4 py-2 rounded-lg">
            + New Request
          </Link>
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Pending" value={pendingCount.toString()} color="yellow" />
        <StatCard label="Approved" value={approvedCount.toString()} color="blue" />
        <StatCard label="Released" value={releasedCount.toString()} color="green" />
        <StatCard label="Total Pending" value={formatCurrency(totalPending)} color="amber" />
      </div>

      <BranchRequestsTable
        requests={requests.map((r) => ({
          id: r.id,
          requestNo: r.requestNo,
          type: r.type,
          branchName: branchMap.get(r.branchId) ?? "",
          title: r.title,
          description: r.description,
          amount: Number(r.amount),
          dueDate: r.dueDate?.toISOString() ?? null,
          vendor: r.vendor,
          attachments: r.attachments,
          status: r.status,
          reviewNote: r.reviewNote,
          createdAt: r.createdAt.toISOString(),
          reviewedAt: r.reviewedAt?.toISOString() ?? null,
          releasedAt: r.releasedAt?.toISOString() ?? null,
        }))}
        role={user.role}
        currentUserId={user.id}
      />
    </div>
  );
}

function StatCard({ label, value, color }: { label: string; value: string; color: string }) {
  const colors: Record<string, string> = {
    yellow: "border-l-yellow-500", blue: "border-l-blue-500",
    green: "border-l-green-500", amber: "border-l-amber-500",
  };
  return (
    <div className={`bg-white rounded-xl border border-gray-200 border-l-4 ${colors[color]} p-4 shadow-sm`}>
      <p className="text-xs text-gray-400 uppercase font-medium">{label}</p>
      <p className="text-2xl font-bold text-gray-900 mt-1">{value}</p>
    </div>
  );
}
