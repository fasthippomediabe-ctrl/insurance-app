import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { EmployeePosition } from "@prisma/client";
import { z } from "zod";

const EmployeeSchema = z.object({
  employeeNo: z.string().min(1),
  primaryPosition: z.nativeEnum(EmployeePosition),
  additionalPositions: z.array(z.nativeEnum(EmployeePosition)).optional().default([]),
  firstName: z.string().min(1),
  middleName: z.string().optional(),
  lastName: z.string().min(1),
  nickname: z.string().optional(),
  dateOfBirth: z.string().optional(),
  gender: z.enum(["MALE", "FEMALE"]).optional(),
  civilStatus: z.string().optional(),
  contactNumber: z.string().optional(),
  address: z.string().optional(),
  email: z.string().email().optional().or(z.literal("")),
  dateHired: z.string().optional(),
  branchId: z.string().min(1),
  sponsorId: z.string().optional(),
});

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = session.user as any;
  const { searchParams } = new URL(req.url);
  const position = searchParams.get("position");
  const branchId = searchParams.get("branchId");

  const where: any = { isActive: true };
  if (user.role === "BRANCH_STAFF") where.branchId = user.branchId;
  if (position) where.primaryPosition = position as EmployeePosition;
  if (branchId && user.role === "ADMIN") where.branchId = branchId;

  const employees = await db.employee.findMany({
    where,
    include: { branch: true, sponsor: true, positions: { where: { isActive: true } } },
    orderBy: [{ primaryPosition: "asc" }, { lastName: "asc" }],
  });

  return NextResponse.json(employees);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const parsed = EmployeeSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const data = parsed.data;

  // Check duplicate employee number
  const existing = await db.employee.findUnique({ where: { employeeNo: data.employeeNo } });
  if (existing) {
    return NextResponse.json({ error: "Employee number already exists." }, { status: 409 });
  }

  // All positions this employee holds (primary + additional, deduplicated)
  const allPositions = Array.from(new Set([data.primaryPosition, ...(data.additionalPositions ?? [])]));

  const employee = await db.employee.create({
    data: {
      employeeNo: data.employeeNo,
      primaryPosition: data.primaryPosition,
      firstName: data.firstName,
      middleName: data.middleName,
      lastName: data.lastName,
      nickname: data.nickname,
      dateOfBirth: data.dateOfBirth ? new Date(data.dateOfBirth) : undefined,
      gender: data.gender,
      civilStatus: data.civilStatus,
      contactNumber: data.contactNumber,
      address: data.address,
      email: data.email || undefined,
      dateHired: data.dateHired ? new Date(data.dateHired) : new Date(),
      branchId: data.branchId,
      sponsorId: data.sponsorId || undefined,
      // Create position records for all positions
      positions: {
        create: allPositions.map((pos) => ({ position: pos })),
      },
    },
    include: { branch: true, positions: true },
  });

  return NextResponse.json(employee, { status: 201 });
}
