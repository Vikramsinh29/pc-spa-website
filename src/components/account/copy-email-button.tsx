"use client";

export function CopyEmailButton({ email }: { email: string }) {
  return (
    <button
      className="portal-table-button portal-copy-button"
      type="button"
      onClick={async () => {
        await navigator.clipboard.writeText(email);
      }}
    >
      Copy email
    </button>
  );
}
