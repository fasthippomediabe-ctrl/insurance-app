"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function DeleteMemberButton({ memberId, memberName, hasPayments, requiresApproval }: {
  memberId: string;
  memberName: string;
  hasPayments: boolean;
  requiresApproval?: boolean;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [showReason, setShowReason] = useState(false);
  const [reason, setReason] = useState("");

  async function handleDelete() {
    if (requiresApproval) {
      setShowReason(true);
      return;
    }

    const msg = hasPayments
      ? `Delete ${memberName}? This will also delete all their payment records. This cannot be undone.`
      : `Delete ${memberName}? This cannot be undone.`;
    if (!confirm(msg)) return;

    setLoading(true);
    try {
      const res = await fetch(`/api/members/${memberId}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json();
        alert(data.error ?? "Failed to delete");
        return;
      }
      router.push("/members");
    } catch {
      alert("Failed to delete member");
    } finally {
      setLoading(false);
    }
  }

  async function submitRequest() {
    if (!reason.trim()) { alert("Please provide a reason."); return; }
    setLoading(true);
    try {
      const res = await fetch("/api/members/edit-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ memberId, requestType: "DELETE", reason: reason.trim() }),
      });
      if (!res.ok) {
        const data = await res.json();
        alert(data.error ?? "Failed to submit request");
        return;
      }
      alert("Delete request submitted for admin approval.");
      setShowReason(false);
      router.refresh();
    } catch {
      alert("Failed to submit request");
    } finally {
      setLoading(false);
    }
  }

  if (showReason) {
    return (
      <div className="flex items-center gap-2">
        <input type="text" value={reason} onChange={(e) => setReason(e.target.value)}
          placeholder="Reason for deletion"
          className="border border-red-300 rounded-lg px-3 py-2 text-sm w-56 focus:outline-none focus:ring-2 focus:ring-red-400" />
        <button onClick={submitRequest} disabled={loading}
          className="px-3 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-medium disabled:opacity-50">
          {loading ? "..." : "Submit"}
        </button>
        <button onClick={() => setShowReason(false)}
          className="px-3 py-2 border border-gray-300 text-gray-500 rounded-lg text-sm hover:bg-gray-50">
          Cancel
        </button>
      </div>
    );
  }

  return (
    <button onClick={handleDelete} disabled={loading}
      className="px-4 py-2 border border-red-300 text-red-600 rounded-lg text-sm font-medium hover:bg-red-50 disabled:opacity-50">
      {loading ? "..." : requiresApproval ? "Request Delete" : "Delete"}
    </button>
  );
}
