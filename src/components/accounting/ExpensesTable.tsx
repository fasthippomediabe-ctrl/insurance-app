"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { formatCurrency } from "@/lib/utils";

interface Expense {
  id: string; expenseNo: string; categoryId: string; categoryName: string;
  branchId: string | null; amount: number; expenseDate: string; description: string;
  vendor: string | null; paymentMethod: string | null; receiptNo: string | null;
  receiptPhoto: string | null; notes: string | null;
}
interface Branch { id: string; name: string }
interface Category { id: string; name: string }

export default function ExpensesTable({
  expenses, branches, categories, total,
}: {
  expenses: Expense[]; branches: Branch[]; categories: Category[]; total: number;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState<Expense | null>(null);
  const [form, setForm] = useState<any>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const branchMap = new Map(branches.map((b) => [b.id, b.name]));

  function startEdit(e: Expense) {
    setEditing(e);
    setForm({
      categoryId: e.categoryId,
      branchId: e.branchId ?? "",
      amount: e.amount,
      expenseDate: e.expenseDate.split("T")[0],
      description: e.description,
      vendor: e.vendor ?? "",
      paymentMethod: e.paymentMethod ?? "CASH",
      receiptNo: e.receiptNo ?? "",
      receiptPhoto: e.receiptPhoto ?? null,
      notes: e.notes ?? "",
    });
    setError("");
  }

  function set(k: string, v: any) { setForm((p: any) => ({ ...p, [k]: v })); }

  function handlePhoto(ev: React.ChangeEvent<HTMLInputElement>) {
    const file = ev.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) { setError("Photo too large. Max 2MB."); return; }
    const reader = new FileReader();
    reader.onload = () => set("receiptPhoto", reader.result as string);
    reader.readAsDataURL(file);
  }

  async function saveEdit() {
    if (!editing) return;
    setLoading(true); setError("");
    try {
      const res = await fetch("/api/accounting/expenses", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: editing.id,
          categoryId: form.categoryId,
          branchId: form.branchId || null,
          amount: parseFloat(String(form.amount)),
          expenseDate: form.expenseDate,
          description: form.description,
          vendor: form.vendor,
          paymentMethod: form.paymentMethod,
          receiptNo: form.receiptNo,
          receiptPhoto: form.receiptPhoto,
          notes: form.notes,
        }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "Failed");
      setEditing(null);
      router.refresh();
    } catch (e: any) { setError(e.message); } finally { setLoading(false); }
  }

  async function voidExpense(id: string) {
    if (!confirm("Void this expense? It will be removed from reports.")) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/accounting/expenses?id=${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error((await res.json()).error ?? "Failed");
      router.refresh();
    } catch (e: any) { alert("Error: " + e.message); } finally { setLoading(false); }
  }

  return (
    <>
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
                <th className="px-4 py-2.5 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {expenses.map((e) => (
                <tr key={e.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-gray-500 text-xs">{new Date(e.expenseDate).toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" })}</td>
                  <td className="px-4 py-3 font-mono text-xs text-gray-600">{e.expenseNo}</td>
                  <td className="px-4 py-3"><span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 font-bold">{e.categoryName}</span></td>
                  <td className="px-4 py-3 text-gray-500 text-xs">{e.branchId ? branchMap.get(e.branchId) ?? "—" : "Head Office"}</td>
                  <td className="px-4 py-3 text-gray-700">{e.description}</td>
                  <td className="px-4 py-3 text-gray-500 text-xs">{e.vendor ?? "—"}</td>
                  <td className="px-4 py-3 text-right font-semibold text-red-600">{formatCurrency(e.amount)}</td>
                  <td className="px-4 py-3 text-center space-x-2 whitespace-nowrap">
                    <button onClick={() => startEdit(e)} className="text-blue-600 hover:underline text-xs font-medium">Edit</button>
                    <button onClick={() => voidExpense(e.id)} className="text-red-500 hover:underline text-xs font-medium">Void</button>
                  </td>
                </tr>
              ))}
              {expenses.length === 0 && (
                <tr><td colSpan={8} className="px-4 py-8 text-center text-gray-400">No expenses for this period.</td></tr>
              )}
            </tbody>
            {expenses.length > 0 && (
              <tfoot className="bg-gray-50 font-bold">
                <tr>
                  <td colSpan={6} className="px-4 py-3 text-right">TOTAL</td>
                  <td className="px-4 py-3 text-right text-red-600">{formatCurrency(total)}</td>
                  <td></td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      {/* Edit Modal */}
      {editing && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setEditing(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="px-6 pt-6 pb-4 border-b flex items-start justify-between">
              <div>
                <h2 className="text-lg font-bold text-gray-900">Edit Expense</h2>
                <p className="text-xs text-gray-500 mt-0.5">{editing.expenseNo}</p>
              </div>
              <button onClick={() => setEditing(null)} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
            </div>

            <div className="px-6 py-5 space-y-4">
              {error && <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded text-sm">{error}</div>}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Category</label>
                  <select className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" value={form.categoryId} onChange={(e) => set("categoryId", e.target.value)}>
                    {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Branch</label>
                  <select className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" value={form.branchId} onChange={(e) => set("branchId", e.target.value)}>
                    <option value="">Head Office / All</option>
                    {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Amount</label>
                  <input type="number" step="0.01" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                    value={form.amount} onChange={(e) => set("amount", e.target.value)} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Date</label>
                  <input type="date" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                    value={form.expenseDate} onChange={(e) => set("expenseDate", e.target.value)} />
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-medium text-gray-500 mb-1">Description</label>
                  <input className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                    value={form.description} onChange={(e) => set("description", e.target.value)} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Vendor / Payee</label>
                  <input className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                    value={form.vendor} onChange={(e) => set("vendor", e.target.value)} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Payment Method</label>
                  <select className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" value={form.paymentMethod} onChange={(e) => set("paymentMethod", e.target.value)}>
                    <option value="CASH">Cash</option>
                    <option value="BANK">Bank Transfer</option>
                    <option value="GCASH">GCash</option>
                    <option value="CHEQUE">Cheque</option>
                    <option value="OTHER">Other</option>
                  </select>
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-medium text-gray-500 mb-1">Receipt No.</label>
                  <input className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                    value={form.receiptNo} onChange={(e) => set("receiptNo", e.target.value)} />
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-medium text-gray-500 mb-1">Notes</label>
                  <textarea rows={2} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm resize-none"
                    value={form.notes} onChange={(e) => set("notes", e.target.value)} />
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-medium text-gray-500 mb-1">Receipt Photo</label>
                  <div className="flex items-center gap-3">
                    {form.receiptPhoto && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={form.receiptPhoto} alt="Receipt" className="w-20 h-20 object-cover rounded border" />
                    )}
                    <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handlePhoto} />
                    <button type="button" onClick={() => fileRef.current?.click()} className="text-sm text-blue-600 hover:underline">
                      {form.receiptPhoto ? "Change" : "Upload"}
                    </button>
                    {form.receiptPhoto && (
                      <button type="button" onClick={() => set("receiptPhoto", null)} className="text-sm text-red-500 hover:underline">Remove</button>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex gap-3 pt-2 border-t">
                <button onClick={() => setEditing(null)}
                  className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-50">Cancel</button>
                <button onClick={saveEdit} disabled={loading}
                  className="flex-1 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg text-sm font-semibold">
                  {loading ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
