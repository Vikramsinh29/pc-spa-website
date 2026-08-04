import { requireAdminPageContext } from "@/lib/auth/server";
import { createRepositories } from "@/lib/db";
import { getD1Client } from "@/lib/db/client";

function AdminNav() {
  return <nav className="portal-tabs"><a href="/admin/users">Users</a><a href="/admin/beta-requests">Beta requests</a><a href="/admin/licenses">Licenses</a></nav>;
}

export default async function AdminBetaRequestsPage() {
  await requireAdminPageContext();
  const betaRequests = await createRepositories(await getD1Client()).betaAccessRequests.listAll();

  return (
    <section className="portal-shell">
      <div className="portal-card portal-card-wide">
        <p className="eyebrow">ADMIN</p>
        <h1 className="portal-title">Beta requests</h1>
        <AdminNav />
        <div className="portal-table-wrap">
          <table className="portal-table">
            <thead><tr><th>Email</th><th>Source</th><th>Created</th></tr></thead>
            <tbody>
              {betaRequests.map((request) => <tr key={request.id}><td>{request.email}</td><td>{request.source ?? "-"}</td><td>{new Date(request.created_at).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })}</td></tr>)}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
