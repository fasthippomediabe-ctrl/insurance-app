"use client";

import { useState } from "react";

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

const STATUS_COLORS: Record<string, string> = {
  ACTIVE: "bg-green-100 text-green-700",
  REINSTATED: "bg-yellow-100 text-yellow-700",
  LAPSED: "bg-red-100 text-red-700",
  FULLY_PAID: "bg-blue-100 text-blue-700",
  DECEASED_CLAIMANT: "bg-gray-100 text-gray-600",
};

function formatCurrency(n: number) {
  return `₱${n.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

interface PaymentRecord {
  installmentFrom: number; installmentTo: number; periodLabel: string;
  totalAmount: number; date: string; isFree: boolean; months: number;
}

interface MemberData {
  mafNo: string; name: string; plan: string; branch: string; status: string;
  enrollmentDate: string; monthlyDue: number; totalPlanAmount: number;
  totalPaid: number; balance: number; installmentsDone: number;
  lastPaymentDate: string | null; dueDate: string; aging: number; amountDue: number;
  payments: PaymentRecord[];
}

export default function VerifyPage() {
  const [mafNo, setMafNo] = useState("");
  const [lastName, setLastName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [data, setData] = useState<MemberData | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!mafNo.trim() || !lastName.trim()) { setError("Please enter both fields."); return; }
    setLoading(true); setError(""); setData(null);
    try {
      const res = await fetch("/api/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mafNo: mafNo.trim(), lastName: lastName.trim() }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error);
      setData(result);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen" style={{ background: "linear-gradient(135deg, #1535b0 0%, #0e2580 50%, #091a60 100%)" }}>
      {/* Header */}
      <div className="text-center pt-8 pb-6 px-4">
        <div className="flex justify-center mb-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="Triple J" width={60} className="rounded-xl" />
        </div>
        <h1 className="text-2xl font-black text-white tracking-widest">TRIPLE J</h1>
        <p className="text-sm font-bold tracking-widest" style={{ color: "#c9a227" }}>MORTUARY CARE SERVICES CORP.</p>
        <p className="text-white/60 text-xs mt-2">Account Verification Portal</p>
      </div>

      <div className="max-w-lg mx-auto px-4 pb-12">
        {/* Notice Banner */}
        <div className="bg-yellow-50 border border-yellow-300 rounded-xl px-4 py-3 mb-6 text-sm text-yellow-800">
          <p className="font-bold mb-1">Important Notice</p>
          <p className="text-xs leading-relaxed">
            We recently migrated to a new system and are still in the process of updating our database.
            If you notice any discrepancies in your records, please <strong>do not panic</strong> — your payments are safe.
            Kindly contact your branch office for any concerns and we will resolve them promptly.
          </p>
        </div>

        {/* Search Form */}
        <div className="bg-white rounded-2xl shadow-xl p-6 mb-6">
          <h2 className="text-lg font-bold text-gray-900 mb-1">Verify Your Account</h2>
          <p className="text-xs text-gray-500 mb-5">Enter your MAF number and last name to view your payment records.</p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">MAF Number</label>
              <input
                className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="e.g. 12345"
                value={mafNo}
                onChange={(e) => setMafNo(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Last Name</label>
              <input
                className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="e.g. DELA CRUZ"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
              />
            </div>
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-2.5 rounded-lg text-sm">{error}</div>
            )}
            <button type="submit" disabled={loading}
              className="w-full py-2.5 bg-blue-700 hover:bg-blue-800 disabled:opacity-50 text-white rounded-lg text-sm font-bold">
              {loading ? "Verifying..." : "Check My Account"}
            </button>
          </form>
        </div>

        {/* Results */}
        {data && (
          <div className="space-y-4">
            {/* Account Summary */}
            <div className="bg-white rounded-2xl shadow-xl p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-lg font-bold text-gray-900">{data.name}</h3>
                  <p className="text-xs text-gray-400 font-mono">MAF No: {data.mafNo}</p>
                </div>
                <span className={`px-3 py-1 rounded-full text-xs font-bold ${STATUS_COLORS[data.status] ?? "bg-gray-100 text-gray-600"}`}>
                  {data.status}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-xs text-gray-400">Plan</p>
                  <p className="font-bold">{data.plan}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-400">Branch</p>
                  <p className="font-bold">{data.branch}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-400">Enrolled</p>
                  <p className="font-bold">{new Date(data.enrollmentDate).toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" })}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-400">Monthly Due</p>
                  <p className="font-bold">{formatCurrency(data.monthlyDue)}</p>
                </div>
              </div>

              {/* Progress */}
              <div className="mt-5 pt-4 border-t">
                <div className="flex justify-between text-xs mb-1.5">
                  <span className="text-gray-500">Payment Progress</span>
                  <span className="font-bold text-gray-700">{data.installmentsDone} / 60 installments</span>
                </div>
                <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
                  <div className="h-full bg-blue-600 rounded-full transition-all" style={{ width: `${Math.min((data.installmentsDone / 60) * 100, 100)}%` }} />
                </div>
                <div className="flex justify-between mt-3 text-sm">
                  <div>
                    <p className="text-xs text-gray-400">Total Paid</p>
                    <p className="font-bold text-green-700">{formatCurrency(data.totalPaid)}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-gray-400">Remaining Balance</p>
                    <p className="font-bold text-red-600">{formatCurrency(data.balance)}</p>
                  </div>
                </div>
              </div>

              {/* Due Date & Aging */}
              <div className="mt-4 pt-4 border-t">
                <div className="grid grid-cols-3 gap-3 text-center">
                  <div>
                    <p className="text-xs text-gray-400">Next Due</p>
                    <p className="font-bold text-sm">
                      {new Date(data.dueDate).toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" })}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400">Aging</p>
                    <p className={`font-bold text-sm ${
                      data.aging >= 120 ? "text-red-700" : data.aging >= 60 ? "text-orange-600" : data.aging >= 30 ? "text-yellow-600" : "text-green-600"
                    }`}>
                      {data.aging === 0 ? "Current" : data.aging >= 120 ? "LAPSED" : `${data.aging} days`}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400">Amount Due</p>
                    <p className={`font-bold text-sm ${data.aging > 0 ? "text-red-600" : "text-gray-800"}`}>
                      {formatCurrency(data.amountDue)}
                    </p>
                  </div>
                </div>
                {data.aging >= 90 && (
                  <div className="mt-2 bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-xs text-red-700 text-center">
                    {data.aging >= 120
                      ? "Your account is LAPSED. Please visit your branch to reinstate."
                      : "Your account is overdue. Please pay as soon as possible to avoid lapsing."}
                  </div>
                )}
              </div>

              {data.lastPaymentDate && (
                <div className="mt-3 pt-3 border-t text-xs text-gray-500">
                  Last payment: <strong>{new Date(data.lastPaymentDate).toLocaleDateString("en-PH", { month: "long", day: "numeric", year: "numeric" })}</strong>
                </div>
              )}
            </div>

            {/* Payment History */}
            <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
              <div className="px-6 py-4 border-b">
                <h3 className="font-bold text-gray-900">Payment History</h3>
                <p className="text-xs text-gray-400">{data.payments.length} records</p>
              </div>
              <div className="overflow-x-auto max-h-96">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 text-gray-500 text-xs uppercase sticky top-0">
                    <tr>
                      <th className="px-4 py-2.5 text-center">#</th>
                      <th className="px-4 py-2.5 text-left">Period</th>
                      <th className="px-4 py-2.5 text-right">Amount</th>
                      <th className="px-4 py-2.5 text-left">Date Paid</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {data.payments.map((p, i) => (
                      <tr key={i} className={p.isFree ? "bg-blue-50/50" : ""}>
                        <td className="px-4 py-2.5 text-center text-gray-400 text-xs">
                          {p.installmentFrom === p.installmentTo
                            ? p.installmentFrom
                            : `${p.installmentFrom}-${p.installmentTo}`}
                        </td>
                        <td className="px-4 py-2.5 font-medium">
                          {p.periodLabel}
                          {p.isFree && <span className="ml-1.5 text-[10px] bg-blue-100 text-blue-600 px-1.5 py-0.5 rounded-full font-bold">FREE</span>}
                          {p.months > 1 && !p.isFree && (
                            <span className="ml-1.5 text-[10px] bg-purple-100 text-purple-600 px-1.5 py-0.5 rounded-full font-bold">{p.months} mos</span>
                          )}
                        </td>
                        <td className="px-4 py-2.5 text-right font-semibold">
                          {formatCurrency(p.totalAmount)}
                          {p.isFree && <span className="text-[10px] text-blue-500 ml-1">(FREE)</span>}
                        </td>
                        <td className="px-4 py-2.5 text-gray-500 text-xs">
                          {new Date(p.date).toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" })}
                        </td>
                      </tr>
                    ))}
                    {data.payments.length === 0 && (
                      <tr><td colSpan={4} className="px-4 py-8 text-center text-gray-400">No payments recorded yet.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Disclaimer */}
            <div className="bg-white/10 rounded-xl px-4 py-3 text-xs text-white/60 text-center">
              If you find any discrepancies, please visit your branch office. We are updating records from our system migration.
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="text-center mt-8 text-xs text-white/40">
          <p>Triple J Mortuary Care Services Corp.</p>
          <p className="mt-1">For concerns, contact your branch office.</p>
        </div>
      </div>
    </div>
  );
}
