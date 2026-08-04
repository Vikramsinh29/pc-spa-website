import { z } from "zod";
import { DatabaseError } from "../db/errors";
import { licenseStates, type DeviceRecord, type LicenseActivationRecord, type LicenseRecord, type SessionRecord } from "../db/types";
import { hashValue } from "./crypto";
import { ActivationLimitError, DuplicateActivationError, LicenseNotActiveError } from "./errors";
import { hashSessionToken, signSessionToken, verifySessionToken, type SessionTokenClaims } from "./session-token";

const activationSchema = z.object({
  activationKey: z.string().trim().min(8).max(100),
  deviceId: z.string().trim().min(1).max(256),
  deviceMetadata: z.object({ name: z.string().trim().min(1).max(100).optional() }).strict().optional(),
});

const adminIssueSchema = z.object({
  userId: z.string().trim().min(1).max(128),
  activationLimit: z.number().int().min(1).max(100).default(1),
  expiresAt: z.string().refine((value) => !Number.isNaN(Date.parse(value)), "expiresAt must be a valid ISO date.").nullable().optional(),
  state: z.enum(licenseStates).default("pending"),
});

const sessionTtlSeconds = 15 * 60;

type LicenseRepositoryLike = {
  create(input: { id: string; userId: string; activationLimit?: number; expiresAt?: string | null; state?: LicenseRecord["state"] }): Promise<{ license: Omit<LicenseRecord, "activation_key_hash">; activationKey: string }>;
  findByActivationKeyHash(hash: string, now?: Date): Promise<LicenseRecord | null>;
  findById(id: string, now?: Date): Promise<LicenseRecord | null>;
  activate(licenseId: string, deviceId: string, activationId: string, now?: Date): Promise<LicenseActivationRecord>;
  findActiveActivation(licenseId: string, deviceId: string): Promise<LicenseActivationRecord | null>;
  deactivate(activationId: string, deactivatedAt: string): Promise<void>;
};

type DeviceRepositoryLike = {
  findByFingerprintHash(hash: string): Promise<DeviceRecord | null>;
  insert(input: { id: string; userId: string; fingerprintHash: string; name?: string | null }): Promise<void>;
};

type SessionRepositoryLike = {
  findByTokenHash(hash: string): Promise<SessionRecord | null>;
  insert(input: { id: string; userId: string; tokenHash: string; expiresAt: string }): Promise<void>;
  touch(id: string, lastSeenAt: string): Promise<void>;
  revoke(id: string, revokedAt: string): Promise<void>;
};

export type LicensingApiDependencies = {
  licenses: LicenseRepositoryLike;
  devices: DeviceRepositoryLike;
  sessions: SessionRepositoryLike;
  rateLimiter: { limit(options: { key: string }): Promise<{ success: boolean }> } | undefined;
  approvedOrigin: string;
  tokenSecret: string | undefined;
  adminUserIds?: ReadonlySet<string>;
  createId?: () => string;
  createRequestId?: () => string;
  now?: () => Date;
  logger?: (entry: Record<string, string>) => void;
};

type AuthenticatedSession = {
  claims: SessionTokenClaims;
  session: SessionRecord;
  license: LicenseRecord;
  activation: LicenseActivationRecord;
};

function headers(origin: string | null, approvedOrigin: string): HeadersInit {
  const result: Record<string, string> = { "Cache-Control": "no-store", Vary: "Origin" };
  if (origin === approvedOrigin) {
    result["Access-Control-Allow-Origin"] = approvedOrigin;
    result["Access-Control-Allow-Methods"] = "POST, OPTIONS";
    result["Access-Control-Allow-Headers"] = "Authorization, Content-Type";
    result["Access-Control-Max-Age"] = "600";
  }
  return result;
}

function response(body: unknown, status: number, requestId: string, origin: string | null, approvedOrigin: string): Response {
  return Response.json(body, { status, headers: { ...headers(origin, approvedOrigin), "X-Request-Id": requestId } });
}

function log(dependencies: LicensingApiDependencies, requestId: string, event: string, outcome: string): void {
  dependencies.logger?.({ event, outcome, requestId });
}

function id(dependencies: LicensingApiDependencies): string {
  return (dependencies.createId ?? crypto.randomUUID)();
}

async function parse<T>(request: Request, schema: z.ZodType<T>, requestId: string, origin: string | null, dependencies: LicensingApiDependencies): Promise<T | Response> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return response({ error: { code: "INVALID_JSON", message: "Request body must be valid JSON." } }, 400, requestId, origin, dependencies.approvedOrigin);
  }
  const result = schema.safeParse(body);
  if (!result.success) {
    return response({ error: { code: "VALIDATION_ERROR", message: "Request body is invalid.", fields: result.error.issues.map((issue) => ({ path: issue.path.join("."), message: issue.message })) } }, 400, requestId, origin, dependencies.approvedOrigin);
  }
  return result.data;
}

function bearerToken(request: Request): string | null {
  const value = request.headers.get("authorization");
  if (!value?.startsWith("Bearer ")) return null;
  const token = value.slice(7).trim();
  return token || null;
}

function clientKey(request: Request, route: string): string {
  return `license-api:${route}:${request.headers.get("cf-connecting-ip") ?? "unknown"}`;
}

async function guard(request: Request, route: string, dependencies: LicensingApiDependencies, requestId: string, origin: string | null): Promise<Response | null> {
  if (origin && origin !== dependencies.approvedOrigin) {
    log(dependencies, requestId, route, "origin_rejected");
    return response({ error: { code: "ORIGIN_NOT_ALLOWED", message: "Origin is not allowed." } }, 403, requestId, origin, dependencies.approvedOrigin);
  }
  if (!dependencies.rateLimiter) return response({ error: { code: "SERVICE_UNAVAILABLE", message: "License service is unavailable." } }, 503, requestId, origin, dependencies.approvedOrigin);
  try {
    if (!(await dependencies.rateLimiter.limit({ key: clientKey(request, route) })).success) {
      log(dependencies, requestId, route, "rate_limited");
      return response({ error: { code: "RATE_LIMITED", message: "Too many requests. Try again later." } }, 429, requestId, origin, dependencies.approvedOrigin);
    }
  } catch {
    return response({ error: { code: "SERVICE_UNAVAILABLE", message: "License service is unavailable." } }, 503, requestId, origin, dependencies.approvedOrigin);
  }
  return null;
}

async function authenticate(request: Request, dependencies: LicensingApiDependencies, now: Date): Promise<{ ok: true; value: AuthenticatedSession } | { ok: false; code: string; message: string }> {
  if (!dependencies.tokenSecret) return { ok: false, code: "SERVICE_UNAVAILABLE", message: "License service is unavailable." };
  const token = bearerToken(request);
  if (!token) return { ok: false, code: "UNAUTHORIZED", message: "A bearer session token is required." };
  const claims = await verifySessionToken(token, dependencies.tokenSecret, now);
  if (!claims) return { ok: false, code: "UNAUTHORIZED", message: "Session token is invalid or expired." };
  const session = await dependencies.sessions.findByTokenHash(await hashSessionToken(token));
  if (!session || session.revoked_at || session.expires_at <= now.toISOString() || session.user_id !== claims.uid) return { ok: false, code: "UNAUTHORIZED", message: "Session token is invalid or expired." };
  const license = await dependencies.licenses.findById(claims.lid, now);
  if (!license || license.user_id !== claims.uid || license.state !== "active") return { ok: false, code: "LICENSE_NOT_ACTIVE", message: "License is not active." };
  const activation = await dependencies.licenses.findActiveActivation(license.id, claims.did);
  if (!activation) return { ok: false, code: "ACTIVATION_NOT_FOUND", message: "This device activation is no longer active." };
  await dependencies.sessions.touch(session.id, now.toISOString());
  return { ok: true, value: { claims, session, license, activation } };
}

async function authenticateAdmin(request: Request, dependencies: LicensingApiDependencies, now: Date): Promise<{ ok: true; claims: SessionTokenClaims } | { ok: false; code: string; message: string }> {
  if (!dependencies.tokenSecret) return { ok: false, code: "SERVICE_UNAVAILABLE", message: "License service is unavailable." };
  const token = bearerToken(request);
  if (!token) return { ok: false, code: "UNAUTHORIZED", message: "A bearer session token is required." };
  const claims = await verifySessionToken(token, dependencies.tokenSecret, now);
  if (!claims) return { ok: false, code: "UNAUTHORIZED", message: "Session token is invalid or expired." };
  const session = await dependencies.sessions.findByTokenHash(await hashSessionToken(token));
  if (!session || session.revoked_at || session.expires_at <= now.toISOString() || session.user_id !== claims.uid) return { ok: false, code: "UNAUTHORIZED", message: "Session token is invalid or expired." };
  if (!dependencies.adminUserIds?.has(claims.uid)) return { ok: false, code: "FORBIDDEN", message: "Administrator access is required." };
  await dependencies.sessions.touch(session.id, now.toISOString());
  return { ok: true, claims };
}

export async function handleLicenseActivation(request: Request, dependencies: LicensingApiDependencies): Promise<Response> {
  const requestId = dependencies.createRequestId?.() ?? crypto.randomUUID();
  const origin = request.headers.get("origin");
  const blocked = await guard(request, "activate", dependencies, requestId, origin);
  if (blocked) return blocked;
  const input = await parse(request, activationSchema, requestId, origin, dependencies);
  if (input instanceof Response) return input;
  if (!dependencies.tokenSecret) return response({ error: { code: "SERVICE_UNAVAILABLE", message: "License service is unavailable." } }, 503, requestId, origin, dependencies.approvedOrigin);

  const now = dependencies.now?.() ?? new Date();
  const license = await dependencies.licenses.findByActivationKeyHash(await hashValue(input.activationKey), now);
  if (!license) return response({ error: { code: "INVALID_ACTIVATION_KEY", message: "Activation key is invalid." } }, 401, requestId, origin, dependencies.approvedOrigin);
  if (license.state !== "active") return response({ error: { code: `LICENSE_${license.state.toUpperCase()}`, message: "License is not available for activation." } }, 403, requestId, origin, dependencies.approvedOrigin);

  const fingerprintHash = await hashValue(input.deviceId);
  let device = await dependencies.devices.findByFingerprintHash(fingerprintHash);
  if (device && device.user_id !== license.user_id) return response({ error: { code: "DEVICE_NOT_ALLOWED", message: "Device is not registered to this license owner." } }, 403, requestId, origin, dependencies.approvedOrigin);
  if (!device) {
    const candidate = { id: id(dependencies), userId: license.user_id, fingerprintHash, name: input.deviceMetadata?.name ?? null };
    try {
      await dependencies.devices.insert(candidate);
      device = await dependencies.devices.findByFingerprintHash(fingerprintHash);
    } catch (error) {
      if (error instanceof DatabaseError && error.code === "constraint") device = await dependencies.devices.findByFingerprintHash(fingerprintHash);
      else return response({ error: { code: "DATABASE_ERROR", message: "License could not be activated." } }, 503, requestId, origin, dependencies.approvedOrigin);
    }
  }
  if (!device) return response({ error: { code: "DATABASE_ERROR", message: "Device could not be registered." } }, 503, requestId, origin, dependencies.approvedOrigin);

  try {
    const activation = await dependencies.licenses.activate(license.id, device.id, id(dependencies), now);
    const expiresAt = new Date(now.getTime() + sessionTtlSeconds * 1000);
    const claims: SessionTokenClaims = { sid: id(dependencies), uid: license.user_id, lid: license.id, did: device.id, iat: Math.floor(now.getTime() / 1000), exp: Math.floor(expiresAt.getTime() / 1000) };
    const sessionToken = await signSessionToken(claims, dependencies.tokenSecret);
    await dependencies.sessions.insert({ id: claims.sid, userId: claims.uid, tokenHash: await hashSessionToken(sessionToken), expiresAt: expiresAt.toISOString() });
    log(dependencies, requestId, "license_activate", "created");
    return response({ data: { status: "activated", sessionToken, expiresAt: expiresAt.toISOString(), license: { id: license.id, state: license.state, expiresAt: license.expires_at }, device: { id: device.id }, activation: { id: activation.id } } }, 201, requestId, origin, dependencies.approvedOrigin);
  } catch (error) {
    if (error instanceof ActivationLimitError) return response({ error: { code: "ACTIVATION_LIMIT_REACHED", message: "License activation limit has been reached." } }, 409, requestId, origin, dependencies.approvedOrigin);
    if (error instanceof DuplicateActivationError) return response({ error: { code: "ALREADY_ACTIVATED", message: "This device is already activated." } }, 409, requestId, origin, dependencies.approvedOrigin);
    if (error instanceof LicenseNotActiveError) return response({ error: { code: "LICENSE_NOT_ACTIVE", message: "License is not active." } }, 403, requestId, origin, dependencies.approvedOrigin);
    return response({ error: { code: "DATABASE_ERROR", message: "License could not be activated." } }, 503, requestId, origin, dependencies.approvedOrigin);
  }
}

export async function handleLicenseValidation(request: Request, dependencies: LicensingApiDependencies): Promise<Response> {
  const requestId = dependencies.createRequestId?.() ?? crypto.randomUUID();
  const origin = request.headers.get("origin");
  const blocked = await guard(request, "validate", dependencies, requestId, origin);
  if (blocked) return blocked;
  const authenticated = await authenticate(request, dependencies, dependencies.now?.() ?? new Date());
  if (!authenticated.ok) return response({ error: { code: authenticated.code, message: authenticated.message } }, authenticated.code === "SERVICE_UNAVAILABLE" ? 503 : 401, requestId, origin, dependencies.approvedOrigin);
  const { license, activation, session } = authenticated.value;
  return response({ data: { status: "valid", session: { id: session.id, expiresAt: session.expires_at }, license: { id: license.id, state: license.state, expiresAt: license.expires_at }, activation: { id: activation.id, deviceId: activation.device_id, activatedAt: activation.activated_at } } }, 200, requestId, origin, dependencies.approvedOrigin);
}

export async function handleLicenseDeactivation(request: Request, dependencies: LicensingApiDependencies): Promise<Response> {
  const requestId = dependencies.createRequestId?.() ?? crypto.randomUUID();
  const origin = request.headers.get("origin");
  const blocked = await guard(request, "deactivate", dependencies, requestId, origin);
  if (blocked) return blocked;
  const now = dependencies.now?.() ?? new Date();
  const authenticated = await authenticate(request, dependencies, now);
  if (!authenticated.ok) return response({ error: { code: authenticated.code, message: authenticated.message } }, authenticated.code === "SERVICE_UNAVAILABLE" ? 503 : 401, requestId, origin, dependencies.approvedOrigin);
  await dependencies.licenses.deactivate(authenticated.value.activation.id, now.toISOString());
  await dependencies.sessions.revoke(authenticated.value.session.id, now.toISOString());
  log(dependencies, requestId, "license_deactivate", "completed");
  return response({ data: { status: "deactivated" } }, 200, requestId, origin, dependencies.approvedOrigin);
}

export async function handleAdminLicenseIssue(request: Request, dependencies: LicensingApiDependencies): Promise<Response> {
  const requestId = dependencies.createRequestId?.() ?? crypto.randomUUID();
  const origin = request.headers.get("origin");
  const blocked = await guard(request, "admin-issue", dependencies, requestId, origin);
  if (blocked) return blocked;
  const now = dependencies.now?.() ?? new Date();
  const authenticated = await authenticateAdmin(request, dependencies, now);
  if (!authenticated.ok) return response({ error: { code: authenticated.code, message: authenticated.message } }, authenticated.code === "SERVICE_UNAVAILABLE" ? 503 : authenticated.code === "FORBIDDEN" ? 403 : 401, requestId, origin, dependencies.approvedOrigin);
  const parsed = await parse(request, adminIssueSchema, requestId, origin, dependencies);
  if (parsed instanceof Response) return parsed;

  try {
    const created = await dependencies.licenses.create({ id: id(dependencies), userId: parsed.userId, activationLimit: parsed.activationLimit, expiresAt: parsed.expiresAt ?? null, state: parsed.state });
    log(dependencies, requestId, "admin_license_issue", "created");
    return response({ data: { status: "created", license: created.license, activationKey: created.activationKey } }, 201, requestId, origin, dependencies.approvedOrigin);
  } catch {
    log(dependencies, requestId, "admin_license_issue", "persistence_error");
    return response({ error: { code: "DATABASE_ERROR", message: "License could not be issued." } }, 503, requestId, origin, dependencies.approvedOrigin);
  }
}

export function createLicenseOptionsResponse(request: Request, approvedOrigin: string): Response {
  const origin = request.headers.get("origin");
  if (origin && origin !== approvedOrigin) return Response.json({ error: { code: "ORIGIN_NOT_ALLOWED", message: "Origin is not allowed." } }, { status: 403 });
  return new Response(null, { status: 204, headers: headers(origin, approvedOrigin) });
}
