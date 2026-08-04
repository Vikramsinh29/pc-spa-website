import type { D1Database } from "@cloudflare/workers-types";
import { withDatabaseError } from "../errors";
import type { NewSession, SessionRecord } from "../types";

export class SessionRepository {
  constructor(private readonly database: D1Database) {}

  findByTokenHash(tokenHash: string): Promise<SessionRecord | null> {
    return withDatabaseError(() =>
      this.database.prepare("SELECT id, user_id, token_hash, expires_at, revoked_at, created_at, last_seen_at FROM sessions WHERE token_hash = ?1 LIMIT 1").bind(tokenHash).first<SessionRecord>(),
    );
  }

  async insert(input: NewSession): Promise<void> {
    await withDatabaseError(() =>
      this.database.prepare("INSERT INTO sessions (id, user_id, token_hash, expires_at) VALUES (?1, ?2, ?3, ?4)").bind(input.id, input.userId, input.tokenHash, input.expiresAt).run(),
    );
  }

  async revoke(id: string, revokedAt: string): Promise<void> {
    await withDatabaseError(() =>
      this.database.prepare("UPDATE sessions SET revoked_at = ?2 WHERE id = ?1 AND revoked_at IS NULL").bind(id, revokedAt).run(),
    );
  }

  async touch(id: string, lastSeenAt: string): Promise<void> {
    await withDatabaseError(() =>
      this.database.prepare("UPDATE sessions SET last_seen_at = ?2 WHERE id = ?1 AND revoked_at IS NULL").bind(id, lastSeenAt).run(),
    );
  }
}
