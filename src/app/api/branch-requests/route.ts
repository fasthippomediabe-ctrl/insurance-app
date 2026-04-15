import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

// GET: List requests (filtered by role — branch staff sees only their branch)
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = session.user as any;

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status") || undefined;

  const where: any = {};
  if (user.role === "BRANCH_STAFF") where.branchId = user.branchId;
  if (status) where.status = status;

  const requests = await db.branchRequest.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  // Attach branch names
  const branches = await db.branch.findMany({ select: { id: true, name: true } });
  const branchMap = new Map(branches.map((b) => [b.id, b.name]));

  return NextResponse.json(requests.map((r) => ({ ...r, branchName: branchMap.get(r.branchId) ?? "" })));
}

// POST: Create new request (branch staff)
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = session.user as any;

  if (user.role !== "BRANCH_STAFF" && user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const data = await req.json();
  const { type, title, description, amount, dueDate, vendor, attachments, branchId } = data;

  if (!type || !title || !description || !amount) {
    return NextResponse.json({ error: "type, title, description, amount required" }, { status: 400 });
  }

  const branch = user.role === "BRANCH_STAFF" ? user.branchId : (branchId || user.branchId);
  if (!branch) return NextResponse.json({ error: "Branch is required" }, { status: 400 });

  const count = await db.branchRequest.count();
  const requestNo = `BRQ-${String(count + 1).padStart(6, "0")}`;

  const request = await db.branchRequest.create({
    data: {
      requestNo,
      type,
      branchId: branch,
      requestedBy: user.id,
      title,
      description,
      amount,
      dueDate: dueDate ? new Date(dueDate) : null,
      vendor: vendor || null,
      attachments: attachments || null,
    },
  });

  return NextResponse.json(request, { status: 201 });
}

// PATCH: Approve/reject/release (admin or accounting)
export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = session.user as any;

  if (user.role !== "ADMIN" && user.role !== "ACCOUNTING") {
    return NextResponse.json({ error: "Admin or Accounting only" }, { status: 403 });
  }

  const { id, status, reviewNote } = await req.json();
  if (!id || !status) return NextResponse.json({ error: "id and status required" }, { status: 400 });

  const now = new Date();
  const updateData: any = { status, reviewNote: reviewNote || null };

  if (status === "APPROVED" || status === "REJECTED") {
    updateData.reviewedBy = user.id;
    updateData.reviewedAt = now;
  }
  if (status === "RELEASED") {
    updateData.releasedBy = user.id;
    updateData.releasedAt = now;
  }

  const request = await db.branchRequest.update({ where: { id }, data: updateData });
  return NextResponse.json(request);
}

// DELETE: Cancel request (branch staff who requested, or admin)
export async function DELETE(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = session.user as any;

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const existing = await db.branchRequest.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (user.role === "BRANCH_STAFF") {
    if (existing.requestedBy !== user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    if (existing.status !== "PENDING") {
      return NextResponse.json({ error: "Only pending requests can be deleted" }, { status: 400 });
    }
  }

  await db.branchRequest.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
