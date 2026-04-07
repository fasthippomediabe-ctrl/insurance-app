"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

interface Category { id: string; name: string; type: string }
interface Branch { id: string; name: string }

export default function NewExpenseForm({ categories, branches }: { categories: Category[]; branches: Branch[] }) {
  const router = useRouter();
  const today = new Date().toISOString().split("T")[0];
  const fileRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState({
    categoryId: "",
    branchId: "",
    amount: "",
    expenseDate: today,
    description: "",
    vendor: "",
    paymentMethod: "CASH",
    receiptNo: "",
    notes: "",
  });
  const [receiptPhoto, setReceiptPhoto] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  function set(field: string, value: string) {
    setForm((p) => ({ ...p, [field]: value }));
  }

  function handlePhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) { setError("Photo too large. Max 2MB."); return; }
    const reader = new FileReader();
    reader.onload = () => setReceiptPhoto(reader.result as string);
    reader.readAsDataURL(file);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.categoryId || !form.amount || !form.description) {
      setError("Category, amount, and description are required."); return;
    }
    setLoading(true); setError("");
    try {
      const res = await fetch("/api/accounting/expenses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          amount: parseFloat(form.amount),
          branchId: form.branchId || undefined,
          receiptPhoto: receiptPhoto || undefined,
        }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "Failed");
      router.push("/accounting/expenses");
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">{error}</div>}

      <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Category *</label>
            <select className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" value={form.categoryId} onChange={(e) => set("categoryId", e.target.value)} required>
              <option value="">Select category</option>
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
            <label className="block text-xs font-medium text-gray-500 mb-1">Amount *</label>
            <input type="number" step="0.01" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" value={form.amount} onChange={(e) => set("amount", e.target.value)} required />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Expense Date *</label>
            <input type="date" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" value={form.expenseDate} onChange={(e) => set("expenseDate", e.target.value)} required />
          </div>
          <div className="col-span-2">
            <label className="block text-xs font-medium text-gray-500 mb-1">Description *</label>
            <input className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" value={form.description} onChange={(e) => set("description", e.target.value)} placeholder="e.g. Electricity bill for March" required />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Vendor / Payee</label>
            <input className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" value={form.vendor} onChange={(e) => set("vendor", e.target.value)} placeholder="Optional" />
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
            <label className="block text-xs font-medium text-gray-500 mb-1">Receipt / Reference No.</label>
            <input className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" value={form.receiptNo} onChange={(e) => set("receiptNo", e.target.value)} placeholder="OR No., reference number" />
          </div>
          <div className="col-span-2">
            <label className="block text-xs font-medium text-gray-500 mb-1">Notes</label>
            <textarea rows={2} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm resize-none" value={form.notes} onChange={(e) => set("notes", e.target.value)} />
          </div>
        </div>

        {/* Receipt Photo */}
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Receipt Photo (optional)</label>
          <div className="flex items-center gap-4">
            {receiptPhoto && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={receiptPhoto} alt="Receipt" className="w-20 h-20 object-cover rounded border" />
            )}
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handlePhoto} />
            <button type="button" onClick={() => fileRef.current?.click()}
              className="text-sm text-blue-600 hover:underline">
              {receiptPhoto ? "Change Photo" : "Upload Receipt"}
            </button>
            {receiptPhoto && (
              <button type="button" onClick={() => setReceiptPhoto(null)} className="text-sm text-red-500 hover:underline">Remove</button>
            )}
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <Link href="/accounting" className="text-sm text-gray-500 hover:text-gray-700">Cancel</Link>
        <button type="submit" disabled={loading}
          className="px-6 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-semibold disabled:opacity-50">
          {loading ? "Saving..." : "Record Expense"}
        </button>
      </div>
    </form>
  );
}
