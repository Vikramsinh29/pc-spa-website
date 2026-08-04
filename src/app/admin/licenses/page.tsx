import { LicenseStateButton } from "@/components/auth/license-state-button";
import { requireAdminPageContext } from "@/lib/auth/server";
import { createRepositories } from "@/lib/db";
import { getD1Client } from "@/lib/db/client";

function AdminNav() {
  return <nav className="portal-tabs"><a href="/admin/users">Users</a><a href="/admin/beta-requests">Beta requests</a><a href="/admin/licenses">Licenses</a></nav>;
}

export default async function AdminLicensesPage() {
  await requireAdminPageContext();
  const licenses = await createRepositories(await getD1Client()).licenses.listAll();

  return (
    <section className="portal-shell">
      <div className="portal-card portal-card-wide">
        <p className="eyebrow">ADMIN</p>
        <h1 className="portal-title">Licenses</h1>
        <p className="portal-copy">Activation keys are shown only at issuance time and cannot be recovered here.</p>
        <AdminNav />
        <div className="portal-table-wrap">
          <table className="portal-table">
            <thead><tr><th>ID</th><th>User</th><th>State</th><th>Expiry</th><th>Limit</th><th>Active devices</th><th>Actions</th></tr></thead>
            <tbody>
              {licenses.map((license) => <tr key={license.id}><td>{license.id}</td><td>{license.email}</td><td><span className={`portal-badge portal-badge-${license.state}`}>{license.state}</span></td><td>{license.expires_at ? new Date(license.expires_at).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" }) : "No expiry"}</td><td>{license.activation_limit}</td><td>{license.active_device_count}</td><td>{license.state === "pending" ? <LicenseStateButton licenseId={license.id} action="activate" label="Activate" /> : null}{license.state !== "revoked" ? <LicenseStateButton licenseId={license.id} action="revoke" label="Revoke" /> : null}</td></tr>)}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
