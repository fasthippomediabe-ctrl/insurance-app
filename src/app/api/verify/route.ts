import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

// Simple in-memory rate limiter
const attempts = new Map<string, { count: number; resetAt: number }>();

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const entry = attempts.get(ip);
  if (!entry || now > entry.resetAt) {
    attempts.set(ip, { count: 1, resetAt: now + 60000 }); // 1 minute window
    return false;
  }
  entry.count++;
  return entry.count > 5; // max 5 per minute
}

export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for") ?? req.headers.get("x-real-ip") ?? "unknown";

  if (isRateLimited(ip)) {
    return NextResponse.json({ error: "Too many requests. Please wait a moment and try again." }, { status: 429 });
  }

  const { mafNo, lastName } = await req.json();

  if (!mafNo || !lastName) {
    return NextResponse.json({ error: "MAF number and last name are required." }, { status: 400 });
  }

  const member = await db.member.findUnique({
    where: { mafNo: mafNo.trim() },
    select: {
      mafNo: true,
      firstName: true,
      lastName: true,
      planCategory: true,
      mopCode: true,
      status: true,
      enrollmentDate: true,
      monthlyDue: true,
      totalPlanAmount: true,
      branch: { select: { name: true } },
      payments: {
        select: {
          periodMonth: true,
          periodYear: true,
          installmentNo: true,
          amount: true,
          paymentDate: true,
          isFree: true,
        },
        orderBy: [{ periodYear: "desc" }, { periodMonth: "desc" }],
      },
    },
  });

  if (!member) {
    return NextResponse.json({ error: "No account found with that MAF number." }, { status: 404 });
  }

  // Verify last name matches (case insensitive)
  if (member.lastName.toLowerCase() !== lastName.trim().toLowerCase()) {
    return NextResponse.json({ error: "Last name does not match our records." }, { status: 403 });
  }

  const monthlyDue = Number(member.monthlyDue);
  // Free months count as 1 month's payment value
  const totalPaid = member.payments.reduce((s, p) => s + (p.isFree ? monthlyDue : Number(p.amount)), 0);
  const balance = Number(member.totalPlanAmount) - totalPaid;
  const lastPayment = member.payments.length > 0 ? member.payments[0] : null;

  return NextResponse.json({
    mafNo: member.mafNo,
    name: `${member.firstName} ${member.lastName}`,
    plan: member.planCategory,
    branch: member.branch.name,
    status: member.status,
    enrollmentDate: member.enrollmentDate.toISOString(),
    monthlyDue: Number(member.monthlyDue),
    totalPlanAmount: Number(member.totalPlanAmount),
    totalPaid,
    balance: Math.max(0, balance),
    installmentsDone: member.payments.filter((p) => !p.isFree).length,
    lastPaymentDate: lastPayment?.paymentDate?.toISOString() ?? null,
    payments: member.payments.map((p) => ({
      month: p.periodMonth,
      year: p.periodYear,
      installment: p.installmentNo,
      amount: p.isFree ? monthlyDue : Number(p.amount),
      date: p.paymentDate.toISOString(),
      isFree: p.isFree,
    })),
  });
}
