import type { D1Database } from "@cloudflare/workers-types";
import { withDatabaseError } from "../errors";
import type { CustomerRecord, NewCustomer } from "../types";

export class CustomerRepository {
  constructor(private readonly database: D1Database) {}

  findById(id: string): Promise<CustomerRecord | null> {
    return withDatabaseError(() =>
      this.database
        .prepare(
          `SELECT id, email, full_name, phone, created_at, updated_at
           FROM customers
           WHERE id = ?1
           LIMIT 1`,
        )
        .bind(id)
        .first<CustomerRecord>(),
    );
  }

  findByEmail(email: string): Promise<CustomerRecord | null> {
    return withDatabaseError(() =>
      this.database
        .prepare(
          `SELECT id, email, full_name, phone, created_at, updated_at
           FROM customers
           WHERE email = ?1
           LIMIT 1`,
        )
        .bind(email)
        .first<CustomerRecord>(),
    );
  }

  async insert(input: NewCustomer): Promise<void> {
    await withDatabaseError(() =>
      this.database
        .prepare(
          `INSERT INTO customers (id, email, full_name, phone)
           VALUES (?1, ?2, ?3, ?4)`,
        )
        .bind(input.id, input.email, input.fullName, input.phone ?? null)
        .run(),
    );
  }
}
