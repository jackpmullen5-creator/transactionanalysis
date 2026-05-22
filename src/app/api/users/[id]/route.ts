import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import type { Prisma } from "@prisma/client";
import type { Role } from "@/lib/types";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";

export async function PATCH(
  req: Request,
  { params }: { params: { id: string } },
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (user.role !== "ADMIN") {
    return NextResponse.json({ error: "Admins only." }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const data: Prisma.UserUpdateInput = {};

  if (typeof body?.active === "boolean") {
    if (params.id === user.id && body.active === false) {
      return NextResponse.json(
        { error: "You cannot deactivate your own account." },
        { status: 400 },
      );
    }
    data.active = body.active;
  }
  if (body?.role === "ADMIN" || body?.role === "ANALYST") {
    data.role = body.role as Role;
  }
  if (typeof body?.password === "string" && body.password.length >= 6) {
    data.passwordHash = await bcrypt.hash(body.password, 10);
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "Nothing to update." }, { status: 400 });
  }

  await prisma.user.update({ where: { id: params.id }, data });
  return NextResponse.json({ ok: true });
}
