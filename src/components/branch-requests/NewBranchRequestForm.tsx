"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

interface Branch { id: string; name: string }

export default function NewBranchRequestForm({
  branches, role, defaultBranchId,
}: {
  branches: Branch[]; role: string; defaultBranchId: string;
}) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState({
    type: "PAYMENT",
    branchId: defaultBranchId,
    title: "",
    description: "",
    amount: "",
    dueDate: "",
    vendor: "",
  });
  const [attachment, setAttachment] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  function set(field: string, value: string) {
    setForm((p) => ({ ...p, [field]: value }));
  }

  function handlePhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) { setError("Attachment too large. Max 2MB."); return; }
    const reader = new FileReader();
    reader.onload = () => setAttachment(reader.result as string);
    reader.readAsDataURL(file);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.title || !form.description || !form.amount) {
      setError("Title, description, and amount are required."); return;
    }
    setLoading(true); setError("");
    try {
      const res = await fetch("/api/branch-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          amount: parseFloat(form.amount),
          attachments: attachment || undefined,
        }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "Failed");
      router.push("/branch-requests");
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">{error}</div>}

      {/* Request Type */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Request Type</h2>
        <div className="grid grid-cols-3 gap-3">
          {[
            { value: "PAYMENT", label: "Payment", desc: "Vendor payments, services", color: "blue" },
            { value: "EXPENSE", label: "Expense", desc: "Reimbursement, operating costs", color: "purple" },
            { value: "LIABILITY", label: "Liability", desc: "Debts, obligations", color: "red" },
          ].map((t) => (
            <label key={t.value} className={`cursor-pointer rounded-xl border-2 p-3 text-center transition-all ${
              form.type === t.value ? `border-${t.color}-500 bg-${t.color}-50` : "border-gray-200 hover:border-gray-300"
            }`}>
              <input type="radio" name="type" value={t.value} checked={form.type === t.value}
                onChange={() => set("type", t.value)} className="sr-only" />
              <p className="font-bold text-sm text-gray-900">{t.label}</p>
              <p className="text-[10px] text-gray-500 mt-0.5">{t.desc}</p>
            </label>
          ))}
        </div>
      </div>

      {/* Details */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm space-y-4">
        <h2 className="text-lg font-semibold text-gray-900">Request Details</h2>

        {role === "ADMIN" && (
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Branch</label>
            <select className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
              value={form.branchId} onChange={(e) => set("branchId", e.target.value)}>
              <option value="">Select branch</option>
              {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </div>
        )}

        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Title *</label>
          <input className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
            value={form.title} onChange={(e) => set("title", e.target.value)}
            placeholder="e.g. Electricity bill for April 2026" required />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Amount *</label>
            <input type="number" step="0.01" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
              value={form.amount} onChange={(e) => set("amount", e.target.value)} required />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Due Date</label>
            <input type="date" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
              value={form.dueDate} onChange={(e) => set("dueDate", e.target.value)} />
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Vendor / Payee</label>
          <input className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
            value={form.vendor} onChange={(e) => set("vendor", e.target.value)}
            placeholder="Optional — who will be paid" />
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Description *</label>
          <textarea rows={4} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm resize-none"
            value={form.description} onChange={(e) => set("description", e.target.value)}
            placeholder="Explain the request in detail — what, why, when" required />
        </div>

        {/* Attachment */}
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Attachment (receipt, quotation, etc.)</label>
          <div className="flex items-center gap-4">
            {attachment && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={attachment} alt="Attachment" className="w-20 h-20 object-cover rounded border" />
            )}
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handlePhoto} />
            <button type="button" onClick={() => fileRef.current?.click()}
              className="text-sm text-blue-600 hover:underline">
              {attachment ? "Change" : "Upload Photo"}
            </button>
            {attachment && (
              <button type="button" onClick={() => setAttachment(null)} className="text-sm text-red-500 hover:underline">Remove</button>
            )}
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <Link href="/branch-requests" className="text-sm text-gray-500 hover:text-gray-700">Cancel</Link>
        <button type="submit" disabled={loading}
          className="px-6 py-2.5 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-sm font-semibold disabled:opacity-50">
          {loading ? "Submitting..." : "Submit Request"}
        </button>
      </div>
    </form>
  );
}
