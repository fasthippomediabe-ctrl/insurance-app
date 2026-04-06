"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function MemberEditRequestActions({ requestId, isDelete }: { requestId: string; isDelete: boolean }) {
  const router = useRouter();
  const [loading, setLoading] = useState<"approve" | "reject" | null>(null);
  const [showReject, setShowReject] = useState(false);
  const [rejectNote, setRejectNote] = useState("");
  const [showApprove, setShowApprove] = useState(false);
  const [approveNote, setApproveNote] = useState("");
  const [error, setError] = useState("");

  async function submit(action: string, note?: string) {
    setLoading(action as any);
    setError("");
    try {
      const res = await fetch("/api/members/edit-requests", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requestId, action: action === "approve" ? "APPROVE" : "REJECT", reviewNote: note }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? "Failed.");
      }
      router.refresh();
    } catch (err: any) {
      setError(err.message);
      setLoading(null);
    }
  }

  return (
    <div className="space-y-3">
      {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-3 py-2 rounded-lg">{error}</div>}

      {!showApprove && !showReject && (
        <div className="flex gap-3">
          <button onClick={() => setShowApprove(true)}
            className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-semibold rounded-lg">
            Approve
          </button>
          <button onClick={() => setShowReject(true)}
            className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-semibold rounded-lg">
            Reject
          </button>
        </div>
      )}

      {showApprove && (
        <div className={`${isDelete ? "bg-red-50 border-red-200" : "bg-green-50 border-green-200"} border rounded-lg p-4 space-y-3`}>
          <p className={`text-sm font-medium ${isDelete ? "text-red-800" : "text-green-800"}`}>
            {isDelete ? "Approve DELETE? This will permanently remove the member and all their records." : "Approve this edit? Changes will be applied immediately."}
          </p>
          <textarea rows={2} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" placeholder="Optional note..."
            value={approveNote} onChange={(e) => setApproveNote(e.target.value)} />
          <div className="flex gap-2">
            <button onClick={() => submit("approve", approveNote || undefined)} disabled={loading === "approve"}
              className={`px-4 py-2 ${isDelete ? "bg-red-600 hover:bg-red-700" : "bg-green-600 hover:bg-green-700"} disabled:opacity-50 text-white text-sm font-semibold rounded-lg`}>
              {loading === "approve" ? "Processing..." : isDelete ? "Confirm Delete" : "Confirm Approve"}
            </button>
            <button onClick={() => setShowApprove(false)} className="px-4 py-2 border border-gray-300 text-gray-600 text-sm rounded-lg hover:bg-gray-50">Cancel</button>
          </div>
        </div>
      )}

      {showReject && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 space-y-3">
          <p className="text-sm font-medium text-red-800">Reject this request?</p>
          <textarea rows={2} className="w-full border border-red-300 rounded-lg px-3 py-2 text-sm" placeholder="Reason (optional)..."
            value={rejectNote} onChange={(e) => setRejectNote(e.target.value)} />
          <div className="flex gap-2">
            <button onClick={() => submit("reject", rejectNote || undefined)} disabled={loading === "reject"}
              className="px-4 py-2 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white text-sm font-semibold rounded-lg">
              {loading === "reject" ? "Rejecting..." : "Confirm Reject"}
            </button>
            <button onClick={() => setShowReject(false)} className="px-4 py-2 border border-gray-300 text-gray-600 text-sm rounded-lg hover:bg-gray-50">Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
}
