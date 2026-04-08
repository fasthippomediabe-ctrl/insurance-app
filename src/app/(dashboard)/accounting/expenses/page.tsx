import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { formatCurrency, MONTHS } from "@/lib/utils";
import Link from "next/link";

export default async function ExpensesPage({
  searchParams,
}: {
  searchParams: { month?: string; year?: string };
}) {
  const session = await auth();
  const user = session!.user as any;
  if (user.role !== "ADMIN" && user.role !== "ACCOUNTING") redirect("/dashboard");

  const now = new Date();
  const month = parseInt(searchParams.month ?? "") || now.getMonth() + 1;
  const year = parseInt(searchParams.year ?? "") || now.getFullYear();
  const start = new Date(year, month - 1, 1);
  const end = new Date(year, month, 1);

  const expenses = await db.expense.findMany({
    where: { status: "POSTED", expenseDate: { gte: start, lt: end } },
    include: { category: true },
    orderBy: { expenseDate: "desc" },
  });

  const branches = await db.branch.findMany({ select: { id: true, name: true } });
  const branchMap = new Map(branches.map((b) => [b.id, b.name]));

  const total = expenses.reduce((s, e) => s + Number(e.amount), 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Expenses</h1>
          <p className="text-gray-500 text-sm mt-0.5">{MONTHS[month - 1]} {year} · {expenses.length} entries · Total: {formatCurrency(total)}</p>
        </div>
        <div className="flex gap-2">
          <Link href="/accounting" className="text-sm text-purple-600 hover:underline py-2">Back</Link>
          <Link href="/accounting/expenses/new"
            className="bg-red-600 hover:bg-red-700 text-white text-sm font-semibold px-4 py-2 rounded-lg">
            + Record Expense
          </Link>
        </div>
      </div>

      {/* Period selector */}
      <form className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm flex gap-3 items-end">
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
        <button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-4 py-2 rounded-lg">View</button>
      </form>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
              <tr>
                <th className="px-4 py-2.5 text-left">Date</th>
                <th className="px-4 py-2.5 text-left">Expense No</th>
                <th className="px-4 py-2.5 text-left">Category</th>
                <th className="px-4 py-2.5 text-left">Branch</th>
                <th className="px-4 py-2.5 text-left">Description</th>
                <th className="px-4 py-2.5 text-left">Vendor</th>
                <th className="px-4 py-2.5 text-right">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {expenses.map((e) => (
                <tr key={e.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-gray-500 text-xs">{new Date(e.expenseDate).toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" })}</td>
                  <td className="px-4 py-3 font-mono text-xs text-gray-600">{e.expenseNo}</td>
                  <td className="px-4 py-3"><span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 font-bold">{e.category.name}</span></td>
                  <td className="px-4 py-3 text-gray-500 text-xs">{e.branchId ? branchMap.get(e.branchId) ?? "—" : "Head Office"}</td>
                  <td className="px-4 py-3 text-gray-700">{e.description}</td>
                  <td className="px-4 py-3 text-gray-500 text-xs">{e.vendor ?? "—"}</td>
                  <td className="px-4 py-3 text-right font-semibold text-red-600">{formatCurrency(Number(e.amount))}</td>
                </tr>
              ))}
              {expenses.length === 0 && (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-400">No expenses for this period.</td></tr>
              )}
            </tbody>
            {expenses.length > 0 && (
              <tfoot className="bg-gray-50 font-bold">
                <tr>
                  <td colSpan={6} className="px-4 py-3 text-right">TOTAL</td>
                  <td className="px-4 py-3 text-right text-red-600">{formatCurrency(total)}</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </div>
  );
}
