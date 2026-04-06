"use client";

import { formatCurrency } from "@/lib/utils";

interface Payment {
  id: string;
  periodYear: number;
  periodMonth: number;
  paymentDate: string | Date;
  amount: number | string;
  installmentNo: number;
  isFree: boolean;
}

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

export default function PaymentLedger({
  payments,
  effectivityDate,
  monthlyDue,
}: {
  payments: Payment[];
  effectivityDate: string;
  monthlyDue: number;
}) {
  const startDate = new Date(effectivityDate);
  const today = new Date();

  // Build a map of paid months
  const paidMap = new Map(
    payments.map((p) => [`${p.periodYear}-${p.periodMonth}`, p])
  );

  // Generate all months from effectivity to today (max 60 installments)
  type MonthEntry = {
    year: number;
    month: number;
    installmentNo: number;
    payment: Payment | undefined;
    status: "paid" | "unpaid" | "free" | "future";
  };

  const rows: MonthEntry[] = [];
  const cursor = new Date(startDate);
  let installmentNo = 1;

  while (installmentNo <= 60) {
    const y = cursor.getFullYear();
    const m = cursor.getMonth() + 1;
    const isFuture = cursor > today;
    const payment = paidMap.get(`${y}-${m}`);

    rows.push({
      year: y,
      month: m,
      installmentNo,
      payment,
      status: payment
        ? payment.isFree ? "free" : "paid"
        : isFuture ? "future" : "unpaid",
    });

    cursor.setMonth(cursor.getMonth() + 1);
    installmentNo++;
  }

  // Group by year
  const byYear = rows.reduce<Record<number, MonthEntry[]>>((acc, row) => {
    if (!acc[row.year]) acc[row.year] = [];
    acc[row.year].push(row);
    return acc;
  }, {});

  const totalPaid = payments.reduce((s, p) => s + Number(p.amount), 0);
  const unpaidCount = rows.filter((r) => r.status === "unpaid").length;

  // Detect consecutive unpaid streak (for lapse warning)
  let maxStreak = 0, streak = 0;
  for (const r of rows) {
    if (r.status === "unpaid") { streak++; maxStreak = Math.max(maxStreak, streak); }
    else streak = 0;
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between flex-wrap gap-3">
        <h2 className="font-semibold text-gray-800">Payment Ledger</h2>
        <div className="flex items-center gap-4 text-xs text-gray-500">
          <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-green-400 inline-block" />Paid</span>
          <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-blue-300 inline-block" />Free</span>
          <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-red-300 inline-block" />Unpaid</span>
          <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-gray-200 inline-block" />Future</span>
        </div>
      </div>

      <div className="p-5 space-y-5">
        {maxStreak >= 3 && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-2 rounded-lg">
            Warning: {maxStreak} consecutive unpaid months detected — account is lapsed.
          </div>
        )}

        {Object.entries(byYear).map(([year, entries]) => (
          <div key={year}>
            <p className="text-xs font-semibold text-gray-400 uppercase mb-2">{year}</p>
            <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-12 gap-1.5">
              {entries.map((e) => {
                const colorClass =
                  e.status === "paid" ? "bg-green-100 border-green-300 text-green-700"
                  : e.status === "free" ? "bg-blue-100 border-blue-300 text-blue-700"
                  : e.status === "unpaid" ? "bg-red-50 border-red-300 text-red-600"
                  : "bg-gray-50 border-gray-200 text-gray-400";

                return (
                  <div key={`${e.year}-${e.month}`}
                    className={`border rounded-lg p-1.5 text-center cursor-default transition-all ${colorClass}`}
                    title={e.payment ? `Paid ${formatCurrency(Number(e.payment.amount))} on ${new Date(e.payment.paymentDate).toLocaleDateString("en-PH")}` : e.status}>
                    <p className="text-xs font-semibold">{MONTHS[e.month - 1]}</p>
                    <p className="text-xs opacity-70">#{e.installmentNo}</p>
                    {e.payment && (
                      <p className="text-xs font-medium mt-0.5">{formatCurrency(Number(e.payment.amount))}</p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}

        <div className="flex flex-wrap gap-4 pt-3 border-t border-gray-100 text-sm">
          <div>
            <span className="text-gray-500">Total Paid: </span>
            <span className="font-bold text-green-600">{formatCurrency(totalPaid)}</span>
          </div>
          <div>
            <span className="text-gray-500">Unpaid Months: </span>
            <span className="font-bold text-red-600">{unpaidCount}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
