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
  const url = `https://api.github.com/repos/${settings.owner}/${settings.repo}/contents/${path}?ref=${settings.branch}`;
  const res = await fetch(url, { headers: ghHeaders(settings.token) });
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
 * Read → mutate → write, retrying the whole cycle when GitHub rejects a stale sha.
 *
 * Every write has to go through this rather than a bare getFile/putFile pair:
 * the contents API can serve a copy that predates our own last write, so back-to-back
 * edits (deleting two series, uploading several photos) otherwise fail with 409 —
 * or, worse, silently overwrite each other. Re-reading before each retry means the
 * mutation is re-applied to whatever is actually in the repo now.
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
    const { sha, content } = await getFile<T>(settings, path);
    const next = (mutate(content) ?? content) as T;
    try {
      await putFile(settings, path, next, sha, message);
      return next;
    } catch (err) {
      if (!(err instanceof ConflictError)) throw err;
      lastError = err;
      // Give the API a moment to stop serving the pre-write copy.
      await new Promise((r) => setTimeout(r, 500 * (attempt + 1)));
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
