import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

const SALARIED_POSITIONS = ["AS", "BM", "BS", "RM", "TH", "CEO", "CHR"];

// GET: List payslips with filters
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = session.user as any;
  if (user.role !== "ADMIN" && user.role !== "HR" && user.role !== "ACCOUNTING") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const month = parseInt(searchParams.get("month") ?? "") || undefined;
  const year = parseInt(searchParams.get("year") ?? "") || undefined;
  const status = searchParams.get("status") || undefined;

  const where: any = {};
  if (month && year) {
    const start = new Date(year, month - 1, 1);
    const end = new Date(year, month, 1);
    where.periodStart = { gte: start, lt: end };
  }
  if (status) where.status = status;

  const payslips = await db.payslip.findMany({
    where,
    include: {
      employee: {
        select: { firstName: true, lastName: true, employeeNo: true, primaryPosition: true, branch: { select: { name: true } } },
      },
    },
    orderBy: { payDate: "desc" },
  });

  return NextResponse.json(payslips);
}

// POST: Generate payslips for a cutoff period
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = session.user as any;
  if (user.role !== "ADMIN" && user.role !== "HR" && user.role !== "ACCOUNTING") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { month, year, half, overrides } = await req.json();
  // half = 1 (1st-15th) or 2 (16th-end)
  if (!month || !year || !half) {
    return NextResponse.json({ error: "month, year, half required" }, { status: 400 });
  }

  // Get all salaried employees with profiles
  const profiles = await db.salaryProfile.findMany({
    include: {
      employee: { select: { id: true, firstName: true, lastName: true, primaryPosition: true, isActive: true } },
    },
  });

  const activeProfiles = profiles.filter((p) => p.employee.isActive);

  let periodStart: Date, periodEnd: Date, payDate: Date;
  const lastDay = new Date(year, month, 0).getDate();

  const created: any[] = [];

  for (const profile of activeProfiles) {
    const isExec = profile.paySchedule === "EXECUTIVE";

    if (half === 1) {
      periodStart = new Date(year, month - 1, 1);
      periodEnd = new Date(year, month - 1, 15);
      payDate = isExec ? new Date(year, month - 1, 15) : new Date(year, month - 1, 20);
    } else {
      periodStart = new Date(year, month - 1, 16);
      periodEnd = new Date(year, month - 1, lastDay);
      payDate = isExec ? new Date(year, month - 1, lastDay) : new Date(year, month, 5);
    }

    // Check if already exists
    const existing = await db.payslip.findFirst({
      where: {
        employeeId: profile.employeeId,
        periodStart,
        periodEnd,
      },
    });
    if (existing) continue;

    const payType = (profile as any).payType || "MONTHLY";
    const allowances = Number(profile.riceAllowance) + Number(profile.transpoAllowance) + Number(profile.otherAllowance);
    const halfAllowances = allowances / 2;

    // Pull attendance for the cutoff
    const attendance = await db.attendanceRecord.findMany({
      where: {
        employeeId: profile.employeeId,
        date: { gte: periodStart, lt: new Date(periodEnd.getTime() + 86400000) },
      },
    });

    const hoursPerDay = (profile as any).hoursPerDay || 8;
    const overtimeRate = Number((profile as any).overtimeRate) || 0;
    const workingDaysPerCutoff = (profile as any).workingDaysPerCutoff || 11;

    const attendanceDaysWorked = attendance.filter((a) => !a.isAbsent && !a.isHoliday).reduce((s, a) => s + (a.isHalfDay ? 0.5 : 1), 0);
    const attendanceDaysAbsent = attendance.filter((a) => a.isAbsent).length;
    const attendanceDaysHoliday = attendance.filter((a) => a.isHoliday).length;
    const attendanceLateMins = attendance.reduce((s, a) => s + (a.lateMinutes || 0), 0);
    // Compute overtime hours: extra hours worked beyond hoursPerDay per day (only on days actually worked)
    const attendanceOvertimeHours = attendance
      .filter((a) => !a.isAbsent && !a.isHoliday)
      .reduce((s, a) => s + Math.max(0, Number(a.hoursWorked) - hoursPerDay), 0);

    // Get overrides for this employee — overrides take precedence
    const ov = overrides?.[profile.employeeId] ?? {};
    const holidayPay = ov.holidayPay ?? 0;
    const otherEarnings = ov.otherEarnings ?? 0;
    const otherDeductions = ov.otherDeductions ?? 0;

    // Attendance values — override > attendance records > sensible defaults
    const hasAttendance = attendance.length > 0;
    const daysWorked = ov.daysWorked ?? (hasAttendance ? attendanceDaysWorked : workingDaysPerCutoff);
    // Absences: override > attendance count > computed from (workingDays - daysWorked - daysHoliday)
    let daysAbsent: number;
    if (ov.daysAbsent !== undefined) {
      daysAbsent = ov.daysAbsent;
    } else if (hasAttendance) {
      // Use attendance records, but also count "missing days" if days_worked + days_absent + holidays < expected
      const recordedDays = attendanceDaysWorked + attendanceDaysAbsent + attendanceDaysHoliday;
      const missingDays = Math.max(0, workingDaysPerCutoff - recordedDays);
      daysAbsent = attendanceDaysAbsent + missingDays;
    } else {
      daysAbsent = 0;
    }
    const rawLateMins = ov.lateMins ?? attendanceLateMins;
    const overtimeHours = ov.overtimeHours ?? attendanceOvertimeHours;
    const overtime = ov.overtime ?? Math.round(overtimeHours * overtimeRate * 100) / 100;

    // Late deduction: first grace mins per period is free, remaining charged per hour
    const graceMins = Number(profile.lateGraceMins) || 30;
    const lateRatePerHour = Number(profile.lateRatePerHour) || 0;
    const chargeableMins = Math.max(0, rawLateMins - graceMins);
    const lateHours = chargeableMins / 60;
    const lateDeduction = Math.round(lateHours * lateRatePerHour * 100) / 100;

    // Compute basic pay based on payType
    let basicPay: number;
    let absences: number;
    const dailyRate = Number(profile.dailyRate) > 0
      ? Number(profile.dailyRate)
      : Number(profile.basicSalary) / 22;
    if (payType === "DAILY") {
      // DAILY: basic pay = daysWorked × dailyRate, no absence deduction
      basicPay = Math.round(daysWorked * dailyRate * 100) / 100;
      absences = 0;
    } else {
      // MONTHLY: fixed basic pay (half month), deduct for absences
      basicPay = Number(profile.basicSalary) / 2;
      absences = Math.round(daysAbsent * dailyRate * 100) / 100;
    }

    const grossPay = basicPay + halfAllowances + overtime + holidayPay + otherEarnings;

    // Government deductions (deduct on 1st half only)
    const sss = half === 1 ? Number(profile.sssContribution) : 0;
    const philhealth = half === 1 ? Number(profile.philhealthContribution) : 0;
    const pagibig = half === 1 ? Number(profile.pagibigContribution) : 0;
    const tax = Number(profile.withholdingTax) / 2;

    // Get active loans for this employee
    const loans = await db.loan.findMany({
      where: { employeeId: profile.employeeId, status: "ACTIVE" },
    });
    const cashAdvance = loans.reduce((s, l) => s + Number(l.monthlyDeduction), 0);

    const totalDeductions = sss + philhealth + pagibig + tax + cashAdvance + absences + lateDeduction + otherDeductions;
    const netPay = grossPay - totalDeductions;

    const cutoffLabel = half === 1
      ? `${new Date(year, month - 1).toLocaleString("en", { month: "long" })} 1-15, ${year}`
      : `${new Date(year, month - 1).toLocaleString("en", { month: "long" })} 16-${lastDay}, ${year}`;

    const payslip = await db.payslip.create({
      data: {
        employeeId: profile.employeeId,
        periodStart,
        periodEnd,
        payDate,
        cutoffLabel,
        basicPay,
        overtime,
        holidayPay,
        allowances: halfAllowances,
        otherEarnings,
        grossPay,
        daysWorked,
        daysAbsent,
        lateMins: chargeableMins,
        lateDeduction,
        sss,
        philhealth,
        pagibig,
        tax,
        cashAdvance,
        absences,
        otherDeductions,
        totalDeductions,
        netPay,
      },
    });

    // Deduct from active loans
    for (const loan of loans) {
      const deduction = Number(loan.monthlyDeduction);
      if (deduction > 0) {
        const newBalance = Math.max(0, Number(loan.balance) - deduction);
        await db.loan.update({
          where: { id: loan.id },
          data: {
            balance: newBalance,
            status: newBalance <= 0 ? "FULLY_PAID" : "ACTIVE",
          },
        });
        await db.loanPayment.create({
          data: { loanId: loan.id, amount: deduction, payDate },
        });
      }
    }

    created.push(payslip);
  }

  return NextResponse.json({ created: created.length, payslips: created });
}

// DELETE: Delete a payslip
export async function DELETE(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = session.user as any;
  if (user.role !== "ADMIN" && user.role !== "HR" && user.role !== "ACCOUNTING") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  await db.payslip.delete({ where: { id } });

  return NextResponse.json({ ok: true });
}
