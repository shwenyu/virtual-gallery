import { env } from "cloudflare:workers";

/**
 * Server-side admin auth.
 *
 * The password hash lives in D1 and the session is a signed cookie, so signing
 * in works the same in any browser on any device — unlike the previous
 * localStorage passphrase, which was invisible to every other browser.
 */

const SESSION_COOKIE = "gallery_session";
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 14; // two weeks
const PBKDF2_ITERATIONS = 210_000;

const encoder = new TextEncoder();

function b64urlEncode(bytes: Uint8Array): string {
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function b64urlDecode(text: string): Uint8Array {
  const padded = text.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(text.length / 4) * 4, "=");
  const binary = atob(padded);
  return Uint8Array.from(binary, (c) => c.charCodeAt(0));
}

/** Constant-time comparison, so a wrong guess leaks nothing through timing. */
function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

async function pbkdf2(password: string, salt: Uint8Array): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey("raw", encoder.encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt, iterations: PBKDF2_ITERATIONS },
    key,
    256
  );
  return new Uint8Array(bits);
}

/** Stored as `pbkdf2$<iterations>$<salt>$<hash>`. */
export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const hash = await pbkdf2(password, salt);
  return `pbkdf2$${PBKDF2_ITERATIONS}$${b64urlEncode(salt)}$${b64urlEncode(hash)}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parts = stored.split("$");
  if (parts.length !== 4 || parts[0] !== "pbkdf2") return false;
  const salt = b64urlDecode(parts[2]);
  const expected = b64urlDecode(parts[3]);
  const key = await crypto.subtle.importKey("raw", encoder.encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt, iterations: Number(parts[1]) },
    key,
    expected.length * 8
  );
  return timingSafeEqual(new Uint8Array(bits), expected);
}

/**
 * Signing key for session cookies. Falls back to the password hash so the site
 * still works before a SESSION_SECRET is set — rotating the password then also
 * invalidates outstanding sessions, which is the safe direction to fail.
 */
async function signingKey(db: D1Database): Promise<CryptoKey> {
  let secret = (env as Env).SESSION_SECRET;
  if (!secret) {
    const row = await db.prepare("SELECT password_hash FROM admin_auth WHERE id = 1").first<{ password_hash: string }>();
    secret = row?.password_hash ?? "gallery-unconfigured";
  }
  return crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, [
    "sign",
    "verify",
  ]);
}

export async function createSessionCookie(db: D1Database): Promise<string> {
  const payload = JSON.stringify({ exp: Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS });
  const payloadB64 = b64urlEncode(encoder.encode(payload));
  const key = await signingKey(db);
  const sig = new Uint8Array(await crypto.subtle.sign("HMAC", key, encoder.encode(payloadB64)));
  const value = `${payloadB64}.${b64urlEncode(sig)}`;
  return `${SESSION_COOKIE}=${value}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${SESSION_TTL_SECONDS}`;
}

export function clearSessionCookie(): string {
  return `${SESSION_COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`;
}

function readCookie(request: Request, name: string): string | undefined {
  const header = request.headers.get("cookie");
  if (!header) return undefined;
  for (const part of header.split(";")) {
    const [k, ...rest] = part.trim().split("=");
    if (k === name) return rest.join("=");
  }
  return undefined;
}

export async function isAuthenticated(request: Request, db: D1Database): Promise<boolean> {
  const raw = readCookie(request, SESSION_COOKIE);
  if (!raw) return false;
  const [payloadB64, sigB64] = raw.split(".");
  if (!payloadB64 || !sigB64) return false;

  try {
    const key = await signingKey(db);
    const valid = await crypto.subtle.verify("HMAC", key, b64urlDecode(sigB64), encoder.encode(payloadB64));
    if (!valid) return false;
    const { exp } = JSON.parse(new TextDecoder().decode(b64urlDecode(payloadB64)));
    return typeof exp === "number" && exp > Math.floor(Date.now() / 1000);
  } catch {
    return false;
  }
}

/** True before any password has been set — the first-run setup case. */
export async function needsSetup(db: D1Database): Promise<boolean> {
  const row = await db.prepare("SELECT 1 AS present FROM admin_auth WHERE id = 1").first();
  return !row;
}

export async function setPassword(db: D1Database, password: string): Promise<void> {
  const hash = await hashPassword(password);
  await db
    .prepare(
      "INSERT INTO admin_auth (id, password_hash, updated_at) VALUES (1, ?, datetime('now')) " +
        "ON CONFLICT(id) DO UPDATE SET password_hash = excluded.password_hash, updated_at = excluded.updated_at"
    )
    .bind(hash)
    .run();
}

export async function getPasswordHash(db: D1Database): Promise<string | undefined> {
  const row = await db.prepare("SELECT password_hash FROM admin_auth WHERE id = 1").first<{ password_hash: string }>();
  return row?.password_hash;
}
