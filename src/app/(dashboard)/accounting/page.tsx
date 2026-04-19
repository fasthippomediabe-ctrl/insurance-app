import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { formatCurrency, MONTHS } from "@/lib/utils";
import Link from "next/link";

export default async function AccountingPage() {
  const session = await auth();
  const user = session!.user as any;
  if (user.role !== "ADMIN" && user.role !== "ACCOUNTING" && user.role !== "HR") redirect("/dashboard");

  const now = new Date();
  const month = now.getMonth() + 1;
  const year = now.getFullYear();
  const start = new Date(year, month - 1, 1);
  const end = new Date(year, month, 1);

  const [
    incomeAgg,
    expenseAgg,
    expenseCount,
    categoryCount,
    branches,
    recentExpenses,
  ] = await Promise.all([
    db.payment.aggregate({
      where: { paymentDate: { gte: start, lt: end }, isFree: false },
      _sum: { amount: true },
    }),
    db.expense.aggregate({
      where: { expenseDate: { gte: start, lt: end }, status: "POSTED" },
      _sum: { amount: true },
    }),
    db.expense.count({ where: { status: "POSTED" } }),
    db.expenseCategory.count({ where: { isActive: true } }),
    db.branch.findMany({ orderBy: { name: "asc" } }),
    db.expense.findMany({
      where: { status: "POSTED" },
      include: { category: true },
      orderBy: { createdAt: "desc" },
      take: 10,
    }),
  ]);

  const income = Number(incomeAgg._sum.amount ?? 0);
  const expenses = Number(expenseAgg._sum.amount ?? 0);
  const netIncome = income - expenses;
  const periodLabel = `${MONTHS[month - 1]} ${year}`;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Accounting</h1>
          <p className="text-gray-500 text-sm mt-0.5">Income, expenses, and financial reports</p>
        </div>
        <div className="flex gap-2">
          <Link href="/accounting/expenses/new"
            className="bg-red-600 hover:bg-red-700 text-white text-sm font-semibold px-4 py-2 rounded-lg">
            + Record Expense
          </Link>
          <Link href="/accounting/expenses"
            className="bg-gray-800 hover:bg-gray-900 text-white text-sm font-semibold px-4 py-2 rounded-lg">
            View Expenses
          </Link>
          <Link href="/accounting/borrowings"
            className="bg-amber-600 hover:bg-amber-700 text-white text-sm font-semibold px-4 py-2 rounded-lg">
            Borrowings
          </Link>
          <Link href="/accounting/liabilities"
            className="bg-red-600 hover:bg-red-700 text-white text-sm font-semibold px-4 py-2 rounded-lg">
            Liabilities
          </Link>
          <Link href="/accounting/report"
            className="bg-purple-600 hover:bg-purple-700 text-white text-sm font-semibold px-4 py-2 rounded-lg">
            P&amp;L Report
          </Link>
        </div>
      </div>

      {categoryCount === 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-5 py-4 flex items-center justify-between">
          <div>
            <p className="text-sm font-bold text-amber-800">No expense categories yet</p>
            <p className="text-xs text-amber-600">Click the button to create the default categories (Rent, Utilities, Supplies, etc.)</p>
          </div>
          <form action="/api/accounting/seed" method="POST">
            <button className="bg-amber-600 hover:bg-amber-700 text-white text-sm font-semibold px-4 py-2 rounded-lg">
              Create Default Categories
            </button>
          </form>
        </div>
      )}

      {/* This Month Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard label={`Income — ${periodLabel}`} value={formatCurrency(income)} color="green" />
        <StatCard label={`Expenses — ${periodLabel}`} value={formatCurrency(expenses)} color="red" />
        <StatCard label={`Net Income — ${periodLabel}`} value={formatCurrency(netIncome)} color={netIncome >= 0 ? "blue" : "amber"} />
      </div>

      {/* Recent Expenses */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b flex items-center justify-between">
          <div>
            <h2 className="font-semibold text-gray-800">Recent Expenses</h2>
            <p className="text-xs text-gray-400">{expenseCount} total expenses recorded</p>
          </div>
          <Link href="/accounting/expenses" className="text-sm text-purple-600 hover:underline">View all</Link>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
              <tr>
                <th className="px-4 py-2.5 text-left">Date</th>
                <th className="px-4 py-2.5 text-left">Expense No</th>
                <th className="px-4 py-2.5 text-left">Category</th>
                <th className="px-4 py-2.5 text-left">Description</th>
                <th className="px-4 py-2.5 text-right">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {recentExpenses.map((e) => (
                <tr key={e.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-gray-500 text-xs">{new Date(e.expenseDate).toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" })}</td>
                  <td className="px-4 py-3 font-mono text-xs text-gray-600">{e.expenseNo}</td>
                  <td className="px-4 py-3"><span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 font-bold">{e.category.name}</span></td>
                  <td className="px-4 py-3 text-gray-700">{e.description}</td>
                  <td className="px-4 py-3 text-right font-semibold text-red-600">{formatCurrency(Number(e.amount))}</td>
                </tr>
              ))}
              {recentExpenses.length === 0 && (
                <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-400">No expenses recorded yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, color }: { label: string; value: string; color: string }) {
  const colors: Record<string, string> = {
    green: "border-l-green-500",
    red: "border-l-red-500",
    blue: "border-l-blue-500",
    amber: "border-l-amber-500",
  };
  return (
    <div className={`bg-white rounded-xl border border-gray-200 border-l-4 ${colors[color]} p-5 shadow-sm`}>
      <p className="text-xs text-gray-400 uppercase font-medium">{label}</p>
      <p className="text-2xl font-bold text-gray-900 mt-1">{value}</p>
    </div>
  );
}
