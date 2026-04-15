import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatCurrency } from "@/lib/utils";
import Link from "next/link";

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  STUB_ISSUED: { label: "Stub Issued", color: "bg-gray-100 text-gray-700" },
  DOCS_RECEIVED_BRANCH: { label: "Docs at Branch", color: "bg-blue-100 text-blue-700" },
  DOCS_IN_TRANSIT: { label: "Docs in Transit", color: "bg-indigo-100 text-indigo-700" },
  DOCS_RECEIVED_HO: { label: "Received at HO", color: "bg-purple-100 text-purple-700" },
  UNDER_REVIEW: { label: "Under Review", color: "bg-yellow-100 text-yellow-700" },
  ADDITIONAL_DOCS_NEEDED: { label: "Need More Docs", color: "bg-orange-100 text-orange-700" },
  IN_PROGRESS: { label: "Processing", color: "bg-blue-100 text-blue-700" },
  APPROVED: { label: "Approved", color: "bg-green-100 text-green-700" },
  CHEQUE_PREPARING: { label: "Preparing Cheque", color: "bg-cyan-100 text-cyan-700" },
  CHEQUE_IN_TRANSIT: { label: "Cheque in Transit", color: "bg-indigo-100 text-indigo-700" },
  CHEQUE_RECEIVED_BRANCH: { label: "Cheque at Branch", color: "bg-purple-100 text-purple-700" },
  RELEASED: { label: "Released", color: "bg-emerald-100 text-emerald-800" },
  REJECTED: { label: "Rejected", color: "bg-red-100 text-red-700" },
};

export default async function ClaimsPage() {
  const session = await auth();
  const user = session!.user as any;

  const where: any = {};
  if ((user.role === "BRANCH_STAFF" || user.role === "COLLECTION_SUPERVISOR")) where.branchId = user.branchId;

  const claims = await db.claim.findMany({
    where,
    include: {
      member: { select: { mafNo: true, firstName: true, lastName: true, planCategory: true, branch: { select: { name: true } } } },
      _count: { select: { documents: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Claims</h1>
          <p className="text-gray-500 text-sm mt-0.5">{claims.length} total claims</p>
        </div>
        <Link href="/claims/new"
          className="bg-red-600 hover:bg-red-700 text-white text-sm font-semibold px-4 py-2 rounded-lg">
          + New Claim
        </Link>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
              <tr>
                <th className="px-4 py-2.5 text-left">Claim No.</th>
                <th className="px-4 py-2.5 text-left">Member</th>
                <th className="px-4 py-2.5 text-left">Deceased</th>
                <th className="px-4 py-2.5 text-left">Claimant</th>
                <th className="px-4 py-2.5 text-center">Plan</th>
                <th className="px-4 py-2.5 text-right">Amount</th>
                <th className="px-4 py-2.5 text-center">Docs</th>
                <th className="px-4 py-2.5 text-center">Status</th>
                <th className="px-4 py-2.5 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {claims.map((c) => {
                const st = STATUS_LABELS[c.status] ?? { label: c.status, color: "bg-gray-100 text-gray-700" };
                return (
                  <tr key={c.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-mono text-xs text-gray-600">{c.claimNo}</td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-800">{c.member.firstName} {c.member.lastName}</div>
                      <div className="text-xs text-gray-400">{c.member.mafNo} · {c.member.branch?.name}</div>
                    </td>
                    <td className="px-4 py-3 text-gray-700">{c.deceasedName}</td>
                    <td className="px-4 py-3 text-gray-700">{c.claimantName}</td>
                    <td className="px-4 py-3 text-center text-xs font-bold">{c.planCategory}</td>
                    <td className="px-4 py-3 text-right font-semibold text-green-700">
                      {c.releasedAmount ? formatCurrency(Number(c.releasedAmount)) :
                       c.approvedAmount ? formatCurrency(Number(c.approvedAmount)) : "—"}
                    </td>
                    <td className="px-4 py-3 text-center text-gray-500">{c._count.documents}</td>
                    <td className="px-4 py-3 text-center">
                      <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-bold ${st.color}`}>{st.label}</span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <Link href={`/claims/${c.id}`} className="text-purple-600 hover:underline text-xs font-medium">View</Link>
                    </td>
                  </tr>
                );
              })}
              {claims.length === 0 && (
                <tr><td colSpan={9} className="px-4 py-8 text-center text-gray-400">No claims yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
