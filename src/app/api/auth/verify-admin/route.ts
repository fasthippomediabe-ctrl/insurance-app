import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import bcrypt from "bcryptjs";
import { z } from "zod";

const Schema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
});

export async function POST(req: NextRequest) {
  const body = await req.json();
  const parsed = Schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Username and password required." }, { status: 400 });
  }

  const { username, password } = parsed.data;

  const user = await db.user.findFirst({
    where: { username, role: "ADMIN", isActive: true },
    select: { id: true, password: true },
  });

  if (!user) {
    return NextResponse.json({ error: "Invalid admin credentials." }, { status: 401 });
  }

  const valid = await bcrypt.compare(password, user.password);
  if (!valid) {
    return NextResponse.json({ error: "Invalid admin credentials." }, { status: 401 });
  }

  return NextResponse.json({ ok: true });
}
