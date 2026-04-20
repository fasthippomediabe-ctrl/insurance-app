"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
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
  memberId,
}: {
  payments: Payment[];
  effectivityDate: string;
  monthlyDue: number;
  memberId?: string;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState<string | null>(null);
  const [editAmount, setEditAmount] = useState("");
  const [saving, setSaving] = useState(false);
  const [adding, setAdding] = useState<string | null>(null); // "year-month" key
  const [addAmount, setAddAmount] = useState("");

  const startDate = new Date(effectivityDate);
  const today = new Date();

  const paidMap = new Map(
    payments.map((p) => [`${p.periodYear}-${p.periodMonth}`, p])
  );

  type MonthEntry = {
    year: number; month: number; installmentNo: number;
    payment: Payment | undefined; status: "paid" | "unpaid" | "free" | "future";
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
      year: y, month: m, installmentNo, payment,
      status: payment ? (payment.isFree ? "free" : "paid") : (isFuture ? "future" : "unpaid"),
    });
    cursor.setMonth(cursor.getMonth() + 1);
    installmentNo++;
  }

  const byYear = rows.reduce<Record<number, MonthEntry[]>>((acc, row) => {
    if (!acc[row.year]) acc[row.year] = [];
    acc[row.year].push(row);
    return acc;
  }, {});

  const totalPaid = payments.reduce((s, p) => s + (p.isFree ? monthlyDue : Number(p.amount)), 0);
  const unpaidCount = rows.filter((r) => r.status === "unpaid").length;

  let maxStreak = 0, streak = 0;
  for (const r of rows) {
    if (r.status === "unpaid") { streak++; maxStreak = Math.max(maxStreak, streak); }
    else streak = 0;
  }

  function startEdit(payment: Payment) {
    setEditing(payment.id);
    setEditAmount(String(Number(payment.amount)));
  }

  async function deletePayment(paymentId: string) {
    if (!confirm("Delete this payment entry? This cannot be undone.")) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/payments/${paymentId}`, { method: "DELETE" });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(typeof err.error === "string" ? err.error : "Failed");
      }
      setEditing(null);
      router.refresh();
    } catch (e: any) {
      alert("Failed to delete: " + e.message);
    } finally {
      setSaving(false);
    }
  }

  async function saveEdit(paymentId: string) {
    setSaving(true);
    try {
      const res = await fetch(`/api/payments/${paymentId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: parseFloat(editAmount) }),
      });
      if (!res.ok) {
        const err = await res.json();
        let msg = "Failed";
        if (typeof err.error === "string") {
          msg = err.error;
        } else if (err.error?.formErrors?.length) {
          msg = err.error.formErrors.join(", ");
        } else if (err.error?.fieldErrors) {
          msg = Object.entries(err.error.fieldErrors)
            .map(([k, v]) => `${k}: ${(v as string[]).join(", ")}`)
            .join(" | ");
        } else {
          msg = JSON.stringify(err.error);
        }
        throw new Error(msg);
      }
      setEditing(null);
      router.refresh();
    } catch (e: any) {
      alert("Failed to save: " + e.message);
    } finally {
      setSaving(false);
    }
  }

  function startAdd(entry: { year: number; month: number; installmentNo: number }) {
    setAdding(`${entry.year}-${entry.month}`);
    setAddAmount(String(monthlyDue));
  }

  async function addPayment(entry: { year: number; month: number; installmentNo: number }) {
    if (!memberId) { alert("Member ID missing."); return; }
    setSaving(true);
    try {
      const res = await fetch("/api/payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          memberId,
          startPeriodMonth: entry.month,
          startPeriodYear: entry.year,
          startInstallmentNo: entry.installmentNo,
          months: 1,
          amountPerMonth: parseFloat(addAmount),
          paymentDate: new Date(entry.year, entry.month - 1, 15).toISOString(),
          paymentMethod: "CASH",
          isFree: false,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        let msg = "Failed";
        if (typeof err.error === "string") {
          msg = err.error;
        } else if (err.error?.formErrors?.length) {
          msg = err.error.formErrors.join(", ");
        } else if (err.error?.fieldErrors) {
          const fe = err.error.fieldErrors;
          msg = Object.entries(fe)
            .map(([k, v]) => `${k}: ${(v as string[]).join(", ")}`)
            .join(" | ");
        } else {
          msg = JSON.stringify(err.error);
        }
        throw new Error(msg);
      }
      setAdding(null);
      router.refresh();
    } catch (e: any) {
      alert("Failed to add payment: " + e.message);
    } finally {
      setSaving(false);
    }
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

                const isEditing = e.payment && editing === e.payment.id;
                const isAdding = !e.payment && adding === `${e.year}-${e.month}`;
                const clickable = e.status === "paid" || e.status === "free" || (e.status === "unpaid" && memberId);

                return (
                  <div key={`${e.year}-${e.month}`}
                    className={`border rounded-lg p-1.5 text-center transition-all ${colorClass} ${
                      clickable ? "cursor-pointer hover:ring-2 hover:ring-blue-400" : "cursor-default"
                    }`}
                    onClick={() => {
                      if (isEditing || isAdding) return;
                      if (e.payment) startEdit(e.payment);
                      else if (e.status === "unpaid" && memberId) startAdd(e);
                    }}
                    title={e.payment
                      ? `Click to edit — Paid ${formatCurrency(Number(e.payment.amount))} on ${new Date(e.payment.paymentDate).toLocaleDateString("en-PH")}`
                      : e.status === "unpaid" ? "Click to add payment" : e.status}>
                    <p className="text-xs font-semibold">{MONTHS[e.month - 1]}</p>
                    <p className="text-xs opacity-70">#{e.installmentNo}</p>
                    {isEditing ? (
                      <div className="mt-0.5" onClick={(ev) => ev.stopPropagation()}>
                        <input
                          type="number"
                          className="w-full text-[10px] border border-blue-400 rounded px-1 py-0.5 text-center"
                          value={editAmount}
                          onChange={(ev) => setEditAmount(ev.target.value)}
                          onKeyDown={(ev) => {
                            if (ev.key === "Enter") saveEdit(e.payment!.id);
                            if (ev.key === "Escape") setEditing(null);
                          }}
                          autoFocus
                        />
                        <div className="flex gap-0.5 mt-0.5">
                          <button onClick={() => saveEdit(e.payment!.id)} disabled={saving}
                            className="flex-1 text-[9px] bg-blue-500 text-white rounded py-0.5 hover:bg-blue-600">
                            {saving ? "..." : "Save"}
                          </button>
                          <button onClick={() => deletePayment(e.payment!.id)} disabled={saving}
                            className="text-[9px] bg-red-500 text-white rounded py-0.5 px-1 hover:bg-red-600"
                            title="Delete this payment">
                            ✕
                          </button>
                          <button onClick={() => setEditing(null)}
                            className="flex-1 text-[9px] bg-gray-300 text-gray-700 rounded py-0.5 hover:bg-gray-400">
                            Esc
                          </button>
                        </div>
                      </div>
                    ) : isAdding ? (
                      <div className="mt-0.5" onClick={(ev) => ev.stopPropagation()}>
                        <input
                          type="number"
                          className="w-full text-[10px] border border-green-400 rounded px-1 py-0.5 text-center"
                          value={addAmount}
                          onChange={(ev) => setAddAmount(ev.target.value)}
                          onKeyDown={(ev) => {
                            if (ev.key === "Enter") addPayment(e);
                            if (ev.key === "Escape") setAdding(null);
                          }}
                          autoFocus
                        />
                        <div className="flex gap-0.5 mt-0.5">
                          <button onClick={() => addPayment(e)} disabled={saving}
                            className="flex-1 text-[9px] bg-green-500 text-white rounded py-0.5 hover:bg-green-600">
                            {saving ? "..." : "Add"}
                          </button>
                          <button onClick={() => setAdding(null)}
                            className="flex-1 text-[9px] bg-gray-300 text-gray-700 rounded py-0.5 hover:bg-gray-400">
                            Esc
                          </button>
                        </div>
                      </div>
                    ) : e.payment ? (
                      <p className="text-xs font-medium mt-0.5">{formatCurrency(Number(e.payment.amount))}</p>
                    ) : null}
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
