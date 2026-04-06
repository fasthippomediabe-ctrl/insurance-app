"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { MopCode, PlanCategory, InsuranceType, MemberStatus } from "@prisma/client";
import { getMonthlyDue, getPaymentAmount, getTotalPlanAmount, getMultiplier, formatCurrency, MOP_LABELS } from "@/lib/utils";

type Branch = { id: string; name: string };
type Agent = { id: string; firstName: string; lastName: string; code: string };
type Collector = { id: string; firstName: string; lastName: string; code: string };

interface MemberData {
  id: string;
  mafNo: string;
  firstName: string;
  middleName: string;
  lastName: string;
  address: string;
  dateOfBirth: string;
  contactNumber: string;
  occupation: string;
  civilStatus: string;
  gender: string;
  religion: string;
  planCategory: PlanCategory;
  mopCode: MopCode;
  insuranceType: InsuranceType;
  status: MemberStatus;
  branchId: string;
  agentId: string;
  collectorId: string;
  enrollmentDate: string;
  effectivityDate: string;
  operationMonth: number | null;
  operationYear: number | null;
}

interface Props {
  member: MemberData;
  branches: Branch[];
  agents: Agent[];
  collectors: Collector[];
  isAdmin: boolean;
  userId?: string;
}

const CIVIL_STATUS = ["Single", "Married", "Widowed", "Separated", "Widow"];
const STATUSES: { value: MemberStatus; label: string }[] = [
  { value: "ACTIVE", label: "Active" },
  { value: "LAPSED", label: "Lapsed" },
  { value: "REINSTATED", label: "Reinstated" },
  { value: "FULLY_PAID", label: "Fully Paid" },
  { value: "DECEASED_CLAIMANT", label: "Deceased Claimant" },
  { value: "CANCELLED", label: "Cancelled" },
];

export default function EditMemberForm({ member, branches, agents, collectors, isAdmin, userId }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const [form, setForm] = useState({ ...member });
  const [reason, setReason] = useState("");

  function set(field: string, value: any) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  const monthlyDue = getMonthlyDue(form.mopCode);
  const paymentAmount = getPaymentAmount(form.mopCode);
  const totalPlan = getTotalPlanAmount(form.mopCode);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    setSuccess(false);

    const changes = {
      mafNo: form.mafNo.trim(),
      firstName: form.firstName.trim(),
      middleName: form.middleName.trim() || null,
      lastName: form.lastName.trim(),
      address: form.address.trim(),
      dateOfBirth: form.dateOfBirth || null,
      contactNumber: form.contactNumber.trim() || null,
      occupation: form.occupation.trim() || null,
      civilStatus: form.civilStatus || null,
      gender: form.gender || null,
      religion: form.religion || null,
      planCategory: form.planCategory,
      mopCode: form.mopCode,
      insuranceType: form.insuranceType,
      status: form.status,
      branchId: form.branchId,
      agentId: form.agentId || null,
      collectorId: form.collectorId || null,
      monthlyDue,
      totalPlanAmount: totalPlan,
    };

    try {
      if (isAdmin) {
        // Admin: apply directly
        const res = await fetch(`/api/members/${member.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(changes),
        });
        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error ?? "Failed to update");
        }
        setSuccess(true);
        setTimeout(() => router.push(`/members/${member.id}`), 1000);
      } else {
        // Branch staff: submit edit request for approval
        if (!reason.trim()) {
          setError("Please provide a reason for the edit request.");
          setLoading(false);
          return;
        }
        const res = await fetch("/api/members/edit-requests", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            memberId: member.id,
            requestType: "EDIT",
            changes,
            reason: reason.trim(),
          }),
        });
        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error ?? "Failed to submit request");
        }
        setSuccess(true);
        setTimeout(() => router.push(`/members/${member.id}`), 1000);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  const inputClass = "w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500";
  const labelClass = "block text-xs text-gray-500 font-medium mb-1";

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">{error}</div>}
      {success && <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg text-sm">
        {isAdmin ? "Member updated successfully!" : "Edit request submitted for admin approval!"} Redirecting...
      </div>}

      {/* Plan & MOP */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Plan Information</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <label className={labelClass}>MAF No.</label>
            <input className={inputClass} value={form.mafNo} onChange={(e) => setForm({ ...form, mafNo: e.target.value })} />
          </div>
          <div>
            <label className={labelClass}>Status</label>
            <select className={inputClass} value={form.status} onChange={(e) => set("status", e.target.value)}>
              {STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </div>
          <div>
            <label className={labelClass}>Plan Category</label>
            <select className={inputClass} value={form.planCategory} onChange={(e) => set("planCategory", e.target.value)}>
              <option value="EUCALYPTUS">Eucalyptus</option>
              <option value="CHERRY">Cherry</option>
              <option value="CONIFER">Conifer</option>
              <option value="ROSEWOOD">Rosewood</option>
            </select>
          </div>
          <div>
            <label className={labelClass}>MOP Code</label>
            <select className={inputClass} value={form.mopCode} onChange={(e) => set("mopCode", e.target.value as MopCode)}>
              {Object.entries(MOP_LABELS)
                .filter(([code]) => {
                  // Only allow upgrade: current frequency or higher (no downgrading)
                  const currentMultiplier = getMultiplier(member.mopCode);
                  const optionMultiplier = getMultiplier(code as MopCode);
                  // Same plan category base rate must match
                  const currentBase = getMonthlyDue(member.mopCode);
                  const optionBase = getMonthlyDue(code as MopCode);
                  if (optionBase !== currentBase) return false;
                  return optionMultiplier >= currentMultiplier;
                })
                .map(([code, label]) => (
                  <option key={code} value={code}>{code} — {label}</option>
                ))}
            </select>
            {getMultiplier(form.mopCode) > getMultiplier(member.mopCode) && (
              <p className="text-xs text-green-600 mt-1">Upgrading from {member.mopCode} to {form.mopCode}</p>
            )}
          </div>
          <div>
            <label className={labelClass}>Insurance Type</label>
            <select className={inputClass} value={form.insuranceType} onChange={(e) => set("insuranceType", e.target.value)}>
              <option value="FAMILY_INSURANCE">Family Insurance</option>
              <option value="NON_INSURABLE">Non-Insurable</option>
              <option value="INDIVIDUAL_INSURANCE">Individual Insurance</option>
            </select>
          </div>
          <div>
            <label className={labelClass}>Monthly Due</label>
            <div className="text-sm font-semibold text-gray-800 py-2">{formatCurrency(monthlyDue)}</div>
          </div>
          <div>
            <label className={labelClass}>Payment Amount</label>
            <div className="text-sm font-semibold text-gray-800 py-2">{formatCurrency(paymentAmount)}</div>
          </div>
          <div>
            <label className={labelClass}>Total Plan</label>
            <div className="text-sm font-semibold text-gray-800 py-2">{formatCurrency(totalPlan)}</div>
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
          {isAdmin && (
            <div>
              <label className={labelClass}>Branch</label>
              <select className={inputClass} value={form.branchId} onChange={(e) => set("branchId", e.target.value)}>
                {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </div>
          )}
          <div>
            <label className={labelClass}>Sales Agent</label>
            <select className={inputClass} value={form.agentId} onChange={(e) => set("agentId", e.target.value)}>
              <option value="">— None —</option>
              {agents.map((a) => <option key={a.id} value={a.id}>{a.firstName} {a.lastName}</option>)}
            </select>
          </div>
          <div>
            <label className={labelClass}>Collector</label>
            <select className={inputClass} value={form.collectorId} onChange={(e) => set("collectorId", e.target.value)}>
              <option value="">— None —</option>
              {collectors.map((c) => <option key={c.id} value={c.id}>{c.firstName} {c.lastName}</option>)}
            </select>
          </div>
          <div>
            <label className={labelClass}>Enrollment Date</label>
            <input type="date" className={inputClass} value={form.enrollmentDate} onChange={(e) => set("enrollmentDate", e.target.value)} />
          </div>
        </div>
      </div>

      {/* Personal Info */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Personal Information</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <div>
            <label className={labelClass}>First Name</label>
            <input className={inputClass} value={form.firstName} onChange={(e) => set("firstName", e.target.value)} required />
          </div>
          <div>
            <label className={labelClass}>Middle Name</label>
            <input className={inputClass} value={form.middleName} onChange={(e) => set("middleName", e.target.value)} />
          </div>
          <div>
            <label className={labelClass}>Last Name</label>
            <input className={inputClass} value={form.lastName} onChange={(e) => set("lastName", e.target.value)} required />
          </div>
          <div className="col-span-2">
            <label className={labelClass}>Address</label>
            <input className={inputClass} value={form.address} onChange={(e) => set("address", e.target.value)} />
          </div>
          <div>
            <label className={labelClass}>Date of Birth</label>
            <input type="date" className={inputClass} value={form.dateOfBirth} onChange={(e) => set("dateOfBirth", e.target.value)} />
          </div>
          <div>
            <label className={labelClass}>Contact Number</label>
            <input className={inputClass} value={form.contactNumber} onChange={(e) => set("contactNumber", e.target.value)} />
          </div>
          <div>
            <label className={labelClass}>Occupation</label>
            <input className={inputClass} value={form.occupation} onChange={(e) => set("occupation", e.target.value)} />
          </div>
          <div>
            <label className={labelClass}>Civil Status</label>
            <select className={inputClass} value={form.civilStatus} onChange={(e) => set("civilStatus", e.target.value)}>
              <option value="">— Select —</option>
              {CIVIL_STATUS.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label className={labelClass}>Gender</label>
            <select className={inputClass} value={form.gender} onChange={(e) => set("gender", e.target.value)}>
              <option value="">— Select —</option>
              <option value="MALE">Male</option>
              <option value="FEMALE">Female</option>
            </select>
          </div>
          <div>
            <label className={labelClass}>Religion</label>
            <input className={inputClass} value={form.religion} onChange={(e) => set("religion", e.target.value)} list="religions" />
            <datalist id="religions">
              {["Roman Catholic", "Born Again Christian", "Islam", "INC", "Protestant", "SDA", "Others"].map(r => <option key={r} value={r} />)}
            </datalist>
          </div>
        </div>
      </div>

      {/* Reason (staff only) */}
      {!isAdmin && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
          <label className="block text-sm font-semibold text-amber-800 mb-2">Reason for edit request *</label>
          <textarea className="w-full border border-amber-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
            rows={2} value={reason} onChange={(e) => setReason(e.target.value)}
            placeholder="e.g., Member converted from monthly to quarterly payment" required />
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center justify-between">
        <Link href={`/members/${member.id}`} className="text-sm text-gray-500 hover:text-gray-700">Cancel</Link>
        <button type="submit" disabled={loading}
          className="px-6 py-2.5 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-sm font-semibold disabled:opacity-50">
          {loading ? "Submitting..." : isAdmin ? "Save Changes" : "Submit Edit Request"}
        </button>
      </div>
    </form>
  );
}
