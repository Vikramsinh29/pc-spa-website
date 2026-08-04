import { describe, expect, it, vi } from "vitest";
import type { DeviceRecord, LicenseActivationRecord, LicenseRecord, SessionRecord } from "../src/lib/db/types";
import { ActivationLimitError } from "../src/lib/licensing/errors";
import { handleAdminLicenseIssue, handleLicenseActivation, handleLicenseDeactivation, handleLicenseValidation, type LicensingApiDependencies } from "../src/lib/licensing/api";
import { signSessionToken } from "../src/lib/licensing/session-token";

const origin = "https://getpcspa.com";
const secret = "test-license-token-secret-at-least-32-characters";
const now = new Date("2026-08-05T12:00:00.000Z");

const baseLicense: LicenseRecord = {
  id: "license-1", user_id: "user-1", activation_key_hash: "hash", state: "active", activation_limit: 2,
  expires_at: null, created_at: "2026-08-01T00:00:00.000Z", updated_at: "2026-08-01T00:00:00.000Z",
};

function request(path: string, init: RequestInit = {}): Request {
  return new Request(`${origin}/api/licenses/${path}`, { ...init, headers: { origin, ...(init.headers ?? {}) } });
}

function createDependencies(overrides: Partial<LicensingApiDependencies> = {}): LicensingApiDependencies {
  let id = 0;
  const currentLicense = { ...baseLicense };
  let device: DeviceRecord | null = null;
  let activation: LicenseActivationRecord | null = null;
  const sessions = new Map<string, SessionRecord>();
  const dependencies: LicensingApiDependencies = {
    licenses: {
      create: vi.fn(async (input) => ({
        license: {
          id: input.id, user_id: input.userId, state: input.state ?? "pending", activation_limit: input.activationLimit ?? 1,
          expires_at: input.expiresAt ?? null, created_at: now.toISOString(), updated_at: now.toISOString(),
        },
        activationKey: "PCSPA-issued-key-once",
      })),
      findByActivationKeyHash: vi.fn(async () => currentLicense.state === "active" || currentLicense.state === "pending" || currentLicense.state === "expired" || currentLicense.state === "revoked" ? currentLicense : null),
      findById: vi.fn(async () => currentLicense),
      activate: vi.fn(async (licenseId: string, deviceId: string, activationId: string) => {
        activation = { id: activationId, license_id: licenseId, device_id: deviceId, activated_at: now.toISOString(), deactivated_at: null };
        return activation;
      }),
      findActiveActivation: vi.fn(async () => activation?.deactivated_at ? null : activation),
      deactivate: vi.fn(async () => { if (activation) activation = { ...activation, deactivated_at: now.toISOString() }; }),
    },
    devices: {
      findByFingerprintHash: vi.fn(async () => device),
      insert: vi.fn(async (input) => { device = { id: input.id, user_id: input.userId, fingerprint_hash: input.fingerprintHash, name: input.name ?? null, last_seen_at: null, created_at: now.toISOString() }; }),
    },
    sessions: {
      findByTokenHash: vi.fn(async (tokenHash: string) => [...sessions.values()].find((session) => session.token_hash === tokenHash) ?? null),
      insert: vi.fn(async (input) => { sessions.set(input.id, { id: input.id, user_id: input.userId, token_hash: input.tokenHash, expires_at: input.expiresAt, revoked_at: null, created_at: now.toISOString(), last_seen_at: null }); }),
      touch: vi.fn(async () => undefined),
      revoke: vi.fn(async (id: string) => { const session = sessions.get(id); if (session) session.revoked_at = now.toISOString(); }),
    },
    rateLimiter: { limit: vi.fn(async () => ({ success: true })) },
    approvedOrigin: origin,
    allowedOrigins: new Set([origin, "https://pc-spa-web.pc-spa-feedback.workers.dev"]),
    tokenSecret: secret,
    createId: () => `id-${++id}`,
    createRequestId: () => "request-1",
    now: () => now,
    logger: vi.fn(),
    ...overrides,
  };
  return dependencies;
}

async function activate(dependencies: LicensingApiDependencies, deviceId = "device-a"): Promise<{ response: Response; body: Record<string, unknown> }> {
  const response = await handleLicenseActivation(request("activate", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ activationKey: "PCSPA-test-activation-key", deviceId, deviceMetadata: { name: "Test PC" } }),
  }), dependencies);
  return { response, body: await response.json() as Record<string, unknown> };
}

describe("licensing API", () => {
  it("activates a valid key and returns a short-lived session token", async () => {
    const dependencies = createDependencies();
    const result = await activate(dependencies);
    expect(result.response.status).toBe(201);
    expect(result.body).toMatchObject({ data: { status: "activated", license: { id: "license-1", state: "active" } } });
    expect((result.body.data as Record<string, unknown>).sessionToken).toEqual(expect.any(String));
    expect(dependencies.licenses.activate).toHaveBeenCalled();
  });

  it("rejects an invalid activation key", async () => {
    const dependencies = createDependencies({ licenses: { ...createDependencies().licenses, findByActivationKeyHash: vi.fn(async () => null) } });
    const result = await activate(dependencies);
    expect(result.response.status).toBe(401);
    expect(result.body).toMatchObject({ error: { code: "INVALID_ACTIVATION_KEY" } });
  });

  it.each(["pending", "revoked", "expired"] as const)("rejects a %s license", async (state) => {
    const dependencies = createDependencies();
    (dependencies.licenses.findByActivationKeyHash as ReturnType<typeof vi.fn>).mockResolvedValue({ ...baseLicense, state });
    const result = await activate(dependencies);
    expect(result.response.status).toBe(403);
    expect(result.body).toMatchObject({ error: { code: `LICENSE_${state.toUpperCase()}` } });
  });

  it("maps an exhausted activation limit to a structured conflict", async () => {
    const dependencies = createDependencies();
    (dependencies.licenses.activate as ReturnType<typeof vi.fn>).mockRejectedValue(new ActivationLimitError("limit"));
    const result = await activate(dependencies);
    expect(result.response.status).toBe(409);
    expect(result.body).toMatchObject({ error: { code: "ACTIVATION_LIMIT_REACHED" } });
  });

  it("supports same-device reactivation after deactivation", async () => {
    const dependencies = createDependencies();
    const first = await activate(dependencies, "same-device");
    expect(first.response.status).toBe(201);
    const activationRecord = dependencies.licenses.findActiveActivation as ReturnType<typeof vi.fn>;
    activationRecord.mockResolvedValueOnce(null);
    const second = await activate(dependencies, "same-device");
    expect(second.response.status).toBe(201);
  });

  it("validates a signed session and returns minimal information", async () => {
    const dependencies = createDependencies();
    const result = await activate(dependencies);
    const token = (result.body.data as Record<string, string>).sessionToken;
    const response = await handleLicenseValidation(request("validate", { method: "POST", headers: { authorization: `Bearer ${token}` }, body: "{}" }), dependencies);
    const body = await response.json() as Record<string, unknown>;
    expect(response.status).toBe(200);
    expect(body).toMatchObject({ data: { status: "valid", license: { id: "license-1", state: "active" } } });
    expect(JSON.stringify(body)).not.toContain("activation_key_hash");
  });

  it("enforces the shared origin allowlist for worker and unknown origins", async () => {
    const dependencies = createDependencies();
    const allowedResponse = await handleLicenseValidation(new Request("https://getpcspa.com/api/licenses/validate", { method: "POST", headers: { origin: "https://pc-spa-web.pc-spa-feedback.workers.dev", authorization: "Bearer invalid" }, body: "{}" }), dependencies);
    expect(allowedResponse.status).not.toBe(403);
    const rejectedResponse = await handleLicenseValidation(new Request("https://getpcspa.com/api/licenses/validate", { method: "POST", headers: { origin: "https://evil.example", authorization: "Bearer invalid" }, body: "{}" }), dependencies);
    expect(rejectedResponse.status).toBe(403);
  });

  it("rejects expired and tampered session tokens", async () => {
    const dependencies = createDependencies();
    const expired = await signSessionToken({ sid: "session-1", uid: "user-1", lid: "license-1", did: "device-1", iat: 1, exp: 2 }, secret);
    const expiredResponse = await handleLicenseValidation(request("validate", { method: "POST", headers: { authorization: `Bearer ${expired}` }, body: "{}" }), dependencies);
    expect(expiredResponse.status).toBe(401);
    const activated = await activate(dependencies);
    const token = (activated.body.data as Record<string, string>).sessionToken;
    const tamperedResponse = await handleLicenseValidation(request("validate", { method: "POST", headers: { authorization: `Bearer ${token}x` }, body: "{}" }), dependencies);
    expect(tamperedResponse.status).toBe(401);
  });

  it("deactivates the bound activation and revokes the session", async () => {
    const dependencies = createDependencies();
    const activated = await activate(dependencies);
    const token = (activated.body.data as Record<string, string>).sessionToken;
    const response = await handleLicenseDeactivation(request("deactivate", { method: "POST", headers: { authorization: `Bearer ${token}` } }), dependencies);
    expect(response.status).toBe(200);
    expect(dependencies.licenses.deactivate).toHaveBeenCalled();
    expect(dependencies.sessions.revoke).toHaveBeenCalled();
    const validation = await handleLicenseValidation(request("validate", { method: "POST", headers: { authorization: `Bearer ${token}` }, body: "{}" }), dependencies);
    expect(validation.status).toBe(401);
  });

  it("enforces rate limiting", async () => {
    const dependencies = createDependencies({ rateLimiter: { limit: vi.fn(async () => ({ success: false })) } });
    const result = await activate(dependencies);
    expect(result.response.status).toBe(429);
    expect(result.body).toMatchObject({ error: { code: "RATE_LIMITED" } });
  });

  it("issues a license for an authenticated admin and returns the key once", async () => {
    const dependencies = createDependencies({ adminUserIds: new Set(["user-1"]) });
    const activated = await activate(dependencies);
    const token = (activated.body.data as Record<string, string>).sessionToken;
    const response = await handleAdminLicenseIssue(request("admin/licenses/issue", {
      method: "POST",
      headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
      body: JSON.stringify({ userId: "user-2", activationLimit: 3, expiresAt: "2027-01-01T00:00:00.000Z", state: "active" }),
    }), dependencies);
    const body = await response.json() as Record<string, unknown>;
    expect(response.status).toBe(201);
    expect(body).toMatchObject({ data: { status: "created", activationKey: "PCSPA-issued-key-once", license: { user_id: "user-2", state: "active", activation_limit: 3 } } });
    expect(dependencies.logger).not.toHaveBeenCalledWith(expect.objectContaining({ activationKey: "PCSPA-issued-key-once" }));
  });

  it("rejects unauthenticated and non-admin issuance", async () => {
    const dependencies = createDependencies({ adminUserIds: new Set(["other-user"]) });
    const unauthenticated = await handleAdminLicenseIssue(request("admin/licenses/issue", { method: "POST", body: JSON.stringify({ userId: "user-2" }) }), dependencies);
    expect(unauthenticated.status).toBe(401);

    const activated = await activate(dependencies);
    const token = (activated.body.data as Record<string, string>).sessionToken;
    const forbidden = await handleAdminLicenseIssue(request("admin/licenses/issue", { method: "POST", headers: { authorization: `Bearer ${token}`, "content-type": "application/json" }, body: JSON.stringify({ userId: "user-2" }) }), dependencies);
    expect(forbidden.status).toBe(403);
  });

  it("validates admin issuance input", async () => {
    const dependencies = createDependencies({ adminUserIds: new Set(["user-1"]) });
    const activated = await activate(dependencies);
    const token = (activated.body.data as Record<string, string>).sessionToken;
    const response = await handleAdminLicenseIssue(request("admin/licenses/issue", { method: "POST", headers: { authorization: `Bearer ${token}`, "content-type": "application/json" }, body: JSON.stringify({ userId: "", activationLimit: 0, state: "unknown" }) }), dependencies);
    expect(response.status).toBe(400);
    expect((await response.json() as Record<string, unknown>)).toMatchObject({ error: { code: "VALIDATION_ERROR" } });
  });
});
