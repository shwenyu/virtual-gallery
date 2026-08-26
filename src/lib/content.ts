import photosData from "../data/photos.json";
import seriesData from "../data/series.json";

export interface Photo {
  id: string;
  src: string;
  width: number;
  height: number;
  alt: string;
  caption?: string;
  capturedAt?: string;
  tags?: string[];
}

export type SeriesLayout = "masonry" | "grid" | "editorial" | "freeform" | "flow";
export type FlowDirection = "horizontal" | "vertical";
export type BackgroundMode = "site" | "accent" | "custom";
export type FrameStyle = "square" | "rounded";

export interface Frame {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  z?: number;
}

export interface Series {
  slug: string;
  title: string;
  subtitle?: string;
  description?: string;
  layout: SeriesLayout;
  cover: string;
  photoIds: string[];
  /** Only used when layout is "freeform": percentage-based position/size per photo. */
  frames?: Frame[];
  /** Only used when layout is "freeform": aspect ratio of the canvas, e.g. "3 / 2". */
  canvasRatio?: string;
  /** Defaults to true when omitted — set to false to show a "curating" placeholder instead of the photos. */
  published?: boolean;
  /** Only used when layout is "flow": scroll direction for the immersive viewer. */
  flowDirection?: FlowDirection;
  /** A representative accent color for this series (hex), auto-extracted or hand-picked. */
  accentColor?: string;
  /** How the series page background is derived: site default, tinted with accentColor, or a custom color. Defaults to "site". */
  backgroundMode?: BackgroundMode;
  /** Only used when backgroundMode is "custom". */
  customBackground?: string;
  /** Photo corner treatment for this series. Defaults to "square". */
  frameStyle?: FrameStyle;
  /** ISO timestamp of the last edit, written by the admin. Used to order the homepage. */
  updatedAt?: string;
}

/**
 * Series for the homepage: most recently updated first, capped at `limit`.
 * Entries without a timestamp sort last but keep their file order, so a gallery
 * that predates this field still renders in a stable, sensible order.
 */
export function getRecentSeries(limit = 3): Series[] {
  return [...series]
    .map((s, i) => ({ s, i }))
    .sort((a, b) => {
      const ta = a.s.updatedAt ? Date.parse(a.s.updatedAt) : NaN;
      const tb = b.s.updatedAt ? Date.parse(b.s.updatedAt) : NaN;
      const va = Number.isNaN(ta) ? -Infinity : ta;
      const vb = Number.isNaN(tb) ? -Infinity : tb;
      if (va !== vb) return vb - va;
      return a.i - b.i;
    })
    .slice(0, limit)
    .map(({ s }) => s);
}

export function isPublished(s: Series): boolean {
  return s.published !== false;
}

/** Resolves the CSS background color a series page should use, or undefined for the site default. */
export function resolveSeriesBackground(s: Series): string | undefined {
  const mode = s.backgroundMode ?? "site";
  if (mode === "custom" && s.customBackground) return s.customBackground;
  if (mode === "accent" && s.accentColor) {
    // Mix against --bg-base, not --bg: this value is assigned to --bg, and a
    // self-reference would make the custom property invalid (background vanishes).
    return `color-mix(in srgb, ${s.accentColor} 14%, var(--bg-base) 86%)`;
  }
  return undefined;
}

const photos = photosData as Photo[];
const series = seriesData as Series[];

const photoById = new Map(photos.map((p) => [p.id, p]));

export function getAllPhotos(): Photo[] {
  return photos;
}

export function getAllSeries(): Series[] {
  return series;
}

export function getSeriesBySlug(slug: string): Series | undefined {
  return series.find((s) => s.slug === slug);
}

export function getPhoto(id: string): Photo | undefined {
  return photoById.get(id);
}

export function getSeriesPhotos(s: Series): Photo[] {
  return s.photoIds.map((id) => photoById.get(id)).filter(Boolean) as Photo[];
}

export function getSeriesCover(s: Series): Photo | undefined {
  return photoById.get(s.cover);
}
