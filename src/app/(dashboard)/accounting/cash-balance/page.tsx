import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { formatCurrency } from "@/lib/utils";
import Link from "next/link";

type Direction = "IN" | "OUT";
type Txn = {
  date: Date;
  type: string;
  reference: string;
  description: string;
  amount: number;
  direction: Direction;
};

export default async function CashBalancePage({
  searchParams,
}: {
  searchParams: { from?: string; to?: string; branchId?: string };
}) {
  const session = await auth();
  const user = session!.user as any;
  if (user.role !== "ADMIN" && user.role !== "ACCOUNTING" && user.role !== "HR") redirect("/dashboard");

  const now = new Date();
  const defaultFrom = new Date(now.getFullYear(), now.getMonth(), 1);
  const defaultTo = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

  const from = searchParams.from ? new Date(searchParams.from) : defaultFrom;
  const to = searchParams.to ? new Date(`${searchParams.to}T23:59:59`) : defaultTo;
  const branchId = searchParams.branchId || "";

  const fromInput = from.toISOString().split("T")[0];
  const toInput = to.toISOString().split("T")[0];

  // Branch filter (only applies to records that carry branchId)
  const branchExpenseFilter = branchId ? { branchId } : {};
  const branchIncomeFilter = branchId ? { branchId } : {};
  const branchClaimFilter = branchId ? { branchId } : {};
  const branchPaymentFilter = branchId ? { member: { branchId } } : {};
  const branchBorrowingFilter = branchId ? { branchId } : {};

  // Period window
  const periodWhere = { gte: from, lte: to };

  const [
    incomeInPeriodByCat,
    paymentsInPeriod,
    borrowingsInPeriod,
    claimsInPeriod,
    payslipsInPeriod,
    expensesInPeriod,
    repaymentsInPeriod,
    // All-time totals (for current cash on hand)
    allIncomeAgg,
    allPaymentsAgg,
    allBorrowingsAgg,
    allClaimsAgg,
    allPayslipsAgg,
    allExpensesAgg,
    allRepaymentsAgg,
    branches,
    incomeCategories,
  ] = await Promise.all([
    db.income.groupBy({
      by: ["categoryId"],
      where: { ...branchIncomeFilter, status: "POSTED", incomeDate: periodWhere },
      _sum: { amount: true },
      _count: true,
    }),
    db.payment.findMany({
      where: { ...branchPaymentFilter, paymentDate: periodWhere, isFree: false },
      select: { id: true, paymentDate: true, amount: true, orNo: true, member: { select: { firstName: true, lastName: true, mafNo: true } } },
      orderBy: { paymentDate: "asc" },
    }),
    db.borrowing.findMany({
      where: { ...branchBorrowingFilter, borrowedDate: periodWhere },
      include: { source: true },
      orderBy: { borrowedDate: "asc" },
    }),
    db.claim.findMany({
      where: { ...branchClaimFilter, status: "RELEASED", dateReleased: periodWhere },
      select: { id: true, claimNo: true, dateReleased: true, releasedAmount: true, claimantName: true },
      orderBy: { dateReleased: "asc" },
    }),
    db.payslip.findMany({
      where: { payDate: periodWhere, status: { in: ["APPROVED", "RELEASED"] } },
      include: { employee: { select: { firstName: true, lastName: true } } },
      orderBy: { payDate: "asc" },
    }),
    db.expense.findMany({
      where: { ...branchExpenseFilter, status: "POSTED", expenseDate: periodWhere },
      include: { category: true },
      orderBy: { expenseDate: "asc" },
    }),
    db.borrowingRepayment.findMany({
      where: { payDate: periodWhere },
      include: { borrowing: { include: { source: true } } },
      orderBy: { payDate: "asc" },
    }),
    db.income.aggregate({ where: { ...branchIncomeFilter, status: "POSTED" }, _sum: { amount: true } }),
    db.payment.aggregate({ where: { ...branchPaymentFilter, isFree: false }, _sum: { amount: true } }),
    db.borrowing.aggregate({ where: { ...branchBorrowingFilter }, _sum: { amount: true } }),
    db.claim.aggregate({ where: { ...branchClaimFilter, status: "RELEASED" }, _sum: { releasedAmount: true } }),
    db.payslip.aggregate({ where: { status: { in: ["APPROVED", "RELEASED"] } }, _sum: { netPay: true } }),
    db.expense.aggregate({ where: { ...branchExpenseFilter, status: "POSTED" }, _sum: { amount: true } }),
    db.borrowingRepayment.aggregate({ _sum: { amount: true } }),
    db.branch.findMany({ orderBy: { name: "asc" } }),
    db.incomeCategory.findMany(),
  ]);

  const incomeCatMap = new Map(incomeCategories.map((c) => [c.id, c]));

  // ── PERIOD breakdown ────────────────────────
  const periodCashIn: Array<{ label: string; amount: number; count: number }> = [];
  let totalCashInPeriod = 0;

  // Member collections (one big line)
  const collectionsTotalPeriod = paymentsInPeriod.reduce((s, p) => s + Number(p.amount), 0);
  if (collectionsTotalPeriod > 0) {
    periodCashIn.push({ label: "Member Collections", amount: collectionsTotalPeriod, count: paymentsInPeriod.length });
    totalCashInPeriod += collectionsTotalPeriod;
  }

  // Income by category
  for (const row of incomeInPeriodByCat) {
    const cat = incomeCatMap.get(row.categoryId);
    const amt = Number(row._sum.amount ?? 0);
    if (amt > 0) {
      periodCashIn.push({ label: cat?.name ?? "Income", amount: amt, count: row._count ?? 0 });
      totalCashInPeriod += amt;
    }
  }

  // Borrowings (grouped by source)
  const borrowedBySource = new Map<string, { amount: number; count: number }>();
  for (const b of borrowingsInPeriod) {
    const key = `Borrowed from ${b.source.name}`;
    const cur = borrowedBySource.get(key) ?? { amount: 0, count: 0 };
    cur.amount += Number(b.amount);
    cur.count += 1;
    borrowedBySource.set(key, cur);
  }
  for (const [label, info] of borrowedBySource.entries()) {
    periodCashIn.push({ label, amount: info.amount, count: info.count });
    totalCashInPeriod += info.amount;
  }

  const periodCashOut: Array<{ label: string; amount: number; count: number }> = [];
  let totalCashOutPeriod = 0;

  // Claims released
  const claimsTotalPeriod = claimsInPeriod.reduce((s, c) => s + Number(c.releasedAmount ?? 0), 0);
  if (claimsTotalPeriod > 0) {
    periodCashOut.push({ label: "Claims Released", amount: claimsTotalPeriod, count: claimsInPeriod.length });
    totalCashOutPeriod += claimsTotalPeriod;
  }

  // Payroll (net pay)
  const payrollTotalPeriod = payslipsInPeriod.reduce((s, p) => s + Number(p.netPay), 0);
  if (payrollTotalPeriod > 0) {
    periodCashOut.push({ label: "Payroll (Net Pay)", amount: payrollTotalPeriod, count: payslipsInPeriod.length });
    totalCashOutPeriod += payrollTotalPeriod;
  }

  // Expenses grouped by category
  const expenseByCategory = new Map<string, { amount: number; count: number }>();
  for (const e of expensesInPeriod) {
    const key = e.category.name;
    const cur = expenseByCategory.get(key) ?? { amount: 0, count: 0 };
    cur.amount += Number(e.amount);
    cur.count += 1;
    expenseByCategory.set(key, cur);
  }
  for (const [label, info] of expenseByCategory.entries()) {
    periodCashOut.push({ label, amount: info.amount, count: info.count });
    totalCashOutPeriod += info.amount;
  }

  // Loan repayments grouped by source
  const repaidBySource = new Map<string, { amount: number; count: number }>();
  for (const r of repaymentsInPeriod) {
    const key = `Repaid to ${r.borrowing.source.name}`;
    const cur = repaidBySource.get(key) ?? { amount: 0, count: 0 };
    cur.amount += Number(r.amount);
    cur.count += 1;
    repaidBySource.set(key, cur);
  }
  for (const [label, info] of repaidBySource.entries()) {
    periodCashOut.push({ label, amount: info.amount, count: info.count });
    totalCashOutPeriod += info.amount;
  }

  const netForPeriod = totalCashInPeriod - totalCashOutPeriod;

  // ── ALL-TIME cash on hand ───────────────────
  const allInTotal =
    Number(allIncomeAgg._sum.amount ?? 0) +
    Number(allPaymentsAgg._sum.amount ?? 0) +
    Number(allBorrowingsAgg._sum.amount ?? 0);
  const allOutTotal =
    Number(allClaimsAgg._sum.releasedAmount ?? 0) +
    Number(allPayslipsAgg._sum.netPay ?? 0) +
    Number(allExpensesAgg._sum.amount ?? 0) +
    Number(allRepaymentsAgg._sum.amount ?? 0);
  const currentCashOnHand = allInTotal - allOutTotal;

  // ── TRANSACTION LEDGER (running balance, within period) ───
  const txns: Txn[] = [];

  for (const p of paymentsInPeriod) {
    txns.push({
      date: p.paymentDate,
      type: "Collection",
      reference: p.orNo || "—",
      description: `Payment from ${p.member.firstName} ${p.member.lastName} (MAF ${p.member.mafNo})`,
      amount: Number(p.amount),
      direction: "IN",
    });
  }
  // Period income entries (fetch detail rows for ledger)
  const periodIncomeRows = await db.income.findMany({
    where: { ...branchIncomeFilter, status: "POSTED", incomeDate: periodWhere },
    include: { category: true },
    orderBy: { incomeDate: "asc" },
  });
  for (const i of periodIncomeRows) {
    txns.push({
      date: i.incomeDate,
      type: i.category.name,
      reference: i.incomeNo,
      description: i.description,
      amount: Number(i.amount),
      direction: "IN",
    });
  }
  for (const b of borrowingsInPeriod) {
    txns.push({
      date: b.borrowedDate,
      type: "Borrowing",
      reference: b.borrowingNo,
      description: `Borrowed from ${b.source.name}`,
      amount: Number(b.amount),
      direction: "IN",
    });
  }
  for (const c of claimsInPeriod) {
    if (c.dateReleased) {
      txns.push({
        date: c.dateReleased,
        type: "Claim Release",
        reference: c.claimNo,
        description: `Claim paid to ${c.claimantName}`,
        amount: Number(c.releasedAmount ?? 0),
        direction: "OUT",
      });
    }
  }
  for (const p of payslipsInPeriod) {
    txns.push({
      date: p.payDate,
      type: "Payroll",
      reference: p.cutoffLabel || "—",
      description: `Net pay to ${p.employee.firstName} ${p.employee.lastName}`,
      amount: Number(p.netPay),
      direction: "OUT",
    });
  }
  for (const e of expensesInPeriod) {
    txns.push({
      date: e.expenseDate,
      type: e.category.name,
      reference: e.expenseNo,
      description: e.description,
      amount: Number(e.amount),
      direction: "OUT",
    });
  }
  for (const r of repaymentsInPeriod) {
    txns.push({
      date: r.payDate,
      type: "Loan Repayment",
      reference: r.borrowing.borrowingNo,
      description: `Repaid to ${r.borrowing.source.name}`,
      amount: Number(r.amount),
      direction: "OUT",
    });
  }

  txns.sort((a, b) => a.date.getTime() - b.date.getTime());

  // Opening balance: current cash on hand MINUS net for this period (running back)
  // (i.e. balance at the start of the period)
  const openingBalance = currentCashOnHand - netForPeriod;

  let running = openingBalance;
  const ledger = txns.map((t) => {
    running += t.direction === "IN" ? t.amount : -t.amount;
    return { ...t, balance: running };
  });

  // Show most recent first (limit to 200 to keep page snappy)
  const ledgerToShow = [...ledger].reverse().slice(0, 200);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Cash Balance</h1>
          <p className="text-gray-500 text-sm mt-0.5">Running cash on hand · all sources of money in and out</p>
        </div>
        <Link href="/accounting" className="text-sm text-purple-600 hover:underline py-2">Back to Accounting</Link>
      </div>

      {/* Current Cash on Hand */}
      <div className={`rounded-xl p-6 shadow-sm border-2 ${currentCashOnHand >= 0 ? "bg-green-50 border-green-300" : "bg-red-50 border-red-300"}`}>
        <p className="text-xs uppercase font-bold tracking-wider text-gray-500">Current Cash on Hand (All-Time)</p>
        <p className={`text-4xl font-black mt-1 ${currentCashOnHand >= 0 ? "text-green-700" : "text-red-700"}`}>
          {formatCurrency(currentCashOnHand)}
        </p>
        <p className="text-xs text-gray-500 mt-2">
          Total In {formatCurrency(allInTotal)} − Total Out {formatCurrency(allOutTotal)}
          {branchId && ` · ${branches.find((b) => b.id === branchId)?.name}`}
        </p>
        {currentCashOnHand < 0 && (
          <p className="mt-2 text-xs text-red-700 font-semibold">⚠ Negative balance — more cash out than cash in. Check borrowings.</p>
        )}
      </div>

      {/* Filter */}
      <form className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm flex flex-wrap gap-3 items-end">
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">From</label>
          <input type="date" name="from" defaultValue={fromInput} className="border border-gray-300 rounded-lg px-2 py-2 text-sm" />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">To</label>
          <input type="date" name="to" defaultValue={toInput} className="border border-gray-300 rounded-lg px-2 py-2 text-sm" />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Branch</label>
          <select name="branchId" defaultValue={branchId} className="border border-gray-300 rounded-lg px-2 py-2 text-sm">
            <option value="">All Branches</option>
            {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
        </div>
        <button type="submit" className="bg-purple-600 hover:bg-purple-700 text-white text-sm font-semibold px-4 py-2 rounded-lg">Apply</button>
      </form>

      {/* Period Breakdown */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* CASH IN */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-5 py-3 bg-green-50 border-b border-green-200">
            <h2 className="text-sm font-bold text-green-700 uppercase">Cash In — Period</h2>
          </div>
          <div className="p-5 space-y-2 text-sm">
            {periodCashIn.length === 0 && (
              <p className="text-gray-400 italic">No cash in for this period.</p>
            )}
            {periodCashIn.map((row) => (
              <div key={row.label} className="flex justify-between">
                <span className="text-gray-700">{row.label} <span className="text-xs text-gray-400">({row.count})</span></span>
                <span className="font-semibold text-green-700">{formatCurrency(row.amount)}</span>
              </div>
            ))}
            <div className="flex justify-between pt-3 border-t font-bold">
              <span>TOTAL IN</span>
              <span className="text-green-700">{formatCurrency(totalCashInPeriod)}</span>
            </div>
          </div>
        </div>

        {/* CASH OUT */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-5 py-3 bg-red-50 border-b border-red-200">
            <h2 className="text-sm font-bold text-red-700 uppercase">Cash Out — Period</h2>
          </div>
          <div className="p-5 space-y-2 text-sm">
            {periodCashOut.length === 0 && (
              <p className="text-gray-400 italic">No cash out for this period.</p>
            )}
            {periodCashOut.map((row) => (
              <div key={row.label} className="flex justify-between">
                <span className="text-gray-700">{row.label} <span className="text-xs text-gray-400">({row.count})</span></span>
                <span className="font-semibold text-red-600">{formatCurrency(row.amount)}</span>
              </div>
            ))}
            <div className="flex justify-between pt-3 border-t font-bold">
              <span>TOTAL OUT</span>
              <span className="text-red-600">{formatCurrency(totalCashOutPeriod)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Net for Period */}
      <div className={`rounded-xl p-5 ${netForPeriod >= 0 ? "bg-blue-50 border border-blue-200" : "bg-red-50 border border-red-200"}`}>
        <div className="flex justify-between items-center">
          <div>
            <p className={`text-sm font-bold uppercase ${netForPeriod >= 0 ? "text-blue-700" : "text-red-700"}`}>Net Cash Movement — Period</p>
            <p className="text-xs text-gray-500 mt-0.5">In − Out · Opening balance {formatCurrency(openingBalance)}</p>
          </div>
          <p className={`text-2xl font-black ${netForPeriod >= 0 ? "text-blue-700" : "text-red-700"}`}>
            {netForPeriod >= 0 ? "+" : ""}{formatCurrency(netForPeriod)}
          </p>
        </div>
      </div>

      {/* Transaction Ledger */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b flex items-center justify-between">
          <div>
            <h2 className="font-semibold text-gray-800">Transaction Ledger</h2>
            <p className="text-xs text-gray-400">{ledger.length} transactions in period · showing most recent {ledgerToShow.length}</p>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
              <tr>
                <th className="px-4 py-2.5 text-left">Date</th>
                <th className="px-4 py-2.5 text-left">Type</th>
                <th className="px-4 py-2.5 text-left">Reference</th>
                <th className="px-4 py-2.5 text-left">Description</th>
                <th className="px-4 py-2.5 text-right">In</th>
                <th className="px-4 py-2.5 text-right">Out</th>
                <th className="px-4 py-2.5 text-right">Balance</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {ledgerToShow.map((t, idx) => (
                <tr key={idx} className="hover:bg-gray-50">
                  <td className="px-4 py-2.5 text-gray-500 text-xs whitespace-nowrap">{new Date(t.date).toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" })}</td>
                  <td className="px-4 py-2.5">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${t.direction === "IN" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
                      {t.type}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 font-mono text-xs text-gray-600">{t.reference}</td>
                  <td className="px-4 py-2.5 text-gray-700">{t.description}</td>
                  <td className="px-4 py-2.5 text-right font-semibold text-green-700">{t.direction === "IN" ? formatCurrency(t.amount) : ""}</td>
                  <td className="px-4 py-2.5 text-right font-semibold text-red-600">{t.direction === "OUT" ? formatCurrency(t.amount) : ""}</td>
                  <td className={`px-4 py-2.5 text-right font-bold ${t.balance >= 0 ? "text-gray-900" : "text-red-700"}`}>{formatCurrency(t.balance)}</td>
                </tr>
              ))}
              {ledgerToShow.length === 0 && (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-400">No transactions for this period.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
