import { NextRequest, NextResponse } from "next/server";
import { localStore } from "@/lib/db/mongodb";
import { generateToken, verifyPassword } from "@/lib/auth/auth";

export async function POST(req: NextRequest) {
  try {
    const { email, password } = await req.json();

    if (!email || !password) {
      return NextResponse.json(
        { error: "Email and password are required." },
        { status: 400 }
      );
    }

    const user = await localStore.findUserByEmail(email);
    if (!user) {
      return NextResponse.json(
        { error: "Invalid email or password." },
        { status: 401 }
      );
    }

    const isMatch = await verifyPassword(password, user.passwordHash);
    if (!isMatch) {
      return NextResponse.json(
        { error: "Invalid email or password." },
        { status: 401 }
      );
    }

    const token = generateToken({ userId: user.id, email: user.email });

    const res = NextResponse.json({
      success: true,
      user: { id: user.id, email: user.email, name: user.name },
      token,
    });

    res.cookies.set("auth_token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 7 * 24 * 60 * 60,
      path: "/",
    });

    return res;
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Failed to log in." },
      { status: 500 }
    );
  }
}
