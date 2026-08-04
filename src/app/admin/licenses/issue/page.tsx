import { LicenseIssueForm } from "@/components/auth/license-issue-form";
import { getAuthenticatedPageContext, isAdminUser } from "@/lib/auth/server";
import { redirect } from "next/navigation";

export default async function AdminLicenseIssuePage() {
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

  return (
    <section className="portal-shell">
      <div className="portal-card portal-card-wide">
        <p className="eyebrow">ADMIN</p>
        <h1 className="portal-title">Issue activation key</h1>
        <p className="portal-copy">Create a license for a user and reveal the raw activation key exactly once after the server confirms issuance.</p>
        <nav className="portal-tabs"><a href="/admin/users">Users</a><a href="/admin/beta-requests">Beta requests</a><a href="/admin/licenses">Licenses</a><a href="/admin/licenses/issue">Issue license</a></nav>
        <LicenseIssueForm />
      </div>
    </section>
  );
}
