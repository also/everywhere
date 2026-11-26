// Camera profiles: what we expect a known camera's files to look like.
//
// The exploration tool stops on any file that doesn't match a profile, so a
// person can look at it and either extend a profile here or decide the file
// breaks an assumption of the ID/database design. Only add values that have
// been checked against real files. Newest models first.
import { Scan, trackSignature, udtaGpmfValue } from './mp4-scan';
import { garminInfo } from './garmin';
import { djiWriter, SrtSummary } from './dji';

export type FileRule = {
  // chapter: part of a recording; proxy: low-res copy of a chapter (LRV);
  // sidecar: data about a chapter in a file of its own (DJI .SRT)
  role: 'chapter' | 'proxy' | 'sidecar';
  kind: 'video' | 'proxy' | 'spherical' | 'telemetry';
  // camera_name prefixes allowed for this extension
  prefixes: string[];
  // where moov may sit (Varia loop clips: before their padding)
  moov: ('start' | 'end' | 'middle')[];
  // accepted track signatures (see trackSignature)
  tracks: string[];
};

export type Profile = {
  id: string;
  model: string;
  // GoPro: exact udta FIRM values seen and accepted
  firmware: string[];
  // Garmin: model name in the GarminModel uuid box
  garminModel?: string;
  // DJI: the udta/meta ©too writer tag. 'Lavf…' (FFmpeg's muxer) is shared by
  // several drones, which are told apart by udta keys and their SRT sidecar.
  djiWriter?: string;
  // DJI: the SRT sidecar layouts a video may have ('none': no SRT)
  srt?: ('framecnt' | 'srtcnt' | 'none')[];
  // udta children in file order, 'free' excluded
  udtaKeys: string[];
  // udta children that may be missing (e.g. ©xyz needs a GPS fix at start)
  udtaOptional?: string[];
  // the value shared by every chapter of a recording: a udta child (GUMI,
  // MUID) or a udta GPMF key (CPID)
  linkKey?: 'GUMI' | 'MUID' | 'CPID';
  // udta GPMF key holding the 1-based chapter number, checked against the name
  chapterKey?: 'CPIN';
  // where the camera body's identity comes from
  // ('none': the files carry no camera serial, e.g. DJI drones)
  cameraKey: 'CAME' | 'MUID-prefix' | 'garmin-unit' | 'none';
  // without a link key, how a chapter finds its proxy and sidecar: by camera,
  // name and mvhd time (default), or by folder and name (cameras with no
  // serial or no mvhd time)
  pairBy?: 'name-time' | 'directory';
  // expects a GPMF telemetry (gpmd) track
  gpmf: boolean;
  // model name in the udta GPMF (DEVC/MINF), for cameras that write one
  minf?: string;
  // Newer cameras are the norm: these default to what they do, and older
  // models declare the exception.
  //
  // What mvhd creation time means. Default 'recording': the whole recording's
  // start, repeated in every chapter (HERO9 and later). 'chapter': each
  // chapter's own start (HERO7 and earlier).
  mvhdTime?: 'recording' | 'chapter';
  // Which clock mvhd times are in. Default 'utc': the camera's idea of UTC
  // (HERO11 and later). 'local': the camera's local time with no zone (HERO9
  // and earlier).
  mvhdClock?: 'utc' | 'local';
  // camera_start prefixes the clock falls back to after a reset
  resetDates?: string[];
  // Garmin: the GarminGPS box must be present with no records, or be replaced
  // by an empty text track (a few RCT715 clips). None has had data so far;
  // records or text samples would need a decoder and a look.
  garminGps?: 'empty';
  // how far a proxy's duration may differ from its chapter's (default 0.5s)
  proxyDurationS?: number;
  files: Record<string, FileRule>;
};

export const mvhdTime = (p: Profile) => p.mvhdTime ?? 'recording';
export const mvhdClock = (p: Profile) => p.mvhdClock ?? 'utc';

export const PROFILES: Profile[] = [
  {
    id: 'garmin-varia-rct715',
    model: 'Garmin Varia RCT715',
    firmware: [],
    garminModel: 'RCT715',
    // ExifTool's GarminModel uuid (model + unit ID)
    udtaKeys: ['AMBA', 'uuid'],
    // no chapters and no shared ID: each clip is its own recording, and its
    // GLV pairs with it by camera, name and mvhd time
    cameraKey: 'garmin-unit',
    gpmf: false,
    resetDates: ['2021-02-02'],
    garminGps: 'empty',
    // a clip cut short when recording stops (e.g. 7.3s) can end 0.5s earlier
    // in its GLV
    proxyDurationS: 1,
    files: {
      // GRMN = loop (103UNSVD), GRME = incident (100EVENT), GRMS = saved
      // (102SAVED). Loop clips are preallocated (80 MiB) with moov before the
      // padding.
      '.mp4': {
        role: 'chapter',
        kind: 'video',
        prefixes: ['GRMN', 'GRME', 'GRMS'],
        moov: ['middle', 'end'],
        tracks: ['vide:avc1 soun:sowt', 'vide:avc1 soun:sowt text:text'],
      },
      // 640x368 copy, like a GoPro LRV
      '.glv': {
        role: 'proxy',
        kind: 'proxy',
        prefixes: ['GRMN', 'GRME', 'GRMS'],
        moov: ['middle', 'end'],
        tracks: ['vide:avc1 soun:sowt', 'vide:avc1 soun:sowt text:text'],
      },
    },
  },
  {
    id: 'dji-mini-3-pro',
    model: 'DJI Mini 3 Pro',
    firmware: [],
    // FFmpeg's muxer, as on the Mavic Air; told apart by the Xtra box and the
    // SRT layout. Photos say FC3582 "Mini 3 Pro" (2023); the 2024 and 2026
    // footage matches only by SRT layout.
    djiWriter: 'Lavf56.15.102',
    srt: ['srtcnt'],
    udtaKeys: ['meta', 'Xtra'],
    cameraKey: 'none',
    pairBy: 'directory',
    gpmf: false,
    files: {
      '.mp4': {
        role: 'chapter',
        kind: 'video',
        prefixes: ['DJI_'],
        moov: ['end'],
        tracks: ['vide:avc1'],
      },
      // per-frame position, altitude and camera settings; local time
      '.srt': {
        role: 'sidecar',
        kind: 'telemetry',
        prefixes: ['DJI_'],
        moov: [],
        tracks: [],
      },
    },
  },
  {
    id: 'dji-mavic-3',
    model: 'DJI Mavic 3',
    firmware: [],
    djiWriter: 'DJIMavic3',
    // captions were off for a few videos
    srt: ['framecnt', 'none'],
    // ©dji: 4 bytes, different per file. meta holds ©too and JPEG thumbnails.
    udtaKeys: ['©dji', 'meta', 'Xtra'],
    cameraKey: 'none',
    pairBy: 'directory',
    gpmf: false,
    files: {
      // djmd: DJI protobuf (dvtm_wm260.proto) with camera settings per frame
      // but no GPS; dbgi: ~5 KB of sensor debug data per frame
      '.mp4': {
        role: 'chapter',
        kind: 'video',
        prefixes: ['DJI_'],
        moov: ['end'],
        tracks: ['vide:avc1 meta:djmd meta:dbgi'],
      },
      '.lrf': {
        role: 'proxy',
        kind: 'proxy',
        prefixes: ['DJI_'],
        moov: ['end'],
        // video only: no djmd/dbgi
        tracks: ['vide:avc1'],
      },
      '.srt': {
        role: 'sidecar',
        kind: 'telemetry',
        prefixes: ['DJI_'],
        moov: [],
        tracks: [],
      },
    },
  },
  {
    id: 'dji-mavic-air',
    model: 'DJI Mavic Air',
    firmware: [],
    // photos say FC2103. No SRT captions, and mvhd has no creation time: only
    // mtime dates these. GPS is in the DJI GO flight records.
    djiWriter: 'Lavf56.15.102',
    srt: ['none'],
    udtaKeys: ['meta'],
    cameraKey: 'none',
    pairBy: 'directory',
    gpmf: false,
    files: {
      '.mp4': {
        role: 'chapter',
        kind: 'video',
        prefixes: ['DJI_'],
        moov: ['end'],
        tracks: ['vide:avc1'],
      },
    },
  },
  {
    id: 'gopro-hero13-black',
    model: 'GoPro HERO13 Black',
    firmware: ['H24.01.02.10.00'],
    udtaKeys: [
      '©xyz',
      'FIRM',
      'LENS',
      'CAME',
      'SETT',
      'MUID',
      'HMMT',
      'BCID',
      'GUMI',
      'GPMF',
    ],
    udtaOptional: ['©xyz'],
    // udta MUID is CAME + zeros and GUMI is empty; the udta GPMF has CPID
    // (shared by chapters) and CPIN (chapter number). LENS is a placeholder.
    linkKey: 'CPID',
    chapterKey: 'CPIN',
    cameraKey: 'CAME',
    gpmf: true,
    minf: 'HERO13 Black',
    files: {
      // telemetry has GPS9 only (no GPSU)
      '.mp4': {
        role: 'chapter',
        kind: 'video',
        prefixes: ['GX'],
        moov: ['end'],
        tracks: ['vide:hvc1 soun:mp4a tmcd:tmcd meta:gpmd'],
      },
      '.lrv': {
        role: 'proxy',
        kind: 'proxy',
        prefixes: ['GL'],
        moov: ['end'],
        tracks: ['vide:hvc1 soun:mp4a tmcd:tmcd meta:gpmd'],
      },
    },
  },
  {
    id: 'gopro-hero11-black',
    model: 'GoPro HERO11 Black',
    firmware: ['H22.01.02.10.00', 'H22.01.02.30.00'],
    udtaKeys: [
      '©xyz',
      'FIRM',
      'LENS',
      'CAME',
      'SETT',
      'MUID',
      'HMMT',
      'BCID',
      'GUMI',
      'GPMF',
    ],
    udtaOptional: ['©xyz'],
    // GUMI is present but empty
    linkKey: 'MUID',
    cameraKey: 'CAME',
    resetDates: ['2016-01-01'],
    gpmf: true,
    minf: 'HERO11 Black',
    files: {
      // no fdsc track; telemetry has both GPS5 and GPS9
      '.mp4': {
        role: 'chapter',
        kind: 'video',
        prefixes: ['GX'],
        moov: ['end'],
        tracks: ['vide:hvc1 soun:mp4a tmcd:tmcd meta:gpmd'],
      },
      '.lrv': {
        role: 'proxy',
        kind: 'proxy',
        prefixes: ['GL'],
        moov: ['end'],
        tracks: ['vide:avc1 soun:mp4a tmcd:tmcd meta:gpmd'],
      },
    },
  },
  {
    id: 'gopro-max',
    model: 'GoPro MAX',
    firmware: ['H19.03.02.00.00'],
    udtaKeys: [
      '©xyz',
      'FIRM',
      'LENS',
      'CAME',
      'SETT',
      'MUID',
      'HMMT',
      'BCID',
      'GUMI',
      'GPMF',
    ],
    udtaOptional: ['©xyz'],
    // unverified guesses (HERO9-like); the neighbour check catches a wrong guess
    linkKey: 'MUID',
    cameraKey: 'CAME',
    gpmf: true,
    mvhdClock: 'local',
    minf: 'GoPro Max',
    files: {
      // two HEVC tracks (one per lens) and a second audio track (ambisonic?)
      '.360': {
        role: 'chapter',
        kind: 'spherical',
        prefixes: ['GS'],
        moov: ['end'],
        tracks: [
          'vide:hvc1 soun:mp4a tmcd:tmcd meta:gpmd meta:fdsc vide:hvc1 soun:in32',
        ],
      },
      // a single H.264 track
      '.lrv': {
        role: 'proxy',
        kind: 'proxy',
        prefixes: ['GS'],
        moov: ['end'],
        tracks: ['vide:avc1 soun:mp4a tmcd:tmcd meta:gpmd meta:fdsc'],
      },
    },
  },
  {
    id: 'gopro-hero9-black',
    model: 'GoPro HERO9 Black',
    firmware: [
      'HD9.01.01.22.00',
      'HD9.01.01.52.00',
      'HD9.01.01.60.00',
      'HD9.01.01.72.00',
    ],
    udtaKeys: [
      '©xyz',
      'FIRM',
      'LENS',
      'CAME',
      'SETT',
      'MUID',
      'HMMT',
      'BCID',
      'GUMI',
      'GPMF',
    ],
    udtaOptional: ['©xyz'],
    // GUMI differs per chapter on HD9.01.01.52.00 (same on .22); MUID is
    // shared on both
    linkKey: 'MUID',
    cameraKey: 'CAME',
    resetDates: ['2016-01-01'],
    gpmf: true,
    mvhdClock: 'local',
    minf: 'HERO9 Black',
    files: {
      // GH = H.264, GX = HEVC
      '.mp4': {
        role: 'chapter',
        kind: 'video',
        prefixes: ['GH', 'GX'],
        moov: ['end'],
        tracks: [
          'vide:avc1 soun:mp4a tmcd:tmcd meta:gpmd meta:fdsc',
          'vide:hvc1 soun:mp4a tmcd:tmcd meta:gpmd meta:fdsc',
        ],
      },
      '.lrv': {
        role: 'proxy',
        kind: 'proxy',
        prefixes: ['GL'],
        moov: ['end'],
        tracks: ['vide:avc1 soun:mp4a tmcd:tmcd meta:gpmd meta:fdsc'],
      },
    },
  },
  {
    id: 'gopro-hero7-black',
    model: 'GoPro HERO7 Black',
    firmware: ['HD7.01.01.61.00', 'HD7.01.01.90.00'],
    udtaKeys: [
      '©xyz',
      'FIRM',
      'LENS',
      'CAME',
      'SETT',
      'MUID',
      'HMMT',
      'BCID',
      'GUMI',
      'GPMF',
    ],
    udtaOptional: ['©xyz'],
    linkKey: 'GUMI',
    cameraKey: 'CAME',
    gpmf: true,
    mvhdTime: 'chapter',
    mvhdClock: 'local',
    minf: 'HERO7 Black',
    files: {
      '.mp4': {
        role: 'chapter',
        kind: 'video',
        prefixes: ['GH'],
        moov: ['end'],
        tracks: ['vide:avc1 soun:mp4a tmcd:tmcd meta:gpmd meta:fdsc'],
      },
      '.lrv': {
        role: 'proxy',
        kind: 'proxy',
        prefixes: ['GL'],
        moov: ['end'],
        tracks: ['vide:avc1 soun:mp4a tmcd:tmcd meta:gpmd meta:fdsc'],
      },
    },
  },
  {
    id: 'gopro-hero5-black',
    model: 'GoPro HERO5 Black',
    firmware: ['HD5.02.02.51.00', 'HD5.02.02.60.00'],
    udtaKeys: [
      '©xyz',
      'FIRM',
      'LENS',
      'CAME',
      'SETT',
      'AMBA',
      'MUID',
      'HMMT',
      'BCID',
      'GUMI',
    ],
    udtaOptional: ['©xyz'],
    linkKey: 'GUMI',
    cameraKey: 'CAME',
    resetDates: ['2015-01-01'],
    gpmf: true,
    mvhdTime: 'chapter',
    mvhdClock: 'local',
    files: {
      '.mp4': {
        role: 'chapter',
        kind: 'video',
        prefixes: ['GOPR', 'GP'],
        moov: ['end'],
        tracks: ['vide:avc1 soun:mp4a tmcd:tmcd meta:gpmd meta:fdsc'],
      },
      '.lrv': {
        role: 'proxy',
        kind: 'proxy',
        prefixes: ['GOPR', 'GP'],
        moov: ['end'],
        tracks: ['vide:avc1 soun:mp4a tmcd:tmcd meta:gpmd meta:fdsc'],
      },
    },
  },
  {
    id: 'gopro-hero3plus',
    model: 'GoPro HERO3+',
    // HD3.11.03.03: a second body (CAME "H3B+603150b7669"), same layout
    firmware: ['HD3.11.03.00', 'HD3.11.03.03'],
    udtaKeys: ['FIRM', 'LENS', 'CAME', 'SETT', 'MUID', 'AMBA'],
    linkKey: 'MUID',
    cameraKey: 'MUID-prefix',
    gpmf: false,
    mvhdTime: 'chapter',
    // no GPS to check against; mtime offsets match the other local-clock cameras
    mvhdClock: 'local',
    files: {
      '.mp4': {
        role: 'chapter',
        kind: 'video',
        prefixes: ['GOPR', 'GP'],
        moov: ['start'],
        // no timecode track in 4K15 and 720p120 (all 8 such files); every
        // 240p, 1080p and 2.7K file has one
        tracks: ['vide:avc1 soun:mp4a tmcd:tmcd', 'vide:avc1 soun:mp4a'],
      },
    },
  },
  {
    // Early HERO3+ firmware writes no MUID and an empty CAME: there's no link
    // key and no camera serial. Each file is its own recording and an LRV
    // pairs with its MP4 by name and mvhd time. Only first chapters (GOPR)
    // have been seen; a GPnn chapter would need a way to link it, so it stops.
    id: 'gopro-hero3plus-no-muid',
    model: 'GoPro HERO3+',
    firmware: ['HD3.11.01.04'],
    udtaKeys: ['FIRM', 'LENS', 'CAME', 'SETT', 'AMBA'],
    cameraKey: 'none',
    pairBy: 'name-time',
    gpmf: false,
    mvhdTime: 'chapter',
    // mtime is mvhd + duration + 5 h in every file (Feb/Mar and May 2014)
    mvhdClock: 'local',
    files: {
      '.mp4': {
        role: 'chapter',
        kind: 'video',
        prefixes: ['GOPR'],
        moov: ['start'],
        tracks: ['vide:avc1 soun:mp4a tmcd:tmcd'],
      },
      // same mvhd time and duration as the MP4
      '.lrv': {
        role: 'proxy',
        kind: 'proxy',
        prefixes: ['GOPR'],
        moov: ['start'],
        tracks: ['vide:avc1 soun:mp4a tmcd:tmcd'],
      },
    },
  },
];

export type CameraName = {
  cameraName: string;
  prefix: string;
  // 1-based chapter
  chapter: number;
  fileNumber: string;
  // Garmin: loop | event | saved
  clipType?: string;
};

const GARMIN_CLIP: Record<string, string> = {
  N: 'loop',
  E: 'event',
  S: 'saved',
};

// HERO3–HERO5: GOPRnnnn (chapter 1), GPccnnnn (chapter cc + 1)
// HERO6+:      G[HXLS]ccnnnn (chapter cc)
export function parseCameraName(basename: string): CameraName | null {
  const stem = basename.replace(/\.[^.]*$/, '');
  // DJI drones: DJI_nnnn
  const d = /^DJI_(\d{4})$/.exec(stem);
  if (d)
    return { cameraName: stem, prefix: 'DJI_', chapter: 1, fileNumber: d[1] };
  // Garmin Varia: GRM[NES]nnnn
  const g = /^GRM([NES])(\d{4})$/.exec(stem);
  if (g)
    return {
      cameraName: stem,
      prefix: stem.slice(0, 4),
      chapter: 1,
      fileNumber: g[2],
      clipType: GARMIN_CLIP[g[1]],
    };
  let m = /^GOPR(\d{4})$/.exec(stem);
  if (m)
    return { cameraName: stem, prefix: 'GOPR', chapter: 1, fileNumber: m[1] };
  m = /^GP(\d{2})(\d{4})$/.exec(stem);
  if (m)
    return {
      cameraName: stem,
      prefix: 'GP',
      chapter: Number(m[1]) + 1,
      fileNumber: m[2],
    };
  m = /^(G[HXLS])(\d{2})(\d{4})$/.exec(stem);
  if (m)
    return {
      cameraName: stem,
      prefix: m[1],
      chapter: Number(m[2]),
      fileNumber: m[3],
    };
  return null;
}

// what we know about a file from outside it
export type Hints = {
  // the DJI SRT sidecar next to it, if any
  srt?: SrtSummary | null;
};

export function findProfile(scan: Scan, hints: Hints = {}) {
  const writer = djiWriter(scan);
  if (writer && !scan.udta.FIRM && !garminInfo(scan)) {
    const srt = hints.srt ? (hints.srt.format ?? 'unknown') : 'none';
    return {
      profile: PROFILES.find(
        (p) =>
          p.djiWriter === writer &&
          p.udtaKeys.join(',') === scan.udtaKeys.join(',') &&
          (p.srt ?? []).includes(srt as 'framecnt' | 'srtcnt' | 'none')
      ),
      family: undefined,
    };
  }
  const garmin = garminInfo(scan)?.model;
  if (garmin) {
    return {
      profile: PROFILES.find((p) => p.garminModel === garmin),
      family: undefined,
    };
  }
  const firmware = scan.udta.FIRM;
  if (!firmware) return { profile: undefined, family: undefined };
  const profile = PROFILES.find((p) => p.firmware.includes(firmware));
  // same model, different firmware version: e.g. HD5.02.x
  const family = profile
    ? undefined
    : PROFILES.find((p) =>
        p.firmware.some((f) => f.slice(0, 6) === firmware.slice(0, 6))
      );
  return { profile, family };
}

const isZero = (hex: string | undefined) => !hex || /^0*$/.test(hex);

export function linkKeyValue(profile: Profile, scan: Scan) {
  if (!profile.linkKey) return null;
  if (profile.linkKey === 'CPID') {
    const v = udtaGpmfValue(scan, 'CPID');
    if (!Array.isArray(v)) return null;
    const hex = v
      .map((n: number) => (n >>> 0).toString(16).padStart(8, '0'))
      .join('');
    return isZero(hex) ? null : hex;
  }
  const v = scan.udta[profile.linkKey];
  return isZero(v) ? null : v;
}

export function cameraKeyValue(profile: Profile, scan: Scan) {
  if (profile.cameraKey === 'none') return null;
  if (profile.cameraKey === 'garmin-unit') {
    const unit = garminInfo(scan)?.unitId;
    return unit ? `garmin:${unit}` : null;
  }
  const v =
    profile.cameraKey === 'CAME'
      ? scan.udta.CAME
      : scan.udta.MUID?.slice(0, 32);
  return isZero(v) ? null : v;
}

// checks that need only the file itself
export function checkFile(
  scan: Scan,
  ext: string,
  name: CameraName | null,
  hints: Hints = {}
): { profile?: Profile; rule?: FileRule; problems: string[] } {
  const problems: string[] = [];
  const firmware = scan.udta.FIRM;
  const garmin = garminInfo(scan);
  const writer = djiWriter(scan);
  if (!firmware && !garmin?.model && !writer) {
    problems.push(
      `unknown camera: no udta FIRM, Garmin model or writer tag (udta keys: ${scan.udtaKeys.join(',') || 'none'}; moov keys: ${scan.moovKeys.join(',')}; uuids: ${scan.uuids.map((u) => `${u.at}:${u.usertype}`).join(',') || 'none'})`
    );
    return { problems };
  }
  const { profile, family } = findProfile(scan, hints);
  if (!profile) {
    problems.push(
      family
        ? `new firmware ${firmware} for known model ${family.model} (${family.id})`
        : `unknown camera: ${
            firmware
              ? `firmware ${firmware}`
              : garmin?.model
                ? `Garmin model ${garmin.model}`
                : `writer ${JSON.stringify(writer)}, udta keys ${scan.udtaKeys.join(',')}, SRT ${hints.srt ? hints.srt.format : 'none'}`
          }`
    );
    return { problems };
  }

  const rule = profile.files[ext];
  if (!rule) {
    problems.push(`unexpected extension ${ext} for ${profile.id}`);
    return { profile, problems };
  }

  if (!name) problems.push(`filename doesn't match a known camera pattern`);
  else if (!rule.prefixes.includes(name.prefix)) {
    problems.push(
      `name prefix ${name.prefix} not expected for ${ext} (${rule.prefixes.join(',')})`
    );
  }

  if (scan.truncated)
    problems.push('file is truncated (last box runs past the end)');
  const optional = new Set(profile.udtaOptional ?? []);
  const required = (keys: string[]) =>
    keys.filter((k) => !optional.has(k)).join(',');
  if (
    required(scan.udtaKeys) !== required(profile.udtaKeys) ||
    scan.udtaKeys.some((k) => !profile.udtaKeys.includes(k))
  ) {
    problems.push(
      `udta keys ${scan.udtaKeys.join(',')} != expected ${profile.udtaKeys.join(',')}`
    );
  }
  if (!rule.moov.includes(scan.moovPosition as FileRule['moov'][number])) {
    problems.push(
      `moov at ${scan.moovPosition}, expected ${rule.moov.join(' or ')}`
    );
  }
  const sig = trackSignature(scan);
  if (!rule.tracks.includes(sig)) {
    problems.push(
      `track signature "${sig}" not in [${rule.tracks.map((t) => `"${t}"`).join(', ')}]`
    );
  }
  const hasGpmf = scan.tracks.some((t) => t.format === 'gpmd');
  if (hasGpmf !== profile.gpmf) {
    problems.push(
      `gpmd track ${hasGpmf ? 'present' : 'missing'}, expected ${profile.gpmf ? 'present' : 'absent'}`
    );
  }
  const minf = udtaGpmfValue(scan, 'MINF');
  if (profile.minf !== undefined && minf !== profile.minf) {
    problems.push(
      `GPMF model name ${JSON.stringify(minf)} != expected ${JSON.stringify(profile.minf)}`
    );
  }
  if (profile.chapterKey && name) {
    const ch = udtaGpmfValue(scan, profile.chapterKey);
    if (ch !== name.chapter) {
      problems.push(
        `${profile.chapterKey} ${JSON.stringify(ch)} != chapter ${name.chapter} from the filename`
      );
    }
  }
  if (profile.linkKey && !linkKeyValue(profile, scan))
    problems.push(`link key ${profile.linkKey} missing or zero`);
  if (profile.garminGps === 'empty') {
    const text = scan.tracks.filter((t) => t.handler === 'text');
    if (garmin?.gpsRecords) {
      problems.push(
        `GarminGPS box has ${garmin.gpsRecords} records: decode and check them`
      );
    } else if (garmin?.gpsRecords === null && !text.length) {
      problems.push('no GarminGPS box and no text track');
    }
    for (const t of text.filter((t) => t.samples > 0)) {
      problems.push(`text track has ${t.samples} samples: look at them`);
    }
  }
  if (profile.cameraKey !== 'none' && !cameraKeyValue(profile, scan))
    problems.push(`camera key (${profile.cameraKey}) missing or zero`);
  if (!scan.mvhd || scan.mvhd.durationS <= 0)
    problems.push('no mvhd or zero duration');

  return { profile, rule, problems };
}
