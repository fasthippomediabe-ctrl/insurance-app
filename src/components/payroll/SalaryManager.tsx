"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { formatCurrency } from "@/lib/utils";
import Link from "next/link";

interface Employee {
  id: string; firstName: string; lastName: string; employeeNo: string; primaryPosition: string; branch: string;
}

interface Profile {
  id: string; employeeId: string; basicSalary: number; riceAllowance: number; transpoAllowance: number;
  otherAllowance: number; paySchedule: string; sssNo: string | null; philhealthNo: string | null;
  pagibigNo: string | null; tinNo: string | null; sssContribution: number; philhealthContribution: number;
  pagibigContribution: number; withholdingTax: number;
  lateGraceMins: number; lateRatePerHour: number; dailyRate: number;
  payType: string; hoursPerDay: number;
  overtimeRate: number; workingDaysPerCutoff: number;
  employee: Employee;
}

export default function SalaryManager({ employees, profiles }: { employees: Employee[]; profiles: Profile[] }) {
  const router = useRouter();
  const [editing, setEditing] = useState<string | null>(null);
  const [form, setForm] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");

  const profileMap = new Map(profiles.map((p) => [p.employeeId, p]));
  const unassigned = employees.filter((e) => !profileMap.has(e.id));

  function startEdit(empId: string) {
    const existing = profileMap.get(empId);
    setForm(existing ? {
      employeeId: empId,
      basicSalary: existing.basicSalary,
      riceAllowance: existing.riceAllowance,
      transpoAllowance: existing.transpoAllowance,
      otherAllowance: existing.otherAllowance,
      paySchedule: existing.paySchedule,
      sssNo: existing.sssNo ?? "",
      philhealthNo: existing.philhealthNo ?? "",
      pagibigNo: existing.pagibigNo ?? "",
      tinNo: existing.tinNo ?? "",
      sssContribution: existing.sssContribution,
      philhealthContribution: existing.philhealthContribution,
      pagibigContribution: existing.pagibigContribution,
      withholdingTax: existing.withholdingTax,
      lateGraceMins: existing.lateGraceMins,
      lateRatePerHour: existing.lateRatePerHour,
      dailyRate: existing.dailyRate,
      payType: existing.payType ?? "MONTHLY",
      hoursPerDay: existing.hoursPerDay ?? 8,
      overtimeRate: existing.overtimeRate ?? 0,
      workingDaysPerCutoff: existing.workingDaysPerCutoff ?? 11,
    } : {
      employeeId: empId,
      basicSalary: 0, riceAllowance: 0, transpoAllowance: 0, otherAllowance: 0,
      paySchedule: "REGULAR", sssNo: "", philhealthNo: "", pagibigNo: "", tinNo: "",
      sssContribution: 0, philhealthContribution: 0, pagibigContribution: 0, withholdingTax: 0,
      lateGraceMins: 30, lateRatePerHour: 0, dailyRate: 0,
      payType: "MONTHLY", hoursPerDay: 8,
      overtimeRate: 0, workingDaysPerCutoff: 11,
    });
    setEditing(empId);
    setMsg("");
  }

  async function save() {
    setLoading(true);
    setMsg("");
    try {
      const res = await fetch("/api/payroll/salary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "Failed");
      setMsg("Saved!");
      setEditing(null);
      router.refresh();
    } catch (e: any) {
      setMsg("Error: " + e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Salary Profiles</h1>
          <p className="text-gray-500 text-sm mt-0.5">{profiles.length} profiles configured · {unassigned.length} without profile</p>
        </div>
        <Link href="/payroll" className="text-sm text-purple-600 hover:underline">Back to Payroll</Link>
      </div>

      {msg && <div className={`px-4 py-2 rounded-lg text-sm ${msg.startsWith("Error") ? "bg-red-50 text-red-700" : "bg-green-50 text-green-700"}`}>{msg}</div>}

      {/* Unassigned employees */}
      {unassigned.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
          <h3 className="text-sm font-semibold text-amber-800 mb-2">Employees Without Salary Profile</h3>
          <div className="flex flex-wrap gap-2">
            {unassigned.map((e) => (
              <button key={e.id} onClick={() => startEdit(e.id)}
                className="bg-white border border-amber-300 rounded-lg px-3 py-1.5 text-xs font-medium text-amber-800 hover:bg-amber-100">
                {e.firstName} {e.lastName} ({e.primaryPosition})
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {editing && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="px-6 pt-6 pb-4 border-b">
              <h2 className="text-lg font-bold text-gray-900">
                {profileMap.has(editing) ? "Edit" : "Setup"} Salary Profile
              </h2>
              <p className="text-sm text-gray-500">
                {employees.find((e) => e.id === editing)?.firstName} {employees.find((e) => e.id === editing)?.lastName}
              </p>
            </div>
            <div className="px-6 py-5 space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Monthly Basic Salary</label>
                <input type="number" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                  value={form.basicSalary} onChange={(e) => setForm({ ...form, basicSalary: parseFloat(e.target.value) || 0 })} />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Rice Allowance</label>
                  <input type="number" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                    value={form.riceAllowance} onChange={(e) => setForm({ ...form, riceAllowance: parseFloat(e.target.value) || 0 })} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Transpo Allowance</label>
                  <input type="number" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                    value={form.transpoAllowance} onChange={(e) => setForm({ ...form, transpoAllowance: parseFloat(e.target.value) || 0 })} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Other Allowance</label>
                  <input type="number" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                    value={form.otherAllowance} onChange={(e) => setForm({ ...form, otherAllowance: parseFloat(e.target.value) || 0 })} />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Pay Type</label>
                  <select className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                    value={form.payType} onChange={(e) => setForm({ ...form, payType: e.target.value })}>
                    <option value="MONTHLY">Monthly (fixed salary)</option>
                    <option value="DAILY">Daily (paid per day worked)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Pay Schedule</label>
                  <select className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                    value={form.paySchedule} onChange={(e) => setForm({ ...form, paySchedule: e.target.value })}>
                    <option value="REGULAR">Regular (5th & 20th)</option>
                    <option value="EXECUTIVE">Executive (15th & EOM)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Hours / Day</label>
                  <input type="number" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                    value={form.hoursPerDay} onChange={(e) => setForm({ ...form, hoursPerDay: parseInt(e.target.value) || 8 })} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">SSS No.</label>
                  <input className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                    value={form.sssNo} onChange={(e) => setForm({ ...form, sssNo: e.target.value })} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">PhilHealth No.</label>
                  <input className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                    value={form.philhealthNo} onChange={(e) => setForm({ ...form, philhealthNo: e.target.value })} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Pag-IBIG No.</label>
                  <input className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                    value={form.pagibigNo} onChange={(e) => setForm({ ...form, pagibigNo: e.target.value })} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">TIN</label>
                  <input className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                    value={form.tinNo} onChange={(e) => setForm({ ...form, tinNo: e.target.value })} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">SSS Contribution</label>
                  <input type="number" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                    value={form.sssContribution} onChange={(e) => setForm({ ...form, sssContribution: parseFloat(e.target.value) || 0 })} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">PhilHealth Contribution</label>
                  <input type="number" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                    value={form.philhealthContribution} onChange={(e) => setForm({ ...form, philhealthContribution: parseFloat(e.target.value) || 0 })} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Pag-IBIG Contribution</label>
                  <input type="number" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                    value={form.pagibigContribution} onChange={(e) => setForm({ ...form, pagibigContribution: parseFloat(e.target.value) || 0 })} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Withholding Tax (monthly)</label>
                  <input type="number" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                    value={form.withholdingTax} onChange={(e) => setForm({ ...form, withholdingTax: parseFloat(e.target.value) || 0 })} />
                </div>
              </div>

              {/* Late & Absence Rules */}
              <div className="border-t pt-4 mt-2">
                <p className="text-xs font-semibold text-gray-700 mb-3">Late & Absence Rules</p>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Grace Period (mins)</label>
                    <input type="number" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                      value={form.lateGraceMins} onChange={(e) => setForm({ ...form, lateGraceMins: parseInt(e.target.value) || 0 })} />
                    <p className="text-[10px] text-gray-400 mt-0.5">No charge within this</p>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Late Rate / Hour</label>
                    <input type="number" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                      value={form.lateRatePerHour} onChange={(e) => setForm({ ...form, lateRatePerHour: parseFloat(e.target.value) || 0 })} />
                    <p className="text-[10px] text-gray-400 mt-0.5">After grace, per hour</p>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Daily Rate (absence)</label>
                    <input type="number" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                      value={form.dailyRate} onChange={(e) => setForm({ ...form, dailyRate: parseFloat(e.target.value) || 0 })} />
                    <p className="text-[10px] text-gray-400 mt-0.5">0 = auto (basic/22)</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3 mt-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Overtime Rate / Hour</label>
                    <input type="number" step="0.01" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                      value={form.overtimeRate} onChange={(e) => setForm({ ...form, overtimeRate: parseFloat(e.target.value) || 0 })} />
                    <p className="text-[10px] text-gray-400 mt-0.5">Pay per OT hour</p>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Working Days per Cutoff</label>
                    <input type="number" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                      value={form.workingDaysPerCutoff} onChange={(e) => setForm({ ...form, workingDaysPerCutoff: parseInt(e.target.value) || 11 })} />
                    <p className="text-[10px] text-gray-400 mt-0.5">Expected working days per half-month (e.g., 11)</p>
                  </div>
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button onClick={() => setEditing(null)}
                  className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-50">Cancel</button>
                <button onClick={save} disabled={loading}
                  className="flex-1 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg text-sm font-semibold">
                  {loading ? "Saving..." : "Save Profile"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Profiles list */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
              <tr>
                <th className="px-4 py-2.5 text-left">Employee</th>
                <th className="px-4 py-2.5 text-center">Position</th>
                <th className="px-4 py-2.5 text-left">Branch</th>
                <th className="px-4 py-2.5 text-right">Basic Salary</th>
                <th className="px-4 py-2.5 text-right">Allowances</th>
                <th className="px-4 py-2.5 text-center">Schedule</th>
                <th className="px-4 py-2.5 text-right">Gov Deductions</th>
                <th className="px-4 py-2.5 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {profiles.map((p) => {
                const allowances = p.riceAllowance + p.transpoAllowance + p.otherAllowance;
                const govDed = p.sssContribution + p.philhealthContribution + p.pagibigContribution + p.withholdingTax;
                return (
                  <tr key={p.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-800">{p.employee.firstName} {p.employee.lastName}</td>
                    <td className="px-4 py-3 text-center text-xs">
                      <span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-bold">{p.employee.primaryPosition}</span>
                    </td>
                    <td className="px-4 py-3 text-gray-500">{p.employee.branch}</td>
                    <td className="px-4 py-3 text-right font-semibold">{formatCurrency(p.basicSalary)}</td>
                    <td className="px-4 py-3 text-right text-gray-600">{formatCurrency(allowances)}</td>
                    <td className="px-4 py-3 text-center text-xs">{p.paySchedule === "EXECUTIVE" ? "15th/EOM" : "5th/20th"}</td>
                    <td className="px-4 py-3 text-right text-red-600">{formatCurrency(govDed)}</td>
                    <td className="px-4 py-3 text-center">
                      <button onClick={() => startEdit(p.employeeId)} className="text-blue-600 hover:underline text-xs font-medium">Edit</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
