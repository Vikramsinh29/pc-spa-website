import { describe, expect, it, vi } from "vitest";
import type { SessionRecord, UserRecord } from "../src/lib/db/types";
import { handleLogin, handleLogout, handleRegister, handleSession, type AuthApiDependencies } from "../src/lib/auth/api";
import { DatabaseError } from "../src/lib/db/errors";

const origin = "https://getpcspa.com";
const now = new Date("2026-08-05T12:00:00.000Z");

function request(path: string, init: RequestInit = {}): Request {
  return new Request(`${origin}/api/auth/${path}`, { ...init, headers: { origin, ...(init.headers ?? {}) } });
}

function makeDependencies(): { dependencies: AuthApiDependencies; users: Map<string, UserRecord>; sessions: Map<string, SessionRecord> } {
  const users = new Map<string, UserRecord>();
  const sessions = new Map<string, SessionRecord>();
  let sequence = 0;
  const dependencies: AuthApiDependencies = {
    users: {
      findByEmail: vi.fn(async (email) => [...users.values()].find((user) => user.email === email) ?? null),
      findById: vi.fn(async (id) => users.get(id) ?? null),
      insert: vi.fn(async (input) => {
        if ([...users.values()].some((user) => user.email === input.email)) throw new DatabaseError("Database constraint failed.", "constraint");
        users.set(input.id, { id: input.id, email: input.email, password_hash: input.passwordHash ?? null, display_name: null, created_at: now.toISOString(), updated_at: now.toISOString() });
      }),
    },
    sessions: {
      findByTokenHash: vi.fn(async (hash) => [...sessions.values()].find((session) => session.token_hash === hash) ?? null),
      insert: vi.fn(async (input) => { sessions.set(input.id, { id: input.id, user_id: input.userId, token_hash: input.tokenHash, expires_at: input.expiresAt, revoked_at: null, created_at: now.toISOString(), last_seen_at: null }); }),
      touch: vi.fn(async (id, timestamp) => { const session = sessions.get(id); if (session) session.last_seen_at = timestamp; }),
      revoke: vi.fn(async (id, timestamp) => { const session = sessions.get(id); if (session) session.revoked_at = timestamp; }),
    },
    rateLimiter: { limit: vi.fn(async () => ({ success: true })) },
    approvedOrigin: origin,
    secureCookies: true,
    createId: () => `id-${++sequence}`,
    createRequestId: () => "request-1",
    now: () => now,
    logger: vi.fn(),
  };
  return { dependencies, users, sessions };
}

async function register(dependencies: AuthApiDependencies, email = "person@example.com", password = "correct horse battery staple"): Promise<Response> {
  return handleRegister(request("register", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email, password }) }), dependencies);
}

describe("authentication API", () => {
  it("registers a normalized email with a password hash and minimal response", async () => {
    const { dependencies, users } = makeDependencies();
    const response = await register(dependencies, " PERSON@EXAMPLE.COM ");
    const body = await response.json() as Record<string, unknown>;
    expect(response.status).toBe(201);
    expect(body).toMatchObject({ data: { user: { email: "person@example.com" } } });
    expect(users.get("id-1")?.password_hash).toMatch(/^PBKDF2-SHA256\$100000\$/u);
    expect(JSON.stringify(body)).not.toContain("correct horse");
  });

  it("rejects duplicate registration", async () => {
    const { dependencies } = makeDependencies();
    expect((await register(dependencies)).status).toBe(201);
    const response = await register(dependencies, "PERSON@example.com");
    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({ error: { code: "EMAIL_ALREADY_REGISTERED" } });
  });

  it("logs in valid credentials and sets a secure HttpOnly cookie", async () => {
    const { dependencies } = makeDependencies();
    await register(dependencies);
    const response = await handleLogin(request("login", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email: " PERSON@EXAMPLE.COM ", password: "correct horse battery staple" }) }), dependencies);
    expect(response.status).toBe(200);
    expect(response.headers.get("set-cookie")).toMatch(/pcspa_session=.*HttpOnly.*SameSite=Lax.*Secure/u);
  });

  it("uses the same generic response for unknown and incorrect credentials", async () => {
    const { dependencies } = makeDependencies();
    await register(dependencies);
    const wrongPassword = await handleLogin(request("login", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email: "person@example.com", password: "wrong password" }) }), dependencies);
    const unknownEmail = await handleLogin(request("login", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email: "unknown@example.com", password: "wrong password" }) }), dependencies);
    expect(wrongPassword.status).toBe(401);
    expect(unknownEmail.status).toBe(401);
    expect(await wrongPassword.json()).toEqual(await unknownEmail.json());
  });

  it("returns the authenticated session and rejects an expired session", async () => {
    const { dependencies, sessions } = makeDependencies();
    await register(dependencies);
    const login = await handleLogin(request("login", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email: "person@example.com", password: "correct horse battery staple" }) }), dependencies);
    const cookie = login.headers.get("set-cookie")?.split(";")[0] ?? "";
    const session = await handleSession(request("session", { method: "GET", headers: { cookie } }), dependencies);
    expect(session.status).toBe(200);
    const record = [...sessions.values()][0];
    if (record) record.expires_at = "2026-08-05T11:59:59.000Z";
    expect((await handleSession(request("session", { method: "GET", headers: { cookie } }), dependencies)).status).toBe(401);
  });

  it("revokes the current session on logout", async () => {
    const { dependencies } = makeDependencies();
    await register(dependencies);
    const login = await handleLogin(request("login", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email: "person@example.com", password: "correct horse battery staple" }) }), dependencies);
    const cookie = login.headers.get("set-cookie")?.split(";")[0] ?? "";
    const logout = await handleLogout(request("logout", { method: "POST", headers: { cookie } }), dependencies);
    expect(logout.status).toBe(200);
    expect(logout.headers.get("set-cookie")).toMatch(/Max-Age=0/u);
    expect((await handleSession(request("session", { method: "GET", headers: { cookie } }), dependencies)).status).toBe(401);
  });

  it("rate-limits login attempts", async () => {
    const { dependencies } = makeDependencies();
    dependencies.rateLimiter = { limit: vi.fn(async () => ({ success: false })) };
    const response = await handleLogin(request("login", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email: "person@example.com", password: "wrong password" }) }), dependencies);
    expect(response.status).toBe(429);
  });
});
