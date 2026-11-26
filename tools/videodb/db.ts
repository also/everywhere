// Exploration database. Close to the schema in the "Video file and recording
// IDs" spec, plus a few columns that only exist to help explore cameras.
import { DatabaseSync } from 'node:sqlite';

const SCHEMA = `
CREATE TABLE IF NOT EXISTS file (
  id                TEXT PRIMARY KEY,   -- f1_…
  size              INTEGER NOT NULL,
  sha256            TEXT,               -- whole file; null until computed
  kind              TEXT NOT NULL,      -- video | proxy | spherical
  first_name        TEXT NOT NULL,
  first_path        TEXT NOT NULL UNIQUE,
  first_seen_at     TEXT NOT NULL,
  mtime             TEXT,               -- earliest seen
  birthtime         TEXT,               -- earliest seen
  camera_name       TEXT,               -- e.g. GOPR0005
  profile           TEXT NOT NULL,
  camera_key        TEXT NOT NULL,
  firmware          TEXT,
  brand             TEXT,
  start_local       TEXT,               -- mvhd creation time, camera clock, no zone
  duration_s        REAL,
  start_utc         TEXT,               -- GPS time at file start (GPS9, else locked GPSU)
  gps_first_utc     TEXT,               -- first GPS time (GPS9, else GPSU), locked or not
  gps_first_fix     INTEGER,            -- its fix: 0 none, 2 2D, 3 3D
  clock_offset_s    REAL,               -- start_local − start_utc, as if local were UTC
  clock_valid       INTEGER,            -- 0 known-bad, 1 agrees with GPS, null unknown
  mtime_minus_end_s REAL,               -- mtime − (start_local + duration), as if local were UTC
  muid              TEXT,
  gumi              TEXT,
  video_codec       TEXT,
  width             INTEGER,
  height            INTEGER,
  fps               REAL,
  has_gpmf          INTEGER NOT NULL,
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
  link_key   TEXT UNIQUE,               -- gopro-gumi:… | gopro-muid:…
  camera_key TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS recording_member (
  file_id       TEXT PRIMARY KEY REFERENCES file(id),
  recording_id  TEXT NOT NULL REFERENCES recording(id),
  role          TEXT NOT NULL,          -- chapter | proxy
  chapter_index INTEGER,
  file_number   TEXT,
  evidence      TEXT NOT NULL           -- gumi | muid
);
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
  start_local: string | null;
  duration_s: number;
  gps_first_utc: string | null;
  gps_first_fix: number | null;
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
