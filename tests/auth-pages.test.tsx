import { describe, expect, it, vi, beforeEach } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

const mocks = vi.hoisted(() => ({
  redirect: vi.fn((path: string) => {
    throw new Error(`REDIRECT:${path}`);
  }),
  getAuthenticatedPageContext: vi.fn(),
  requireAuthenticatedPageContext: vi.fn(),
  requireAdminPageContext: vi.fn(),
  isAdminUser: vi.fn(),
  getD1Client: vi.fn(),
  createRepositories: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  redirect: mocks.redirect,
  useRouter: () => ({ replace: vi.fn(), refresh: vi.fn() }),
}));

vi.mock("../src/lib/auth/server", () => ({
  getAuthenticatedPageContext: mocks.getAuthenticatedPageContext,
  requireAuthenticatedPageContext: mocks.requireAuthenticatedPageContext,
  requireAdminPageContext: mocks.requireAdminPageContext,
  isAdminUser: mocks.isAdminUser,
}));

vi.mock("../src/lib/db/client", () => ({ getD1Client: mocks.getD1Client }));
vi.mock("../src/lib/db", () => ({ createRepositories: mocks.createRepositories }));
vi.mock("@/lib/db", () => ({ createRepositories: mocks.createRepositories }));
vi.mock("@/lib/db/client", () => ({ getD1Client: mocks.getD1Client }));
vi.mock("@/lib/auth/server", () => ({
  getAuthenticatedPageContext: mocks.getAuthenticatedPageContext,
  requireAuthenticatedPageContext: mocks.requireAuthenticatedPageContext,
  requireAdminPageContext: mocks.requireAdminPageContext,
  isAdminUser: mocks.isAdminUser,
}));
vi.mock("@/components/auth/logout-button", () => ({ LogoutButton: () => null }));
vi.mock("@/components/auth/license-state-button", () => ({ LicenseStateButton: () => null }));
vi.mock("@/components/auth/license-issue-form", () => ({ LicenseIssueForm: () => null }));
vi.mock("@/components/account/copy-email-button", () => ({ CopyEmailButton: () => null }));

import { AuthForm } from "../src/components/auth/auth-form";
import AccountPage from "../src/app/account/page";
import AdminUsersPage from "../src/app/admin/users/page";
import AdminBetaRequestsPage from "../src/app/admin/beta-requests/page";
import AdminLicensesPage from "../src/app/admin/licenses/page";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getD1Client.mockResolvedValue({});
  mocks.getAuthenticatedPageContext.mockResolvedValue(null);
  mocks.createRepositories.mockReturnValue({
    licenses: { listByUserId: vi.fn(), listAll: vi.fn() },
    users: { listAll: vi.fn() },
    betaAccessRequests: { listAll: vi.fn() },
  });
});

describe("public auth UI", () => {
  it("renders the register form with accessible email and password fields", () => {
    const html = renderToStaticMarkup(<AuthForm mode="register" />);
    expect(html).toContain('id="email"');
    expect(html).toContain('type="email"');
    expect(html).toContain('id="password"');
    expect(html).toContain('type="password"');
    expect(html).toContain("Create account");
  });

  it("renders the login form state", () => {
    const html = renderToStaticMarkup(<AuthForm mode="login" />);
    expect(html).toContain("Sign in to PC-SPA");
    expect(html).toContain("Sign in");
  });

  it("redirects unauthenticated account requests to /login", async () => {
    mocks.getAuthenticatedPageContext.mockResolvedValue(null);
    await expect(AccountPage()).rejects.toThrow("REDIRECT:/login");
  });

  it("renders the account page for authenticated users", async () => {
    mocks.getAuthenticatedPageContext.mockResolvedValue({ user: { id: "user-1", email: "person@example.com", display_name: null }, session: { id: "session-1", user_id: "user-1", token_hash: "hash", expires_at: "2026-08-06T00:00:00.000Z", revoked_at: null, created_at: "2026-08-05T00:00:00.000Z", last_seen_at: null } });
    mocks.createRepositories.mockReturnValue({ licenses: { listByUserId: vi.fn(async () => []) }, users: { listAll: vi.fn() }, betaAccessRequests: { listAll: vi.fn() } });
    const html = renderToStaticMarkup(await AccountPage());
    expect(html).toContain("Your PC-SPA access");
    expect(html).toContain("No licenses issued yet.");
  });

  it("renders a safe forbidden state for non-admin users", async () => {
    mocks.getAuthenticatedPageContext.mockResolvedValue({ user: { id: "user-1", email: "person@example.com", display_name: null }, session: { id: "session-1", user_id: "user-1", token_hash: "hash", expires_at: "2026-08-06T00:00:00.000Z", revoked_at: null, created_at: "2026-08-05T00:00:00.000Z", last_seen_at: null } });
    mocks.isAdminUser.mockReturnValue(false);
    const html = renderToStaticMarkup(await AdminUsersPage());
    expect(html).toContain("Forbidden");
    expect(html).toContain("Administrator access is required.");
  });

  it("renders admin pages with empty states", async () => {
    mocks.getAuthenticatedPageContext.mockResolvedValue({ user: { id: "admin-1", email: "admin@example.com", display_name: null }, session: { id: "session-1", user_id: "admin-1", token_hash: "hash", expires_at: "2026-08-06T00:00:00.000Z", revoked_at: null, created_at: "2026-08-05T00:00:00.000Z", last_seen_at: null } });
    mocks.isAdminUser.mockReturnValue(true);
    mocks.createRepositories.mockReturnValue({
      licenses: { listByUserId: vi.fn(async () => []), listAll: vi.fn(async () => []) },
      users: { listAll: vi.fn(async () => []) },
      betaAccessRequests: { listAll: vi.fn(async () => []) },
    });
    expect(renderToStaticMarkup(await AdminBetaRequestsPage())).toContain("No beta requests found.");
    expect(renderToStaticMarkup(await AdminLicensesPage())).toContain("No licenses found.");
  });
});
