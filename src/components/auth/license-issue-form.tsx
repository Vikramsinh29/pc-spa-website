"use client";

import { useState } from "react";

type IssueFormState = {
  activationKey?: string;
  licenseId?: string;
  error?: string;
  validation?: Partial<Record<"userId" | "activationLimit" | "expiresAt", string>>;
};

type ValidationIssue = {
  path?: unknown;
  message?: unknown;
};

export function getIssueLicenseSuccess(payload: unknown): { activationKey: string; licenseId?: string } | null {
  const data = payload && typeof payload === "object" && "data" in payload ? (payload as { data?: unknown }).data : undefined;
  if (!data || typeof data !== "object") return null;
  const activationKey = "activationKey" in data ? (data as { activationKey?: unknown }).activationKey : undefined;
  const license = "license" in data ? (data as { license?: { id?: unknown } }).license : undefined;
  if (typeof activationKey !== "string" || !activationKey) return null;
  return {
    activationKey,
    licenseId: typeof license?.id === "string" ? license.id : undefined,
  };
}

export function getIssueLicenseValidation(payload: unknown): IssueFormState["validation"] {
  const issues = payload && typeof payload === "object" && "error" in payload
    ? ((payload as { error?: { fields?: unknown } }).error?.fields)
    : undefined;
  if (!Array.isArray(issues)) return {};

  const mapped: IssueFormState["validation"] = {};
  for (const issue of issues as ValidationIssue[]) {
    if ((issue.path === "userId" || issue.path === "activationLimit" || issue.path === "expiresAt") && typeof issue.message === "string") {
      mapped[issue.path] = issue.message;
    }
  }
  return mapped;
}

export function IssuedActivationKeyPanel({ activationKey, licenseId }: { activationKey: string; licenseId?: string }) {
  return (
    <section className="portal-panel issue-success-panel" aria-live="polite">
      <p className="eyebrow">ACTIVATION KEY</p>
      <h2>Copy this key now</h2>
      <p className="portal-copy">This raw activation key is shown only once. It is never stored in local storage or written back to the UI after you leave this screen.</p>
      <code className="portal-key-block">{activationKey}</code>
      {licenseId ? <p className="portal-meta">License ID: {licenseId}</p> : null}
    </section>
  );
}

export function LicenseIssueForm() {
  const [state, setState] = useState<IssueFormState>({});
  const [pending, setPending] = useState(false);

  async function handleSubmit(formData: FormData) {
    const userId = String(formData.get("userId") ?? "").trim();
    const activationLimitRaw = String(formData.get("activationLimit") ?? "1").trim();
    const expiresAtRaw = String(formData.get("expiresAt") ?? "").trim();
    const stateValue = String(formData.get("state") ?? "pending").trim();

    const validation: IssueFormState["validation"] = {};
    if (!userId) validation.userId = "User ID is required.";
    const activationLimit = Number(activationLimitRaw);
    if (!Number.isInteger(activationLimit) || activationLimit < 1 || activationLimit > 100) {
      validation.activationLimit = "Activation limit must be an integer between 1 and 100.";
    }
    if (expiresAtRaw && Number.isNaN(Date.parse(expiresAtRaw))) {
      validation.expiresAt = "Expiry must be a valid date and time.";
    }
    if (validation.userId || validation.activationLimit || validation.expiresAt) {
      setState({ validation });
      return;
    }

    setPending(true);
    setState({});
    try {
      const response = await fetch("/api/admin/licenses/issue", {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          userId,
          activationLimit,
          expiresAt: expiresAtRaw ? new Date(expiresAtRaw).toISOString() : null,
          state: stateValue,
        }),
      });
      const payload = await response.json();
      if (!response.ok) {
        setState({
          error: payload?.error?.message ?? "License issuance failed.",
          validation: getIssueLicenseValidation(payload),
        });
        return;
      }
      const success = getIssueLicenseSuccess(payload);
      if (!success) {
        setState({ error: "License was created, but the activation key was missing from the response." });
        return;
      }
      setState({ activationKey: success.activationKey, licenseId: success.licenseId });
      const form = document.getElementById("license-issue-form") as HTMLFormElement | null;
      form?.reset();
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="portal-grid portal-grid-issue">
      <section className="portal-panel">
        <h2>Issue license</h2>
        <p className="portal-copy">Create a new license and reveal the raw activation key exactly once after the API succeeds.</p>
        <form
          id="license-issue-form"
          className="portal-form"
          action={(formData) => {
            void handleSubmit(formData);
          }}
        >
          <label className="portal-label" htmlFor="userId">User ID</label>
          <input id="userId" name="userId" className="portal-input" aria-invalid={Boolean(state.validation?.userId)} required />
          {state.validation?.userId ? <p className="portal-error">{state.validation.userId}</p> : null}

          <label className="portal-label" htmlFor="activationLimit">Activation limit</label>
          <input id="activationLimit" name="activationLimit" type="number" min="1" max="100" defaultValue="1" className="portal-input" aria-invalid={Boolean(state.validation?.activationLimit)} required />
          {state.validation?.activationLimit ? <p className="portal-error">{state.validation.activationLimit}</p> : null}

          <label className="portal-label" htmlFor="expiresAt">Expiry</label>
          <input id="expiresAt" name="expiresAt" type="datetime-local" className="portal-input" aria-invalid={Boolean(state.validation?.expiresAt)} />
          {state.validation?.expiresAt ? <p className="portal-error">{state.validation.expiresAt}</p> : null}

          <label className="portal-label" htmlFor="state">Initial state</label>
          <select id="state" name="state" className="portal-input portal-select" defaultValue="pending">
            <option value="pending">Pending</option>
            <option value="active">Active</option>
          </select>

          {state.error ? <p className="portal-error">{state.error}</p> : null}
          <button className="portal-button" type="submit" disabled={pending}>{pending ? "Issuing..." : "Generate activation key"}</button>
        </form>
      </section>
      {state.activationKey ? <IssuedActivationKeyPanel activationKey={state.activationKey} licenseId={state.licenseId} /> : null}
    </div>
  );
}
