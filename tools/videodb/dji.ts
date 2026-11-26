// DJI drone metadata. The MP4s carry little: a writer tag in udta/meta (©too),
// and on the Mavic 3 a djmd/dbgi protobuf track with camera settings but no
// GPS. Per-frame GPS is in the .SRT subtitle sidecar, when captions are on.
import fs from 'fs';
import path from 'path';
import { Scan } from './mp4-scan';

// the udta/meta ©too value: 'DJIMavic3', or FFmpeg's muxer ('Lavf56.15.102')
// on the Mavic Air and Mini 3 Pro
export function djiWriter(scan: Scan): string | null {
  return scan.udtaMeta['©too'] ?? null;
}

export type SrtSummary = {
  // 'framecnt': Mavic 3 ("FrameCnt: 1, DiffTime: 33ms", fnum 4.4)
  // 'srtcnt': Mini 3 Pro ("SrtCnt : 1, DiffTime : 33ms", fnum 170, dzoom)
  format: 'framecnt' | 'srtcnt' | null;
  entries: number;
  // end of the last entry, seconds
  durationS: number;
  // the first entry's timestamp: the drone's local wall time, no zone
  firstLocal: string | null;
  // the first entry with a position (latitude/longitude are 0 before a fix)
  firstFix: {
    local: string;
    lat: number;
    lon: number;
    relAlt: number | null;
    absAlt: number | null;
  } | null;
};

const TIMING =
  /(\d\d):(\d\d):(\d\d),(\d{3})\s*-->\s*(\d\d):(\d\d):(\d\d),(\d{3})/;
const STAMP = /(\d{4}-\d\d-\d\d) (\d\d:\d\d:\d\d(?:\.\d+)?)/;
const LAT = /\[latitude\s*:\s*(-?[\d.]+)\]/;
const LON = /\[longitude\s*:\s*(-?[\d.]+)\]/;
const ALT = /rel_alt\s*:\s*(-?[\d.]+)\s+abs_alt\s*:\s*(-?[\d.]+)/;

export function parseDjiSrt(text: string): SrtSummary {
  const summary: SrtSummary = {
    format: /FrameCnt\s*:/.test(text)
      ? 'framecnt'
      : /SrtCnt\s*:/.test(text)
        ? 'srtcnt'
        : null,
    entries: 0,
    durationS: 0,
    firstLocal: null,
    firstFix: null,
  };
  for (const block of text.split(/\r?\n\r?\n/)) {
    const t = TIMING.exec(block);
    if (!t) continue;
    summary.entries++;
    const end =
      Number(t[5]) * 3600 +
      Number(t[6]) * 60 +
      Number(t[7]) +
      Number(t[8]) / 1000;
    summary.durationS = Math.max(summary.durationS, end);
    const stamp = STAMP.exec(block);
    const local = stamp ? `${stamp[1]}T${stamp[2]}` : null;
    if (local && !summary.firstLocal) summary.firstLocal = local;
    if (!summary.firstFix && local) {
      const lat = Number(LAT.exec(block)?.[1] ?? 0);
      const lon = Number(LON.exec(block)?.[1] ?? 0);
      if (lat !== 0 || lon !== 0) {
        const alt = ALT.exec(block);
        summary.firstFix = {
          local,
          lat,
          lon,
          relAlt: alt ? Number(alt[1]) : null,
          absAlt: alt ? Number(alt[2]) : null,
        };
      }
    }
  }
  return summary;
}

// the .SRT next to a video, if any (same name, either case)
export function findSrtSidecar(videoPath: string): string | null {
  const dir = path.dirname(videoPath);
  const stem = path.basename(videoPath).replace(/\.[^.]*$/, '');
  for (const ext of ['.SRT', '.srt']) {
    const p = path.join(dir, stem + ext);
    if (fs.existsSync(p)) return p;
  }
  return null;
}

export function readSrtSummary(srtPath: string): SrtSummary {
  return parseDjiSrt(fs.readFileSync(srtPath, 'utf8'));
}
