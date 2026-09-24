import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { NextRequest } from "next/server";
import { localStore } from "../db/mongodb";

const JWT_SECRET = process.env.JWT_SECRET || "super_secret_jwt_key_interview_prep_2026";

export interface AuthPayload {
  userId: string;
  email: string;
}

export async function hashPassword(password: string): Promise<string> {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(password, salt);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export function generateToken(payload: AuthPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: "7d" });
}

export function verifyToken(token: string): AuthPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET) as AuthPayload;
  } catch {
    return null;
  }
}

export async function getUserFromRequest(
  req: NextRequest | Request
): Promise<AuthPayload | null> {
  // Check Authorization header
  const authHeader = req.headers.get("authorization");
  let token: string | null = null;

  if (authHeader && authHeader.startsWith("Bearer ")) {
    token = authHeader.substring(7);
  }

  // Check cookie if not in header
  if (!token && "cookies" in req) {
    const cookieToken = (req as NextRequest).cookies.get("auth_token")?.value;
    if (cookieToken) token = cookieToken;
  }

  if (!token) return null;

  const payload = verifyToken(token);
  if (!payload) return null;

  const user = await localStore.findUserById(payload.userId);
  if (!user) return null;

  return payload;
}
