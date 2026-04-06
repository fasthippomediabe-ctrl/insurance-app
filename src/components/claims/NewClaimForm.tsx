"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface Beneficiary { id: string; firstName: string; lastName: string; relationship: string }
interface Member { id: string; mafNo: string; firstName: string; lastName: string; planCategory: string; beneficiaries: Beneficiary[] }

export default function NewClaimForm({ members }: { members: Member[] }) {
  const router = useRouter();
  const [memberId, setMemberId] = useState("");
  const [deceasedType, setDeceasedType] = useState<"MEMBER" | "BENEFICIARY">("MEMBER");
  const [deceasedName, setDeceasedName] = useState("");
  const [dateOfDeath, setDateOfDeath] = useState("");
  const [causeOfDeath, setCauseOfDeath] = useState("");
  const [claimantName, setClaimantName] = useState("");
  const [claimantRelationship, setClaimantRelationship] = useState("");
  const [claimantContact, setClaimantContact] = useState("");
  const [claimantAddress, setClaimantAddress] = useState("");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const selectedMember = members.find((m) => m.id === memberId);

  function handleMemberChange(id: string) {
    setMemberId(id);
    const m = members.find((x) => x.id === id);
    if (m && deceasedType === "MEMBER") {
      setDeceasedName(`${m.firstName} ${m.lastName}`);
    }
  }

  function handleDeceasedTypeChange(type: "MEMBER" | "BENEFICIARY") {
    setDeceasedType(type);
    if (type === "MEMBER" && selectedMember) {
      setDeceasedName(`${selectedMember.firstName} ${selectedMember.lastName}`);
    } else {
      setDeceasedName("");
    }
  }

  function selectBeneficiaryAsClaimant(ben: Beneficiary) {
    setClaimantName(`${ben.firstName} ${ben.lastName}`);
    setClaimantRelationship(ben.relationship);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!memberId || !deceasedName || !claimantName || !dateOfDeath) {
      setError("Please fill in all required fields.");
      return;
    }

    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/claims", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          memberId, deceasedType, deceasedName, dateOfDeath, causeOfDeath,
          claimantName, claimantRelationship, claimantContact, claimantAddress, notes,
        }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "Failed");
      const claim = await res.json();
      router.push(`/claims/${claim.id}`);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">{error}</div>}

      {/* Select Member */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Member Account</h2>
        <select className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" value={memberId} onChange={(e) => handleMemberChange(e.target.value)} required>
          <option value="">Select member...</option>
          {members.map((m) => (
            <option key={m.id} value={m.id}>{m.mafNo} — {m.firstName} {m.lastName} ({m.planCategory})</option>
          ))}
        </select>
        {selectedMember && (
          <div className="mt-3 text-sm text-gray-600">
            Plan: <strong>{selectedMember.planCategory}</strong> · Beneficiaries: <strong>{selectedMember.beneficiaries.length}</strong>
          </div>
        )}
      </div>

      {/* Deceased Info */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Deceased Information</h2>
        <div className="flex gap-4 mb-4">
          <label className={`cursor-pointer flex-1 rounded-xl border-2 p-3 text-center text-sm font-medium transition-all ${
            deceasedType === "MEMBER" ? "border-red-500 bg-red-50 text-red-700" : "border-gray-200 text-gray-500"
          }`}>
            <input type="radio" name="deceasedType" value="MEMBER" checked={deceasedType === "MEMBER"}
              onChange={() => handleDeceasedTypeChange("MEMBER")} className="sr-only" />
            Member (Plan Holder)
          </label>
          <label className={`cursor-pointer flex-1 rounded-xl border-2 p-3 text-center text-sm font-medium transition-all ${
            deceasedType === "BENEFICIARY" ? "border-red-500 bg-red-50 text-red-700" : "border-gray-200 text-gray-500"
          }`}>
            <input type="radio" name="deceasedType" value="BENEFICIARY" checked={deceasedType === "BENEFICIARY"}
              onChange={() => handleDeceasedTypeChange("BENEFICIARY")} className="sr-only" />
            Beneficiary
          </label>
        </div>

        {deceasedType === "BENEFICIARY" && selectedMember && selectedMember.beneficiaries.length > 0 && (
          <div className="mb-3">
            <p className="text-xs text-gray-500 mb-2">Select beneficiary:</p>
            <div className="flex flex-wrap gap-2">
              {selectedMember.beneficiaries.map((b) => (
                <button key={b.id} type="button"
                  onClick={() => setDeceasedName(`${b.firstName} ${b.lastName}`)}
                  className={`text-xs px-3 py-1.5 rounded-lg border ${
                    deceasedName === `${b.firstName} ${b.lastName}` ? "bg-red-100 border-red-300 text-red-700" : "border-gray-200 text-gray-600 hover:bg-gray-50"
                  }`}>
                  {b.firstName} {b.lastName} ({b.relationship})
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <label className="block text-xs font-medium text-gray-500 mb-1">Deceased Full Name *</label>
            <input className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" value={deceasedName}
              onChange={(e) => setDeceasedName(e.target.value)} required />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Date of Death *</label>
            <input type="date" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" value={dateOfDeath}
              onChange={(e) => setDateOfDeath(e.target.value)} required />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Cause of Death</label>
            <input className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" value={causeOfDeath}
              onChange={(e) => setCauseOfDeath(e.target.value)} placeholder="Optional" />
          </div>
        </div>
      </div>

      {/* Claimant Info */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Claimant (Who Receives Payment)</h2>
        {selectedMember && selectedMember.beneficiaries.length > 0 && (
          <div className="mb-3">
            <p className="text-xs text-gray-500 mb-2">Quick select from beneficiaries:</p>
            <div className="flex flex-wrap gap-2">
              {selectedMember.beneficiaries.map((b) => (
                <button key={b.id} type="button" onClick={() => selectBeneficiaryAsClaimant(b)}
                  className={`text-xs px-3 py-1.5 rounded-lg border ${
                    claimantName === `${b.firstName} ${b.lastName}` ? "bg-blue-100 border-blue-300 text-blue-700" : "border-gray-200 text-gray-600 hover:bg-gray-50"
                  }`}>
                  {b.firstName} {b.lastName} ({b.relationship})
                </button>
              ))}
            </div>
          </div>
        )}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Claimant Full Name *</label>
            <input className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" value={claimantName}
              onChange={(e) => setClaimantName(e.target.value)} required />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Relationship to Deceased</label>
            <input className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" value={claimantRelationship}
              onChange={(e) => setClaimantRelationship(e.target.value)} placeholder="e.g. Spouse, Child" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Contact Number</label>
            <input className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" value={claimantContact}
              onChange={(e) => setClaimantContact(e.target.value)} />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Address</label>
            <input className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" value={claimantAddress}
              onChange={(e) => setClaimantAddress(e.target.value)} />
          </div>
        </div>
      </div>

      {/* Notes */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
        <label className="block text-xs font-medium text-gray-500 mb-1">Notes</label>
        <textarea rows={3} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm resize-none"
          value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Additional notes..." />
      </div>

      <div className="flex items-center justify-between">
        <button type="button" onClick={() => router.back()} className="text-sm text-gray-500 hover:text-gray-700">Cancel</button>
        <button type="submit" disabled={loading}
          className="px-6 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-semibold disabled:opacity-50">
          {loading ? "Filing..." : "File Claim & Issue Stub"}
        </button>
      </div>
    </form>
  );
}
