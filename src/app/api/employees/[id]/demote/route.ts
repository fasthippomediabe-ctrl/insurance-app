import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { EmployeePosition } from "@prisma/client";
import { z } from "zod";

const Schema = z.object({
  removePosition: z.nativeEnum(EmployeePosition),
  newPrimaryPosition: z.nativeEnum(EmployeePosition).optional(),
  demotedDate: z.string().optional(),
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

  const { removePosition, newPrimaryPosition, demotedDate, notes } = parsed.data;

  const employee = await db.employee.findUnique({
    where: { id: params.id },
    include: { positions: { where: { isActive: true } } },
  });
  if (!employee) return NextResponse.json({ error: "Employee not found" }, { status: 404 });

  const posRecord = employee.positions.find((p) => p.position === removePosition);
  if (!posRecord) {
    return NextResponse.json({ error: `Employee does not hold the ${removePosition} position.` }, { status: 409 });
  }

  // If removing their only position, block it
  if (employee.positions.length === 1) {
    return NextResponse.json({ error: "Cannot remove the only position. Deactivate the employee instead." }, { status: 400 });
  }

  // If removing primary position, a new primary must be supplied
  const removingPrimary = employee.primaryPosition === removePosition;
  if (removingPrimary && !newPrimaryPosition) {
    return NextResponse.json({ error: "Must specify a new primary position when removing the primary." }, { status: 400 });
  }

  const date = demotedDate ? new Date(demotedDate) : new Date();

  await db.$transaction([
    // 1. Deactivate the position record
    db.employeePositionRecord.update({
      where: { id: posRecord.id },
      data: { isActive: false },
    }),
    // 2. Log in promotion history (demotion = fromPosition is higher, toPosition is lower)
    db.promotionHistory.create({
      data: {
        employeeId: params.id,
        fromPosition: removePosition,
        toPosition: newPrimaryPosition ?? (employee.positions.find((p) => p.position !== removePosition)!.position),
        promotedDate: date,
        notes: notes ? `[DEMOTION] ${notes}` : "[DEMOTION]",
      },
    }),
    // 3. Update primary position if needed
    ...(removingPrimary && newPrimaryPosition
      ? [db.employee.update({
          where: { id: params.id },
          data: { primaryPosition: newPrimaryPosition },
        })]
      : []),
  ]);

  return NextResponse.json({ success: true });
}
