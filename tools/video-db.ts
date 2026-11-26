// Explore camera files into a SQLite database.
//
//   node tools video-db [--db path] [--limit n] [--files-from list] <file or directory>...
//
// Each new file gets a file ID, a metadata scan, and checks against the camera
// profiles in tools/video/profiles.ts. The run stops at the first file that
// doesn't match expectations and prints what it found, so the file can be
// looked at and the profile extended (or the design questioned). Files already
// in the database (by path) are skipped, so a run can simply be repeated.
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { getConfig } from './config';
import {
  FileReader,
  Scan,
  ScanError,
  GpsInfo,
  gpsuFileStart,
  gpsuToIso,
  scanFile,
  trackSignature,
  udtaGpmfValue,
} from './videodb/mp4-scan';
import { fileIdV1 } from './videodb/file-id';
import {
  CameraName,
  FileRule,
  Profile,
  cameraKeyValue,
  checkFile,
  findProfile,
  linkKeyValue,
  mvhdClock,
  mvhdTime,
  parseCameraName,
} from './videodb/profiles';
import { garminInfo, isRecoveredClip } from './videodb/garmin';
import { MemberRow, openDb, transaction } from './videodb/db';
import { ACCEPTED } from './videodb/accepted';

const EXTRACTOR_VERSION = 4;
const VIDEO_EXT = new Set([
  '.mp4',
  '.lrv',
  '.glv',
  '.360',
  '.mov',
  '.insv',
  '.m4v',
]);
// chapters should follow each other to within this many seconds
const CONTIGUITY_S = 2;
// first GPS times of adjacent chapters should differ by the chapter's duration
// to within this many seconds
const GPS_CONTIGUITY_S = 3;
// GPS9 and GPSU file start times should agree to within this many seconds
const GPS_SOURCES_S = 2;

// GPS start of the file: GPS9 where the camera writes it (ms precision, a fix
// per row), else the first locked GPSU
function gpsStart(gps: GpsInfo | null): string | null {
  if (!gps) return null;
  return gps.gps9Lock?.fileStartUtc ?? gpsuFileStart(gps);
}

// the first GPS time and its fix, locked or not
function gpsFirst(gps: GpsInfo | null): {
  gps_first_utc: string | null;
  gps_first_fix: number | null;
} {
  if (gps?.gps9First) {
    return {
      gps_first_utc: gps.gps9First.utc,
      gps_first_fix: gps.gps9First.fix,
    };
  }
  return {
    gps_first_utc: gps?.firstGpsu ? gpsuToIso(gps.firstGpsu) : null,
    gps_first_fix: gps?.firstGpsf ?? null,
  };
}
// a proxy should be as long as its chapter to within this many seconds
const PROXY_DURATION_S = 0.5;
// a camera clock within this many seconds of GPS (after its zone) counts as set
const CLOCK_DRIFT_S = 15 * 60;

type Args = {
  _: (string | number)[];
  db?: string;
  limit?: number;
  'files-from'?: string;
};

function* walk(p: string, skipped: Map<string, number>): Generator<string> {
  const st = fs.statSync(p);
  if (!st.isDirectory()) {
    if (VIDEO_EXT.has(path.extname(p).toLowerCase())) yield p;
    else
      skipped.set(
        path.extname(p).toLowerCase(),
        (skipped.get(path.extname(p).toLowerCase()) ?? 0) + 1
      );
    return;
  }
  for (const name of fs.readdirSync(p).sort()) {
    if (name.startsWith('.')) continue;
    yield* walk(path.join(p, name), skipped);
  }
}

function uuidv7() {
  const b = crypto.randomBytes(16);
  b.writeUIntBE(Date.now(), 0, 6);
  b[6] = (b[6] & 0x0f) | 0x70;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = b.toString('hex');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

const localMs = (s: string | null | undefined) =>
  s ? Date.parse(s + 'Z') : NaN;
const minIso = (a: string | null, b: string | null) =>
  !a ? b : !b ? a : a < b ? a : b;

export default async function (argv: Args) {
  const dbPath =
    argv.db ?? path.join(getConfig().dataDir, 'video-explore.sqlite');
  const limit = argv.limit ?? Infinity;
  const db = openDb(dbPath);
  console.log(`db: ${dbPath}`);

  const q = {
    location: db.prepare('SELECT file_id FROM file_location WHERE path = ?'),
    file: db.prepare(
      'SELECT id, first_path, mtime, birthtime, camera_name FROM file WHERE id = ?'
    ),
    recording: db.prepare(
      'SELECT id, camera_key FROM recording WHERE link_key = ?'
    ),
    members: db.prepare(`
      SELECT m.file_id, m.role, m.chapter_index, m.file_number, f.first_path, f.camera_start, f.duration_s,
        f.start_utc
      FROM recording_member m JOIN file f ON f.id = m.file_id WHERE m.recording_id = ?`),
    // same camera, file number and role, adjacent chapter: should share a recording
    neighbours: db.prepare(`
      SELECT m.recording_id, m.chapter_index, f.first_path, f.camera_start, f.duration_s, f.start_utc
      FROM recording_member m JOIN file f ON f.id = m.file_id
      WHERE f.camera_key = ? AND m.file_number = ? AND m.role = ? AND m.chapter_index IN (?, ?)`),
    camera: db.prepare('SELECT key FROM camera WHERE key = ?'),
    // the other files sharing a pair key (a chapter and its proxy)
    pair: db.prepare(`
      SELECT f.id, f.first_path, f.duration_s, m.role, m.recording_id,
        json_extract(f.meta, '$.recovered') AS recovered
      FROM file f LEFT JOIN recording_member m ON m.file_id = f.id
      WHERE f.pair_key = ?`),
    insertRelation: db.prepare(
      'INSERT INTO file_relation (file_id, related_id, kind) VALUES (?, ?, ?)'
    ),
    insertFile: db.prepare(`
      INSERT INTO file (id, size, kind, first_name, first_path, first_seen_at, mtime, birthtime,
        camera_name, clip_type, profile, camera_key, pair_key, firmware, brand, camera_start, camera_clock, camera_start_utc, duration_s, start_utc, gps_first_utc, gps_first_fix,
        clock_offset_s, utc_offset_min, clock_drift_s, clock_valid, mtime_minus_end_s, muid, gumi, video_codec, width, height, fps, has_gpmf,
        meta, extractor_version)
      VALUES ($id, $size, $kind, $first_name, $first_path, $first_seen_at, $mtime, $birthtime,
        $camera_name, $clip_type, $profile, $camera_key, $pair_key, $firmware, $brand, $camera_start, $camera_clock, $camera_start_utc, $duration_s, $start_utc, $gps_first_utc, $gps_first_fix,
        $clock_offset_s, $utc_offset_min, $clock_drift_s, $clock_valid, $mtime_minus_end_s, $muid, $gumi, $video_codec, $width, $height, $fps, $has_gpmf,
        $meta, $extractor_version)`),
    insertLocation: db.prepare(
      'INSERT INTO file_location (path, file_id, mtime, birthtime, seen_at) VALUES (?, ?, ?, ?, ?)'
    ),
    updateFirstSeen: db.prepare(
      'UPDATE file SET mtime = ?, birthtime = ?, camera_name = ? WHERE id = ?'
    ),
    insertCamera: db.prepare(
      'INSERT INTO camera (key, profile, first_file_id) VALUES (?, ?, ?)'
    ),
    insertRecording: db.prepare(
      'INSERT INTO recording (id, link_key, camera_key) VALUES (?, ?, ?)'
    ),
    insertMember: db.prepare(`
      INSERT INTO recording_member (file_id, recording_id, role, chapter_index, file_number, evidence)
      VALUES (?, ?, ?, ?, ?, ?)`),
  };

  const skipped = new Map<string, number>();
  const counts = { added: 0, duplicate: 0, incomplete: 0, known: 0 };
  const started = Date.now();

  const inputs = argv._.map(String).filter(Boolean);
  if (argv['files-from']) {
    inputs.push(
      ...fs.readFileSync(argv['files-from'], 'utf8').split('\n').filter(Boolean)
    );
  }
  if (!inputs.length) {
    throw new Error(
      'usage: video-db [--db path] [--limit n] [--files-from list] <file or directory>...'
    );
  }

  for (const p of inputs) {
    for (const file of walk(path.resolve(p), skipped)) {
      if (counts.added + counts.duplicate >= limit) break;
      if (q.location.get(file)) {
        counts.known++;
        continue;
      }

      const t0 = Date.now();
      const basename = path.basename(file);
      const ext = path.extname(file).toLowerCase();
      const name = parseCameraName(basename);
      const fd = fs.openSync(file, 'r');
      try {
        const st = fs.fstatSync(fd);
        const mtime = st.mtime.toISOString();
        const birthtime = st.birthtime.toISOString();
        const now = new Date().toISOString();
        const r = new FileReader(fd);
        const id = fileIdV1(r);

        const existing = q.file.get(id) as
          | {
              first_path: string;
              mtime: string | null;
              birthtime: string | null;
              camera_name: string | null;
            }
          | undefined;
        if (existing) {
          transaction(db, () => {
            q.insertLocation.run(file, id, mtime, birthtime, now);
            q.updateFirstSeen.run(
              minIso(existing.mtime, mtime),
              minIso(existing.birthtime, birthtime),
              existing.camera_name ?? name?.cameraName ?? null,
              id
            );
          });
          counts.duplicate++;
          console.log(
            `dup  ${basename}  ${id}  same content as ${existing.first_path}`
          );
          continue;
        }

        let scan: Scan;
        try {
          scan = scanFile(r);
        } catch (e) {
          if (!(e instanceof ScanError)) throw e;
          return stop(file, [`scan failed: ${e.message}`], { id, mtime });
        }

        // a recording that never finished (no moov) or never started (no
        // video): keep the file and its ID, link it to nothing
        if (isIncomplete(scan)) {
          const { profile } = findProfile(scan);
          const cameraKey = profile ? cameraKeyValue(profile, scan) : null;
          transaction(db, () => {
            q.insertFile.run({
              ...emptyRow,
              id,
              size: scan.size,
              kind: 'incomplete',
              first_name: basename,
              first_path: file,
              first_seen_at: now,
              mtime,
              birthtime,
              camera_name: name?.cameraName ?? null,
              clip_type: name?.clipType ?? null,
              profile: profile?.id ?? null,
              camera_key: cameraKey,
              firmware: scan.udta.FIRM ?? null,
              brand: scan.ftyp?.major ?? null,
              camera_start: scan.mvhd?.created ?? null,
              duration_s: scan.mvhd?.durationS ?? null,
              has_gpmf: 0,
              meta: JSON.stringify({ name, stat: { mtime, birthtime }, scan }),
              extractor_version: EXTRACTOR_VERSION,
            });
            q.insertLocation.run(file, id, mtime, birthtime, now);
          });
          counts.incomplete++;
          console.log(
            `incomplete  ${basename}  ${id}  ${profile?.id ?? 'unknown camera'}  layout ${scan.layout.join(' ')}`
          );
          continue;
        }

        const { profile, rule, problems } = checkFile(scan, ext, name);
        let linkKey: string | null = null;
        let cameraKey: string | null = null;
        let pairKey: string | null = null;
        let rec: { id: string; camera_key: string } | undefined;
        let counterpart: PairRow | undefined;
        // Garmin clips cut off and recovered: MP4 and GLV end at different times
        const recovered = isRecoveredClip(scan);
        if (profile && rule && name) {
          cameraKey = cameraKeyValue(profile, scan);
          const self: ChapterTimes = {
            camera_start: scan.mvhd?.created ?? null,
            duration_s: scan.mvhd?.durationS ?? 0,
            start_utc: gpsStart(scan.gps),
          };
          if (profile.linkKey) {
            linkKey = `gopro-${profile.linkKey.toLowerCase()}:${linkKeyValue(profile, scan)}`;
            // a chapter and its proxy share the link key and chapter number
            pairKey = `${linkKey}#${name.chapter}`;
            rec = q.recording.get(linkKey) as typeof rec;
            if (rec) {
              const members = q.members.all(rec.id) as MemberRow[];
              problems.push(
                ...checkRecording(
                  rec,
                  members,
                  cameraKey,
                  profile,
                  rule,
                  name,
                  self
                )
              );
            }
            problems.push(
              ...checkNeighbours(
                q.neighbours,
                rec?.id,
                cameraKey,
                profile,
                rule,
                name,
                self
              )
            );
          } else {
            // no shared ID: pair by camera, name and mvhd time
            pairKey = `${cameraKey}:${name.cameraName}:${self.camera_start}`;
          }

          for (const other of q.pair.all(pairKey) as PairRow[]) {
            if (other.role === rule.role) {
              problems.push(
                `already have a ${rule.role} with this pair key, different content: ${other.first_path}`
              );
            } else {
              counterpart = other;
              if (
                !recovered &&
                !other.recovered &&
                Math.abs(other.duration_s - self.duration_s) >
                  (profile.proxyDurationS ?? PROXY_DURATION_S)
              ) {
                problems.push(
                  `duration ${self.duration_s}s differs from ${other.role} ${other.duration_s}s (${other.first_path})`
                );
              }
            }
          }
          // without a link key, a file joins its counterpart's recording
          if (!profile.linkKey && counterpart) {
            rec = { id: counterpart.recording_id, camera_key: cameraKey! };
          }
        }

        // GPS9 and GPSU should agree where a camera writes both
        const gps9Start = scan.gps?.gps9Lock?.fileStartUtc;
        const gpsuStart = scan.gps && gpsuFileStart(scan.gps);
        if (gps9Start && gpsuStart) {
          const diff = (Date.parse(gps9Start) - Date.parse(gpsuStart)) / 1000;
          if (Math.abs(diff) > GPS_SOURCES_S) {
            problems.push(
              `GPS9 start ${gps9Start} and GPSU start ${gpsuStart} differ by ${diff}s`
            );
          }
        }

        // problems already looked at and accepted for this file
        const acceptedProblems = problems.filter((p) =>
          ACCEPTED.some((a) => a.fileId === id && p.includes(a.match))
        );
        problems.splice(
          0,
          problems.length,
          ...problems.filter((p) => !acceptedProblems.includes(p))
        );
        for (const p of acceptedProblems)
          console.log(`  accepted for ${basename}: ${p}`);

        if (problems.length || !profile || !rule) {
          return stop(file, problems, {
            id,
            mtime,
            profile: profile?.id,
            name,
            linkKey,
            scan,
          });
        }

        const video = scan.tracks.find((t) => t.handler === 'vide');
        const cameraStart = scan.mvhd?.created ?? null;
        const clock = mvhdClock(profile);
        const durationS = scan.mvhd?.durationS ?? null;
        const startUtc = gpsStart(scan.gps);
        // mvhd is this file's own start: per-chapter cameras, or chapter 1
        const ownStart = mvhdTime(profile) === 'chapter' || name!.chapter === 1;
        // camera clock minus GPS, reading the camera time as if it were UTC
        const clockOffsetS =
          startUtc && cameraStart && ownStart
            ? (localMs(cameraStart) - Date.parse(startUtc)) / 1000
            : null;
        // the camera's zone. Local clocks: from GPS, to the nearest 30 min (so
        // up to 15 min of drift is unambiguous). UTC clocks: the udta GPMF TZON
        // (HERO11, HERO13), or the local time in the Garmin header (rounded).
        const tzon = udtaGpmfValue(scan, 'TZON');
        const garminLocal = garminInfo(scan)?.headerLocal;
        const utcOffsetMin =
          clock === 'local'
            ? clockOffsetS === null
              ? null
              : Math.round(clockOffsetS / 1800) * 30
            : typeof tzon === 'number'
              ? tzon
              : garminLocal && cameraStart
                ? Math.round(
                    (localMs(garminLocal) - localMs(cameraStart)) / 1800e3
                  ) * 30
                : null;
        const clockDriftS =
          clockOffsetS === null
            ? null
            : clock === 'local'
              ? clockOffsetS - utcOffsetMin! * 60
              : clockOffsetS;
        const clockValid =
          cameraStart &&
          (profile.resetDates ?? []).some((d) => cameraStart.startsWith(d))
            ? 0
            : clockDriftS === null
              ? null
              : Math.abs(clockDriftS) <= CLOCK_DRIFT_S &&
                  (clock === 'utc' || Math.abs(utcOffsetMin!) <= 14 * 60)
                ? 1
                : 0;
        // only meaningful when mvhd is this chapter's own start
        const mtimeMinusEnd =
          cameraStart && durationS !== null && ownStart
            ? (st.mtime.getTime() - localMs(cameraStart)) / 1000 - durationS
            : null;

        const newCamera = !q.camera.get(cameraKey!);
        const newRecording = !rec;
        const evidence = profile.linkKey
          ? profile.linkKey.toLowerCase()
          : counterpart
            ? 'pair'
            : 'none';
        const recordingId = rec?.id ?? `r_${uuidv7()}`;

        transaction(db, () => {
          q.insertFile.run({
            id,
            size: scan.size,
            kind: rule.kind,
            first_name: basename,
            first_path: file,
            first_seen_at: now,
            mtime,
            birthtime,
            camera_name: name!.cameraName,
            clip_type: name!.clipType ?? null,
            profile: profile.id,
            camera_key: cameraKey,
            pair_key: pairKey,
            firmware: scan.udta.FIRM ?? null,
            brand: scan.ftyp?.major ?? null,
            camera_start: cameraStart,
            camera_clock: clock,
            camera_start_utc:
              clock === 'utc' && cameraStart ? `${cameraStart}Z` : null,
            duration_s: durationS,
            start_utc: startUtc,
            ...gpsFirst(scan.gps),
            clock_offset_s: clockOffsetS,
            utc_offset_min: utcOffsetMin,
            clock_drift_s: clockDriftS,
            clock_valid: clockValid,
            mtime_minus_end_s: mtimeMinusEnd,
            muid: scan.udta.MUID ?? null,
            gumi: scan.udta.GUMI ?? null,
            video_codec: video?.format ?? null,
            width: video?.width ?? null,
            height: video?.height ?? null,
            fps: video?.fps ?? null,
            has_gpmf: scan.tracks.some((t) => t.format === 'gpmd') ? 1 : 0,
            meta: JSON.stringify({
              name,
              stat: { mtime, birthtime },
              acceptedProblems,
              recovered,
              scan,
            }),
            extractor_version: EXTRACTOR_VERSION,
          });
          q.insertLocation.run(file, id, mtime, birthtime, now);
          if (newCamera) q.insertCamera.run(cameraKey, profile.id, id);
          if (newRecording)
            q.insertRecording.run(recordingId, linkKey, cameraKey);
          q.insertMember.run(
            id,
            recordingId,
            rule.role,
            name!.chapter,
            name!.fileNumber,
            evidence
          );
          if (counterpart) {
            const [proxy, chapter] =
              rule.role === 'proxy'
                ? [id, counterpart.id]
                : [counterpart.id, id];
            q.insertRelation.run(proxy, chapter, 'proxy_of');
          }
        });
        counts.added++;

        const gps = scan.gps
          ? scan.gps.lockGpsu
            ? `gps ${startUtc}`
            : `gps no lock in ${scan.gps.samplesScanned}`
          : 'no gps';
        console.log(
          [
            'add ',
            basename,
            id,
            profile.id,
            `ch${name!.chapter}`,
            cameraStart,
            `${durationS?.toFixed(1)}s`,
            gps,
            newRecording ? 'new recording' : '',
            newCamera ? `NEW CAMERA ${cameraKey}` : '',
            `${Date.now() - t0}ms`,
          ]
            .filter(Boolean)
            .join('  ')
        );
      } finally {
        fs.closeSync(fd);
      }
    }
  }

  console.log(
    `\n${counts.added} added, ${counts.incomplete} incomplete, ${counts.duplicate} duplicate content, ` +
      `${counts.known} already in db, ` +
      `${((Date.now() - started) / 1000).toFixed(1)}s`
  );
  if (skipped.size) {
    console.log(
      `skipped by extension: ${[...skipped].map(([e, n]) => `${e || '(none)'} ${n}`).join(', ')}`
    );
  }
}

type PairRow = {
  id: string;
  first_path: string;
  duration_s: number;
  role: string;
  recording_id: string;
  recovered: number | null;
};

// a recording that never finished (no moov) or never started (no video)
function isIncomplete(scan: Scan) {
  return (
    !scan.mvhd ||
    scan.mvhd.durationS <= 0 ||
    !scan.tracks.some((t) => t.handler === 'vide')
  );
}

// every insertFile parameter, for rows that fill only some of them
const emptyRow = Object.fromEntries(
  [
    'camera_name',
    'clip_type',
    'profile',
    'camera_key',
    'pair_key',
    'firmware',
    'brand',
    'camera_start',
    'camera_clock',
    'camera_start_utc',
    'duration_s',
    'start_utc',
    'gps_first_utc',
    'gps_first_fix',
    'clock_offset_s',
    'utc_offset_min',
    'clock_drift_s',
    'clock_valid',
    'mtime_minus_end_s',
    'muid',
    'gumi',
    'video_codec',
    'width',
    'height',
    'fps',
  ].map((k) => [k, null])
) as Record<string, null>;

type ChapterTimes = {
  camera_start: string | null;
  duration_s: number;
  // locked GPS time moved back to the file's start; GPS time before a fix can
  // be minutes stale, and the GPS stream may only appear once locked
  start_utc: string | null;
};

// null when `next` follows `prev` with no gap, else what is wrong
function adjacencyProblem(
  mode: ReturnType<typeof mvhdTime>,
  prev: ChapterTimes,
  next: ChapterTimes
): string | null {
  if (mode === 'chapter') {
    const gap =
      localMs(next.camera_start) -
      (localMs(prev.camera_start) + prev.duration_s * 1000);
    return Math.abs(gap) <= CONTIGUITY_S * 1000
      ? null
      : `chapter starts ${gap / 1000}s after the previous one ends`;
  }
  // every chapter carries the recording's start time
  // to the second: HERO13 LRVs of one recording differ by 1s
  if (
    Math.abs(localMs(next.camera_start) - localMs(prev.camera_start)) > 1000
  ) {
    return `recording start differs between chapters: ${prev.camera_start} vs ${next.camera_start}`;
  }
  if (prev.start_utc && next.start_utc) {
    const gap =
      Date.parse(next.start_utc) -
      Date.parse(prev.start_utc) -
      prev.duration_s * 1000;
    if (Math.abs(gap) > GPS_CONTIGUITY_S * 1000) {
      return `GPS time says the chapter starts ${gap / 1000}s after the previous one ends`;
    }
  }
  return null;
}

function checkRecording(
  rec: { id: string; camera_key: string },
  members: MemberRow[],
  cameraKey: string | null,
  profile: Profile,
  rule: FileRule,
  name: CameraName,
  self: ChapterTimes
): string[] {
  const problems: string[] = [];
  if (rec.camera_key !== cameraKey) {
    problems.push(
      `link key matches recording ${rec.id} from a different camera ${rec.camera_key}`
    );
  }
  for (const m of members) {
    if (m.file_number !== name.fileNumber) {
      problems.push(
        `recording ${rec.id} has file number ${m.file_number} (${m.first_path})`
      );
    }
    if (m.role === rule.role && m.chapter_index === name.chapter) {
      problems.push(
        `recording already has ${rule.role} ${name.chapter} with different content: ${m.first_path}`
      );
    }
    if (m.role === rule.role && m.chapter_index === name.chapter - 1) {
      const p = adjacencyProblem(mvhdTime(profile), m, self);
      if (p) problems.push(`${p} (previous: ${m.first_path})`);
    }
    if (m.role === rule.role && m.chapter_index === name.chapter + 1) {
      const p = adjacencyProblem(mvhdTime(profile), self, m);
      if (p) problems.push(`${p} (next: ${m.first_path})`);
    }
  }
  return problems;
}

// A time-contiguous adjacent chapter in a different recording means the link
// key isn't shared across chapters for this camera.
function checkNeighbours(
  stmt: { all: (...args: unknown[]) => unknown[] },
  recordingId: string | undefined,
  cameraKey: string | null,
  profile: Profile,
  rule: FileRule,
  name: CameraName,
  self: ChapterTimes
): string[] {
  const rows = stmt.all(
    cameraKey,
    name.fileNumber,
    rule.role,
    name.chapter - 1,
    name.chapter + 1
  ) as (ChapterTimes & {
    recording_id: string;
    chapter_index: number;
    first_path: string;
  })[];
  // Any such sibling counts, contiguous or not: if both the link key and
  // mvhdTime were wrong for a camera, contiguity would fail too and chapters
  // would split silently. File numbers are rarely reused on one camera, so
  // false alarms should be rare and are worth a look anyway.
  return rows
    .filter((n) => n.recording_id !== recordingId)
    .map((n) => {
      const adjacency =
        n.chapter_index < name.chapter
          ? adjacencyProblem(mvhdTime(profile), n, self)
          : adjacencyProblem(mvhdTime(profile), self, n);
      return (
        `${rule.role} ${n.chapter_index} of the same camera and file number is in another recording ` +
        `${n.recording_id} (${adjacency ?? 'contiguous'}): link key not shared across chapters? (${n.first_path})`
      );
    });
}

function stop(
  file: string,
  problems: string[],
  context: Record<string, unknown>
) {
  const scan = context.scan as Scan | undefined;
  console.log(`\nSTOP  ${file}`);
  for (const p of problems) console.log(`  - ${p}`);
  if (scan) {
    console.log('\nobserved (profile-ready):');
    console.log(`  firmware:  ${JSON.stringify(scan.udta.FIRM ?? null)}`);
    console.log(`  udtaKeys:  ${JSON.stringify(scan.udtaKeys)}`);
    console.log(`  moov:      '${scan.moovPosition}'`);
    console.log(`  tracks:    ${JSON.stringify(trackSignature(scan))}`);
    console.log(
      `  minf:      ${JSON.stringify(udtaGpmfValue(scan, 'MINF') ?? null)}`
    );
    console.log(
      `  serial:    ${JSON.stringify(udtaGpmfValue(scan, 'CASN') ?? null)}`
    );
    console.log(`  gpmfKeys:  ${Object.keys(scan.udtaGpmf ?? {}).length}`);
    console.log(`  garmin:    ${JSON.stringify(garminInfo(scan))}`);
    console.log('\nscan:');
    const { tracks, ...rest } = scan;
    console.log(JSON.stringify(rest, null, 1));
    console.table(tracks);
  }
  const { scan: _scan, ...ctx } = context;
  console.log('context:', JSON.stringify(ctx));
  process.exitCode = 2;
}
