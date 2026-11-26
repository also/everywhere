// Exploration database. Close to the schema in the "Video file and recording
// IDs" spec, plus a few columns that only exist to help explore cameras.
import { DatabaseSync } from 'node:sqlite';

const SCHEMA = `
CREATE TABLE IF NOT EXISTS file (
  id                TEXT PRIMARY KEY,   -- f1_…
  size              INTEGER NOT NULL,
  sha256            TEXT,               -- whole file; null until computed
  kind              TEXT NOT NULL,      -- video | proxy | spherical | telemetry | incomplete
  first_name        TEXT NOT NULL,
  first_path        TEXT NOT NULL UNIQUE,
  first_seen_at     TEXT NOT NULL,
  mtime             TEXT,               -- earliest seen
  birthtime         TEXT,               -- earliest seen
  camera_name       TEXT,               -- e.g. GOPR0005
  clip_type         TEXT,               -- Garmin: loop | event | saved
  profile           TEXT,               -- null when the camera can't be told (no moov)
  camera_key        TEXT,
  pair_key          TEXT,               -- shared by a chapter and its proxy
  firmware          TEXT,
  brand             TEXT,
  camera_start      TEXT,               -- mvhd creation time as written, no zone
  camera_clock      TEXT,               -- utc | local: which clock camera_start is in
  camera_start_utc  TEXT,               -- camera_start as UTC, when camera_clock is utc
  duration_s        REAL,
  start_utc         TEXT,               -- GPS time at file start (GPS9, else locked GPSU)
  gps_first_utc     TEXT,               -- first GPS time (GPS9, else GPSU), locked or not
  gps_first_fix     INTEGER,            -- its fix: 0 none, 2 2D, 3 3D
  clock_offset_s    REAL,               -- camera_start − start_utc, reading camera_start as UTC
  utc_offset_min    INTEGER,            -- camera zone: from GPS (local clocks) or TZON (utc clocks)
  clock_drift_s     REAL,               -- clock_offset_s less the zone
  clock_valid       INTEGER,            -- 0 reset or off by > 15 min, 1 agrees with GPS, null unknown
  mtime_minus_end_s REAL,               -- mtime − (camera_start + duration), reading camera_start as UTC
  muid              TEXT,
  gumi              TEXT,
  video_codec       TEXT,
  width             INTEGER,
  height            INTEGER,
  fps               REAL,
  has_gpmf          INTEGER NOT NULL,
  start_lat         REAL,               -- where it started: GoPro GPS lock, DJI SRT first fix
  start_lon         REAL,
  camera_local_start TEXT,              -- local wall time the camera writes too (Garmin header, DJI SRT)
  meta              TEXT NOT NULL,      -- JSON: the full scan
  extractor_version INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS file_location (
  path      TEXT PRIMARY KEY,
  file_id   TEXT NOT NULL REFERENCES file(id),
  mtime     TEXT,
  birthtime TEXT,
  seen_at   TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS camera (
  key           TEXT PRIMARY KEY,
  profile       TEXT NOT NULL,
  first_file_id TEXT NOT NULL REFERENCES file(id)
);

CREATE TABLE IF NOT EXISTS recording (
  id         TEXT PRIMARY KEY,          -- r_<uuidv7>
  link_key   TEXT UNIQUE,               -- gopro-gumi:… | gopro-muid:… | gopro-cpid:…; null without one
  camera_key TEXT
);

CREATE TABLE IF NOT EXISTS recording_member (
  file_id       TEXT PRIMARY KEY REFERENCES file(id),
  recording_id  TEXT NOT NULL REFERENCES recording(id),
  role          TEXT NOT NULL,          -- chapter | proxy
  chapter_index INTEGER,
  file_number   TEXT,
  evidence      TEXT NOT NULL           -- gumi | muid | cpid | pair | none
);

CREATE TABLE IF NOT EXISTS file_relation (
  file_id    TEXT NOT NULL REFERENCES file(id),
  related_id TEXT NOT NULL REFERENCES file(id),
  kind       TEXT NOT NULL,             -- proxy_of | telemetry_of
  PRIMARY KEY (file_id, related_id, kind)
);

CREATE INDEX IF NOT EXISTS file_pair_key ON file (pair_key);
`;

export function openDb(path: string) {
  const db = new DatabaseSync(path);
  db.exec('PRAGMA foreign_keys = ON');
  db.exec(SCHEMA);
  return db;
}

export type MemberRow = {
  file_id: string;
  role: string;
  chapter_index: number;
  file_number: string;
  first_path: string;
  camera_start: string | null;
  duration_s: number;
  start_utc: string | null;
};

export function transaction<T>(db: DatabaseSync, fn: () => T): T {
  db.exec('BEGIN');
  try {
    const result = fn();
    db.exec('COMMIT');
    return result;
  } catch (e) {
    db.exec('ROLLBACK');
    throw e;
  }
}
