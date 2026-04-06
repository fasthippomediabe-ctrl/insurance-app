"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { MopCode, PlanCategory, InsuranceType } from "@prisma/client";
import { getMonthlyDue, getPaymentAmount, getTotalPlanAmount, getSpotCashAmount, formatCurrency, MOP_LABELS } from "@/lib/utils";

type Branch = { id: string; name: string };
type Agent = { id: string; firstName: string; lastName: string; code: string };
type Collector = { id: string; firstName: string; lastName: string; code: string };

interface Props {
  branches: Branch[];
  agents: Agent[];
  collectors: Collector[];
  defaultBranchId: string;
  isAdmin: boolean;
}

const CIVIL_STATUS = ["Single", "Married", "Widowed", "Separated"];
const RELIGIONS = ["Catholic", "Born Again Christian", "Islam", "INC", "Protestant", "Others"];

function emptyBeneficiary(order: number) {
  return { order, firstName: "", middleName: "", lastName: "", dateOfBirth: "", age: "", relationship: "", effectivityDate: "" };
}

export default function NewMemberForm({ branches, agents, collectors, defaultBranchId, isAdmin }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [form, setForm] = useState({
    mafNo: "",
    enrollmentDate: new Date().toISOString().split("T")[0],
    effectivityDate: new Date().toISOString().split("T")[0],
    insuranceType: "FAMILY_INSURANCE" as InsuranceType,
    planCategory: "EUCALYPTUS" as PlanCategory,
    mopCode: "FIME" as MopCode,
    spotCash: false,
    firstName: "",
    middleName: "",
    lastName: "",
    address: "",
    dateOfBirth: "",
    age: "",
    religion: "",
    contactNumber: "",
    occupation: "",
    civilStatus: "",
    gender: "",
    branchId: defaultBranchId,
    agentId: "",
    collectorId: "",
  });

  const [beneficiaries, setBeneficiaries] = useState([
    emptyBeneficiary(1),
    emptyBeneficiary(2),
    emptyBeneficiary(3),
  ]);

  function set(field: string, value: any) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  function setBenef(index: number, field: string, value: string) {
    setBeneficiaries((prev) => prev.map((b, i) => i === index ? { ...b, [field]: value } : b));
  }

  const monthly = getMonthlyDue(form.mopCode);
  const paymentAmount = getPaymentAmount(form.mopCode);
  const total = getTotalPlanAmount(form.mopCode);
  const spotCashAmt = getSpotCashAmount(form.mopCode);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const payload = {
      ...form,
      age: form.age ? parseInt(form.age) : undefined,
      spotCash: form.mopCode === "SPOT_CASH" || form.spotCash,
      beneficiaries: beneficiaries
        .filter((b) => b.firstName.trim())
        .map((b) => ({
          ...b,
          age: b.age ? parseInt(b.age) : undefined,
        })),
    };

    try {
      const res = await fetch("/api/members", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(JSON.stringify(err.error));
      }

      const member = await res.json();
      router.push(`/members/${member.id}`);
    } catch (err: any) {
      setError(err.message ?? "Failed to save member.");
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">

      {/* Section: Plan Details */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
        <h2 className="font-semibold text-gray-800 mb-4 pb-2 border-b">Plan Details</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="label">MAF No. *</label>
            <input className="input" required value={form.mafNo} onChange={(e) => set("mafNo", e.target.value)} placeholder="e.g. KID-2021-001" />
          </div>
          <div>
            <label className="label">Enrollment Date *</label>
            <input type="date" className="input" required value={form.enrollmentDate} onChange={(e) => set("enrollmentDate", e.target.value)} />
          </div>
          <div>
            <label className="label">Effectivity Date *</label>
            <input type="date" className="input" required value={form.effectivityDate} onChange={(e) => set("effectivityDate", e.target.value)} />
          </div>
          <div>
            <label className="label">Insurance Type *</label>
            <select className="input" value={form.insuranceType} onChange={(e) => set("insuranceType", e.target.value as InsuranceType)}>
              <option value="FAMILY_INSURANCE">Family Insurance</option>
              <option value="NON_INSURABLE">Non-Insurable</option>
            </select>
          </div>
          <div>
            <label className="label">Plan Category *</label>
            <select className="input" value={form.planCategory} onChange={(e) => set("planCategory", e.target.value as PlanCategory)}>
              <option value="EUCALYPTUS">Eucalyptus</option>
              <option value="CHERRY">Cherry</option>
              <option value="CONIFER">Conifer</option>
            </select>
          </div>
          <div>
            <label className="label">MOP Code *</label>
            <select className="input" value={form.mopCode} onChange={(e) => set("mopCode", e.target.value as MopCode)}>
              {Object.entries(MOP_LABELS).map(([code, label]) => (
                <option key={code} value={code}>{code} — {label}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Pricing Summary */}
        <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="bg-blue-50 rounded-lg p-3 text-center">
            <p className="text-xs text-blue-600 font-medium">Monthly Due</p>
            <p className="text-lg font-bold text-blue-700">{formatCurrency(monthly)}</p>
          </div>
          <div className="bg-gray-50 rounded-lg p-3 text-center">
            <p className="text-xs text-gray-500 font-medium">Per Payment</p>
            <p className="text-lg font-bold text-gray-700">{formatCurrency(paymentAmount)}</p>
          </div>
          <div className="bg-gray-50 rounded-lg p-3 text-center">
            <p className="text-xs text-gray-500 font-medium">Total (5 yrs)</p>
            <p className="text-lg font-bold text-gray-700">{formatCurrency(total)}</p>
          </div>
          <div className="bg-green-50 rounded-lg p-3 text-center">
            <p className="text-xs text-green-600 font-medium">Spot Cash (-10%)</p>
            <p className="text-lg font-bold text-green-700">{formatCurrency(spotCashAmt)}</p>
          </div>
        </div>
      </div>

      {/* Section: Personal Info */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
        <h2 className="font-semibold text-gray-800 mb-4 pb-2 border-b">Member Information</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="label">First Name *</label>
            <input className="input" required value={form.firstName} onChange={(e) => set("firstName", e.target.value)} />
          </div>
          <div>
            <label className="label">Middle Name</label>
            <input className="input" value={form.middleName} onChange={(e) => set("middleName", e.target.value)} />
          </div>
          <div>
            <label className="label">Last Name *</label>
            <input className="input" required value={form.lastName} onChange={(e) => set("lastName", e.target.value)} />
          </div>
          <div className="md:col-span-3">
            <label className="label">Complete Address *</label>
            <input className="input" required value={form.address} onChange={(e) => set("address", e.target.value)} />
          </div>
          <div>
            <label className="label">Date of Birth</label>
            <input type="date" className="input" value={form.dateOfBirth} onChange={(e) => set("dateOfBirth", e.target.value)} />
          </div>
          <div>
            <label className="label">Age</label>
            <input type="number" className="input" value={form.age} onChange={(e) => set("age", e.target.value)} />
          </div>
          <div>
            <label className="label">Contact Number</label>
            <input className="input" value={form.contactNumber} onChange={(e) => set("contactNumber", e.target.value)} placeholder="09XXXXXXXXX" />
          </div>
          <div>
            <label className="label">Gender</label>
            <select className="input" value={form.gender} onChange={(e) => set("gender", e.target.value)}>
              <option value="">Select</option>
              <option value="MALE">Male</option>
              <option value="FEMALE">Female</option>
            </select>
          </div>
          <div>
            <label className="label">Civil Status</label>
            <select className="input" value={form.civilStatus} onChange={(e) => set("civilStatus", e.target.value)}>
              <option value="">Select</option>
              {CIVIL_STATUS.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Religion</label>
            <select className="input" value={form.religion} onChange={(e) => set("religion", e.target.value)}>
              <option value="">Select</option>
              {RELIGIONS.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Occupation</label>
            <input className="input" value={form.occupation} onChange={(e) => set("occupation", e.target.value)} />
          </div>
        </div>
      </div>

      {/* Section: Assignment */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
        <h2 className="font-semibold text-gray-800 mb-4 pb-2 border-b">Assignment</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {isAdmin && (
            <div>
              <label className="label">Branch *</label>
              <select className="input" required value={form.branchId} onChange={(e) => set("branchId", e.target.value)}>
                <option value="">Select Branch</option>
                {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </div>
          )}
          <div>
            <label className="label">Sales Agent</label>
            <select className="input" value={form.agentId} onChange={(e) => set("agentId", e.target.value)}>
              <option value="">Select Agent</option>
              {agents.map((a) => <option key={a.id} value={a.id}>{a.firstName} {a.lastName} ({a.code})</option>)}
            </select>
          </div>
          <div>
            <label className="label">Collector</label>
            <select className="input" value={form.collectorId} onChange={(e) => set("collectorId", e.target.value)}>
              <option value="">Select Collector</option>
              {collectors.map((c) => <option key={c.id} value={c.id}>{c.firstName} {c.lastName} ({c.code})</option>)}
            </select>
          </div>
        </div>
      </div>

      {/* Section: Beneficiaries */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
        <h2 className="font-semibold text-gray-800 mb-4 pb-2 border-b">Beneficiaries (up to 3)</h2>
        <div className="space-y-6">
          {beneficiaries.map((b, i) => (
            <div key={i} className="border border-gray-100 rounded-lg p-4 bg-gray-50">
              <p className="text-sm font-semibold text-gray-600 mb-3">Beneficiary {i + 1}</p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <label className="label">First Name</label>
                  <input className="input" value={b.firstName} onChange={(e) => setBenef(i, "firstName", e.target.value)} />
                </div>
                <div>
                  <label className="label">Middle Name</label>
                  <input className="input" value={b.middleName} onChange={(e) => setBenef(i, "middleName", e.target.value)} />
                </div>
                <div>
                  <label className="label">Last Name</label>
                  <input className="input" value={b.lastName} onChange={(e) => setBenef(i, "lastName", e.target.value)} />
                </div>
                <div>
                  <label className="label">Date of Birth</label>
                  <input type="date" className="input" value={b.dateOfBirth} onChange={(e) => setBenef(i, "dateOfBirth", e.target.value)} />
                </div>
                <div>
                  <label className="label">Age</label>
                  <input type="number" className="input" value={b.age} onChange={(e) => setBenef(i, "age", e.target.value)} />
                </div>
                <div>
                  <label className="label">Relationship</label>
                  <input className="input" value={b.relationship} onChange={(e) => setBenef(i, "relationship", e.target.value)} placeholder="Spouse, Child, Parent..." />
                </div>
                <div>
                  <label className="label">Effectivity Date</label>
                  <input type="date" className="input" value={b.effectivityDate} onChange={(e) => setBenef(i, "effectivityDate", e.target.value)} />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-lg">
          {error}
        </div>
      )}

      <div className="flex gap-3 justify-end pb-6">
        <button type="button" onClick={() => router.back()}
          className="px-6 py-2.5 border border-gray-300 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-50">
          Cancel
        </button>
        <button type="submit" disabled={loading}
          className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white rounded-lg text-sm font-semibold transition-colors">
          {loading ? "Saving..." : "Register Member"}
        </button>
      </div>
    </form>
  );
}
