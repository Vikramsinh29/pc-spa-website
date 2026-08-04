import { requireAdminPageContext } from "@/lib/auth/server";
import { createRepositories } from "@/lib/db";
import { getD1Client } from "@/lib/db/client";

function AdminNav() {
  return <nav className="portal-tabs"><a href="/admin/users">Users</a><a href="/admin/beta-requests">Beta requests</a><a href="/admin/licenses">Licenses</a></nav>;
}

export default async function AdminUsersPage() {
  await requireAdminPageContext();
  const users = await createRepositories(await getD1Client()).users.listAll();

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
              {users.map((user) => <tr key={user.id}><td>{user.id}</td><td>{user.email}</td><td>{user.display_name ?? "-"}</td><td>{new Date(user.created_at).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })}</td></tr>)}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
