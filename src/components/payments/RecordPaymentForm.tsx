"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { formatCurrency, getPaymentAmount, computeInstallmentNo, MONTHS } from "@/lib/utils";
import { MopCode } from "@prisma/client";

interface Member {
  id: string;
  mafNo: string;
  firstName: string;
  lastName: string;
  monthlyDue: number | string;
  mopCode: MopCode;
  effectivityDate?: string | null;
  enrollmentDate: string;
}

interface Collector {
  id: string;
  firstName: string;
  lastName: string;
  code: string;
}

// Build a list of N consecutive periods starting from (startMonth, startYear)
function buildPeriods(startMonth: number, startYear: number, months: number) {
  const result = [];
  let m = startMonth;
  let y = startYear;
  for (let i = 0; i < months; i++) {
    result.push({ month: m, year: y });
    m++;
    if (m > 12) { m = 1; y++; }
  }
  return result;
}

export default function RecordPaymentForm({
  members,
  collectors,
  defaultMemberId,
}: {
  members: Member[];
  collectors: Collector[];
  defaultMemberId: string;
}) {
  const router = useRouter();
  const today = new Date();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [memberId, setMemberId] = useState(defaultMemberId);
  const [collectorId, setCollectorId] = useState("");
  const [periodMonth, setPeriodMonth] = useState(today.getMonth() + 1);
  const [periodYear, setPeriodYear] = useState(today.getFullYear());
  const [months, setMonths] = useState(1);
  const [paymentDate, setPaymentDate] = useState(today.toISOString().split("T")[0]);
  const [amountPerMonth, setAmountPerMonth] = useState("");
  const [startInstallmentNo, setStartInstallmentNo] = useState<number | "">("");
  const [isFree, setIsFree] = useState(false);
  const [isSpotCash, setIsSpotCash] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState("CASH");
  const [notes, setNotes] = useState("");

  const selectedMember = members.find((m) => m.id === memberId);

  // When member changes, auto-advance starting period to their next unpaid month
  useEffect(() => {
    if (!memberId) return;
    fetch(`/api/payments?memberId=${memberId}`)
      .then((r) => r.json())
      .then((payments: { periodYear: number; periodMonth: number }[]) => {
        if (!Array.isArray(payments) || payments.length === 0) {
          // New member — default to current month
          setPeriodMonth(today.getMonth() + 1);
          setPeriodYear(today.getFullYear());
          return;
        }
        // Payments are ordered desc — first is the latest paid period
        const latest = payments[0];
        let nextMonth = latest.periodMonth + 1;
        let nextYear = latest.periodYear;
        if (nextMonth > 12) { nextMonth = 1; nextYear++; }
        setPeriodMonth(nextMonth);
        setPeriodYear(nextYear);
      })
      .catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [memberId]);

  // Auto-compute starting installment number
  useEffect(() => {
    if (selectedMember) {
      const effDate = selectedMember.effectivityDate ?? selectedMember.enrollmentDate;
      if (effDate) {
        const inst = computeInstallmentNo(periodYear, periodMonth, new Date(effDate));
        setStartInstallmentNo(inst > 0 ? inst : 1);
      }
    } else {
      setStartInstallmentNo("");
    }
  }, [memberId, periodMonth, periodYear, selectedMember]);

  // Auto-fill amount per month (always use regular amount; FREE just zeroes the first record)
  useEffect(() => {
    if (selectedMember) {
      setAmountPerMonth(getPaymentAmount(selectedMember.mopCode).toString());
    }
  }, [memberId, selectedMember]);

  // Reset months to 1 when spot cash only
  useEffect(() => {
    if (isSpotCash) setMonths(1);
  }, [isSpotCash]);

  // Build preview of all periods
  const periods = useMemo(
    () => buildPeriods(periodMonth, periodYear, months),
    [periodMonth, periodYear, months]
  );

  // When isFree, first period is ₱0; only (months-1) periods are paid
  const paidMonths = isFree ? months - 1 : months;
  const totalAmount = (parseFloat(amountPerMonth) || 0) * paidMonths;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    setSuccess("");

    try {
      const res = await fetch("/api/payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          memberId,
          collectorId: collectorId || undefined,
          startPeriodMonth: periodMonth,
          startPeriodYear: periodYear,
          months,
          startInstallmentNo: startInstallmentNo || undefined,
          paymentDate,
          amountPerMonth: parseFloat(amountPerMonth),
          isFree,
          isSpotCash,
          paymentMethod,
          notes: notes || undefined,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error?.toString() ?? "Failed to record payment.");
      }

      const count = months;
      setSuccess(`${count} payment${count > 1 ? "s" : ""} recorded successfully!`);
      setTimeout(() => {
        if (defaultMemberId) {
          router.push(`/members/${defaultMemberId}`);
        } else {
          setSuccess("");
          setMemberId("");
          setMonths(1);
          setNotes("");
        }
      }, 1200);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 space-y-5">

      {/* Member */}
      <div>
        <label className="label">Member *</label>
        <select className="input" required value={memberId} onChange={(e) => setMemberId(e.target.value)}>
          <option value="">Select Member</option>
          {members.map((m) => (
            <option key={m.id} value={m.id}>
              {m.mafNo} — {m.firstName} {m.lastName}
            </option>
          ))}
        </select>
        {selectedMember && (
          <p className="text-xs text-gray-500 mt-1">
            Plan: {selectedMember.mopCode} · Monthly Due: {formatCurrency(Number(selectedMember.monthlyDue))}
          </p>
        )}
      </div>

      {/* Starting Period + Installment */}
      <div className="grid grid-cols-3 gap-4">
        <div>
          <label className="label">Starting Month *</label>
          <select className="input" value={periodMonth} onChange={(e) => setPeriodMonth(parseInt(e.target.value))}>
            {MONTHS.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Year *</label>
          <select className="input" value={periodYear} onChange={(e) => setPeriodYear(parseInt(e.target.value))}>
            {Array.from({ length: 10 }, (_, i) => today.getFullYear() - i).map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">
            Starting Inst. #
            <span className="ml-1 text-xs font-normal text-gray-400">(auto)</span>
          </label>
          <input
            type="number"
            min={1}
            className="input"
            value={startInstallmentNo}
            onChange={(e) => setStartInstallmentNo(parseInt(e.target.value) || "")}
            placeholder="—"
          />
        </div>
      </div>

      {/* Number of months */}
      <div>
        <label className="label">
          Number of Months
          <span className="ml-1 text-xs font-normal text-gray-400">— advance payment</span>
        </label>
        <div className="flex items-center gap-3">
          <input
            type="number"
            min={isFree ? 1 : 1}
            max={12}
            className="input w-24"
            value={months}
            disabled={isSpotCash}
            onChange={(e) => setMonths(Math.max(1, Math.min(12, parseInt(e.target.value) || 1)))}
          />
          <span className="text-sm text-gray-500">
            {isFree
              ? months === 1
                ? "1 FREE month only"
                : `1 FREE + ${months - 1} paid month${months - 1 > 1 ? "s" : ""}`
              : months > 1
              ? `${months} months advance payment`
              : "Single month"}
          </span>
        </div>

        {/* Period preview */}
        {(months > 1 || isFree) && selectedMember && startInstallmentNo !== "" && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {periods.map((p, i) => {
              const inst = Number(startInstallmentNo) + i;
              const isThisFree = isFree && i === 0;
              const isComm = inst <= 12;
              return (
                <span
                  key={i}
                  className={`text-xs px-2 py-0.5 rounded-full font-medium border ${
                    isThisFree
                      ? "bg-blue-50 border-blue-200 text-blue-700"
                      : isComm
                      ? "bg-orange-50 border-orange-200 text-orange-700"
                      : "bg-gray-50 border-gray-200 text-gray-600"
                  }`}
                >
                  {MONTHS[p.month - 1].slice(0, 3)} {p.year} #{inst}{isThisFree ? " FREE" : ""}
                </span>
              );
            })}
          </div>
        )}
      </div>

      {/* Date paid */}
      <div>
        <label className="label">Date Paid *</label>
        <input
          type="date"
          className="input"
          required
          value={paymentDate}
          onChange={(e) => setPaymentDate(e.target.value)}
        />
      </div>

      {/* Flags */}
      <div className="flex gap-6">
        <label className={`flex items-center gap-2 text-sm ${Number(startInstallmentNo) === 1 ? "cursor-pointer" : "cursor-not-allowed opacity-40"}`}>
          <input
            type="checkbox"
            checked={isFree}
            disabled={Number(startInstallmentNo) !== 1}
            onChange={(e) => setIsFree(e.target.checked)}
            className="w-4 h-4 rounded border-gray-300"
          />
          <span>
            FREE (1st month)
            {Number(startInstallmentNo) > 1 && (
              <span className="ml-1 text-xs text-gray-400">— new members only</span>
            )}
          </span>
        </label>
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <input
            type="checkbox"
            checked={isSpotCash}
            onChange={(e) => setIsSpotCash(e.target.checked)}
            className="w-4 h-4 rounded border-gray-300"
          />
          <span>Spot Cash</span>
        </label>
      </div>

      {/* Amount per month + total */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="label">Amount per Month *</label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">₱</span>
            <input
              type="number"
              step="0.01"
              className="input pl-7"
              required
              value={amountPerMonth}
              onChange={(e) => setAmountPerMonth(e.target.value)}
            />
          </div>
        </div>
        {(months > 1 || isFree) && (
          <div>
            <label className="label">Total Cash Received</label>
            <div className="input bg-gray-50 font-semibold text-gray-800 flex items-center">
              {formatCurrency(totalAmount)}
              {paidMonths > 0 && (
                <span className="ml-2 text-xs font-normal text-gray-400">
                  ({formatCurrency(parseFloat(amountPerMonth) || 0)} × {paidMonths}{isFree ? " paid" : ""})
                </span>
              )}
              {isFree && paidMonths === 0 && (
                <span className="ml-2 text-xs font-normal text-gray-400">FREE month only</span>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Collector */}
      <div>
        <label className="label">Collected By</label>
        <select className="input" value={collectorId} onChange={(e) => setCollectorId(e.target.value)}>
          <option value="">Walk-in / Office</option>
          {collectors.map((c) => (
            <option key={c.id} value={c.id}>{c.firstName} {c.lastName} ({c.code})</option>
          ))}
        </select>
      </div>

      {/* Payment method */}
      <div>
        <label className="label">Payment Method</label>
        <select className="input" value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)}>
          <option value="CASH">Cash</option>
          <option value="GCASH">GCash</option>
          <option value="BANK_TRANSFER">Bank Transfer</option>
          <option value="OTHER">Other</option>
        </select>
      </div>

      {/* Notes */}
      <div>
        <label className="label">Notes</label>
        <textarea
          className="input resize-none"
          rows={2}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-lg">{error}</div>
      )}
      {success && (
        <div className="bg-green-50 border border-green-200 text-green-700 text-sm px-4 py-3 rounded-lg">{success}</div>
      )}

      <div className="flex gap-3 justify-end pt-2">
        <button
          type="button"
          onClick={() => router.back()}
          className="px-5 py-2.5 border border-gray-300 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-50"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={loading}
          className="px-5 py-2.5 bg-green-600 hover:bg-green-700 disabled:bg-green-300 text-white rounded-lg text-sm font-semibold"
        >
          {loading
            ? "Saving..."
            : months > 1 || isFree
            ? `Record ${months} Payment${months > 1 ? "s" : ""} (${formatCurrency(totalAmount)})`
            : "Record Payment"}
        </button>
      </div>
    </form>
  );
}
