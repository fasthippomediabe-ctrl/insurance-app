"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { EmployeePosition } from "@prisma/client";
import { POSITION_LABELS, COMMISSION_POSITIONS, SALARIED_POSITIONS } from "@/lib/utils";

// Positions only Admin can assign
const ADMIN_ONLY_POSITIONS: EmployeePosition[] = ["RM", "TH", "EVP", "CEO", "CHR"];
// Positions branch staff can add
const BRANCH_POSITIONS: EmployeePosition[] = ["MO", "AO", "AS", "MH", "AM", "CS", "BS", "BM"];

// Commission positions that can be held simultaneously
// (field staff who also have leadership roles)
const MULTI_POSITIONS: EmployeePosition[] = ["MO", "AO", "MH", "AM", "CS", "BM"];

interface Branch { id: string; name: string }
interface Sponsor { id: string; firstName: string; lastName: string; primaryPosition: string; employeeNo: string }

const CIVIL_STATUS = ["Single", "Married", "Widowed", "Separated"];

export default function EmployeeForm({
  branches,
  sponsors,
  defaultBranchId,
  isAdmin,
}: {
  branches: Branch[];
  sponsors: Sponsor[];
  defaultBranchId: string;
  isAdmin: boolean;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [photo, setPhoto] = useState<string | null>(null);
  const photoRef = useRef<HTMLInputElement>(null);

  function handlePhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) { setError("Photo too large. Max 2MB."); return; }
    const reader = new FileReader();
    reader.onload = () => setPhoto(reader.result as string);
    reader.readAsDataURL(file);
  }

  const today = new Date().toISOString().split("T")[0];

  const [form, setForm] = useState({
    employeeNo: "",
    primaryPosition: "MO" as EmployeePosition,
    additionalPositions: [] as EmployeePosition[],
    firstName: "",
    middleName: "",
    lastName: "",
    nickname: "",
    dateOfBirth: "",
    gender: "",
    civilStatus: "",
    contactNumber: "",
    address: "",
    email: "",
    dateHired: today,
    branchId: defaultBranchId,
    sponsorId: "",
  });

  function set(field: string, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  function toggleAdditionalPosition(pos: EmployeePosition) {
    setForm((prev) => {
      const current = prev.additionalPositions;
      if (current.includes(pos)) {
        return { ...prev, additionalPositions: current.filter((p) => p !== pos) };
      } else {
        return { ...prev, additionalPositions: [...current, pos] };
      }
    });
  }

  // Remove from additionalPositions if it matches the new primaryPosition
  function setPrimaryPosition(pos: EmployeePosition) {
    setForm((prev) => ({
      ...prev,
      primaryPosition: pos,
      additionalPositions: prev.additionalPositions.filter((p) => p !== pos),
    }));
  }

  const isCommission = COMMISSION_POSITIONS.includes(form.primaryPosition);

  // Available positions for "also holds" checkboxes (exclude primary, only field positions)
  const availableAdditional = MULTI_POSITIONS.filter(
    (p) => p !== form.primaryPosition && (isAdmin || BRANCH_POSITIONS.includes(p))
  );

  // Auto-generate employee number when primaryPosition or branch changes
  useEffect(() => {
    if (!form.primaryPosition || !form.branchId) return;
    fetch(`/api/employees/generate-no?position=${form.primaryPosition}&branchId=${form.branchId}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.employeeNo) set("employeeNo", data.employeeNo);
      });
  }, [form.primaryPosition, form.branchId]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/employees", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          photo: photo || undefined,
          gender: form.gender || undefined,
          sponsorId: form.sponsorId || undefined,
          middleName: form.middleName || undefined,
          nickname: form.nickname || undefined,
          email: form.email || undefined,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(typeof err.error === "string" ? err.error : "Failed to save.");
      }

      router.push("/employees");
    } catch (err: any) {
      setError(err.message);
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">

      {/* Photo Upload */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
        <h2 className="font-semibold text-gray-800 mb-4 pb-2 border-b">Employee Photo</h2>
        <div className="flex items-center gap-5">
          {photo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={photo} alt="Employee" className="w-24 h-24 rounded-xl object-cover border-2 border-gray-200" />
          ) : (
            <div className="w-24 h-24 rounded-xl bg-gray-100 border-2 border-dashed border-gray-300 flex items-center justify-center">
              <svg className="w-8 h-8 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            </div>
          )}
          <div>
            <input ref={photoRef} type="file" accept="image/*" className="hidden" onChange={handlePhoto} />
            <button type="button" onClick={() => photoRef.current?.click()}
              className="text-sm font-medium text-blue-600 hover:underline">
              {photo ? "Change Photo" : "Upload Photo"}
            </button>
            {photo && (
              <button type="button" onClick={() => setPhoto(null)} className="text-sm text-red-500 hover:underline ml-3">Remove</button>
            )}
            <p className="text-xs text-gray-400 mt-1">Optional. Max 2MB. JPG or PNG.</p>
          </div>
        </div>
      </div>

      {/* Employment Details */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
        <h2 className="font-semibold text-gray-800 mb-4 pb-2 border-b">Employment Details</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="label">Employee No. *</label>
            <div className="relative">
              <input className="input pr-16" required value={form.employeeNo}
                onChange={(e) => set("employeeNo", e.target.value)}
                placeholder="Auto-generated" />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">
                auto
              </span>
            </div>
            <p className="text-xs text-gray-400 mt-1">Auto-generated. You can edit if needed.</p>
          </div>
          <div>
            <label className="label">Primary Position *</label>
            <select className="input" required value={form.primaryPosition}
              onChange={(e) => setPrimaryPosition(e.target.value as EmployeePosition)}>
              <optgroup label="Commission-Based">
                {COMMISSION_POSITIONS.map((p) => (
                  <option key={p} value={p}>{POSITION_LABELS[p]}</option>
                ))}
              </optgroup>
              <optgroup label="Salaried – Branch Level">
                {SALARIED_POSITIONS.filter((p) => BRANCH_POSITIONS.includes(p)).map((p) => (
                  <option key={p} value={p}>{POSITION_LABELS[p]}</option>
                ))}
              </optgroup>
              {isAdmin && (
                <optgroup label="Salaried – Executive (Admin Only)">
                  {ADMIN_ONLY_POSITIONS.map((p) => (
                    <option key={p} value={p}>{POSITION_LABELS[p]}</option>
                  ))}
                </optgroup>
              )}
            </select>
          </div>
          <div>
            <label className="label">Date Hired *</label>
            <input type="date" className="input" required value={form.dateHired}
              onChange={(e) => set("dateHired", e.target.value)} />
          </div>
          {isAdmin && (
            <div>
              <label className="label">Branch *</label>
              <select className="input" required value={form.branchId}
                onChange={(e) => set("branchId", e.target.value)}>
                <option value="">Select Branch</option>
                {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </div>
          )}
          <div>
            <label className="label">Sponsor / Upline</label>
            <select className="input" value={form.sponsorId}
              onChange={(e) => set("sponsorId", e.target.value)}>
              <option value="">None / Direct</option>
              {sponsors.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.firstName} {s.lastName} ({s.primaryPosition} – {s.employeeNo})
                </option>
              ))}
            </select>
            <p className="text-xs text-gray-400 mt-1">Who recruited this person? (for commission cascade)</p>
          </div>
          <div className="flex items-center">
            <div className={`mt-5 px-4 py-2.5 rounded-lg text-sm font-medium ${isCommission ? "bg-orange-50 text-orange-700 border border-orange-200" : "bg-green-50 text-green-700 border border-green-200"}`}>
              {isCommission ? "Commission-Based" : "Salaried (Monthly)"}
            </div>
          </div>
        </div>

        {/* Additional Positions */}
        {availableAdditional.length > 0 && (
          <div className="mt-4 pt-4 border-t">
            <label className="label mb-2">Also Holds These Positions (optional)</label>
            <p className="text-xs text-gray-400 mb-3">
              A person can simultaneously hold MO + MH + AM. Each position has separate incentive tracking.
            </p>
            <div className="flex flex-wrap gap-3">
              {availableAdditional.map((pos) => (
                <label key={pos} className="flex items-center gap-2 cursor-pointer group">
                  <input
                    type="checkbox"
                    checked={form.additionalPositions.includes(pos)}
                    onChange={() => toggleAdditionalPosition(pos)}
                    className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-700 group-hover:text-gray-900">
                    <span className="font-semibold">{pos}</span> – {POSITION_LABELS[pos]}
                  </span>
                </label>
              ))}
            </div>
            {form.additionalPositions.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-1.5">
                <span className="text-xs text-gray-500">Active positions:</span>
                {[form.primaryPosition, ...form.additionalPositions].map((p) => (
                  <span key={p} className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-semibold">{p}</span>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Personal Info */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
        <h2 className="font-semibold text-gray-800 mb-4 pb-2 border-b">Personal Information</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="label">First Name *</label>
            <input className="input" required value={form.firstName}
              onChange={(e) => set("firstName", e.target.value)} />
          </div>
          <div>
            <label className="label">Middle Name</label>
            <input className="input" value={form.middleName}
              onChange={(e) => set("middleName", e.target.value)} />
          </div>
          <div>
            <label className="label">Last Name *</label>
            <input className="input" required value={form.lastName}
              onChange={(e) => set("lastName", e.target.value)} />
          </div>
          <div>
            <label className="label">Nickname</label>
            <input className="input" value={form.nickname}
              onChange={(e) => set("nickname", e.target.value)}
              placeholder="Optional" />
          </div>
          <div>
            <label className="label">Date of Birth</label>
            <input type="date" className="input" value={form.dateOfBirth}
              onChange={(e) => set("dateOfBirth", e.target.value)} />
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
            <label className="label">Contact Number</label>
            <input className="input" value={form.contactNumber}
              onChange={(e) => set("contactNumber", e.target.value)}
              placeholder="09XXXXXXXXX" />
          </div>
          <div>
            <label className="label">Email</label>
            <input type="email" className="input" value={form.email}
              onChange={(e) => set("email", e.target.value)} />
          </div>
          <div className="md:col-span-3">
            <label className="label">Address</label>
            <input className="input" value={form.address}
              onChange={(e) => set("address", e.target.value)} />
          </div>
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
          className="px-6 py-2.5 text-white rounded-lg text-sm font-semibold transition-opacity"
          style={{ background: loading ? "#94a3b8" : "#1535b0" }}>
          {loading ? "Saving..." : "Add Employee"}
        </button>
      </div>
    </form>
  );
}
