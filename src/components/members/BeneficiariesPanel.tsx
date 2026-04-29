"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface Beneficiary {
  id: string;
  order: number;
  firstName: string;
  middleName: string | null;
  lastName: string;
  dateOfBirth: string | null;
  age: number | null;
  relationship: string;
  effectivityDate: string | null;
}

const RELATIONSHIPS = ["Spouse", "Son", "Daughter", "Father", "Mother", "Brother", "Sister", "Son in Law", "Daughter in Law", "Grandchild", "Other"];

export default function BeneficiariesPanel({
  memberId, beneficiaries,
}: {
  memberId: string; beneficiaries: Beneficiary[];
}) {
  const router = useRouter();
  const [editing, setEditing] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const empty = {
    firstName: "", middleName: "", lastName: "",
    dateOfBirth: "", age: "", relationship: "Spouse", effectivityDate: "",
  };
  const [form, setForm] = useState<any>(empty);

  function startEdit(b: Beneficiary) {
    setEditing(b.id);
    setAdding(false);
    setForm({
      firstName: b.firstName,
      middleName: b.middleName ?? "",
      lastName: b.lastName,
      dateOfBirth: b.dateOfBirth?.split("T")[0] ?? "",
      age: b.age ?? "",
      relationship: b.relationship,
      effectivityDate: b.effectivityDate?.split("T")[0] ?? "",
    });
    setError("");
  }

  function startAdd() {
    setAdding(true);
    setEditing(null);
    setForm(empty);
    setError("");
  }

  function cancel() {
    setEditing(null);
    setAdding(false);
    setForm(empty);
    setError("");
  }

  async function save() {
    if (!form.firstName || !form.lastName || !form.relationship) {
      setError("First name, last name, and relationship are required.");
      return;
    }
    setLoading(true); setError("");
    try {
      const url = "/api/beneficiaries";
      const body = adding
        ? { memberId, ...form }
        : { id: editing, ...form };
      const res = await fetch(url, {
        method: adding ? "POST" : "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "Failed");
      cancel();
      router.refresh();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  async function remove(id: string, name: string) {
    if (!confirm(`Remove beneficiary ${name}?`)) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/beneficiaries?id=${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error((await res.json()).error ?? "Failed");
      router.refresh();
    } catch (e: any) {
      alert("Error: " + e.message);
    } finally {
      setLoading(false);
    }
  }

  const fmtDate = (d: string | null) => d ? new Date(d).toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" }) : "—";

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
      <div className="flex items-center justify-between mb-4 pb-2 border-b">
        <h2 className="font-semibold text-gray-800">Beneficiaries</h2>
        <button onClick={startAdd}
          className="text-xs bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-lg font-medium">
          + Add Beneficiary
        </button>
      </div>

      {error && <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded mb-3 text-sm">{error}</div>}

      {/* Add / Edit Form */}
      {(adding || editing) && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4 space-y-3">
          <p className="text-xs font-bold text-blue-900">
            {adding ? "New Beneficiary" : "Edit Beneficiary"}
          </p>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">First Name *</label>
              <input className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Middle Name</label>
              <input className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                value={form.middleName} onChange={(e) => setForm({ ...form, middleName: e.target.value })} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Last Name *</label>
              <input className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Relationship *</label>
              <select className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                value={form.relationship} onChange={(e) => setForm({ ...form, relationship: e.target.value })}>
                {RELATIONSHIPS.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Date of Birth</label>
              <input type="date" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                value={form.dateOfBirth} onChange={(e) => setForm({ ...form, dateOfBirth: e.target.value })} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Age</label>
              <input type="number" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                value={form.age} onChange={(e) => setForm({ ...form, age: e.target.value })} />
            </div>
            <div className="col-span-3">
              <label className="block text-xs font-medium text-gray-500 mb-1">Effectivity Date</label>
              <input type="date" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                value={form.effectivityDate} onChange={(e) => setForm({ ...form, effectivityDate: e.target.value })} />
            </div>
          </div>
          <div className="flex gap-2 pt-2">
            <button onClick={cancel}
              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-xs font-medium text-gray-600 hover:bg-gray-50">
              Cancel
            </button>
            <button onClick={save} disabled={loading}
              className="flex-1 px-3 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg text-xs font-semibold">
              {loading ? "Saving..." : adding ? "Add" : "Save"}
            </button>
          </div>
        </div>
      )}

      {/* List */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
            <tr>
              <th className="px-3 py-2 text-left">#</th>
              <th className="px-3 py-2 text-left">Name</th>
              <th className="px-3 py-2 text-left">Relationship</th>
              <th className="px-3 py-2 text-left">Date of Birth</th>
              <th className="px-3 py-2 text-center">Age</th>
              <th className="px-3 py-2 text-left">Effectivity</th>
              <th className="px-3 py-2 text-center">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {beneficiaries.map((b) => (
              <tr key={b.id} className="hover:bg-gray-50">
                <td className="px-3 py-2.5 text-gray-400 text-xs">{b.order}</td>
                <td className="px-3 py-2.5 font-medium">
                  {b.firstName} {b.middleName ? b.middleName + " " : ""}{b.lastName}
                </td>
                <td className="px-3 py-2.5 text-gray-600">{b.relationship}</td>
                <td className="px-3 py-2.5 text-gray-500 text-xs">{fmtDate(b.dateOfBirth)}</td>
                <td className="px-3 py-2.5 text-center text-gray-600">{b.age ?? "—"}</td>
                <td className="px-3 py-2.5 text-gray-500 text-xs">{fmtDate(b.effectivityDate)}</td>
                <td className="px-3 py-2.5 text-center space-x-2 whitespace-nowrap">
                  <button onClick={() => startEdit(b)} className="text-blue-600 hover:underline text-xs font-medium">Edit</button>
                  <button onClick={() => remove(b.id, `${b.firstName} ${b.lastName}`)} className="text-red-500 hover:underline text-xs font-medium">Remove</button>
                </td>
              </tr>
            ))}
            {beneficiaries.length === 0 && !adding && (
              <tr><td colSpan={7} className="px-4 py-6 text-center text-gray-400 text-sm">No beneficiaries. Click + Add Beneficiary above.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
