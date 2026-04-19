"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { formatCurrency } from "@/lib/utils";
import Link from "next/link";

interface Branch { id: string; name: string }
interface Payment {
  id: string; payDate: string; amount: number; principalPaid: number;
  interestPaid: number; penaltyPaid: number; paymentMethod: string | null;
  referenceNo: string | null; notes: string | null;
}
interface Liability {
  id: string; liabilityNo: string; lenderName: string; lenderContact: string | null;
  branchId: string | null; principal: number; interestRate: number; totalPayable: number;
  currentBalance: number; frequency: string; paymentAmount: number;
  startDate: string; maturityDate: string | null; termMonths: number | null;
  purpose: string | null; status: string; notes: string | null;
  payments: Payment[];
}

const FREQ_LABELS: Record<string, string> = {
  MONTHLY: "Monthly", BIWEEKLY: "Bi-weekly", WEEKLY: "Weekly", QUARTERLY: "Quarterly", ANNUAL: "Annual",
};

export default function LiabilitiesManager({
  liabilities, branches,
}: {
  liabilities: Liability[]; branches: Branch[];
}) {
  const router = useRouter();
  const [showAdd, setShowAdd] = useState(false);
  const [payFor, setPayFor] = useState<Liability | null>(null);
  const [viewFor, setViewFor] = useState<Liability | null>(null);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");

  const today = new Date().toISOString().split("T")[0];
  const [form, setForm] = useState({
    lenderName: "", lenderContact: "", branchId: "",
    principal: "", interestRate: "0", totalPayable: "",
    currentBalance: "", frequency: "MONTHLY", paymentAmount: "",
    startDate: today, maturityDate: "", termMonths: "",
    purpose: "", notes: "",
  });
  const [payForm, setPayForm] = useState({
    amount: "", principalPaid: "", interestPaid: "", penaltyPaid: "",
    payDate: today, paymentMethod: "CASH", referenceNo: "", notes: "",
  });

  const active = liabilities.filter((l) => l.status === "ACTIVE");
  const totalOutstanding = active.reduce((s, l) => s + l.currentBalance, 0);
  const totalPrincipal = active.reduce((s, l) => s + l.principal, 0);
  const totalPaid = liabilities.reduce((s, l) => s + (l.totalPayable - l.currentBalance), 0);
  const nextPaymentTotal = active.reduce((s, l) => s + l.paymentAmount, 0);

  async function addLiability() {
    if (!form.lenderName || !form.principal || !form.startDate) {
      setMsg("Lender, principal, and start date required"); return;
    }
    setLoading(true); setMsg("");
    try {
      const res = await fetch("/api/accounting/liabilities", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          principal: parseFloat(form.principal),
          interestRate: parseFloat(form.interestRate) || 0,
          totalPayable: form.totalPayable ? parseFloat(form.totalPayable) : undefined,
          currentBalance: form.currentBalance ? parseFloat(form.currentBalance) : undefined,
          paymentAmount: parseFloat(form.paymentAmount) || 0,
          termMonths: form.termMonths ? parseInt(form.termMonths) : undefined,
          maturityDate: form.maturityDate || undefined,
          branchId: form.branchId || undefined,
        }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "Failed");
      setMsg("Liability recorded!");
      setShowAdd(false);
      setForm({
        lenderName: "", lenderContact: "", branchId: "",
        principal: "", interestRate: "0", totalPayable: "",
        currentBalance: "", frequency: "MONTHLY", paymentAmount: "",
        startDate: today, maturityDate: "", termMonths: "",
        purpose: "", notes: "",
      });
      router.refresh();
    } catch (e: any) { setMsg("Error: " + e.message); } finally { setLoading(false); }
  }

  async function recordPayment() {
    if (!payFor || !payForm.amount) return;
    setLoading(true);
    try {
      const total = parseFloat(payForm.amount);
      const interest = parseFloat(payForm.interestPaid) || 0;
      const penalty = parseFloat(payForm.penaltyPaid) || 0;
      const principal = parseFloat(payForm.principalPaid) || Math.max(0, total - interest - penalty);

      const res = await fetch("/api/accounting/liabilities", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: payFor.id,
          action: "PAY",
          amount: total,
          principalPaid: principal,
          interestPaid: interest,
          penaltyPaid: penalty,
          payDate: payForm.payDate,
          paymentMethod: payForm.paymentMethod,
          referenceNo: payForm.referenceNo,
          notes: payForm.notes,
        }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "Failed");
      setMsg("Payment recorded!");
      setPayFor(null);
      setPayForm({ amount: "", principalPaid: "", interestPaid: "", penaltyPaid: "", payDate: today, paymentMethod: "CASH", referenceNo: "", notes: "" });
      router.refresh();
    } catch (e: any) { setMsg("Error: " + e.message); } finally { setLoading(false); }
  }

  const fmtDate = (d: string | null) => d ? new Date(d).toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" }) : "—";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Liabilities &amp; Long-Term Loans</h1>
          <p className="text-gray-500 text-sm mt-0.5">Track structured loans with scheduled payments (bank loans, cooperative loans, etc.)</p>
        </div>
        <div className="flex gap-2">
          <Link href="/accounting" className="text-sm text-purple-600 hover:underline py-2">Back</Link>
          <button onClick={() => setShowAdd(true)}
            className="bg-red-600 hover:bg-red-700 text-white text-sm font-semibold px-4 py-2 rounded-lg">
            + Add Liability
          </button>
        </div>
      </div>

      {msg && <div className={`px-4 py-2 rounded-lg text-sm ${msg.startsWith("Error") ? "bg-red-50 text-red-700" : "bg-green-50 text-green-700"}`}>{msg}</div>}

      {/* Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Active Loans" value={active.length.toString()} color="red" />
        <StatCard label="Total Principal" value={formatCurrency(totalPrincipal)} color="amber" />
        <StatCard label="Outstanding Balance" value={formatCurrency(totalOutstanding)} color="red" />
        <StatCard label="Next Period Payment" value={formatCurrency(nextPaymentTotal)} color="blue" />
      </div>

      {/* Liabilities Table */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
              <tr>
                <th className="px-4 py-2.5 text-left">No.</th>
                <th className="px-4 py-2.5 text-left">Lender</th>
                <th className="px-4 py-2.5 text-left">Purpose</th>
                <th className="px-4 py-2.5 text-right">Principal</th>
                <th className="px-4 py-2.5 text-right">Balance</th>
                <th className="px-4 py-2.5 text-center">Interest</th>
                <th className="px-4 py-2.5 text-center">Freq</th>
                <th className="px-4 py-2.5 text-right">Per Payment</th>
                <th className="px-4 py-2.5 text-center">Status</th>
                <th className="px-4 py-2.5 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {liabilities.map((l) => {
                const progress = l.totalPayable > 0 ? ((l.totalPayable - l.currentBalance) / l.totalPayable) * 100 : 0;
                return (
                  <tr key={l.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-mono text-xs text-gray-600">{l.liabilityNo}</td>
                    <td className="px-4 py-3">
                      <div className="font-semibold text-gray-800">{l.lenderName}</div>
                      {l.lenderContact && <div className="text-xs text-gray-400">{l.lenderContact}</div>}
                    </td>
                    <td className="px-4 py-3 text-gray-600 text-xs">{l.purpose ?? "—"}</td>
                    <td className="px-4 py-3 text-right">{formatCurrency(l.principal)}</td>
                    <td className="px-4 py-3 text-right">
                      <div className="font-bold text-red-600">{formatCurrency(l.currentBalance)}</div>
                      <div className="h-1 bg-gray-100 rounded-full mt-1">
                        <div className="h-full bg-green-500 rounded-full" style={{ width: `${Math.min(progress, 100)}%` }} />
                      </div>
                      <div className="text-[10px] text-gray-400 mt-0.5">{progress.toFixed(0)}% paid</div>
                    </td>
                    <td className="px-4 py-3 text-center text-xs text-gray-600">{l.interestRate > 0 ? `${l.interestRate}%` : "—"}</td>
                    <td className="px-4 py-3 text-center text-xs">
                      <span className="px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 font-bold">{FREQ_LABELS[l.frequency] ?? l.frequency}</span>
                    </td>
                    <td className="px-4 py-3 text-right text-gray-700">{formatCurrency(l.paymentAmount)}</td>
                    <td className="px-4 py-3 text-center">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${
                        l.status === "FULLY_PAID" ? "bg-green-100 text-green-700" :
                        l.status === "DEFAULTED" ? "bg-red-100 text-red-700" :
                        l.status === "RESTRUCTURED" ? "bg-purple-100 text-purple-700" :
                        "bg-amber-100 text-amber-700"
                      }`}>{l.status === "FULLY_PAID" ? "Paid" : l.status === "ACTIVE" ? "Active" : l.status}</span>
                    </td>
                    <td className="px-4 py-3 text-center space-x-2 whitespace-nowrap">
                      {l.status === "ACTIVE" && (
                        <button onClick={() => { setPayFor(l); setPayForm({ ...payForm, amount: String(l.paymentAmount) }); }}
                          className="text-green-600 hover:underline text-xs font-medium">+ Pay</button>
                      )}
                      <button onClick={() => setViewFor(l)} className="text-blue-600 hover:underline text-xs font-medium">History</button>
                    </td>
                  </tr>
                );
              })}
              {liabilities.length === 0 && (
                <tr><td colSpan={10} className="px-4 py-8 text-center text-gray-400">No liabilities recorded.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Liability Modal */}
      {showAdd && (
        <Modal title="Add Liability / Long-Term Loan" onClose={() => setShowAdd(false)}>
          <div className="space-y-4">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs text-blue-700">
              💡 For existing loans from last year, enter the <strong>Current Balance</strong> (remaining amount)
              to continue tracking payments. Leave it blank to start fresh from Principal.
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <label className="block text-xs font-medium text-gray-500 mb-1">Lender Name *</label>
                <input className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                  value={form.lenderName} onChange={(e) => setForm({ ...form, lenderName: e.target.value })}
                  placeholder="e.g. BDO, Sugbo Cooperative, John Doe" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Lender Contact</label>
                <input className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                  value={form.lenderContact} onChange={(e) => setForm({ ...form, lenderContact: e.target.value })} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Branch (optional)</label>
                <select className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                  value={form.branchId} onChange={(e) => setForm({ ...form, branchId: e.target.value })}>
                  <option value="">Head Office / All</option>
                  {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Principal Amount *</label>
                <input type="number" step="0.01" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                  value={form.principal} onChange={(e) => setForm({ ...form, principal: e.target.value })} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Interest Rate % (annual)</label>
                <input type="number" step="0.01" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                  value={form.interestRate} onChange={(e) => setForm({ ...form, interestRate: e.target.value })} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Total Payable (principal + interest)</label>
                <input type="number" step="0.01" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                  value={form.totalPayable} onChange={(e) => setForm({ ...form, totalPayable: e.target.value })}
                  placeholder="Auto-computed if blank" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Current Balance (for existing loans)</label>
                <input type="number" step="0.01" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-yellow-50"
                  value={form.currentBalance} onChange={(e) => setForm({ ...form, currentBalance: e.target.value })}
                  placeholder="Leave blank if new loan" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Frequency</label>
                <select className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                  value={form.frequency} onChange={(e) => setForm({ ...form, frequency: e.target.value })}>
                  <option value="MONTHLY">Monthly</option>
                  <option value="BIWEEKLY">Bi-weekly</option>
                  <option value="WEEKLY">Weekly</option>
                  <option value="QUARTERLY">Quarterly</option>
                  <option value="ANNUAL">Annual</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Payment Amount per Period</label>
                <input type="number" step="0.01" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                  value={form.paymentAmount} onChange={(e) => setForm({ ...form, paymentAmount: e.target.value })} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Start Date *</label>
                <input type="date" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                  value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Maturity Date</label>
                <input type="date" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                  value={form.maturityDate} onChange={(e) => setForm({ ...form, maturityDate: e.target.value })} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Term (months)</label>
                <input type="number" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                  value={form.termMonths} onChange={(e) => setForm({ ...form, termMonths: e.target.value })} />
              </div>
              <div className="col-span-2">
                <label className="block text-xs font-medium text-gray-500 mb-1">Purpose / Description</label>
                <input className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                  value={form.purpose} onChange={(e) => setForm({ ...form, purpose: e.target.value })}
                  placeholder="e.g. Business capital, Vehicle financing" />
              </div>
              <div className="col-span-2">
                <label className="block text-xs font-medium text-gray-500 mb-1">Notes</label>
                <textarea rows={2} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm resize-none"
                  value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
              </div>
            </div>
            <div className="flex gap-3 pt-2">
              <button onClick={() => setShowAdd(false)}
                className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg text-sm text-gray-600 hover:bg-gray-50">Cancel</button>
              <button onClick={addLiability} disabled={loading}
                className="flex-1 px-4 py-2.5 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white rounded-lg text-sm font-semibold">
                {loading ? "Saving..." : "Save Liability"}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Payment Modal */}
      {payFor && (
        <Modal title={`Record Payment — ${payFor.liabilityNo}`} onClose={() => setPayFor(null)}>
          <div className="space-y-4">
            <div className="bg-gray-50 rounded-lg p-3 text-sm space-y-1">
              <p><strong>Lender:</strong> {payFor.lenderName}</p>
              <p><strong>Outstanding Balance:</strong> <span className="text-red-600 font-bold">{formatCurrency(payFor.currentBalance)}</span></p>
              <p><strong>Scheduled Payment:</strong> {formatCurrency(payFor.paymentAmount)} {FREQ_LABELS[payFor.frequency]?.toLowerCase()}</p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Total Amount *</label>
                <input type="number" step="0.01" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                  value={payForm.amount} onChange={(e) => setPayForm({ ...payForm, amount: e.target.value })} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Date</label>
                <input type="date" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                  value={payForm.payDate} onChange={(e) => setPayForm({ ...payForm, payDate: e.target.value })} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Principal</label>
                <input type="number" step="0.01" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                  value={payForm.principalPaid} onChange={(e) => setPayForm({ ...payForm, principalPaid: e.target.value })}
                  placeholder="Auto" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Interest</label>
                <input type="number" step="0.01" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                  value={payForm.interestPaid} onChange={(e) => setPayForm({ ...payForm, interestPaid: e.target.value })} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Penalty</label>
                <input type="number" step="0.01" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                  value={payForm.penaltyPaid} onChange={(e) => setPayForm({ ...payForm, penaltyPaid: e.target.value })} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Method</label>
                <select className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                  value={payForm.paymentMethod} onChange={(e) => setPayForm({ ...payForm, paymentMethod: e.target.value })}>
                  <option value="CASH">Cash</option>
                  <option value="BANK">Bank Transfer</option>
                  <option value="GCASH">GCash</option>
                  <option value="CHEQUE">Cheque</option>
                </select>
              </div>
              <div className="col-span-2">
                <label className="block text-xs font-medium text-gray-500 mb-1">Reference No.</label>
                <input className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                  value={payForm.referenceNo} onChange={(e) => setPayForm({ ...payForm, referenceNo: e.target.value })} />
              </div>
              <div className="col-span-2">
                <label className="block text-xs font-medium text-gray-500 mb-1">Notes</label>
                <input className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                  value={payForm.notes} onChange={(e) => setPayForm({ ...payForm, notes: e.target.value })} />
              </div>
            </div>
            <p className="text-[11px] text-gray-500 -mt-2">
              Tip: enter the total, and principal will be auto-computed as (Total − Interest − Penalty). Only principal reduces the balance.
            </p>

            <div className="flex gap-3 pt-2">
              <button onClick={() => setPayFor(null)}
                className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg text-sm text-gray-600 hover:bg-gray-50">Cancel</button>
              <button onClick={recordPayment} disabled={loading}
                className="flex-1 px-4 py-2.5 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white rounded-lg text-sm font-semibold">
                {loading ? "Saving..." : "Record Payment"}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* View History Modal */}
      {viewFor && (
        <Modal title={`Payment History — ${viewFor.liabilityNo}`} onClose={() => setViewFor(null)}>
          <div className="space-y-3">
            <div className="bg-gray-50 rounded-lg p-3 text-sm grid grid-cols-2 gap-2">
              <p><strong>Lender:</strong> {viewFor.lenderName}</p>
              <p><strong>Status:</strong> {viewFor.status}</p>
              <p><strong>Principal:</strong> {formatCurrency(viewFor.principal)}</p>
              <p><strong>Interest:</strong> {viewFor.interestRate}%</p>
              <p><strong>Total Payable:</strong> {formatCurrency(viewFor.totalPayable)}</p>
              <p><strong>Balance:</strong> <span className="text-red-600 font-bold">{formatCurrency(viewFor.currentBalance)}</span></p>
              <p><strong>Start:</strong> {fmtDate(viewFor.startDate)}</p>
              <p><strong>Maturity:</strong> {fmtDate(viewFor.maturityDate)}</p>
            </div>

            <div>
              <p className="text-xs font-semibold text-gray-500 mb-2">Payments ({viewFor.payments.length})</p>
              <div className="max-h-64 overflow-y-auto border rounded-lg">
                <table className="w-full text-xs">
                  <thead className="bg-gray-50 text-gray-500">
                    <tr>
                      <th className="px-2 py-1.5 text-left">Date</th>
                      <th className="px-2 py-1.5 text-right">Total</th>
                      <th className="px-2 py-1.5 text-right">Principal</th>
                      <th className="px-2 py-1.5 text-right">Interest</th>
                      <th className="px-2 py-1.5 text-right">Penalty</th>
                      <th className="px-2 py-1.5 text-left">Method</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {viewFor.payments.map((p) => (
                      <tr key={p.id}>
                        <td className="px-2 py-1.5">{fmtDate(p.payDate)}</td>
                        <td className="px-2 py-1.5 text-right font-semibold">{formatCurrency(p.amount)}</td>
                        <td className="px-2 py-1.5 text-right text-green-700">{formatCurrency(p.principalPaid)}</td>
                        <td className="px-2 py-1.5 text-right text-blue-700">{formatCurrency(p.interestPaid)}</td>
                        <td className="px-2 py-1.5 text-right text-red-600">{formatCurrency(p.penaltyPaid)}</td>
                        <td className="px-2 py-1.5 text-gray-500">{p.paymentMethod ?? "—"}</td>
                      </tr>
                    ))}
                    {viewFor.payments.length === 0 && (
                      <tr><td colSpan={6} className="px-2 py-4 text-center text-gray-400">No payments yet.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

function StatCard({ label, value, color }: { label: string; value: string; color: string }) {
  const colors: Record<string, string> = {
    red: "border-l-red-500", amber: "border-l-amber-500", blue: "border-l-blue-500",
  };
  return (
    <div className={`bg-white rounded-xl border border-gray-200 border-l-4 ${colors[color]} p-4 shadow-sm`}>
      <p className="text-xs text-gray-400 uppercase font-medium">{label}</p>
      <p className="text-xl font-bold text-gray-900 mt-1">{value}</p>
    </div>
  );
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="px-6 pt-6 pb-4 border-b flex items-start justify-between">
          <h2 className="text-lg font-bold text-gray-900">{title}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
        </div>
        <div className="px-6 py-5">{children}</div>
      </div>
    </div>
  );
}
