import { describe, expect, it, vi } from "vitest";
import {
  buildBetaRequestPayload,
  getBetaRequestButtonLabel,
  isBetaRequestSubmitDisabled,
  submitBetaRequest,
} from "../src/components/beta-request-form";

describe("beta request landing form", () => {
  it("builds the exact payload expected by the endpoint", () => {
    expect(buildBetaRequestPayload("  person@example.com ")).toEqual({
      email: "person@example.com",
      source: "landing-page",
    });
  });

  it("posts to the local beta request route with credentials", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: { status: "received", duplicate: false } }),
    });

    await submitBetaRequest("person@example.com", fetchImpl as typeof fetch);

    expect(fetchImpl).toHaveBeenCalledWith("/api/beta/request", expect.objectContaining({
      method: "POST",
      credentials: "include",
      body: JSON.stringify({ email: "person@example.com", source: "landing-page" }),
    }));
  });

  it("maps successful and duplicate responses", async () => {
    const success = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: { status: "received", duplicate: false } }),
    });
    const duplicate = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: { status: "received", duplicate: true } }),
    });

    await expect(submitBetaRequest("person@example.com", success as typeof fetch)).resolves.toMatchObject({ kind: "success", duplicate: false });
    await expect(submitBetaRequest("person@example.com", duplicate as typeof fetch)).resolves.toMatchObject({ kind: "success", duplicate: true });
  });

  it("maps validation, origin, rate limit, and backend errors", async () => {
    const makeError = (code: string, message: string) => vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({ error: { code, message } }),
    });

    await expect(submitBetaRequest("person@example.com", makeError("VALIDATION_ERROR", "bad") as typeof fetch)).resolves.toMatchObject({ kind: "validation_error" });
    await expect(submitBetaRequest("person@example.com", makeError("ORIGIN_NOT_ALLOWED", "bad") as typeof fetch)).resolves.toMatchObject({ kind: "origin_error" });
    await expect(submitBetaRequest("person@example.com", makeError("RATE_LIMITED", "bad") as typeof fetch)).resolves.toMatchObject({ kind: "rate_limit_error" });
    await expect(submitBetaRequest("person@example.com", makeError("SERVER_ERROR", "bad") as typeof fetch)).resolves.toMatchObject({ kind: "backend_error" });
  });

  it("reports the pending button state", () => {
    expect(getBetaRequestButtonLabel(true)).toBe("Requesting...");
    expect(getBetaRequestButtonLabel(false)).toBe("Request beta access");
    expect(isBetaRequestSubmitDisabled(true)).toBe(true);
    expect(isBetaRequestSubmitDisabled(false)).toBe(false);
  });
});
