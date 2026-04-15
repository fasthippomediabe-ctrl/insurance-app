import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { formatCurrency, MONTHS } from "@/lib/utils";
import Link from "next/link";

export default async function ReportPage({
  searchParams,
}: {
  searchParams: { month?: string; year?: string; branchId?: string };
}) {
  const session = await auth();
  const user = session!.user as any;
  if (user.role !== "ADMIN" && user.role !== "ACCOUNTING" && user.role !== "HR") redirect("/dashboard");

  const now = new Date();
  const month = parseInt(searchParams.month ?? "") || now.getMonth() + 1;
  const year = parseInt(searchParams.year ?? "") || now.getFullYear();
  const branchId = searchParams.branchId || "";
  const start = new Date(year, month - 1, 1);
  const end = new Date(year, month, 1);

  const memberFilter = branchId ? { member: { branchId } } : {};
  const expenseBranchFilter = branchId ? { branchId } : {};

  // Income breakdown
  const [collections, payrollExpenses, claimsReleased, expenseByCategory, totalExpenses, branches] = await Promise.all([
    // Member payments
    db.payment.aggregate({
      where: { ...memberFilter, paymentDate: { gte: start, lt: end }, isFree: false },
      _sum: { amount: true },
      _count: true,
    }),
    // Payroll (payslips paid in this month)
    db.payslip.aggregate({
      where: { payDate: { gte: start, lt: end }, status: { in: ["APPROVED", "RELEASED"] } },
      _sum: { netPay: true, grossPay: true },
    }),
    // Claims released
    db.claim.aggregate({
      where: {
        status: "RELEASED",
        dateReleased: { gte: start, lt: end },
        ...(branchId ? { branchId } : {}),
      },
      _sum: { releasedAmount: true },
      _count: true,
    }),
    // Expenses by category
    db.expense.groupBy({
      by: ["categoryId"],
      where: { ...expenseBranchFilter, status: "POSTED", expenseDate: { gte: start, lt: end } },
      _sum: { amount: true },
    }),
    // Total expenses
    db.expense.aggregate({
      where: { ...expenseBranchFilter, status: "POSTED", expenseDate: { gte: start, lt: end } },
      _sum: { amount: true },
    }),
    db.branch.findMany({ orderBy: { name: "asc" } }),
  ]);

  // Get category names
  const categoryIds = expenseByCategory.map((e) => e.categoryId);
  const categories = await db.expenseCategory.findMany({ where: { id: { in: categoryIds } } });
  const catMap = new Map(categories.map((c) => [c.id, c.name]));

  const totalIncome = Number(collections._sum.amount ?? 0);
  const totalPayroll = Number(payrollExpenses._sum.grossPay ?? 0);
  const totalClaims = Number(claimsReleased._sum.releasedAmount ?? 0);
  const totalOpEx = Number(totalExpenses._sum.amount ?? 0);
  const grandTotalExpenses = totalOpEx + totalPayroll + totalClaims;
  const netIncome = totalIncome - grandTotalExpenses;
  const netMargin = totalIncome > 0 ? (netIncome / totalIncome) * 100 : 0;

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Profit &amp; Loss Report</h1>
          <p className="text-gray-500 text-sm mt-0.5">{MONTHS[month - 1]} {year}{branchId && ` · ${branches.find((b) => b.id === branchId)?.name}`}</p>
        </div>
        <Link href="/accounting" className="text-sm text-purple-600 hover:underline py-2">Back to Accounting</Link>
      </div>

      {/* Filter */}
      <form className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm flex flex-wrap gap-3 items-end">
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Month</label>
          <select name="month" defaultValue={month} className="border border-gray-300 rounded-lg px-2 py-2 text-sm">
            {MONTHS.map((m, i) => <option key={i + 1} value={i + 1}>{m}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Year</label>
          <input type="number" name="year" defaultValue={year} className="w-24 border border-gray-300 rounded-lg px-2 py-2 text-sm" />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Branch</label>
          <select name="branchId" defaultValue={branchId} className="border border-gray-300 rounded-lg px-2 py-2 text-sm">
            <option value="">All Branches</option>
            {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
        </div>
        <button type="submit" className="bg-purple-600 hover:bg-purple-700 text-white text-sm font-semibold px-4 py-2 rounded-lg">Generate</button>
      </form>

      {/* P&L Statement */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-6 py-5 border-b">
          <h2 className="text-xl font-bold text-gray-900">PROFIT &amp; LOSS STATEMENT</h2>
          <p className="text-sm text-gray-500">For the period of {MONTHS[month - 1]} {year}</p>
        </div>

        <div className="p-6 space-y-6">
          {/* INCOME */}
          <div>
            <h3 className="text-sm font-bold text-green-700 uppercase border-b border-green-200 pb-2 mb-3">Income</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-700">Member Collections ({collections._count} payments)</span>
                <span className="font-semibold">{formatCurrency(totalIncome)}</span>
              </div>
            </div>
            <div className="flex justify-between mt-3 pt-2 border-t font-bold text-green-700">
              <span>TOTAL INCOME</span>
              <span>{formatCurrency(totalIncome)}</span>
            </div>
          </div>

          {/* EXPENSES */}
          <div>
            <h3 className="text-sm font-bold text-red-700 uppercase border-b border-red-200 pb-2 mb-3">Expenses</h3>
            <div className="space-y-2 text-sm">
              {/* Operating expenses by category */}
              {expenseByCategory.map((e) => (
                <div key={e.categoryId} className="flex justify-between">
                  <span className="text-gray-700">{catMap.get(e.categoryId) ?? "Unknown"}</span>
                  <span className="font-semibold text-red-600">{formatCurrency(Number(e._sum.amount ?? 0))}</span>
                </div>
              ))}
              {/* Payroll */}
              {totalPayroll > 0 && (
                <div className="flex justify-between">
                  <span className="text-gray-700">Salaries &amp; Benefits (Payroll)</span>
                  <span className="font-semibold text-red-600">{formatCurrency(totalPayroll)}</span>
                </div>
              )}
              {/* Claims released */}
              {totalClaims > 0 && (
                <div className="flex justify-between">
                  <span className="text-gray-700">Claims Released ({claimsReleased._count})</span>
                  <span className="font-semibold text-red-600">{formatCurrency(totalClaims)}</span>
                </div>
              )}
              {expenseByCategory.length === 0 && totalPayroll === 0 && totalClaims === 0 && (
                <p className="text-gray-400 text-sm italic">No expenses recorded for this period.</p>
              )}
            </div>
            <div className="flex justify-between mt-3 pt-2 border-t font-bold text-red-700">
              <span>TOTAL EXPENSES</span>
              <span>{formatCurrency(grandTotalExpenses)}</span>
            </div>
          </div>

          {/* NET INCOME */}
          <div className={`rounded-xl p-5 ${netIncome >= 0 ? "bg-blue-50 border border-blue-200" : "bg-red-50 border border-red-200"}`}>
            <div className="flex justify-between items-center">
              <div>
                <p className={`text-sm font-bold uppercase ${netIncome >= 0 ? "text-blue-700" : "text-red-700"}`}>Net Income</p>
                <p className="text-xs text-gray-500 mt-0.5">Margin: {netMargin.toFixed(1)}%</p>
              </div>
              <p className={`text-2xl font-black ${netIncome >= 0 ? "text-blue-700" : "text-red-700"}`}>
                {formatCurrency(netIncome)}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
