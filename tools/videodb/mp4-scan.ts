// A tolerant ISO BMFF / QuickTime scanner for exploring camera files.
// Unlike tools/parse, it never assumes a particular camera: it records what is
// there (box layout, tracks, udta children, GPMF) and leaves judging to the
// camera profiles.
import fs from 'fs';

export class ScanError extends Error {}

export class FileReader {
  readonly size: number;
  bytesRead = 0;
  reads = 0;

  constructor(readonly fd: number) {
    this.size = fs.fstatSync(fd).size;
  }

  read(offset: number, length: number): Buffer {
    const len = Math.max(0, Math.min(length, this.size - offset));
    const buf = Buffer.alloc(len);
    let done = 0;
    while (done < len) {
      const n = fs.readSync(this.fd, buf, done, len - done, offset + done);
      if (n === 0) throw new ScanError(`short read at ${offset + done}`);
      done += n;
    }
    this.reads++;
    this.bytesRead += len;
    return buf;
  }
}

export type BoxInfo = {
  type: string;
  offset: number;
  size: number;
  headerSize: number;
};

function parseBoxHeader(
  h: Buffer,
  at: number,
  offset: number,
  limit: number
): BoxInfo {
  let size = h.readUInt32BE(at);
  const type = h.toString('latin1', at + 4, at + 8);
  let headerSize = 8;
  if (size === 1) {
    size = Number(h.readBigUInt64BE(at + 8));
    headerSize = 16;
  } else if (size === 0) {
    size = limit - offset;
  }
  if (size < headerSize) {
    throw new ScanError(`bad size ${size} for box '${type}' at ${offset}`);
  }
  return { type, offset, size, headerSize };
}

export function topLevelBoxes(r: FileReader): {
  boxes: BoxInfo[];
  truncated: boolean;
} {
  const boxes: BoxInfo[] = [];
  let off = 0;
  while (off + 8 <= r.size) {
    const box = parseBoxHeader(r.read(off, 16), 0, off, r.size);
    boxes.push(box);
    off += box.size;
  }
  return { boxes, truncated: off !== r.size };
}

// children of an in-memory box body
function children(buf: Buffer, start: number, end: number): BoxInfo[] {
  const out: BoxInfo[] = [];
  let off = start;
  while (off + 8 <= end) {
    const box = parseBoxHeader(buf, off, off, end);
    if (off + box.size > end) {
      throw new ScanError(`box '${box.type}' at ${off} overruns its parent`);
    }
    out.push(box);
    off += box.size;
  }
  return out;
}

function child(buf: Buffer, parent: BoxInfo, type: string) {
  return children(
    buf,
    parent.offset + parent.headerSize,
    parent.offset + parent.size
  ).find((b) => b.type === type);
}

function path(buf: Buffer, parent: BoxInfo, types: string[]) {
  let cur: BoxInfo | undefined = parent;
  for (const t of types) {
    cur = cur && child(buf, cur, t);
  }
  return cur;
}

const body = (buf: Buffer, b: BoxInfo) =>
  buf.subarray(b.offset + b.headerSize, b.offset + b.size);

// QuickTime/MP4 times are seconds since 1904-01-01. Cameras write local wall
// clock time, so this is formatted without a zone.
const MAC_EPOCH = 2082844800;
function macTime(secs: number): string | null {
  if (secs === 0) return null;
  return new Date((secs - MAC_EPOCH) * 1000)
    .toISOString()
    .replace(/\.000Z$/, '');
}

function readHeaderTimes(b: Buffer) {
  // mvhd / mdhd: version 1 uses 64-bit times and duration
  if (b[0] === 1) {
    return {
      created: macTime(Number(b.readBigUInt64BE(4))),
      modified: macTime(Number(b.readBigUInt64BE(12))),
      timescale: b.readUInt32BE(20),
      duration: Number(b.readBigUInt64BE(24)),
    };
  }
  return {
    created: macTime(b.readUInt32BE(4)),
    modified: macTime(b.readUInt32BE(8)),
    timescale: b.readUInt32BE(12),
    duration: b.readUInt32BE(16),
  };
}

const printable = (b: Buffer) => /^[\x20-\x7e\0]*$/.test(b.toString('latin1'));

// a compact, JSON-friendly rendering of an opaque value
export function renderBytes(b: Buffer, max = 256): string {
  if (b.length > 0 && printable(b)) {
    return b.toString('latin1').replace(/\0+$/, '');
  }
  const hex = b.subarray(0, max).toString('hex');
  return b.length > max ? `${hex}…(${b.length}B)` : hex;
}

// QuickTime '©xxx' user data: a list of [u16 length][u16 language][text]
function quickTimeStrings(b: Buffer): string {
  const out = [];
  let o = 0;
  while (o + 4 <= b.length) {
    const len = b.readUInt16BE(o);
    if (len === 0 || o + 4 + len > b.length) break;
    out.push(b.toString('utf8', o + 4, o + 4 + len));
    o += 4 + len;
  }
  return out.length ? out.join('|') : renderBytes(b);
}

// ---- GPMF (KLV) ----

export type Klv = {
  key: string;
  type: string;
  structSize: number;
  repeat: number;
  value?: unknown;
  children?: Klv[];
};

const NUMERIC: Record<string, [number, (b: Buffer, o: number) => number]> = {
  b: [1, (b, o) => b.readInt8(o)],
  B: [1, (b, o) => b.readUInt8(o)],
  s: [2, (b, o) => b.readInt16BE(o)],
  S: [2, (b, o) => b.readUInt16BE(o)],
  l: [4, (b, o) => b.readInt32BE(o)],
  L: [4, (b, o) => b.readUInt32BE(o)],
  f: [4, (b, o) => b.readFloatBE(o)],
  d: [8, (b, o) => b.readDoubleBE(o)],
  j: [8, (b, o) => Number(b.readBigInt64BE(o))],
  J: [8, (b, o) => Number(b.readBigUInt64BE(o))],
  // fixed point: Q15.16 and Q31.32
  q: [4, (b, o) => b.readInt32BE(o) / 65536],
  Q: [8, (b, o) => Number(b.readBigInt64BE(o)) / 2 ** 32],
};

// keep big sample arrays out of the database
const MAX_VALUES = 64;

// "lllllllSS" or "f[8]L" -> one type character per field
function expandComplexType(t: string): string[] | null {
  const out: string[] = [];
  const re = /([a-zA-Z])(?:\[(\d+)\])?/g;
  let m;
  let consumed = 0;
  while ((m = re.exec(t))) {
    if (m.index !== consumed) return null;
    consumed = re.lastIndex;
    for (let i = 0; i < Number(m[2] ?? 1); i++) out.push(m[1]);
  }
  return consumed === t.length ? out : null;
}

// a '?' value laid out by the preceding TYPE: one array of fields per sample
function decodeComplex(
  data: Buffer,
  typeString: string | undefined,
  structSize: number
) {
  const fields = typeString ? expandComplexType(typeString) : null;
  const readers = fields?.map((f) => NUMERIC[f]);
  if (
    !readers ||
    readers.some((r) => !r) ||
    readers.reduce((n, r) => n + r[0], 0) !== structSize
  ) {
    return renderBytes(data, 64);
  }
  const rows = [];
  for (
    let o = 0;
    o + structSize <= data.length && rows.length < MAX_VALUES;
    o += structSize
  ) {
    const row = [];
    let p = o;
    for (const [size, read] of readers) {
      row.push(read(data, p));
      p += size;
    }
    rows.push(row);
  }
  return rows;
}

function decodeKlv(data: Buffer, type: string, structSize: number) {
  if (type === 'c' || type === 'U' || type === 'F') {
    if (structSize > 1 && data.length > structSize && type === 'c') {
      const parts = [];
      for (let o = 0; o < data.length; o += structSize) {
        parts.push(
          data.toString('latin1', o, o + structSize).replace(/\0+$/, '')
        );
      }
      return parts;
    }
    return data.toString('latin1').replace(/\0+$/, '');
  }
  const num = NUMERIC[type];
  if (num && structSize % num[0] === 0) {
    const values = [];
    const limit = Math.min(data.length, MAX_VALUES * num[0]);
    for (let o = 0; o + num[0] <= limit; o += num[0]) {
      values.push(num[1](data, o));
    }
    return values.length === 1 ? values[0] : values;
  }
  return renderBytes(data, 64);
}

export function parseKlv(buf: Buffer, start = 0, end = buf.length): Klv[] {
  const out: Klv[] = [];
  // a TYPE applies to the following '?' values at the same level
  let complexType: string | undefined;
  let o = start;
  while (o + 8 <= end) {
    const key = buf.toString('latin1', o, o + 4);
    if (key === '\0\0\0\0') break;
    const typeByte = buf[o + 4];
    const structSize = buf[o + 5];
    const repeat = buf.readUInt16BE(o + 6);
    const len = structSize * repeat;
    const dataStart = o + 8;
    const dataEnd = dataStart + len;
    if (dataEnd > end) {
      throw new ScanError(`GPMF '${key}' at ${o} overruns its parent`);
    }
    const item: Klv = {
      key,
      type: typeByte === 0 ? '' : String.fromCharCode(typeByte),
      structSize,
      repeat,
    };
    if (typeByte === 0) {
      item.children = parseKlv(buf, dataStart, dataEnd);
    } else if (item.type === '?') {
      item.value = decodeComplex(
        buf.subarray(dataStart, dataEnd),
        complexType,
        structSize
      );
    } else {
      item.value = decodeKlv(
        buf.subarray(dataStart, dataEnd),
        item.type,
        structSize
      );
      if (key === 'TYPE' && typeof item.value === 'string')
        complexType = item.value;
    }
    out.push(item);
    o = dataStart + Math.ceil(len / 4) * 4;
  }
  return out;
}

// flatten a KLV tree into {"DEVC/DVNM": value, ...}, first occurrence wins
export function flattenKlv(
  items: Klv[],
  prefix = '',
  out: Record<string, unknown> = {}
) {
  for (const k of items) {
    const p = prefix ? `${prefix}/${k.key}` : k.key;
    if (k.children) flattenKlv(k.children, p, out);
    else if (!(p in out)) out[p] = k.value;
  }
  return out;
}

// ---- tracks ----

export type Track = {
  handler: string;
  handlerName: string;
  format: string | null;
  width: number | null;
  height: number | null;
  timescale: number;
  durationS: number;
  samples: number;
  fps: number | null;
};

type SampleTables = {
  stsc: [number, number][];
  chunkOffsets: number[];
  sizes: number[];
};

function readTrack(
  m: Buffer,
  trak: BoxInfo
): { track: Track; tables?: SampleTables } {
  const mdia = child(m, trak, 'mdia');
  if (!mdia) throw new ScanError('trak without mdia');
  const hdlrBox = child(m, mdia, 'hdlr');
  const hdlr = hdlrBox && body(m, hdlrBox);
  const handler = hdlr ? hdlr.toString('latin1', 8, 12) : '';
  const handlerName = hdlr
    ? hdlr
        .subarray(24)
        .toString('latin1')
        .replace(/[\0-\x1f]/g, '')
        .trim()
    : '';
  const mdhdBox = child(m, mdia, 'mdhd');
  const mdhd = mdhdBox ? readHeaderTimes(body(m, mdhdBox)) : null;
  const stbl = path(m, mdia, ['minf', 'stbl']);

  let format: string | null = null;
  let width: number | null = null;
  let height: number | null = null;
  let samples = 0;
  let totalDelta = 0;
  let tables: SampleTables | undefined;

  if (stbl) {
    const stsd = child(m, stbl, 'stsd');
    if (stsd) {
      const b = body(m, stsd);
      if (b.readUInt32BE(4) > 0) {
        format = b.toString('latin1', 12, 16);
        if (handler === 'vide' && b.length >= 8 + 36) {
          width = b.readUInt16BE(8 + 32);
          height = b.readUInt16BE(8 + 34);
        }
      }
    }
    const stts = child(m, stbl, 'stts');
    if (stts) {
      const b = body(m, stts);
      const n = b.readUInt32BE(4);
      for (let i = 0; i < n; i++) {
        const count = b.readUInt32BE(8 + i * 8);
        samples += count;
        totalDelta += count * b.readUInt32BE(12 + i * 8);
      }
    }
    if (handler === 'meta') {
      tables = readSampleTables(m, stbl);
    }
  }

  const timescale = mdhd?.timescale ?? 0;
  return {
    track: {
      handler,
      handlerName,
      format,
      width,
      height,
      timescale,
      durationS: mdhd && timescale ? mdhd.duration / timescale : 0,
      samples,
      fps:
        handler === 'vide' && totalDelta
          ? Math.round((samples * timescale * 1000) / totalDelta) / 1000
          : null,
    },
    tables,
  };
}

function readSampleTables(m: Buffer, stbl: BoxInfo): SampleTables | undefined {
  const stscBox = child(m, stbl, 'stsc');
  const stszBox = child(m, stbl, 'stsz');
  const co = child(m, stbl, 'stco') ?? child(m, stbl, 'co64');
  if (!stscBox || !stszBox || !co) return undefined;

  const stscB = body(m, stscBox);
  const stsc: [number, number][] = [];
  for (let i = 0, n = stscB.readUInt32BE(4); i < n; i++) {
    stsc.push([
      stscB.readUInt32BE(8 + i * 12),
      stscB.readUInt32BE(12 + i * 12),
    ]);
  }

  const coB = body(m, co);
  const chunkOffsets = [];
  for (let i = 0, n = coB.readUInt32BE(4); i < n; i++) {
    chunkOffsets.push(
      co.type === 'co64'
        ? Number(coB.readBigUInt64BE(8 + i * 8))
        : coB.readUInt32BE(8 + i * 4)
    );
  }

  const szB = body(m, stszBox);
  const fixed = szB.readUInt32BE(4);
  const count = szB.readUInt32BE(8);
  const sizes = [];
  for (let i = 0; i < count; i++) {
    sizes.push(fixed || szB.readUInt32BE(12 + i * 4));
  }
  return { stsc, chunkOffsets, sizes };
}

function sampleLocations(t: SampleTables, limit: number) {
  const out: { offset: number; size: number }[] = [];
  let s = 0;
  for (let i = 0; i < t.stsc.length; i++) {
    const [firstChunk, perChunk] = t.stsc[i];
    const lastChunk =
      i + 1 < t.stsc.length ? t.stsc[i + 1][0] - 1 : t.chunkOffsets.length;
    for (let c = firstChunk; c <= lastChunk; c++) {
      let off = t.chunkOffsets[c - 1];
      for (let k = 0; k < perChunk; k++) {
        if (s >= t.sizes.length || out.length >= limit) return out;
        out.push({ offset: off, size: t.sizes[s] });
        off += t.sizes[s];
        s++;
      }
    }
  }
  return out;
}

// ---- GPS from the GPMF telemetry track ----

export type GpsTime = {
  // UTC, ms precision for GPS9
  utc: string;
  fix: number | null;
  // telemetry sample it came from, and the row within it (GPS9 has ~10 a sample)
  sample: number;
  row: number;
  // utc moved back to the start of the file, using the sample's position
  fileStartUtc: string;
  // position at that row, degrees
  lat: number | null;
  lon: number | null;
};

export type GpsInfo = {
  // streams (data key:STNM name) seen in the first sample
  streams: string[];
  // seconds per telemetry sample
  sampleDurationS: number | null;
  firstGpsu: string | null;
  firstGpsf: number | null;
  // first sample whose GPSF reports a 2D/3D fix, within the scanned window
  lockGpsu: string | null;
  lockSample: number | null;
  // first GPS5 position in the locked sample, degrees
  lockLat: number | null;
  lockLon: number | null;
  // GPS9 (HERO11+): days since 2000 + seconds since midnight, with a fix per row
  gps9First: GpsTime | null;
  gps9Lock: GpsTime | null;
  samplesScanned: number;
};

const GPS_SCAN_SAMPLES = 30;
const GPS9_EPOCH = Date.UTC(2000, 0, 1);

// a SCAL divisor: one per field, or one for all
function scaleAt(scal: unknown, j: number) {
  return Array.isArray(scal) ? Number(scal[j]) || 1 : Number(scal) || 1;
}

function gps9Time(
  row: number[],
  scal: unknown
): { ms: number; fix: number } | null {
  if (row.length < 9) return null;
  const div = (j: number) =>
    Array.isArray(scal) ? Number(scal[j]) || 1 : Number(scal) || 1;
  const days = row[5] / div(5);
  const secs = row[6] / div(6);
  return {
    ms: GPS9_EPOCH + days * 86400e3 + secs * 1000,
    fix: row[8] / div(8),
  };
}

function scanGps(
  r: FileReader,
  tables: SampleTables,
  sampleDurationS: number | null
): GpsInfo {
  const info: GpsInfo = {
    streams: [],
    sampleDurationS,
    firstGpsu: null,
    firstGpsf: null,
    lockGpsu: null,
    lockSample: null,
    lockLat: null,
    lockLon: null,
    gps9First: null,
    gps9Lock: null,
    samplesScanned: 0,
  };
  let hasGpsu = false;
  let hasGps9 = false;
  const gpsTime = (
    ms: number,
    fix: number | null,
    sample: number,
    row: number,
    rows: number,
    pos: number[] | null = null
  ): GpsTime => {
    const offsetMs = sampleDurationS
      ? (sample + row / rows) * sampleDurationS * 1000
      : 0;
    return {
      utc: new Date(ms).toISOString(),
      fix,
      sample,
      row,
      fileStartUtc: new Date(ms - offsetMs).toISOString(),
      lat: pos ? pos[0] : null,
      lon: pos ? pos[1] : null,
    };
  };

  const locs = sampleLocations(tables, GPS_SCAN_SAMPLES);
  for (let i = 0; i < locs.length; i++) {
    const klv = parseKlv(r.read(locs[i].offset, locs[i].size));
    info.samplesScanned++;
    for (const devc of klv.filter((k) => k.key === 'DEVC')) {
      for (const strm of (devc.children ?? []).filter(
        (k) => k.key === 'STRM'
      )) {
        const kids = strm.children ?? [];
        const get = (key: string) => kids.find((k) => k.key === key)?.value;
        if (i === 0) {
          const name = get('STNM');
          const data = kids[kids.length - 1]?.key;
          info.streams.push(
            typeof name === 'string' ? `${data}:${name}` : String(data)
          );
        }

        const gpsu = get('GPSU');
        const gpsf = get('GPSF');
        if (typeof gpsu === 'string') {
          hasGpsu = true;
          if (info.firstGpsu === null) {
            info.firstGpsu = gpsu;
            info.firstGpsf = typeof gpsf === 'number' ? gpsf : null;
          }
          if (info.lockGpsu === null && typeof gpsf === 'number' && gpsf >= 2) {
            info.lockGpsu = gpsu;
            info.lockSample = i;
          }
          // the position at the lock: GPS5 rows (lat, lon, alt, 2D, 3D speed),
          // flattened, scaled by SCAL. The HERO9 sometimes reports a fix with
          // no rows (EMPT), so take the first locked sample that has some.
          if (
            info.lockGpsu !== null &&
            info.lockLat === null &&
            typeof gpsf === 'number' &&
            gpsf >= 2
          ) {
            const gps5 = get('GPS5');
            const scal = get('SCAL');
            if (Array.isArray(gps5) && gps5.length >= 2) {
              info.lockLat = gps5[0] / scaleAt(scal, 0);
              info.lockLon = gps5[1] / scaleAt(scal, 1);
            }
          }
        }

        const gps9 = kids.find((k) => k.key === 'GPS9');
        if (gps9 && Array.isArray(gps9.value) && Array.isArray(gps9.value[0])) {
          hasGps9 = true;
          const rows = gps9.value as number[][];
          const scal = get('SCAL');
          for (let j = 0; j < rows.length; j++) {
            const t = gps9Time(rows[j], scal);
            if (!t) continue;
            if (!info.gps9First)
              info.gps9First = gpsTime(t.ms, t.fix, i, j, gps9.repeat);
            if (!info.gps9Lock && t.fix >= 2) {
              info.gps9Lock = gpsTime(t.ms, t.fix, i, j, gps9.repeat, [
                rows[j][0] / scaleAt(scal, 0),
                rows[j][1] / scaleAt(scal, 1),
              ]);
              break;
            }
          }
        }
      }
    }
    if (
      ((info.lockGpsu !== null && info.lockLat !== null) || !hasGpsu) &&
      (info.gps9Lock !== null || !hasGps9) &&
      (hasGpsu || hasGps9)
    ) {
      break;
    }
  }
  return info;
}

// a locked GPSU moved back to the start of the file
export function gpsuFileStart(gps: GpsInfo): string | null {
  const iso = gps.lockGpsu && gpsuToIso(gps.lockGpsu);
  if (!iso || gps.lockSample === null) return null;
  return new Date(
    Date.parse(iso) - gps.lockSample * (gps.sampleDurationS ?? 0) * 1000
  ).toISOString();
}

// GPSU is "yymmddhhmmss.sss" in UTC
export function gpsuToIso(s: string): string | null {
  const m = /^(\d\d)(\d\d)(\d\d)(\d\d)(\d\d)(\d\d)\.(\d+)/.exec(s);
  if (!m) return null;
  return `20${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${m[6]}.${m[7].padEnd(3, '0').slice(0, 3)}Z`;
}

// ---- udta/meta ----

// a full box: version/flags, then hdlr and ilst; each ilst item holds a 'data'
// box (u32 type, u32 locale, value; type 1 = UTF-8)
function ilstItems(m: Buffer, meta: BoxInfo): Record<string, string> {
  const out: Record<string, string> = {};
  const start = meta.offset + meta.headerSize + 4;
  const ilst = children(m, start, meta.offset + meta.size).find(
    (b) => b.type === 'ilst'
  );
  if (!ilst) return out;
  for (const item of children(
    m,
    ilst.offset + ilst.headerSize,
    ilst.offset + ilst.size
  )) {
    const data = children(
      m,
      item.offset + item.headerSize,
      item.offset + item.size
    ).find((b) => b.type === 'data');
    if (!data) continue;
    const d = body(m, data);
    const value = d.subarray(8);
    out[item.type] =
      d.readUInt32BE(0) === 1
        ? value.toString('utf8')
        : `<${value.length} bytes>`;
  }
  return out;
}

// ---- uuid boxes ----

export type UuidBox = {
  at: 'top' | 'moov' | 'udta';
  // the 16-byte extended type, hex
  usertype: string;
  // whole box size, header included
  size: number;
  // the body after the usertype, hex (up to MAX_UUID bytes)
  data: string;
};

const MAX_UUID = 4096;

function uuidBox(at: UuidBox['at'], b: Buffer, size: number): UuidBox {
  return {
    at,
    usertype: b.subarray(0, 16).toString('hex'),
    size,
    data: b.subarray(16, MAX_UUID).toString('hex'),
  };
}

// ---- the scan ----

export type Scan = {
  size: number;
  layout: string[];
  truncated: boolean;
  ftyp: { major: string; minor: number; compatible: string[] } | null;
  moovPosition: 'start' | 'end' | 'middle' | 'missing';
  moovSize: number | null;
  mvhd: {
    created: string | null;
    modified: string | null;
    timescale: number;
    durationS: number;
  } | null;
  tracks: Track[];
  // moov/udta children, in order; GPMF is parsed and flattened separately
  udtaKeys: string[];
  udta: Record<string, string>;
  udtaGpmf: Record<string, unknown> | null;
  // udta/meta ilst items (e.g. ©too, the writing app): text, or a byte count
  udtaMeta: Record<string, string>;
  // other moov children that may carry camera metadata (e.g. Apple 'meta')
  moovKeys: string[];
  // every uuid box at the top level, in moov and in udta: vendors (Garmin) keep
  // their metadata in these
  uuids: UuidBox[];
  gps: GpsInfo | null;
  reads: number;
  bytesRead: number;
};

const MAX_MOOV = 64 * 1024 * 1024;

export function scanFile(r: FileReader, { gps = true } = {}): Scan {
  const { boxes, truncated } = topLevelBoxes(r);
  const scan: Scan = {
    size: r.size,
    layout: boxes.map((b) => b.type),
    truncated,
    ftyp: null,
    moovPosition: 'missing',
    moovSize: null,
    mvhd: null,
    tracks: [],
    udtaKeys: [],
    udta: {},
    udtaGpmf: null,
    udtaMeta: {},
    moovKeys: [],
    uuids: [],
    gps: null,
    reads: 0,
    bytesRead: 0,
  };

  for (const b of boxes.filter((b) => b.type === 'uuid')) {
    scan.uuids.push(
      uuidBox(
        'top',
        r.read(
          b.offset + b.headerSize,
          Math.min(b.size - b.headerSize, MAX_UUID)
        ),
        b.size
      )
    );
  }

  const ftyp = boxes.find((b) => b.type === 'ftyp');
  if (ftyp) {
    const b = r.read(
      ftyp.offset + ftyp.headerSize,
      Math.min(ftyp.size - ftyp.headerSize, 256)
    );
    const compatible = [];
    for (let o = 8; o + 4 <= b.length; o += 4)
      compatible.push(b.toString('latin1', o, o + 4));
    scan.ftyp = {
      major: b.toString('latin1', 0, 4),
      minor: b.readUInt32BE(4),
      compatible,
    };
  }

  const moovIndex = boxes.findIndex((b) => b.type === 'moov');
  if (moovIndex < 0) return finish(scan, r);
  const moov = boxes[moovIndex];
  const mdatIndex = boxes.findIndex((b) => b.type === 'mdat');
  scan.moovPosition =
    mdatIndex < 0
      ? 'middle'
      : moovIndex < mdatIndex
        ? 'start'
        : moovIndex === boxes.length - 1
          ? 'end'
          : 'middle';
  scan.moovSize = moov.size;
  if (moov.size > MAX_MOOV) throw new ScanError(`moov is ${moov.size} bytes`);

  const m = r.read(moov.offset, moov.size);
  const root: BoxInfo = { ...moov, offset: 0 };
  const kids = children(m, root.headerSize, root.size);
  scan.moovKeys = kids.map((k) => k.type);
  for (const k of kids.filter((k) => k.type === 'uuid')) {
    scan.uuids.push(uuidBox('moov', body(m, k), k.size));
  }

  const mvhd = kids.find((k) => k.type === 'mvhd');
  if (mvhd) {
    const t = readHeaderTimes(body(m, mvhd));
    scan.mvhd = {
      created: t.created,
      modified: t.modified,
      timescale: t.timescale,
      durationS: t.timescale ? t.duration / t.timescale : 0,
    };
  }

  let metaTables: SampleTables | undefined;
  let metaSampleS: number | null = null;
  for (const trak of kids.filter((k) => k.type === 'trak')) {
    const { track, tables } = readTrack(m, trak);
    scan.tracks.push(track);
    if (track.format === 'gpmd' && tables && !metaTables) {
      metaTables = tables;
      metaSampleS = track.samples ? track.durationS / track.samples : null;
    }
  }

  const udta = kids.find((k) => k.type === 'udta');
  if (udta) {
    for (const c of children(
      m,
      udta.offset + udta.headerSize,
      udta.offset + udta.size
    )) {
      if (c.type === 'free') continue;
      if (c.type === 'uuid')
        scan.uuids.push(uuidBox('udta', body(m, c), c.size));
      scan.udtaKeys.push(c.type);
      const v = body(m, c);
      if (c.type === 'GPMF') {
        scan.udtaGpmf = flattenKlv(parseKlv(v));
      } else if (c.type === 'meta') {
        scan.udtaMeta = ilstItems(m, c);
      } else if (c.type.charCodeAt(0) === 0xa9 && !(c.type in scan.udta)) {
        scan.udta[c.type] = quickTimeStrings(v);
      } else if (!(c.type in scan.udta)) {
        scan.udta[c.type] = renderBytes(v);
      }
    }
  }

  if (gps && metaTables) {
    scan.gps = scanGps(r, metaTables, metaSampleS);
  }

  return finish(scan, r);
}

function finish(scan: Scan, r: FileReader) {
  scan.reads = r.reads;
  scan.bytesRead = r.bytesRead;
  return scan;
}

// a udta GPMF value by key, wherever it is nested (DEVC/MINF on HERO9,
// DEVC/STRM/MINF on HERO7)
export function udtaGpmfValue(scan: Scan, key: string): unknown {
  if (!scan.udtaGpmf) return undefined;
  const k = Object.keys(scan.udtaGpmf).find(
    (p) => p === key || p.endsWith(`/${key}`)
  );
  return k === undefined ? undefined : scan.udtaGpmf[k];
}

// "vide:avc1 soun:mp4a tmcd:tmcd meta:gpmd" — compact track signature
export function trackSignature(scan: Scan) {
  return scan.tracks.map((t) => `${t.handler}:${t.format ?? '-'}`).join(' ');
}
