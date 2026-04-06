import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { EmployeePosition } from "@prisma/client";
import { z } from "zod";

const Schema = z.object({
  newPosition: z.nativeEnum(EmployeePosition),
  setAsPrimary: z.boolean().default(true),
  promotedDate: z.string().optional(),
  notes: z.string().optional(),
});

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const parsed = Schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { newPosition, setAsPrimary, promotedDate, notes } = parsed.data;

  const employee = await db.employee.findUnique({
    where: { id: params.id },
    include: { positions: true },
  });
  if (!employee) return NextResponse.json({ error: "Employee not found" }, { status: 404 });

  const alreadyHas = employee.positions.some((p) => p.position === newPosition && p.isActive);
  if (alreadyHas) {
    return NextResponse.json({ error: `Employee already holds the ${newPosition} position.` }, { status: 409 });
  }

  const date = promotedDate ? new Date(promotedDate) : new Date();

  // Run all writes in a transaction
  await db.$transaction([
    // 1. Add the new position record
    db.employeePositionRecord.create({
      data: {
        employeeId: params.id,
        position: newPosition,
        dateGranted: date,
        isActive: true,
        notes: notes || null,
      },
    }),
    // 2. Log promotion history
    db.promotionHistory.create({
      data: {
        employeeId: params.id,
        fromPosition: employee.primaryPosition,
        toPosition: newPosition,
        promotedDate: date,
        notes: notes || null,
      },
    }),
    // 3. Update primary position if requested
    ...(setAsPrimary
      ? [db.employee.update({
          where: { id: params.id },
          data: { primaryPosition: newPosition },
        })]
      : []),
  ]);

  return NextResponse.json({ success: true });
}
