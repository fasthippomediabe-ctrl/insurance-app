"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function MarkLegacyClaimButton({
  memberId, memberName, planCategory,
}: {
  memberId: string; memberName: string; planCategory: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const today = new Date().toISOString().split("T")[0];
  const [form, setForm] = useState({
    deceasedType: "MEMBER",
    deceasedName: memberName,
    dateOfDeath: today,
    dateReleased: today,
    releasedAmount: "",
    claimantName: "",
    claimantRelationship: "",
    notes: "Legacy claim — migrated from old system",
  });

  function set(k: string, v: string) { setForm((p) => ({ ...p, [k]: v })); }

  async function submit() {
    if (!form.deceasedName || !form.dateOfDeath || !form.claimantName) {
      setError("Deceased name, date of death, and claimant name are required.");
      return;
    }
    setLoading(true); setError("");
    try {
      // Create the claim (PENDING by default)
      const createRes = await fetch("/api/claims", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          memberId,
          deceasedType: form.deceasedType,
          deceasedName: form.deceasedName,
          dateOfDeath: form.dateOfDeath,
          claimantName: form.claimantName,
          claimantRelationship: form.claimantRelationship,
          notes: form.notes,
        }),
      });
      if (!createRes.ok) throw new Error((await createRes.json()).error ?? "Failed to create claim");
      const claim = await createRes.json();

      // Immediately mark as RELEASED with amount
      const amount = parseFloat(form.releasedAmount) || 0;
      const releaseRes = await fetch("/api/claims", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: claim.id,
          status: "RELEASED",
          approvedAmount: amount,
          releasedAmount: amount,
          dateReleased: form.dateReleased,
          statusNote: "Legacy — already released in old system",
        }),
      });
      if (!releaseRes.ok) throw new Error((await releaseRes.json()).error ?? "Failed to mark released");

      setOpen(false);
      router.refresh();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <button onClick={() => setOpen(true)}
        className="px-4 py-2 bg-gray-700 hover:bg-gray-800 text-white rounded-lg text-sm font-medium">
        Flag as Claimed (Legacy)
      </button>

      {open && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setOpen(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="px-6 pt-6 pb-4 border-b">
              <h2 className="text-lg font-bold text-gray-900">Flag as Claimed (Legacy)</h2>
              <p className="text-xs text-gray-500 mt-1">
                For historical records — creates a RELEASED claim directly without the full workflow.
                Member will be marked as DECEASED_CLAIMANT.
              </p>
            </div>

            <div className="px-6 py-5 space-y-4">
              {error && <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded text-sm">{error}</div>}

              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Who Died?</label>
                <div className="grid grid-cols-2 gap-2">
                  <label className={`cursor-pointer rounded-lg border-2 p-2 text-center text-xs font-medium ${
                    form.deceasedType === "MEMBER" ? "border-red-500 bg-red-50 text-red-700" : "border-gray-200 text-gray-500"
                  }`}>
                    <input type="radio" name="dt" checked={form.deceasedType === "MEMBER"}
                      onChange={() => { set("deceasedType", "MEMBER"); set("deceasedName", memberName); }} className="sr-only" />
                    Member (Plan Holder)
                  </label>
                  <label className={`cursor-pointer rounded-lg border-2 p-2 text-center text-xs font-medium ${
                    form.deceasedType === "BENEFICIARY" ? "border-red-500 bg-red-50 text-red-700" : "border-gray-200 text-gray-500"
                  }`}>
                    <input type="radio" name="dt" checked={form.deceasedType === "BENEFICIARY"}
                      onChange={() => { set("deceasedType", "BENEFICIARY"); set("deceasedName", ""); }} className="sr-only" />
                    Beneficiary
                  </label>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Deceased Name *</label>
                <input className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                  value={form.deceasedName} onChange={(e) => set("deceasedName", e.target.value)} />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Date of Death *</label>
                  <input type="date" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                    value={form.dateOfDeath} onChange={(e) => set("dateOfDeath", e.target.value)} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Date Released *</label>
                  <input type="date" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                    value={form.dateReleased} onChange={(e) => set("dateReleased", e.target.value)} />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Amount Released</label>
                <input type="number" step="0.01" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                  value={form.releasedAmount} onChange={(e) => set("releasedAmount", e.target.value)}
                  placeholder="Optional — enter the amount that was paid out" />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Claimant Name *</label>
                  <input className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                    value={form.claimantName} onChange={(e) => set("claimantName", e.target.value)} placeholder="Who received it" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Relationship</label>
                  <input className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                    value={form.claimantRelationship} onChange={(e) => set("claimantRelationship", e.target.value)}
                    placeholder="e.g. Spouse, Child, Self" />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Notes</label>
                <textarea rows={2} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm resize-none"
                  value={form.notes} onChange={(e) => set("notes", e.target.value)} />
              </div>

              <div className="flex gap-3 pt-2 border-t">
                <button onClick={() => setOpen(false)}
                  className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg text-sm text-gray-600 hover:bg-gray-50">Cancel</button>
                <button onClick={submit} disabled={loading}
                  className="flex-1 px-4 py-2.5 bg-gray-700 hover:bg-gray-800 disabled:opacity-50 text-white rounded-lg text-sm font-semibold">
                  {loading ? "Saving..." : "Flag as Claimed"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
