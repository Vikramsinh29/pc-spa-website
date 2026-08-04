import { beforeEach, describe, expect, it, vi } from "vitest";
import { DatabaseError } from "../src/lib/db/errors";
import { handleBetaRequest } from "../src/lib/beta-request/handler";

const approvedOrigin = "https://getpcspa.com";
type HandlerDependencies = Parameters<typeof handleBetaRequest>[1];
type TestRepository = {
  findByEmail: HandlerDependencies["repository"]["findByEmail"] & ReturnType<typeof vi.fn>;
  insert: HandlerDependencies["repository"]["insert"] & ReturnType<typeof vi.fn>;
};
type TestDependencies = Omit<HandlerDependencies, "repository" | "rateLimiter"> & {
  repository: TestRepository;
  rateLimiter: HandlerDependencies["rateLimiter"] & { limit: ReturnType<typeof vi.fn> };
};

function makeRequest(body: unknown, headers: Record<string, string> = {}): Request {
  return new Request("https://getpcspa.com/api/beta/request", {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
}

function makeDependencies(overrides: Partial<HandlerDependencies> = {}): TestDependencies {
  const repository = {
    findByEmail: vi.fn() as TestRepository["findByEmail"],
    insert: vi.fn() as TestRepository["insert"],
  } satisfies TestRepository;
  repository.findByEmail.mockResolvedValue(null);

  return {
    repository,
    rateLimiter: {
      limit: vi.fn().mockResolvedValue({ success: true }) as TestDependencies["rateLimiter"]["limit"],
    },
    approvedOrigin,
    allowedOrigins: new Set([approvedOrigin, "https://pc-spa-web.pc-spa-feedback.workers.dev"]),
    createId: () => "request-id",
    createRequestId: () => "trace-id",
    logger: vi.fn(),
    ...overrides,
  } as TestDependencies;
}

describe("POST /api/beta/request", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("rejects invalid input with structured validation details", async () => {
    const dependencies = makeDependencies();
    const response = await handleBetaRequest(makeRequest({ email: "not-an-email" }), dependencies);
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body).toMatchObject({ error: { code: "VALIDATION_ERROR" } });
    expect(body.error.fields).toEqual(expect.arrayContaining([expect.objectContaining({ path: "email" })]));
    expect(dependencies.repository.insert).not.toHaveBeenCalled();
  });

  it("returns an idempotent success for an existing normalized email", async () => {
    const dependencies = makeDependencies();
    dependencies.repository.findByEmail.mockResolvedValue({
      id: "existing-id",
      email: "person@example.com",
      source: null,
      metadata_json: null,
      created_at: "2026-08-04T00:00:00.000Z",
    });

    const response = await handleBetaRequest(
      makeRequest({ email: "  PERSON@EXAMPLE.COM " }),
      dependencies,
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({ data: { status: "received", duplicate: true } });
    expect(dependencies.repository.findByEmail).toHaveBeenCalledWith("person@example.com");
    expect(dependencies.repository.insert).not.toHaveBeenCalled();
  });

  it("rejects requests when Cloudflare rate limiting denies the key", async () => {
    const dependencies = makeDependencies({
      rateLimiter: { limit: vi.fn().mockResolvedValue({ success: false }) },
    });

    const response = await handleBetaRequest(makeRequest({ email: "person@example.com" }), dependencies);
    const body = await response.json();

    expect(response.status).toBe(429);
    expect(body).toMatchObject({ error: { code: "RATE_LIMITED" } });
    expect(dependencies.repository.findByEmail).not.toHaveBeenCalled();
  });

  it("normalizes and persists a new request with source metadata", async () => {
    const dependencies = makeDependencies();
    const response = await handleBetaRequest(
      makeRequest(
        {
          email: "  PERSON@EXAMPLE.COM ",
          source: "hero",
          metadata: { campaign: "launch" },
        },
        { origin: approvedOrigin, "cf-connecting-ip": "203.0.113.10" },
      ),
      dependencies,
    );

    expect(response.status).toBe(201);
    expect(dependencies.repository.insert).toHaveBeenCalledWith({
      id: "request-id",
      email: "person@example.com",
      source: "hero",
      metadataJson: JSON.stringify({ campaign: "launch" }),
    });
    expect(dependencies.rateLimiter.limit).toHaveBeenCalledWith({
      key: "beta-request:203.0.113.10",
    });
    expect(response.headers.get("Access-Control-Allow-Origin")).toBe(approvedOrigin);
  });

  it("maps a unique constraint race to the same idempotent response", async () => {
    const dependencies = makeDependencies();
    dependencies.repository.insert.mockRejectedValue(
      new DatabaseError("Database constraint failed.", "constraint"),
    );

    const response = await handleBetaRequest(makeRequest({ email: "person@example.com" }), dependencies);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({ data: { status: "received", duplicate: true } });
  });

  it("allows the worker origin, rejects unknown origins, and accepts missing Origin", async () => {
    const dependencies = makeDependencies();
    const workerResponse = await handleBetaRequest(makeRequest({ email: "person@example.com" }, { origin: "https://pc-spa-web.pc-spa-feedback.workers.dev" }), dependencies);
    expect(workerResponse.status).not.toBe(403);

    const rejected = await handleBetaRequest(makeRequest({ email: "person@example.com" }, { origin: "https://evil.example" }), dependencies);
    expect(rejected.status).toBe(403);

    const noOrigin = await handleBetaRequest(makeRequest({ email: "person@example.com" }), dependencies);
    expect(noOrigin.status).toBe(201);
  });
});
