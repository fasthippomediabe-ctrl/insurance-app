"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { MONTHS } from "@/lib/utils";

export default function DashboardFilterBar({
  currentMonth,
  currentYear,
}: {
  currentMonth: number;
  currentYear: number;
}) {
  const router = useRouter();
  const [month, setMonth] = useState(currentMonth);
  const [year, setYear] = useState(currentYear);

  function generate() {
    router.push(`/dashboard?month=${month}&year=${year}`);
  }

  const now = new Date();
  const isCurrentPeriod = month === now.getMonth() + 1 && year === now.getFullYear();

  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="flex items-center gap-2">
        <select
          className="border border-gray-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
          value={month}
          onChange={(e) => setMonth(Number(e.target.value))}
        >
          {MONTHS.map((m, i) => (
            <option key={i + 1} value={i + 1}>{m}</option>
          ))}
        </select>
        <input
          type="number"
          className="w-20 border border-gray-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
          value={year}
          onChange={(e) => setYear(Number(e.target.value))}
          min={2020}
          max={2099}
        />
        <button
          onClick={generate}
          className="bg-purple-600 hover:bg-purple-700 text-white text-sm font-semibold px-4 py-1.5 rounded-lg"
        >
          Go
        </button>
        {!isCurrentPeriod && (
          <button
            onClick={() => {
              const n = new Date();
              setMonth(n.getMonth() + 1);
              setYear(n.getFullYear());
              router.push("/dashboard");
            }}
            className="text-xs text-purple-600 hover:underline ml-1"
          >
            Reset to current
          </button>
        )}
      </div>
    </div>
  );
}
