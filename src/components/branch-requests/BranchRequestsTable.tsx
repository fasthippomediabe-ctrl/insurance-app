"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { formatCurrency } from "@/lib/utils";

interface Request {
  id: string; requestNo: string; type: string; branchName: string;
  title: string; description: string; amount: number;
  dueDate: string | null; vendor: string | null; attachments: string | null;
  status: string; reviewNote: string | null;
  createdAt: string; reviewedAt: string | null; releasedAt: string | null;
}

const TYPE_LABELS: Record<string, { label: string; color: string }> = {
  PAYMENT: { label: "Payment", color: "bg-blue-100 text-blue-700" },
  EXPENSE: { label: "Expense", color: "bg-purple-100 text-purple-700" },
  LIABILITY: { label: "Liability", color: "bg-red-100 text-red-700" },
};

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  PENDING: { label: "Pending", color: "bg-yellow-100 text-yellow-700" },
  APPROVED: { label: "Approved", color: "bg-blue-100 text-blue-700" },
  REJECTED: { label: "Rejected", color: "bg-red-100 text-red-700" },
  RELEASED: { label: "Released", color: "bg-green-100 text-green-700" },
};

export default function BranchRequestsTable({
  requests, role, currentUserId,
}: {
  requests: Request[]; role: string; currentUserId: string;
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<Request | null>(null);
  const [reviewNote, setReviewNote] = useState("");
  const [loading, setLoading] = useState(false);

  const canReview = role === "ADMIN" || role === "ACCOUNTING";

  async function updateStatus(id: string, status: string) {
    setLoading(true);
    try {
      const res = await fetch("/api/branch-requests", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status, reviewNote: reviewNote || undefined }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "Failed");
      setSelected(null);
      setReviewNote("");
      router.refresh();
    } catch (e: any) {
      alert("Error: " + e.message);
    } finally {
      setLoading(false);
    }
  }

  async function deleteRequest(id: string) {
    if (!confirm("Delete this request?")) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/branch-requests?id=${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error((await res.json()).error ?? "Failed");
      setSelected(null);
      router.refresh();
    } catch (e: any) {
      alert("Error: " + e.message);
    } finally {
      setLoading(false);
    }
  }

  const fmtDate = (d: string | null) => d ? new Date(d).toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" }) : "—";

  return (
    <>
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
              <tr>
                <th className="px-4 py-2.5 text-left">Request No</th>
                <th className="px-4 py-2.5 text-center">Type</th>
                <th className="px-4 py-2.5 text-left">Branch</th>
                <th className="px-4 py-2.5 text-left">Title</th>
                <th className="px-4 py-2.5 text-right">Amount</th>
                <th className="px-4 py-2.5 text-left">Due</th>
                <th className="px-4 py-2.5 text-center">Status</th>
                <th className="px-4 py-2.5 text-center">Created</th>
                <th className="px-4 py-2.5 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {requests.map((r) => {
                const typ = TYPE_LABELS[r.type] ?? { label: r.type, color: "bg-gray-100" };
                const st = STATUS_LABELS[r.status] ?? { label: r.status, color: "bg-gray-100" };
                return (
                  <tr key={r.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-mono text-xs text-gray-600">{r.requestNo}</td>
                    <td className="px-4 py-3 text-center">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${typ.color}`}>{typ.label}</span>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500">{r.branchName}</td>
                    <td className="px-4 py-3 font-medium text-gray-800">{r.title}</td>
                    <td className="px-4 py-3 text-right font-semibold">{formatCurrency(r.amount)}</td>
                    <td className="px-4 py-3 text-xs text-gray-500">{fmtDate(r.dueDate)}</td>
                    <td className="px-4 py-3 text-center">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${st.color}`}>{st.label}</span>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500 text-center">{fmtDate(r.createdAt)}</td>
                    <td className="px-4 py-3 text-center">
                      <button onClick={() => { setSelected(r); setReviewNote(r.reviewNote ?? ""); }}
                        className="text-purple-600 hover:underline text-xs font-medium">View</button>
                    </td>
                  </tr>
                );
              })}
              {requests.length === 0 && (
                <tr><td colSpan={9} className="px-4 py-8 text-center text-gray-400">No requests yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Detail Modal */}
      {selected && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setSelected(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="px-6 pt-6 pb-4 border-b flex items-start justify-between">
              <div>
                <h2 className="text-lg font-bold text-gray-900">{selected.title}</h2>
                <p className="text-xs text-gray-500 mt-0.5">{selected.requestNo} · {selected.branchName}</p>
              </div>
              <button onClick={() => setSelected(null)} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
            </div>

            <div className="px-6 py-5 space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-xs text-gray-400">Type</p>
                  <p className="font-bold">{TYPE_LABELS[selected.type]?.label ?? selected.type}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-400">Amount</p>
                  <p className="font-bold text-green-700">{formatCurrency(selected.amount)}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-400">Status</p>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${STATUS_LABELS[selected.status]?.color ?? "bg-gray-100"}`}>
                    {STATUS_LABELS[selected.status]?.label ?? selected.status}
                  </span>
                </div>
                <div>
                  <p className="text-xs text-gray-400">Due Date</p>
                  <p className="font-bold">{fmtDate(selected.dueDate)}</p>
                </div>
                {selected.vendor && (
                  <div className="col-span-2">
                    <p className="text-xs text-gray-400">Vendor / Payee</p>
                    <p className="font-bold">{selected.vendor}</p>
                  </div>
                )}
              </div>

              <div>
                <p className="text-xs text-gray-400 mb-1">Description</p>
                <p className="text-sm bg-gray-50 rounded-lg p-3 whitespace-pre-wrap">{selected.description}</p>
              </div>

              {selected.attachments && (
                <div>
                  <p className="text-xs text-gray-400 mb-1">Attachment</p>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={selected.attachments} alt="Attachment" className="max-w-full rounded-lg border" />
                </div>
              )}

              {selected.reviewNote && (
                <div>
                  <p className="text-xs text-gray-400 mb-1">Review Note</p>
                  <p className="text-sm bg-blue-50 border border-blue-200 rounded-lg p-3">{selected.reviewNote}</p>
                </div>
              )}

              {/* Admin/Accounting actions */}
              {canReview && selected.status !== "RELEASED" && selected.status !== "REJECTED" && (
                <div className="border-t pt-4">
                  <label className="block text-xs font-medium text-gray-500 mb-1">Review Note (optional)</label>
                  <textarea className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm resize-none" rows={2}
                    value={reviewNote} onChange={(e) => setReviewNote(e.target.value)} />

                  <div className="flex gap-2 mt-3 flex-wrap">
                    {selected.status === "PENDING" && (
                      <>
                        <button onClick={() => updateStatus(selected.id, "APPROVED")} disabled={loading}
                          className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-semibold px-4 py-2 rounded-lg">
                          Approve
                        </button>
                        <button onClick={() => updateStatus(selected.id, "REJECTED")} disabled={loading}
                          className="bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white text-xs font-semibold px-4 py-2 rounded-lg">
                          Reject
                        </button>
                      </>
                    )}
                    {selected.status === "APPROVED" && (
                      <button onClick={() => updateStatus(selected.id, "RELEASED")} disabled={loading}
                        className="bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white text-xs font-semibold px-4 py-2 rounded-lg">
                        Mark as Released
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* Branch staff delete (only for their pending) */}
              {role === "BRANCH_STAFF" && selected.status === "PENDING" && (
                <div className="border-t pt-4">
                  <button onClick={() => deleteRequest(selected.id)} disabled={loading}
                    className="text-red-500 hover:text-red-700 text-xs font-semibold">
                    Cancel / Delete Request
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
