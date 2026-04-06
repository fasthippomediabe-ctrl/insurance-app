"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

interface Branch { id: string; name: string }

const CIVIL_STATUS = ["Single", "Married", "Widowed", "Separated"];

export default function EditEmployeeForm({
  employee,
  branches,
  isAdmin,
}: {
  employee: {
    id: string; employeeNo: string; firstName: string; middleName: string; lastName: string;
    nickname: string; dateOfBirth: string; gender: string; civilStatus: string;
    contactNumber: string; address: string; email: string; photo: string | null;
    dateHired: string; branchId: string; primaryPosition: string;
  };
  branches: Branch[];
  isAdmin: boolean;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [photo, setPhoto] = useState<string | null>(employee.photo);
  const photoRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState({ ...employee });

  function set(field: string, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  function handlePhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) { setError("Photo too large. Max 2MB."); return; }
    const reader = new FileReader();
    reader.onload = () => setPhoto(reader.result as string);
    reader.readAsDataURL(file);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const res = await fetch(`/api/employees/${employee.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          employeeNo: form.employeeNo,
          firstName: form.firstName,
          middleName: form.middleName || null,
          lastName: form.lastName,
          nickname: form.nickname || null,
          dateOfBirth: form.dateOfBirth || null,
          gender: form.gender || null,
          civilStatus: form.civilStatus || null,
          contactNumber: form.contactNumber || null,
          address: form.address || null,
          email: form.email || null,
          photo: photo,
          dateHired: form.dateHired,
          branchId: form.branchId,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Failed to update");
      }

      setSuccess(true);
      setTimeout(() => router.push(`/employees/${employee.id}`), 1000);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">{error}</div>}
      {success && <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg text-sm">Employee updated! Redirecting...</div>}

      {/* Photo */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
        <h2 className="font-semibold text-gray-800 mb-4 pb-2 border-b">Photo</h2>
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
            <button type="button" onClick={() => photoRef.current?.click()} className="text-sm font-medium text-blue-600 hover:underline">
              {photo ? "Change Photo" : "Upload Photo"}
            </button>
            {photo && <button type="button" onClick={() => setPhoto(null)} className="text-sm text-red-500 hover:underline ml-3">Remove</button>}
          </div>
        </div>
      </div>

      {/* Employment */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
        <h2 className="font-semibold text-gray-800 mb-4 pb-2 border-b">Employment</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Employee No.</label>
            <input className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" value={form.employeeNo} onChange={(e) => set("employeeNo", e.target.value)} />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Position</label>
            <input className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-gray-50" value={form.primaryPosition} disabled />
            <p className="text-[10px] text-gray-400 mt-0.5">Use Promote/Demote to change</p>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Date Hired</label>
            <input type="date" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" value={form.dateHired} onChange={(e) => set("dateHired", e.target.value)} />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Branch</label>
            <select className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" value={form.branchId} onChange={(e) => set("branchId", e.target.value)}>
              {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </div>
        </div>
      </div>

      {/* Personal Info */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
        <h2 className="font-semibold text-gray-800 mb-4 pb-2 border-b">Personal Information</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">First Name *</label>
            <input className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" value={form.firstName} onChange={(e) => set("firstName", e.target.value)} required />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Middle Name</label>
            <input className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" value={form.middleName} onChange={(e) => set("middleName", e.target.value)} />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Last Name *</label>
            <input className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" value={form.lastName} onChange={(e) => set("lastName", e.target.value)} required />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Nickname</label>
            <input className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" value={form.nickname} onChange={(e) => set("nickname", e.target.value)} />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Date of Birth</label>
            <input type="date" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" value={form.dateOfBirth} onChange={(e) => set("dateOfBirth", e.target.value)} />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Gender</label>
            <select className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" value={form.gender} onChange={(e) => set("gender", e.target.value)}>
              <option value="">—</option>
              <option value="MALE">Male</option>
              <option value="FEMALE">Female</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Civil Status</label>
            <select className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" value={form.civilStatus} onChange={(e) => set("civilStatus", e.target.value)}>
              <option value="">—</option>
              {CIVIL_STATUS.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Contact Number</label>
            <input className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" value={form.contactNumber} onChange={(e) => set("contactNumber", e.target.value)} />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Email</label>
            <input type="email" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" value={form.email} onChange={(e) => set("email", e.target.value)} />
          </div>
          <div className="col-span-2 md:col-span-3">
            <label className="block text-xs font-medium text-gray-500 mb-1">Address</label>
            <input className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" value={form.address} onChange={(e) => set("address", e.target.value)} />
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <Link href={`/employees/${employee.id}`} className="text-sm text-gray-500 hover:text-gray-700">Cancel</Link>
        <button type="submit" disabled={loading || success}
          className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-semibold disabled:opacity-50">
          {loading ? "Saving..." : "Save Changes"}
        </button>
      </div>
    </form>
  );
}
