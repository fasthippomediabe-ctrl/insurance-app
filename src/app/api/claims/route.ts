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
  if ((user.role === "BRANCH_STAFF" || user.role === "COLLECTION_SUPERVISOR")) where.branchId = user.branchId;
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
    memberId, deceasedType, deathType, deceasedName, dateOfDeath, causeOfDeath,
    claimantName, claimantRelationship, claimantContact, claimantAddress, notes,
    isSpotService, spotServiceAmount, spotClientName, spotClientContact, spotClientAddress,
  } = data;

  if (isSpotService) {
    // Spot service — no member required
    const count = await db.claim.count();
    const claimNo = `CLM-${String(count + 1).padStart(5, "0")}`;

    // For spot service, we need a dummy member or handle differently
    // Create without memberId requirement — use first branch member as placeholder
    // Actually, let's make memberId optional for spot service
    const claim = await db.claim.create({
      data: {
        claimNo,
        memberId: memberId || "spot-service",
        branchId: user.branchId || (await db.branch.findFirst())?.id || "",
        deceasedType: "SPOT_SERVICE",
        deceasedName: spotClientName || deceasedName,
        dateOfDeath: new Date(dateOfDeath),
        causeOfDeath: causeOfDeath || null,
        deathType: deathType || null,
        claimantName: spotClientName || claimantName,
        claimantRelationship: "Self",
        claimantContact: spotClientContact || null,
        claimantAddress: spotClientAddress || null,
        planCategory: "SPOT_SERVICE",
        isSpotService: true,
        spotServiceAmount: spotServiceAmount || 30000,
        spotClientName: spotClientName || null,
        spotClientContact: spotClientContact || null,
        spotClientAddress: spotClientAddress || null,
        approvedAmount: spotServiceAmount || 30000,
        notes: notes || null,
        processedBy: user.id,
      },
    });
    return NextResponse.json(claim, { status: 201 });
  }

  // Regular member/beneficiary claim
  if (!memberId || !deceasedName || !claimantName || !dateOfDeath) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const member = await db.member.findUnique({
    where: { id: memberId },
    select: { branchId: true, planCategory: true },
  });
  if (!member) return NextResponse.json({ error: "Member not found" }, { status: 404 });

  const count = await db.claim.count();
  const claimNo = `CLM-${String(count + 1).padStart(5, "0")}`;

  const claim = await db.claim.create({
    data: {
      claimNo,
      memberId,
      branchId: member.branchId,
      deceasedType: deceasedType || "MEMBER",
      deathType: deathType || null,
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
  const { id, status, approvedAmount, releasedAmount, rejectionReason, notes, courierTracking, additionalDocsNote, statusNote } = data;

  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  // Get current claim for logging
  const current = await db.claim.findUnique({ where: { id }, select: { status: true } });
  if (!current) return NextResponse.json({ error: "Claim not found" }, { status: 404 });

  const updateData: any = {};
  const now = new Date();

  if (status) {
    updateData.status = status;
    if (status === "DOCS_IN_TRANSIT" && courierTracking) updateData.courierTracking = courierTracking;
    if (status === "DOCS_RECEIVED_HO") updateData.submittedToHO = now;
    if (status === "UNDER_REVIEW") updateData.verifiedDate = now;
    if (status === "ADDITIONAL_DOCS_NEEDED" && additionalDocsNote) updateData.additionalDocsNote = additionalDocsNote;
    if (status === "APPROVED") { updateData.approvedDate = now; updateData.approvedBy = user.id; }
    if (status === "RELEASED") { updateData.dateReleased = now; }
    if (status === "REJECTED") { updateData.rejectedDate = now; updateData.rejectionReason = rejectionReason; }
  }

  if (approvedAmount !== undefined) updateData.approvedAmount = approvedAmount;
  if (releasedAmount !== undefined) updateData.releasedAmount = releasedAmount;
  if (notes !== undefined) updateData.notes = notes;

  const claim = await db.claim.update({ where: { id }, data: updateData });

  // Log status change
  if (status && status !== current.status) {
    await db.claimStatusLog.create({
      data: {
        claimId: id,
        fromStatus: current.status,
        toStatus: status,
        note: statusNote || rejectionReason || additionalDocsNote || courierTracking || null,
        updatedBy: user.id,
      },
    });
  }

  return NextResponse.json(claim);
}
