import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import Link from "next/link";
import { formatCurrency } from "@/lib/utils";
import RecalcBalancesButton from "@/components/collectors/RecalcBalancesButton";

export default async function CollectorsPage({
  searchParams,
}: {
  searchParams: { collectorId?: string };
}) {
  const session = await auth();
  const user = session!.user as any;

  const now = new Date();
  const currentMonth = now.getMonth() + 1;
  const currentYear = now.getFullYear();

  const collectors = await db.employee.findMany({
    where: {
      isActive: true,
      primaryPosition: "AO",
      ...((user.role === "BRANCH_STAFF" || user.role === "COLLECTION_SUPERVISOR") ? { branchId: user.branchId } : {}),
    },
    include: {
      collectorMembers: {
        where: { status: { in: ["ACTIVE", "REINSTATED", "FULLY_PAID"] } },
        include: {
          payments: {
            orderBy: [{ periodYear: "desc" }, { periodMonth: "desc" }],
            take: 60,
          },
          agent: { select: { firstName: true, lastName: true } },
        },
      },
    },
    orderBy: { lastName: "asc" },
  });

  const selectedCollectorId = searchParams.collectorId ?? collectors[0]?.id ?? "";
  const selectedCollector = collectors.find((c) => c.id === selectedCollectorId) ?? collectors[0];

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Collector's List</h1>
          <p className="text-gray-500 text-sm mt-0.5">Members assigned per collector with payment status</p>
        </div>
        <div className="flex gap-2">
          {user.role === "ADMIN" && <RecalcBalancesButton />}
          <Link
            href={`/acr${selectedCollectorId ? `?collectorId=${selectedCollectorId}&month=${currentMonth}&year=${currentYear}` : ""}`}
            className="text-sm font-semibold px-4 py-2 rounded-lg border-2 border-blue-700 text-blue-700 hover:bg-blue-50"
          >
            Open ACR →
          </Link>
        </div>
      </div>

      <div className="flex gap-5">
        {/* Collector selector sidebar */}
        <div className="w-56 flex-shrink-0">
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <p className="text-xs font-semibold text-gray-500 uppercase px-4 py-3 border-b">Collectors</p>
            {collectors.map((c) => {
              const bal = Number(c.collectorBalance);
              return (
                <Link
                  key={c.id}
                  href={`/collectors?collectorId=${c.id}`}
                  className={`block px-4 py-3 text-sm border-b last:border-0 hover:bg-gray-50 transition-colors ${
                    c.id === selectedCollectorId ? "bg-blue-50 text-blue-700 font-medium" : "text-gray-700"
                  }`}
                >
                  <p>{c.firstName} {c.lastName}</p>
                  <p className="text-xs text-gray-400">{c.employeeNo} · {c.collectorMembers.length} members</p>
                  {bal !== 0 && (
                    <p className={`text-xs font-semibold mt-0.5 ${bal < 0 ? "text-red-600" : "text-blue-600"}`}>
                      {bal < 0 ? `−₱${Math.abs(bal).toLocaleString()} DEFICIT` : `+₱${bal.toLocaleString()} SURPLUS`}
                    </p>
                  )}
                </Link>
              );
            })}
            {collectors.length === 0 && (
              <p className="px-4 py-6 text-sm text-gray-400 text-center">No AO collectors found.</p>
            )}
          </div>
        </div>

        {/* Collectibles table */}
        {selectedCollector && (
          <div className="flex-1 min-w-0">
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
              {(() => {
                const bal = Number(selectedCollector.collectorBalance);
                if (bal === 0) return null;
                return (
                  <div className={`px-5 py-3 flex items-center gap-3 ${bal < 0 ? "bg-red-50 border-b border-red-100" : "bg-blue-50 border-b border-blue-100"}`}>
                    <span className={`text-lg font-bold ${bal < 0 ? "text-red-700" : "text-blue-700"}`}>
                      {bal < 0 ? `−₱${Math.abs(bal).toLocaleString("en-PH", { minimumFractionDigits: 2 })}` : `+₱${bal.toLocaleString("en-PH", { minimumFractionDigits: 2 })}`}
                    </span>
                    <span className={`text-sm font-semibold ${bal < 0 ? "text-red-600" : "text-blue-600"}`}>
                      {bal < 0 ? "DEFICIT — must cover in next remittance" : "SURPLUS — resets at end of month"}
                    </span>
                  </div>
                );
              })()}
              <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
                <div>
                  <h2 className="font-semibold text-gray-800">
                    {selectedCollector.firstName} {selectedCollector.lastName}
                  </h2>
                  <p className="text-xs text-gray-500">
                    {selectedCollector.collectorMembers.length} active members —{" "}
                    {now.toLocaleString("en-PH", { month: "long", year: "numeric" })} collection
                  </p>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
                    <tr>
                      <th className="px-4 py-3 text-left">#</th>
                      <th className="px-4 py-3 text-left">MAF No.</th>
                      <th className="px-4 py-3 text-left">Name</th>
                      <th className="px-4 py-3 text-left">Address</th>
                      <th className="px-4 py-3 text-left">Phone</th>
                      <th className="px-4 py-3 text-right">Monthly Due</th>
                      <th className="px-4 py-3 text-center">Installment</th>
                      <th className="px-4 py-3 text-right">Balance</th>
                      <th className="px-4 py-3 text-left">Agent</th>
                      <th className="px-4 py-3 text-center">This Month</th>
                      <th className="px-4 py-3 text-center">Aging</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {selectedCollector.collectorMembers.map((m, idx) => {
                      const totalPaid = m.payments.reduce((s, p) => s + Number(p.amount), 0);
                      const balance = Number(m.totalPlanAmount) - totalPaid;
                      const installmentsDone = m.payments.filter((p) => !p.isFree).length;
                      const thisMonthPaid = m.payments.some(
                        (p) => p.periodYear === currentYear && p.periodMonth === currentMonth
                      );

                      const paidSet = new Set(m.payments.map((p) => `${p.periodYear}-${p.periodMonth}`));
                      let aging = 0;
                      const cur = new Date(now);
                      cur.setDate(1);
                      cur.setMonth(cur.getMonth() - 1);
                      while (aging < 12) {
                        const key = `${cur.getFullYear()}-${cur.getMonth() + 1}`;
                        if (paidSet.has(key)) break;
                        if (m.effectivityDate && cur < m.effectivityDate) break;
                        aging++;
                        cur.setMonth(cur.getMonth() - 1);
                      }

                      return (
                        <tr key={m.id} className={`hover:bg-gray-50 ${aging >= 3 ? "bg-red-50" : ""}`}>
                          <td className="px-4 py-3 text-gray-400 text-xs">{idx + 1}</td>
                          <td className="px-4 py-3 font-mono text-xs text-gray-600">{m.mafNo}</td>
                          <td className="px-4 py-3">
                            <Link href={`/members/${m.id}`} className="font-medium text-gray-900 hover:text-blue-600">
                              {m.firstName} {m.lastName}
                            </Link>
                          </td>
                          <td className="px-4 py-3 text-gray-500 text-xs max-w-[160px] truncate">{m.address}</td>
                          <td className="px-4 py-3 text-gray-500 text-xs">{m.contactNumber ?? "—"}</td>
                          <td className="px-4 py-3 text-right font-medium">{formatCurrency(Number(m.monthlyDue))}</td>
                          <td className="px-4 py-3 text-center text-gray-500">#{installmentsDone}</td>
                          <td className="px-4 py-3 text-right text-red-600 font-medium">{formatCurrency(Math.max(0, balance))}</td>
                          <td className="px-4 py-3 text-gray-500 text-xs">
                            {m.agent ? `${m.agent.firstName} ${m.agent.lastName}` : "—"}
                          </td>
                          <td className="px-4 py-3 text-center">
                            {thisMonthPaid ? (
                              <span className="bg-green-100 text-green-700 text-xs px-2 py-0.5 rounded-full">Paid</span>
                            ) : (
                              <span className="bg-red-100 text-red-600 text-xs px-2 py-0.5 rounded-full">Unpaid</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-center">
                            {aging === 0 ? (
                              <span className="text-green-600 text-xs font-medium">Current</span>
                            ) : (
                              <span className={`text-xs font-medium ${aging >= 3 ? "text-red-600" : "text-yellow-600"}`}>
                                {aging * 30} days
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                    {selectedCollector.collectorMembers.length === 0 && (
                      <tr>
                        <td colSpan={11} className="px-4 py-10 text-center text-gray-400">
                          No active members assigned to this collector.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {selectedCollector.collectorMembers.length > 0 && (
                <div className="px-5 py-3 border-t bg-gray-50 text-sm flex flex-wrap gap-5 text-gray-600">
                  <span>
                    Total Monthly Due:{" "}
                    <strong>
                      {formatCurrency(
                        selectedCollector.collectorMembers.reduce((s, m) => s + Number(m.monthlyDue), 0)
                      )}
                    </strong>
                  </span>
                  <span>
                    Collected This Month:{" "}
                    <strong className="text-green-600">
                      {formatCurrency(
                        selectedCollector.collectorMembers.reduce((s, m) => {
                          const p = m.payments.find(
                            (p) => p.periodYear === currentYear && p.periodMonth === currentMonth
                          );
                          return s + (p ? Number(p.amount) : 0);
                        }, 0)
                      )}
                    </strong>
                  </span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
