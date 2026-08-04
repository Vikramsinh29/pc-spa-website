import type { D1Database } from "@cloudflare/workers-types";
import { withDatabaseError } from "../errors";
import type { NewUser, UserRecord } from "../types";

export class UserRepository {
  constructor(private readonly database: D1Database) {}

  findById(id: string): Promise<UserRecord | null> {
    return withDatabaseError(() =>
      this.database.prepare("SELECT id, email, display_name, created_at, updated_at FROM users WHERE id = ?1 LIMIT 1").bind(id).first<UserRecord>(),
    );
  }

  findByEmail(email: string): Promise<UserRecord | null> {
    return withDatabaseError(() =>
      this.database.prepare("SELECT id, email, display_name, created_at, updated_at FROM users WHERE email = ?1 LIMIT 1").bind(email).first<UserRecord>(),
    );
  }

  async insert(input: NewUser): Promise<void> {
    await withDatabaseError(() =>
      this.database.prepare("INSERT INTO users (id, email, display_name) VALUES (?1, ?2, ?3)").bind(input.id, input.email, input.displayName ?? null).run(),
    );
  }
}
