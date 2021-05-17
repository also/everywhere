import { bind, nullTerminated, Parser, root, Traverser } from '.';
import { BufferWrapper, SeekableBuffer } from './buffers';
import { findAllValues, findFirst, findRequired } from './find';
import { Box, BoxTypes } from './mp4';
import {
  readAscii,
  readUInt8,
  readUInt16BE,
  readInt8,
  readUInt32BE,
  readFloatBE,
  readBigUInt64BE,
} from './read';

/*
TODO:
handle MTRX for ACCL type values
  https://github.com/JuanIrache/gopro-telemetry/blob/19326c468a37daac6453f7a64786ebefa5da6642/code/interpretKLV.js#L78-L89

*/

export const parser: Parser<KlvHeader, ComplexType> = {
  parseEntry: parseKlvHeader,
  hasChildren: (klv) => !klv.type,
  async nextState(data, klv, type) {
    if (klv.fourcc === 'TYPE') {
      type = parseComplexType(await parseData(data, klv));
    }
    return type;
  },
  parseValue: parseData,
};

type KlvHeader = {
  fileOffset: number;
  fourcc: string;
  type: string | ComplexType | undefined;
  structSize: number;
  repeat: number;
  len: number;
};

export function parseKlvHeader(
  fileOffset: number,
  b: BufferWrapper,
  _: any,
  typeDetail: ComplexType | undefined
): KlvHeader {
  const key = readAscii(b, 4);
  const typeInt = readUInt8(b);
  const structSize = readUInt8(b);
  const repeat = readUInt16BE(b);

  const typeStr = typeInt ? String.fromCharCode(typeInt) : undefined;
  let type;
  if (typeStr === '?') {
    if (!typeDetail) {
      throw new Error('missing type');
    }
    type = typeDetail;
  } else {
    type = typeStr;
  }

  const len = structSize * repeat;
  const mod = len % 4;

  return {
    fileOffset,
    fourcc: key,
    type,
    structSize,
    repeat,
    len: 8 + (mod === 0 ? len : len + 4 - mod),
  };
}

type TypeReader = (b: BufferWrapper) => any;

const simpleTypes: { [key: string]: TypeReader } = {
  b: readInt8,
  B: readUInt8,
  f: readFloatBE,
  F: (b) => readAscii(b, 4),
  J: readBigUInt64BE,
  l: readInt32BE,
  L: readUInt32BE,
  s: readInt16BE,
  S: readUInt16BE,
  U: (b) => parseDate(readAscii(b, 16)),
};

export type ComplexType = { size: number; types: TypeReader[] };

export function parseComplexType(s: string): ComplexType {
  let size = 0;
  const types = Array.from(s, (c) => {
    const t = simpleTypes[c];
    if (!t) {
      throw new Error('invalid complex type ' + s);
    }
    size += t.size;
    return t;
  });
  return { size, types };
}

async function parseData(
  data: SeekableBuffer,
  header: KlvHeader
): Promise<any> {
  const valueLength = header.structSize * header.repeat;
  await data.move(header.fileOffset + 8, valueLength);
  const { buf } = data;
  let { offset } = data;

  const { type, repeat, structSize } = header;
  if (!type) {
    throw new Error('missing type!');
  }
  if (typeof type === 'string') {
    const simpleType = simpleTypes[type];
    if (simpleType) {
      const n = structSize / simpleType.size;
      const result = Array(repeat);
      for (let i = 0; i < repeat; i++) {
        const struct = Array(n);
        result[i] = struct;
        for (let j = 0; j < n; j++) {
          struct[j] =
            typeof simpleType.f === 'function'
              ? simpleType.f(buf, offset)
              : // @ts-expect-error FIXME
                buf[simpleType.f](offset);
          offset += simpleType.size;
        }
      }

      return result;
    } else if (type === 'c') {
      const end = offset + header.repeat * header.structSize;
      return nullTerminated(buf.slice(offset, end));
    } else {
      throw new Error(`can't handle type ${type}`);
    }
  } else {
    /* TODO can there be repeated complex types? I only saw one case where structSize was longer than the size of the complex struct
      {
        size: 2,
        types: [ { f: 'readUInt8', size: 1 }, { f: 'readUInt8', size: 1 } ]
      }
      {
        offset: 1244100,
        key: 'HUES',
        type: '?',
        structSize: 92,
        repeat: 0,
        alignedLen: 0
      }
      */

    const result = Array(repeat);
    for (let i = 0; i < repeat; i++) {
      result[i] = type.types.map((simpleType) => {
        const v =
          typeof simpleType.f === 'function'
            ? simpleType.f(buf, offset)
            : // @ts-expect-error FIXME
              buf[simpleType.f](offset);
        offset += simpleType.size;
        return v;
      });
    }

    return result;
  }
}

export function getMetaTrak(
  mp4: Traverser<Box>,
  moov: Box
): Promise<
  | {
      stsz: BoxTypes['stsz']['table'];
      stco: BoxTypes['stco']['table'];
      stts: BoxTypes['stts']['table'];
      stsc: BoxTypes['stsc']['table'];
      stsd: BoxTypes['stsd'];
      mdhd: BoxTypes['mdhd'];
    }
  | undefined
> {
  return findFirst(mp4, moov, ['trak'], (track) =>
    findFirst(mp4, track, ['mdia', 'minf', 'gmhd', 'gpmd'], () =>
      findRequired(mp4, track, ['mdia'], (mdia) =>
        findRequired(mp4, mdia, ['mdhd'], (mdhd) =>
          findRequired(mp4, mdia, ['minf', 'stbl'], async (stbl) => ({
            mdhd: await mp4.value(mdhd),
            ...(await findAllValues(mp4, stbl, {
              stsd: (v) => v,
              stsc: (v) => v.table,
              stsz: (v) => v.table,
              stco: (v) => v.table,
              stts: (v) => v.table,
            })),
          }))
        )
      )
    )
  );
}

type SampleMetadata = {
  // stsz
  sizeTable: number[];
  // stsz
  offsetTable: number[];
  // stts
  // sampleDelta: number;

  // mdhd
  // TODO these might have the wrong time zone
  creationTime: number;
  modificationTime: number;
  timescale: number;
  duration: number;
};

type Metadata = {
  samples: SampleMetadata | undefined;

  // mvhd
  // TODO these might have the wrong time zone
  creationTime: number;
  modificationTime: number;
  timescale: number;
  duration: number;

  // udta
  firmware: string;
  lens: string;
  mediaUID: string;
  cameraModelName: string | undefined;
};

function getMoovMeta(mp4: Traverser<Box>, moov: Box) {
  return findRequired(mp4, moov, ['mvhd'], (b) =>
    mp4.value<BoxTypes['mvhd']>(b)
  );
}

// // https://github.com/exiftool/exiftool/blob/ceff3cbc4564e93518f3d2a2e00d8ae203ff54af/lib/Image/ExifTool/GoPro.pm#L62
export function parseGpmfUdta(mp4: Traverser<Box>, b: Box): Promise<string> {
  const gpmf = bind(parser, mp4.data, root(b.fileOffset + 8, b.len - 8));

  return findRequired(
    gpmf,
    gpmf.root,
    ['DEVC'],
    async (devc) =>
      // HERO 9
      (await findFirst(gpmf, devc, ['MINF'], (b) => gpmf.value(b))) ||
      // HERO 7
      (await findFirst(gpmf, devc, ['STRM', 'MINF'], (b) => gpmf.value(b)))
  );
}

export async function getMeta(mp4: Traverser<Box>): Promise<Metadata> {
  const { trak, udta, mvhd } = await findRequired(
    mp4,
    mp4.root,
    ['moov'],
    async (moov) => ({
      mvhd: await getMoovMeta(mp4, moov),
      trak: await getMetaTrak(mp4, moov),
      udta: await findRequired(mp4, moov, ['udta'], async (udta) => {
        const MINF = await findFirst(mp4, udta, ['GPMF'], (b) =>
          parseGpmfUdta(mp4, b)
        );
        // https://github.com/gopro/gpmf-parser/issues/28#issuecomment-401124158
        return {
          MINF,
          ...(await findAllValues(mp4, udta, {
            FIRM: (v) => nullTerminated(v),
            LENS: (v) => nullTerminated(v),
            MUID: (v) => (v as Buffer).toString('hex'),
            CAME: (v) => (v as Buffer).toString('hex'),
          })),
        };
      }),
    })
  );

  let samples: SampleMetadata | undefined;
  if (trak) {
    const { stsc, mdhd, stsz: sizeTable, stco: offsetTable } = trak;

    if (stsc.length !== 1) {
      throw new Error('expected a stsc table with a single entry');
    }
    const [firstChunk, samplesPerChunk] = stsc[0];
    // 8.18.3 the index of the first chunk in a track has the value 1
    if (firstChunk !== 1 && samplesPerChunk !== 1) {
      throw new Error(
        'expected all chunks to have one sample, so [[1, 1]] in stsc'
      );
    }

    // if (stts.length !== 1) {
    //   console.log(stts);
    //   throw new Error(
    //     'expected all samples to have the same delta, so a stts table with a single entry'
    //   );
    // }
    // const [[, sampleDelta]] = stts;

    samples = {
      sizeTable,
      offsetTable,
      // sampleDelta,

      ...mdhd,
    };
  }

  const {
    LENS: lens,
    FIRM: firmware,
    MUID: mediaUID,
    MINF: cameraModelName,
  } = udta;

  return {
    samples,
    lens,
    firmware,
    mediaUID,
    cameraModelName,
    ...mvhd,
  };
}

export type Sample = {
  size: number;
  offset: number;
  // duration: number;
  // decodingTs: number;
};

export async function* iterateMetadataSamples({
  offsetTable,
  sizeTable,
}: // sampleDelta,
// duration: trackDuration,
SampleMetadata): AsyncGenerator<Sample> {
  if (offsetTable.length === 0) {
    return;
  }

  let i = 0;
  // let decodingTs = 0;
  for (; i < offsetTable.length - 1; i++) {
    yield {
      size: sizeTable[i],
      offset: offsetTable[i],
      // duration: sampleDelta,
      // decodingTs,
    };

    // decodingTs += sampleDelta;
  }

  yield {
    size: sizeTable[i],
    offset: offsetTable[i],
    // duration: Math.max(trackDuration - decodingTs, 0),
    // decodingTs,
  };
}

type GpsSample = { GPS5: GPS5[]; GPSU: number; GPSP: number; GPSF: number };

type GPS5 = [
  latitude: number,
  longitude: number,
  altitude: number,
  groundSpeed: number,
  speed: number
];

export function extractGpsSample(
  data: SeekableBuffer,
  { offset, size }: { offset: number; size: number }
): Promise<GpsSample | undefined> {
  const gpmf = bind(parser, data, root(offset, size));

  return findFirst(gpmf, gpmf.root, ['DEVC', 'STRM'], (strm) => {
    return findFirst(gpmf, strm, ['GPS5'], async (gps5) => {
      const {
        SCAL: scal,
        GPSU,
        GPSP,
        GPSF,
      } = await findAllValues(gpmf, strm, {
        SCAL: (v) => v as [[number], [number], [number], [number], [number]],
        GPSU: (v) => v[0][0] as number,
        GPSP: (v) => v[0][0] as number,
        GPSF: (v) => v[0][0] as number,
      });

      const gps5Value: GPS5[] = await gpmf.value(gps5);
      return {
        GPSP,
        GPSU,
        GPSF,
        GPS5: gps5Value.map((row) => row.map((v, i) => v / scal[i][0]) as GPS5),
      };
    });
  });
}

function parseDate(s: string) {
  // yymmddhhmmss.sss
  const args: Parameters<typeof Date['UTC']> = [] as any;
  for (let i = 0; i < 12; i += 2) {
    args.push(parseInt(s.slice(i, i + 2), 10));
  }
  args.push(parseInt(s.slice(13)));
  args[0] += 2000;
  args[1] -= 1;
  return Date.UTC(...args);
}
