"use client";

import Link from "next/link";
import { POSITION_LABELS } from "@/lib/utils";
import type { IncentiveResult } from "@/lib/incentives";
import type { EmployeePosition } from "@prisma/client";

const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];

function fmt(n: number) {
  const prefix = n < 0 ? "-" : "";
  return `${prefix}₱${Math.abs(n).toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default function IndividualISR({
  result, employee, branchName, month, year,
}: {
  result: IncentiveResult;
  employee: { name: string; address: string; position: EmployeePosition };
  branchName: string;
  month: number;
  year: number;
}) {
  const r = result;

  // Build earnings rows (only show applicable items)
  const earnings: { label: string; value: number }[] = [];
  if (r.outrightCommission > 0) earnings.push({ label: "Basic Commission (BC)", value: r.outrightCommission });
  if (r.travellingAllowance > 0) earnings.push({ label: "Travelling Allowance (TA)", value: r.travellingAllowance });
  if (r.moIncentives > 0) earnings.push({ label: "MO Incentives (Personal PI)", value: r.moIncentives });
  if (r.positions.includes("MH")) earnings.push({ label: "MH Incentives (Group PI + Allowance)", value: r.mhIncentives });
  if (r.positions.includes("AM")) earnings.push({ label: "AM Incentives (Network PI + Allowance)", value: r.amIncentives });
  if (r.positions.includes("AO")) {
    earnings.push({ label: "Collector's Incentives (CI)", value: r.collectorIncentives });
  }
  if (r.positions.includes("CS")) earnings.push({ label: "CS Incentives", value: r.csIncentives });
  if (r.positions.includes("BM")) earnings.push({ label: "BM Incentives", value: r.bmIncentives });

  // If no earnings at all, show a zero commission line
  if (earnings.length === 0) {
    earnings.push({ label: "Basic Commission", value: 0 });
  }

  const totalEarnings = earnings.reduce((s, e) => s + e.value, 0);

  // Deductions: outright BC (already taken) + TA (goes to collector) + company BC + cash bond + lapsed
  const filteredDeductions: { label: string; value: number }[] = [];
  if (r.outrightBC > 0) filteredDeductions.push({ label: "BC (received outright)", value: r.outrightBC });
  if (r.companyBC > 0) filteredDeductions.push({ label: "BC (remitted to company)", value: r.companyBC });
  if (r.outrightTA > 0) filteredDeductions.push({ label: "TA (received by collector)", value: r.outrightTA });
  if (r.cashBond > 0) filteredDeductions.push({ label: "Cash Bond", value: r.cashBond });
  if (r.lapsableAccounts > 0) filteredDeductions.push({ label: `Lapsed Charges (${r.lapsableAccounts} acct${r.lapsableAccounts > 1 ? "s" : ""} × ₱5)`, value: r.lapsedCharges });
  const totalDeductions = filteredDeductions.reduce((s, d) => s + d.value, 0);

  const posLabel = POSITION_LABELS[employee.position]?.split(" – ")[1] ?? employee.position;

  return (
    <>
      <div className="print:hidden flex items-center justify-between mb-5">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Income Summary Report</h1>
          <p className="text-sm text-gray-500">{employee.name} — {MONTHS[month - 1]} {year}</p>
        </div>
        <div className="flex gap-3">
          <Link href={`/incentives?month=${month}&year=${year}`}
            className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-50">
            ← Master List
          </Link>
          <button onClick={() => window.print()}
            className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-sm font-semibold">
            Print ISR
          </button>
        </div>
      </div>

      <div id="isr-individual" className="bg-white border border-gray-200 rounded-xl shadow-sm print:shadow-none print:border-none max-w-xl mx-auto overflow-hidden">

        {/* Header */}
        <div className="bg-gray-900 text-white px-6 py-5 text-center print:bg-white print:text-black print:border-b-2 print:border-black">
          <p className="text-lg font-bold tracking-wide">TRIPLE J MORTUARY CARE SERVICES CORP.</p>
          <p className="text-sm font-semibold mt-0.5 opacity-80 print:opacity-100">INCOME SUMMARY REPORT</p>
          <p className="text-xs mt-1 opacity-60 print:opacity-100">{branchName}</p>
        </div>

        {/* Employee Info */}
        <div className="px-6 py-4 bg-gray-50 border-b print:bg-white">
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <p className="text-[10px] text-gray-400 uppercase">Name</p>
              <p className="font-bold text-gray-900">{employee.name}</p>
            </div>
            <div className="text-right">
              <p className="text-[10px] text-gray-400 uppercase">Month Operation</p>
              <p className="font-bold text-gray-900">{MONTHS[month - 1]} {year}</p>
            </div>
            <div>
              <p className="text-[10px] text-gray-400 uppercase">Position</p>
              <p className="font-semibold text-gray-700">{posLabel}</p>
            </div>
            <div className="text-right">
              <p className="text-[10px] text-gray-400 uppercase">Date Issued</p>
              <p className="font-semibold text-gray-700">{new Date().toLocaleDateString()}</p>
            </div>
          </div>
        </div>

        {/* Production Summary */}
        {(r.personalProduction > 0 || r.groupProduction > 0 || r.ne > 0) && (
          <div className="px-6 py-3 border-b">
            <p className="text-[10px] text-gray-400 uppercase font-semibold mb-2">Production</p>
            <div className="grid grid-cols-3 gap-3 text-sm">
              <div>
                <p className="text-gray-500 text-xs">New Enrollments</p>
                <p className="font-bold text-lg">{r.ne}</p>
              </div>
              <div>
                <p className="text-gray-500 text-xs">Personal Production</p>
                <p className="font-bold text-lg">{r.personalProduction.toLocaleString()}</p>
              </div>
              {r.groupProduction > 0 && (
                <div>
                  <p className="text-gray-500 text-xs">Group Production</p>
                  <p className="font-bold text-lg">{r.groupProduction.toLocaleString()}</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Earnings */}
        <div className="px-6 py-4">
          <p className="text-[10px] text-green-600 uppercase font-bold mb-2">Earnings</p>
          <div className="space-y-1.5">
            {earnings.map((e, i) => (
              <div key={i} className="flex justify-between text-sm">
                <span className="text-gray-600">{e.label}</span>
                <span className={`font-medium ${e.value > 0 ? "text-gray-900" : "text-gray-400"}`}>{fmt(e.value)}</span>
              </div>
            ))}
          </div>
          <div className="flex justify-between mt-3 pt-3 border-t border-gray-200 text-sm font-bold">
            <span className="text-green-700">Gross Income</span>
            <span className="text-green-700 text-base">{fmt(totalEarnings)}</span>
          </div>
        </div>

        {/* Deductions */}
        {(totalDeductions > 0) && (
          <div className="px-6 py-4 bg-red-50/50 border-t print:bg-white">
            <p className="text-[10px] text-red-600 uppercase font-bold mb-2">Deductions</p>
            <div className="space-y-1.5">
              {filteredDeductions.map((d, i) => (
                <div key={i} className="flex justify-between text-sm">
                  <span className="text-gray-600">{d.label}</span>
                  <span className="text-red-600 font-medium">-{fmt(d.value)}</span>
                </div>
              ))}
            </div>
            <div className="flex justify-between mt-3 pt-3 border-t border-red-200 text-sm font-bold">
              <span className="text-red-700">Total Deductions</span>
              <span className="text-red-700">-{fmt(totalDeductions)}</span>
            </div>
          </div>
        )}

        {/* Net Income */}
        <div className={`px-6 py-5 border-t-2 ${r.netIncentives >= 0 ? "border-green-500 bg-green-50 print:bg-white" : "border-red-500 bg-red-50 print:bg-white"}`}>
          <div className="flex justify-between items-center">
            <span className="text-sm font-bold text-gray-700 uppercase">Net Income</span>
            <span className={`text-2xl font-black ${r.netIncentives >= 0 ? "text-green-700" : "text-red-600"}`}>
              {fmt(r.netIncentives)}
            </span>
          </div>
        </div>

        {/* Signatures */}
        <div className="px-6 py-5 border-t">
          <p className="text-xs text-gray-400 mb-6">Prepared By:</p>
          <div className="flex justify-between gap-8">
            <div className="flex-1 text-center">
              <div className="border-b border-gray-300 mb-1 h-8"></div>
              <p className="text-xs text-gray-500">Branch Staff</p>
            </div>
            <div className="flex-1 text-center">
              <div className="border-b border-gray-300 mb-1 h-8"></div>
              <p className="text-xs text-gray-500">Agent&apos;s Signature</p>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @media print {
          body * { visibility: hidden !important; }
          #isr-individual, #isr-individual * { visibility: visible !important; }
          #isr-individual { position: fixed; top: 0; left: 0; width: 100%; max-width: 100% !important; }
          @page { size: portrait; margin: 15mm; }
        }
      `}</style>
    </>
  );
}
