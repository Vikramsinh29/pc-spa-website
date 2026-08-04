"use client";

import { useState, type FormEvent } from "react";

type BetaRequestResult =
  | { kind: "success"; duplicate: boolean }
  | { kind: "validation_error"; message: string }
  | { kind: "backend_error"; message: string }
  | { kind: "origin_error"; message: string }
  | { kind: "rate_limit_error"; message: string }
  | { kind: "unexpected_error"; message: string };

type BetaRequestSuccessBody = { data?: { status?: string; duplicate?: boolean } };
type BetaRequestErrorBody = { error?: { code?: string; message?: string } };
type BetaRequestResponseBody = BetaRequestSuccessBody | BetaRequestErrorBody;

export function buildBetaRequestPayload(email: string): { email: string; source: "landing-page" } {
  return { email: email.trim(), source: "landing-page" };
}

export function getBetaRequestButtonLabel(pending: boolean): string {
  return pending ? "Requesting..." : "Request beta access";
}

export function isBetaRequestSubmitDisabled(pending: boolean): boolean {
  return pending;
}

export async function submitBetaRequest(
  email: string,
  fetchImpl: typeof fetch = fetch,
): Promise<BetaRequestResult> {
  const response = await fetchImpl("/api/beta/request", {
    method: "POST",
    credentials: "include",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(buildBetaRequestPayload(email)),
  });

  let payload: BetaRequestResponseBody | null = null;
  try {
    payload = (await response.json()) as BetaRequestResponseBody;
  } catch {
    payload = null;
  }

  if (response.ok) {
    const data = payload && "data" in payload ? payload.data : undefined;
    return { kind: "success", duplicate: Boolean(data?.duplicate) };
  }

  const error = payload && "error" in payload ? payload.error : undefined;
  const code = error?.code;
  const message = error?.message ?? "Request failed.";

  if (code === "VALIDATION_ERROR") return { kind: "validation_error", message };
  if (code === "ORIGIN_NOT_ALLOWED") return { kind: "origin_error", message };
  if (code === "RATE_LIMITED") return { kind: "rate_limit_error", message };
  return { kind: "backend_error", message };
}

export function BetaRequestForm() {
  const [email, setEmail] = useState("");
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<{ kind: "success" | "error"; text: string } | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      setMessage({ kind: "error", text: "Email is required." });
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      setMessage({ kind: "error", text: "Enter a valid email address." });
      return;
    }

    setPending(true);
    setMessage(null);
    try {
      const result = await submitBetaRequest(trimmedEmail);
      if (result.kind === "success") {
        setMessage({
          kind: "success",
          text: result.duplicate ? "You are already on the beta list." : "Request received. We will review it soon.",
        });
        return;
      }

      setMessage({
        kind: "error",
        text:
          result.kind === "validation_error"
            ? "Please check the email address and try again."
            : result.kind === "origin_error"
              ? "This origin is not allowed."
              : result.kind === "rate_limit_error"
                ? "Too many requests. Try again later."
                : result.message,
      });
    } catch {
      setMessage({ kind: "error", text: "Request could not be sent right now." });
    } finally {
      setPending(false);
    }
  }

  return (
    <form className="signup" id="join" onSubmit={handleSubmit}>
      <label className="sr-only" htmlFor="email">Email address</label>
      <input
        id="email"
        name="email"
        type="email"
        placeholder="Your email address"
        required
        value={email}
        onChange={(event) => {
          setEmail(event.target.value);
          if (message) setMessage(null);
        }}
        aria-invalid={message?.kind === "error"}
      />
      <button type="submit" disabled={isBetaRequestSubmitDisabled(pending)}>
        {getBetaRequestButtonLabel(pending)} <span>&rarr;</span>
      </button>
      {message ? (
        <p className={message.kind === "success" ? "beta-form-message beta-form-success" : "beta-form-message beta-form-error"} aria-live="polite">
          {message.text}
        </p>
      ) : null}
    </form>
  );
}
