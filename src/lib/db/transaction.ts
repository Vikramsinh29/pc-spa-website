import type { D1Database, D1PreparedStatement, D1Result } from "@cloudflare/workers-types";
import { withDatabaseError } from "./errors";

export type TransactionStatement = D1PreparedStatement;

/** Executes a group of prepared statements atomically through D1 batch(). */
export async function runTransaction(
  database: D1Database,
  statements: readonly TransactionStatement[],
): Promise<readonly D1Result<unknown>[]> {
  if (statements.length === 0) {
    return [];
  }

  return withDatabaseError(() => database.batch([...statements]));
}
