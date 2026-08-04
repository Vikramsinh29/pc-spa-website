"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function LicenseStateButton({ licenseId, action, label }: { licenseId: string; action: "activate" | "revoke"; label: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setPending(true);
    setError(null);
    try {
      const response = await fetch(`/api/admin/licenses/${licenseId}/${action}`, { method: "POST", credentials: "include" });
      const payload = await response.json();
      if (!response.ok) {
        setError(payload?.error?.message ?? "License update failed.");
        return;
      }
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="portal-action-cell">
      <button className="portal-table-button" type="button" onClick={() => void submit()} disabled={pending}>{pending ? "Working..." : label}</button>
      {error ? <p className="portal-inline-error">{error}</p> : null}
    </div>
  );
}
