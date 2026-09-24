import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth/auth";
import { localStore } from "@/lib/db/mongodb";

export async function GET(req: NextRequest) {
  try {
    const auth = await getUserFromRequest(req);
    if (!auth) {
      return NextResponse.json({ user: null }, { status: 401 });
    }

    const user = await localStore.findUserById(auth.userId);
    if (!user) {
      return NextResponse.json({ user: null }, { status: 401 });
    }

    return NextResponse.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        createdAt: user.createdAt,
      },
    });
  } catch (err: any) {
    return NextResponse.json({ user: null }, { status: 500 });
  }
}
