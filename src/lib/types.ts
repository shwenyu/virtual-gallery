/** Shared shapes for gallery content. Kept free of any data-source imports so
 *  both the D1 queries and the components can depend on it. */

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
  /** Defaults to true when omitted — false shows a "curating" placeholder instead of the photos. */
  published?: boolean;
  /** Only used when layout is "flow": scroll direction for the immersive viewer. */
  flowDirection?: FlowDirection;
  /** A representative accent color for this series (hex), auto-extracted or hand-picked. */
  accentColor?: string;
  /** How the series page background is derived. Defaults to "site". */
  backgroundMode?: BackgroundMode;
  /** Only used when backgroundMode is "custom". */
  customBackground?: string;
  /** Photo corner treatment. Defaults to "square". */
  frameStyle?: FrameStyle;
  /** ISO timestamp of the last edit; orders the homepage. */
  updatedAt?: string;
}

export function isPublished(s: Series): boolean {
  return s.published !== false;
}

/** Resolves the CSS background a series page should use, or undefined for the site default. */
export function resolveSeriesBackground(s: Series): string | undefined {
  const mode = s.backgroundMode ?? "site";
  if (mode === "custom" && s.customBackground) return s.customBackground;
  if (mode === "accent" && s.accentColor) {
    return `color-mix(in srgb, ${s.accentColor} 14%, var(--bg-base) 86%)`;
  }
  return undefined;
}
