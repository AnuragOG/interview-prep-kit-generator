import { NextRequest, NextResponse } from "next/server";
import { localStore } from "@/lib/db/mongodb";
import { generateToken, hashPassword } from "@/lib/auth/auth";

export async function POST(req: NextRequest) {
  try {
    const { email, password, name } = await req.json();

    if (!email || !password || typeof email !== "string" || typeof password !== "string") {
      return NextResponse.json(
        { error: "Email and password are required." },
        { status: 400 }
      );
    }

    if (password.length < 6) {
      return NextResponse.json(
        { error: "Password must be at least 6 characters." },
        { status: 400 }
      );
    }

    const existing = await localStore.findUserByEmail(email);
    if (existing) {
      return NextResponse.json(
        { error: "An account with this email already exists." },
        { status: 409 }
      );
    }

    const passwordHash = await hashPassword(password);
    const userId = "usr_" + Math.random().toString(36).substring(2, 10);

    const user = await localStore.createUser({
      id: userId,
      email: email.trim().toLowerCase(),
      name: name?.trim() || email.split("@")[0],
      passwordHash,
      createdAt: new Date().toISOString(),
    });

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
      { error: err.message || "Failed to register user." },
      { status: 500 }
    );
  }
}
