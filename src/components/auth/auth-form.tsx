"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type AuthMode = "login" | "register";

type FormState = {
  success?: string;
  error?: string;
  fieldErrors?: Partial<Record<"email" | "password", string>>;
};

type ValidationIssue = { path?: unknown; message?: unknown };

function title(mode: AuthMode): string {
  return mode === "login" ? "Sign in to PC-SPA" : "Create your PC-SPA account";
}

function submitLabel(mode: AuthMode, pending: boolean): string {
  if (pending) return mode === "login" ? "Signing in..." : "Creating account...";
  return mode === "login" ? "Sign in" : "Create account";
}

export function AuthForm({ mode }: { mode: AuthMode }) {
  const router = useRouter();
  const [formState, setFormState] = useState<FormState>({});
  const [pending, setPending] = useState(false);

  async function onSubmit(formData: FormData) {
    const email = String(formData.get("email") ?? "").trim();
    const password = String(formData.get("password") ?? "");
    const fieldErrors: FormState["fieldErrors"] = {};

    if (!email) fieldErrors.email = "Email is required.";
    if (!password) fieldErrors.password = "Password is required.";
    else if (mode === "register" && password.length < 12) fieldErrors.password = "Password must be at least 12 characters.";
    if (fieldErrors.email || fieldErrors.password) {
      setFormState({ fieldErrors });
      return;
    }

    setPending(true);
    setFormState({});
    try {
      const response = await fetch(`/api/auth/${mode}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email, password }),
      });
      const payload = await response.json();
      if (!response.ok) {
        const issues = Array.isArray(payload?.error?.fields) ? (payload.error.fields as ValidationIssue[]) : [];
        const nextFieldErrors: FormState["fieldErrors"] = {};
        for (const issue of issues) {
          if ((issue.path === "email" || issue.path === "password") && typeof issue.message === "string") {
            nextFieldErrors[issue.path] = issue.message;
          }
        }
        setFormState({
          error: payload?.error?.message ?? (mode === "login" ? "Sign-in failed." : "Registration failed."),
          fieldErrors: nextFieldErrors,
        });
        return;
      }

      if (mode === "register") {
        setFormState({ success: "Account created. You can sign in now." });
        const form = document.getElementById("auth-form") as HTMLFormElement | null;
        form?.reset();
        return;
      }

      const form = document.getElementById("auth-form") as HTMLFormElement | null;
      form?.reset();
      router.replace("/account");
      router.refresh();
    } finally {
      const passwordInput = document.getElementById("password") as HTMLInputElement | null;
      if (passwordInput) passwordInput.value = "";
      setPending(false);
    }
  }

  return (
    <section className="portal-shell">
      <div className="portal-card auth-card">
        <p className="eyebrow">CONTROLLED ACCESS</p>
        <h1 className="portal-title">{title(mode)}</h1>
        <p className="portal-copy">Use your existing PC-SPA account to manage access and licenses without changing the public landing page.</p>
        <form
          id="auth-form"
          className="portal-form"
          action={(formData) => {
            void onSubmit(formData);
          }}
        >
          <label className="portal-label" htmlFor="email">Email</label>
          <input id="email" name="email" type="email" autoComplete="email" className="portal-input" aria-invalid={Boolean(formState.fieldErrors?.email)} required />
          {formState.fieldErrors?.email ? <p className="portal-error">{formState.fieldErrors.email}</p> : null}

          <label className="portal-label" htmlFor="password">Password</label>
          <input id="password" name="password" type="password" autoComplete={mode === "login" ? "current-password" : "new-password"} className="portal-input" aria-invalid={Boolean(formState.fieldErrors?.password)} required />
          {formState.fieldErrors?.password ? <p className="portal-error">{formState.fieldErrors.password}</p> : null}

          {formState.error ? <p className="portal-error">{formState.error}</p> : null}
          {formState.success ? <p className="portal-success">{formState.success}</p> : null}

          <button className="portal-button" type="submit" disabled={pending}>{submitLabel(mode, pending)}</button>
        </form>
        <p className="portal-meta">
          {mode === "login" ? <a href="/register">Need an account?</a> : <a href="/login">Already registered?</a>}
        </p>
      </div>
    </section>
  );
}
