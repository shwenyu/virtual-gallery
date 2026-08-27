-- Schema for the gallery's D1 database.
--
-- Mirrors the shape the site already used in photos.json / series.json, with two
-- differences: a series' photo order is a real join table rather than an array,
-- and freeform frame coordinates hang off that join row. Everything the admin
-- edits lives here, so nothing has to be written back into git.

CREATE TABLE IF NOT EXISTS photos (
  id           TEXT PRIMARY KEY,
  src          TEXT NOT NULL,
  width        INTEGER NOT NULL,
  height       INTEGER NOT NULL,
  alt          TEXT NOT NULL DEFAULT '',
  caption      TEXT NOT NULL DEFAULT '',
  captured_at  TEXT,
  tags         TEXT NOT NULL DEFAULT '[]',   -- JSON array
  created_at   TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS series (
  slug              TEXT PRIMARY KEY,
  title             TEXT NOT NULL,
  subtitle          TEXT NOT NULL DEFAULT '',
  description       TEXT NOT NULL DEFAULT '',
  layout            TEXT NOT NULL DEFAULT 'grid',
  cover             TEXT,
  published         INTEGER NOT NULL DEFAULT 0,  -- 0/1
  flow_direction    TEXT,
  accent_color      TEXT,
  background_mode   TEXT NOT NULL DEFAULT 'site',
  custom_background TEXT,
  frame_style       TEXT NOT NULL DEFAULT 'square',
  canvas_ratio      TEXT NOT NULL DEFAULT '3 / 2',
  sort_index        INTEGER NOT NULL DEFAULT 0,
  updated_at        TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Ordered membership of photos in a series, plus freeform placement.
CREATE TABLE IF NOT EXISTS series_photos (
  series_slug TEXT NOT NULL REFERENCES series(slug) ON DELETE CASCADE,
  photo_id    TEXT NOT NULL REFERENCES photos(id)   ON DELETE CASCADE,
  position    INTEGER NOT NULL,
  x REAL, y REAL, w REAL, h REAL, z INTEGER,       -- freeform frame, NULL otherwise
  PRIMARY KEY (series_slug, photo_id)
);

CREATE INDEX IF NOT EXISTS idx_series_photos_order
  ON series_photos(series_slug, position);

CREATE INDEX IF NOT EXISTS idx_series_updated
  ON series(updated_at DESC);

-- Single-row table holding the admin password hash. Kept server-side so a new
-- browser or device does not start from scratch the way localStorage did.
CREATE TABLE IF NOT EXISTS admin_auth (
  id            INTEGER PRIMARY KEY CHECK (id = 1),
  password_hash TEXT NOT NULL,
  updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
);
