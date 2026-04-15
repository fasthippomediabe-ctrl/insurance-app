import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const member = await db.member.findUnique({
    where: { id: params.id },
    include: {
      beneficiaries: { orderBy: { order: "asc" } },
      agent: true,
      collector: true,
      branch: true,
      payments: { orderBy: [{ periodYear: "asc" }, { periodMonth: "asc" }] },
      commissions: true,
    },
  });

  if (!member) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(member);
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();

  // Separate date and numeric fields from the rest
  const { dateOfBirth, enrollmentDate, effectivityDate, lapseDate, reinstatedDate,
    monthlyDue, totalPlanAmount, ...rest } = body;

  const member = await db.member.update({
    where: { id: params.id },
    data: {
      ...rest,
      ...(dateOfBirth !== undefined ? { dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : null } : {}),
      ...(enrollmentDate ? { enrollmentDate: new Date(enrollmentDate) } : {}),
      ...(effectivityDate !== undefined ? { effectivityDate: effectivityDate ? new Date(effectivityDate) : null } : {}),
      ...(lapseDate !== undefined ? { lapseDate: lapseDate ? new Date(lapseDate) : null } : {}),
      ...(reinstatedDate !== undefined ? { reinstatedDate: reinstatedDate ? new Date(reinstatedDate) : null } : {}),
      ...(monthlyDue !== undefined ? { monthlyDue } : {}),
      ...(totalPlanAmount !== undefined ? { totalPlanAmount } : {}),
    },
    include: { beneficiaries: true },
  });

  return NextResponse.json(member);
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = session.user as any;
  if (user.role !== "ADMIN") return NextResponse.json({ error: "Admin only" }, { status: 403 });

  await db.$transaction([
    db.payment.deleteMany({ where: { memberId: params.id } }),
    db.beneficiary.deleteMany({ where: { memberId: params.id } }),
    db.commission.deleteMany({ where: { memberId: params.id } }),
    db.member.delete({ where: { id: params.id } }),
  ]);

  return NextResponse.json({ ok: true });
}
