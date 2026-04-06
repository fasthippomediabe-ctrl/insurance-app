import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getMonthlyDue, getTotalPlanAmount, getSpotCashAmount } from "@/lib/utils";
import { MopCode, PlanCategory, InsuranceType, Gender } from "@prisma/client";
import { z } from "zod";

const MemberSchema = z.object({
  mafNo: z.string().min(1),
  enrollmentDate: z.string(),
  insuranceType: z.nativeEnum(InsuranceType),
  planCategory: z.nativeEnum(PlanCategory),
  mopCode: z.nativeEnum(MopCode),
  firstName: z.string().min(1),
  middleName: z.string().optional(),
  lastName: z.string().min(1),
  address: z.string().min(1),
  dateOfBirth: z.string().optional(),
  age: z.number().optional(),
  religion: z.string().optional(),
  contactNumber: z.string().optional(),
  occupation: z.string().optional(),
  civilStatus: z.string().optional(),
  gender: z.nativeEnum(Gender).optional(),
  spotCash: z.boolean().default(false),
  effectivityDate: z.string().optional(),
  branchId: z.string().min(1),
  agentId: z.string().optional(),
  collectorId: z.string().optional(),
  beneficiaries: z.array(z.object({
    order: z.number(),
    firstName: z.string(),
    middleName: z.string().optional(),
    lastName: z.string(),
    dateOfBirth: z.string().optional(),
    age: z.number().optional(),
    relationship: z.string(),
    effectivityDate: z.string().optional(),
  })).optional(),
});

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = session.user as any;
  const { searchParams } = new URL(req.url);
  const search = searchParams.get("search");
  const status = searchParams.get("status");
  const branchId = searchParams.get("branchId");
  const collectorId = searchParams.get("collectorId");

  const where: any = {};
  if (user.role === "BRANCH_STAFF") where.branchId = user.branchId;
  if (status) where.status = status;
  if (branchId && user.role === "ADMIN") where.branchId = branchId;
  if (collectorId) where.collectorId = collectorId;
  if (search) {
    where.OR = [
      { mafNo: { contains: search, mode: "insensitive" } },
      { firstName: { contains: search, mode: "insensitive" } },
      { lastName: { contains: search, mode: "insensitive" } },
    ];
  }

  const members = await db.member.findMany({
    where,
    include: { branch: true, agent: true, collector: true, beneficiaries: true },
    orderBy: { mafNo: "asc" },
  });

  return NextResponse.json(members);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const parsed = MemberSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const data = parsed.data;
  const monthlyDue = getMonthlyDue(data.mopCode);
  const totalPlanAmount = getTotalPlanAmount(data.mopCode);
  const spotCashAmount = data.spotCash ? getSpotCashAmount(data.mopCode) : undefined;

  const { beneficiaries, ...memberData } = data;

  const member = await db.member.create({
    data: {
      ...memberData,
      enrollmentDate: new Date(memberData.enrollmentDate),
      dateOfBirth: memberData.dateOfBirth ? new Date(memberData.dateOfBirth) : undefined,
      effectivityDate: memberData.effectivityDate ? new Date(memberData.effectivityDate) : new Date(memberData.enrollmentDate),
      monthlyDue,
      totalPlanAmount,
      spotCashAmount,
      beneficiaries: beneficiaries?.length
        ? {
            create: beneficiaries.map((b) => ({
              ...b,
              dateOfBirth: b.dateOfBirth ? new Date(b.dateOfBirth) : undefined,
              effectivityDate: b.effectivityDate ? new Date(b.effectivityDate) : undefined,
            })),
          }
        : undefined,
    },
    include: { beneficiaries: true },
  });

  return NextResponse.json(member, { status: 201 });
}
