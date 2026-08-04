import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn(), refresh: vi.fn() }),
}));

import { AuthForm } from "../src/components/auth/auth-form";

describe("public auth UI", () => {
  it("renders the register form with accessible email and password fields", () => {
    const html = renderToStaticMarkup(<AuthForm mode="register" />);
    expect(html).toContain('id="email"');
    expect(html).toContain('type="email"');
    expect(html).toContain('id="password"');
    expect(html).toContain('type="password"');
    expect(html).toContain("Create account");
  });

  it("renders the login form state", () => {
    const html = renderToStaticMarkup(<AuthForm mode="login" />);
    expect(html).toContain("Sign in to PC-SPA");
    expect(html).toContain("Sign in");
  });
});
