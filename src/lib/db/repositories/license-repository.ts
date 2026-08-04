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

  private findRawById(id: string): Promise<LicenseRecord | null> {
    return withDatabaseError(() =>
      this.database
        .prepare("SELECT id, user_id, activation_key_hash, state, activation_limit, expires_at, created_at, updated_at FROM licenses WHERE id = ?1 LIMIT 1")
        .bind(id)
        .first<LicenseRecord>(),
    );
  }

  private async applyExpiration(license: LicenseRecord, now: string): Promise<LicenseRecord> {
    if (
      license.expires_at === null ||
      license.expires_at > now ||
      (license.state !== "pending" && license.state !== "active")
    ) {
      return license;
    }

    await withDatabaseError(() =>
      this.database
        .prepare(
          "UPDATE licenses SET state = 'expired', updated_at = ?2 WHERE id = ?1 AND state IN ('pending', 'active') AND expires_at IS NOT NULL AND expires_at <= ?2",
        )
        .bind(license.id, now)
        .run(),
    );

    return (await this.findRawById(license.id)) ?? license;
  }

  async findById(id: string, now = new Date()): Promise<LicenseRecord | null> {
    const license = await this.findRawById(id);
    return license ? this.applyExpiration(license, now.toISOString()) : null;
  }

  async findByActivationKeyHash(activationKeyHash: string, now = new Date()): Promise<LicenseRecord | null> {
    const license = await withDatabaseError(() =>
      this.database
        .prepare("SELECT id, user_id, activation_key_hash, state, activation_limit, expires_at, created_at, updated_at FROM licenses WHERE activation_key_hash = ?1 LIMIT 1")
        .bind(activationKeyHash)
        .first<LicenseRecord>(),
    );

    return license ? this.applyExpiration(license, now.toISOString()) : null;
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

  async activate(licenseId: string, deviceId: string, activationId: string, now = new Date()): Promise<LicenseActivationRecord> {
    const nowIso = now.toISOString();
    const license = await this.findById(licenseId, now);
    if (!license || license.state !== "active") {
      throw new LicenseNotActiveError("License is not active.");
    }

    const result = await withDatabaseError(() =>
      this.database
        .prepare(
          `INSERT INTO license_activations (id, license_id, device_id)
           SELECT ?1, id, ?2
           FROM licenses
           WHERE id = ?3
             AND state = 'active'
             AND (expires_at IS NULL OR expires_at > ?4)
             AND (SELECT COUNT(*) FROM license_activations WHERE license_id = ?3 AND deactivated_at IS NULL) < activation_limit
             AND NOT EXISTS (
               SELECT 1 FROM license_activations
               WHERE license_id = ?3 AND device_id = ?2 AND deactivated_at IS NULL
             )`,
        )
        .bind(activationId, deviceId, licenseId, nowIso)
        .run(),
    );

    if (result.meta.changes === 0) {
      const currentLicense = await this.findById(licenseId, now);
      if (!currentLicense || currentLicense.state !== "active") {
        throw new LicenseNotActiveError("License is not active.");
      }

      const existing = await withDatabaseError(() =>
        this.database
          .prepare("SELECT id FROM license_activations WHERE license_id = ?1 AND device_id = ?2 AND deactivated_at IS NULL LIMIT 1")
          .bind(licenseId, deviceId)
          .first<{ id: string }>(),
      );
      assertActivationIsUnique(existing?.id ?? null);

      const activeCount = await withDatabaseError(async () => {
        const count = await this.database
          .prepare("SELECT COUNT(*) AS count FROM license_activations WHERE license_id = ?1 AND deactivated_at IS NULL")
          .bind(licenseId)
          .first<{ count: number }>();
        return Number(count?.count ?? 0);
      });
      assertActivationCapacity(activeCount, currentLicense.activation_limit);
      throw new Error("Activation could not be created.");
    }

    const activation = await withDatabaseError(() =>
      this.database.prepare("SELECT id, license_id, device_id, activated_at, deactivated_at FROM license_activations WHERE id = ?1 LIMIT 1").bind(activationId).first<LicenseActivationRecord>(),
    );
    if (!activation) {
      throw new Error("Created activation could not be read back.");
    }

    return activation;
  }
}
