import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import Link from "next/link";
import { formatCurrency, formatDate, MONTHS } from "@/lib/utils";

export default async function RemittancePage() {
  const session = await auth();
  const user = session!.user as any;

  const remittances = await db.remittance.findMany({
    where: (user.role === "BRANCH_STAFF" || user.role === "COLLECTION_SUPERVISOR") ? { branchId: user.branchId } : {},
    include: {
      collector: { select: { firstName: true, lastName: true, employeeNo: true } },
      branch: { select: { name: true } },
      _count: { select: { payments: true } },
    },
    orderBy: { remittanceDate: "desc" },
    take: 100,
  });

  const isAdmin = user.role === "ADMIN";

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Remittance</h1>
          <p className="text-gray-500 text-sm mt-0.5">{remittances.length} records</p>
        </div>
        <Link
          href="/remittance/new"
          className="bg-purple-600 hover:bg-purple-700 text-white text-sm font-semibold px-4 py-2 rounded-lg"
        >
          + New Remittance
        </Link>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
              <tr>
                <th className="px-4 py-3 text-left">Remittance No.</th>
                <th className="px-4 py-3 text-left">Date</th>
                <th className="px-4 py-3 text-left">Period</th>
                <th className="px-4 py-3 text-left">Collector</th>
                {isAdmin && <th className="px-4 py-3 text-left">Branch</th>}
                <th className="px-4 py-3 text-center">Entries</th>
                <th className="px-4 py-3 text-right">Gross</th>
                <th className="px-4 py-3 text-right">BC</th>
                <th className="px-4 py-3 text-right">TA</th>
                <th className="px-4 py-3 text-right font-semibold">Net</th>
                <th className="px-4 py-3 w-24"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {remittances.map((r) => (
                <tr key={r.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-mono text-gray-600 font-medium text-xs">
                    <Link href={`/remittance/${r.id}`} className="hover:text-purple-600">{r.remittanceNo}</Link>
                  </td>
                  <td className="px-4 py-3 text-gray-600">{formatDate(r.remittanceDate)}</td>
                  <td className="px-4 py-3 text-gray-500 text-xs">
                    {MONTHS[r.periodMonth - 1]} {r.periodYear}
                  </td>
                  <td className="px-4 py-3 text-gray-700">
                    {r.collector.firstName} {r.collector.lastName}
                    <span className="ml-1 text-xs text-gray-400">({r.collector.employeeNo})</span>
                  </td>
                  {isAdmin && <td className="px-4 py-3 text-gray-500 text-xs">{r.branch.name}</td>}
                  <td className="px-4 py-3 text-center text-gray-500">{r._count.payments}</td>
                  <td className="px-4 py-3 text-right font-medium">{formatCurrency(Number(r.totalCollection))}</td>
                  <td className="px-4 py-3 text-right text-orange-600 text-xs">{formatCurrency(Number(r.totalCommission))}</td>
                  <td className="px-4 py-3 text-right text-blue-600 text-xs">{formatCurrency(Number(r.travellingAllowance))}</td>
                  <td className="px-4 py-3 text-right font-bold text-green-700">{formatCurrency(Number(r.netRemittance))}</td>
                  <td className="px-4 py-3 text-center">
                    <Link href={`/remittance/${r.id}`}
                      className="text-xs text-purple-600 hover:text-purple-800 font-medium px-2 py-1 rounded hover:bg-purple-50">
                      View / Print
                    </Link>
                  </td>
                </tr>
              ))}
              {remittances.length === 0 && (
                <tr>
                  <td colSpan={isAdmin ? 11 : 10} className="px-4 py-10 text-center text-gray-400">
                    No remittances yet.
                  </td>
                </tr>
              )}
            </tbody>
            {remittances.length > 0 && (
              <tfoot className="bg-gray-50 font-semibold text-sm border-t-2 border-gray-200">
                <tr>
                  <td colSpan={isAdmin ? 6 : 5} className="px-4 py-3 text-gray-500">TOTALS</td>
                  <td className="px-4 py-3 text-right">{formatCurrency(remittances.reduce((s, r) => s + Number(r.totalCollection), 0))}</td>
                  <td className="px-4 py-3 text-right text-orange-600">{formatCurrency(remittances.reduce((s, r) => s + Number(r.totalCommission), 0))}</td>
                  <td className="px-4 py-3 text-right text-blue-600">{formatCurrency(remittances.reduce((s, r) => s + Number(r.travellingAllowance), 0))}</td>
                  <td className="px-4 py-3 text-right text-green-700">{formatCurrency(remittances.reduce((s, r) => s + Number(r.netRemittance), 0))}</td>
                  <td></td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </div>
  );
}
