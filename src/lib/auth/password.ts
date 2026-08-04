const algorithm = "PBKDF2-SHA256";
const iterations = 120_000;
const saltBytes = 16;
const derivedBits = 256;

function encode(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/u, "");
}

function decode(value: string): Uint8Array | null {
  try {
    const normalized = value.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
    const binary = atob(normalized);
    return Uint8Array.from(binary, (character) => character.charCodeAt(0));
  } catch {
    return null;
  }
}

async function derive(password: string, salt: Uint8Array, count: number): Promise<Uint8Array> {
  const baseKey = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]);
  const saltBuffer = new ArrayBuffer(salt.byteLength);
  new Uint8Array(saltBuffer).set(salt);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", salt: saltBuffer, iterations: count, hash: "SHA-256" }, baseKey, derivedBits);
  return new Uint8Array(bits);
}

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(saltBytes));
  const hash = await derive(password, salt, iterations);
  return `${algorithm}$${iterations}$${encode(salt)}$${encode(hash)}`;
}

function timingSafeEqual(left: Uint8Array, right: Uint8Array): boolean {
  let difference = left.length ^ right.length;
  const length = Math.max(left.length, right.length);
  for (let index = 0; index < length; index += 1) difference |= (left[index] ?? 0) ^ (right[index] ?? 0);
  return difference === 0;
}

export async function verifyPassword(password: string, encodedHash: string | null): Promise<boolean> {
  if (!encodedHash) return false;
  const [storedAlgorithm, storedIterations, storedSalt, storedHash] = encodedHash.split("$");
  const salt = storedSalt ? decode(storedSalt) : null;
  const expected = storedHash ? decode(storedHash) : null;
  const count = Number(storedIterations);
  if (storedAlgorithm !== algorithm || !salt || !expected || !Number.isSafeInteger(count) || count < 100_000) return false;
  return timingSafeEqual(await derive(password, salt, count), expected);
}
