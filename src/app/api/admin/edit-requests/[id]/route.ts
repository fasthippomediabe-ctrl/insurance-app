import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";

const ReviewSchema = z.object({
  action: z.enum(["approve", "reject"]),
  note: z.string().optional(),
});

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth();
  const user = session?.user as any;
  if (!user || user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const parsed = ReviewSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { action, note } = parsed.data;

  const request = await db.paymentEditRequest.findUnique({ where: { id: params.id } });
  if (!request) return NextResponse.json({ error: "Request not found." }, { status: 404 });
  if (request.status !== "PENDING") {
    return NextResponse.json({ error: "This request has already been reviewed." }, { status: 409 });
  }

  if (action === "reject") {
    const updated = await db.paymentEditRequest.update({
      where: { id: params.id },
      data: {
        status: "REJECTED",
        reviewedBy: user.id,
        reviewedAt: new Date(),
        reviewNote: note ?? null,
      },
    });
    return NextResponse.json(updated);
  }

  // Approve: apply changes to the payment
  const changes = request.changes as Record<string, any>;
  const payment = await db.payment.findUnique({ where: { id: request.paymentId } });
  if (!payment) return NextResponse.json({ error: "Payment no longer exists." }, { status: 404 });

  // Check for period conflict if month/year is being changed
  const newMonth = changes.periodMonth ?? payment.periodMonth;
  const newYear = changes.periodYear ?? payment.periodYear;
  if (newMonth !== payment.periodMonth || newYear !== payment.periodYear) {
    const conflict = await db.payment.findFirst({
      where: {
        memberId: payment.memberId,
        periodYear: newYear,
        periodMonth: newMonth,
        NOT: { id: payment.id },
      },
    });
    if (conflict) {
      // Mark request as rejected due to conflict
      await db.paymentEditRequest.update({
        where: { id: params.id },
        data: {
          status: "REJECTED",
          reviewedBy: user.id,
          reviewedAt: new Date(),
          reviewNote: `Cannot apply: a payment for ${newMonth}/${newYear} already exists for this member.`,
        },
      });
      return NextResponse.json(
        { error: `A payment for ${newMonth}/${newYear} already exists for this member.` },
        { status: 409 }
      );
    }
  }

  // Apply the changes in a transaction
  await db.$transaction([
    db.payment.update({
      where: { id: request.paymentId },
      data: {
        ...(changes.periodMonth   !== undefined && { periodMonth: changes.periodMonth }),
        ...(changes.periodYear    !== undefined && { periodYear: changes.periodYear }),
        ...(changes.installmentNo !== undefined && { installmentNo: changes.installmentNo }),
        ...(changes.paymentDate   !== undefined && { paymentDate: new Date(changes.paymentDate) }),
        ...(changes.amount        !== undefined && { amount: changes.amount }),
        ...(changes.isFree        !== undefined && { isFree: changes.isFree }),
        ...(changes.isSpotCash    !== undefined && { isSpotCash: changes.isSpotCash }),
        ...(changes.paymentMethod !== undefined && { paymentMethod: changes.paymentMethod }),
        ...(changes.collectorId   !== undefined && { collectorId: changes.collectorId }),
        ...(changes.notes         !== undefined && { notes: changes.notes }),
      },
    }),
    db.paymentEditRequest.update({
      where: { id: params.id },
      data: {
        status: "APPROVED",
        reviewedBy: user.id,
        reviewedAt: new Date(),
        reviewNote: note ?? null,
      },
    }),
  ]);

  return NextResponse.json({ ok: true });
}
