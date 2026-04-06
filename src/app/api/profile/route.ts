import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import bcrypt from "bcryptjs";

// GET: Get current user profile
export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = session.user as any;

  const profile = await db.user.findUnique({
    where: { id: user.id },
    select: {
      id: true, username: true, role: true, displayName: true,
      email: true, phone: true, avatar: true,
      branch: { select: { name: true } },
    },
  });

  return NextResponse.json(profile);
}

// PATCH: Update profile
export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = session.user as any;

  const data = await req.json();
  const { displayName, email, phone, avatar, currentPassword, newPassword } = data;

  const updateData: any = {};
  if (displayName !== undefined) updateData.displayName = displayName || null;
  if (email !== undefined) updateData.email = email || null;
  if (phone !== undefined) updateData.phone = phone || null;
  if (avatar !== undefined) updateData.avatar = avatar || null;

  // Password change
  if (newPassword) {
    if (!currentPassword) {
      return NextResponse.json({ error: "Current password is required to change password." }, { status: 400 });
    }
    const dbUser = await db.user.findUnique({ where: { id: user.id }, select: { password: true } });
    if (!dbUser) return NextResponse.json({ error: "User not found" }, { status: 404 });

    const match = await bcrypt.compare(currentPassword, dbUser.password);
    if (!match) {
      return NextResponse.json({ error: "Current password is incorrect." }, { status: 403 });
    }

    updateData.password = await bcrypt.hash(newPassword, 12);
  }

  const updated = await db.user.update({
    where: { id: user.id },
    data: updateData,
    select: { id: true, username: true, displayName: true, email: true, phone: true },
  });

  return NextResponse.json(updated);
}
