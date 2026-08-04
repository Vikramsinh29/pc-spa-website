import type { D1Database } from "@cloudflare/workers-types";
import { withDatabaseError } from "../errors";
import type { NewServiceRequest, ServiceRequestRecord } from "../types";

export class ServiceRequestRepository {
  constructor(private readonly database: D1Database) {}

  findById(id: string): Promise<ServiceRequestRecord | null> {
    return withDatabaseError(() =>
      this.database
        .prepare(
          `SELECT id, customer_id, service_id, status, notes, created_at, updated_at
           FROM service_requests
           WHERE id = ?1
           LIMIT 1`,
        )
        .bind(id)
        .first<ServiceRequestRecord>(),
    );
  }

  async insert(input: NewServiceRequest): Promise<void> {
    await withDatabaseError(() =>
      this.database
        .prepare(
          `INSERT INTO service_requests (id, customer_id, service_id, notes)
           VALUES (?1, ?2, ?3, ?4)`,
        )
        .bind(input.id, input.customerId, input.serviceId, input.notes ?? null)
        .run(),
    );
  }
}
