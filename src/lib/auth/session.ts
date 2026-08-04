export const authSessionCookieName = "pcspa_session";

function encode(value: Uint8Array): string {
  let binary = "";
  for (const byte of value) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/u, "");
}

export function generateSessionToken(): string {
  return encode(crypto.getRandomValues(new Uint8Array(32)));
}

export function getSessionCookie(request: Request): string | null {
  const header = request.headers.get("cookie");
  if (!header) return null;
  for (const part of header.split(";")) {
    const [name, ...value] = part.trim().split("=");
    if (name === authSessionCookieName) return value.join("=") || null;
  }
  return null;
}

export function createSessionCookie(token: string, secure: boolean, maxAge: number): string {
  return `${authSessionCookieName}=${token}; Max-Age=${maxAge}; Path=/; HttpOnly; SameSite=Lax${secure ? "; Secure" : ""}`;
}

export function clearSessionCookie(secure: boolean): string {
  return `${authSessionCookieName}=; Max-Age=0; Path=/; HttpOnly; SameSite=Lax${secure ? "; Secure" : ""}`;
}
