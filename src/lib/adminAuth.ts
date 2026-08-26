/**
 * Client-side admin gate.
 *
 * IMPORTANT: this is a deterrent, not real security. The site is static, so this
 * check runs in the visitor's own browser and can be bypassed by anyone who reads
 * the page source. The actual protection is that nothing can be *written* without
 * the fine-grained GitHub token, which only lives in your own browser's storage.
 * Treat this as "keeps the admin UI out of sight", not "keeps attackers out".
 */

const HASH_KEY = "gallery-admin-passhash";
const SESSION_KEY = "gallery-admin-session";

async function sha256(text: string): Promise<string> {
  const bytes = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export function hasPassphrase(): boolean {
  try {
    return Boolean(localStorage.getItem(HASH_KEY));
  } catch {
    return false;
  }
}

export async function setPassphrase(pass: string): Promise<void> {
  localStorage.setItem(HASH_KEY, await sha256(pass));
}

export async function verifyPassphrase(pass: string): Promise<boolean> {
  const stored = localStorage.getItem(HASH_KEY);
  if (!stored) return false;
  return stored === (await sha256(pass));
}

export function isUnlocked(): boolean {
  try {
    return sessionStorage.getItem(SESSION_KEY) === "1";
  } catch {
    return false;
  }
}

export function unlock(): void {
  try {
    sessionStorage.setItem(SESSION_KEY, "1");
  } catch {}
}

export function lock(): void {
  try {
    sessionStorage.removeItem(SESSION_KEY);
  } catch {}
}

/** Clears the passphrase and any stored connection settings. */
export function resetAdmin(): void {
  try {
    localStorage.removeItem(HASH_KEY);
    localStorage.removeItem("gallery-admin-settings");
    sessionStorage.removeItem(SESSION_KEY);
  } catch {}
}
