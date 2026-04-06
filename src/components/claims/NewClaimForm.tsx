"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { formatCurrency } from "@/lib/utils";

interface Beneficiary { id: string; firstName: string; lastName: string; relationship: string }
interface Member {
  id: string; mafNo: string; firstName: string; lastName: string; planCategory: string;
  status: string; enrollmentDate: string; reinstatedDate: string | null; effectivityDate: string | null;
  beneficiaries: Beneficiary[];
}

const CONTESTABILITY_MONTHS = 8;
const SUICIDE_CONTESTABILITY_MONTHS = 24;
const SPOT_SERVICE_DEFAULT = 30000;
const CLAIMABLE_PLANS = ["EUCALYPTUS", "ROSEWOOD", "CONIFER"];

function checkEligibility(
  member: Member,
  deceasedType: string,
  deathType: string,
  dateOfDeath: string,
): { eligible: boolean; reason: string } {
  // Cherry plan = no claims (senior citizen plan)
  if (!CLAIMABLE_PLANS.includes(member.planCategory)) {
    return { eligible: false, reason: `${member.planCategory} plan is not claimable (senior citizen plan). Pay the remaining service balance instead.` };
  }

  // Rosewood = only member is insured, not beneficiaries
  if (member.planCategory === "ROSEWOOD" && deceasedType === "BENEFICIARY") {
    return { eligible: false, reason: "Rosewood plan: only the member (plan holder) is insured. Beneficiaries are not covered — they can only process the claim when the member dies." };
  }

  // Lapsed = must pay balance for service, not a claim
  if (member.status === "LAPSED") {
    return { eligible: false, reason: "Member is LAPSED. If they want service, they must pay the remaining contract balance. This is not a claim — use Spot Service instead." };
  }

  if (member.status === "DECEASED_CLAIMANT") {
    return { eligible: false, reason: "A claim has already been filed for this member." };
  }

  if (!["ACTIVE", "REINSTATED", "FULLY_PAID"].includes(member.status)) {
    return { eligible: false, reason: `Member status "${member.status}" is not eligible for claims.` };
  }

  if (!dateOfDeath) return { eligible: true, reason: "" };

  const death = new Date(dateOfDeath);
  const startDate = new Date(
    member.reinstatedDate ?? member.effectivityDate ?? member.enrollmentDate
  );

  // Calculate months between enrollment/reinstatement and death
  const monthsDiff = (death.getFullYear() - startDate.getFullYear()) * 12 + (death.getMonth() - startDate.getMonth());

  if (deceasedType === "BENEFICIARY") {
    // Beneficiary: 8 months contestability regardless of death type
    if (monthsDiff < CONTESTABILITY_MONTHS) {
      return {
        eligible: false,
        reason: `Beneficiary claim requires ${CONTESTABILITY_MONTHS} months from enrollment/reinstatement. Only ${monthsDiff} month(s) elapsed (enrolled ${startDate.toLocaleDateString("en-PH")}).`,
      };
    }
    return { eligible: true, reason: "" };
  }

  // Member death
  if (deathType === "ACCIDENT") {
    // No contestability for accidents
    return { eligible: true, reason: "Accidental death — no contestability period. Eligible." };
  }

  if (deathType === "SUICIDE") {
    if (monthsDiff < SUICIDE_CONTESTABILITY_MONTHS) {
      return {
        eligible: false,
        reason: `Suicide requires ${SUICIDE_CONTESTABILITY_MONTHS} months (2 years) contestability. Only ${monthsDiff} month(s) elapsed.`,
      };
    }
    return { eligible: true, reason: "" };
  }

  // Natural death (includes assassination, provocation)
  if (monthsDiff < CONTESTABILITY_MONTHS) {
    return {
      eligible: false,
      reason: `Natural death requires ${CONTESTABILITY_MONTHS} months contestability. Only ${monthsDiff} month(s) elapsed (enrolled ${startDate.toLocaleDateString("en-PH")}).`,
    };
  }

  return { eligible: true, reason: "" };
}

export default function NewClaimForm({ members }: { members: Member[] }) {
  const router = useRouter();
  const [mode, setMode] = useState<"MEMBER_CLAIM" | "SPOT_SERVICE">("MEMBER_CLAIM");
  const [memberId, setMemberId] = useState("");
  const [memberSearch, setMemberSearch] = useState("");
  const [showDropdown, setShowDropdown] = useState(false);
  const [deceasedType, setDeceasedType] = useState<"MEMBER" | "BENEFICIARY">("MEMBER");
  const [deathType, setDeathType] = useState<"NATURAL" | "ACCIDENT" | "SUICIDE">("NATURAL");
  const [deceasedName, setDeceasedName] = useState("");
  const [dateOfDeath, setDateOfDeath] = useState("");
  const [causeOfDeath, setCauseOfDeath] = useState("");
  const [claimantName, setClaimantName] = useState("");
  const [claimantRelationship, setClaimantRelationship] = useState("");
  const [claimantContact, setClaimantContact] = useState("");
  const [claimantAddress, setClaimantAddress] = useState("");
  const [notes, setNotes] = useState("");
  const [spotClientName, setSpotClientName] = useState("");
  const [spotClientContact, setSpotClientContact] = useState("");
  const [spotClientAddress, setSpotClientAddress] = useState("");
  const [spotAmount, setSpotAmount] = useState(String(SPOT_SERVICE_DEFAULT));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const selectedMember = members.find((m) => m.id === memberId);

  // Eligibility check
  const eligibility = selectedMember && dateOfDeath
    ? checkEligibility(selectedMember, deceasedType, deathType, dateOfDeath)
    : null;

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

    if (mode === "SPOT_SERVICE") {
      if (!spotClientName || !dateOfDeath) { setError("Please fill required fields."); return; }
    } else {
      if (!memberId || !deceasedName || !claimantName || !dateOfDeath) {
        setError("Please fill in all required fields."); return;
      }
      if (eligibility && !eligibility.eligible) {
        setError("This claim is NOT eligible. See eligibility check above."); return;
      }
    }

    setLoading(true); setError("");
    try {
      const body: any = {
        deceasedType: mode === "SPOT_SERVICE" ? "SPOT_SERVICE" : deceasedType,
        deathType,
        deceasedName: mode === "SPOT_SERVICE" ? spotClientName : deceasedName,
        dateOfDeath,
        causeOfDeath,
        claimantName: mode === "SPOT_SERVICE" ? spotClientName : claimantName,
        claimantRelationship: mode === "SPOT_SERVICE" ? "Self" : claimantRelationship,
        claimantContact: mode === "SPOT_SERVICE" ? spotClientContact : claimantContact,
        claimantAddress: mode === "SPOT_SERVICE" ? spotClientAddress : claimantAddress,
        notes,
        isSpotService: mode === "SPOT_SERVICE",
        spotServiceAmount: mode === "SPOT_SERVICE" ? parseFloat(spotAmount) : undefined,
        spotClientName: mode === "SPOT_SERVICE" ? spotClientName : undefined,
        spotClientContact: mode === "SPOT_SERVICE" ? spotClientContact : undefined,
        spotClientAddress: mode === "SPOT_SERVICE" ? spotClientAddress : undefined,
      };

      if (mode === "MEMBER_CLAIM") {
        body.memberId = memberId;
      }

      const res = await fetch("/api/claims", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
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

      {/* Mode Toggle */}
      <div className="flex gap-3">
        <button type="button" onClick={() => setMode("MEMBER_CLAIM")}
          className={`flex-1 py-3 rounded-xl border-2 text-sm font-semibold transition-all ${
            mode === "MEMBER_CLAIM" ? "border-blue-600 bg-blue-50 text-blue-700" : "border-gray-200 text-gray-500 hover:border-gray-300"
          }`}>
          Member / Beneficiary Claim
        </button>
        <button type="button" onClick={() => setMode("SPOT_SERVICE")}
          className={`flex-1 py-3 rounded-xl border-2 text-sm font-semibold transition-all ${
            mode === "SPOT_SERVICE" ? "border-orange-500 bg-orange-50 text-orange-700" : "border-gray-200 text-gray-500 hover:border-gray-300"
          }`}>
          Spot Service (Non-Member)
        </button>
      </div>

      {mode === "SPOT_SERVICE" ? (
        /* ── SPOT SERVICE FORM ── */
        <>
          <div className="bg-orange-50 border border-orange-200 rounded-xl p-5">
            <h2 className="text-lg font-semibold text-orange-900 mb-1">Spot Service</h2>
            <p className="text-xs text-orange-600">Contract service for non-members. Default price: {formatCurrency(SPOT_SERVICE_DEFAULT)}</p>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm space-y-4">
            <h2 className="text-lg font-semibold text-gray-900">Client Information</h2>
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className="block text-xs font-medium text-gray-500 mb-1">Client / Deceased Name *</label>
                <input className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" value={spotClientName}
                  onChange={(e) => setSpotClientName(e.target.value)} required />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Contact Number</label>
                <input className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" value={spotClientContact}
                  onChange={(e) => setSpotClientContact(e.target.value)} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Address</label>
                <input className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" value={spotClientAddress}
                  onChange={(e) => setSpotClientAddress(e.target.value)} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Date of Death *</label>
                <input type="date" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" value={dateOfDeath}
                  onChange={(e) => setDateOfDeath(e.target.value)} required />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Service Amount</label>
                <input type="number" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" value={spotAmount}
                  onChange={(e) => setSpotAmount(e.target.value)} />
              </div>
            </div>
          </div>
        </>
      ) : (
        /* ── MEMBER CLAIM FORM ── */
        <>
          {/* Select Member */}
          <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Member Account</h2>
            <div className="relative">
              <input className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                placeholder="Search by MAF no. or name..."
                value={memberSearch}
                onChange={(e) => { setMemberSearch(e.target.value); setShowDropdown(true); }}
                onFocus={() => setShowDropdown(true)} />
              {showDropdown && memberSearch.length >= 1 && (
                <div className="absolute z-20 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                  {members.filter((m) => {
                    const q = memberSearch.toLowerCase();
                    return m.mafNo.toLowerCase().includes(q) || m.firstName.toLowerCase().includes(q) ||
                      m.lastName.toLowerCase().includes(q) || `${m.firstName} ${m.lastName}`.toLowerCase().includes(q);
                  }).slice(0, 20).map((m) => (
                    <button key={m.id} type="button"
                      className="w-full text-left px-3 py-2 text-sm hover:bg-blue-50 border-b border-gray-50"
                      onClick={() => { handleMemberChange(m.id); setMemberSearch(`${m.mafNo} — ${m.firstName} ${m.lastName}`); setShowDropdown(false); }}>
                      <span className="font-mono text-gray-500">{m.mafNo}</span> — <span className="font-medium">{m.firstName} {m.lastName}</span>
                      <span className="text-xs text-gray-400 ml-1">({m.planCategory})</span>
                      <span className={`ml-2 text-xs px-1.5 py-0.5 rounded-full font-bold ${
                        m.status === "ACTIVE" || m.status === "REINSTATED" ? "bg-green-100 text-green-700" :
                        m.status === "LAPSED" ? "bg-red-100 text-red-700" : "bg-gray-100 text-gray-500"
                      }`}>{m.status}</span>
                      {!CLAIMABLE_PLANS.includes(m.planCategory) && (
                        <span className="ml-1 text-[10px] px-1.5 py-0.5 rounded-full bg-orange-100 text-orange-600 font-bold">NO CLAIM</span>
                      )}
                    </button>
                  ))}
                  {members.filter((m) => {
                    const q = memberSearch.toLowerCase();
                    return m.mafNo.toLowerCase().includes(q) || m.firstName.toLowerCase().includes(q) || m.lastName.toLowerCase().includes(q);
                  }).length === 0 && <p className="px-3 py-2 text-sm text-gray-400">No members found</p>}
                </div>
              )}
            </div>
            {selectedMember && (
              <div className="mt-3 grid grid-cols-3 gap-3 text-sm">
                <div><span className="text-xs text-gray-400">Status</span>
                  <p className={`font-bold ${selectedMember.status === "LAPSED" ? "text-red-600" : "text-green-700"}`}>{selectedMember.status}</p>
                </div>
                <div><span className="text-xs text-gray-400">Plan</span><p className="font-bold">{selectedMember.planCategory}</p></div>
                <div><span className="text-xs text-gray-400">Beneficiaries</span><p className="font-bold">{selectedMember.beneficiaries.length}</p></div>
              </div>
            )}

            {/* Lapsed warning */}
            {selectedMember?.status === "LAPSED" && (
              <div className="mt-3 bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">
                <strong>NOT ELIGIBLE:</strong> Member is LAPSED. Must pay remaining balance before filing a claim.
              </div>
            )}
          </div>

          {/* Death Type */}
          <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Death Classification</h2>
            <div className="grid grid-cols-3 gap-3">
              {[
                { value: "NATURAL", label: "Natural Death", desc: "Illness, assassination, provocation", color: "blue" },
                { value: "ACCIDENT", label: "Accidental Death", desc: "Accident, misfired/stray bullet", color: "green" },
                { value: "SUICIDE", label: "Suicide", desc: "Self-inflicted", color: "red" },
              ].map((t) => (
                <label key={t.value} className={`cursor-pointer rounded-xl border-2 p-3 text-center transition-all ${
                  deathType === t.value
                    ? `border-${t.color}-500 bg-${t.color}-50`
                    : "border-gray-200 hover:border-gray-300"
                }`}>
                  <input type="radio" name="deathType" value={t.value} checked={deathType === t.value}
                    onChange={() => setDeathType(t.value as any)} className="sr-only" />
                  <p className="font-bold text-sm text-gray-900">{t.label}</p>
                  <p className="text-[10px] text-gray-500 mt-0.5">{t.desc}</p>
                  <p className="text-[10px] font-bold mt-1 text-gray-600">
                    {t.value === "ACCIDENT" ? "No contestability" : t.value === "SUICIDE" ? "2 years" : "8 months"}
                  </p>
                </label>
              ))}
            </div>
          </div>

          {/* Deceased Type */}
          <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Who Died?</h2>
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
                    <button key={b.id} type="button" onClick={() => setDeceasedName(`${b.firstName} ${b.lastName}`)}
                      className={`text-xs px-3 py-1.5 rounded-lg border ${
                        deceasedName === `${b.firstName} ${b.lastName}` ? "bg-red-100 border-red-300 text-red-700" : "border-gray-200 text-gray-600 hover:bg-gray-50"
                      }`}>{b.firstName} {b.lastName} ({b.relationship})</button>
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

          {/* Eligibility Check */}
          {selectedMember && dateOfDeath && eligibility && (
            <div className={`rounded-xl border-2 p-5 ${
              eligibility.eligible ? "border-green-300 bg-green-50" : "border-red-300 bg-red-50"
            }`}>
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white text-lg ${
                  eligibility.eligible ? "bg-green-500" : "bg-red-500"
                }`}>
                  {eligibility.eligible ? "✓" : "✕"}
                </div>
                <div>
                  <p className={`font-bold text-lg ${eligibility.eligible ? "text-green-800" : "text-red-800"}`}>
                    {eligibility.eligible ? "ELIGIBLE FOR CLAIM" : "NOT ELIGIBLE"}
                  </p>
                  {eligibility.reason && <p className={`text-sm ${eligibility.eligible ? "text-green-600" : "text-red-600"}`}>{eligibility.reason}</p>}
                </div>
              </div>
            </div>
          )}

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
                      }`}>{b.firstName} {b.lastName} ({b.relationship})</button>
                  ))}
                </div>
              </div>
            )}
            <div className="grid grid-cols-2 gap-4">
              <div><label className="block text-xs font-medium text-gray-500 mb-1">Claimant Full Name *</label>
                <input className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" value={claimantName} onChange={(e) => setClaimantName(e.target.value)} required /></div>
              <div><label className="block text-xs font-medium text-gray-500 mb-1">Relationship</label>
                <input className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" value={claimantRelationship} onChange={(e) => setClaimantRelationship(e.target.value)} /></div>
              <div><label className="block text-xs font-medium text-gray-500 mb-1">Contact</label>
                <input className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" value={claimantContact} onChange={(e) => setClaimantContact(e.target.value)} /></div>
              <div><label className="block text-xs font-medium text-gray-500 mb-1">Address</label>
                <input className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" value={claimantAddress} onChange={(e) => setClaimantAddress(e.target.value)} /></div>
            </div>
          </div>
        </>
      )}

      {/* Notes */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
        <label className="block text-xs font-medium text-gray-500 mb-1">Notes</label>
        <textarea rows={3} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm resize-none"
          value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Additional notes..." />
      </div>

      <div className="flex items-center justify-between">
        <button type="button" onClick={() => router.back()} className="text-sm text-gray-500 hover:text-gray-700">Cancel</button>
        <button type="submit" disabled={loading || (mode === "MEMBER_CLAIM" && eligibility !== null && !eligibility.eligible)}
          className={`px-6 py-2.5 text-white rounded-lg text-sm font-semibold disabled:opacity-50 ${
            mode === "SPOT_SERVICE" ? "bg-orange-600 hover:bg-orange-700" : "bg-red-600 hover:bg-red-700"
          }`}>
          {loading ? "Filing..." : mode === "SPOT_SERVICE" ? "Create Spot Service Record" : "File Claim & Issue Stub"}
        </button>
      </div>
    </form>
  );
}
