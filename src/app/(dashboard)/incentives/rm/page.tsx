import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatCurrency, MONTHS, PRODUCTION_POINTS } from "@/lib/utils";
import { PlanCategory } from "@prisma/client";
import Link from "next/link";

export default async function RmIncentivesPage({
  searchParams,
}: {
  searchParams: { month?: string; year?: string };
}) {
  const session = await auth();
  const user = session!.user as any;

  if (user.role !== "ADMIN" && user.role !== "ACCOUNTING") {
    return <div className="p-8 text-center text-gray-400">Admin access required.</div>;
  }

  const now = new Date();
  const month = searchParams.month ? parseInt(searchParams.month) : now.getMonth() + 1;
  const year = searchParams.year ? parseInt(searchParams.year) : now.getFullYear();
  const periodLabel = `${MONTHS[month - 1]} ${year}`;

  // Get all RM employees
  const rmEmployees = await db.employee.findMany({
    where: { primaryPosition: "RM", isActive: true },
    select: { id: true, firstName: true, lastName: true, employeeNo: true },
    orderBy: { lastName: "asc" },
  });

  // Get all branches
  const branches = await db.branch.findMany({
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

  // For each branch, compute commissionable production points
  const branchResults: {
    branchId: string;
    branchName: string;
    production: number;
    commAccounts: number;
    rate: number;
    incentive: number;
  }[] = [];

  for (const branch of branches) {
    // Get all commissionable payments for this branch this month
    // Commissionable = installment 1-12, not free
    const payments = await db.payment.findMany({
      where: {
        member: { branchId: branch.id },
        periodMonth: month,
        periodYear: year,
        isFree: false,
        installmentNo: { gte: 1, lte: 12 },
      },
      select: {
        memberId: true,
        member: { select: { planCategory: true } },
      },
    });

    // Calculate production points
    let production = 0;
    let commAccounts = 0;
    for (const p of payments) {
      const pts = PRODUCTION_POINTS[p.member.planCategory as PlanCategory] ?? 0;
      production += pts;
      commAccounts++;
    }

    // RM rate: >= 300,000 = 3%, < 300,000 = 1.5%
    const rate = production >= 300000 ? 0.03 : 0.015;
    const incentive = production * rate;

    branchResults.push({
      branchId: branch.id,
      branchName: branch.name,
      production,
      commAccounts,
      rate,
      incentive,
    });
  }

  const totalProduction = branchResults.reduce((s, b) => s + b.production, 0);
  const totalIncentive = branchResults.reduce((s, b) => s + b.incentive, 0);
  const totalAccounts = branchResults.reduce((s, b) => s + b.commAccounts, 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">RM Incentives Report</h1>
          <p className="text-gray-500 text-sm mt-0.5">{periodLabel} — Regional Manager Compensation</p>
        </div>
        <Link href="/incentives" className="text-sm text-purple-600 hover:underline">
          Back to Branch Incentives
        </Link>
      </div>

      {/* Period Selector */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm flex flex-wrap gap-4 items-end">
        <form className="flex gap-3 items-end">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Month</label>
            <select name="month" defaultValue={month}
              className="border border-gray-300 rounded-lg px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500">
              {MONTHS.map((m, i) => <option key={i + 1} value={i + 1}>{m}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Year</label>
            <input type="number" name="year" defaultValue={year} min={2020} max={2099}
              className="w-24 border border-gray-300 rounded-lg px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500" />
          </div>
          <button type="submit"
            className="bg-purple-600 hover:bg-purple-700 text-white text-sm font-semibold px-5 py-2 rounded-lg">
            Generate
          </button>
        </form>
      </div>

      {/* RM Employees */}
      {rmEmployees.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
          <h2 className="font-semibold text-gray-800 mb-3">Regional Manager(s)</h2>
          <div className="flex flex-wrap gap-3">
            {rmEmployees.map((rm) => (
              <div key={rm.id} className="bg-purple-50 border border-purple-200 rounded-lg px-4 py-2">
                <p className="font-bold text-purple-900">{rm.firstName} {rm.lastName}</p>
                <p className="text-xs text-purple-600">{rm.employeeNo} — RM</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Branch Production Breakdown */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b">
          <h2 className="font-semibold text-gray-800">Branch Production Breakdown — {periodLabel}</h2>
          <p className="text-xs text-gray-400 mt-0.5">
            Commissionable accounts only (installments 1–12) | Rate: 3% if production &ge; 300,000 pts, 1.5% if below
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
              <tr>
                <th className="px-5 py-3 text-left">Branch</th>
                <th className="px-5 py-3 text-center">Comm Accounts</th>
                <th className="px-5 py-3 text-right">Production Points</th>
                <th className="px-5 py-3 text-center">Rate</th>
                <th className="px-5 py-3 text-right">RM Incentive</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {branchResults.map((b) => (
                <tr key={b.branchId} className="hover:bg-gray-50">
                  <td className="px-5 py-3 font-medium text-gray-800">{b.branchName}</td>
                  <td className="px-5 py-3 text-center text-gray-600">{b.commAccounts}</td>
                  <td className="px-5 py-3 text-right font-semibold text-gray-800">{b.production.toLocaleString()}</td>
                  <td className="px-5 py-3 text-center">
                    <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-bold ${
                      b.rate === 0.03 ? "bg-green-100 text-green-700" : "bg-yellow-100 text-yellow-700"
                    }`}>
                      {(b.rate * 100).toFixed(1)}%
                    </span>
                  </td>
                  <td className="px-5 py-3 text-right font-bold text-green-700">{formatCurrency(b.incentive)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-gray-50 font-bold">
              <tr>
                <td className="px-5 py-3 text-gray-900">TOTAL</td>
                <td className="px-5 py-3 text-center">{totalAccounts}</td>
                <td className="px-5 py-3 text-right text-gray-900">{totalProduction.toLocaleString()}</td>
                <td className="px-5 py-3"></td>
                <td className="px-5 py-3 text-right text-green-700 text-lg">{formatCurrency(totalIncentive)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* Summary Card */}
      <div className="bg-purple-50 border border-purple-200 rounded-xl p-6">
        <h2 className="text-lg font-semibold text-purple-900 mb-4">RM Compensation Summary — {periodLabel}</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          <div>
            <p className="text-xs text-purple-500 uppercase">Total Production</p>
            <p className="text-2xl font-bold text-purple-900">{totalProduction.toLocaleString()}</p>
            <p className="text-xs text-purple-500">points across {branches.length} branches</p>
          </div>
          <div>
            <p className="text-xs text-purple-500 uppercase">Comm Accounts Paid</p>
            <p className="text-2xl font-bold text-purple-900">{totalAccounts}</p>
            <p className="text-xs text-purple-500">installments 1–12</p>
          </div>
          <div>
            <p className="text-xs text-purple-500 uppercase">Total RM Incentive</p>
            <p className="text-2xl font-bold text-green-700">{formatCurrency(totalIncentive)}</p>
            <p className="text-xs text-purple-500">sum of all branches</p>
          </div>
          <div>
            <p className="text-xs text-purple-500 uppercase">RM(s)</p>
            <p className="text-2xl font-bold text-purple-900">{rmEmployees.length}</p>
            <p className="text-xs text-purple-500">
              {rmEmployees.map((r) => `${r.firstName} ${r.lastName}`).join(", ") || "None assigned"}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
