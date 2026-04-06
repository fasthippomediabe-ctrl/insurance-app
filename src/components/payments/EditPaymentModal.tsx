"use client";

import { useState, useRef } from "react";
import { formatCurrency, MONTHS } from "@/lib/utils";

interface Collector { id: string; firstName: string; lastName: string; code: string }

interface Payment {
  id: string;
  periodMonth: number;
  periodYear: number;
  installmentNo: number;
  paymentDate: string;
  amount: number;
  isFree: boolean;
  isSpotCash: boolean;
  paymentMethod: string;
  collectorId: string | null;
  notes: string | null;
  member: { mafNo: string; firstName: string; lastName: string };
}

export default function EditPaymentModal({
  payment,
  collectors,
  onClose,
}: {
  payment: Payment;
  collectors: Collector[];
  onClose: () => void;
}) {
  const [periodMonth, setPeriodMonth]     = useState(payment.periodMonth);
  const [periodYear, setPeriodYear]       = useState(payment.periodYear);
  const [installmentNo, setInstallmentNo] = useState(payment.installmentNo);
  const [paymentDate, setPaymentDate]     = useState(
    new Date(payment.paymentDate).toISOString().split("T")[0]
  );
  const [amount, setAmount]               = useState(String(payment.amount));
  const [isFree, setIsFree]               = useState(payment.isFree);
  const [isSpotCash, setIsSpotCash]       = useState(payment.isSpotCash);
  const [paymentMethod, setPaymentMethod] = useState(payment.paymentMethod);
  const [collectorId, setCollectorId]     = useState(payment.collectorId ?? "");
  const [notes, setNotes]                 = useState(payment.notes ?? "");
  const [reason, setReason]               = useState("");
  const [attachment, setAttachment]       = useState<string | null>(null);
  const [attachmentName, setAttachmentName] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState("");
  const [submitted, setSubmitted] = useState(false);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      setError("File too large. Maximum 2MB.");
      return;
    }
    if (!file.type.startsWith("image/")) {
      setError("Only image files are allowed (JPG, PNG, etc.).");
      return;
    }
    setError("");
    setAttachmentName(file.name);
    const reader = new FileReader();
    reader.onload = () => {
      setAttachment(reader.result as string);
    };
    reader.readAsDataURL(file);
  }

  // Build the diff — only include fields that actually changed
  function buildChanges() {
    const orig = payment;
    const changes: Record<string, any> = {};
    if (periodMonth   !== orig.periodMonth)   changes.periodMonth   = periodMonth;
    if (periodYear    !== orig.periodYear)    changes.periodYear    = periodYear;
    if (installmentNo !== orig.installmentNo) changes.installmentNo = installmentNo;
    const origDate = new Date(orig.paymentDate).toISOString().split("T")[0];
    if (paymentDate   !== origDate)           changes.paymentDate   = paymentDate;
    if (parseFloat(amount) !== Number(orig.amount)) changes.amount  = parseFloat(amount);
    if (isFree        !== orig.isFree)        changes.isFree        = isFree;
    if (isSpotCash    !== orig.isSpotCash)    changes.isSpotCash    = isSpotCash;
    if (paymentMethod !== orig.paymentMethod) changes.paymentMethod = paymentMethod;
    const origCollector = orig.collectorId ?? "";
    if (collectorId !== origCollector)        changes.collectorId   = collectorId || null;
    const origNotes = orig.notes ?? "";
    if (notes !== origNotes)                  changes.notes         = notes || null;
    return changes;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const changes = buildChanges();
    if (Object.keys(changes).length === 0) {
      setError("No changes were made.");
      return;
    }

    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/payments/${payment.id}/edit-request`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ changes, reason: reason || undefined, attachment: attachment || undefined }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? "Failed to submit request.");
      }
      setSubmitted(true);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg">

        {/* Header */}
        <div className="px-6 pt-6 pb-4 border-b flex items-start justify-between">
          <div>
            <h2 className="text-lg font-bold text-gray-900">Request Payment Edit</h2>
            <p className="text-sm text-gray-500 mt-0.5">
              {payment.member.mafNo} — {payment.member.firstName} {payment.member.lastName}
              {" · "}{MONTHS[payment.periodMonth - 1]} {payment.periodYear} #{payment.installmentNo}
            </p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl font-bold">✕</button>
        </div>

        {/* Submitted state */}
        {submitted ? (
          <div className="px-6 py-8 text-center space-y-4">
            <div className="w-14 h-14 bg-green-100 rounded-full flex items-center justify-center mx-auto">
              <svg className="w-7 h-7 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <div>
              <p className="text-base font-semibold text-gray-900">Edit Request Submitted</p>
              <p className="text-sm text-gray-500 mt-1">
                The head office admin has been notified and will review your request shortly.
              </p>
            </div>
            <button
              onClick={onClose}
              className="mt-2 px-6 py-2.5 bg-gray-800 hover:bg-gray-900 text-white rounded-lg text-sm font-semibold"
            >
              Close
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
            <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 text-sm text-amber-800">
              Changes will be sent to the head office admin for approval before being applied.
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Month</label>
                <select
                  className="w-full border border-gray-300 rounded-lg px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={periodMonth}
                  onChange={(e) => setPeriodMonth(Number(e.target.value))}
                >
                  {MONTHS.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Year</label>
                <input
                  type="number"
                  className="w-full border border-gray-300 rounded-lg px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={periodYear}
                  onChange={(e) => setPeriodYear(Number(e.target.value))}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Installment #</label>
                <input
                  type="number"
                  min={1}
                  className="w-full border border-gray-300 rounded-lg px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={installmentNo}
                  onChange={(e) => setInstallmentNo(Number(e.target.value))}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Date Paid</label>
                <input
                  type="date"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={paymentDate}
                  onChange={(e) => setPaymentDate(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Amount (₱)</label>
                <input
                  type="number"
                  step="0.01"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Payment Method</label>
                <select
                  className="w-full border border-gray-300 rounded-lg px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                >
                  <option value="CASH">Cash</option>
                  <option value="GCASH">GCash</option>
                  <option value="BANK_TRANSFER">Bank Transfer</option>
                  <option value="OTHER">Other</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Collected By</label>
                <select
                  className="w-full border border-gray-300 rounded-lg px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={collectorId}
                  onChange={(e) => setCollectorId(e.target.value)}
                >
                  <option value="">Walk-in / Office</option>
                  {collectors.map((c) => (
                    <option key={c.id} value={c.id}>{c.firstName} {c.lastName} ({c.code})</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex gap-6">
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input type="checkbox" checked={isFree} onChange={(e) => setIsFree(e.target.checked)} className="w-4 h-4 rounded" />
                FREE
              </label>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input type="checkbox" checked={isSpotCash} onChange={(e) => setIsSpotCash(e.target.checked)} className="w-4 h-4 rounded" />
                Spot Cash
              </label>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Notes</label>
              <textarea
                rows={2}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">
                Reason for Edit <span className="text-gray-400 font-normal">(optional)</span>
              </label>
              <textarea
                rows={2}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                placeholder="e.g. Wrong amount entered, wrong period..."
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
            </div>

            {/* Photo Attachment */}
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">
                Attach Receipt / Evidence <span className="text-gray-400 font-normal">(optional, max 2MB)</span>
              </label>
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
              {attachment ? (
                <div className="flex items-center gap-3 bg-gray-50 border border-gray-200 rounded-lg p-2">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={attachment} alt="attachment" className="w-16 h-16 object-cover rounded" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-gray-700 truncate">{attachmentName}</p>
                    <p className="text-[10px] text-gray-400">Attached</p>
                  </div>
                  <button type="button" onClick={() => { setAttachment(null); setAttachmentName(""); if (fileRef.current) fileRef.current.value = ""; }}
                    className="text-red-500 hover:text-red-700 text-xs font-medium">Remove</button>
                </div>
              ) : (
                <button type="button" onClick={() => fileRef.current?.click()}
                  className="w-full border-2 border-dashed border-gray-300 rounded-lg py-3 text-sm text-gray-500 hover:border-blue-400 hover:text-blue-600 transition-colors">
                  Click to attach photo
                </button>
              )}
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-3 py-2 rounded-lg">
                {error}
              </div>
            )}

            <div className="flex gap-3 pt-1">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="flex-1 px-4 py-2.5 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white rounded-lg text-sm font-semibold"
              >
                {loading ? "Submitting..." : "Submit for Approval"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
