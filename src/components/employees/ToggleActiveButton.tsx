"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function ToggleActiveButton({
  employeeId,
  employeeName,
  isActive,
}: {
  employeeId: string;
  employeeName: string;
  isActive: boolean;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleToggle() {
    const action = isActive ? "deactivate" : "reactivate";
    const msg = isActive
      ? `Deactivate ${employeeName}? They will be hidden from active lists, remittance forms, and incentive calculations. Their member assignments will be preserved.`
      : `Reactivate ${employeeName}? They will appear in active lists again.`;

    if (!confirm(msg)) return;

    setLoading(true);
    try {
      const res = await fetch(`/api/employees/${employeeId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !isActive }),
      });
      if (!res.ok) {
        const err = await res.json();
        alert(err.error ?? `Failed to ${action}`);
      } else {
        router.refresh();
      }
    } catch {
      alert(`Failed to ${action}`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      onClick={handleToggle}
      disabled={loading}
      className={`text-sm font-medium px-4 py-2 rounded-lg border transition-colors disabled:opacity-50 ${
        isActive
          ? "border-red-200 text-red-600 hover:bg-red-50"
          : "border-green-200 text-green-600 hover:bg-green-50"
      }`}
    >
      {loading
        ? "..."
        : isActive
          ? "Deactivate"
          : "Reactivate"
      }
    </button>
  );
}
