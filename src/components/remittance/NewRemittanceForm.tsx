"use client";

import { useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { formatCurrency, BC_RATES, TA_RATES, isCommissionable, computeInstallmentNo, MONTHS } from "@/lib/utils";
import { PlanCategory } from "@prisma/client";

interface Collector { id: string; firstName: string; lastName: string; employeeNo: string; collectorBalance?: number }
interface Branch { id: string; name: string }

interface MemberLookup {
  id: string;
  mafNo: string;
  firstName: string;
  lastName: string;
  planCategory: PlanCategory;
  mopCode: string;
  monthlyDue: number;
  effectivityDate: string | null;
  status: string;
  nextInstallmentNo: number;
  paidPaymentCount: number;
  agentActive: boolean;
}

// FREE 1st month only for monthly MOP codes (3rd char = 'M')
function isMonthlyMop(mopCode: string): boolean {
  return mopCode.length >= 3 && mopCode[2] === "M";
}

interface RemittanceRow {
  key: string;
  mafNo: string;
  memberId: string;
  memberName: string;
  installmentNo: number;
  systemInstallmentNo: number | null;
  orDate: string;
  orNo: string;
  planCategory: PlanCategory | null;
  mopCode: string;
  monthlyDue: number;
  priorPaidCount: number;
  monthsCount: number;
  isFree: boolean;
  bcOutright: boolean; // true = agent takes BC; false = BC in deposit
  agentActive: boolean; // whether the sales agent is active
  com: string;   // commissionable amount (inst 1-12)
  ncom: string;  // non-commissionable amount (inst 13+)
  others: string;
  // computed
  ta: number;
  bc: number;
  net: number;
  lookupState: "idle" | "loading" | "found" | "error";
  lookupError: string;
}

const PLAN_LABELS: Record<PlanCategory, string> = {
  EUCALYPTUS: "EUC",
  CHERRY: "CHE",
  CONIFER: "CON",
  ROSEWOOD: "ROS",
};

const PLAN_COLORS: Record<PlanCategory, string> = {
  EUCALYPTUS: "bg-green-100 text-green-700",
  CHERRY:     "bg-red-100 text-red-700",
  CONIFER:    "bg-emerald-100 text-emerald-700",
  ROSEWOOD:   "bg-rose-100 text-rose-700",
};

function emptyRow(orDate: string): RemittanceRow {
  return {
    key: Math.random().toString(36).slice(2),
    mafNo: "",
    memberId: "",
    memberName: "",
    installmentNo: 0,
    systemInstallmentNo: null,
    orDate,
    orNo: "",
    planCategory: null,
    mopCode: "",
    monthlyDue: 0,
    priorPaidCount: 0,
    monthsCount: 1,
    isFree: false,
    bcOutright: true,
    agentActive: true,
    com: "",
    ncom: "",
    others: "",
    ta: 0,
    bc: 0,
    net: 0,
    lookupState: "idle",
    lookupError: "",
  };
}

function getRowAmount(row: RemittanceRow): number {
  return (parseFloat(row.com) || 0) + (parseFloat(row.ncom) || 0);
}

function computeRowTotals(
  amount: number,
  startInstallment: number,
  monthsCount: number,
  plan: PlanCategory | null,
  others: number,
  priorPaidCount: number,
  bcOutright: boolean = true
): Pick<RemittanceRow, "bc" | "ta" | "net"> {
  if (!plan || startInstallment <= 0) return { bc: 0, ta: 0, net: amount - others };
  let bc = 0;
  let ta = 0;
  for (let i = 0; i < monthsCount; i++) {
    if (isCommissionable(startInstallment + i)) {
      bc += BC_RATES[plan];
      // TA: skip if this is the member's first-ever paid installment
      if (priorPaidCount + i > 0) {
        ta += TA_RATES[plan];
      }
    }
  }
  // If BC outright: agent took it, deduct from net (collector remits less)
  // If BC NOT outright: BC stays in deposit, collector remits full amount minus TA only
  const bcDeduction = bcOutright ? bc : 0;
  return { bc, ta, net: amount - bcDeduction - ta - others };
}

function validateOrSequential(rows: RemittanceRow[]): { valid: boolean; missing: number[] } {
  const nums = rows
    .map((r) => parseInt(r.orNo.replace(/\D/g, ""), 10))
    .filter((n) => !isNaN(n));
  if (nums.length === 0) return { valid: true, missing: [] };
  const unique = new Set(nums);
  if (unique.size !== nums.length) return { valid: false, missing: [] };
  const sorted = [...unique].sort((a, b) => a - b);
  const missing: number[] = [];
  for (let i = sorted[0]; i <= sorted[sorted.length - 1]; i++) {
    if (!unique.has(i)) missing.push(i);
  }
  return { valid: missing.length === 0, missing };
}

export default function NewRemittanceForm({
  collectors, branches, defaultBranchId, isAdmin, defaults,
}: {
  collectors: Collector[];
  branches: Branch[];
  defaultBranchId: string;
  isAdmin: boolean;
  defaults?: { receivedBy?: string; collectionSupervisor?: string; branchManager?: string; remittanceNo?: string };
}) {
  const router = useRouter();
  const today = new Date();
  const todayStr = today.toISOString().split("T")[0];

  const [collectorId, setCollectorId] = useState("");
  const [branchId, setBranchId] = useState(defaultBranchId);
  const [remittanceDate, setRemittanceDate] = useState(todayStr);
  const [remittanceNo, setRemittanceNo] = useState(defaults?.remittanceNo ?? "");
  const [periodMonth, setPeriodMonth] = useState(today.getMonth() + 1);
  const [periodYear, setPeriodYear] = useState(today.getFullYear());
  const [notes, setNotes] = useState("");

  // Footer / signature fields — auto-filled from branch employees
  const [receivedBy, setReceivedBy] = useState(defaults?.receivedBy ?? "");
  const [collectionSupervisor, setCollectionSupervisor] = useState(defaults?.collectionSupervisor ?? "");
  const [branchManagerName, setBranchManagerName] = useState(defaults?.branchManager ?? "");
  const [depositOverride, setDepositOverride] = useState<string | null>(null); // null = track net

  const [rows, setRows] = useState<RemittanceRow[]>([emptyRow(todayStr)]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [pendingBlock, setPendingBlock] = useState<{ count: number; lastDate: string } | null>(null);

  const mafInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  function handleRemittanceDateChange(val: string) {
    setRemittanceDate(val);
    setRows((prev) =>
      prev.map((r) => (r.orDate === remittanceDate ? { ...r, orDate: val } : r))
    );
  }

  function addRow() { setRows((prev) => [...prev, emptyRow(remittanceDate)]); }
  function removeRow(key: string) { setRows((prev) => prev.filter((r) => r.key !== key)); }
  function updateRow(key: string, patch: Partial<RemittanceRow>) {
    setRows((prev) => prev.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  }

  const lookupMember = useCallback(async (key: string, mafNo: string) => {
    const trimmed = mafNo.trim().toUpperCase();
    if (!trimmed) return;
    updateRow(key, { lookupState: "loading", lookupError: "", memberName: "", memberId: "", planCategory: null });
    try {
      const res = await fetch(`/api/members/lookup?mafNo=${encodeURIComponent(trimmed)}`);
      if (!res.ok) {
        const err = await res.json();
        updateRow(key, { lookupState: "error", lookupError: err.error ?? "Member not found" });
        return;
      }
      const member: MemberLookup = await res.json();

      // Use actual payment history: last paid installment + 1
      // Only fall back to date math if member has no payments yet
      let systemInst = member.nextInstallmentNo; // from DB: lastInstallmentNo + 1
      if (systemInst <= 1 && member.effectivityDate) {
        const computed = computeInstallmentNo(periodYear, periodMonth, new Date(member.effectivityDate));
        if (computed > 0) systemInst = computed;
      }

      // Only fill name + plan on lookup — installment computes after amount is entered
      updateRow(key, {
        memberId: member.id, memberName: `${member.firstName} ${member.lastName}`,
        planCategory: member.planCategory,
        mopCode: member.mopCode,
        installmentNo: 0,
        systemInstallmentNo: systemInst,
        monthlyDue: member.monthlyDue,
        priorPaidCount: member.paidPaymentCount ?? 0,
        monthsCount: 1,
        isFree: false,
        bcOutright: member.agentActive, // active agent = outright by default; deactivated = must deposit
        agentActive: member.agentActive ?? true,
        com: "", ncom: "", others: "",
        ta: 0, bc: 0, net: 0,
        lookupState: "found", lookupError: "",
      });
    } catch {
      updateRow(key, { lookupState: "error", lookupError: "Lookup failed" });
    }
  }, [periodMonth, periodYear]);

  function handleInstallmentChange(key: string, val: string) {
    const inst = parseInt(val, 10) || 0;
    setRows((prev) => prev.map((r) => {
      if (r.key !== key) return r;
      const amount = getRowAmount(r);
      const others = parseFloat(r.others) || 0;
      const { bc, ta, net } = computeRowTotals(amount, inst, r.monthsCount, r.planCategory, others, r.priorPaidCount, r.bcOutright);
      return { ...r, installmentNo: inst, bc, ta, net };
    }));
  }

  // Recalculate row when Com or NCom amount changes
  function handleComNcomChange(key: string, field: "com" | "ncom", val: string) {
    setRows((prev) => prev.map((r) => {
      if (r.key !== key) return r;
      const updated = { ...r, [field]: val };
      const amount = (parseFloat(field === "com" ? val : r.com) || 0) + (parseFloat(field === "ncom" ? val : r.ncom) || 0);
      const others = parseFloat(r.others) || 0;

      // Auto-fill installment when amount is first entered
      let inst = r.installmentNo;
      if (amount > 0 && inst === 0 && r.systemInstallmentNo !== null) {
        // If FREE is checked, paid portion starts at #2
        inst = r.isFree ? (r.systemInstallmentNo + 1) : r.systemInstallmentNo;
      }

      // Auto-detect months: amount / monthlyDue
      let months = 1;
      if (r.monthlyDue > 0 && amount > 0) {
        months = Math.max(1, Math.round(amount / r.monthlyDue));
      }

      const { bc, ta, net } = computeRowTotals(amount, inst, months, r.planCategory, others, r.priorPaidCount, r.bcOutright);
      return { ...updated, installmentNo: inst, monthsCount: months, bc, ta, net };
    }));
  }

  function handleFreeToggle(key: string, checked: boolean) {
    setRows((prev) => prev.map((r) => {
      if (r.key !== key) return r;
      const amount = getRowAmount(r);

      if (checked) {
        // FREE: paid portion starts at systemInst + 1
        const paidInst = (r.systemInstallmentNo ?? 0) + 1;
        // If amount already entered, keep it and recompute
        if (amount > 0) {
          const months = r.monthlyDue > 0 ? Math.max(1, Math.round(amount / r.monthlyDue)) : 1;
          const others = parseFloat(r.others) || 0;
          const { bc, ta, net } = computeRowTotals(amount, paidInst, months, r.planCategory, others, r.priorPaidCount, r.bcOutright);
          return { ...r, isFree: true, installmentNo: paidInst, monthsCount: months, bc, ta, net };
        }
        return { ...r, isFree: true, installmentNo: 0, monthsCount: 1, bc: 0, ta: 0, net: 0 };
      } else {
        // Uncheck: if amount exists, recompute with original installment
        if (amount > 0 && r.systemInstallmentNo) {
          const months = r.monthlyDue > 0 ? Math.max(1, Math.round(amount / r.monthlyDue)) : 1;
          const others = parseFloat(r.others) || 0;
          const { bc, ta, net } = computeRowTotals(amount, r.systemInstallmentNo, months, r.planCategory, others, r.priorPaidCount, r.bcOutright);
          return { ...r, isFree: false, installmentNo: r.systemInstallmentNo, monthsCount: months, bc, ta, net };
        }
        return { ...r, isFree: false, installmentNo: 0, monthsCount: 1, bc: 0, ta: 0, net: 0 };
      }
    }));
  }

  function handleOthersChange(key: string, val: string) {
    setRows((prev) => prev.map((r) => {
      if (r.key !== key) return r;
      const amount = getRowAmount(r);
      const others = parseFloat(val) || 0;
      const { bc, ta, net } = computeRowTotals(amount, r.installmentNo, r.monthsCount, r.planCategory, others, r.priorPaidCount, r.bcOutright);
      return { ...r, others: val, bc, ta, net };
    }));
  }

  // Column totals
  const commTotal    = rows.reduce((s, r) => s + (parseFloat(r.com) || 0), 0);
  const nonCommTotal = rows.reduce((s, r) => s + (parseFloat(r.ncom) || 0), 0);
  const totalGross   = commTotal + nonCommTotal;
  const totalBc      = rows.reduce((s, r) => s + r.bc, 0);
  const totalTa      = rows.reduce((s, r) => s + r.ta, 0);
  const totalOthers  = rows.reduce((s, r) => s + (parseFloat(r.others) || 0), 0);
  const netRemittance = totalGross - totalBc - totalTa - totalOthers;

  const filledRows = rows.filter((r) => r.orNo.trim() !== "" && r.memberId !== "");
  const orValidation = validateOrSequential(filledRows);
  const installmentMismatches = filledRows.filter(
    (r) => r.systemInstallmentNo !== null && r.installmentNo > 0 && r.installmentNo !== r.systemInstallmentNo
  );
  const canSubmit = collectorId && branchId && filledRows.length > 0
    && filledRows.every((r) => r.memberId && r.orNo.trim() && r.installmentNo > 0 && (r.isFree || getRowAmount(r) > 0))
    && orValidation.valid
    && !pendingBlock;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/remittance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          remittanceNo, collectorId, branchId, remittanceDate,
          periodMonth, periodYear,
          receivedBy: receivedBy || undefined,
          collectionSupervisor: collectionSupervisor || undefined,
          branchManagerName: branchManagerName || undefined,
          totalDeposit: depositOverride !== null ? parseFloat(depositOverride) : netRemittance,
          notes: notes || undefined,
          rows: filledRows.map((r) => ({
            orNo: r.orNo.trim(), orDate: r.orDate, memberId: r.memberId,
            startInstallmentNo: r.installmentNo,
            monthsCount: r.monthsCount,
            isFree: r.isFree,
            bcOutright: r.bcOutright,
            periodMonth, periodYear,
            amount: getRowAmount(r),
            others: parseFloat(r.others) || 0,
          })),
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(typeof err.error === "string" ? err.error : "Failed to save remittance.");
      }
      const saved = await res.json();
      router.push(`/remittance/${saved.id}`);
    } catch (err: any) {
      setError(err.message);
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* ── Header ── */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
        <h2 className="font-semibold text-gray-800 mb-4 pb-2 border-b">Remittance Details</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Remittance No. *</label>
            <input className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
              required value={remittanceNo} onChange={(e) => setRemittanceNo(e.target.value)} />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Remittance Date *</label>
            <input type="date" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
              required value={remittanceDate} onChange={(e) => handleRemittanceDateChange(e.target.value)} />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Collection Period *</label>
            <div className="flex gap-2">
              <select className="flex-1 border border-gray-300 rounded-lg px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                value={periodMonth} onChange={(e) => setPeriodMonth(Number(e.target.value))}>
                {MONTHS.map((m, i) => <option key={i + 1} value={i + 1}>{m}</option>)}
              </select>
              <input type="number" className="w-24 border border-gray-300 rounded-lg px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                value={periodYear} onChange={(e) => setPeriodYear(Number(e.target.value))} min={2020} max={2099} />
            </div>
          </div>
          {isAdmin && (
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Branch *</label>
              <select className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                required value={branchId} onChange={(e) => setBranchId(e.target.value)}>
                <option value="">Select Branch</option>
                {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </div>
          )}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Collector (AO) *</label>
            <select className={`w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 ${pendingBlock ? "border-red-400" : "border-gray-300"}`}
              required value={collectorId} onChange={async (e) => {
                const id = e.target.value;
                setCollectorId(id);
                setPendingBlock(null);
                if (!id) return;
                try {
                  const res = await fetch(`/api/remittance/check-pending?collectorId=${id}&branchId=${branchId}`);
                  if (res.ok) {
                    const data = await res.json();
                    if (data.pending > 0) {
                      setPendingBlock({ count: data.pending, lastDate: data.lastDate });
                    }
                  }
                } catch {}
              }}>
              <option value="">Select Collector</option>
              {collectors.map((c) => (
                <option key={c.id} value={c.id}>{c.firstName} {c.lastName} ({c.employeeNo})</option>
              ))}
            </select>
            {pendingBlock && (
              <div className="mt-2 bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-xs text-red-700">
                <span className="font-bold">BLOCKED:</span> This collector has {pendingBlock.count} unremitted collection{pendingBlock.count > 1 ? "s" : ""} (last: {pendingBlock.lastDate}).
                All pending remittances must be submitted before creating a new one.
              </div>
            )}
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Notes</label>
            <input className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
              value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional notes..." />
          </div>
        </div>
      </div>

      {/* ── Collection Rows ── */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-5 py-3 border-b bg-gray-50 flex items-center justify-between">
          <div>
            <h2 className="font-semibold text-gray-800 text-sm">Collection Entries</h2>
            <p className="text-xs text-gray-400 mt-0.5">Enter each OR. Numbers must be sequential with no gaps.</p>
          </div>
          <button type="button" onClick={addRow}
            className="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-xs font-semibold">
            + Add Row
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm" style={{ minWidth: 1100 }}>
            <thead className="bg-gray-50 text-gray-500 text-xs border-b uppercase">
              <tr>
                <th className="px-2 py-2 text-left w-28">MAF No</th>
                <th className="px-2 py-2 text-left">Member&apos;s Name</th>
                <th className="px-2 py-2 text-center w-20">Inst. No.</th>
                <th className="px-2 py-2 text-left w-28">OR Date</th>
                <th className="px-2 py-2 text-left w-24">OR No.</th>
                <th className="px-2 py-2 text-center w-14">Plan</th>
                <th className="px-2 py-2 text-right w-24">Com</th>
                <th className="px-2 py-2 text-right w-24">NCom</th>
                <th className="px-2 py-2 text-right w-20">Others</th>
                <th className="px-2 py-2 text-right w-18">TA</th>
                <th className="px-2 py-2 text-right w-18">BC</th>
                <th className="px-2 py-2 text-right w-22">Net</th>
                <th className="px-2 py-2 w-8"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {rows.map((row) => {
                const rowAmt = getRowAmount(row);
                return (
                <tr key={row.key} className={row.lookupState === "error" ? "bg-red-50" : "bg-white"}>
                  {/* MAF No */}
                  <td className="px-2 py-1.5">
                    <input
                      ref={(el) => { mafInputRefs.current[row.key] = el; }}
                      className="w-full border border-gray-300 rounded px-2 py-1 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-purple-500"
                      placeholder="MAF No." value={row.mafNo}
                      onChange={(e) => updateRow(row.key, { mafNo: e.target.value.toUpperCase() })}
                      onBlur={(e) => { if (e.target.value.trim()) lookupMember(row.key, e.target.value); }}
                      onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); lookupMember(row.key, row.mafNo); } }}
                    />
                  </td>

                  {/* Member's Name */}
                  <td className="px-2 py-1.5">
                    {row.lookupState === "loading" && <span className="text-xs text-gray-400 animate-pulse">Looking up...</span>}
                    {row.lookupState === "found" && <span className="text-xs font-medium text-gray-800">{row.memberName}</span>}
                    {row.lookupState === "error" && <span className="text-xs text-red-600">{row.lookupError}</span>}
                    {row.lookupState === "idle" && <span className="text-xs text-gray-300">—</span>}
                  </td>

                  {/* Inst. No. */}
                  <td className="px-2 py-1.5">
                    <input type="number" min={1}
                      className={`w-full border rounded px-2 py-1 text-xs text-center focus:outline-none focus:ring-1 focus:ring-purple-500 ${
                        (() => {
                          const exp = row.isFree ? (row.systemInstallmentNo ?? 0) + 1 : row.systemInstallmentNo;
                          if (row.installmentNo > 0 && exp !== null && row.installmentNo !== exp) return "border-red-400 bg-red-50";
                          if (row.installmentNo > 0 && exp !== null) return "border-green-400 bg-green-50";
                          return "border-gray-300";
                        })()
                      }`}
                      value={row.installmentNo || ""}
                      placeholder="—"
                      onChange={(e) => handleInstallmentChange(row.key, e.target.value)}
                      disabled={row.lookupState !== "found"} />
                    {row.installmentNo > 0 && row.monthsCount > 1 && (
                      <div className="text-xs text-purple-600 font-semibold mt-0.5 text-center whitespace-nowrap">
                        #{row.installmentNo}-{row.installmentNo + row.monthsCount - 1}
                        <span className="font-normal text-gray-400 ml-0.5">({row.monthsCount}mo)</span>
                      </div>
                    )}
                    {(() => {
                      const expectedInst = row.isFree ? (row.systemInstallmentNo ?? 0) + 1 : row.systemInstallmentNo;
                      const matches = row.installmentNo > 0 && expectedInst !== null && row.installmentNo === expectedInst;
                      const mismatches = row.installmentNo > 0 && expectedInst !== null && row.installmentNo !== expectedInst;
                      return row.monthsCount <= 1 ? (
                        <>
                          {mismatches && <div className="text-xs text-red-600 font-medium mt-0.5 text-center whitespace-nowrap">⚠ sys: #{expectedInst}</div>}
                          {matches && <div className="text-xs text-green-600 mt-0.5 text-center">✓</div>}
                        </>
                      ) : null;
                    })()}
                    {row.installmentNo === 0 && row.lookupState === "found" && (
                      <div className="text-xs text-gray-400 mt-0.5 text-center">enter amt</div>
                    )}
                  </td>

                  {/* OR Date */}
                  <td className="px-2 py-1.5">
                    <input type="date" className="w-full border border-gray-300 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-purple-500"
                      value={row.orDate} onChange={(e) => updateRow(row.key, { orDate: e.target.value })} />
                  </td>

                  {/* OR No. */}
                  <td className="px-2 py-1.5">
                    <input className="w-full border border-gray-300 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-purple-500"
                      placeholder="0001" value={row.orNo}
                      onChange={(e) => updateRow(row.key, { orNo: e.target.value })} />
                  </td>

                  {/* Plan Type */}
                  <td className="px-2 py-1.5 text-center">
                    {row.planCategory
                      ? <span className={`text-xs font-semibold px-1.5 py-0.5 rounded-full ${PLAN_COLORS[row.planCategory]}`}>{PLAN_LABELS[row.planCategory]}</span>
                      : <span className="text-xs text-gray-300">—</span>}
                    {/* FREE toggle — only for new monthly members (installment #1) */}
                    {row.lookupState === "found" && row.systemInstallmentNo === 1 && isMonthlyMop(row.mopCode) && (
                      <label className="flex items-center justify-center gap-1 mt-1 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={row.isFree}
                          onChange={(e) => handleFreeToggle(row.key, e.target.checked)}
                          className="w-3 h-3 rounded"
                        />
                        <span className="text-xs text-blue-600 font-semibold">FREE</span>
                      </label>
                    )}
                    {row.isFree && (
                      <span className="block text-xs bg-blue-100 text-blue-700 rounded-full px-2 py-0.5 mt-1 font-semibold">FREE #1</span>
                    )}
                  </td>

                  {/* Com (commissionable) */}
                  <td className="px-2 py-1.5">
                    <input type="number" step="0.01" min={0}
                      className="w-full border border-gray-300 rounded px-2 py-1 text-xs text-right focus:outline-none focus:ring-1 focus:ring-purple-500"
                      value={row.com} placeholder="0"
                      onChange={(e) => handleComNcomChange(row.key, "com", e.target.value)}
                      disabled={row.lookupState !== "found"} />
                  </td>

                  {/* NCom (non-commissionable) */}
                  <td className="px-2 py-1.5">
                    <input type="number" step="0.01" min={0}
                      className="w-full border border-gray-300 rounded px-2 py-1 text-xs text-right focus:outline-none focus:ring-1 focus:ring-purple-500"
                      value={row.ncom} placeholder="0"
                      onChange={(e) => handleComNcomChange(row.key, "ncom", e.target.value)}
                      disabled={row.lookupState !== "found"} />
                  </td>

                  {/* Others */}
                  <td className="px-2 py-1.5">
                    <input type="number" step="0.01" min={0}
                      className="w-full border border-gray-300 rounded px-2 py-1 text-xs text-right focus:outline-none focus:ring-1 focus:ring-purple-500"
                      value={row.others} placeholder="0"
                      onChange={(e) => handleOthersChange(row.key, e.target.value)}
                      disabled={row.lookupState !== "found"} />
                  </td>

                  {/* TA */}
                  <td className="px-2 py-1.5 text-right">
                    <span className={`text-xs ${row.ta > 0 ? "text-blue-600 font-medium" : "text-gray-300"}`}>
                      {row.ta > 0 ? formatCurrency(row.ta) : "—"}
                    </span>
                  </td>

                  {/* BC + outright toggle */}
                  <td className="px-2 py-1.5 text-right">
                    <span className={`text-xs ${row.bc > 0 ? "text-orange-600 font-medium" : "text-gray-300"}`}>
                      {row.bc > 0 ? formatCurrency(row.bc) : "—"}
                    </span>
                    {row.bc > 0 && (
                      <label className="flex items-center justify-end gap-1 mt-0.5 cursor-pointer" title={
                        !row.agentActive ? "Agent deactivated — BC goes to company" :
                        row.bcOutright ? "Agent takes BC outright" : "BC included in deposit (lump sum)"
                      }>
                        <input
                          type="checkbox"
                          checked={row.bcOutright}
                          disabled={!row.agentActive}
                          onChange={(e) => {
                            const checked = e.target.checked;
                            setRows(prev => prev.map(r => {
                              if (r.key !== row.key) return r;
                              const amount = getRowAmount(r);
                              const others = parseFloat(r.others) || 0;
                              const { bc, ta, net } = computeRowTotals(amount, r.installmentNo, r.monthsCount, r.planCategory, others, r.priorPaidCount, checked);
                              return { ...r, bcOutright: checked, bc, ta, net };
                            }));
                          }}
                          className="w-3 h-3 rounded accent-orange-500"
                        />
                        <span className={`text-[9px] font-semibold ${!row.agentActive ? "text-red-500" : row.bcOutright ? "text-orange-600" : "text-gray-400"}`}>
                          {!row.agentActive ? "TO CO." : row.bcOutright ? "OUTRIGHT" : "LUMP"}
                        </span>
                      </label>
                    )}
                  </td>

                  {/* Net */}
                  <td className="px-2 py-1.5 text-right">
                    <span className={`text-xs font-semibold ${rowAmt > 0 ? "text-green-700" : "text-gray-300"}`}>
                      {rowAmt > 0 ? formatCurrency(row.net) : "—"}
                    </span>
                  </td>

                  {/* Remove */}
                  <td className="px-2 py-1.5 text-center">
                    {rows.length > 1 && (
                      <button type="button" onClick={() => removeRow(row.key)}
                        className="text-red-400 hover:text-red-600 text-xs font-bold">✕</button>
                    )}
                  </td>
                </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* OR validation */}
        {filledRows.length > 1 && !orValidation.valid && (
          <div className="mx-4 my-2 px-4 py-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700 flex items-start gap-2">
            <span className="font-bold">⚠</span>
            <div>
              <span className="font-semibold">OR numbers are not sequential.</span>{" "}
              {orValidation.missing.length > 0
                ? `Missing: ${orValidation.missing.join(", ")}. Locate the missing OR(s) before submitting.`
                : "Duplicate OR numbers detected."}
            </div>
          </div>
        )}

        {/* Totals summary */}
        <div className="px-5 py-4 border-t bg-gray-50">
          <div className="grid grid-cols-2 gap-x-8 gap-y-1.5 max-w-lg ml-auto text-sm">
            <span className="text-gray-500">COMM Collection</span>
            <span className="text-right font-medium">{formatCurrency(commTotal)}</span>

            <span className="text-gray-500">NONCOMM Collection</span>
            <span className="text-right font-medium">{formatCurrency(nonCommTotal)}</span>

            <span className="text-gray-500">Total Gross</span>
            <span className="text-right font-bold text-gray-900">{formatCurrency(totalGross)}</span>

            <span className="text-orange-600">− Basic Commission (BC)</span>
            <span className="text-right text-orange-600 font-medium">{formatCurrency(totalBc)}</span>

            <span className="text-blue-600">− Travelling Allowance (TA)</span>
            <span className="text-right text-blue-600 font-medium">{formatCurrency(totalTa)}</span>

            {totalOthers > 0 && <>
              <span className="text-gray-500">− Others</span>
              <span className="text-right text-gray-600 font-medium">{formatCurrency(totalOthers)}</span>
            </>}

            <span className="text-green-700 font-bold border-t pt-1.5">NET Remittance</span>
            <span className="text-right text-green-700 font-bold text-base border-t pt-1.5">{formatCurrency(netRemittance)}</span>
          </div>
        </div>
      </div>

      {/* ── Add row button ── */}
      <button type="button" onClick={addRow}
        className="w-full py-2.5 border-2 border-dashed border-purple-300 rounded-xl text-purple-600 text-sm font-medium hover:bg-purple-50 transition-colors">
        + Add Collection Entry
      </button>

      {/* ── Signatures & Deposit ── */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm space-y-5">
        <h2 className="font-semibold text-gray-800 pb-2 border-b">Signatures & Deposit</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Received By (Branch Staff)</label>
            <input className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
              placeholder="Name..." value={receivedBy} onChange={(e) => setReceivedBy(e.target.value)} />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Verified by (Collection Supervisor)</label>
            <input className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
              placeholder="Name..." value={collectionSupervisor} onChange={(e) => setCollectionSupervisor(e.target.value)} />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Verified by (Branch Manager)</label>
            <input className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
              placeholder="Name..." value={branchManagerName} onChange={(e) => setBranchManagerName(e.target.value)} />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Total Deposit (₱) — from bank receipt</label>
            <input type="number" step="0.01" min={0}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-purple-500"
              value={depositOverride !== null ? depositOverride : (netRemittance > 0 ? netRemittance.toFixed(2) : "")}
              placeholder="= NET Remittance"
              onChange={(e) => setDepositOverride(e.target.value)} />
            {depositOverride === null && netRemittance > 0 && (
              <p className="text-xs text-gray-400 mt-0.5">Auto-filled from NET Remittance</p>
            )}
          </div>
        </div>

        {/* ── Collector Balance / Variance ── */}
        {(() => {
          const selectedCollector = collectors.find((c) => c.id === collectorId);
          const currentBalance = selectedCollector?.collectorBalance ?? 0;
          const actualDeposit = depositOverride !== null ? (parseFloat(depositOverride) || 0) : netRemittance;
          const variance = actualDeposit - netRemittance; // positive=surplus, negative=deficit
          const projectedBalance = currentBalance + variance;

          if (!collectorId) return null;

          return (
            <div className={`rounded-lg border p-4 ${
              projectedBalance < 0 ? "bg-red-50 border-red-200" :
              projectedBalance > 0 ? "bg-blue-50 border-blue-200" :
              "bg-gray-50 border-gray-200"
            }`}>
              <div className="grid grid-cols-3 gap-4 text-sm">
                {/* Carry-over balance */}
                <div>
                  <p className="text-xs text-gray-500 mb-0.5">Carry-over Balance</p>
                  <p className={`font-bold text-base ${
                    currentBalance < 0 ? "text-red-700" : currentBalance > 0 ? "text-blue-700" : "text-gray-600"
                  }`}>
                    {currentBalance < 0 ? `−₱${Math.abs(currentBalance).toLocaleString("en-PH", { minimumFractionDigits: 2 })} DEFICIT` :
                     currentBalance > 0 ? `+₱${currentBalance.toLocaleString("en-PH", { minimumFractionDigits: 2 })} SURPLUS` :
                     "₱0.00 — No balance"}
                  </p>
                </div>

                {/* This remittance variance */}
                <div>
                  <p className="text-xs text-gray-500 mb-0.5">This Remittance Variance</p>
                  <p className={`font-bold text-base ${
                    variance < 0 ? "text-red-700" : variance > 0 ? "text-blue-700" : "text-green-700"
                  }`}>
                    {variance < 0 ? `−₱${Math.abs(variance).toLocaleString("en-PH", { minimumFractionDigits: 2 })} SHORT` :
                     variance > 0 ? `+₱${variance.toLocaleString("en-PH", { minimumFractionDigits: 2 })} OVER` :
                     "₱0.00 — Exact"}
                  </p>
                  {variance !== 0 && (
                    <p className="text-xs text-gray-500">
                      Deposit {formatCurrency(actualDeposit)} vs NET {formatCurrency(netRemittance)}
                    </p>
                  )}
                </div>

                {/* Projected balance after this remittance */}
                <div>
                  <p className="text-xs text-gray-500 mb-0.5">Balance After This Remittance</p>
                  <p className={`font-bold text-lg ${
                    projectedBalance < 0 ? "text-red-700" : projectedBalance > 0 ? "text-blue-700" : "text-green-700"
                  }`}>
                    {projectedBalance < 0 ? `−₱${Math.abs(projectedBalance).toLocaleString("en-PH", { minimumFractionDigits: 2 })}` :
                     projectedBalance > 0 ? `+₱${projectedBalance.toLocaleString("en-PH", { minimumFractionDigits: 2 })}` :
                     "₱0.00"}
                  </p>
                  {projectedBalance < 0 && (
                    <p className="text-xs text-red-600 font-medium">Collector must cover this deficit in next remittance</p>
                  )}
                  {projectedBalance > 0 && (
                    <p className="text-xs text-blue-600 font-medium">Surplus resets to ₱0 at end of month operation</p>
                  )}
                </div>
              </div>
            </div>
          );
        })()}
      </div>

      {/* Installment mismatch warning — advisory, not blocking */}
      {installmentMismatches.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 text-sm text-amber-800">
          <p className="font-semibold mb-1">⚠ Installment number mismatch on {installmentMismatches.length} row{installmentMismatches.length > 1 ? "s" : ""}:</p>
          <ul className="list-disc ml-4 space-y-0.5 text-xs">
            {installmentMismatches.map((r) => (
              <li key={r.key}>
                <span className="font-medium">{r.memberName || r.mafNo}</span> — collector wrote{" "}
                <span className="font-bold text-red-700">#{r.installmentNo}</span>, system expects{" "}
                <span className="font-bold text-green-700">#{r.systemInstallmentNo}</span>.{" "}
                Verify with the physical OR before submitting.
              </li>
            ))}
          </ul>
          <p className="text-xs mt-2 text-amber-700">You can still submit — correct the installment number if the collector made an error.</p>
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-lg">{error}</div>
      )}

      <div className="flex gap-3 justify-end pb-6">
        <button type="button" onClick={() => router.back()}
          className="px-5 py-2.5 border border-gray-300 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-50">
          Cancel
        </button>
        <button type="submit" disabled={loading || !canSubmit}
          className="px-5 py-2.5 text-white rounded-lg text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          style={{ background: loading || !canSubmit ? "#a78bfa" : "#7c3aed" }}>
          {loading ? "Saving..." : `Submit Remittance (${filledRows.length} entr${filledRows.length !== 1 ? "ies" : "y"})`}
        </button>
      </div>
    </form>
  );
}
