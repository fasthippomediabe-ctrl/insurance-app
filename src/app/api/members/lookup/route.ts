import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const mafNo = searchParams.get("mafNo")?.trim();

  if (!mafNo) {
    return NextResponse.json({ error: "mafNo is required" }, { status: 400 });
  }

  const member = await db.member.findUnique({
    where: { mafNo },
    select: {
      id: true,
      mafNo: true,
      firstName: true,
      lastName: true,
      planCategory: true,
      mopCode: true,
      monthlyDue: true,
      effectivityDate: true,
      status: true,
      agent: { select: { isActive: true } },
      branch: { select: { name: true } },
      payments: {
        select: { installmentNo: true, isFree: true },
        orderBy: { installmentNo: "desc" },
      },
    },
  });

  if (!member) {
    return NextResponse.json({ exists: false });
  }

  const lastInstallmentNo = member.payments[0]?.installmentNo ?? 0;
  const paidPaymentCount = member.payments.filter((p) => !p.isFree).length;

  return NextResponse.json({
    exists: true,
    name: `${member.firstName} ${member.lastName}`,
    branch: member.branch?.name ?? "",
    id: member.id,
    mafNo: member.mafNo,
    firstName: member.firstName,
    lastName: member.lastName,
    planCategory: member.planCategory,
    mopCode: member.mopCode,
    monthlyDue: Number(member.monthlyDue),
    effectivityDate: member.effectivityDate,
    status: member.status,
    lastInstallmentNo,
    nextInstallmentNo: lastInstallmentNo + 1,
    paidPaymentCount,
    agentActive: member.agent?.isActive ?? true,
  });
}
