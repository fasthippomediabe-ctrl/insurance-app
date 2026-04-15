import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import bcrypt from "bcryptjs";
import { z } from "zod";

const EditSchema = z.object({
  adminUsername: z.string().min(1),
  adminPassword: z.string().min(1),
  periodMonth: z.number().int().min(1).max(12).optional(),
  periodYear: z.number().int().min(2000).optional(),
  installmentNo: z.number().int().min(1).optional(),
  paymentDate: z.string().optional(),
  amount: z.number().positive().optional(),
  isFree: z.boolean().optional(),
  isSpotCash: z.boolean().optional(),
  paymentMethod: z.enum(["CASH", "BANK_TRANSFER", "GCASH", "OTHER"]).optional(),
  collectorId: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
});

async function verifyAdmin(username: string, password: string): Promise<boolean> {
  const user = await db.user.findFirst({
    where: { username, role: "ADMIN", isActive: true },
    select: { password: true },
  });
  if (!user) return false;
  return bcrypt.compare(password, user.password);
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const parsed = EditSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { adminUsername, adminPassword, ...changes } = parsed.data;

  // Verify admin credentials
  const isAdmin = await verifyAdmin(adminUsername, adminPassword);
  if (!isAdmin) {
    return NextResponse.json({ error: "Invalid admin credentials. Edit not authorized." }, { status: 403 });
  }

  const payment = await db.payment.findUnique({ where: { id: params.id } });
  if (!payment) return NextResponse.json({ error: "Payment not found." }, { status: 404 });

  // If period is being changed, check for conflicts with other payments
  const newMonth = changes.periodMonth ?? payment.periodMonth;
  const newYear = changes.periodYear ?? payment.periodYear;
  if (newMonth !== payment.periodMonth || newYear !== payment.periodYear) {
    const conflict = await db.payment.findFirst({
      where: {
        memberId: payment.memberId,
        periodYear: newYear,
        periodMonth: newMonth,
        NOT: { id: params.id },
      },
    });
    if (conflict) {
      return NextResponse.json(
        { error: `A payment for ${newMonth}/${newYear} already exists for this member.` },
        { status: 409 }
      );
    }
  }

  const updated = await db.payment.update({
    where: { id: params.id },
    data: {
      ...(changes.periodMonth !== undefined && { periodMonth: changes.periodMonth }),
      ...(changes.periodYear !== undefined && { periodYear: changes.periodYear }),
      ...(changes.installmentNo !== undefined && { installmentNo: changes.installmentNo }),
      ...(changes.paymentDate !== undefined && { paymentDate: new Date(changes.paymentDate) }),
      ...(changes.amount !== undefined && { amount: changes.amount }),
      ...(changes.isFree !== undefined && { isFree: changes.isFree }),
      ...(changes.isSpotCash !== undefined && { isSpotCash: changes.isSpotCash }),
      ...(changes.paymentMethod !== undefined && { paymentMethod: changes.paymentMethod }),
      ...(changes.collectorId !== undefined && { collectorId: changes.collectorId }),
      ...(changes.notes !== undefined && { notes: changes.notes }),
    },
    include: { member: { select: { mafNo: true, firstName: true, lastName: true } } },
  });

  return NextResponse.json(updated);
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth();
  const user = session?.user as any;
  if (!user || (user.role !== "ADMIN" && user.role !== "ACCOUNTING")) {
    return NextResponse.json({ error: "Only admins/accounting can delete payments." }, { status: 403 });
  }

  const payment = await db.payment.findUnique({ where: { id: params.id } });
  if (!payment) return NextResponse.json({ error: "Payment not found." }, { status: 404 });

  await db.$transaction(async (tx) => {
    // Delete linked commissions
    await tx.commission.deleteMany({ where: { memberId: payment.memberId, installmentNo: payment.installmentNo } });
    // Delete the payment
    await tx.payment.delete({ where: { id: params.id } });
  });

  return NextResponse.json({ ok: true });
}
