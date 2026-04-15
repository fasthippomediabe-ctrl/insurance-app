import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

function allowed(role: string) {
  return role === "ADMIN" || role === "HR" || role === "ACCOUNTING";
}

// Parse "HH:mm" or "HH:mm:ss" or "H:mm AM/PM" -> total minutes from midnight
function parseTimeToMinutes(s: string | null | undefined): number | null {
  if (!s) return null;
  const t = String(s).trim();
  if (!t) return null;
  // 12-hour format
  const ampm = t.match(/^(\d{1,2}):(\d{2})(?::\d{2})?\s*(AM|PM|am|pm)$/);
  if (ampm) {
    let h = parseInt(ampm[1]);
    const m = parseInt(ampm[2]);
    const p = ampm[3].toUpperCase();
    if (p === "PM" && h < 12) h += 12;
    if (p === "AM" && h === 12) h = 0;
    return h * 60 + m;
  }
  // 24-hour format
  const tf = t.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
  if (tf) return parseInt(tf[1]) * 60 + parseInt(tf[2]);
  return null;
}

function parseDate(s: string): Date | null {
  if (!s) return null;
  const t = String(s).trim();
  // try ISO first
  let d = new Date(t);
  if (!isNaN(d.getTime())) { d.setHours(0, 0, 0, 0); return d; }
  // try MM/DD/YYYY or M/D/YYYY
  const m = t.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
  if (m) {
    let y = parseInt(m[3]);
    if (y < 100) y += 2000;
    d = new Date(y, parseInt(m[1]) - 1, parseInt(m[2]));
    if (!isNaN(d.getTime())) { d.setHours(0, 0, 0, 0); return d; }
  }
  return null;
}

function findKey(row: Record<string, any>, ...candidates: string[]): string | undefined {
  const keys = Object.keys(row);
  for (const c of candidates) {
    const found = keys.find((k) => k.trim().toLowerCase() === c.toLowerCase());
    if (found) return found;
  }
  for (const c of candidates) {
    const found = keys.find((k) => k.trim().toLowerCase().includes(c.toLowerCase()));
    if (found) return found;
  }
  return undefined;
}

function get(row: Record<string, any>, ...candidates: string[]): string {
  const k = findKey(row, ...candidates);
  return k ? String(row[k] ?? "").trim() : "";
}

// POST: Import biometric CSV rows
// Expected columns (flexible): Employee No / Employee ID / Emp No, Date, Time In, Time Out
// OR: Employee No, Date, Hours Worked, Late Minutes, Absent (yes/no)
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = session.user as any;
  if (!allowed(user.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { rows, expectedTimeIn = "08:00", hoursPerDay = 8 } = await req.json();
  if (!rows || !Array.isArray(rows)) return NextResponse.json({ error: "rows required" }, { status: 400 });

  const expectedInMinutes = parseTimeToMinutes(expectedTimeIn) ?? 480;
  const results = { imported: 0, skipped: 0, errors: [] as string[] };

  // Pre-fetch all employees for fast lookup
  const emps = await db.employee.findMany({ select: { id: true, employeeNo: true, firstName: true, lastName: true } });
  const empByNo = new Map(emps.map((e) => [e.employeeNo.toUpperCase(), e.id]));
  const empByName = new Map(emps.map((e) => [`${e.firstName} ${e.lastName}`.toUpperCase(), e.id]));

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    try {
      const empNo = get(row, "Employee No", "Employee ID", "Emp No", "EmpID", "ID", "Employee Number");
      const name = get(row, "Name", "Employee Name", "Full Name");
      const dateRaw = get(row, "Date", "Work Date", "Attendance Date");
      const timeInRaw = get(row, "Time In", "TimeIn", "In", "Clock In");
      const timeOutRaw = get(row, "Time Out", "TimeOut", "Out", "Clock Out");
      const hoursRaw = get(row, "Hours Worked", "Hours", "Work Hours");
      const lateRaw = get(row, "Late Minutes", "Late", "Late Mins");
      const absentRaw = get(row, "Absent", "Is Absent", "Status");
      const halfDayRaw = get(row, "Half Day", "HalfDay");

      // Match employee
      let employeeId: string | undefined;
      if (empNo) employeeId = empByNo.get(empNo.toUpperCase());
      if (!employeeId && name) employeeId = empByName.get(name.toUpperCase());
      if (!employeeId) {
        results.errors.push(`Row ${i + 1}: employee not found (${empNo || name})`);
        results.skipped++;
        continue;
      }

      const date = parseDate(dateRaw);
      if (!date) {
        results.errors.push(`Row ${i + 1}: invalid date "${dateRaw}"`);
        results.skipped++;
        continue;
      }

      const isAbsent = /^(yes|y|true|absent|a)$/i.test(absentRaw);
      const isHalfDay = /^(yes|y|true|half)$/i.test(halfDayRaw);

      let timeIn: string | null = null;
      let timeOut: string | null = null;
      let hoursWorked = 0;
      let lateMinutes = 0;

      if (!isAbsent) {
        if (timeInRaw) {
          const inMin = parseTimeToMinutes(timeInRaw);
          if (inMin !== null) {
            timeIn = timeInRaw;
            lateMinutes = Math.max(0, inMin - expectedInMinutes);
          }
        }
        if (timeOutRaw) {
          const outMin = parseTimeToMinutes(timeOutRaw);
          const inMin = parseTimeToMinutes(timeInRaw || "");
          if (outMin !== null) {
            timeOut = timeOutRaw;
            if (inMin !== null && outMin > inMin) hoursWorked = (outMin - inMin) / 60;
          }
        }
        // If hoursWorked column exists, use it instead of computed
        if (hoursRaw) {
          const h = parseFloat(hoursRaw);
          if (!isNaN(h)) hoursWorked = h;
        }
        // If lateRaw provided, override
        if (lateRaw) {
          const l = parseInt(lateRaw);
          if (!isNaN(l)) lateMinutes = l;
        }
        // If no timeOut but we have hoursPerDay as expected, assume full day minus any late
        if (hoursWorked === 0 && timeIn && !timeOut) {
          hoursWorked = hoursPerDay - (lateMinutes / 60);
        }
      }

      const d = new Date(date);
      d.setHours(0, 0, 0, 0);

      const existing = await db.attendanceRecord.findUnique({
        where: { employeeId_date: { employeeId, date: d } },
      });

      const data = {
        timeIn, timeOut,
        hoursWorked: Math.round(hoursWorked * 100) / 100,
        lateMinutes,
        isAbsent,
        isHalfDay,
        isHoliday: false,
        source: "BIOMETRIC_IMPORT",
      };

      if (existing) {
        await db.attendanceRecord.update({ where: { id: existing.id }, data });
      } else {
        await db.attendanceRecord.create({ data: { employeeId, date: d, ...data } });
      }

      results.imported++;
    } catch (err: any) {
      results.errors.push(`Row ${i + 1}: ${err.message?.slice(0, 200)}`);
      results.skipped++;
    }
  }

  return NextResponse.json(results);
}
