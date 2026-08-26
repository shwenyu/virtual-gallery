export interface AdminSettings {
  cloud: string;
  preset: string;
  owner: string;
  repo: string;
  branch: string;
  token: string;
}

const STORAGE_KEY = "gallery-admin-settings";

export function loadSettings(): AdminSettings {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}");
  } catch {
    return {} as AdminSettings;
  }
}

export function saveSettings(s: AdminSettings) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
}

export function hasRepoSettings(s: AdminSettings): boolean {
  return Boolean(s.owner && s.repo && s.token);
}

function ghHeaders(token: string) {
  return {
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
  };
}

function b64EncodeUtf8(str: string) {
  return btoa(unescape(encodeURIComponent(str)));
}

function b64DecodeUtf8(b64: string) {
  return decodeURIComponent(escape(atob(b64.replace(/\n/g, ""))));
}

export async function getFile<T = unknown>(settings: AdminSettings, path: string): Promise<{ sha: string; content: T }> {
  // The `_` query param busts caches without adding a request header: GitHub's
  // CORS policy does not allow `Cache-Control`, and sending it fails the preflight
  // with a bare "Failed to fetch".
  const url =
    `https://api.github.com/repos/${settings.owner}/${settings.repo}/contents/${path}` +
    `?ref=${settings.branch}&_=${Date.now()}`;
  const res = await fetch(url, { headers: ghHeaders(settings.token), cache: "no-store" });
  if (!res.ok) throw new Error(`读取 ${path} 失败：${res.status} ${await res.text()}`);
  const data = await res.json();
  return { sha: data.sha as string, content: JSON.parse(b64DecodeUtf8(data.content)) as T };
}

/** Thrown when the file changed since we read it (stale sha). */
export class ConflictError extends Error {}

export async function putFile(settings: AdminSettings, path: string, content: unknown, sha: string, message: string) {
  const url = `https://api.github.com/repos/${settings.owner}/${settings.repo}/contents/${path}`;
  const res = await fetch(url, {
    method: "PUT",
    headers: { ...ghHeaders(settings.token), "Content-Type": "application/json" },
    body: JSON.stringify({
      message,
      content: b64EncodeUtf8(JSON.stringify(content, null, 2) + "\n"),
      sha,
      branch: settings.branch,
    }),
  });
  if (res.status === 409 || res.status === 422) {
    throw new ConflictError(`${path} 已被改动（sha 过期）`);
  }
  if (!res.ok) throw new Error(`写入 ${path} 失败：${res.status} ${await res.text()}`);
  return res.json();
}

/**
 * What we last successfully wrote, per path: the sha GitHub returned for that
 * write plus the exact content we sent. This is the key to consecutive edits.
 *
 * Re-reading before each write does NOT work: the contents API keeps serving the
 * pre-write copy for a while, so a second edit reads the old sha, gets rejected,
 * and retrying just re-reads the same stale copy until it gives up. The write
 * response, by contrast, always carries the authoritative new sha — so after our
 * own write we build on that instead of asking again.
 */
const lastWrite = new Map<string, { sha: string; content: unknown }>();

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

/** Forget cached write state (e.g. before a deliberate reload from the repo). */
export function forgetCachedWrites(path?: string) {
  if (path) lastWrite.delete(path);
  else lastWrite.clear();
}

/**
 * Read → mutate → write, safe to call repeatedly in quick succession.
 *
 * Uses the sha from our own previous write when we have one, and only falls back
 * to a network read when we don't (or when GitHub says our basis is genuinely
 * out of date, which means someone else changed the file).
 */
export async function updateJsonFile<T>(
  settings: AdminSettings,
  path: string,
  mutate: (content: T) => T | void,
  message: string,
  attempts = 5
): Promise<T> {
  let lastError: unknown;

  for (let attempt = 0; attempt < attempts; attempt++) {
    const cached = lastWrite.get(path);
    const basis = cached
      ? { sha: cached.sha, content: clone(cached.content) as T }
      : await getFile<T>(settings, path);

    const next = (mutate(basis.content) ?? basis.content) as T;

    try {
      const result = await putFile(settings, path, next, basis.sha, message);
      const newSha = result?.content?.sha as string | undefined;
      if (newSha) lastWrite.set(path, { sha: newSha, content: clone(next) });
      else lastWrite.delete(path);
      return next;
    } catch (err) {
      if (!(err instanceof ConflictError)) throw err;
      lastError = err;
      // Our basis was wrong — drop it so the next attempt reads from the repo.
      lastWrite.delete(path);
      await new Promise((r) => setTimeout(r, 600 * (attempt + 1)));
    }
  }

  throw new Error(`${path} 连续 ${attempts} 次写入都遇到冲突，请稍等几秒后重试。（${(lastError as Error)?.message ?? ""}）`);
}

export async function uploadToCloudinary(settings: AdminSettings, file: File) {
  const url = `https://api.cloudinary.com/v1_1/${settings.cloud}/image/upload`;
  const form = new FormData();
  form.append("file", file);
  form.append("upload_preset", settings.preset);
  const res = await fetch(url, { method: "POST", body: form });
  if (!res.ok) throw new Error(`Cloudinary 上传失败：${res.status} ${await res.text()}`);
  return res.json();
}

export function optimizedUrl(secureUrl: string) {
  return secureUrl.replace("/upload/", "/upload/f_auto,q_auto/");
}

export function slugifyId(publicId: string) {
  return "p_" + publicId.replace(/[^a-zA-Z0-9_-]/g, "-").slice(-40);
}
