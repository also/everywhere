// Bring rows written by an older extractor up to the current version, without
// re-importing (file and recording IDs stay as they are).
//
//   node tools video-db-backfill [--db path] [--limit n]
//
// Version 4 → 5 added start_lat/start_lon and camera_local_start:
// - Garmin: camera_local_start from the header box bytes already in meta.
// - GoPro: start_lat/start_lon need the GPS lock position, which v4 didn't
//   keep, so the file is rescanned (moov and telemetry only) from one of its
//   locations. The fresh scan replaces meta.scan.
// Rows that can't be brought up (no readable location, size changed) are
// reported and left at their old version, so a rerun picks them up.
import fs from 'fs';
import path from 'path';
import { getConfig } from './config';
import { openDb, transaction } from './videodb/db';
import { FileReader, Scan, scanFile } from './videodb/mp4-scan';
import { garminInfo } from './videodb/garmin';
import { EXTRACTOR_VERSION, startPosition } from './video-db';

type Args = { db?: string; limit?: number };

type Row = {
  id: string;
  size: number;
  profile: string | null;
  kind: string;
  meta: string;
  extractor_version: number;
};

export default async function (argv: Args) {
  const dbPath =
    argv.db ?? path.join(getConfig().dataDir, 'video-explore.sqlite');
  const db = openDb(dbPath);
  console.log(`db: ${dbPath}`);

  const rows = db
    .prepare(
      'SELECT id, size, profile, kind, meta, extractor_version FROM file WHERE extractor_version < ? ORDER BY first_path'
    )
    .all(EXTRACTOR_VERSION) as Row[];
  const locations = db.prepare(
    'SELECT path FROM file_location WHERE file_id = ?'
  );
  const update = db.prepare(`
    UPDATE file SET start_lat = $start_lat, start_lon = $start_lon,
      camera_local_start = $camera_local_start, meta = $meta,
      extractor_version = $extractor_version
    WHERE id = $id`);

  const counts = { updated: 0, skipped: 0 };
  const byProfile = new Map<string, number>();
  const limit = argv.limit ?? Infinity;
  const started = Date.now();
  console.log(`${rows.length} rows below version ${EXTRACTOR_VERSION}`);

  for (const row of rows) {
    if (counts.updated >= limit) break;
    const meta = JSON.parse(row.meta);
    const profile = row.profile ?? '';
    let scan: Scan | undefined = meta.scan;
    let start_lat: number | null = null;
    let start_lon: number | null = null;
    let camera_local_start: string | null = null;

    if (row.kind === 'incomplete' || !scan) {
      // nothing to derive
    } else if (profile.startsWith('garmin-')) {
      camera_local_start = garminInfo(scan)?.headerLocal ?? null;
    } else if (profile.startsWith('gopro-')) {
      const paths = (locations.all(row.id) as { path: string }[])
        .map((l) => l.path)
        .filter((p) => fs.existsSync(p));
      if (!paths.length) {
        console.log(`skip  ${row.id}  no readable location`);
        counts.skipped++;
        continue;
      }
      const fd = fs.openSync(paths[0], 'r');
      try {
        scan = scanFile(new FileReader(fd));
      } finally {
        fs.closeSync(fd);
      }
      if (scan.size !== row.size) {
        console.log(
          `skip  ${row.id}  ${paths[0]} is ${scan.size} bytes, expected ${row.size}`
        );
        counts.skipped++;
        continue;
      }
      const pos = startPosition(scan, null);
      start_lat = pos?.lat ?? null;
      start_lon = pos?.lon ?? null;
      meta.scan = scan;
    } else {
      console.log(
        `skip  ${row.id}  no backfill for profile ${profile || '(none)'}`
      );
      counts.skipped++;
      continue;
    }

    transaction(db, () => {
      update.run({
        id: row.id,
        start_lat,
        start_lon,
        camera_local_start,
        meta: JSON.stringify(meta),
        extractor_version: EXTRACTOR_VERSION,
      });
    });
    counts.updated++;
    byProfile.set(profile, (byProfile.get(profile) ?? 0) + 1);
    if (counts.updated % 500 === 0) {
      console.log(
        `${counts.updated} updated (${((Date.now() - started) / 1000).toFixed(0)}s)`
      );
    }
  }

  console.log(
    `\n${counts.updated} updated, ${counts.skipped} skipped, ${(
      (Date.now() - started) /
      1000
    ).toFixed(1)}s`
  );
  console.table(Object.fromEntries(byProfile));
}
