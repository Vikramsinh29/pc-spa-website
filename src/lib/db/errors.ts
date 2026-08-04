export type DatabaseErrorCode = "configuration" | "constraint" | "schema" | "query";

export class DatabaseError extends Error {
  constructor(
    message: string,
    public readonly code: DatabaseErrorCode,
    options?: { cause?: unknown },
  ) {
    super(message, options);
    this.name = "DatabaseError";
  }
}

export class DatabaseConfigurationError extends DatabaseError {
  constructor(message: string) {
    super(message, "configuration");
    this.name = "DatabaseConfigurationError";
  }
}

export function mapDatabaseError(error: unknown): DatabaseError {
  if (error instanceof DatabaseError) {
    return error;
  }

  const message = error instanceof Error ? error.message : String(error);
  const normalizedMessage = message.toLowerCase();

  if (
    normalizedMessage.includes("unique constraint") ||
    normalizedMessage.includes("foreign key constraint") ||
    normalizedMessage.includes("check constraint")
  ) {
    return new DatabaseError("Database constraint failed.", "constraint", { cause: error });
  }

  if (
    normalizedMessage.includes("no such table") ||
    normalizedMessage.includes("no such column") ||
    normalizedMessage.includes("schema")
  ) {
    return new DatabaseError("Database schema is unavailable.", "schema", { cause: error });
  }

  return new DatabaseError("Database query failed.", "query", { cause: error });
}

export async function withDatabaseError<T>(operation: () => Promise<T>): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    throw mapDatabaseError(error);
  }
}
