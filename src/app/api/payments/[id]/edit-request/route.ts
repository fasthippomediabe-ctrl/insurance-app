import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";

const RequestSchema = z.object({
  reason: z.string().optional(),
  attachment: z.string().optional(), // base64 image data URL
  changes: z.object({
    periodMonth:   z.number().int().min(1).max(12).optional(),
    periodYear:    z.number().int().min(2000).optional(),
    installmentNo: z.number().int().min(1).optional(),
    paymentDate:   z.string().optional(),
    amount:        z.number().positive().optional(),
    isFree:        z.boolean().optional(),
    isSpotCash:    z.boolean().optional(),
    paymentMethod: z.enum(["CASH", "BANK_TRANSFER", "GCASH", "OTHER"]).optional(),
    collectorId:   z.string().nullable().optional(),
    notes:         z.string().nullable().optional(),
  }),
});

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const payment = await db.payment.findUnique({ where: { id: params.id } });
  if (!payment) return NextResponse.json({ error: "Payment not found." }, { status: 404 });

  const body = await req.json();
  const parsed = RequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { reason, changes, attachment } = parsed.data;
  const user = session.user as any;

  // Check if there's already a pending request for this payment
  const existing = await db.paymentEditRequest.findFirst({
    where: { paymentId: params.id, status: "PENDING" },
  });
  if (existing) {
    return NextResponse.json(
      { error: "A pending edit request already exists for this payment. Please wait for admin review." },
      { status: 409 }
    );
  }

  const request = await db.paymentEditRequest.create({
    data: {
      paymentId: params.id,
      requestedBy: user.id,
      changes,
      reason: reason ?? null,
      attachment: attachment ?? null,
    },
  });

  return NextResponse.json(request, { status: 201 });
}
