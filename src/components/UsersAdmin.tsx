"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Role } from "@/lib/types";

interface UserRow {
  id: string;
  name: string;
  email: string;
  role: Role;
  active: boolean;
}

export default function UsersAdmin({
  users,
  currentUserId,
}: {
  users: UserRow[];
  currentUserId: string;
}) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<Role>("ANALYST");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function createUser(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const res = await fetch("/api/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, password, role }),
    });
    setBusy(false);
    if (res.ok) {
      setName("");
      setEmail("");
      setPassword("");
      setRole("ANALYST");
      router.refresh();
    } else {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Failed to create user.");
    }
  }

  async function patch(id: string, body: Record<string, unknown>) {
    const res = await fetch(`/api/users/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (res.ok) router.refresh();
    else {
      const data = await res.json().catch(() => ({}));
      alert(data.error ?? "Update failed.");
    }
  }

  async function resetPassword(id: string) {
    const pw = prompt("New password (min 6 characters):");
    if (!pw) return;
    if (pw.length < 6) return alert("Password too short.");
    await patch(id, { password: pw });
    alert("Password updated.");
  }

  return (
    <div className="grid" style={{ gridTemplateColumns: "1.6fr 1fr" }}>
      <div>
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Role</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id}>
                <td>{u.name}</td>
                <td className="mono">{u.email}</td>
                <td>
                  <select
                    value={u.role}
                    disabled={u.id === currentUserId}
                    onChange={(e) => patch(u.id, { role: e.target.value })}
                  >
                    <option value="ANALYST">Analyst</option>
                    <option value="ADMIN">Admin</option>
                  </select>
                </td>
                <td>
                  <span className={`badge ${u.active ? "ai" : "flagged"}`}>
                    {u.active ? "Active" : "Disabled"}
                  </span>
                </td>
                <td>
                  <div className="row" style={{ gap: 6 }}>
                    <button
                      className="btn secondary small"
                      onClick={() => resetPassword(u.id)}
                    >
                      Reset pw
                    </button>
                    {u.id !== currentUserId && (
                      <button
                        className="btn secondary small"
                        onClick={() => patch(u.id, { active: !u.active })}
                      >
                        {u.active ? "Disable" : "Enable"}
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="card">
        <h2 style={{ marginTop: 0 }}>Add user</h2>
        {error && <div className="error">{error}</div>}
        <form onSubmit={createUser}>
          <label>Name</label>
          <input value={name} onChange={(e) => setName(e.target.value)} required />
          <label>Email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <label>Temporary password</label>
          <input
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="min 6 characters"
            required
          />
          <label>Role</label>
          <select value={role} onChange={(e) => setRole(e.target.value as Role)}>
            <option value="ANALYST">Analyst</option>
            <option value="ADMIN">Admin</option>
          </select>
          <button
            className="btn"
            type="submit"
            style={{ width: "100%", justifyContent: "center", marginTop: 14 }}
            disabled={busy}
          >
            {busy ? "Creating…" : "Create user"}
          </button>
        </form>
      </div>
    </div>
  );
}
