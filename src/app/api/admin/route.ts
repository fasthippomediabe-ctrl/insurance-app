import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import bcrypt from "bcryptjs";
import { z } from "zod";

const BranchSchema = z.object({ name: z.string().min(1), address: z.string().optional() });
const UserSchema = z.object({
  username: z.string().min(3),
  password: z.string().min(6),
  role: z.enum(["ADMIN", "BRANCH_STAFF", "HR", "ACCOUNTING"]),
  branchId: z.string().optional(),
});

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = session.user as any;
  if (user.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { type, data } = await req.json();

  if (type === "branch") {
    const parsed = BranchSchema.safeParse(data);
    if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    const branch = await db.branch.create({ data: parsed.data });
    return NextResponse.json(branch, { status: 201 });
  }

  if (type === "user") {
    const parsed = UserSchema.safeParse(data);
    if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    const hashedPw = await bcrypt.hash(parsed.data.password, 12);
    const newUser = await db.user.create({
      data: {
        username: parsed.data.username,
        password: hashedPw,
        role: parsed.data.role,
        branchId: parsed.data.branchId || null,
      },
    });
    return NextResponse.json({ id: newUser.id, username: newUser.username, role: newUser.role }, { status: 201 });
  }

return NextResponse.json({ error: "Unknown type" }, { status: 400 });
}
