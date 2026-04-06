import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

// GET: List claims
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = session.user as any;

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status") || undefined;

  const where: any = {};
  if (user.role === "BRANCH_STAFF") where.branchId = user.branchId;
  if (status) where.status = status;

  const claims = await db.claim.findMany({
    where,
    include: {
      member: { select: { mafNo: true, firstName: true, lastName: true, planCategory: true } },
      documents: { select: { id: true, docType: true, fileName: true, createdAt: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(claims);
}

// POST: Create new claim
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = session.user as any;

  const data = await req.json();
  const {
    memberId, deceasedType, deceasedName, dateOfDeath, causeOfDeath,
    claimantName, claimantRelationship, claimantContact, claimantAddress, notes,
  } = data;

  if (!memberId || !deceasedName || !claimantName || !dateOfDeath) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const member = await db.member.findUnique({
    where: { id: memberId },
    select: { branchId: true, planCategory: true },
  });
  if (!member) return NextResponse.json({ error: "Member not found" }, { status: 404 });

  // Generate claim number
  const count = await db.claim.count();
  const claimNo = `CLM-${String(count + 1).padStart(5, "0")}`;

  const claim = await db.claim.create({
    data: {
      claimNo,
      memberId,
      branchId: member.branchId,
      deceasedType: deceasedType || "MEMBER",
      deceasedName,
      dateOfDeath: new Date(dateOfDeath),
      causeOfDeath: causeOfDeath || null,
      claimantName,
      claimantRelationship: claimantRelationship || "",
      claimantContact: claimantContact || null,
      claimantAddress: claimantAddress || null,
      planCategory: member.planCategory,
      notes: notes || null,
      processedBy: user.id,
    },
  });

  // Update member status
  await db.member.update({
    where: { id: memberId },
    data: {
      status: "DECEASED_CLAIMANT",
      deceasedDate: new Date(dateOfDeath),
    },
  });

  return NextResponse.json(claim, { status: 201 });
}

// PATCH: Update claim status / approved amount
export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = session.user as any;

  const data = await req.json();
  const { id, status, approvedAmount, releasedAmount, rejectionReason, notes } = data;

  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const updateData: any = {};
  const now = new Date();

  if (status) {
    updateData.status = status;
    if (status === "REQUIREMENTS_SUBMITTED") updateData.submittedToHO = null;
    if (status === "SUBMITTED_TO_HO") updateData.submittedToHO = now;
    if (status === "UNDER_REVIEW") updateData.verifiedDate = now;
    if (status === "APPROVED") { updateData.approvedDate = now; updateData.approvedBy = user.id; }
    if (status === "RELEASED") { updateData.dateReleased = now; }
    if (status === "REJECTED") { updateData.rejectedDate = now; updateData.rejectionReason = rejectionReason; }
  }

  if (approvedAmount !== undefined) updateData.approvedAmount = approvedAmount;
  if (releasedAmount !== undefined) updateData.releasedAmount = releasedAmount;
  if (notes !== undefined) updateData.notes = notes;

  const claim = await db.claim.update({ where: { id }, data: updateData });

  return NextResponse.json(claim);
}
