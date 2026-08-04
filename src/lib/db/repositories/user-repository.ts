import type { D1Database } from "@cloudflare/workers-types";
import { withDatabaseError } from "../errors";
import type { NewUser, UserRecord } from "../types";

export class UserRepository {
  constructor(private readonly database: D1Database) {}

  findById(id: string): Promise<UserRecord | null> {
    return withDatabaseError(() =>
      this.database.prepare("SELECT id, email, password_hash, display_name, created_at, updated_at FROM users WHERE id = ?1 LIMIT 1").bind(id).first<UserRecord>(),
    );
  }

  findByEmail(email: string): Promise<UserRecord | null> {
    return withDatabaseError(() =>
      this.database.prepare("SELECT id, email, password_hash, display_name, created_at, updated_at FROM users WHERE email = ?1 LIMIT 1").bind(email).first<UserRecord>(),
    );
  }

  async insert(input: NewUser): Promise<void> {
    await withDatabaseError(() =>
      this.database.prepare("INSERT INTO users (id, email, password_hash, display_name) VALUES (?1, ?2, ?3, ?4)").bind(input.id, input.email, input.passwordHash ?? null, input.displayName ?? null).run(),
    );
  }

  listAll(): Promise<UserRecord[]> {
    return withDatabaseError(() =>
      this.database
        .prepare("SELECT id, email, password_hash, display_name, created_at, updated_at FROM users ORDER BY created_at DESC")
        .all<UserRecord>()
        .then((result) => result.results),
    );
  }
}
