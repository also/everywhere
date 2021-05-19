import { Parser, Root } from '.';
import { BufferWrapper, SeekableBuffer } from './buffers';
import {
  latin18decoder,
  readAscii,
  readUInt8,
  readUInt16BE,
  readUInt32BE,
  readUtf8,
  skip,
  slice,
  utf8decoder,
} from './read';

export const parser: Parser<Box> = {
  parseEntry: parseBox,
  hasChildren: (box) => containers.has(box.fourcc),
  parseValue: readValue,
};

const hfsTimestampOffst = 2082844800;

export type BoxTypes = {
  [K in keyof typeof boxParsers]: ReturnType<typeof boxParsers[K]>;
};

export const boxParsers = {
  // 8.2.2 Movie header box (MovieHeaderBox)
  mvhd: (b: BufferWrapper) => {
    const creationTime = readUInt32BE(b) - hfsTimestampOffst;
    const modificationTime = readUInt32BE(b) - hfsTimestampOffst;
    const timescale = readUInt32BE(b);
    const duration = readUInt32BE(b);

    return { creationTime, modificationTime, timescale, duration };
  },

  // 8.3.2 Track header box (TrackHeaderBox)
  tkhd(b: BufferWrapper) {
    const creationTime = readUInt32BE(b) - hfsTimestampOffst;
    const modificationTime = readUInt32BE(b) - hfsTimestampOffst;
    const id = readUInt32BE(b);
    // reserved (4)
    skip(b, 4);
    // TODO only defined as "a time value" and 4 bytes
    const duration = readUInt32BE(b);

    return { creationTime, modificationTime, id, duration };
  },

  // 8.4.2 Media header box (MediaHeaderBox)
  mdhd(b: BufferWrapper) {
    const creationTime = readUInt32BE(b) - hfsTimestampOffst;
    const modificationTime = readUInt32BE(b) - hfsTimestampOffst;
    const timescale = readUInt32BE(b);
    const duration = readUInt32BE(b);

    return { creationTime, modificationTime, timescale, duration };
  },

  // 8.4.3 Handler reference box (HandlerBox)
  hdlr(b: BufferWrapper, len: number) {
    const componentType = readAscii(b, 4);
    const componentSubtype = readAscii(b, 4);

    // manufacturer (4)
    skip(b, 4);

    // flags (4);
    skip(b, 4);

    // flags mask
    skip(b, 4);

    const strLen = readUInt8(b);
    const componentName = readUtf8(b, strLen);

    return { componentType, componentSubtype, componentName };
  },

  // 8.5.2 Sample description box (SampleTableBox)
  // TODO got this from https://developer.apple.com/library/archive/documentation/QuickTime/QTFF/QTFFChap3/qtff3.html
  stsd(b: BufferWrapper) {
    const n = readUInt32BE(b);

    const sampleDescriptionSize = readUInt32BE(b);

    const dataFormat = readAscii(b, 4);

    // reserved (6)
    skip(b, 6);

    const dataReferenceIndex = readUInt16BE(b);

    return { n, sampleDescriptionSize, dataFormat, dataReferenceIndex };
  },

  // 8.6.1.2 Decoding time to sample box (TimeToSampleBox)
  stts(b: BufferWrapper) {
    const n = readUInt32BE(b);

    const table: [number, number][] = [];

    for (let i = 0; i < n; i++) {
      table.push([readUInt32BE(b), readUInt32BE(b)]);
    }

    return { n, table };
  },

  // 8.7.4 Sample to chunk box (SampleToChunkBox)
  stsc(b: BufferWrapper) {
    const n = readUInt32BE(b);

    const table: [number, number, number][] = [];

    for (let i = 0; i < n; i++) {
      table.push([readUInt32BE(b), readUInt32BE(b), readUInt32BE(b)]);
    }

    return { n, table };
  },

  // 8.7.3.2 Sample size box (SampleSizeBox)
  stsz(b: BufferWrapper) {
    const sampleSize = readUInt32BE(b);
    const n = readUInt32BE(b);

    const table = [];

    if (sampleSize === 0) {
      for (let i = 0; i < n; i++) {
        table.push(readUInt32BE(b));
      }
    }

    return { n, sampleSize, table };
  },

  // 8.7.5 Chunk offset box (SampleToChunkBox)
  stco(b: BufferWrapper) {
    const n = readUInt32BE(b);

    const table = [];

    for (let i = 0; i < n; i++) {
      table.push(readUInt32BE(b));
    }

    return { n, table };
  },
} as const;

/*
The list of text strings uses a small integer atom format, which is identical
to the QuickTime atom format except that it uses 16-bit values for size and
type instead of 32-bit values. The first value is the size of the string,
including the size and type, and the second value is the language code for the
string.

- https://developer.apple.com/library/archive/documentation/QuickTime/QTFF/QTFFChap2/qtff2.html#//apple_ref/doc/uid/TP40000939-CH204-BBCGFIDH
*/
export function parseSmallIntBoxes(buf: DataView, offset: number, end: number) {
  const result = [];
  while (offset < end) {
    const len = buf.getUint16(offset);
    if (len === 0) {
      // i think this is what this means:
      // For historical reasons, the data list is optionally terminated by a 32-bit integer set to 0. If you are writing a program to read user data atoms, you should allow for the terminating 0. However, if you are writing a program to create user data atoms, you can safely leave out the terminating 0.
      break;
    }
    offset += 2;
    const type = buf.getUint16(offset);
    offset += 2;
    const end = offset + len;
    const value = utf8decoder.decode(new DataView(buf.buffer, offset, len));
    offset = end;
    result.push({ type, len, value });
  }
  return result;
}

export type Box = {
  len: number;
  fourcc: string;
  parentType: string | undefined;
  fileOffset: number;
};

function parseBox(
  fileOffset: number,
  data: BufferWrapper,
  parent: Box | Root
): Box {
  const len = readUInt32BE(data);
  const type = latin18decoder.decode(slice(data, 4));
  return {
    len,
    fourcc: type,
    fileOffset,
    parentType: parent.fourcc,
  };
}

const containers = new Set([
  'moov',
  'trak',
  'mdia',
  'minf',
  'stbl',
  'udta',
  'gmhd',
  'dinf',
  'tref',
]);

async function readValue(data: SeekableBuffer, box: Box): Promise<any> {
  if (box.parentType === 'udta') {
    // TODO from https://developer.apple.com/library/archive/documentation/QuickTime/QTFF/QTFFChap2/qtff2.html#//apple_ref/doc/uid/TP40000939-CH204-BBCCFFGD
    await data.move(box.fileOffset + 8, box.len - 8);
    if (box.fourcc.charCodeAt(0) === 169) {
      return parseSmallIntBoxes(
        data.buf,
        data.offset,
        data.offset + box.len - 8
      );
    } else {
      return new DataView(
        data.buf.buffer,
        data.buf.byteOffset + data.offset,
        box.len - 8
      );
    }
  } else {
    const parser = boxParsers[box.fourcc as keyof typeof boxParsers];
    if (parser) {
      await data.move(box.fileOffset + 8, 1);
      const version = data.buf.getInt8(data.offset);
      if (version !== 0) {
        throw new Error(
          `don't support v ${version} for box ${box.fourcc} at ${box.fileOffset}`
        );
      }
      await data.move(box.fileOffset + 12, box.len - 12);

      return parser(data, box.len);
    }
  }
}
