import { z } from "zod";
import { DatabaseError } from "../db/errors";
import type { SessionRecord, UserRecord } from "../db/types";
import { hashValue } from "../licensing/crypto";
import { generateSessionToken, authSessionCookieName, clearSessionCookie, createSessionCookie, getSessionCookie } from "./session";
import { hashPassword, verifyPassword } from "./password";

const registerSchema = z.object({
  email: z.string().trim().email().max(254),
  password: z.string().min(12).max(128),
});

const sessionTtlSeconds = 7 * 24 * 60 * 60;

type UserRepositoryLike = {
  findByEmail(email: string): Promise<UserRecord | null>;
  findById(id: string): Promise<UserRecord | null>;
  insert(input: { id: string; email: string; passwordHash?: string | null }): Promise<void>;
};

type SessionRepositoryLike = {
  findByTokenHash(hash: string): Promise<SessionRecord | null>;
  insert(input: { id: string; userId: string; tokenHash: string; expiresAt: string }): Promise<void>;
  touch(id: string, lastSeenAt: string): Promise<void>;
  revoke(id: string, revokedAt: string): Promise<void>;
};

export type AuthApiDependencies = {
  users: UserRepositoryLike;
  sessions: SessionRepositoryLike;
  rateLimiter: { limit(options: { key: string }): Promise<{ success: boolean }> } | undefined;
  approvedOrigin: string;
  secureCookies: boolean;
  createId?: () => string;
  createRequestId?: () => string;
  now?: () => Date;
  logger?: (entry: Record<string, string>) => void;
};

function responseHeaders(origin: string | null, approvedOrigin: string): Record<string, string> {
  const result: Record<string, string> = { "Cache-Control": "no-store", Vary: "Origin" };
  if (origin === approvedOrigin) {
    result["Access-Control-Allow-Origin"] = approvedOrigin;
    result["Access-Control-Allow-Credentials"] = "true";
    result["Access-Control-Allow-Methods"] = "GET, POST, OPTIONS";
    result["Access-Control-Allow-Headers"] = "Content-Type";
    result["Access-Control-Max-Age"] = "600";
  }
  return result;
}

function json(body: unknown, status: number, requestId: string, origin: string | null, dependencies: AuthApiDependencies, cookie?: string): Response {
  const headers: Record<string, string> = { ...responseHeaders(origin, dependencies.approvedOrigin), "X-Request-Id": requestId };
  if (cookie) headers["Set-Cookie"] = cookie;
  return Response.json(body, { status, headers });
}

function log(dependencies: AuthApiDependencies, requestId: string, outcome: string): void {
  dependencies.logger?.({ event: "auth", outcome, requestId });
}

function id(dependencies: AuthApiDependencies): string {
  return (dependencies.createId ?? crypto.randomUUID)();
}

function clientKey(request: Request, route: string): string {
  return `auth:${route}:${request.headers.get("cf-connecting-ip") ?? "unknown"}`;
}

async function guard(request: Request, route: string, dependencies: AuthApiDependencies, requestId: string, origin: string | null): Promise<Response | null> {
  if (origin && origin !== dependencies.approvedOrigin) return json({ error: { code: "ORIGIN_NOT_ALLOWED", message: "Origin is not allowed." } }, 403, requestId, origin, dependencies);
  if (!dependencies.rateLimiter) return json({ error: { code: "SERVICE_UNAVAILABLE", message: "Authentication service is unavailable." } }, 503, requestId, origin, dependencies);
  try {
    if (!(await dependencies.rateLimiter.limit({ key: clientKey(request, route) })).success) {
      log(dependencies, requestId, "rate_limited");
      return json({ error: { code: "RATE_LIMITED", message: "Too many requests. Try again later." } }, 429, requestId, origin, dependencies);
    }
  } catch {
    return json({ error: { code: "SERVICE_UNAVAILABLE", message: "Authentication service is unavailable." } }, 503, requestId, origin, dependencies);
  }
  return null;
}

async function parseBody(request: Request, requestId: string, origin: string | null, dependencies: AuthApiDependencies): Promise<{ email: string; password: string } | Response> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ error: { code: "INVALID_JSON", message: "Request body must be valid JSON." } }, 400, requestId, origin, dependencies);
  }
  const result = registerSchema.safeParse(body);
  if (!result.success) return json({ error: { code: "VALIDATION_ERROR", message: "Request body is invalid.", fields: result.error.issues.map((issue) => ({ path: issue.path.join("."), message: issue.message })) } }, 400, requestId, origin, dependencies);
  return { email: result.data.email.toLowerCase(), password: result.data.password };
}

function publicUser(user: UserRecord): { id: string; email: string; displayName: string | null } {
  return { id: user.id, email: user.email, displayName: user.display_name };
}

async function currentSession(request: Request, dependencies: AuthApiDependencies, now: Date): Promise<{ token: string; session: SessionRecord; user: UserRecord } | null> {
  const token = getSessionCookie(request);
  if (!token) return null;
  const session = await dependencies.sessions.findByTokenHash(await hashValue(token));
  if (!session || session.revoked_at || session.expires_at <= now.toISOString()) return null;
  const user = await dependencies.users.findById(session.user_id);
  if (!user) return null;
  return { token, session, user };
}

export async function handleRegister(request: Request, dependencies: AuthApiDependencies): Promise<Response> {
  const requestId = dependencies.createRequestId?.() ?? crypto.randomUUID();
  const origin = request.headers.get("origin");
  const blocked = await guard(request, "register", dependencies, requestId, origin);
  if (blocked) return blocked;
  const input = await parseBody(request, requestId, origin, dependencies);
  if (input instanceof Response) return input;
  const existing = await dependencies.users.findByEmail(input.email);
  if (existing) return json({ error: { code: "EMAIL_ALREADY_REGISTERED", message: "An account with this email already exists." } }, 409, requestId, origin, dependencies);
  try {
    const user = { id: id(dependencies), email: input.email, passwordHash: await hashPassword(input.password) };
    await dependencies.users.insert(user);
    log(dependencies, requestId, "registered");
    return json({ data: { user: { id: user.id, email: user.email, displayName: null } } }, 201, requestId, origin, dependencies);
  } catch (error) {
    if (error instanceof DatabaseError && error.code === "constraint") return json({ error: { code: "EMAIL_ALREADY_REGISTERED", message: "An account with this email already exists." } }, 409, requestId, origin, dependencies);
    log(dependencies, requestId, "registration_error");
    return json({ error: { code: "DATABASE_ERROR", message: "Account could not be created." } }, 503, requestId, origin, dependencies);
  }
}

export async function handleLogin(request: Request, dependencies: AuthApiDependencies): Promise<Response> {
  const requestId = dependencies.createRequestId?.() ?? crypto.randomUUID();
  const origin = request.headers.get("origin");
  const blocked = await guard(request, "login", dependencies, requestId, origin);
  if (blocked) return blocked;
  const input = await parseBody(request, requestId, origin, dependencies);
  if (input instanceof Response) return input;
  const user = await dependencies.users.findByEmail(input.email);
  if (!user || !(await verifyPassword(input.password, user.password_hash))) {
    log(dependencies, requestId, "invalid_credentials");
    return json({ error: { code: "INVALID_CREDENTIALS", message: "Email or password is incorrect." } }, 401, requestId, origin, dependencies);
  }
  const now = dependencies.now?.() ?? new Date();
  const previous = await currentSession(request, dependencies, now);
  if (previous) await dependencies.sessions.revoke(previous.session.id, now.toISOString());
  const token = generateSessionToken();
  const expiresAt = new Date(now.getTime() + sessionTtlSeconds * 1000);
  await dependencies.sessions.insert({ id: id(dependencies), userId: user.id, tokenHash: await hashValue(token), expiresAt: expiresAt.toISOString() });
  log(dependencies, requestId, "logged_in");
  return json({ data: { user: publicUser(user), expiresAt: expiresAt.toISOString() } }, 200, requestId, origin, dependencies, createSessionCookie(token, dependencies.secureCookies, sessionTtlSeconds));
}

export async function handleLogout(request: Request, dependencies: AuthApiDependencies): Promise<Response> {
  const requestId = dependencies.createRequestId?.() ?? crypto.randomUUID();
  const origin = request.headers.get("origin");
  const blocked = await guard(request, "logout", dependencies, requestId, origin);
  if (blocked) return blocked;
  const token = getSessionCookie(request);
  if (token) {
    const session = await dependencies.sessions.findByTokenHash(await hashValue(token));
    if (session && !session.revoked_at) await dependencies.sessions.revoke(session.id, (dependencies.now?.() ?? new Date()).toISOString());
  }
  log(dependencies, requestId, "logged_out");
  return json({ data: { status: "logged_out" } }, 200, requestId, origin, dependencies, clearSessionCookie(dependencies.secureCookies));
}

export async function handleSession(request: Request, dependencies: AuthApiDependencies): Promise<Response> {
  const requestId = dependencies.createRequestId?.() ?? crypto.randomUUID();
  const origin = request.headers.get("origin");
  const blocked = await guard(request, "session", dependencies, requestId, origin);
  if (blocked) return blocked;
  const current = await currentSession(request, dependencies, dependencies.now?.() ?? new Date());
  if (!current) return json({ error: { code: "UNAUTHORIZED", message: "Authentication is required." } }, 401, requestId, origin, dependencies);
  await dependencies.sessions.touch(current.session.id, (dependencies.now?.() ?? new Date()).toISOString());
  return json({ data: { user: publicUser(current.user), expiresAt: current.session.expires_at } }, 200, requestId, origin, dependencies);
}

export function createAuthOptionsResponse(request: Request, approvedOrigin: string): Response {
  const origin = request.headers.get("origin");
  if (origin && origin !== approvedOrigin) return Response.json({ error: { code: "ORIGIN_NOT_ALLOWED", message: "Origin is not allowed." } }, { status: 403 });
  const result = responseHeaders(origin, approvedOrigin);
  return new Response(null, { status: 204, headers: result });
}

export { authSessionCookieName };
