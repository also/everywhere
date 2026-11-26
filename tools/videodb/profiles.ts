// Camera profiles: what we expect a known camera's files to look like.
//
// The exploration tool stops on any file that doesn't match a profile, so a
// person can look at it and either extend a profile here or decide the file
// breaks an assumption of the ID/database design. Only add values that have
// been checked against real files.
import { Scan, trackSignature, udtaGpmfValue } from './mp4-scan';

export type FileRule = {
  // chapter: part of a recording; proxy: low-res copy of a chapter (LRV)
  role: 'chapter' | 'proxy';
  kind: 'video' | 'proxy' | 'spherical';
  // camera_name prefixes allowed for this extension
  prefixes: string[];
  moov: 'start' | 'end';
  // accepted track signatures (see trackSignature)
  tracks: string[];
};

export type Profile = {
  id: string;
  model: string;
  // exact udta FIRM values seen and accepted
  firmware: string[];
  // udta children in file order, 'free' excluded
  udtaKeys: string[];
  // udta children that may be missing (e.g. ©xyz needs a GPS fix at start)
  udtaOptional?: string[];
  // the value shared by every chapter of a recording: a udta child (GUMI,
  // MUID) or a udta GPMF key (CPID)
  linkKey: 'GUMI' | 'MUID' | 'CPID';
  // udta GPMF key holding the 1-based chapter number, checked against the name
  chapterKey?: 'CPIN';
  // where the camera body's identity comes from
  cameraKey: 'CAME' | 'MUID-prefix';
  // expects a GPMF telemetry (gpmd) track
  gpmf: boolean;
  // model name in the udta GPMF (DEVC/MINF), for cameras that write one
  minf?: string;
  // what mvhd creation time means: the chapter's own start (HERO3+, HERO5) or
  // the whole recording's start, repeated in every chapter (HERO9)
  mvhdTime: 'chapter' | 'recording';
  files: Record<string, FileRule>;
};

export const PROFILES: Profile[] = [
  {
    id: 'gopro-hero3plus',
    model: 'GoPro HERO3+',
    firmware: ['HD3.11.03.00'],
    udtaKeys: ['FIRM', 'LENS', 'CAME', 'SETT', 'MUID', 'AMBA'],
    linkKey: 'MUID',
    cameraKey: 'MUID-prefix',
    gpmf: false,
    mvhdTime: 'chapter',
    files: {
      '.mp4': {
        role: 'chapter',
        kind: 'video',
        prefixes: ['GOPR', 'GP'],
        moov: 'start',
        tracks: ['vide:avc1 soun:mp4a tmcd:tmcd'],
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
    gpmf: true,
    mvhdTime: 'chapter',
    files: {
      '.mp4': {
        role: 'chapter',
        kind: 'video',
        prefixes: ['GOPR', 'GP'],
        moov: 'end',
        tracks: ['vide:avc1 soun:mp4a tmcd:tmcd meta:gpmd meta:fdsc'],
      },
      '.lrv': {
        role: 'proxy',
        kind: 'proxy',
        prefixes: ['GOPR', 'GP'],
        moov: 'end',
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
    gpmf: true,
    mvhdTime: 'recording',
    minf: 'HERO9 Black',
    files: {
      // GH = H.264, GX = HEVC
      '.mp4': {
        role: 'chapter',
        kind: 'video',
        prefixes: ['GH', 'GX'],
        moov: 'end',
        tracks: [
          'vide:avc1 soun:mp4a tmcd:tmcd meta:gpmd meta:fdsc',
          'vide:hvc1 soun:mp4a tmcd:tmcd meta:gpmd meta:fdsc',
        ],
      },
      '.lrv': {
        role: 'proxy',
        kind: 'proxy',
        prefixes: ['GL'],
        moov: 'end',
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
    minf: 'HERO7 Black',
    files: {
      '.mp4': {
        role: 'chapter',
        kind: 'video',
        prefixes: ['GH'],
        moov: 'end',
        tracks: ['vide:avc1 soun:mp4a tmcd:tmcd meta:gpmd meta:fdsc'],
      },
      '.lrv': {
        role: 'proxy',
        kind: 'proxy',
        prefixes: ['GL'],
        moov: 'end',
        tracks: ['vide:avc1 soun:mp4a tmcd:tmcd meta:gpmd meta:fdsc'],
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
    mvhdTime: 'recording',
    minf: 'GoPro Max',
    files: {
      // two HEVC tracks (one per lens) and a second audio track (ambisonic?)
      '.360': {
        role: 'chapter',
        kind: 'spherical',
        prefixes: ['GS'],
        moov: 'end',
        tracks: [
          'vide:hvc1 soun:mp4a tmcd:tmcd meta:gpmd meta:fdsc vide:hvc1 soun:in32',
        ],
      },
      // a single H.264 track
      '.lrv': {
        role: 'proxy',
        kind: 'proxy',
        prefixes: ['GS'],
        moov: 'end',
        tracks: ['vide:avc1 soun:mp4a tmcd:tmcd meta:gpmd meta:fdsc'],
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
    gpmf: true,
    // unverified guess; the recording checks catch a wrong guess
    mvhdTime: 'recording',
    minf: 'HERO11 Black',
    files: {
      // no fdsc track; telemetry has both GPS5 and GPS9
      '.mp4': {
        role: 'chapter',
        kind: 'video',
        prefixes: ['GX'],
        moov: 'end',
        tracks: ['vide:hvc1 soun:mp4a tmcd:tmcd meta:gpmd'],
      },
      '.lrv': {
        role: 'proxy',
        kind: 'proxy',
        prefixes: ['GL'],
        moov: 'end',
        tracks: ['vide:avc1 soun:mp4a tmcd:tmcd meta:gpmd'],
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
    mvhdTime: 'recording',
    minf: 'HERO13 Black',
    files: {
      // telemetry has GPS9 only (no GPSU)
      '.mp4': {
        role: 'chapter',
        kind: 'video',
        prefixes: ['GX'],
        moov: 'end',
        tracks: ['vide:hvc1 soun:mp4a tmcd:tmcd meta:gpmd'],
      },
      '.lrv': {
        role: 'proxy',
        kind: 'proxy',
        prefixes: ['GL'],
        moov: 'end',
        tracks: ['vide:hvc1 soun:mp4a tmcd:tmcd meta:gpmd'],
      },
    },
  },
];

export type GoProName = {
  cameraName: string;
  prefix: string;
  // 1-based chapter
  chapter: number;
  fileNumber: string;
};

// HERO3–HERO5: GOPRnnnn (chapter 1), GPccnnnn (chapter cc + 1)
// HERO6+:      G[HXLS]ccnnnn (chapter cc)
export function parseGoProName(basename: string): GoProName | null {
  const stem = basename.replace(/\.[^.]*$/, '');
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

export function findProfile(firmware: string | undefined) {
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
  name: GoProName | null
): { profile?: Profile; rule?: FileRule; problems: string[] } {
  const problems: string[] = [];
  const firmware = scan.udta.FIRM;
  if (!firmware) {
    problems.push(
      `unknown camera: no udta FIRM (udta keys: ${scan.udtaKeys.join(',') || 'none'}; moov keys: ${scan.moovKeys.join(',')})`
    );
    return { problems };
  }
  const { profile, family } = findProfile(firmware);
  if (!profile) {
    problems.push(
      family
        ? `new firmware ${firmware} for known model ${family.model} (${family.id})`
        : `unknown camera: firmware ${firmware}`
    );
    return { problems };
  }

  const rule = profile.files[ext];
  if (!rule) {
    problems.push(`unexpected extension ${ext} for ${profile.id}`);
    return { profile, problems };
  }

  if (!name) problems.push(`filename doesn't match a GoPro pattern`);
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
  if (scan.moovPosition !== rule.moov) {
    problems.push(`moov at ${scan.moovPosition}, expected ${rule.moov}`);
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
  if (!linkKeyValue(profile, scan))
    problems.push(`link key ${profile.linkKey} missing or zero`);
  if (!cameraKeyValue(profile, scan))
    problems.push(`camera key (${profile.cameraKey}) missing or zero`);
  if (!scan.mvhd || scan.mvhd.durationS <= 0)
    problems.push('no mvhd or zero duration');

  return { profile, rule, problems };
}
