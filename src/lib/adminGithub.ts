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
  if (!res.ok) throw new Error(`写入 ${path} 失败：${res.status} ${await res.text()}`);
  return res.json();
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
