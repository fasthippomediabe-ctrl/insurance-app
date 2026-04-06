"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { EmployeePosition } from "@prisma/client";
import { POSITION_LABELS } from "@/lib/utils";

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

export default function DemoteButton({
  employeeId,
  primaryPosition,
  activePositions,
}: {
  employeeId: string;
  primaryPosition: EmployeePosition;
  activePositions: EmployeePosition[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const today = new Date().toISOString().split("T")[0];
  const [form, setForm] = useState({
    removePosition: "" as EmployeePosition | "",
    newPrimaryPosition: "" as EmployeePosition | "",
    demotedDate: today,
    notes: "",
  });

  // Can only demote if holding more than 1 position
  if (activePositions.length <= 1) return null;

  const removingPrimary = form.removePosition === primaryPosition;
  // Remaining positions after removing the selected one
  const remaining = activePositions.filter((p) => p !== form.removePosition);

  async function handleDemote(e: React.FormEvent) {
    e.preventDefault();
    if (!form.removePosition) return;
    if (removingPrimary && !form.newPrimaryPosition) return;

    setLoading(true);
    setError("");

    try {
      const res = await fetch(`/api/employees/${employeeId}/demote`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          removePosition: form.removePosition,
          newPrimaryPosition: removingPrimary ? form.newPrimaryPosition : undefined,
          demotedDate: form.demotedDate,
          notes: form.notes,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(typeof err.error === "string" ? err.error : "Failed to process demotion.");
      }

      setOpen(false);
      router.refresh();
    } catch (err: any) {
      setError(err.message);
      setLoading(false);
    }
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="px-4 py-2 text-sm font-semibold rounded-lg border-2 border-red-300 text-red-600 hover:bg-red-50 transition-colors"
      >
        Remove Position
      </button>

      {open && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="px-6 pt-6 pb-4 border-b">
              <h2 className="text-lg font-bold text-gray-900">Remove / Demote Position</h2>
              <p className="text-sm text-gray-500 mt-0.5">
                Remove one of this employee's active positions. History will be recorded.
              </p>
            </div>

            <form onSubmit={handleDemote} className="px-6 py-5 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Position to Remove *</label>
                <div className="space-y-2">
                  {activePositions.map((p) => (
                    <label key={p} className="flex items-center gap-3 p-3 border rounded-lg cursor-pointer hover:bg-gray-50"
                      style={{ borderColor: form.removePosition === p ? "#ef4444" : "#e5e7eb" }}>
                      <input
                        type="radio"
                        name="removePosition"
                        value={p}
                        checked={form.removePosition === p}
                        onChange={() => setForm((f) => ({ ...f, removePosition: p, newPrimaryPosition: "" }))}
                        className="text-red-500"
                      />
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${POSITION_COLORS[p] ?? "bg-gray-100 text-gray-600"}`}>
                        {p}
                      </span>
                      <span className="text-sm text-gray-700 flex-1">
                        {POSITION_LABELS[p].split("–")[1]?.trim()}
                      </span>
                      {p === primaryPosition && (
                        <span className="text-xs bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded">Primary</span>
                      )}
                    </label>
                  ))}
                </div>
              </div>

              {/* Must pick a new primary if removing the current primary */}
              {removingPrimary && remaining.length > 0 && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 space-y-3">
                  <p className="text-sm font-semibold text-amber-800">
                    You are removing their primary position. Select a new primary:
                  </p>
                  <div className="space-y-2">
                    {remaining.map((p) => (
                      <label key={p} className="flex items-center gap-3 cursor-pointer">
                        <input
                          type="radio"
                          name="newPrimaryPosition"
                          value={p}
                          checked={form.newPrimaryPosition === p}
                          onChange={() => setForm((f) => ({ ...f, newPrimaryPosition: p }))}
                          required={removingPrimary}
                          className="text-blue-600"
                        />
                        <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${POSITION_COLORS[p] ?? "bg-gray-100 text-gray-600"}`}>
                          {p}
                        </span>
                        <span className="text-sm text-gray-700">
                          {POSITION_LABELS[p].split("–")[1]?.trim()}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Effective Date *</label>
                <input
                  type="date"
                  required
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-400"
                  value={form.demotedDate}
                  onChange={(e) => setForm((f) => ({ ...f, demotedDate: e.target.value }))}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Reason (optional)</label>
                <textarea
                  rows={2}
                  placeholder="e.g. Failed to meet promotion requirements, voluntary step-down..."
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-400 resize-none"
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
                  disabled={loading || !form.removePosition || (removingPrimary && !form.newPrimaryPosition)}
                  className="flex-1 px-4 py-2.5 text-white rounded-lg text-sm font-semibold bg-red-500 hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {loading ? "Saving..." : "Confirm Removal"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
