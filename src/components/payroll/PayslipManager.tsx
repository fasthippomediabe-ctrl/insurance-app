"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { formatCurrency, MONTHS } from "@/lib/utils";
import Link from "next/link";
import PayslipPrintView from "./PayslipPrintView";

interface Payslip {
  id: string; employeeId: string; cutoffLabel: string; periodStart: string; periodEnd: string; payDate: string;
  basicPay: number; overtime: number; holidayPay: number; allowances: number; otherEarnings: number; grossPay: number;
  daysWorked: number; daysAbsent: number; lateMins: number; lateDeduction: number;
  sss: number; philhealth: number; pagibig: number; tax: number; cashAdvance: number; absences: number;
  otherDeductions: number; totalDeductions: number; netPay: number; status: string; notes: string | null;
  employee: { id: string; firstName: string; lastName: string; employeeNo: string; primaryPosition: string; branch: string };
}

interface EmployeeStub {
  id: string; employeeNo: string; name: string; position: string;
  payType: string; workingDaysPerCutoff: number;
}

type Override = {
  daysWorked: string; daysAbsent: string; lateMins: string;
  overtimeHours: string; holidayPay: string; otherEarnings: string; otherDeductions: string;
};

export default function PayslipManager({ payslips, employees = [] }: { payslips: Payslip[]; employees?: EmployeeStub[] }) {
  const router = useRouter();
  const [generating, setGenerating] = useState(false);
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [year, setYear] = useState(new Date().getFullYear());
  const [half, setHalf] = useState(1);
  const [msg, setMsg] = useState("");
  const [viewing, setViewing] = useState<Payslip | null>(null);
  const [showOverrides, setShowOverrides] = useState(false);
  const [overrides, setOverrides] = useState<Record<string, Override>>({});

  function emptyOv(emp: EmployeeStub): Override {
    return {
      daysWorked: String(emp.workingDaysPerCutoff),
      daysAbsent: "0",
      lateMins: "0",
      overtimeHours: "0",
      holidayPay: "0",
      otherEarnings: "0",
      otherDeductions: "0",
    };
  }

  function getOv(empId: string): Override {
    return overrides[empId] ?? emptyOv(employees.find((e) => e.id === empId)!);
  }

  function setOv(empId: string, key: keyof Override, val: string) {
    setOverrides((p) => ({
      ...p,
      [empId]: { ...getOv(empId), [key]: val },
    }));
  }

  async function generate() {
    setGenerating(true);
    setMsg("");
    try {
      // Build overrides payload (only employees with non-empty overrides)
      const overridesPayload: Record<string, any> = {};
      for (const emp of employees) {
        const ov = overrides[emp.id];
        if (!ov) continue;
        overridesPayload[emp.id] = {
          daysWorked: parseFloat(ov.daysWorked) || 0,
          daysAbsent: parseFloat(ov.daysAbsent) || 0,
          lateMins: parseInt(ov.lateMins) || 0,
          overtimeHours: parseFloat(ov.overtimeHours) || 0,
          holidayPay: parseFloat(ov.holidayPay) || 0,
          otherEarnings: parseFloat(ov.otherEarnings) || 0,
          otherDeductions: parseFloat(ov.otherDeductions) || 0,
        };
      }

      const res = await fetch("/api/payroll/payslips", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ month, year, half, overrides: overridesPayload }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed");
      setMsg(`Generated ${data.created} payslips.`);
      setOverrides({});
      setShowOverrides(false);
      router.refresh();
    } catch (e: any) {
      setMsg("Error: " + e.message);
    } finally {
      setGenerating(false);
    }
  }

  async function deletePayslip(id: string) {
    if (!confirm("Delete this payslip?")) return;
    try {
      const res = await fetch(`/api/payroll/payslips?id=${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error((await res.json()).error ?? "Failed");
      setMsg("Payslip deleted.");
      router.refresh();
    } catch (e: any) {
      setMsg("Error: " + e.message);
    }
  }

  if (viewing) {
    return <PayslipPrintView payslip={viewing} onBack={() => setViewing(null)} />;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Payslips</h1>
          <p className="text-gray-500 text-sm mt-0.5">{payslips.length} payslips</p>
        </div>
        <Link href="/payroll" className="text-sm text-purple-600 hover:underline">Back to Payroll</Link>
      </div>

      {/* Generate Payslips */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
        <h2 className="font-semibold text-gray-800 mb-3">Generate Payslips</h2>
        <div className="flex flex-wrap gap-3 items-end">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Month</label>
            <select className="border border-gray-300 rounded-lg px-2 py-2 text-sm" value={month} onChange={(e) => setMonth(Number(e.target.value))}>
              {MONTHS.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Year</label>
            <input type="number" className="w-20 border border-gray-300 rounded-lg px-2 py-2 text-sm" value={year} onChange={(e) => setYear(Number(e.target.value))} />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Cutoff</label>
            <select className="border border-gray-300 rounded-lg px-2 py-2 text-sm" value={half} onChange={(e) => setHalf(Number(e.target.value))}>
              <option value={1}>1st Half (1st-15th)</option>
              <option value={2}>2nd Half (16th-End)</option>
            </select>
          </div>
          <button onClick={() => setShowOverrides(!showOverrides)}
            className="border border-gray-300 hover:bg-gray-50 text-gray-700 text-sm font-semibold px-4 py-2 rounded-lg">
            {showOverrides ? "Hide Overrides" : "Enter Attendance / Overrides"}
          </button>
          <button onClick={generate} disabled={generating}
            className="bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white text-sm font-semibold px-5 py-2 rounded-lg">
            {generating ? "Generating..." : "Generate Payslips"}
          </button>
        </div>
        {msg && <p className={`mt-3 text-sm ${msg.startsWith("Error") ? "text-red-600" : "text-green-600"}`}>{msg}</p>}

        {showOverrides && employees.length > 0 && (
          <div className="mt-4 border-t pt-4">
            <p className="text-xs text-gray-500 mb-3">
              Manually enter days absent, late minutes, overtime, etc. per employee. Leave blank to use attendance records (or zero if no records).
            </p>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-gray-50 text-gray-500 uppercase">
                  <tr>
                    <th className="px-2 py-2 text-left">Employee</th>
                    <th className="px-2 py-2 text-center">Days Worked</th>
                    <th className="px-2 py-2 text-center">Days Absent</th>
                    <th className="px-2 py-2 text-center">Late (mins)</th>
                    <th className="px-2 py-2 text-center">OT Hours</th>
                    <th className="px-2 py-2 text-center">Holiday Pay</th>
                    <th className="px-2 py-2 text-center">Other Earnings</th>
                    <th className="px-2 py-2 text-center">Other Deductions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {employees.map((emp) => {
                    const ov = getOv(emp.id);
                    return (
                      <tr key={emp.id}>
                        <td className="px-2 py-2 whitespace-nowrap">
                          <div className="font-medium text-gray-800">{emp.name}</div>
                          <div className="text-[10px] text-gray-400">
                            {emp.position} · <span className={`px-1 rounded ${emp.payType === "DAILY" ? "bg-orange-100 text-orange-700" : "bg-blue-100 text-blue-700"}`}>{emp.payType}</span>
                          </div>
                        </td>
                        <td className="px-2 py-1.5">
                          <input type="number" step="0.5" className="w-20 border border-gray-200 rounded px-2 py-1 text-center"
                            value={ov.daysWorked} onChange={(e) => setOv(emp.id, "daysWorked", e.target.value)} />
                        </td>
                        <td className="px-2 py-1.5">
                          <input type="number" step="0.5" className="w-20 border border-gray-200 rounded px-2 py-1 text-center"
                            value={ov.daysAbsent} onChange={(e) => setOv(emp.id, "daysAbsent", e.target.value)} />
                        </td>
                        <td className="px-2 py-1.5">
                          <input type="number" className="w-20 border border-gray-200 rounded px-2 py-1 text-center"
                            value={ov.lateMins} onChange={(e) => setOv(emp.id, "lateMins", e.target.value)} />
                        </td>
                        <td className="px-2 py-1.5">
                          <input type="number" step="0.25" className="w-20 border border-gray-200 rounded px-2 py-1 text-center"
                            value={ov.overtimeHours} onChange={(e) => setOv(emp.id, "overtimeHours", e.target.value)} />
                        </td>
                        <td className="px-2 py-1.5">
                          <input type="number" step="0.01" className="w-24 border border-gray-200 rounded px-2 py-1 text-right"
                            value={ov.holidayPay} onChange={(e) => setOv(emp.id, "holidayPay", e.target.value)} />
                        </td>
                        <td className="px-2 py-1.5">
                          <input type="number" step="0.01" className="w-24 border border-gray-200 rounded px-2 py-1 text-right"
                            value={ov.otherEarnings} onChange={(e) => setOv(emp.id, "otherEarnings", e.target.value)} />
                        </td>
                        <td className="px-2 py-1.5">
                          <input type="number" step="0.01" className="w-24 border border-gray-200 rounded px-2 py-1 text-right"
                            value={ov.otherDeductions} onChange={(e) => setOv(emp.id, "otherDeductions", e.target.value)} />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Payslips Table */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
              <tr>
                <th className="px-4 py-2.5 text-left">Employee</th>
                <th className="px-4 py-2.5 text-center">Position</th>
                <th className="px-4 py-2.5 text-left">Period</th>
                <th className="px-4 py-2.5 text-right">Gross</th>
                <th className="px-4 py-2.5 text-right">Deductions</th>
                <th className="px-4 py-2.5 text-right">Net Pay</th>
                <th className="px-4 py-2.5 text-center">Status</th>
                <th className="px-4 py-2.5 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {payslips.map((p) => (
                <tr key={p.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-800">{p.employee.firstName} {p.employee.lastName}</td>
                  <td className="px-4 py-3 text-center text-xs">{p.employee.primaryPosition}</td>
                  <td className="px-4 py-3 text-gray-600 text-xs">{p.cutoffLabel}</td>
                  <td className="px-4 py-3 text-right">{formatCurrency(p.grossPay)}</td>
                  <td className="px-4 py-3 text-right text-red-600">{formatCurrency(p.totalDeductions)}</td>
                  <td className="px-4 py-3 text-right font-bold text-green-700">{formatCurrency(p.netPay)}</td>
                  <td className="px-4 py-3 text-center">
                    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-bold ${
                      p.status === "RELEASED" ? "bg-green-100 text-green-700" :
                      p.status === "APPROVED" ? "bg-blue-100 text-blue-700" :
                      "bg-yellow-100 text-yellow-700"
                    }`}>{p.status}</span>
                  </td>
                  <td className="px-4 py-3 text-center space-x-2">
                    <button onClick={() => setViewing(p)} className="text-purple-600 hover:underline text-xs font-medium">View</button>
                    <button onClick={() => deletePayslip(p.id)} className="text-red-500 hover:underline text-xs font-medium">Delete</button>
                  </td>
                </tr>
              ))}
              {payslips.length === 0 && (
                <tr><td colSpan={8} className="px-4 py-8 text-center text-gray-400">No payslips yet. Generate above.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
