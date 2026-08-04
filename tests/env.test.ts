import { afterEach, describe, expect, it, vi } from "vitest";

const originalEnv = { ...process.env };

async function loadEnv() {
  return import("../src/lib/env");
}

afterEach(() => {
  process.env = { ...originalEnv };
  vi.resetModules();
});

describe("server environment origin policy", () => {
  it("includes the production and workers.dev origins when ALLOWED_ORIGINS is set", async () => {
    process.env.SITE_URL = "https://getpcspa.com";
    process.env.ALLOWED_ORIGINS = "https://getpcspa.com,https://pc-spa-web.pc-spa-feedback.workers.dev";
    const { getServerEnvironment } = await loadEnv();
    const env = getServerEnvironment();
    expect(env.allowedOrigins.has("https://getpcspa.com")).toBe(true);
    expect(env.allowedOrigins.has("https://pc-spa-web.pc-spa-feedback.workers.dev")).toBe(true);
  });

  it("keeps SITE_URL as the default allowed origin when ALLOWED_ORIGINS is absent", async () => {
    process.env.SITE_URL = "https://getpcspa.com";
    delete process.env.ALLOWED_ORIGINS;
    const { getServerEnvironment } = await loadEnv();
    const env = getServerEnvironment();
    expect(env.allowedOrigins.has("https://getpcspa.com")).toBe(true);
  });
});
