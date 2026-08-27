import type { APIRoute } from "astro";
import { getAllPhotos, getBucket, getDb } from "../../../lib/db";
import { badRequest, json, notFound, parseTags, serverError } from "../../../lib/api";

export const prerender = false;

export const GET: APIRoute = async () => {
  try {
    return json({ photos: await getAllPhotos(getDb()) });
  } catch (err) {
    return serverError(err);
  }
};

/** Edit a photo's name, caption or tags. */
export const PATCH: APIRoute = async ({ request }) => {
  try {
    const db = getDb();
    const body = (await request.json()) as Record<string, unknown>;
    const id = String(body.id ?? "");
    if (!id) return badRequest("缺少照片 id");

    const existing = await db.prepare("SELECT 1 AS ok FROM photos WHERE id = ?").bind(id).first();
    if (!existing) return notFound("没找到这张照片");

    await db
      .prepare("UPDATE photos SET alt = ?, caption = ?, tags = ?, captured_at = ? WHERE id = ?")
      .bind(
        String(body.alt ?? "").trim(),
        String(body.caption ?? "").trim(),
        JSON.stringify(parseTags(body.tags)),
        String(body.capturedAt ?? "").trim() || null,
        id
      )
      .run();

    return json({ ok: true });
  } catch (err) {
    return serverError(err);
  }
};

/**
 * Deletes a photo, its R2 object, and every reference to it.
 *
 * A series whose cover was this photo falls back to its first remaining photo,
 * so no series is left pointing at something that no longer exists.
 */
export const DELETE: APIRoute = async ({ request }) => {
  try {
    const db = getDb();
    const body = (await request.json()) as { id?: unknown };
    const id = String(body.id ?? "");
    if (!id) return badRequest("缺少照片 id");

    const row = await db.prepare("SELECT src FROM photos WHERE id = ?").bind(id).first<{ src: string }>();
    if (!row) return notFound("没找到这张照片");

    const affected = await db
      .prepare("SELECT DISTINCT series_slug FROM series_photos WHERE photo_id = ?")
      .bind(id)
      .all<{ series_slug: string }>();

    // series_photos has ON DELETE CASCADE, so removing the photo clears memberships.
    await db.prepare("DELETE FROM photos WHERE id = ?").bind(id).run();
    await db.prepare("DELETE FROM series_photos WHERE photo_id = ?").bind(id).run();

    for (const { series_slug } of affected.results ?? []) {
      await db
        .prepare(
          "UPDATE series SET cover = (SELECT photo_id FROM series_photos WHERE series_slug = ? ORDER BY position LIMIT 1), " +
            "updated_at = datetime('now') WHERE slug = ? AND (cover = ? OR cover IS NULL)"
        )
        .bind(series_slug, series_slug, id)
        .run();
    }

    // Only remove the stored object for photos this site actually hosts.
    const key = row.src.startsWith("/photo/") ? row.src.slice("/photo/".length) : null;
    if (key) {
      try {
        await getBucket().delete(key);
      } catch {
        // The row is already gone; a leftover object is harmless.
      }
    }

    return json({ ok: true });
  } catch (err) {
    return serverError(err);
  }
};
