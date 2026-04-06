"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { EmployeePosition } from "@prisma/client";
import { POSITION_LABELS } from "@/lib/utils";

// Ordered hierarchy for display (lower index = lower rank)
const POSITION_ORDER: EmployeePosition[] = ["MO", "AO", "MH", "AM", "BS", "BM", "RM", "TH", "EVP", "CEO", "CHR"];

const POSITION_COLORS: Record<string, string> = {
  MO: "bg-blue-100 text-blue-700",
  AO: "bg-teal-100 text-teal-700",
  MH: "bg-purple-100 text-purple-700",
  AM: "bg-indigo-100 text-indigo-700",
  BS: "bg-gray-100 text-gray-600",
  BM: "bg-green-100 text-green-700",
  RM: "bg-orange-100 text-orange-700",
  TH: "bg-red-100 text-red-700",
  EVP: "bg-yellow-100 text-yellow-700",
  CEO: "bg-pink-100 text-pink-700",
  CHR: "bg-rose-100 text-rose-800",
};

export default function PromoteButton({
  employeeId,
  currentPositions,
  isAdmin,
}: {
  employeeId: string;
  currentPositions: EmployeePosition[];
  isAdmin: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const today = new Date().toISOString().split("T")[0];
  const [form, setForm] = useState({
    newPosition: "" as EmployeePosition | "",
    setAsPrimary: true,
    promotedDate: today,
    notes: "",
  });

  // Available positions = all positions employee doesn't already hold
  const adminOnly: EmployeePosition[] = ["RM", "TH", "EVP", "CEO", "CHR"];
  const available = POSITION_ORDER.filter((p) => {
    if (currentPositions.includes(p)) return false;
    if (!isAdmin && adminOnly.includes(p)) return false;
    return true;
  });

  async function handlePromote(e: React.FormEvent) {
    e.preventDefault();
    if (!form.newPosition) return;
    setLoading(true);
    setError("");

    try {
      const res = await fetch(`/api/employees/${employeeId}/promote`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(typeof err.error === "string" ? err.error : "Failed to promote.");
      }

      setOpen(false);
      router.refresh();
    } catch (err: any) {
      setError(err.message);
      setLoading(false);
    }
  }

  if (available.length === 0) return null;

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="px-4 py-2 text-sm font-semibold rounded-lg border-2 border-blue-700 text-blue-700 hover:bg-blue-50 transition-colors"
      >
        Grant / Promote Position
      </button>

      {open && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="px-6 pt-6 pb-4 border-b">
              <h2 className="text-lg font-bold text-gray-900">Grant / Promote Position</h2>
              <p className="text-sm text-gray-500 mt-0.5">
                Grant a new position to this employee. They will hold all positions simultaneously.
              </p>
            </div>

            <form onSubmit={handlePromote} className="px-6 py-5 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">New Position *</label>
                <select
                  required
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={form.newPosition}
                  onChange={(e) => setForm((f) => ({ ...f, newPosition: e.target.value as EmployeePosition }))}
                >
                  <option value="">Select position to grant...</option>
                  {available.map((p) => (
                    <option key={p} value={p}>{p} – {POSITION_LABELS[p].split("–")[1]?.trim()}</option>
                  ))}
                </select>

                {form.newPosition && (
                  <div className={`mt-2 inline-flex px-3 py-1 rounded-full text-xs font-bold ${POSITION_COLORS[form.newPosition] ?? "bg-gray-100 text-gray-600"}`}>
                    {form.newPosition}
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Effective Date *</label>
                <input
                  type="date"
                  required
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={form.promotedDate}
                  onChange={(e) => setForm((f) => ({ ...f, promotedDate: e.target.value }))}
                />
              </div>

              <div className="flex items-start gap-3 bg-blue-50 border border-blue-200 rounded-lg px-4 py-3">
                <input
                  type="checkbox"
                  id="setAsPrimary"
                  checked={form.setAsPrimary}
                  onChange={(e) => setForm((f) => ({ ...f, setAsPrimary: e.target.checked }))}
                  className="mt-0.5 w-4 h-4 rounded border-gray-300 text-blue-600"
                />
                <label htmlFor="setAsPrimary" className="text-sm text-blue-800 cursor-pointer">
                  <span className="font-semibold">Set as Primary Position</span>
                  <br />
                  <span className="text-xs text-blue-600">
                    Uncheck if this is an additional/secondary role and their current title should stay the same.
                  </span>
                </label>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notes (optional)</label>
                <textarea
                  rows={2}
                  placeholder="e.g. Promoted after recruiting 3 MOs"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                  value={form.notes}
                  onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                />
              </div>

              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-3 py-2 rounded-lg">
                  {error}
                </div>
              )}

              <div className="flex gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => { setOpen(false); setError(""); }}
                  className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading || !form.newPosition}
                  className="flex-1 px-4 py-2.5 text-white rounded-lg text-sm font-semibold"
                  style={{ background: loading || !form.newPosition ? "#94a3b8" : "#1535b0" }}
                >
                  {loading ? "Saving..." : "Confirm Promotion"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
