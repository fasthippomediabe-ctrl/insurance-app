import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

// POST: Upload document to claim
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = session.user as any;

  const { claimId, docType, fileName, fileData } = await req.json();

  if (!claimId || !docType || !fileData) {
    return NextResponse.json({ error: "claimId, docType, fileData required" }, { status: 400 });
  }

  const doc = await db.claimDocument.create({
    data: {
      claimId,
      docType,
      fileName: fileName || `${docType}.jpg`,
      fileData,
      uploadedBy: user.id,
    },
  });

  return NextResponse.json({ id: doc.id, docType: doc.docType, fileName: doc.fileName }, { status: 201 });
}

// DELETE: Remove document
export async function DELETE(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  await db.claimDocument.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
