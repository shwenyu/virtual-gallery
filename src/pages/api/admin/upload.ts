import type { APIRoute } from "astro";
import { getBucket, getDb } from "../../../lib/db";
import { badRequest, json, newPhotoId, parseTags, serverError } from "../../../lib/api";

export const prerender = false;

const MAX_BYTES = 25 * 1024 * 1024;
const ALLOWED = new Set(["image/jpeg", "image/png", "image/webp", "image/avif", "image/gif"]);

const EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/avif": "avif",
  "image/gif": "gif",
};

/**
 * Stores an uploaded image in R2 and records it in D1.
 *
 * Dimensions come from the client, which reads them off the decoded image before
 * uploading — decoding the bytes again in the Worker would cost CPU for a value
 * the browser already has. They are only used for layout hints, so a wrong value
 * degrades spacing rather than doing anything unsafe.
 */
export const POST: APIRoute = async ({ request }) => {
  try {
    const db = getDb();
    const bucket = getBucket();

    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) return badRequest("没有收到文件");
    if (file.size === 0) return badRequest("文件是空的");
    if (file.size > MAX_BYTES) return badRequest(`文件太大（上限 ${MAX_BYTES / 1024 / 1024}MB）`);
    if (!ALLOWED.has(file.type)) return badRequest(`不支持的图片格式：${file.type || "未知"}`);

    const id = newPhotoId();
    const key = `${id}.${EXT[file.type]}`;

    await bucket.put(key, file.stream(), {
      httpMetadata: { contentType: file.type, cacheControl: "public, max-age=31536000, immutable" },
    });

    const width = Number(form.get("width")) || 0;
    const height = Number(form.get("height")) || 0;
    const alt = String(form.get("alt") ?? "").trim() || file.name.replace(/\.[^.]+$/, "");
    const caption = String(form.get("caption") ?? "").trim();
    const capturedAt = String(form.get("capturedAt") ?? "").trim() || null;
    const tags = parseTags(form.get("tags"));
    const src = `/photo/${key}`;

    await db
      .prepare(
        "INSERT INTO photos (id, src, width, height, alt, caption, captured_at, tags) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
      )
      .bind(id, src, width, height, alt, caption, capturedAt, JSON.stringify(tags))
      .run();

    // Optionally append to a series, keeping curated order.
    const seriesSlug = String(form.get("seriesSlug") ?? "").trim();
    if (seriesSlug) {
      const exists = await db.prepare("SELECT 1 AS ok FROM series WHERE slug = ?").bind(seriesSlug).first();
      if (exists) {
        const row = await db
          .prepare("SELECT COALESCE(MAX(position), -1) + 1 AS next FROM series_photos WHERE series_slug = ?")
          .bind(seriesSlug)
          .first<{ next: number }>();
        await db
          .prepare("INSERT OR REPLACE INTO series_photos (series_slug, photo_id, position) VALUES (?, ?, ?)")
          .bind(seriesSlug, id, row?.next ?? 0)
          .run();
        await db
          .prepare(
            "UPDATE series SET updated_at = datetime('now'), cover = COALESCE(NULLIF(cover, ''), ?) WHERE slug = ?"
          )
          .bind(id, seriesSlug)
          .run();
      }
    }

    return json({ ok: true, photo: { id, src, width, height, alt, caption, tags } });
  } catch (err) {
    return serverError(err);
  }
};
