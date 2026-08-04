"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function LogoutButton() {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function logout() {
    setPending(true);
    try {
      await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
      router.replace("/login");
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  return <button className="portal-button portal-button-secondary" type="button" onClick={() => void logout()} disabled={pending}>{pending ? "Signing out..." : "Logout"}</button>;
}
