import { getCloudflareContext } from "@opennextjs/cloudflare";
import type { D1Database } from "@cloudflare/workers-types";
import { DatabaseConfigurationError } from "./errors";

export type DatabaseBindings = {
  DB?: D1Database;
};

export function createD1Client(database: D1Database): D1Database {
  return database;
}

export async function getD1Client(): Promise<D1Database> {
  const { env } = await getCloudflareContext({ async: true });
  const database = (env as DatabaseBindings).DB;

  if (!database) {
    throw new DatabaseConfigurationError("The DB D1 binding is not configured.");
  }

  return createD1Client(database);
}
