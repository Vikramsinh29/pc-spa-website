import { hashValue } from "./crypto";

export type SessionTokenClaims = {
  sid: string;
  uid: string;
  lid: string;
  did: string;
  iat: number;
  exp: number;
};

const tokenVersion = "v1";

function encode(value: string): string {
  const bytes = new TextEncoder().encode(value);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/u, "");
}

function decode(value: string): string | null {
  try {
    const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
    const binary = atob(padded);
    return new TextDecoder().decode(Uint8Array.from(binary, (character) => character.charCodeAt(0)));
  } catch {
    return null;
  }
}

async function signature(input: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const digest = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(input));
  return encode(String.fromCharCode(...new Uint8Array(digest)));
}

function timingSafeEqual(left: string, right: string): boolean {
  const leftBytes = new TextEncoder().encode(left);
  const rightBytes = new TextEncoder().encode(right);
  let difference = leftBytes.length ^ rightBytes.length;
  const length = Math.max(leftBytes.length, rightBytes.length);
  for (let index = 0; index < length; index += 1) {
    difference |= (leftBytes[index] ?? 0) ^ (rightBytes[index] ?? 0);
  }
  return difference === 0;
}

export async function signSessionToken(claims: SessionTokenClaims, secret: string): Promise<string> {
  const payload = encode(JSON.stringify(claims));
  const content = `${tokenVersion}.${payload}`;
  return `${content}.${await signature(content, secret)}`;
}

export async function verifySessionToken(token: string, secret: string, now = new Date()): Promise<SessionTokenClaims | null> {
  const parts = token.split(".");
  if (parts.length !== 3 || parts[0] !== tokenVersion) return null;

  const content = `${parts[0]}.${parts[1]}`;
  const expectedSignature = await signature(content, secret);
  if (!timingSafeEqual(expectedSignature, parts[2])) return null;

  const decoded = decode(parts[1]);
  if (!decoded) return null;

  try {
    const claims = JSON.parse(decoded) as Partial<SessionTokenClaims>;
    if (
      typeof claims.sid !== "string" || typeof claims.uid !== "string" || typeof claims.lid !== "string" ||
      typeof claims.did !== "string" || typeof claims.iat !== "number" || typeof claims.exp !== "number" ||
      !Number.isSafeInteger(claims.iat) || !Number.isSafeInteger(claims.exp) || claims.exp <= Math.floor(now.getTime() / 1000)
    ) return null;
    return claims as SessionTokenClaims;
  } catch {
    return null;
  }
}

export { hashValue as hashSessionToken };
