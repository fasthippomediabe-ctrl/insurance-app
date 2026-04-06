"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { IncentiveResult } from "@/lib/incentives";

const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];

function fmt(n: number) {
  if (n === 0) return "—";
  const prefix = n < 0 ? "-" : "";
  return `${prefix}₱${Math.abs(n).toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

interface Branch { id: string; name: string }

interface CutoffData {
  id: string;
  month: number;
  year: number;
  defaultDate: string;
  extendedDate: string;
  reason: string | null;
}

export default function IncentivesMasterList({
  results, month, year, branchName, branches, currentBranchId, isAdmin, cutoff,
}: {
  results: IncentiveResult[];
  month: number;
  year: number;
  branchName: string;
  branches: Branch[];
  currentBranchId: string;
  isAdmin: boolean;
  cutoff?: CutoffData | null;
}) {
  const router = useRouter();
  const [filterMonth, setFilterMonth] = useState(month);
  const [filterYear, setFilterYear] = useState(year);
  const [filterBranch, setFilterBranch] = useState(currentBranchId);

  function handleFilter() {
    const params = new URLSearchParams();
    params.set("month", String(filterMonth));
    params.set("year", String(filterYear));
    if (filterBranch) params.set("branchId", filterBranch);
    router.push(`/incentives?${params.toString()}`);
  }

  const totalGross = results.reduce((s, r) => s + r.grossIncentives, 0);
  const totalNet = results.reduce((s, r) => s + r.netIncentives, 0);
  const totalNE = results.reduce((s, r) => s + r.ne, 0);
  const totalLapsed = results.reduce((s, r) => s + r.lapsedCharges, 0);

  // Group: BM/CS at top, then by AM groups
  const bmCs = results.filter((r) => r.position === "BM" || r.position === "CS");
  const others = results.filter((r) => r.position !== "BM" && r.position !== "CS");

  // Simple grouping: AM first, then MH, then MOs
  const posOrder: Record<string, number> = { AM: 1, MH: 2, MO: 3, AO: 4 };
  const sorted = [...others].sort(
    (a, b) => (posOrder[a.position] ?? 5) - (posOrder[b.position] ?? 5) || a.employeeName.localeCompare(b.employeeName)
  );

  return (
    <>
      {/* Filters — hidden on print */}
      <div className="print:hidden space-y-5 mb-5">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Incentives & Commission</h1>
            <p className="text-sm text-gray-500">{branchName} — {MONTHS[month - 1]} {year} Operation</p>
          </div>
          <button onClick={() => window.print()}
            className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-sm font-semibold">
            Print Report
          </button>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-4 flex flex-wrap gap-3 shadow-sm">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Month</label>
            <select value={filterMonth} onChange={(e) => setFilterMonth(Number(e.target.value))}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm">
              {MONTHS.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Year</label>
            <select value={filterYear} onChange={(e) => setFilterYear(Number(e.target.value))}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm">
              {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i).map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>
          {isAdmin && (
            <div>
              <label className="block text-xs text-gray-500 mb-1">Branch</label>
              <select value={filterBranch} onChange={(e) => setFilterBranch(e.target.value)}
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm">
                <option value="">All Branches</option>
                {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </div>
          )}
          <div className="flex items-end">
            <button onClick={handleFilter}
              className="bg-gray-800 hover:bg-gray-900 text-white text-sm font-medium px-4 py-2 rounded-lg">
              Generate
            </button>
          </div>
        </div>

        {/* Cutoff info */}
        <CutoffBanner month={month} year={year} cutoff={cutoff} branchId={currentBranchId} isAdmin={isAdmin} />

        {/* Summary cards */}
        <div className="grid grid-cols-4 gap-4">
          <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
            <p className="text-xs text-gray-400 uppercase font-medium">New Enrollments</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">{totalNE}</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
            <p className="text-xs text-gray-400 uppercase font-medium">Total Agents</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">{results.length}</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
            <p className="text-xs text-gray-400 uppercase font-medium">Gross Incentives</p>
            <p className="text-2xl font-bold text-green-700 mt-1">₱{totalGross.toLocaleString("en-PH", { minimumFractionDigits: 2 })}</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
            <p className="text-xs text-gray-400 uppercase font-medium">Net Payout</p>
            <p className={`text-2xl font-bold mt-1 ${totalNet >= 0 ? "text-green-700" : "text-red-600"}`}>
              ₱{totalNet.toLocaleString("en-PH", { minimumFractionDigits: 2 })}
            </p>
          </div>
        </div>
      </div>

      {/* ── Print Document ── */}
      <div id="isr-print" className="bg-white border border-gray-200 rounded-xl shadow-sm print:shadow-none print:border-none print:rounded-none overflow-hidden">

        {/* Print-only header */}
        <div className="hidden print:block" style={{ textAlign: "center", padding: "12px 0 8px" }}>
          <div style={{ fontWeight: 700, fontSize: 14 }}>TRIPLE J MORTUARY CARE SERVICES CORP.</div>
          <div style={{ fontWeight: 700, fontSize: 11 }}>{branchName.toUpperCase()}</div>
          <div style={{ fontWeight: 700, fontSize: 11 }}>INCOME SUMMARY REPORT — {MONTHS[month - 1].toUpperCase()} {year}</div>
          <div style={{ fontSize: 9, marginTop: 4, textAlign: "right", paddingRight: 12 }}>
            Print Date: {(() => { const d = new Date(); return `${d.getMonth()+1}/${d.getDate()}/${d.getFullYear()}`; })()} · Released: 12th Day of the Month
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-gray-800 text-white text-[10px] uppercase">
                <th className="px-3 py-2.5 text-left font-semibold">Position</th>
                <th className="px-3 py-2.5 text-left font-semibold">Agent</th>
                <th className="px-3 py-2.5 text-center font-semibold">NE</th>
                <th className="px-3 py-2.5 text-center font-semibold">Grp NE</th>
                <th className="px-3 py-2.5 text-right font-semibold">Per. Prod</th>
                <th className="px-3 py-2.5 text-right font-semibold">Grp Prod</th>
                <th className="px-3 py-2.5 text-right font-semibold">Comm</th>
                <th className="px-3 py-2.5 text-right font-semibold">TA</th>
                <th className="px-3 py-2.5 text-right font-semibold">MO</th>
                <th className="px-3 py-2.5 text-right font-semibold">MH</th>
                <th className="px-3 py-2.5 text-right font-semibold">AM</th>
                <th className="px-3 py-2.5 text-right font-semibold">CI</th>
                <th className="px-3 py-2.5 text-right font-semibold">CSI</th>
                <th className="px-3 py-2.5 text-right font-semibold">BM PI</th>
                <th className="px-3 py-2.5 text-right font-semibold">Gross</th>
                <th className="px-3 py-2.5 text-center font-semibold">Lapsed</th>
                <th className="px-3 py-2.5 text-right font-semibold">Lapsed Chg</th>
                <th className="px-3 py-2.5 text-right font-semibold">Net Income</th>
                <th className="px-3 py-2.5 w-20 print:hidden"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {/* BM & CS */}
              {bmCs.length > 0 && (
                <>
                  {bmCs.map((r) => <AgentRow key={r.employeeId} r={r} month={month} year={year} />)}
                  <tr><td colSpan={19} className="h-1 bg-gray-200"></td></tr>
                </>
              )}

              {/* Field agents */}
              {sorted.map((r, i) => {
                const prevPos = i > 0 ? sorted[i - 1].position : null;
                const showDivider = prevPos && prevPos !== r.position && (r.position === "MH" || r.position === "MO");
                return (
                  <AgentRow key={r.employeeId} r={r} month={month} year={year} showDivider={showDivider} />
                );
              })}
            </tbody>
            <tfoot>
              <tr className="bg-gray-50 font-bold text-xs border-t-2 border-gray-300">
                <td className="px-3 py-3" colSpan={2}>TOTAL</td>
                <td className="px-3 py-3 text-center">{totalNE}</td>
                <td className="px-3 py-3 text-center">{results.reduce((s, r) => s + r.groupNe, 0) || ""}</td>
                <td className="px-3 py-3 text-right">{results.reduce((s, r) => s + r.personalProduction, 0) || ""}</td>
                <td className="px-3 py-3 text-right">{results.reduce((s, r) => s + r.groupProduction, 0) || ""}</td>
                <td className="px-3 py-3 text-right">{fmt(results.reduce((s, r) => s + r.outrightCommission, 0))}</td>
                <td className="px-3 py-3 text-right">{fmt(results.reduce((s, r) => s + r.travellingAllowance, 0))}</td>
                <td className="px-3 py-3 text-right text-blue-600">{fmt(results.reduce((s, r) => s + r.moIncentives, 0))}</td>
                <td className="px-3 py-3 text-right text-teal-600">{fmt(results.reduce((s, r) => s + r.mhIncentives, 0))}</td>
                <td className="px-3 py-3 text-right text-indigo-600">{fmt(results.reduce((s, r) => s + r.amIncentives, 0))}</td>
                <td className="px-3 py-3 text-right text-orange-600">{fmt(results.reduce((s, r) => s + r.collectorIncentives, 0))}</td>
                <td className="px-3 py-3 text-right text-purple-600">{fmt(results.reduce((s, r) => s + r.csIncentives, 0))}</td>
                <td className="px-3 py-3 text-right text-green-700">{fmt(results.reduce((s, r) => s + r.bmIncentives, 0))}</td>
                <td className="px-3 py-3 text-right text-green-700">{fmt(totalGross)}</td>
                <td className="px-3 py-3 text-center">{results.reduce((s, r) => s + r.lapsableAccounts, 0)}</td>
                <td className="px-3 py-3 text-right text-red-600">{fmt(results.reduce((s, r) => s + r.lapsedCharges, 0))}</td>
                <td className="px-3 py-3 text-right font-bold text-lg">{fmt(totalNet)}</td>
                <td className="print:hidden"></td>
              </tr>
            </tfoot>
          </table>
        </div>

        {/* Print footer */}
        <div className="hidden print:flex justify-between px-6 py-4" style={{ marginTop: 20 }}>
          <div><div style={{ fontSize: 9 }}>Prepared by:</div><div style={{ borderBottom: "1px solid #000", width: 160, marginTop: 24 }}></div><div style={{ fontSize: 8 }}>Cashier</div></div>
          <div><div style={{ fontSize: 9 }}>Verified by:</div><div style={{ borderBottom: "1px solid #000", width: 160, marginTop: 24 }}></div><div style={{ fontSize: 8 }}>Manager</div></div>
        </div>
      </div>

      <style>{`
        @media print {
          body * { visibility: hidden !important; }
          #isr-print, #isr-print * { visibility: visible !important; }
          #isr-print { position: fixed; top: 0; left: 0; width: 100%; }
          @page { size: landscape; margin: 8mm; }
        }
      `}</style>
    </>
  );
}

function AgentRow({ r, month, year, showDivider }: { r: IncentiveResult; month: number; year: number; showDivider?: boolean | null }) {
  // Combine all incentives into one "Incentives" column for cleaner display
  const totalIncentives = r.moIncentives + r.mhIncentives + r.amIncentives +
    r.collectorIncentives + r.csIncentives + r.bmIncentives;
  // Display only lapsed charges in the deductions column
  // (BC, TA, cash bond are still deducted in net but not shown here)
  const displayedDeductions = r.lapsedCharges;

  // Build incentive breakdown tooltip
  const breakdown: string[] = [];
  if (r.moIncentives > 0) breakdown.push(`MO: ₱${r.moIncentives.toFixed(2)}`);
  if (r.mhIncentives > 0) breakdown.push(`MH: ₱${r.mhIncentives.toFixed(2)}`);
  if (r.amIncentives > 0) breakdown.push(`AM: ₱${r.amIncentives.toFixed(2)}`);
  if (r.collectorIncentives > 0) breakdown.push(`CI: ₱${r.collectorIncentives.toFixed(2)}`);
  if (r.csIncentives > 0) breakdown.push(`CSI: ₱${r.csIncentives.toFixed(2)}`);
  if (r.bmIncentives > 0) breakdown.push(`BM: ₱${r.bmIncentives.toFixed(2)}`);

  // Build deduction breakdown tooltip
  const deductionBreakdown: string[] = [];
  if (r.outrightBC > 0) deductionBreakdown.push(`BC outright: ₱${r.outrightBC.toFixed(2)}`);
  if (r.lumpSumBC > 0) deductionBreakdown.push(`BC lump sum (in payout): ₱${r.lumpSumBC.toFixed(2)}`);
  if (r.companyBC > 0) deductionBreakdown.push(`BC to company: ₱${r.companyBC.toFixed(2)}`);
  if (r.outrightTA > 0) deductionBreakdown.push(`TA to collector: ₱${r.outrightTA.toFixed(2)}`);
  if (r.cashBond > 0) deductionBreakdown.push(`Cash bond: ₱${r.cashBond.toFixed(2)}`);
  if (r.lapsedCharges > 0) deductionBreakdown.push(`Lapsed: ₱${r.lapsedCharges.toFixed(2)}`);

  const posColors: Record<string, string> = {
    BM: "bg-purple-100 text-purple-700",
    CS: "bg-indigo-100 text-indigo-700",
    AM: "bg-blue-100 text-blue-700",
    MH: "bg-teal-100 text-teal-700",
    MO: "bg-gray-100 text-gray-700",
    AO: "bg-orange-100 text-orange-700",
  };

  return (
    <>
      {showDivider && <tr><td colSpan={19} className="h-px bg-gray-200"></td></tr>}
      <tr className={`hover:bg-gray-50 ${r.netIncentives < 0 ? "bg-red-50/50" : ""}`}>
        <td className="px-3 py-2.5">
          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${posColors[r.position] ?? "bg-gray-100 text-gray-600"}`}>
            {r.position}
          </span>
        </td>
        <td className="px-3 py-2.5 font-medium text-gray-900">
          <Link href={`/incentives/${r.employeeId}?month=${month}&year=${year}`}
            className="hover:text-blue-600 print:text-black">
            {r.employeeName}
          </Link>
        </td>
        <td className="px-3 py-2.5 text-center">{r.ne || <span className="text-gray-300">0</span>}</td>
        <td className="px-3 py-2.5 text-center">{r.groupNe || <span className="text-gray-300">—</span>}</td>
        <td className="px-3 py-2.5 text-right">{r.personalProduction > 0 ? r.personalProduction.toLocaleString() : <span className="text-gray-300">—</span>}</td>
        <td className="px-3 py-2.5 text-right">{r.groupProduction > 0 ? r.groupProduction.toLocaleString() : <span className="text-gray-300">—</span>}</td>
        <td className="px-3 py-2.5 text-right">{r.outrightCommission > 0 ? fmt(r.outrightCommission) : <span className="text-gray-300">—</span>}</td>
        <td className="px-3 py-2.5 text-right">{r.travellingAllowance > 0 ? fmt(r.travellingAllowance) : <span className="text-gray-300">—</span>}</td>
        <td className="px-3 py-2.5 text-right">{r.moIncentives > 0 ? <span className="text-blue-600">{fmt(r.moIncentives)}</span> : <span className="text-gray-300">—</span>}</td>
        <td className="px-3 py-2.5 text-right">{r.mhIncentives > 0 ? <span className="text-teal-600">{fmt(r.mhIncentives)}</span> : <span className="text-gray-300">—</span>}</td>
        <td className="px-3 py-2.5 text-right">{r.amIncentives > 0 ? <span className="text-indigo-600">{fmt(r.amIncentives)}</span> : <span className="text-gray-300">—</span>}</td>
        <td className="px-3 py-2.5 text-right">{r.collectorIncentives > 0 ? <span className="text-orange-600">{fmt(r.collectorIncentives)}</span> : <span className="text-gray-300">—</span>}</td>
        <td className="px-3 py-2.5 text-right">{r.csIncentives > 0 ? <span className="text-purple-600">{fmt(r.csIncentives)}</span> : <span className="text-gray-300">—</span>}</td>
        <td className="px-3 py-2.5 text-right">{r.bmIncentives > 0 ? <span className="text-green-700">{fmt(r.bmIncentives)}</span> : <span className="text-gray-300">—</span>}</td>
        <td className="px-3 py-2.5 text-right font-semibold text-green-700">{r.grossIncentives > 0 ? fmt(r.grossIncentives) : <span className="text-gray-400">₱0</span>}</td>
        <td className="px-3 py-2.5 text-center">
          {r.lapsableAccounts > 0 ? (
            <span className="text-red-600 font-medium">{r.lapsableAccounts}</span>
          ) : <span className="text-gray-300">0</span>}
        </td>
        <td className="px-3 py-2.5 text-right">
          {displayedDeductions > 0 ? (
            <span className="text-red-600">{fmt(displayedDeductions)}</span>
          ) : <span className="text-gray-300">—</span>}
        </td>
        <td className={`px-3 py-2.5 text-right font-bold ${
          r.ne < 5 && r.netIncentives > 0 && r.position !== "BM" && r.position !== "CS"
            ? "text-red-600 bg-red-50"
            : r.netIncentives < 0 ? "text-red-600"
            : r.netIncentives > 0 ? "text-green-700"
            : "text-gray-400"
        }`}>
          {fmt(r.netIncentives)}
          {r.ne < 5 && r.netIncentives > 0 && r.position !== "BM" && r.position !== "CS" && (
            <span className="block text-[9px] bg-red-100 text-red-700 rounded px-1 py-0.5 mt-0.5 font-semibold">HOLD ({r.ne}/5 NE)</span>
          )}
        </td>
        <td className="px-3 py-2.5 text-center print:hidden">
          <Link href={`/incentives/${r.employeeId}?month=${month}&year=${year}`}
            className="text-[10px] text-purple-600 hover:text-purple-800 font-medium px-2 py-1 rounded hover:bg-purple-50">
            View ISR
          </Link>
        </td>
      </tr>
    </>
  );
}

// ─── Cutoff Banner ───
function CutoffBanner({ month, year, cutoff, branchId, isAdmin }: {
  month: number; year: number; cutoff?: CutoffData | null; branchId: string; isAdmin: boolean;
}) {
  const router = useRouter();
  const [extending, setExtending] = useState(false);
  const [extDate, setExtDate] = useState("");
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);

  const MON = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  function fmtDate(d: Date) { return `${MON[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`; }

  const lastDay = new Date(year, month, 0);
  const defaultCutoff = fmtDate(lastDay);

  const isExtended = cutoff && new Date(cutoff.extendedDate) > lastDay;
  const extendedStr = isExtended ? fmtDate(new Date(cutoff!.extendedDate)) : null;

  async function handleSave() {
    if (!extDate) return;
    setSaving(true);
    try {
      const res = await fetch("/api/admin/cutoffs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ branchId, month, year, extendedDate: extDate, reason }),
      });
      if (res.ok) {
        setExtending(false);
        router.refresh();
      } else {
        alert("Failed to save cutoff");
      }
    } finally { setSaving(false); }
  }

  async function handleRemove() {
    if (!cutoff || !confirm("Remove cutoff extension? Revert to default deadline.")) return;
    await fetch(`/api/admin/cutoffs?id=${cutoff.id}`, { method: "DELETE" });
    router.refresh();
  }

  return (
    <div className={`rounded-xl border p-4 text-sm flex items-center justify-between ${
      isExtended ? "bg-amber-50 border-amber-200" : "bg-gray-50 border-gray-200"
    }`}>
      <div>
        <span className="text-gray-500">Operation cutoff: </span>
        <span className="font-semibold text-gray-800">{defaultCutoff}</span>
        {isExtended && (
          <>
            <span className="mx-2 text-amber-500">→ Extended to</span>
            <span className="font-bold text-amber-700">{extendedStr}</span>
            {cutoff!.reason && (
              <span className="ml-2 text-xs text-amber-600">({cutoff!.reason})</span>
            )}
          </>
        )}
      </div>
      {isAdmin && (
        <div className="flex items-center gap-2">
          {isExtended && (
            <button onClick={handleRemove} className="text-xs text-red-500 hover:text-red-700">Remove</button>
          )}
          {!extending ? (
            <button onClick={() => setExtending(true)}
              className="text-xs font-medium px-3 py-1.5 rounded-lg border border-amber-300 text-amber-700 hover:bg-amber-100">
              {isExtended ? "Change" : "Extend Cutoff"}
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <input type="date" value={extDate} onChange={(e) => setExtDate(e.target.value)}
                className="border border-gray-300 rounded px-2 py-1 text-xs" />
              <input type="text" value={reason} onChange={(e) => setReason(e.target.value)}
                placeholder="Reason (e.g., Holy Week)" className="border border-gray-300 rounded px-2 py-1 text-xs w-40" />
              <button onClick={handleSave} disabled={saving}
                className="text-xs font-medium px-3 py-1.5 rounded-lg bg-amber-600 text-white hover:bg-amber-700 disabled:opacity-50">
                {saving ? "..." : "Save"}
              </button>
              <button onClick={() => setExtending(false)} className="text-xs text-gray-400 hover:text-gray-600">Cancel</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
