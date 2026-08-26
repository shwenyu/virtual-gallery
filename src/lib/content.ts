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

export type SeriesLayout = "masonry" | "grid" | "editorial";

export interface Series {
  slug: string;
  title: string;
  subtitle?: string;
  description?: string;
  layout: SeriesLayout;
  cover: string;
  photoIds: string[];
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
