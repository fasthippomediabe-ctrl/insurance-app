"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { formatCurrency } from "@/lib/utils";
import Link from "next/link";

interface LoanPayment { id: string; amount: number; payDate: string; notes: string | null }
interface Loan {
  id: string; employeeId: string; type: string; description: string | null;
  amount: number; balance: number; monthlyDeduction: number; startDate: string; status: string;
  employee: { firstName: string; lastName: string; employeeNo: string; primaryPosition: string };
  payments: LoanPayment[];
}
interface Employee { id: string; firstName: string; lastName: string; primaryPosition: string }

const LOAN_TYPES = [
  { value: "CASH_ADVANCE", label: "Cash Advance" },
  { value: "SSS_LOAN", label: "SSS Loan" },
  { value: "PAGIBIG_LOAN", label: "Pag-IBIG Loan" },
  { value: "SALARY_LOAN", label: "Salary Loan" },
  { value: "OTHER", label: "Other" },
];

export default function LoanManager({ loans, employees }: { loans: Loan[]; employees: Employee[] }) {
  const router = useRouter();
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ employeeId: "", type: "CASH_ADVANCE", description: "", amount: "", monthlyDeduction: "" });
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");

  async function addLoan() {
    if (!form.employeeId || !form.amount) { setMsg("Employee and amount required"); return; }
    setLoading(true);
    setMsg("");
    try {
      const res = await fetch("/api/payroll/loans", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          amount: parseFloat(form.amount),
          monthlyDeduction: parseFloat(form.monthlyDeduction) || 0,
        }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "Failed");
      setMsg("Loan added!");
      setShowAdd(false);
      setForm({ employeeId: "", type: "CASH_ADVANCE", description: "", amount: "", monthlyDeduction: "" });
      router.refresh();
    } catch (e: any) {
      setMsg("Error: " + e.message);
    } finally {
      setLoading(false);
    }
  }

  const active = loans.filter((l) => l.status === "ACTIVE");
  const paid = loans.filter((l) => l.status === "FULLY_PAID");

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Loans & Cash Advances</h1>
          <p className="text-gray-500 text-sm mt-0.5">{active.length} active · {paid.length} fully paid</p>
        </div>
        <div className="flex gap-2">
          <Link href="/payroll" className="text-sm text-purple-600 hover:underline mr-3">Back to Payroll</Link>
          <button onClick={() => setShowAdd(true)}
            className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-4 py-2 rounded-lg">
            + New Loan
          </button>
        </div>
      </div>

      {msg && <div className={`px-4 py-2 rounded-lg text-sm ${msg.startsWith("Error") ? "bg-red-50 text-red-700" : "bg-green-50 text-green-700"}`}>{msg}</div>}

      {/* Add Loan Modal */}
      {showAdd && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="px-6 pt-6 pb-4 border-b">
              <h2 className="text-lg font-bold text-gray-900">New Loan / Cash Advance</h2>
            </div>
            <div className="px-6 py-5 space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Employee</label>
                <select className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                  value={form.employeeId} onChange={(e) => setForm({ ...form, employeeId: e.target.value })}>
                  <option value="">Select employee</option>
                  {employees.map((e) => <option key={e.id} value={e.id}>{e.firstName} {e.lastName} ({e.primaryPosition})</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Loan Type</label>
                <select className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                  value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
                  {LOAN_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Description</label>
                <input className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                  value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Optional" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Total Amount</label>
                  <input type="number" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                    value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Deduction per Cutoff</label>
                  <input type="number" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                    value={form.monthlyDeduction} onChange={(e) => setForm({ ...form, monthlyDeduction: e.target.value })} />
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <button onClick={() => setShowAdd(false)}
                  className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-50">Cancel</button>
                <button onClick={addLoan} disabled={loading}
                  className="flex-1 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg text-sm font-semibold">
                  {loading ? "Saving..." : "Add Loan"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Loans Table */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
              <tr>
                <th className="px-4 py-2.5 text-left">Employee</th>
                <th className="px-4 py-2.5 text-left">Type</th>
                <th className="px-4 py-2.5 text-right">Total</th>
                <th className="px-4 py-2.5 text-right">Balance</th>
                <th className="px-4 py-2.5 text-right">Per Cutoff</th>
                <th className="px-4 py-2.5 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {loans.map((l) => (
                <tr key={l.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-800">{l.employee.firstName} {l.employee.lastName}</td>
                  <td className="px-4 py-3 text-gray-600">{LOAN_TYPES.find((t) => t.value === l.type)?.label ?? l.type}</td>
                  <td className="px-4 py-3 text-right">{formatCurrency(l.amount)}</td>
                  <td className="px-4 py-3 text-right font-semibold text-red-600">{formatCurrency(l.balance)}</td>
                  <td className="px-4 py-3 text-right text-gray-600">{formatCurrency(l.monthlyDeduction)}</td>
                  <td className="px-4 py-3 text-center">
                    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-bold ${
                      l.status === "ACTIVE" ? "bg-red-100 text-red-700" : "bg-green-100 text-green-700"
                    }`}>{l.status === "FULLY_PAID" ? "Paid" : l.status}</span>
                  </td>
                </tr>
              ))}
              {loans.length === 0 && (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-400">No loans recorded.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
