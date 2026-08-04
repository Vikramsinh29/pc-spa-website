import { describe, expect, it } from "vitest";
import { generateActivationKey, hashActivationKey } from "../src/lib/licensing/crypto";
import { ActivationLimitError, DuplicateActivationError, InvalidLicenseTransitionError } from "../src/lib/licensing/errors";
import { assertActivationCapacity, assertActivationIsUnique, assertLicenseTransition } from "../src/lib/licensing/rules";

describe("licensing foundation", () => {
  it("generates high-entropy server-side activation keys", () => {
    const first = generateActivationKey();
    const second = generateActivationKey();

    expect(first).toMatch(/^PCSPA-[A-Za-z0-9_-]{32}$/u);
    expect(second).toMatch(/^PCSPA-[A-Za-z0-9_-]{32}$/u);
    expect(first).not.toBe(second);
  });

  it("hashes activation keys deterministically without retaining the raw key", async () => {
    const hash = await hashActivationKey("PCSPA-test-key");
    const sameHash = await hashActivationKey("PCSPA-test-key");

    expect(hash).toBe(sameHash);
    expect(hash).toMatch(/^[a-f0-9]{64}$/u);
    expect(hash).not.toContain("PCSPA");
  });

  it("prevents duplicate device activations", () => {
    expect(() => assertActivationIsUnique("activation-1")).toThrow(DuplicateActivationError);
    expect(() => assertActivationIsUnique(null)).not.toThrow();
  });

  it("allows only forward license status transitions", () => {
    expect(() => assertLicenseTransition("pending", "active")).not.toThrow();
    expect(() => assertLicenseTransition("active", "revoked")).not.toThrow();
    expect(() => assertLicenseTransition("revoked", "active")).toThrow(InvalidLicenseTransitionError);
    expect(() => assertLicenseTransition("expired", "active")).toThrow(InvalidLicenseTransitionError);
  });

  it("enforces the configured activation limit", () => {
    expect(() => assertActivationCapacity(0, 1)).not.toThrow();
    expect(() => assertActivationCapacity(1, 1)).toThrow(ActivationLimitError);
    expect(() => assertActivationCapacity(2, 1)).toThrow(ActivationLimitError);
  });
});
