import { LogoutButton } from "@/components/auth/logout-button";
import { DatabaseConfigurationError, DatabaseError } from "@/lib/db";
import { redirect } from "next/navigation";
import { getAuthenticatedPageContext } from "@/lib/auth/server";
import { createRepositories } from "@/lib/db";
import { getD1Client } from "@/lib/db/client";

export default async function AccountPage() {
  const context = await getAuthenticatedPageContext();
  if (!context) redirect("/login");

  let licenses;
  try {
    const repositories = createRepositories(await getD1Client());
    licenses = await repositories.licenses.listByUserId(context.user.id);
  } catch (error) {
    if (error instanceof DatabaseConfigurationError || error instanceof DatabaseError) {
      return (
        <section className="portal-shell">
          <div className="portal-card portal-card-wide">
            <p className="eyebrow">ACCOUNT</p>
            <h1 className="portal-title">Your PC-SPA access</h1>
            <p className="portal-error">Account data is temporarily unavailable.</p>
          </div>
        </section>
      );
    }
    throw error;
  }

  return (
    <section className="portal-shell">
      <div className="portal-card portal-card-wide">
        <div className="portal-header-row">
          <div>
            <p className="eyebrow">ACCOUNT</p>
            <h1 className="portal-title">Your PC-SPA access</h1>
            <p className="portal-copy">Current session status and license information for your account.</p>
          </div>
          <LogoutButton />
        </div>

        <div className="portal-grid">
          <article className="portal-panel">
            <h2>Profile</h2>
            <dl className="portal-details">
              <div><dt>Email</dt><dd>{context.user.email}</dd></div>
              <div><dt>Display name</dt><dd>{context.user.display_name ?? "Not set"}</dd></div>
            </dl>
          </article>
          <article className="portal-panel">
            <h2>Session</h2>
            <dl className="portal-details">
              <div><dt>Status</dt><dd>Authenticated</dd></div>
              <div><dt>Expires</dt><dd>{new Date(context.session.expires_at).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })}</dd></div>
            </dl>
          </article>
        </div>

        <article className="portal-panel">
          <div className="portal-section-heading">
            <h2>Licenses</h2>
            <p>Activation-key hashes are never exposed here.</p>
          </div>
          <div className="portal-table-wrap">
            <table className="portal-table">
              <thead><tr><th>ID</th><th>State</th><th>Expiry</th><th>Activation limit</th><th>Active devices</th></tr></thead>
              <tbody>
                {!licenses || licenses.length === 0 ? (
                  <tr><td colSpan={5}>No licenses issued yet.</td></tr>
                ) : licenses.map((license) => (
                  <tr key={license.id}>
                    <td>{license.id}</td>
                    <td><span className={`portal-badge portal-badge-${license.state}`}>{license.state}</span></td>
                    <td>{license.expires_at ? new Date(license.expires_at).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" }) : "No expiry"}</td>
                    <td>{license.activation_limit}</td>
                    <td>{license.active_device_count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </article>
      </div>
    </section>
  );
}
