"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { formatCurrency } from "@/lib/utils";
import Link from "next/link";

interface Source { id: string; name: string }
interface Branch { id: string; name: string }
interface Repayment { id: string; amount: number; payDate: string; paymentMethod: string | null; notes: string | null }
interface Borrowing {
  id: string; borrowingNo: string; sourceId: string; sourceName: string;
  branchId: string | null; amount: number; balance: number; interestRate: number;
  borrowedDate: string; dueDate: string | null; purpose: string; status: string; notes: string | null;
  repayments: Repayment[];
}

export default function BorrowingsManager({
  sources, branches, borrowings,
}: {
  sources: Source[]; branches: Branch[]; borrowings: Borrowing[];
}) {
  const router = useRouter();
  const [showAdd, setShowAdd] = useState(false);
  const [showSource, setShowSource] = useState(false);
  const [repayFor, setRepayFor] = useState<Borrowing | null>(null);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");

  const today = new Date().toISOString().split("T")[0];
  const [form, setForm] = useState({
    sourceId: "", branchId: "", amount: "", interestRate: "0",
    borrowedDate: today, dueDate: "", purpose: "", notes: "",
  });
  const [repayForm, setRepayForm] = useState({ amount: "", payDate: today, paymentMethod: "CASH", notes: "" });
  const [newSource, setNewSource] = useState({ name: "", description: "" });

  const totalBorrowed = borrowings.reduce((s, b) => s + b.amount, 0);
  const totalOutstanding = borrowings.filter((b) => b.status === "ACTIVE").reduce((s, b) => s + b.balance, 0);
  const totalRepaid = totalBorrowed - totalOutstanding;

  async function addBorrowing() {
    if (!form.sourceId || !form.amount || !form.purpose) { setMsg("Source, amount, and purpose required"); return; }
    setLoading(true); setMsg("");
    try {
      const res = await fetch("/api/accounting/borrowings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          amount: parseFloat(form.amount),
          interestRate: parseFloat(form.interestRate) || 0,
          dueDate: form.dueDate || undefined,
          branchId: form.branchId || undefined,
        }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "Failed");
      setMsg("Borrowing recorded!");
      setShowAdd(false);
      setForm({ sourceId: "", branchId: "", amount: "", interestRate: "0", borrowedDate: today, dueDate: "", purpose: "", notes: "" });
      router.refresh();
    } catch (e: any) { setMsg("Error: " + e.message); } finally { setLoading(false); }
  }

  async function addSource() {
    if (!newSource.name) return;
    setLoading(true);
    try {
      await fetch("/api/accounting/fund-sources", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newSource),
      });
      setShowSource(false); setNewSource({ name: "", description: "" });
      router.refresh();
    } catch { /* ignore */ } finally { setLoading(false); }
  }

  async function recordRepayment() {
    if (!repayFor || !repayForm.amount) return;
    setLoading(true);
    try {
      const res = await fetch("/api/accounting/borrowings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: repayFor.id,
          amount: parseFloat(repayForm.amount),
          payDate: repayForm.payDate,
          paymentMethod: repayForm.paymentMethod,
          notes: repayForm.notes,
        }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "Failed");
      setMsg("Repayment recorded!");
      setRepayFor(null);
      setRepayForm({ amount: "", payDate: today, paymentMethod: "CASH", notes: "" });
      router.refresh();
    } catch (e: any) { setMsg("Error: " + e.message); } finally { setLoading(false); }
  }

  const fmtDate = (d: string | null) => d ? new Date(d).toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" }) : "—";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Borrowings / Fund Sources</h1>
          <p className="text-gray-500 text-sm mt-0.5">Track where funds come from when expenses exceed income</p>
        </div>
        <div className="flex gap-2">
          <Link href="/accounting" className="text-sm text-purple-600 hover:underline py-2">Back</Link>
          <button onClick={() => setShowSource(true)}
            className="bg-gray-700 hover:bg-gray-800 text-white text-sm font-semibold px-3 py-2 rounded-lg">
            + Source
          </button>
          <button onClick={() => setShowAdd(true)}
            className="bg-amber-600 hover:bg-amber-700 text-white text-sm font-semibold px-4 py-2 rounded-lg">
            + Record Borrowing
          </button>
        </div>
      </div>

      {msg && <div className={`px-4 py-2 rounded-lg text-sm ${msg.startsWith("Error") ? "bg-red-50 text-red-700" : "bg-green-50 text-green-700"}`}>{msg}</div>}

      {/* Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 border-l-4 border-l-amber-500 p-5 shadow-sm">
          <p className="text-xs text-gray-400 uppercase font-medium">Total Borrowed</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{formatCurrency(totalBorrowed)}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 border-l-4 border-l-red-500 p-5 shadow-sm">
          <p className="text-xs text-gray-400 uppercase font-medium">Outstanding</p>
          <p className="text-2xl font-bold text-red-700 mt-1">{formatCurrency(totalOutstanding)}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 border-l-4 border-l-green-500 p-5 shadow-sm">
          <p className="text-xs text-gray-400 uppercase font-medium">Total Repaid</p>
          <p className="text-2xl font-bold text-green-700 mt-1">{formatCurrency(totalRepaid)}</p>
        </div>
      </div>

      {/* Borrowings Table */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
              <tr>
                <th className="px-4 py-2.5 text-left">No.</th>
                <th className="px-4 py-2.5 text-left">Date</th>
                <th className="px-4 py-2.5 text-left">Source</th>
                <th className="px-4 py-2.5 text-left">Purpose</th>
                <th className="px-4 py-2.5 text-right">Amount</th>
                <th className="px-4 py-2.5 text-right">Balance</th>
                <th className="px-4 py-2.5 text-left">Due</th>
                <th className="px-4 py-2.5 text-center">Status</th>
                <th className="px-4 py-2.5 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {borrowings.map((b) => (
                <tr key={b.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-mono text-xs text-gray-600">{b.borrowingNo}</td>
                  <td className="px-4 py-3 text-xs text-gray-500">{fmtDate(b.borrowedDate)}</td>
                  <td className="px-4 py-3"><span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 font-bold">{b.sourceName}</span></td>
                  <td className="px-4 py-3 text-gray-700">{b.purpose}</td>
                  <td className="px-4 py-3 text-right font-semibold">{formatCurrency(b.amount)}</td>
                  <td className="px-4 py-3 text-right font-bold text-red-600">{formatCurrency(b.balance)}</td>
                  <td className="px-4 py-3 text-xs text-gray-500">{fmtDate(b.dueDate)}</td>
                  <td className="px-4 py-3 text-center">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${
                      b.status === "FULLY_PAID" ? "bg-green-100 text-green-700" :
                      b.status === "WRITTEN_OFF" ? "bg-gray-100 text-gray-600" :
                      "bg-red-100 text-red-700"
                    }`}>{b.status === "FULLY_PAID" ? "Paid" : b.status === "WRITTEN_OFF" ? "Written Off" : "Active"}</span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    {b.status === "ACTIVE" && (
                      <button onClick={() => { setRepayFor(b); setRepayForm({ ...repayForm, amount: String(b.balance) }); }}
                        className="text-green-600 hover:underline text-xs font-medium">+ Repay</button>
                    )}
                  </td>
                </tr>
              ))}
              {borrowings.length === 0 && (
                <tr><td colSpan={9} className="px-4 py-8 text-center text-gray-400">No borrowings recorded.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Borrowing Modal */}
      {showAdd && (
        <Modal title="Record New Borrowing" onClose={() => setShowAdd(false)}>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Fund Source *</label>
                <select className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                  value={form.sourceId} onChange={(e) => setForm({ ...form, sourceId: e.target.value })}>
                  <option value="">Select source</option>
                  {sources.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
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
                <label className="block text-xs font-medium text-gray-500 mb-1">Amount *</label>
                <input type="number" step="0.01" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                  value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Interest Rate % (optional)</label>
                <input type="number" step="0.01" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                  value={form.interestRate} onChange={(e) => setForm({ ...form, interestRate: e.target.value })} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Borrowed Date *</label>
                <input type="date" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                  value={form.borrowedDate} onChange={(e) => setForm({ ...form, borrowedDate: e.target.value })} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Due Date (optional)</label>
                <input type="date" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                  value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} />
              </div>
              <div className="col-span-2">
                <label className="block text-xs font-medium text-gray-500 mb-1">Purpose *</label>
                <input className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                  value={form.purpose} onChange={(e) => setForm({ ...form, purpose: e.target.value })}
                  placeholder="e.g. Payroll for March 2026" />
              </div>
              <div className="col-span-2">
                <label className="block text-xs font-medium text-gray-500 mb-1">Notes</label>
                <textarea rows={2} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm resize-none"
                  value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
              </div>
            </div>
            <div className="flex gap-3 pt-2">
              <button onClick={() => setShowAdd(false)}
                className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-50">Cancel</button>
              <button onClick={addBorrowing} disabled={loading}
                className="flex-1 px-4 py-2.5 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white rounded-lg text-sm font-semibold">
                {loading ? "Saving..." : "Record Borrowing"}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Add Source Modal */}
      {showSource && (
        <Modal title="Add Fund Source" onClose={() => setShowSource(false)}>
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Name *</label>
              <input className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                value={newSource.name} onChange={(e) => setNewSource({ ...newSource, name: e.target.value })}
                placeholder="e.g. Chapel, Ascendryx, Owner Capital" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Description</label>
              <input className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                value={newSource.description} onChange={(e) => setNewSource({ ...newSource, description: e.target.value })} />
            </div>
            <div className="flex gap-3 pt-2">
              <button onClick={() => setShowSource(false)}
                className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg text-sm text-gray-600 hover:bg-gray-50">Cancel</button>
              <button onClick={addSource} disabled={loading || !newSource.name}
                className="flex-1 px-4 py-2.5 bg-gray-700 hover:bg-gray-800 disabled:opacity-50 text-white rounded-lg text-sm font-semibold">
                Add
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Repay Modal */}
      {repayFor && (
        <Modal title={`Record Repayment — ${repayFor.borrowingNo}`} onClose={() => setRepayFor(null)}>
          <div className="space-y-4">
            <div className="bg-gray-50 rounded-lg p-3 text-sm">
              <p><strong>Source:</strong> {repayFor.sourceName}</p>
              <p><strong>Outstanding Balance:</strong> <span className="text-red-600 font-bold">{formatCurrency(repayFor.balance)}</span></p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Amount *</label>
                <input type="number" step="0.01" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                  value={repayForm.amount} onChange={(e) => setRepayForm({ ...repayForm, amount: e.target.value })} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Date</label>
                <input type="date" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                  value={repayForm.payDate} onChange={(e) => setRepayForm({ ...repayForm, payDate: e.target.value })} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Payment Method</label>
                <select className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                  value={repayForm.paymentMethod} onChange={(e) => setRepayForm({ ...repayForm, paymentMethod: e.target.value })}>
                  <option value="CASH">Cash</option>
                  <option value="BANK">Bank Transfer</option>
                  <option value="GCASH">GCash</option>
                  <option value="CHEQUE">Cheque</option>
                </select>
              </div>
              <div className="col-span-2">
                <label className="block text-xs font-medium text-gray-500 mb-1">Notes</label>
                <input className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                  value={repayForm.notes} onChange={(e) => setRepayForm({ ...repayForm, notes: e.target.value })} />
              </div>
            </div>

            {repayFor.repayments.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-gray-500 mb-2">Previous Repayments ({repayFor.repayments.length})</p>
                <div className="max-h-32 overflow-y-auto space-y-1">
                  {repayFor.repayments.map((r) => (
                    <div key={r.id} className="text-xs flex justify-between bg-gray-50 px-3 py-1.5 rounded">
                      <span>{fmtDate(r.payDate)} · {r.paymentMethod ?? "—"}</span>
                      <span className="font-semibold text-green-700">{formatCurrency(r.amount)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex gap-3 pt-2">
              <button onClick={() => setRepayFor(null)}
                className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg text-sm text-gray-600 hover:bg-gray-50">Cancel</button>
              <button onClick={recordRepayment} disabled={loading}
                className="flex-1 px-4 py-2.5 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white rounded-lg text-sm font-semibold">
                {loading ? "Saving..." : "Record Repayment"}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="px-6 pt-6 pb-4 border-b flex items-start justify-between">
          <h2 className="text-lg font-bold text-gray-900">{title}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
        </div>
        <div className="px-6 py-5">{children}</div>
      </div>
    </div>
  );
}
