import Link from "next/link";
import type { User } from "@prisma/client";
import LogoutButton from "./LogoutButton";

export default function Nav({ user }: { user: User }) {
  return (
    <nav className="nav">
      <span className="brand">OFAC Alert Review</span>
      <Link href="/">Dashboard</Link>
      <Link href="/cases">Cases</Link>
      <Link href="/upload">Upload</Link>
      {user.role === "ADMIN" && <Link href="/admin/users">Users</Link>}
      <span className="spacer" />
      <span className="user">
        {user.name} · {user.role === "ADMIN" ? "Admin" : "Analyst"}
      </span>
      <LogoutButton />
    </nav>
  );
}
