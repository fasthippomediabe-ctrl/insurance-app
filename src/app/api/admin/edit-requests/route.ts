import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export async function GET(req: NextRequest) {
  const session = await auth();
  const user = session?.user as any;
  if (!user || user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status") ?? "PENDING";

  const requests = await db.paymentEditRequest.findMany({
    where: { status: status as any },
    orderBy: { createdAt: "desc" },
  });

  // Enrich with payment + member + requester info
  const enriched = await Promise.all(
    requests.map(async (r) => {
      const [payment, requester] = await Promise.all([
        db.payment.findUnique({
          where: { id: r.paymentId },
          include: { member: { select: { mafNo: true, firstName: true, lastName: true } } },
        }),
        db.user.findUnique({
          where: { id: r.requestedBy },
          select: { username: true, branch: { select: { name: true } } },
        }),
      ]);
      return { ...r, payment, requester };
    })
  );

  return NextResponse.json(enriched);
}
