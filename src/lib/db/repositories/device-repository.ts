import type { D1Database } from "@cloudflare/workers-types";
import { withDatabaseError } from "../errors";
import type { DeviceRecord, NewDevice } from "../types";

export class DeviceRepository {
  constructor(private readonly database: D1Database) {}

  findByFingerprintHash(fingerprintHash: string): Promise<DeviceRecord | null> {
    return withDatabaseError(() =>
      this.database.prepare("SELECT id, user_id, fingerprint_hash, name, last_seen_at, created_at FROM devices WHERE fingerprint_hash = ?1 LIMIT 1").bind(fingerprintHash).first<DeviceRecord>(),
    );
  }

  async insert(input: NewDevice): Promise<void> {
    await withDatabaseError(() =>
      this.database.prepare("INSERT INTO devices (id, user_id, fingerprint_hash, name) VALUES (?1, ?2, ?3, ?4)").bind(input.id, input.userId, input.fingerprintHash, input.name ?? null).run(),
    );
  }
}
