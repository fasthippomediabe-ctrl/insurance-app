"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { MONTHS } from "@/lib/utils";
import Link from "next/link";
import Papa from "papaparse";

interface Employee {
  id: string; employeeNo: string; name: string; position: string; branch: string;
  payType: string; hoursPerDay: number;
}

interface AttendanceRow {
  id?: string;
  employeeId: string;
  date: string;
  timeIn: string | null;
  timeOut: string | null;
  hoursWorked: number;
  lateMinutes: number;
  isAbsent: boolean;
  isHalfDay: boolean;
  isHoliday: boolean;
  source: string;
}

export default function AttendanceManager({ employees }: { employees: Employee[] }) {
  const router = useRouter();
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [half, setHalf] = useState(1);
  const [records, setRecords] = useState<AttendanceRow[]>([]);
  const [selectedEmp, setSelectedEmp] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");
  const [expectedIn, setExpectedIn] = useState("08:00");
  const [hoursPerDay, setHoursPerDay] = useState(8);
  const fileRef = useRef<HTMLInputElement>(null);
  const [importResult, setImportResult] = useState<{ imported: number; skipped: number; errors: string[] } | null>(null);

  async function loadAttendance() {
    setLoading(true);
    try {
      const params = new URLSearchParams({ month: String(month), year: String(year), half: String(half) });
      if (selectedEmp) params.set("employeeId", selectedEmp);
      const res = await fetch(`/api/payroll/attendance?${params}`);
      if (!res.ok) throw new Error("Failed to load");
      const data = await res.json();
      setRecords(data.map((r: any) => ({
        id: r.id,
        employeeId: r.employeeId,
        date: r.date.split("T")[0],
        timeIn: r.timeIn,
        timeOut: r.timeOut,
        hoursWorked: Number(r.hoursWorked),
        lateMinutes: r.lateMinutes,
        isAbsent: r.isAbsent,
        isHalfDay: r.isHalfDay,
        isHoliday: r.isHoliday,
        source: r.source,
      })));
    } catch (e: any) {
      setMsg("Error: " + e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadAttendance(); }, [month, year, half, selectedEmp]);

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setMsg("Parsing CSV...");
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (res) => {
        const rows = (res.data as any[]).filter((row) =>
          Object.values(row).some((v) => String(v ?? "").trim())
        );
        setMsg(`Importing ${rows.length} rows...`);
        try {
          const resp = await fetch("/api/payroll/attendance/import", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ rows, expectedTimeIn: expectedIn, hoursPerDay }),
          });
          const result = await resp.json();
          if (!resp.ok) throw new Error(result.error ?? "Failed");
          setImportResult(result);
          setMsg(`Imported ${result.imported}, skipped ${result.skipped}.`);
          await loadAttendance();
          router.refresh();
        } catch (err: any) {
          setMsg("Error: " + err.message);
        }
        if (fileRef.current) fileRef.current.value = "";
      },
      error: (err) => setMsg("CSV parse error: " + err.message),
    });
  }

  async function saveRow(row: AttendanceRow) {
    setLoading(true);
    try {
      const res = await fetch("/api/payroll/attendance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(row),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "Failed");
      await loadAttendance();
    } catch (e: any) { setMsg("Error: " + e.message); }
    finally { setLoading(false); }
  }

  async function deleteRow(id: string) {
    if (!confirm("Delete this attendance record?")) return;
    await fetch(`/api/payroll/attendance?id=${id}`, { method: "DELETE" });
    await loadAttendance();
  }

  const empMap = new Map(employees.map((e) => [e.id, e]));
  const lastDay = new Date(year, month, 0).getDate();

  // Calculate days worked, absent, late for display (aggregated per employee)
  type Summary = { daysWorked: number; daysAbsent: number; lateMins: number };
  const summaryByEmp = new Map<string, Summary>();
  for (const r of records) {
    const s = summaryByEmp.get(r.employeeId) ?? { daysWorked: 0, daysAbsent: 0, lateMins: 0 };
    if (!r.isAbsent && !r.isHoliday) s.daysWorked += r.isHalfDay ? 0.5 : 1;
    if (r.isAbsent) s.daysAbsent += 1;
    s.lateMins += r.lateMinutes;
    summaryByEmp.set(r.employeeId, s);
  }

  // Add new blank entry for a specific date
  function addManualEntry(employeeId: string, date: string) {
    saveRow({
      employeeId, date,
      timeIn: null, timeOut: null,
      hoursWorked: 0, lateMinutes: 0,
      isAbsent: false, isHalfDay: false, isHoliday: false,
      source: "MANUAL",
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Attendance</h1>
          <p className="text-gray-500 text-sm mt-0.5">Track daily attendance, import from biometric, or enter manually</p>
        </div>
        <Link href="/payroll" className="text-sm text-purple-600 hover:underline py-2">Back to Payroll</Link>
      </div>

      {/* Filter */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm flex flex-wrap gap-3 items-end">
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Month</label>
          <select className="border border-gray-300 rounded-lg px-2 py-2 text-sm" value={month} onChange={(e) => setMonth(Number(e.target.value))}>
            {MONTHS.map((m, i) => <option key={i + 1} value={i + 1}>{m}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Year</label>
          <input type="number" className="w-20 border border-gray-300 rounded-lg px-2 py-2 text-sm" value={year} onChange={(e) => setYear(Number(e.target.value))} />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Cutoff</label>
          <select className="border border-gray-300 rounded-lg px-2 py-2 text-sm" value={half} onChange={(e) => setHalf(Number(e.target.value))}>
            <option value={0}>Full Month</option>
            <option value={1}>1st Half (1-15)</option>
            <option value={2}>2nd Half (16-{lastDay})</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Employee</label>
          <select className="border border-gray-300 rounded-lg px-2 py-2 text-sm" value={selectedEmp} onChange={(e) => setSelectedEmp(e.target.value)}>
            <option value="">All employees</option>
            {employees.map((e) => <option key={e.id} value={e.id}>{e.name} ({e.position})</option>)}
          </select>
        </div>
      </div>

      {/* Biometric Import */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-xl p-5">
        <h2 className="font-semibold text-blue-900 mb-1">Import from Biometric (CSV)</h2>
        <p className="text-xs text-blue-600 mb-3">
          Upload a CSV with columns like: Employee No, Date, Time In, Time Out (or Hours Worked, Late Minutes, Absent)
        </p>
        <div className="flex flex-wrap gap-3 items-end">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Expected Time In</label>
            <input type="time" className="border border-gray-300 rounded-lg px-2 py-2 text-sm" value={expectedIn} onChange={(e) => setExpectedIn(e.target.value)} />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Hours per Day</label>
            <input type="number" className="w-20 border border-gray-300 rounded-lg px-2 py-2 text-sm" value={hoursPerDay} onChange={(e) => setHoursPerDay(Number(e.target.value))} />
          </div>
          <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={handleFile} />
          <button onClick={() => fileRef.current?.click()}
            className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-5 py-2 rounded-lg">
            Upload Biometric CSV
          </button>
        </div>
        {msg && <p className="text-xs mt-2 text-gray-600">{msg}</p>}
        {importResult && (
          <div className="mt-3 bg-white border rounded-lg p-3 text-xs">
            <p className="font-semibold">Imported: {importResult.imported} · Skipped: {importResult.skipped}</p>
            {importResult.errors.length > 0 && (
              <details className="mt-2">
                <summary className="text-red-600 cursor-pointer">{importResult.errors.length} errors</summary>
                <div className="max-h-40 overflow-y-auto mt-1">
                  {importResult.errors.slice(0, 50).map((e, i) => <p key={i} className="text-red-500 font-mono">{e}</p>)}
                </div>
              </details>
            )}
          </div>
        )}
      </div>

      {/* Per-employee Summary */}
      {!selectedEmp && summaryByEmp.size > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b"><h2 className="font-semibold text-gray-800">Summary by Employee</h2></div>
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
              <tr>
                <th className="px-4 py-2 text-left">Employee</th>
                <th className="px-4 py-2 text-center">Pay Type</th>
                <th className="px-4 py-2 text-center">Days Worked</th>
                <th className="px-4 py-2 text-center">Days Absent</th>
                <th className="px-4 py-2 text-center">Total Late</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {Array.from(summaryByEmp.entries()).map(([empId, s]) => {
                const emp = empMap.get(empId);
                if (!emp) return null;
                return (
                  <tr key={empId} className="hover:bg-gray-50 cursor-pointer" onClick={() => setSelectedEmp(empId)}>
                    <td className="px-4 py-2.5 font-medium">{emp.name} <span className="text-xs text-gray-400">({emp.position})</span></td>
                    <td className="px-4 py-2.5 text-center text-xs">
                      <span className={`px-2 py-0.5 rounded-full font-bold ${emp.payType === "DAILY" ? "bg-orange-100 text-orange-700" : "bg-blue-100 text-blue-700"}`}>
                        {emp.payType}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-center font-semibold text-green-700">{s.daysWorked}</td>
                    <td className="px-4 py-2.5 text-center font-semibold text-red-600">{s.daysAbsent}</td>
                    <td className="px-4 py-2.5 text-center text-amber-700">{Math.floor(s.lateMins / 60)}h {s.lateMins % 60}m</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Detail: per-day records when a specific employee is selected */}
      {selectedEmp && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b flex items-center justify-between">
            <h2 className="font-semibold text-gray-800">
              {empMap.get(selectedEmp)?.name} — Daily Records
            </h2>
            <button onClick={() => {
              const today = new Date().toISOString().split("T")[0];
              addManualEntry(selectedEmp, today);
            }} className="text-xs bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-lg">
              + Add Today
            </button>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
              <tr>
                <th className="px-3 py-2 text-left">Date</th>
                <th className="px-3 py-2 text-left">Time In</th>
                <th className="px-3 py-2 text-left">Time Out</th>
                <th className="px-3 py-2 text-center">Hours</th>
                <th className="px-3 py-2 text-center">Late (min)</th>
                <th className="px-3 py-2 text-center">Status</th>
                <th className="px-3 py-2 text-center">Source</th>
                <th className="px-3 py-2 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {records.map((r) => (
                <AttendanceRowEditor key={r.id} row={r} onSave={saveRow} onDelete={() => r.id && deleteRow(r.id)} />
              ))}
              {records.length === 0 && (
                <tr><td colSpan={8} className="px-4 py-8 text-center text-gray-400">No records for this period.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function AttendanceRowEditor({ row, onSave, onDelete }: {
  row: AttendanceRow; onSave: (row: AttendanceRow) => void; onDelete: () => void;
}) {
  const [form, setForm] = useState(row);
  const [dirty, setDirty] = useState(false);

  function set(k: keyof AttendanceRow, v: any) { setForm((p) => ({ ...p, [k]: v })); setDirty(true); }

  return (
    <tr className={dirty ? "bg-yellow-50" : ""}>
      <td className="px-3 py-2 text-xs">{new Date(row.date).toLocaleDateString("en-PH", { month: "short", day: "numeric", weekday: "short" })}</td>
      <td className="px-3 py-2">
        <input type="time" className="border border-gray-200 rounded px-2 py-1 text-xs w-24" value={form.timeIn ?? ""} onChange={(e) => set("timeIn", e.target.value)} disabled={form.isAbsent} />
      </td>
      <td className="px-3 py-2">
        <input type="time" className="border border-gray-200 rounded px-2 py-1 text-xs w-24" value={form.timeOut ?? ""} onChange={(e) => set("timeOut", e.target.value)} disabled={form.isAbsent} />
      </td>
      <td className="px-3 py-2">
        <input type="number" step="0.25" className="w-16 border border-gray-200 rounded px-2 py-1 text-xs text-center" value={form.hoursWorked} onChange={(e) => set("hoursWorked", parseFloat(e.target.value) || 0)} disabled={form.isAbsent} />
      </td>
      <td className="px-3 py-2">
        <input type="number" className="w-16 border border-gray-200 rounded px-2 py-1 text-xs text-center" value={form.lateMinutes} onChange={(e) => set("lateMinutes", parseInt(e.target.value) || 0)} disabled={form.isAbsent} />
      </td>
      <td className="px-3 py-2 text-center">
        <label className="flex items-center gap-1 justify-center text-xs">
          <input type="checkbox" checked={form.isAbsent} onChange={(e) => set("isAbsent", e.target.checked)} /> Absent
        </label>
        <label className="flex items-center gap-1 justify-center text-xs">
          <input type="checkbox" checked={form.isHalfDay} onChange={(e) => set("isHalfDay", e.target.checked)} /> Half
        </label>
      </td>
      <td className="px-3 py-2 text-center text-xs">
        <span className={`px-1.5 py-0.5 rounded-full font-bold ${form.source === "BIOMETRIC_IMPORT" ? "bg-blue-100 text-blue-700" : "bg-gray-100 text-gray-600"}`}>
          {form.source === "BIOMETRIC_IMPORT" ? "BIO" : "MANUAL"}
        </span>
      </td>
      <td className="px-3 py-2 text-center space-x-1 whitespace-nowrap">
        {dirty && (
          <button onClick={() => { onSave(form); setDirty(false); }} className="text-blue-600 text-xs font-semibold">Save</button>
        )}
        <button onClick={onDelete} className="text-red-500 text-xs">✕</button>
      </td>
    </tr>
  );
}
