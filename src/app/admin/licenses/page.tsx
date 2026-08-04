import { LicenseStateButton } from "@/components/auth/license-state-button";
import { getAuthenticatedPageContext, isAdminUser } from "@/lib/auth/server";
import { DatabaseConfigurationError, DatabaseError } from "@/lib/db";
import { createRepositories } from "@/lib/db";
import { getD1Client } from "@/lib/db/client";
import { redirect } from "next/navigation";

function AdminNav() {
  return <nav className="portal-tabs"><a href="/admin/users">Users</a><a href="/admin/beta-requests">Beta requests</a><a href="/admin/licenses">Licenses</a><a href="/admin/licenses/issue">Issue license</a></nav>;
}

export default async function AdminLicensesPage() {
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

  let licenses: Array<{ id: string; email: string; state: "pending" | "active" | "expired" | "revoked"; activation_limit: number; expires_at: string | null; active_device_count: number }> = [];
  try {
    licenses = await createRepositories(await getD1Client()).licenses.listAll();
  } catch (error) {
    if (error instanceof DatabaseConfigurationError || error instanceof DatabaseError) {
      return (
        <section className="portal-shell">
          <div className="portal-card portal-card-wide">
            <p className="eyebrow">ADMIN</p>
            <h1 className="portal-title">Licenses</h1>
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
        <div className="portal-section-heading">
          <div>
            <p className="eyebrow">ADMIN</p>
            <h1 className="portal-title">Licenses</h1>
            <p className="portal-copy">Activation keys are shown only at issuance time and cannot be recovered here.</p>
          </div>
          <a className="portal-button portal-link-button" href="/admin/licenses/issue">Issue license</a>
        </div>
        <AdminNav />
        <div className="portal-table-wrap">
          <table className="portal-table">
            <thead><tr><th>ID</th><th>User</th><th>State</th><th>Expiry</th><th>Limit</th><th>Active devices</th><th>Actions</th></tr></thead>
            <tbody>
              {licenses.length === 0 ? <tr><td colSpan={7}>No licenses found.</td></tr> : licenses.map((license) => <tr key={license.id}><td>{license.id}</td><td>{license.email}</td><td><span className={`portal-badge portal-badge-${license.state}`}>{license.state}</span></td><td>{license.expires_at ? new Date(license.expires_at).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" }) : "No expiry"}</td><td>{license.activation_limit}</td><td>{license.active_device_count}</td><td>{license.state === "pending" ? <LicenseStateButton licenseId={license.id} action="activate" label="Activate" /> : null}{license.state !== "revoked" ? <LicenseStateButton licenseId={license.id} action="revoke" label="Revoke" /> : null}</td></tr>)}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
