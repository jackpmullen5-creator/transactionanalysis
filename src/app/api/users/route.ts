import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import type { Role } from "@/lib/types";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (user.role !== "ADMIN") {
    return NextResponse.json({ error: "Admins only." }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const email = String(body?.email ?? "").trim().toLowerCase();
  const name = String(body?.name ?? "").trim();
  const password = String(body?.password ?? "");
  const role: Role = body?.role === "ADMIN" ? "ADMIN" : "ANALYST";

  if (!email || !name || password.length < 6) {
    return NextResponse.json(
      { error: "Name, email and a password of at least 6 characters are required." },
      { status: 400 },
    );
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return NextResponse.json(
      { error: "A user with that email already exists." },
      { status: 409 },
    );
  }

  const created = await prisma.user.create({
    data: { email, name, role, passwordHash: await bcrypt.hash(password, 10) },
  });

  return NextResponse.json({
    ok: true,
    user: { id: created.id, email: created.email, name: created.name, role: created.role },
  });
}
