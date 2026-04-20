"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Mode = "CLAIM_RELEASED" | "NO_CLAIM_BALANCE_PAID";

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
  const [mode, setMode] = useState<Mode>("CLAIM_RELEASED");
  const [form, setForm] = useState({
    deceasedType: "MEMBER",
    deceasedName: memberName,
    dateOfDeath: today,
    dateReleased: today,
    releasedAmount: "",
    balancePaid: "",
    serviceDate: today,
    claimantName: "",
    claimantRelationship: "",
    reasonNotEligible: "",
    notes: "Legacy record — migrated from old system",
  });

  function set(k: string, v: string) { setForm((p) => ({ ...p, [k]: v })); }

  async function submit() {
    if (!form.deceasedName || !form.dateOfDeath || !form.claimantName) {
      setError("Deceased name, date of death, and claimant/family contact name are required.");
      return;
    }
    setLoading(true); setError("");
    try {
      // Create the claim
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
      if (!createRes.ok) throw new Error((await createRes.json()).error ?? "Failed to create record");
      const claim = await createRes.json();

      if (mode === "CLAIM_RELEASED") {
        // Mark as RELEASED with the amount paid out
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
      } else {
        // NO_CLAIM_BALANCE_PAID — mark as REJECTED with reason, amount tracked in notes
        const paid = parseFloat(form.balancePaid) || 0;
        const reason = form.reasonNotEligible || "Not eligible for claim";
        const fullNote = `${reason}. Family paid ₱${paid.toLocaleString()} for funeral service on ${form.serviceDate}.`;

        const rejectRes = await fetch("/api/claims", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: claim.id,
            status: "REJECTED",
            rejectionReason: reason,
            statusNote: fullNote,
            notes: `${form.notes}\n\nService rendered — balance/service fee of ₱${paid.toLocaleString()} collected from family on ${form.serviceDate}.`,
          }),
        });
        if (!rejectRes.ok) throw new Error((await rejectRes.json()).error ?? "Failed to mark served");
      }

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
        Flag Deceased (Legacy)
      </button>

      {open && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setOpen(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="px-6 pt-6 pb-4 border-b">
              <h2 className="text-lg font-bold text-gray-900">Flag Member as Deceased (Legacy)</h2>
              <p className="text-xs text-gray-500 mt-1">
                For historical records. Bypasses the full claim workflow.
              </p>
            </div>

            <div className="px-6 py-5 space-y-4">
              {error && <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded text-sm">{error}</div>}

              {/* Mode Selector */}
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-2">What happened?</label>
                <div className="grid grid-cols-1 gap-2">
                  <label className={`cursor-pointer rounded-lg border-2 p-3 transition-all ${
                    mode === "CLAIM_RELEASED" ? "border-green-500 bg-green-50" : "border-gray-200"
                  }`}>
                    <input type="radio" name="mode" checked={mode === "CLAIM_RELEASED"}
                      onChange={() => setMode("CLAIM_RELEASED")} className="sr-only" />
                    <p className="font-bold text-sm text-gray-900">Claim Was Released ✓</p>
                    <p className="text-xs text-gray-500">Member was eligible — insurance claim paid out to beneficiary</p>
                  </label>
                  <label className={`cursor-pointer rounded-lg border-2 p-3 transition-all ${
                    mode === "NO_CLAIM_BALANCE_PAID" ? "border-amber-500 bg-amber-50" : "border-gray-200"
                  }`}>
                    <input type="radio" name="mode" checked={mode === "NO_CLAIM_BALANCE_PAID"}
                      onChange={() => setMode("NO_CLAIM_BALANCE_PAID")} className="sr-only" />
                    <p className="font-bold text-sm text-gray-900">No Claim — Family Paid for Service ⚠</p>
                    <p className="text-xs text-gray-500">Not eligible (lapsed / contestability / Cherry plan) — family paid balance or service fee</p>
                  </label>
                </div>
              </div>

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

              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Date of Death *</label>
                <input type="date" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                  value={form.dateOfDeath} onChange={(e) => set("dateOfDeath", e.target.value)} />
              </div>

              {/* Mode-specific fields */}
              {mode === "CLAIM_RELEASED" ? (
                <div className="bg-green-50 border border-green-200 rounded-lg p-3 space-y-3">
                  <p className="text-xs font-bold text-green-800">Claim Details</p>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">Date Released</label>
                      <input type="date" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                        value={form.dateReleased} onChange={(e) => set("dateReleased", e.target.value)} />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">Amount Released</label>
                      <input type="number" step="0.01" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                        value={form.releasedAmount} onChange={(e) => set("releasedAmount", e.target.value)} />
                    </div>
                  </div>
                </div>
              ) : (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 space-y-3">
                  <p className="text-xs font-bold text-amber-800">Service Details (No Claim)</p>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Why Not Eligible?</label>
                    <select className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                      value={form.reasonNotEligible} onChange={(e) => set("reasonNotEligible", e.target.value)}>
                      <option value="">Select reason</option>
                      <option value="Member was LAPSED at time of death">Member was LAPSED</option>
                      <option value="Within contestability period (less than 8 months)">Within contestability period (natural death)</option>
                      <option value="Suicide within 2-year contestability">Suicide within 2-year contestability</option>
                      <option value="Cherry plan (senior citizen, not claimable)">Cherry plan (not claimable)</option>
                      <option value="Rosewood beneficiary (only member insured)">Rosewood beneficiary (only member insured)</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">Service Date</label>
                      <input type="date" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                        value={form.serviceDate} onChange={(e) => set("serviceDate", e.target.value)} />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">Amount Family Paid</label>
                      <input type="number" step="0.01" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                        value={form.balancePaid} onChange={(e) => set("balancePaid", e.target.value)}
                        placeholder="Balance or service fee" />
                    </div>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">
                    {mode === "CLAIM_RELEASED" ? "Claimant Name *" : "Family Contact Name *"}
                  </label>
                  <input className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                    value={form.claimantName} onChange={(e) => set("claimantName", e.target.value)}
                    placeholder={mode === "CLAIM_RELEASED" ? "Who received it" : "Who arranged the service"} />
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
                  className={`flex-1 px-4 py-2.5 text-white rounded-lg text-sm font-semibold disabled:opacity-50 ${
                    mode === "CLAIM_RELEASED" ? "bg-green-600 hover:bg-green-700" : "bg-amber-600 hover:bg-amber-700"
                  }`}>
                  {loading ? "Saving..." : mode === "CLAIM_RELEASED" ? "Flag as Claimed" : "Flag as Served"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
