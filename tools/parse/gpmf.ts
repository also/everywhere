import { bind, Parser, root, Traverser } from '.';
import { BufferWrapper, SeekableBuffer } from './buffers';
import { findAll, findFirst, findRequired } from './find';
import { Box, BoxTypes } from './mp4';

/*
TODO:
handle MTRX for ACCL type values
  https://github.com/JuanIrache/gopro-telemetry/blob/19326c468a37daac6453f7a64786ebefa5da6642/code/interpretKLV.js#L78-L89

*/

export const parser: Parser<KlvHeader, ComplexType> = {
  parseEntry: parseKlvHeader,
  hasChildren: (klv) => !klv.type,
  nextState(data, klv, type) {
    if (klv.fourcc === 'TYPE') {
      type = parseComplexType(parseData(data, klv));
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
  { buf, offset, filePos }: BufferWrapper,
  _: any,
  typeDetail: ComplexType | undefined
): KlvHeader {
  const key = buf.slice(offset, offset + 4).toString('ascii');
  const typeInt = buf.readUInt8(offset + 4);
  const structSize = buf.readUInt8(offset + 5);
  const repeat = buf.readUInt16BE(offset + 6);

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
    fileOffset: filePos,
    fourcc: key,
    type,
    structSize,
    repeat,
    len: 8 + (mod === 0 ? len : len + 4 - mod),
  };
}

type TypeReader = {
  f: keyof Buffer | ((buf: Buffer, offset: number) => any);
  size: number;
};

const simpleTypes: { [key: string]: TypeReader } = {
  b: { f: 'readInt8', size: 1 },
  B: { f: 'readUInt8', size: 1 },
  f: { f: 'readFloatBE', size: 4 },
  F: {
    f: (buf, offset) => buf.slice(offset, offset + 4).toString('ascii'),
    size: 4,
  },
  J: { f: 'readBigUInt64BE', size: 8 },
  l: { f: 'readInt32BE', size: 4 },
  L: { f: 'readUInt32BE', size: 4 },
  s: { f: 'readInt16BE', size: 2 },
  S: { f: 'readUInt16BE', size: 2 },
  U: {
    f: (buf, offset) =>
      parseDate(buf.slice(offset, offset + 16).toString('ascii')),
    size: 16,
  },
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

export function parseData(data: SeekableBuffer, header: KlvHeader): any {
  const valueLength = header.structSize * header.repeat;
  data.move(header.fileOffset + 8, valueLength);
  let { buf, offset } = data;

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
      return buf
        .slice(offset, buf[end - 1] === 0 ? end - 1 : end)
        .toString('ascii');
    } else {
      throw new Error(`can't handle ${type}`);
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

export function getMetaTrak(mp4: Traverser<Box>): {
  stsz: BoxTypes['stsz']['table'];
  stco: BoxTypes['stco']['table'];
  stts: BoxTypes['stts']['table'];
  stsc: BoxTypes['stsc']['table'];
  stsd: BoxTypes['stsd'];
  mdhd: BoxTypes['mdhd'];
} {
  return findRequired(mp4, mp4.root, ['moov'], (moov) =>
    findFirst(mp4, moov, ['trak'], (track) =>
      findFirst(mp4, track, ['mdia', 'minf', 'gmhd', 'gpmd'], () =>
        findRequired(mp4, track, ['mdia'], (mdia) =>
          findRequired(mp4, mdia, ['mdhd'], (mdhd) =>
            findRequired(mp4, mdia, ['minf', 'stbl'], (stbl) => ({
              mdhd: mp4.value(mdhd),
              ...findAll(mp4, stbl, {
                stsd: (v) => mp4.value(v),
                stsc: (v) => mp4.value(v).table,
                stsz: (v) => mp4.value(v).table,
                stco: (v) => mp4.value(v).table,
                stts: (v) => mp4.value(v).table,
              }),
            }))
          )
        )
      )
    )
  );
}

type MetadataTrack = {
  // stsz
  sizeTable: number[];
  // stsz
  offsetTable: number[];
  // stts
  sampleDelta: number;

  // mdhd
  // TODO these might have the wrong time zone
  creationTime: number;
  modificationTime: number;
  timeScale: number;
  duration: number;
};

export function getMetaTrack(mp4: Traverser<Box>): MetadataTrack {
  const {
    stts,
    stsc,
    mdhd,
    stsz: sizeTable,
    stco: offsetTable,
  } = getMetaTrak(mp4);

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

  if (stts.length !== 1) {
    throw new Error(
      'expected all samples to have the same delta, so a stts table with a single entry'
    );
  }
  const [[, sampleDelta]] = stts;

  return { sizeTable, offsetTable, sampleDelta, ...mdhd };
}

export type Sample = {
  size: number;
  offset: number;
  duration: number;
  decodingTs: number;
};

export function* iterateMetadataSamples({
  offsetTable,
  sizeTable,
  sampleDelta,
  duration: trackDuration,
}: MetadataTrack): Generator<Sample> {
  if (offsetTable.length === 0) {
    return;
  }

  let i = 0;
  let decodingTs = 0;
  for (; i < offsetTable.length - 1; i++) {
    yield {
      size: sizeTable[i],
      offset: offsetTable[i],
      duration: sampleDelta,
      decodingTs,
    };

    decodingTs += sampleDelta;
  }

  yield {
    size: sizeTable[i],
    offset: offsetTable[i],
    duration: Math.max(trackDuration - decodingTs, 0),
    decodingTs,
  };
}

type GpsSample = { GPS5: GPS5[]; GPSU: number };

type GPS5 = [
  latitude: number,
  longitude: number,
  altitude: number,
  groundSpeed: number,
  speed: number
];

export function extractGpsSample(
  data: SeekableBuffer,
  { offset, size }: Sample
): GpsSample {
  const gpmf = bind(parser, data, root(offset, size));

  return findRequired(gpmf, gpmf.root, ['DEVC', 'STRM'], (strm) => {
    return findFirst(gpmf, strm, ['GPS5'], (gps5) => {
      const { SCAL: scal, GPSU } = findAll(gpmf, strm, {
        SCAL: (v) =>
          gpmf.value(v) as [[number], [number], [number], [number], [number]],
        GPSU: (v) => gpmf.value(v)[0][0] as number,
      });

      const gps5Value: GPS5[] = gpmf.value(gps5);
      return {
        GPSU,
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
