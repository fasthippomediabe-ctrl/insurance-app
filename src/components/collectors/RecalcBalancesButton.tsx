"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function RecalcBalancesButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleRecalc() {
    if (!confirm("Recalculate all collector balances from remittance history? This will reset and recompute all deficit/surplus balances.")) return;
    setLoading(true);
    try {
      const res = await fetch("/api/admin/recalc-balances", { method: "POST" });
      if (!res.ok) {
        const err = await res.json();
        alert(err.error ?? "Failed.");
      } else {
        const data = await res.json();
        alert(`Balances recalculated for ${data.collectorsUpdated} collector(s).`);
        router.refresh();
      }
    } catch {
      alert("Failed to recalculate.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      onClick={handleRecalc}
      disabled={loading}
      className="text-sm font-medium px-4 py-2 rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50 disabled:opacity-50"
    >
      {loading ? "Recalculating..." : "Recalc Balances"}
    </button>
  );
}
