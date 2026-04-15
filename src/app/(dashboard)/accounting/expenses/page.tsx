import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { formatCurrency, MONTHS } from "@/lib/utils";
import Link from "next/link";
import ExpensesTable from "@/components/accounting/ExpensesTable";

export default async function ExpensesPage({
  searchParams,
}: {
  searchParams: { month?: string; year?: string };
}) {
  const session = await auth();
  const user = session!.user as any;
  if (user.role !== "ADMIN" && user.role !== "ACCOUNTING" && user.role !== "HR") redirect("/dashboard");

  const now = new Date();
  const month = parseInt(searchParams.month ?? "") || now.getMonth() + 1;
  const year = parseInt(searchParams.year ?? "") || now.getFullYear();
  const start = new Date(year, month - 1, 1);
  const end = new Date(year, month, 1);

  const [expenses, branches, categories] = await Promise.all([
    db.expense.findMany({
      where: { status: "POSTED", expenseDate: { gte: start, lt: end } },
      include: { category: true },
      orderBy: { expenseDate: "desc" },
    }),
    db.branch.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
    db.expenseCategory.findMany({ where: { isActive: true }, orderBy: { name: "asc" } }),
  ]);

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

      <ExpensesTable
        expenses={expenses.map((e) => ({
          id: e.id,
          expenseNo: e.expenseNo,
          categoryId: e.categoryId,
          categoryName: e.category.name,
          branchId: e.branchId,
          amount: Number(e.amount),
          expenseDate: e.expenseDate.toISOString(),
          description: e.description,
          vendor: e.vendor,
          paymentMethod: e.paymentMethod,
          receiptNo: e.receiptNo,
          receiptPhoto: e.receiptPhoto,
          notes: e.notes,
        }))}
        branches={branches}
        categories={categories.map((c) => ({ id: c.id, name: c.name }))}
        total={total}
      />
    </div>
  );
}
