import type { D1Database } from "@cloudflare/workers-types";
import { withDatabaseError } from "../errors";
import type { BetaAccessRequestRecord, NewBetaAccessRequest } from "../types";

export class BetaAccessRequestRepository {
  constructor(private readonly database: D1Database) {}

  findByEmail(email: string): Promise<BetaAccessRequestRecord | null> {
    return withDatabaseError(() =>
      this.database
        .prepare(
          `SELECT id, email, source, metadata_json, created_at
           FROM beta_access_requests
           WHERE email = ?1
           LIMIT 1`,
        )
        .bind(email)
        .first<BetaAccessRequestRecord>(),
    );
  }

  async insert(input: NewBetaAccessRequest): Promise<void> {
    await withDatabaseError(() =>
      this.database
        .prepare(
          `INSERT INTO beta_access_requests (id, email, source, metadata_json)
           VALUES (?1, ?2, ?3, ?4)`,
        )
        .bind(input.id, input.email, input.source ?? null, input.metadataJson ?? null)
        .run(),
    );
  }
}
