import { z } from "zod";
import { DatabaseError } from "../db/errors";
import type { BetaAccessRequestRecord, NewBetaAccessRequest } from "../db/types";

const sourceMetadataSchema = z
  .record(z.string().trim().min(1).max(50), z.string().trim().max(200))
  .refine((metadata) => Object.keys(metadata).length <= 10, "Too many metadata fields.");

export const betaRequestSchema = z.object({
  email: z.string().trim().email().max(254),
  source: z.string().trim().min(1).max(100).optional(),
  metadata: sourceMetadataSchema.optional(),
});

type BetaRequestInput = z.infer<typeof betaRequestSchema>;

export type BetaAccessRequestRepositoryLike = {
  findByEmail(email: string): Promise<BetaAccessRequestRecord | null>;
  insert(input: NewBetaAccessRequest): Promise<void>;
};

export type BetaRateLimiter = {
  limit(options: { key: string }): Promise<{ success: boolean }>;
};

export type BetaRequestDependencies = {
  repository: BetaAccessRequestRepositoryLike;
  rateLimiter: BetaRateLimiter | undefined;
  approvedOrigin: string;
  allowedOrigins: ReadonlySet<string>;
  createId?: () => string;
  createRequestId?: () => string;
  logger?: (entry: Record<string, string>) => void;
};

function responseHeaders(origin: string | null, allowedOrigins: ReadonlySet<string>): HeadersInit {
  const headers: Record<string, string> = {
    "Cache-Control": "no-store",
    Vary: "Origin",
  };

  if (origin && allowedOrigins.has(origin)) {
    headers["Access-Control-Allow-Origin"] = origin;
    headers["Access-Control-Allow-Credentials"] = "true";
    headers["Access-Control-Allow-Methods"] = "POST, OPTIONS";
    headers["Access-Control-Allow-Headers"] = "Content-Type";
    headers["Access-Control-Max-Age"] = "600";
  }

  return headers;
}

function jsonResponse(
  body: unknown,
  status: number,
  origin: string | null,
  allowedOrigins: ReadonlySet<string>,
  requestId: string,
): Response {
  return Response.json(body, {
    status,
    headers: { ...responseHeaders(origin, allowedOrigins), "X-Request-Id": requestId },
  });
}

function log(
  logger: BetaRequestDependencies["logger"],
  requestId: string,
  outcome: string,
): void {
  logger?.({ event: "beta_request", outcome, requestId });
}

function getClientKey(request: Request): string {
  const ip = request.headers.get("cf-connecting-ip") ?? "unknown";
  return `beta-request:${ip}`;
}

async function parseInput(request: Request): Promise<
  | { success: true; data: BetaRequestInput }
  | { success: false; response: Response }
> {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return {
      success: false,
      response: Response.json(
        { error: { code: "INVALID_JSON", message: "Request body must be valid JSON." } },
        { status: 400 },
      ),
    };
  }

  const result = betaRequestSchema.safeParse(body);
  if (!result.success) {
    return {
      success: false,
      response: Response.json(
        {
          error: {
            code: "VALIDATION_ERROR",
            message: "Request body is invalid.",
            fields: result.error.issues.map((issue) => ({
              path: issue.path.join("."),
              message: issue.message,
            })),
          },
        },
        { status: 400 },
      ),
    };
  }

  return { success: true, data: result.data };
}

export async function handleBetaRequest(
  request: Request,
  dependencies: BetaRequestDependencies,
): Promise<Response> {
  const requestId = dependencies.createRequestId?.() ?? crypto.randomUUID();
  const origin = request.headers.get("origin");

  if (origin && !dependencies.allowedOrigins.has(origin)) {
    log(dependencies.logger, requestId, "origin_rejected");
    return jsonResponse(
      { error: { code: "ORIGIN_NOT_ALLOWED", message: "Origin is not allowed." } },
      403,
      origin,
      dependencies.allowedOrigins,
      requestId,
    );
  }

  if (!dependencies.rateLimiter) {
    log(dependencies.logger, requestId, "rate_limiter_missing");
    return jsonResponse(
      { error: { code: "SERVICE_UNAVAILABLE", message: "Request service is unavailable." } },
      503,
      origin,
      dependencies.allowedOrigins,
      requestId,
    );
  }

  let limit: { success: boolean };
  try {
    limit = await dependencies.rateLimiter.limit({ key: getClientKey(request) });
  } catch {
    log(dependencies.logger, requestId, "rate_limiter_error");
    return jsonResponse(
      { error: { code: "SERVICE_UNAVAILABLE", message: "Request service is unavailable." } },
      503,
      origin,
      dependencies.allowedOrigins,
      requestId,
    );
  }
  if (!limit.success) {
    log(dependencies.logger, requestId, "rate_limited");
    return jsonResponse(
      { error: { code: "RATE_LIMITED", message: "Too many requests. Try again later." } },
      429,
      origin,
      dependencies.allowedOrigins,
      requestId,
    );
  }

  const parsed = await parseInput(request);
  if (!parsed.success) {
    for (const [name, value] of Object.entries(responseHeaders(origin, dependencies.allowedOrigins))) {
      parsed.response.headers.set(name, value);
    }
    parsed.response.headers.set("X-Request-Id", requestId);
    return parsed.response;
  }

  const input = parsed.data;
  const email = input.email.toLowerCase();
  const existing = await dependencies.repository.findByEmail(email);
  if (existing) {
    log(dependencies.logger, requestId, "duplicate");
    return jsonResponse(
      { data: { status: "received", duplicate: true } },
      200,
      origin,
      dependencies.allowedOrigins,
      requestId,
    );
  }

  const newRequest: NewBetaAccessRequest = {
    id: (dependencies.createId ?? crypto.randomUUID)(),
    email,
    source: input.source,
    metadataJson: input.metadata ? JSON.stringify(input.metadata) : null,
  };

  try {
    await dependencies.repository.insert(newRequest);
  } catch (error) {
    if (error instanceof DatabaseError && error.code === "constraint") {
      log(dependencies.logger, requestId, "duplicate_race");
      return jsonResponse(
        { data: { status: "received", duplicate: true } },
        200,
        origin,
        dependencies.allowedOrigins,
        requestId,
      );
    }

    log(dependencies.logger, requestId, "persistence_error");
    return jsonResponse(
      { error: { code: "DATABASE_ERROR", message: "Request could not be saved." } },
      503,
      origin,
      dependencies.allowedOrigins,
      requestId,
    );
  }

  log(dependencies.logger, requestId, "created");
  return jsonResponse(
    { data: { status: "received", duplicate: false } },
    201,
    origin,
    dependencies.allowedOrigins,
    requestId,
  );
}

export function createOptionsResponse(
  request: Request,
  approvedOrigin: string,
  allowedOrigins: ReadonlySet<string> = new Set([approvedOrigin]),
): Response {
  const origin = request.headers.get("origin");
  if (origin && !allowedOrigins.has(origin)) {
    return jsonResponse(
      { error: { code: "ORIGIN_NOT_ALLOWED", message: "Origin is not allowed." } },
      403,
      origin,
      allowedOrigins,
      crypto.randomUUID(),
    );
  }

  return new Response(null, { status: 204, headers: responseHeaders(origin, allowedOrigins) });
}
