import { LogoutButton } from "@/components/auth/logout-button";
import { CopyEmailButton } from "../../components/account/copy-email-button";
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
    <section className="portal-shell portal-shell-dashboard">
      <div className="portal-card portal-card-wide portal-card-dashboard">
        <div className="portal-header-row portal-header-row-dashboard">
          <div>
            <p className="eyebrow">BETA DASHBOARD</p>
            <h1 className="portal-title">Your PC-SPA access</h1>
            <p className="portal-copy">Controlled beta access, session status, and release downloads in one place.</p>
          </div>
          <LogoutButton />
        </div>

        <div className="portal-dashboard-grid">
          <article className="portal-panel portal-panel-accent-gold portal-panel-hero">
            <div className="portal-panel-head">
              <div>
                <p className="portal-panel-kicker">Activation</p>
                <h2>Account identity</h2>
              </div>
              <CopyEmailButton email={context.user.email} />
            </div>
            <dl className="portal-details portal-details-hero">
              <div><dt>Email</dt><dd>{context.user.email}</dd></div>
              <div><dt>Display name</dt><dd>{context.user.display_name ?? "Not set"}</dd></div>
              <div><dt>Session</dt><dd>Authenticated until {new Date(context.session.expires_at).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })}</dd></div>
            </dl>
          </article>

          <article className="portal-panel portal-panel-accent-purple portal-panel-hero">
            <div className="portal-panel-head">
              <div>
                <p className="portal-panel-kicker">Download</p>
                <h2>Current beta build</h2>
              </div>
              <a className="portal-button portal-download-button" href="/pc-spa-hero.png" download>
                Download build
              </a>
            </div>
            <dl className="portal-details portal-details-hero">
              <div><dt>Release</dt><dd>Controlled beta build</dd></div>
              <div><dt>Integrity</dt><dd>SHA-256 remains shown in the release notes workflow.</dd></div>
              <div><dt>Access</dt><dd>Available only to approved testers.</dd></div>
            </dl>
          </article>
        </div>

        <article className="portal-panel portal-panel-feedback">
          <div className="portal-section-heading portal-section-heading-stack">
            <div>
              <p className="portal-panel-kicker">Feedback</p>
              <h2>Send beta feedback</h2>
            </div>
            <p>Current route keeps feedback available without changing the backend contract.</p>
          </div>
          <div className="portal-feedback-shell">
            <p className="portal-copy">For beta access help, installation issues, or product feedback, contact support@getpcspa.com from the signed-in account that received access.</p>
            <div className="portal-feedback-actions">
              <a className="portal-button portal-link-button" href="mailto:support@getpcspa.com?subject=PC-SPA%20beta%20feedback">
                Email feedback
              </a>
              <a className="portal-button portal-button-secondary" href="mailto:support@getpcspa.com?subject=PC-SPA%20beta%20support">
                Contact support
              </a>
            </div>
          </div>
        </article>

        <article className="portal-panel portal-panel-table">
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
