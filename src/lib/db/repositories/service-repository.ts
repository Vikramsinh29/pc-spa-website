import type { D1Database } from "@cloudflare/workers-types";
import { withDatabaseError } from "../errors";
import type { ServiceRecord } from "../types";

export class ServiceRepository {
  constructor(private readonly database: D1Database) {}

  listActive(): Promise<ServiceRecord[]> {
    return withDatabaseError(async () => {
      const result = await this.database
        .prepare(
          `SELECT id, slug, name, description, is_active, created_at, updated_at
           FROM services
           WHERE is_active = 1
           ORDER BY name ASC`,
        )
        .all<ServiceRecord>();

      return result.results;
    });
  }

  findBySlug(slug: string): Promise<ServiceRecord | null> {
    return withDatabaseError(() =>
      this.database
        .prepare(
          `SELECT id, slug, name, description, is_active, created_at, updated_at
           FROM services
           WHERE slug = ?1
           LIMIT 1`,
        )
        .bind(slug)
        .first<ServiceRecord>(),
    );
  }
}
