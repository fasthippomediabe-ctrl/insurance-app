"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { MONTHS } from "@/lib/utils";

export default function AcrFilterBar({
  collectors,
  currentCollectorId,
  currentMonth,
  currentYear,
}: {
  collectors: { id: string; name: string }[];
  currentCollectorId: string;
  currentMonth: number;
  currentYear: number;
}) {
  const router = useRouter();
  const [collectorId, setCollectorId] = useState(currentCollectorId);
  const [month, setMonth] = useState(currentMonth);
  const [year, setYear] = useState(currentYear);

  function generate() {
    if (!collectorId) return;
    router.push(`/acr?collectorId=${collectorId}&month=${month}&year=${year}`);
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm flex flex-wrap gap-4 items-end">
      <div className="flex-1 min-w-48">
        <label className="block text-xs font-medium text-gray-500 mb-1">Collector (AO)</label>
        <select
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          value={collectorId}
          onChange={(e) => setCollectorId(e.target.value)}
        >
          <option value="">Select collector...</option>
          {collectors.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-xs font-medium text-gray-500 mb-1">Collection Period</label>
        <div className="flex gap-2">
          <select
            className="border border-gray-300 rounded-lg px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={month} onChange={(e) => setMonth(Number(e.target.value))}
          >
            {MONTHS.map((m, i) => <option key={i + 1} value={i + 1}>{m}</option>)}
          </select>
          <input type="number" className="w-24 border border-gray-300 rounded-lg px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={year} onChange={(e) => setYear(Number(e.target.value))} min={2020} max={2099} />
        </div>
      </div>

      <button onClick={generate}
        className="bg-blue-700 hover:bg-blue-800 text-white text-sm font-semibold px-5 py-2 rounded-lg">
        Generate
      </button>
      <button onClick={() => window.print()}
        className="bg-purple-600 hover:bg-purple-700 text-white text-sm font-semibold px-5 py-2 rounded-lg">
        Print ACR
      </button>
    </div>
  );
}
