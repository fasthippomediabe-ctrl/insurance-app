"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { formatCurrency, formatDate, MONTHS } from "@/lib/utils";
import EditPaymentModal from "./EditPaymentModal";

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
  memberId: string;
  member: { mafNo: string; firstName: string; lastName: string };
  collector: { firstName: string; lastName: string } | null;
}

export default function PaymentsTable({
  payments,
  collectors,
  isAdmin,
}: {
  payments: Payment[];
  collectors: Collector[];
  isAdmin: boolean;
}) {
  const router = useRouter();
  const [editingPayment, setEditingPayment] = useState<Payment | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  async function handleDelete(id: string) {
    if (!confirm("Delete this payment? This cannot be undone.")) return;
    setDeletingId(id);
    try {
      const res = await fetch(`/api/payments/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const err = await res.json();
        alert(err.error ?? "Failed to delete.");
      } else {
        router.refresh();
      }
    } catch {
      alert("Failed to delete.");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
            <tr>
              <th className="px-4 py-3 text-left">MAF No.</th>
              <th className="px-4 py-3 text-left">Member</th>
              <th className="px-4 py-3 text-center">Period</th>
              <th className="px-4 py-3 text-center">Installment</th>
              <th className="px-4 py-3 text-left">Date Paid</th>
              <th className="px-4 py-3 text-right">Amount</th>
              <th className="px-4 py-3 text-left">Collector</th>
              <th className="px-4 py-3 text-center">Type</th>
              <th className="px-4 py-3 w-16"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {payments.map((p) => (
              <tr key={p.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-mono text-gray-600">{p.member.mafNo}</td>
                <td className="px-4 py-3 font-medium text-gray-900">
                  <Link href={`/members/${p.memberId}`} className="hover:text-blue-600">
                    {p.member.firstName} {p.member.lastName}
                  </Link>
                </td>
                <td className="px-4 py-3 text-center text-gray-500">
                  {MONTHS[p.periodMonth - 1].slice(0, 3)} {p.periodYear}
                </td>
                <td className="px-4 py-3 text-center text-gray-500">#{p.installmentNo}</td>
                <td className="px-4 py-3 text-gray-500">{formatDate(p.paymentDate)}</td>
                <td className="px-4 py-3 text-right font-semibold">{formatCurrency(Number(p.amount))}</td>
                <td className="px-4 py-3 text-gray-500">
                  {p.collector ? `${p.collector.firstName} ${p.collector.lastName}` : "Walk-in"}
                </td>
                <td className="px-4 py-3 text-center">
                  {p.isFree && <span className="bg-blue-100 text-blue-700 text-xs px-2 py-0.5 rounded-full">FREE</span>}
                  {p.isSpotCash && <span className="bg-purple-100 text-purple-700 text-xs px-2 py-0.5 rounded-full">SPOT CASH</span>}
                  {!p.isFree && !p.isSpotCash && <span className="text-gray-400 text-xs">Regular</span>}
                </td>
                <td className="px-4 py-3 text-center">
                  <div className="flex items-center justify-center gap-1">
                    <button
                      onClick={() => setEditingPayment(p)}
                      className="text-xs text-blue-600 hover:text-blue-800 font-medium px-2 py-1 rounded hover:bg-blue-50"
                    >
                      Edit
                    </button>
                    {isAdmin && (
                      <button
                        onClick={() => handleDelete(p.id)}
                        disabled={deletingId === p.id}
                        className="text-xs text-red-500 hover:text-red-700 font-medium px-2 py-1 rounded hover:bg-red-50 disabled:opacity-50"
                      >
                        {deletingId === p.id ? "..." : "Delete"}
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {payments.length === 0 && (
              <tr>
                <td colSpan={9} className="px-4 py-10 text-center text-gray-400">No payments found.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {editingPayment && (
        <EditPaymentModal
          payment={editingPayment}
          collectors={collectors}
          onClose={() => setEditingPayment(null)}
        />
      )}
    </>
  );
}
