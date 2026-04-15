import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const employee = await db.employee.findUnique({
    where: { id: params.id },
    include: {
      branch: true,
      sponsor: true,
      recruits: { where: { isActive: true }, orderBy: { lastName: "asc" } },
      positions: { orderBy: { dateGranted: "asc" } },
    },
  });

  if (!employee) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(employee);
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = session.user as any;
  if (user.role !== "ADMIN" && user.role !== "HR" && user.role !== "ACCOUNTING") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();

  const employee = await db.employee.findUnique({ where: { id: params.id } });
  if (!employee) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const {
    isActive, employeeNo, firstName, middleName, lastName, nickname,
    dateOfBirth, gender, civilStatus, contactNumber, address, email,
    photo, dateHired, branchId,
  } = body;

  const updateData: any = {};

  // Toggle active (existing functionality)
  if (typeof isActive === "boolean") updateData.isActive = isActive;

  // Basic fields
  if (employeeNo !== undefined) updateData.employeeNo = employeeNo;
  if (firstName !== undefined) updateData.firstName = firstName;
  if (middleName !== undefined) updateData.middleName = middleName;
  if (lastName !== undefined) updateData.lastName = lastName;
  if (nickname !== undefined) updateData.nickname = nickname;
  if (gender !== undefined) updateData.gender = gender || null;
  if (civilStatus !== undefined) updateData.civilStatus = civilStatus || null;
  if (contactNumber !== undefined) updateData.contactNumber = contactNumber || null;
  if (address !== undefined) updateData.address = address || null;
  if (email !== undefined) updateData.email = email || null;
  if (photo !== undefined) updateData.photo = photo;
  if (branchId !== undefined) updateData.branchId = branchId;
  if (dateOfBirth !== undefined) updateData.dateOfBirth = dateOfBirth ? new Date(dateOfBirth) : null;
  if (dateHired !== undefined) updateData.dateHired = dateHired ? new Date(dateHired) : undefined;

  const updated = await db.employee.update({
    where: { id: params.id },
    data: updateData,
  });

  return NextResponse.json(updated);
}
