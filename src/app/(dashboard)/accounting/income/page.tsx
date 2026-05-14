import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { formatCurrency, MONTHS } from "@/lib/utils";
import Link from "next/link";
import IncomeTable from "@/components/accounting/IncomeTable";

export default async function IncomePage({
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

  const [incomes, branches, categories] = await Promise.all([
    db.income.findMany({
      where: { status: "POSTED", incomeDate: { gte: start, lt: end } },
      include: { category: true },
      orderBy: { incomeDate: "desc" },
    }),
    db.branch.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
    db.incomeCategory.findMany({ where: { isActive: true }, orderBy: { name: "asc" } }),
  ]);

  const total = incomes.reduce((s, e) => s + Number(e.amount), 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Income</h1>
          <p className="text-gray-500 text-sm mt-0.5">{MONTHS[month - 1]} {year} · {incomes.length} entries · Total: {formatCurrency(total)}</p>
        </div>
        <div className="flex gap-2">
          <Link href="/accounting" className="text-sm text-purple-600 hover:underline py-2">Back</Link>
          <Link href="/accounting/income/new"
            className="bg-green-600 hover:bg-green-700 text-white text-sm font-semibold px-4 py-2 rounded-lg">
            + Record Income
          </Link>
        </div>
      </div>

      {categories.length === 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-5 py-4 flex items-center justify-between">
          <div>
            <p className="text-sm font-bold text-amber-800">No income categories yet</p>
            <p className="text-xs text-amber-600">Click to create defaults (Starting Capital, Processing Fee, Passbook Fee, etc.)</p>
          </div>
          <form action="/api/accounting/income-seed" method="POST">
            <button className="bg-amber-600 hover:bg-amber-700 text-white text-sm font-semibold px-4 py-2 rounded-lg">
              Create Default Categories
            </button>
          </form>
        </div>
      )}

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

      <IncomeTable
        incomes={incomes.map((e) => ({
          id: e.id,
          incomeNo: e.incomeNo,
          categoryId: e.categoryId,
          categoryName: e.category.name,
          categoryType: e.category.type,
          branchId: e.branchId,
          amount: Number(e.amount),
          incomeDate: e.incomeDate.toISOString(),
          description: e.description,
          payer: e.payer,
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
