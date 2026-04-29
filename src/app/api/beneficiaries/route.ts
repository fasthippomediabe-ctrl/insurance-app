import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

function allowed(role: string) {
  return role === "ADMIN" || role === "BRANCH_STAFF" || role === "HR";
}

// POST: Add a new beneficiary to a member
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = session.user as any;
  if (!allowed(user.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const data = await req.json();
  const { memberId, firstName, middleName, lastName, dateOfBirth, age, relationship, effectivityDate } = data;

  if (!memberId || !firstName || !lastName || !relationship) {
    return NextResponse.json({ error: "memberId, firstName, lastName, relationship required" }, { status: 400 });
  }

  // Branch staff scoping
  if (user.role === "BRANCH_STAFF") {
    const member = await db.member.findUnique({ where: { id: memberId }, select: { branchId: true } });
    if (!member || member.branchId !== user.branchId) {
      return NextResponse.json({ error: "Member not in your branch" }, { status: 403 });
    }
  }

  // Determine next order
  const last = await db.beneficiary.findFirst({
    where: { memberId },
    orderBy: { order: "desc" },
    select: { order: true },
  });
  const nextOrder = (last?.order ?? 0) + 1;

  const beneficiary = await db.beneficiary.create({
    data: {
      memberId,
      order: nextOrder,
      firstName,
      middleName: middleName || null,
      lastName,
      dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : null,
      age: age ? parseInt(String(age)) : null,
      relationship,
      effectivityDate: effectivityDate ? new Date(effectivityDate) : null,
    },
  });

  return NextResponse.json(beneficiary, { status: 201 });
}

// PATCH: Edit beneficiary
export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = session.user as any;
  if (!allowed(user.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const data = await req.json();
  const { id, firstName, middleName, lastName, dateOfBirth, age, relationship, effectivityDate } = data;
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  // Branch staff scoping
  if (user.role === "BRANCH_STAFF") {
    const ben = await db.beneficiary.findUnique({
      where: { id },
      select: { member: { select: { branchId: true } } },
    });
    if (!ben || ben.member.branchId !== user.branchId) {
      return NextResponse.json({ error: "Not in your branch" }, { status: 403 });
    }
  }

  const updateData: any = {};
  if (firstName !== undefined) updateData.firstName = firstName;
  if (middleName !== undefined) updateData.middleName = middleName || null;
  if (lastName !== undefined) updateData.lastName = lastName;
  if (relationship !== undefined) updateData.relationship = relationship;
  if (age !== undefined) updateData.age = age ? parseInt(String(age)) : null;
  if (dateOfBirth !== undefined) updateData.dateOfBirth = dateOfBirth ? new Date(dateOfBirth) : null;
  if (effectivityDate !== undefined) updateData.effectivityDate = effectivityDate ? new Date(effectivityDate) : null;

  const beneficiary = await db.beneficiary.update({ where: { id }, data: updateData });
  return NextResponse.json(beneficiary);
}

// DELETE: Remove beneficiary
export async function DELETE(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = session.user as any;
  if (!allowed(user.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  if (user.role === "BRANCH_STAFF") {
    const ben = await db.beneficiary.findUnique({
      where: { id },
      select: { member: { select: { branchId: true } } },
    });
    if (!ben || ben.member.branchId !== user.branchId) {
      return NextResponse.json({ error: "Not in your branch" }, { status: 403 });
    }
  }

  await db.beneficiary.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
