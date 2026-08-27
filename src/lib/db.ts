import { env } from "cloudflare:workers";
import type { Frame, Photo, Series } from "./types";

/**
 * D1 access for gallery content.
 *
 * Rows are mapped back into the same Photo/Series shapes the components already
 * expect, so the templates did not have to change when the data moved out of
 * JSON files. Every function takes the binding explicitly rather than reaching
 * for a module-level singleton — on Workers the binding only exists per request.
 */

type D1 = D1Database;

/**
 * The D1 binding for this request.
 *
 * Read from `cloudflare:workers` rather than `Astro.locals.runtime.env`, which
 * the adapter dropped in Astro v6. Throws something readable instead of a
 * "cannot read property of undefined" when the binding is missing — in practice
 * that means wrangler.toml lost its [[d1_databases]] entry.
 */
export function getDb(): D1 {
  const db = (env as Env).DB;
  if (!db) {
    throw new Error(
      "D1 binding `DB` is not available. Check the [[d1_databases]] entry in wrangler.toml."
    );
  }
  return db;
}

/** The R2 bucket holding photo originals. */
export function getBucket(): R2Bucket {
  const bucket = (env as Env).PHOTOS;
  if (!bucket) {
    throw new Error("R2 binding `PHOTOS` is not available. Check the [[r2_buckets]] entry in wrangler.toml.");
  }
  return bucket;
}

interface PhotoRow {
  id: string;
  src: string;
  width: number;
  height: number;
  alt: string;
  caption: string | null;
  captured_at: string | null;
  tags: string | null;
}

interface SeriesRow {
  slug: string;
  title: string;
  subtitle: string | null;
  description: string | null;
  layout: string;
  cover: string | null;
  published: number;
  flow_direction: string | null;
  accent_color: string | null;
  background_mode: string | null;
  custom_background: string | null;
  frame_style: string | null;
  canvas_ratio: string | null;
  updated_at: string | null;
}

interface MembershipRow {
  series_slug: string;
  photo_id: string;
  position: number;
  x: number | null;
  y: number | null;
  w: number | null;
  h: number | null;
  z: number | null;
}

function toPhoto(row: PhotoRow): Photo {
  let tags: string[] = [];
  try {
    tags = row.tags ? JSON.parse(row.tags) : [];
  } catch {
    tags = [];
  }
  return {
    id: row.id,
    src: row.src,
    width: row.width,
    height: row.height,
    alt: row.alt ?? "",
    caption: row.caption ?? "",
    capturedAt: row.captured_at ?? undefined,
    tags,
  };
}

function toSeries(row: SeriesRow, members: MembershipRow[]): Series {
  const mine = members
    .filter((m) => m.series_slug === row.slug)
    .sort((a, b) => a.position - b.position);

  const frames: Frame[] = mine
    .filter((m) => m.x !== null && m.y !== null && m.w !== null && m.h !== null)
    .map((m) => ({ id: m.photo_id, x: m.x!, y: m.y!, w: m.w!, h: m.h!, z: m.z ?? undefined }));

  return {
    slug: row.slug,
    title: row.title,
    subtitle: row.subtitle ?? "",
    description: row.description ?? "",
    layout: row.layout as Series["layout"],
    cover: row.cover ?? mine[0]?.photo_id ?? "",
    photoIds: mine.map((m) => m.photo_id),
    frames: frames.length ? frames : undefined,
    canvasRatio: row.canvas_ratio ?? "3 / 2",
    published: row.published === 1,
    flowDirection: (row.flow_direction as Series["flowDirection"]) ?? undefined,
    accentColor: row.accent_color ?? undefined,
    backgroundMode: (row.background_mode as Series["backgroundMode"]) ?? "site",
    customBackground: row.custom_background ?? undefined,
    frameStyle: (row.frame_style as Series["frameStyle"]) ?? "square",
    updatedAt: row.updated_at ?? undefined,
  };
}

export async function getAllPhotos(db: D1): Promise<Photo[]> {
  const { results } = await db
    .prepare("SELECT * FROM photos ORDER BY created_at DESC, id")
    .all<PhotoRow>();
  return (results ?? []).map(toPhoto);
}

export async function getPhoto(db: D1, id: string): Promise<Photo | undefined> {
  const row = await db.prepare("SELECT * FROM photos WHERE id = ?").bind(id).first<PhotoRow>();
  return row ? toPhoto(row) : undefined;
}

export async function getAllSeries(db: D1): Promise<Series[]> {
  const [seriesRes, memberRes] = await db.batch<any>([
    db.prepare("SELECT * FROM series ORDER BY sort_index, updated_at DESC"),
    db.prepare("SELECT * FROM series_photos"),
  ]);
  const rows = (seriesRes.results ?? []) as SeriesRow[];
  const members = (memberRes.results ?? []) as MembershipRow[];
  return rows.map((r) => toSeries(r, members));
}

export async function getSeriesBySlug(db: D1, slug: string): Promise<Series | undefined> {
  const row = await db.prepare("SELECT * FROM series WHERE slug = ?").bind(slug).first<SeriesRow>();
  if (!row) return undefined;
  const { results } = await db
    .prepare("SELECT * FROM series_photos WHERE series_slug = ?")
    .bind(slug)
    .all<MembershipRow>();
  return toSeries(row, results ?? []);
}

/** Photos of a series, in curated order. */
export async function getSeriesPhotos(db: D1, series: Series): Promise<Photo[]> {
  if (series.photoIds.length === 0) return [];
  const placeholders = series.photoIds.map(() => "?").join(",");
  const { results } = await db
    .prepare(`SELECT * FROM photos WHERE id IN (${placeholders})`)
    .bind(...series.photoIds)
    .all<PhotoRow>();
  const byId = new Map((results ?? []).map((r) => [r.id, toPhoto(r)]));
  return series.photoIds.map((id) => byId.get(id)).filter(Boolean) as Photo[];
}

export async function getSeriesCover(db: D1, series: Series): Promise<Photo | undefined> {
  if (!series.cover) return undefined;
  return getPhoto(db, series.cover);
}

/** Most recently updated series first, capped at `limit` — used by the homepage. */
export async function getRecentSeries(db: D1, limit = 3): Promise<Series[]> {
  const all = await getAllSeries(db);
  return [...all]
    .sort((a, b) => {
      const ta = a.updatedAt ? Date.parse(a.updatedAt) : NaN;
      const tb = b.updatedAt ? Date.parse(b.updatedAt) : NaN;
      const va = Number.isNaN(ta) ? -Infinity : ta;
      const vb = Number.isNaN(tb) ? -Infinity : tb;
      return vb - va;
    })
    .slice(0, limit);
}
