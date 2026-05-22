import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { prisma } from "@/lib/db";
import type { Role } from "@/lib/types";
import Nav from "@/components/Nav";
import UsersAdmin from "@/components/UsersAdmin";

export const dynamic = "force-dynamic";

export default async function UsersPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role !== "ADMIN") redirect("/");

  const users = await prisma.user.findMany({ orderBy: { createdAt: "asc" } });

  return (
    <>
      <Nav user={user} />
      <div className="container">
        <h1>User management</h1>
        <p className="subtitle">
          Add team members and manage roles. Admins can upload, decision cases,
          and manage users.
        </p>
        <UsersAdmin
          currentUserId={user.id}
          users={users.map((u) => ({
            id: u.id,
            name: u.name,
            email: u.email,
            role: u.role as Role,
            active: u.active,
          }))}
        />
      </div>
    </>
  );
}
