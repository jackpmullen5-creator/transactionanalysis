import "server-only";
import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";
import { prisma } from "./db";
import type { User } from "@prisma/client";
import type { Role } from "./types";

const COOKIE_NAME = "ta_session";
const MAX_AGE_SECONDS = 60 * 60 * 8; // 8 hours

function secret(): Uint8Array {
  const value = process.env.AUTH_SECRET;
  if (!value || value.length < 16) {
    throw new Error("AUTH_SECRET is missing or too short. Set it in .env");
  }
  return new TextEncoder().encode(value);
}

export interface SessionPayload {
  userId: string;
  email: string;
  role: Role;
  name: string;
}

export async function createSession(user: User): Promise<void> {
  const token = await new SignJWT({
    userId: user.id,
    email: user.email,
    role: user.role,
    name: user.name,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE_SECONDS}s`)
    .sign(secret());

  cookies().set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: MAX_AGE_SECONDS,
  });
}

export function destroySession(): void {
  cookies().set(COOKIE_NAME, "", { path: "/", maxAge: 0 });
}

async function readToken(): Promise<SessionPayload | null> {
  const token = cookies().get(COOKIE_NAME)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret());
    return payload as unknown as SessionPayload;
  } catch {
    return null;
  }
}

// Returns the current authenticated user, or null. Verifies the user still
// exists and is active.
export async function getCurrentUser(): Promise<User | null> {
  const session = await readToken();
  if (!session) return null;
  const user = await prisma.user.findUnique({ where: { id: session.userId } });
  if (!user || !user.active) return null;
  return user;
}

// Like getCurrentUser but throws if not authenticated. Use in route handlers.
export async function requireUser(): Promise<User> {
  const user = await getCurrentUser();
  if (!user) throw new UnauthorizedError();
  return user;
}

export async function requireAdmin(): Promise<User> {
  const user = await requireUser();
  if (user.role !== "ADMIN") throw new ForbiddenError();
  return user;
}

export class UnauthorizedError extends Error {
  constructor() {
    super("Unauthorized");
    this.name = "UnauthorizedError";
  }
}

export class ForbiddenError extends Error {
  constructor() {
    super("Forbidden");
    this.name = "ForbiddenError";
  }
}
