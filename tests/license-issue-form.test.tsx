import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { getIssueLicenseSuccess, getIssueLicenseValidation, IssuedActivationKeyPanel } from "../src/components/auth/license-issue-form";

describe("admin license issue UI", () => {
  it("reads the activation key from data.activationKey and exposes it for display", () => {
    expect(getIssueLicenseSuccess({ data: { activationKey: "PCSPA-live-key", license: { id: "license-1" } } })).toEqual({ activationKey: "PCSPA-live-key", licenseId: "license-1" });
  });

  it("maps validation errors into clear field messages", () => {
    expect(getIssueLicenseValidation({ error: { fields: [{ path: "userId", message: "Required" }, { path: "activationLimit", message: "Too small" }] } })).toEqual({ userId: "Required", activationLimit: "Too small" });
  });

  it("displays the returned activation key clearly after success", () => {
    const html = renderToStaticMarkup(<IssuedActivationKeyPanel activationKey="PCSPA-issued-key-once" licenseId="license-1" />);
    expect(html).toContain("PCSPA-issued-key-once");
    expect(html).toContain("Copy this key now");
    expect(html).toContain("shown only once");
  });
});
