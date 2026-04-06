import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

// POST: Submit a member edit or delete request
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = session.user as any;

  const { memberId, requestType, changes, reason } = await req.json();

  if (!memberId || !requestType) {
    return NextResponse.json({ error: "Missing memberId or requestType" }, { status: 400 });
  }

  // Check no pending request for this member
  const existing = await db.memberEditRequest.findFirst({
    where: { memberId, status: "PENDING" },
  });
  if (existing) {
    return NextResponse.json({ error: "There is already a pending request for this member" }, { status: 400 });
  }

  const request = await db.memberEditRequest.create({
    data: {
      memberId,
      requestType,
      requestedBy: user.id,
      changes: changes ?? undefined,
      reason: reason || null,
    },
  });

  return NextResponse.json(request);
}

// GET: List pending requests (admin)
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = session.user as any;
  if (user.role !== "ADMIN") return NextResponse.json({ error: "Admin only" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status") ?? "PENDING";

  const requests = await db.memberEditRequest.findMany({
    where: { status: status as any },
    include: {
      member: { select: { mafNo: true, firstName: true, lastName: true, planCategory: true, mopCode: true, status: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(requests);
}

// PATCH: Approve or reject a request (admin)
export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = session.user as any;
  if (user.role !== "ADMIN") return NextResponse.json({ error: "Admin only" }, { status: 403 });

  const { requestId, action, reviewNote } = await req.json();

  const request = await db.memberEditRequest.findUnique({ where: { id: requestId } });
  if (!request) return NextResponse.json({ error: "Request not found" }, { status: 404 });
  if (request.status !== "PENDING") return NextResponse.json({ error: "Request already processed" }, { status: 400 });

  if (action === "APPROVE") {
    if (request.requestType === "DELETE") {
      // Delete the member and related records
      await db.$transaction([
        db.payment.deleteMany({ where: { memberId: request.memberId } }),
        db.beneficiary.deleteMany({ where: { memberId: request.memberId } }),
        db.commission.deleteMany({ where: { memberId: request.memberId } }),
        db.memberEditRequest.updateMany({ where: { memberId: request.memberId, status: "PENDING" }, data: { status: "APPROVED", reviewedBy: user.id, reviewedAt: new Date(), reviewNote } }),
        db.member.delete({ where: { id: request.memberId } }),
      ]);
    } else {
      // Apply the edit changes
      const changes = request.changes as Record<string, any>;
      if (changes) {
        const { dateOfBirth, enrollmentDate, effectivityDate, monthlyDue, totalPlanAmount, ...rest } = changes;
        await db.member.update({
          where: { id: request.memberId },
          data: {
            ...rest,
            ...(dateOfBirth !== undefined ? { dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : null } : {}),
            ...(enrollmentDate ? { enrollmentDate: new Date(enrollmentDate) } : {}),
            ...(effectivityDate !== undefined ? { effectivityDate: effectivityDate ? new Date(effectivityDate) : null } : {}),
            ...(monthlyDue !== undefined ? { monthlyDue } : {}),
            ...(totalPlanAmount !== undefined ? { totalPlanAmount } : {}),
          },
        });
      }
      await db.memberEditRequest.update({
        where: { id: requestId },
        data: { status: "APPROVED", reviewedBy: user.id, reviewedAt: new Date(), reviewNote },
      });
    }
  } else {
    // Reject
    await db.memberEditRequest.update({
      where: { id: requestId },
      data: { status: "REJECTED", reviewedBy: user.id, reviewedAt: new Date(), reviewNote },
    });
  }

  return NextResponse.json({ ok: true });
}
