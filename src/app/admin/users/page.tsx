import { getAuthenticatedPageContext, isAdminUser } from "@/lib/auth/server";
import { DatabaseConfigurationError, DatabaseError } from "@/lib/db";
import { createRepositories } from "@/lib/db";
import { getD1Client } from "@/lib/db/client";
import { redirect } from "next/navigation";

function AdminNav() {
  return <nav className="portal-tabs"><a href="/admin/users">Users</a><a href="/admin/beta-requests">Beta requests</a><a href="/admin/licenses">Licenses</a></nav>;
}

export default async function AdminUsersPage() {
  const context = await getAuthenticatedPageContext();
  if (!context) redirect("/login");

  if (!isAdminUser(context.user.id)) {
    return (
      <section className="portal-shell">
        <div className="portal-card portal-card-wide">
          <p className="eyebrow">ADMIN</p>
          <h1 className="portal-title">Forbidden</h1>
          <p className="portal-error">Administrator access is required.</p>
        </div>
      </section>
    );
  }

  let users: Array<{ id: string; email: string; display_name: string | null; created_at: string }> = [];
  try {
    users = await createRepositories(await getD1Client()).users.listAll();
  } catch (error) {
    if (error instanceof DatabaseConfigurationError || error instanceof DatabaseError) {
      return (
        <section className="portal-shell">
          <div className="portal-card portal-card-wide">
            <p className="eyebrow">ADMIN</p>
            <h1 className="portal-title">Users</h1>
            <p className="portal-error">Admin data is temporarily unavailable.</p>
          </div>
        </section>
      );
    }
    throw error;
  }

  return (
    <section className="portal-shell">
      <div className="portal-card portal-card-wide">
        <p className="eyebrow">ADMIN</p>
        <h1 className="portal-title">Users</h1>
        <AdminNav />
        <div className="portal-table-wrap">
          <table className="portal-table">
            <thead><tr><th>ID</th><th>Email</th><th>Display name</th><th>Created</th></tr></thead>
            <tbody>
              {users.length === 0 ? <tr><td colSpan={4}>No users found.</td></tr> : users.map((user) => <tr key={user.id}><td>{user.id}</td><td>{user.email}</td><td>{user.display_name ?? "-"}</td><td>{new Date(user.created_at).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })}</td></tr>)}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
