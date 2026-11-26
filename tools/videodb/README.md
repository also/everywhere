# video-db

Builds a SQLite catalogue of camera footage: GoPro, Garmin Varia RCT715 and DJI drones. It gives every file a stable ID, groups chapters into recordings, links proxies (LRV, GLV, LRF) and sidecars (DJI SRT) to their chapters, and works out when and where each file starts.

It doubles as an exploration tool. It **stops on any file it doesn't fully understand**, such as an unknown camera, firmware or box layout, or a time that doesn't line up. Someone has to look at the file before the run goes on. The stops are the point: they are how the profiles and checks were built up, and they keep the database trustworthy.

## Running

```bash
nodenv install -s   # Node 24.21.0 from .node-version (node:sqlite)
npm install
node tools video-db --db /path/to/video.sqlite <dir-or-file>...
```

- `--db`: defaults to `<dataDir>/video-explore.sqlite`.
- `--limit n`: stop after n new files (useful for sampling a folder).
- `--files-from list.txt`: one path per line, instead of or as well as dirs.

Only video extensions are read (`.mp4 .lrv .glv .lrf .360 .mov .insv .m4v .srt`). Everything else is counted and skipped. Paths are stored as given (absolute), so mount the Synology `Media` share at `/Volumes/Media` on every machine that writes to the same database.

Runs can be resumed: any path already in `file_location` is skipped, so after a stop, fix the cause and rerun the same command. A network share is slow (about 0.3 s a file over SMB), so run large folders in the background and log the output.

There's no migration and no merge between databases. A new column means a rebuild (delete the database and rerun everything). Two databases can't be combined, because recording IDs are random. Keep **one** database per catalogue and do every import into it.

The exit code is 0 when the run finished and 2 when it stopped.

## When it stops

A stop prints `STOP <path>`, the list of problems, an `observed (profile-ready)` block (firmware, udta keys, moov position, track signature, GPMF model name, serial, Garmin and DJI info), the full scan and the context. Work out which case it is:

1. **A new camera model or firmware.** Add or extend a profile in `profiles.ts` (see below). The profile is the only place that knows about a camera.
2. **A one-off broken file of a known camera**, such as an interrupted recording, a missing telemetry track or doubled values. Add an entry to `accepted.ts` keyed by file ID, with a `match` substring of the problem and a reason. Its problems are then stored in the file's `meta` instead of stopping the run. Use this for a single file, never for a pattern.
3. **A wrong assumption in the design**, for example chapters of one recording not sharing the link key, or times that don't line up for a whole model. Don't paper over it. Look at several files, find out what the camera actually does, and change the profile semantics or the check. If the cause isn't clear, stop and ask a person.

Never widen a tolerance or loosen a check just to get past a stop without understanding why it fired. The checks have caught real mistakes, for example a wrong guess about what a HERO7's `mvhd` time means.

## Design rules

- **Newer cameras are the norm.** Defaults describe current cameras: `mvhd` is the whole recording's start, in UTC. Older models declare the exception (`mvhdTime: 'chapter'`, `mvhdClock: 'local'`). Don't let old footage steer the defaults.
- **Only add profile values you've seen in real files.** Firmware strings, udta keys and track signatures are exact lists. Add the observed value and don't generalise.
- **Profiles are ordered newest model first.**
- **The file ID never changes.** `file-id.ts` (v1) hashes the size plus the first and last 1 MiB. Changing it invalidates every stored ID; a new scheme would be `f2_`.
- **Bump `EXTRACTOR_VERSION`** in `video-db.ts` when extracted values change meaning.

## Adding a profile

Copy the closest existing profile and adjust it from the stop output, then check these points against several files, not just one:

- **`linkKey`**: the value every chapter of one recording shares, and no other recording shares. It differs by model:
  - HERO3+: MUID;
  - HERO5 and HERO7: GUMI;
  - HERO9, MAX and HERO11: MUID (GUMI changes per chapter on some HERO9 firmware);
  - HERO13: CPID in the udta GPMF, with `chapterKey: 'CPIN'`.

  Confirm it by importing a multi-chapter recording. The recording checks stop if chapters don't share the key, or if a key is shared by chapters that aren't back to back.

- **`mvhdTime`**: does `mvhd` creation time repeat across chapters (`recording`) or advance per chapter (`chapter`)? Compare chapter 1 and chapter 2 of one recording.
- **`mvhdClock`**: UTC or local? Compare `mvhd` with the GPS start (`start_utc`). An offset of a whole number of hours (or half hours) means local time. Settings or `TZON` also help.
- **`cameraKey`**: where the body's serial comes from:
  - `CAME` for udta CAME;
  - `MUID-prefix` for older GoPros;
  - `garmin-unit`;
  - `none` for drones.
- **`files`**: one rule per extension, with the name prefixes (`GX`, `GH`, `GOPR`/`GP`, `GL`, …), moov position and track signature.
- Models without a link key (Varia, DJI) pair their proxy and sidecar by directory and name (`pairBy: 'directory'`) or by name and `mvhd` time.

GoPro models still missing: HERO4, HERO6, HERO8, HERO10, HERO12, Session and Fusion. Drones still missing: the Mavic Pro. The filename parser (`parseCameraName`) already handles `GOPRnnnn`, `GPccnnnn`, `G[HXLS]ccnnnn`, `DJI_nnnn` and `GRM[NES]nnnn`. Other naming schemes need a case there.

## Files

- `../video-db.ts`: the walk, per-file checks, recording linking, the clock and time zone work, and the inserts.
- `file-id.ts`: file ID v1.
- `mp4-scan.ts`: reads boxes without reading the whole file (moov, udta, uuid), and handles GPMF KLV parsing, GPS9 and GPSU.
- `profiles.ts`: camera profiles and `checkFile`.
- `garmin.ts`: Varia header, model and unit boxes.
- `dji.ts`: DJI writer tag and SRT sidecar parsing.
- `accepted.ts`: per-file accepted problems.
- `db.ts`: schema.

## Useful queries

```sql
-- files per profile and kind
SELECT profile, kind, count(*) FROM file GROUP BY 1, 2;
-- recordings with their chapters
SELECT r.id, f.first_name, m.chapter_index
FROM recording r JOIN recording_member m ON m.recording_id = r.id
JOIN file f ON f.id = m.file_id ORDER BY r.id, m.chapter_index;
-- files whose camera clock was off
SELECT first_path, clock_drift_s FROM file WHERE clock_valid = 0;
```
