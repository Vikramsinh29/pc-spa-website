import { describe, expect, it, vi } from "vitest";

const sessionTouch = vi.fn(async () => undefined);
const listByUserId = vi.fn(async () => ([{ id: "license-1", user_id: "user-1", email: "person@example.com", state: "active", activation_limit: 2, expires_at: null, created_at: "2026-08-01T00:00:00.000Z", updated_at: "2026-08-01T00:00:00.000Z", active_device_count: 1 }]));
const listAllLicenses = vi.fn(async () => ([{ id: "license-1", user_id: "user-1", email: "person@example.com", state: "pending", activation_limit: 1, expires_at: null, created_at: "2026-08-01T00:00:00.000Z", updated_at: "2026-08-01T00:00:00.000Z", active_device_count: 0 }]));
const transitionState = vi.fn(async () => undefined);
const findById = vi.fn(async () => ({ id: "license-1", user_id: "user-1", activation_key_hash: "redacted", state: "active", activation_limit: 1, expires_at: null, created_at: "2026-08-01T00:00:00.000Z", updated_at: "2026-08-01T00:00:00.000Z" }));
const listAllUsers = vi.fn(async () => ([{ id: "user-1", email: "person@example.com", password_hash: "hidden", display_name: null, created_at: "2026-08-01T00:00:00.000Z", updated_at: "2026-08-01T00:00:00.000Z" }]));
const listAllBetaRequests = vi.fn(async () => ([{ id: "beta-1", email: "beta@example.com", source: "hero", metadata_json: null, created_at: "2026-08-01T00:00:00.000Z" }]));

vi.mock("../src/lib/db/client", () => ({ getD1Client: vi.fn(async () => ({})) }));
vi.mock("../src/lib/db", () => ({
  createRepositories: () => ({
    sessions: { touch: sessionTouch },
    licenses: { listByUserId, listAll: listAllLicenses, transitionState, findById },
    users: { listAll: listAllUsers },
    betaAccessRequests: { listAll: listAllBetaRequests },
  }),
}));
vi.mock("../src/lib/auth/server", () => ({
  getAuthenticatedRequestContext: vi.fn(async (request: Request) => request.headers.get("x-user") ? { session: { id: "session-1", user_id: request.headers.get("x-user")!, token_hash: "hash", expires_at: "2026-08-06T00:00:00.000Z", revoked_at: null, created_at: "2026-08-01T00:00:00.000Z", last_seen_at: null }, user: { id: request.headers.get("x-user")!, email: "person@example.com", password_hash: null, display_name: null, created_at: "2026-08-01T00:00:00.000Z", updated_at: "2026-08-01T00:00:00.000Z" } } : null),
  isAdminUser: vi.fn((userId: string) => userId === "admin-1"),
}));

import { handleAccountLicenses } from "../src/lib/account/api";
import { handleAdminBetaRequests, handleAdminLicenseActivate, handleAdminLicenseRevoke, handleAdminLicenses, handleAdminUsers } from "../src/lib/admin/api";

describe("account and admin APIs", () => {
  it("protects account licenses and returns authenticated license data", async () => {
    const unauthorized = await handleAccountLicenses(new Request("https://getpcspa.com/api/account/licenses"));
    expect(unauthorized.status).toBe(401);

    const authorized = await handleAccountLicenses(new Request("https://getpcspa.com/api/account/licenses", { headers: { "x-user": "user-1" } }));
    expect(authorized.status).toBe(200);
    expect(await authorized.json()).toMatchObject({ data: { user: { id: "user-1" }, licenses: [{ id: "license-1", active_device_count: 1 }] } });
  });

  it("enforces admin authorization for list routes", async () => {
    expect((await handleAdminUsers(new Request("https://getpcspa.com/api/admin/users"))).status).toBe(401);
    expect((await handleAdminUsers(new Request("https://getpcspa.com/api/admin/users", { headers: { "x-user": "user-1" } }))).status).toBe(403);

    const response = await handleAdminUsers(new Request("https://getpcspa.com/api/admin/users", { headers: { "x-user": "admin-1" } }));
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ data: { users: [{ id: "user-1", email: "person@example.com" }] } });
  });

  it("returns beta requests and licenses for admins", async () => {
    const betaRequests = await handleAdminBetaRequests(new Request("https://getpcspa.com/api/admin/beta-requests", { headers: { "x-user": "admin-1" } }));
    expect(await betaRequests.json()).toMatchObject({ data: { betaRequests: [{ email: "beta@example.com" }] } });

    const licenses = await handleAdminLicenses(new Request("https://getpcspa.com/api/admin/licenses", { headers: { "x-user": "admin-1" } }));
    expect(await licenses.json()).toMatchObject({ data: { licenses: [{ id: "license-1", state: "pending" }] } });
  });

  it("supports pending-to-active transition and revocation", async () => {
    const activate = await handleAdminLicenseActivate(new Request("https://getpcspa.com/api/admin/licenses/license-1/activate", { headers: { "x-user": "admin-1" } }), "license-1");
    expect(activate.status).toBe(200);
    expect(transitionState).toHaveBeenCalledWith("license-1", "active");

    const revoke = await handleAdminLicenseRevoke(new Request("https://getpcspa.com/api/admin/licenses/license-1/revoke", { headers: { "x-user": "admin-1" } }), "license-1");
    expect(revoke.status).toBe(200);
    expect(transitionState).toHaveBeenCalledWith("license-1", "revoked");
  });
});
