import type { D1Database, D1PreparedStatement, D1Result } from "@cloudflare/workers-types";
import { beforeEach, describe, expect, it } from "vitest";
import { DeviceRepository } from "../src/lib/db/repositories/device-repository";
import { LicenseRepository } from "../src/lib/db/repositories/license-repository";
import { UserRepository } from "../src/lib/db/repositories/user-repository";
import { ActivationLimitError, DuplicateActivationError, InvalidLicenseTransitionError, LicenseNotActiveError } from "../src/lib/licensing/errors";
import { hashActivationKey } from "../src/lib/licensing/crypto";

type UserRow = { id: string; email: string; display_name: string | null; created_at: string; updated_at: string };
type DeviceRow = { id: string; user_id: string; fingerprint_hash: string; name: string | null; last_seen_at: string | null; created_at: string };
type LicenseRow = { id: string; user_id: string; activation_key_hash: string; state: "pending" | "active" | "expired" | "revoked"; activation_limit: number; expires_at: string | null; created_at: string; updated_at: string };
type ActivationRow = { id: string; license_id: string; device_id: string; activated_at: string; deactivated_at: string | null };

const timestamp = "2026-08-05T00:00:00.000Z";

class MemoryD1 {
  readonly users = new Map<string, UserRow>();
  readonly devices = new Map<string, DeviceRow>();
  readonly licenses = new Map<string, LicenseRow>();
  readonly activations = new Map<string, ActivationRow>();

  prepare(query: string): D1PreparedStatement {
    return new MemoryStatement(this, query) as unknown as D1PreparedStatement;
  }

  async batch(statements: D1PreparedStatement[]): Promise<D1Result<unknown>[]> {
    return Promise.all(statements.map((statement) => statement.run()));
  }
}

class MemoryStatement {
  private values: unknown[] = [];

  constructor(private readonly database: MemoryD1, private readonly query: string) {}

  bind(...values: unknown[]): this {
    this.values = values;
    return this;
  }

  async first<T>(): Promise<T | null> {
    const sql = this.query;
    if (sql.includes("FROM users WHERE id")) {
      return (this.database.users.get(String(this.values[0])) as T | undefined) ?? null;
    }
    if (sql.includes("FROM users WHERE email")) {
      return [...this.database.users.values()].find((row) => row.email.toLowerCase() === String(this.values[0]).toLowerCase()) as T | undefined ?? null;
    }
    if (sql.includes("FROM devices WHERE fingerprint_hash")) {
      return [...this.database.devices.values()].find((row) => row.fingerprint_hash === String(this.values[0])) as T | undefined ?? null;
    }
    if (sql.includes("FROM licenses WHERE id")) {
      return (this.database.licenses.get(String(this.values[0])) as T | undefined) ?? null;
    }
    if (sql.includes("FROM licenses WHERE activation_key_hash")) {
      return [...this.database.licenses.values()].find((row) => row.activation_key_hash === String(this.values[0])) as T | undefined ?? null;
    }
    if (sql.includes("SELECT id FROM license_activations")) {
      return [...this.database.activations.values()].find((row) => row.license_id === String(this.values[0]) && row.device_id === String(this.values[1]) && row.deactivated_at === null) as T | undefined ?? null;
    }
    if (sql.includes("COUNT(*) AS count")) {
      const count = [...this.database.activations.values()].filter((row) => row.license_id === String(this.values[0]) && row.deactivated_at === null).length;
      return { count } as T;
    }
    if (sql.includes("FROM license_activations WHERE id")) {
      return (this.database.activations.get(String(this.values[0])) as T | undefined) ?? null;
    }
    return null;
  }

  async run(): Promise<D1Result<unknown>> {
    const sql = this.query;
    let changes = 0;

    if (sql.startsWith("INSERT INTO users")) {
      const email = String(this.values[1]);
      if ([...this.database.users.values()].some((row) => row.email.toLowerCase() === email.toLowerCase())) {
        throw new Error("UNIQUE constraint failed: users.email");
      }
      this.database.users.set(String(this.values[0]), {
        id: String(this.values[0]), email, display_name: (this.values[2] as string | null) ?? null, created_at: timestamp, updated_at: timestamp,
      });
      changes = 1;
    } else if (sql.startsWith("INSERT INTO devices")) {
      const fingerprintHash = String(this.values[2]);
      if ([...this.database.devices.values()].some((row) => row.fingerprint_hash === fingerprintHash)) {
        throw new Error("UNIQUE constraint failed: devices.fingerprint_hash");
      }
      this.database.devices.set(String(this.values[0]), {
        id: String(this.values[0]), user_id: String(this.values[1]), fingerprint_hash: fingerprintHash,
        name: (this.values[3] as string | null) ?? null, last_seen_at: null, created_at: timestamp,
      });
      changes = 1;
    } else if (sql.startsWith("INSERT INTO licenses")) {
      const hash = String(this.values[2]);
      if ([...this.database.licenses.values()].some((row) => row.activation_key_hash === hash)) {
        throw new Error("UNIQUE constraint failed: licenses.activation_key_hash");
      }
      this.database.licenses.set(String(this.values[0]), {
        id: String(this.values[0]), user_id: String(this.values[1]), activation_key_hash: hash, state: "pending",
        activation_limit: Number(this.values[3]), expires_at: (this.values[4] as string | null) ?? null, created_at: timestamp, updated_at: timestamp,
      });
      changes = 1;
    } else if (sql.startsWith("UPDATE licenses SET state = 'expired'")) {
      const license = this.database.licenses.get(String(this.values[0]));
      if (license && (license.state === "pending" || license.state === "active") && license.expires_at !== null && license.expires_at <= String(this.values[1])) {
        license.state = "expired";
        license.updated_at = String(this.values[1]);
        changes = 1;
      }
    } else if (sql.startsWith("UPDATE licenses SET state")) {
      const license = this.database.licenses.get(String(this.values[0]));
      if (license && license.state === this.values[2]) {
        license.state = this.values[1] as LicenseRow["state"];
        license.updated_at = timestamp;
        changes = 1;
      }
    } else if (sql.startsWith("INSERT INTO license_activations") && sql.includes("SELECT")) {
      const activationId = String(this.values[0]);
      const deviceId = String(this.values[1]);
      const licenseId = String(this.values[2]);
      const now = String(this.values[3]);
      const license = this.database.licenses.get(licenseId);
      const activeCount = [...this.database.activations.values()].filter((row) => row.license_id === licenseId && row.deactivated_at === null).length;
      const duplicate = [...this.database.activations.values()].some((row) => row.license_id === licenseId && row.device_id === deviceId && row.deactivated_at === null);
      if (license?.state === "active" && (license.expires_at === null || license.expires_at > now) && activeCount < license.activation_limit && !duplicate) {
        this.database.activations.set(activationId, { id: activationId, license_id: licenseId, device_id: deviceId, activated_at: timestamp, deactivated_at: null });
        changes = 1;
      }
    }

    return {
      success: true,
      results: [],
      meta: { changes, duration: 0, rows_read: 0, rows_written: changes, size_after: 0, last_row_id: 0, changed_db: changes > 0 },
    } as unknown as D1Result<unknown>;
  }
}

function repositories(database: MemoryD1) {
  return {
    users: new UserRepository(database as unknown as D1Database),
    devices: new DeviceRepository(database as unknown as D1Database),
    licenses: new LicenseRepository(database as unknown as D1Database),
  };
}

describe("licensing repositories", () => {
  let database: MemoryD1;
  let licenses: LicenseRepository;

  beforeEach(() => {
    database = new MemoryD1();
    licenses = repositories(database).licenses;
  });

  it("persists users, devices, and licenses with typed repositories", async () => {
    const { users, devices } = repositories(database);
    await users.insert({ id: "user-1", email: "person@example.com" });
    await devices.insert({ id: "device-1", userId: "user-1", fingerprintHash: "fingerprint-1" });
    const created = await licenses.create({ id: "license-1", userId: "user-1", activationLimit: 2 });

    expect(await users.findByEmail("PERSON@EXAMPLE.COM")).toMatchObject({ id: "user-1" });
    expect(await devices.findByFingerprintHash("fingerprint-1")).toMatchObject({ user_id: "user-1" });
    expect(created.license).not.toHaveProperty("activation_key_hash");
    expect(await licenses.findByActivationKeyHash(await hashActivationKey(created.activationKey))).toMatchObject({ id: "license-1" });
  });

  it("enforces duplicate constraints", async () => {
    const { users } = repositories(database);
    await users.insert({ id: "user-1", email: "person@example.com" });
    await expect(users.insert({ id: "user-2", email: "PERSON@EXAMPLE.COM" })).rejects.toThrow("Database constraint failed");
  });

  it("enforces valid and invalid status transitions", async () => {
    await licenses.create({ id: "license-1", userId: "user-1" });
    await licenses.transitionState("license-1", "active");
    await expect(licenses.transitionState("license-1", "pending")).rejects.toThrow(InvalidLicenseTransitionError);
    await licenses.transitionState("license-1", "revoked");
    expect((await licenses.findById("license-1"))?.state).toBe("revoked");
  });

  it("rejects activation for revoked and expired licenses", async () => {
    await licenses.create({ id: "revoked", userId: "user-1" });
    await licenses.transitionState("revoked", "revoked");
    await expect(licenses.activate("revoked", "device-1", "activation-1")).rejects.toThrow(LicenseNotActiveError);

    await licenses.create({ id: "expired", userId: "user-1", expiresAt: "2026-08-06T00:00:00.000Z" });
    await licenses.transitionState("expired", "active");
    expect((await licenses.findById("expired", new Date("2026-08-06T00:00:00.000Z")))?.state).toBe("expired");
    await expect(licenses.activate("expired", "device-1", "activation-2", new Date("2026-08-06T00:00:00.000Z"))).rejects.toThrow(LicenseNotActiveError);
  });

  it("allows device reactivation while preserving history", async () => {
    await licenses.create({ id: "license-1", userId: "user-1", activationLimit: 1 });
    await licenses.transitionState("license-1", "active");
    await licenses.activate("license-1", "device-1", "activation-1");
    const previous = database.activations.get("activation-1");
    if (previous) previous.deactivated_at = "2026-08-05T01:00:00.000Z";

    await licenses.activate("license-1", "device-1", "activation-2");
    expect(database.activations.size).toBe(2);
    expect(database.activations.get("activation-1")?.deactivated_at).toBe("2026-08-05T01:00:00.000Z");
  });

  it("enforces activation limits atomically under concurrent requests", async () => {
    await licenses.create({ id: "license-1", userId: "user-1", activationLimit: 1 });
    await licenses.transitionState("license-1", "active");
    const results = await Promise.allSettled([
      licenses.activate("license-1", "device-1", "activation-1"),
      licenses.activate("license-1", "device-2", "activation-2"),
    ]);

    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(results.filter((result) => result.status === "rejected").map((result) => result.reason)).toEqual(expect.arrayContaining([expect.any(ActivationLimitError)]));
  });

  it("rejects duplicate active activation while allowing repeated history after deactivation", async () => {
    await licenses.create({ id: "license-1", userId: "user-1", activationLimit: 2 });
    await licenses.transitionState("license-1", "active");
    await licenses.activate("license-1", "device-1", "activation-1");
    await expect(licenses.activate("license-1", "device-1", "activation-2")).rejects.toThrow(DuplicateActivationError);
  });
});
