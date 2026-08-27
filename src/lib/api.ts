export const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });

export const badRequest = (message: string) => json({ error: message }, 400);
export const notFound = (message = "没找到") => json({ error: message }, 404);

export function serverError(err: unknown) {
  return json({ error: (err as Error)?.message ?? "服务器错误" }, 500);
}

/** Filesystem/URL-safe id for a newly uploaded photo. */
export function newPhotoId(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(8));
  return "p_" + Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

/** Normalises a user-supplied slug to what the URL router can carry. */
export function normalizeSlug(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9一-龥-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function parseTags(raw: unknown): string[] {
  if (Array.isArray(raw)) return raw.map(String).map((t) => t.trim()).filter(Boolean);
  if (typeof raw === "string") return raw.split(",").map((t) => t.trim()).filter(Boolean);
  return [];
}
