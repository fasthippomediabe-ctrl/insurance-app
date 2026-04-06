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
  if (user.role !== "ADMIN") return NextResponse.json({ error: "Admin only" }, { status: 403 });

  const body = await req.json();
  const { isActive } = body;

  if (typeof isActive !== "boolean") {
    return NextResponse.json({ error: "isActive must be boolean" }, { status: 400 });
  }

  const employee = await db.employee.findUnique({ where: { id: params.id } });
  if (!employee) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const updated = await db.employee.update({
    where: { id: params.id },
    data: { isActive },
  });

  return NextResponse.json(updated);
}
