import type { APIRoute } from "astro";
import { getAllSeries, getDb } from "../../../lib/db";
import { badRequest, json, normalizeSlug, notFound, serverError } from "../../../lib/api";

export const prerender = false;

export const GET: APIRoute = async () => {
  try {
    return json({ series: await getAllSeries(getDb()) });
  } catch (err) {
    return serverError(err);
  }
};

/** Create a series. New ones start unpublished, showing the "curating" curtain. */
export const POST: APIRoute = async ({ request }) => {
  try {
    const db = getDb();
    const body = (await request.json()) as Record<string, unknown>;
    const slug = normalizeSlug(String(body.slug ?? ""));
    const title = String(body.title ?? "").trim();
    if (!slug) return badRequest("请填写 slug");
    if (!title) return badRequest("请填写标题");

    const clash = await db.prepare("SELECT 1 AS ok FROM series WHERE slug = ?").bind(slug).first();
    if (clash) return badRequest(`已存在同名 slug 的系列：${slug}`);

    const row = await db.prepare("SELECT COALESCE(MAX(sort_index), -1) + 1 AS next FROM series").first<{ next: number }>();

    await db
      .prepare(
        "INSERT INTO series (slug, title, subtitle, description, layout, published, sort_index, updated_at) " +
          "VALUES (?, ?, ?, ?, ?, 0, ?, datetime('now'))"
      )
      .bind(
        slug,
        title,
        String(body.subtitle ?? "").trim(),
        String(body.description ?? "").trim(),
        String(body.layout ?? "grid"),
        row?.next ?? 0
      )
      .run();

    return json({ ok: true, slug });
  } catch (err) {
    return serverError(err);
  }
};

/**
 * Update a series. `photoIds` rewrites the curated order, and `frames` carries
 * freeform coordinates; both are replaced wholesale so the stored order always
 * matches what the admin just saw.
 */
export const PATCH: APIRoute = async ({ request }) => {
  try {
    const db = getDb();
    const body = (await request.json()) as Record<string, any>;
    const slug = String(body.slug ?? "");
    if (!slug) return badRequest("缺少 slug");

    const existing = await db.prepare("SELECT 1 AS ok FROM series WHERE slug = ?").bind(slug).first();
    if (!existing) return notFound("没找到这个系列");

    const fields: Record<string, unknown> = {
      title: body.title !== undefined ? String(body.title).trim() : undefined,
      subtitle: body.subtitle !== undefined ? String(body.subtitle).trim() : undefined,
      description: body.description !== undefined ? String(body.description).trim() : undefined,
      layout: body.layout !== undefined ? String(body.layout) : undefined,
      cover: body.cover !== undefined ? String(body.cover) : undefined,
      published: body.published !== undefined ? (body.published ? 1 : 0) : undefined,
      flow_direction: body.flowDirection !== undefined ? body.flowDirection || null : undefined,
      accent_color: body.accentColor !== undefined ? body.accentColor || null : undefined,
      background_mode: body.backgroundMode !== undefined ? String(body.backgroundMode) : undefined,
      custom_background: body.customBackground !== undefined ? body.customBackground || null : undefined,
      frame_style: body.frameStyle !== undefined ? String(body.frameStyle) : undefined,
      canvas_ratio: body.canvasRatio !== undefined ? String(body.canvasRatio) : undefined,
    };

    const setParts: string[] = [];
    const values: unknown[] = [];
    for (const [column, value] of Object.entries(fields)) {
      if (value === undefined) continue;
      setParts.push(`${column} = ?`);
      values.push(value);
    }
    setParts.push("updated_at = datetime('now')");
    await db.prepare(`UPDATE series SET ${setParts.join(", ")} WHERE slug = ?`).bind(...values, slug).run();

    if (Array.isArray(body.photoIds)) {
      const frames = new Map<string, any>((body.frames ?? []).map((f: any) => [String(f.id), f]));
      const statements = [db.prepare("DELETE FROM series_photos WHERE series_slug = ?").bind(slug)];
      body.photoIds.forEach((rawId: unknown, position: number) => {
        const photoId = String(rawId);
        const f = frames.get(photoId);
        statements.push(
          db
            .prepare(
              "INSERT INTO series_photos (series_slug, photo_id, position, x, y, w, h, z) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
            )
            .bind(
              slug,
              photoId,
              position,
              f?.x ?? null,
              f?.y ?? null,
              f?.w ?? null,
              f?.h ?? null,
              f?.z ?? null
            )
        );
      });
      // One batch so the membership list is never left half-rewritten.
      await db.batch(statements);
    }

    return json({ ok: true });
  } catch (err) {
    return serverError(err);
  }
};

/** Delete a series. Photos themselves are untouched — only the grouping goes. */
export const DELETE: APIRoute = async ({ request }) => {
  try {
    const db = getDb();
    const body = (await request.json()) as { slug?: unknown };
    const slug = String(body.slug ?? "");
    if (!slug) return badRequest("缺少 slug");

    const existing = await db.prepare("SELECT 1 AS ok FROM series WHERE slug = ?").bind(slug).first();
    if (!existing) return notFound("没找到这个系列");

    await db.batch([
      db.prepare("DELETE FROM series_photos WHERE series_slug = ?").bind(slug),
      db.prepare("DELETE FROM series WHERE slug = ?").bind(slug),
    ]);

    return json({ ok: true });
  } catch (err) {
    return serverError(err);
  }
};
