import type { D1Database } from "@cloudflare/workers-types";
import { withDatabaseError } from "../errors";
import type {
  LicenseActivationRecord,
  LicensePublicRecord,
  LicenseRecord,
  LicenseState,
  NewLicense,
} from "../types";
import { hashActivationKey, generateActivationKey } from "../../licensing/crypto";
import {
  assertActivationCapacity,
  assertActivationIsUnique,
  assertLicenseTransition,
} from "../../licensing/rules";
import { LicenseNotActiveError } from "../../licensing/errors";

export class LicenseRepository {
  constructor(private readonly database: D1Database) {}

  async create(input: NewLicense): Promise<{ license: LicensePublicRecord; activationKey: string }> {
    const activationKey = generateActivationKey();
    const activationKeyHash = await hashActivationKey(activationKey);

    await withDatabaseError(() =>
      this.database
        .prepare(
          `INSERT INTO licenses (id, user_id, activation_key_hash, activation_limit, expires_at)
           VALUES (?1, ?2, ?3, ?4, ?5)`,
        )
        .bind(input.id, input.userId, activationKeyHash, input.activationLimit ?? 1, input.expiresAt ?? null)
        .run(),
    );

    const license = await this.findById(input.id);
    if (!license) {
      throw new Error("Created license could not be read back.");
    }

    const { activation_key_hash: redactedActivationKeyHash, ...publicLicense } = license;
    void redactedActivationKeyHash;
    return { license: publicLicense, activationKey };
  }

  findById(id: string): Promise<LicenseRecord | null> {
    return withDatabaseError(() =>
      this.database
        .prepare("SELECT id, user_id, activation_key_hash, state, activation_limit, expires_at, created_at, updated_at FROM licenses WHERE id = ?1 LIMIT 1")
        .bind(id)
        .first<LicenseRecord>(),
    );
  }

  findByActivationKeyHash(activationKeyHash: string): Promise<LicenseRecord | null> {
    return withDatabaseError(() =>
      this.database
        .prepare("SELECT id, user_id, activation_key_hash, state, activation_limit, expires_at, created_at, updated_at FROM licenses WHERE activation_key_hash = ?1 LIMIT 1")
        .bind(activationKeyHash)
        .first<LicenseRecord>(),
    );
  }

  async transitionState(id: string, state: LicenseState): Promise<void> {
    const license = await this.findById(id);
    if (!license) {
      throw new Error("License not found.");
    }

    assertLicenseTransition(license.state, state);
    if (license.state === state) {
      return;
    }

    await withDatabaseError(() =>
      this.database
        .prepare("UPDATE licenses SET state = ?2, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = ?1 AND state = ?3")
        .bind(id, state, license.state)
        .run(),
    );
  }

  async activate(licenseId: string, deviceId: string, activationId: string): Promise<LicenseActivationRecord> {
    const license = await this.findById(licenseId);
    if (!license || license.state !== "active") {
      throw new LicenseNotActiveError("License is not active.");
    }

    const existing = await withDatabaseError(() =>
      this.database.prepare("SELECT id FROM license_activations WHERE license_id = ?1 AND device_id = ?2 AND deactivated_at IS NULL LIMIT 1").bind(licenseId, deviceId).first<{ id: string }>(),
    );
    assertActivationIsUnique(existing?.id ?? null);

    const activeCount = await withDatabaseError(async () => {
      const result = await this.database.prepare("SELECT COUNT(*) AS count FROM license_activations WHERE license_id = ?1 AND deactivated_at IS NULL").bind(licenseId).first<{ count: number }>();
      return Number(result?.count ?? 0);
    });
    assertActivationCapacity(activeCount, license.activation_limit);

    await withDatabaseError(() =>
      this.database
        .prepare("INSERT INTO license_activations (id, license_id, device_id) VALUES (?1, ?2, ?3)")
        .bind(activationId, licenseId, deviceId)
        .run(),
    );

    const activation = await withDatabaseError(() =>
      this.database.prepare("SELECT id, license_id, device_id, activated_at, deactivated_at FROM license_activations WHERE id = ?1 LIMIT 1").bind(activationId).first<LicenseActivationRecord>(),
    );
    if (!activation) {
      throw new Error("Created activation could not be read back.");
    }

    return activation;
  }
}
