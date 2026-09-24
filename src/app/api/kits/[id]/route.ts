import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth/auth";
import { localStore } from "@/lib/db/mongodb";
import { validatePrepKit } from "@/lib/pipeline/validator";

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const auth = await getUserFromRequest(req);
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const record = await localStore.findKitById(params.id);
    if (!record) {
      return NextResponse.json({ error: "Kit not found" }, { status: 404 });
    }

    // Kit isolation: users can only view their own kits
    if (record.userId !== auth.userId) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    return NextResponse.json({ kit: record.kit, id: record.id, updatedAt: record.updatedAt });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const auth = await getUserFromRequest(req);
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const record = await localStore.findKitById(params.id);
    if (!record) {
      return NextResponse.json({ error: "Kit not found" }, { status: 404 });
    }

    if (record.userId !== auth.userId) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    const { kit } = await req.json();
    if (!kit) {
      return NextResponse.json({ error: "Kit payload is required" }, { status: 400 });
    }

    // Validate kit structure
    const validation = validatePrepKit(kit);
    if (!validation.isValid) {
      return NextResponse.json(
        { error: "Invalid kit structure", details: validation.errors },
        { status: 400 }
      );
    }

    const updated = await localStore.updateKit(params.id, kit);
    return NextResponse.json({ success: true, kit: updated?.kit });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const auth = await getUserFromRequest(req);
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const success = await localStore.deleteKit(params.id, auth.userId);
    if (!success) {
      return NextResponse.json({ error: "Kit not found or access denied" }, { status: 404 });
    }

    return NextResponse.json({ success: true, message: "Kit deleted successfully" });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
