import { Parser, Root } from '.';
import { BufferWrapper, SeekableBuffer } from './buffers';

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
  mvhd: ({ buf, offset }: BufferWrapper) => {
    const creationTime = buf.readUInt32BE(offset) - hfsTimestampOffst;
    offset += 4;
    const modificationTime = buf.readUInt32BE(offset) - hfsTimestampOffst;
    offset += 4;

    const timescale = buf.readUInt32BE(offset);
    offset += 4;

    const duration = buf.readUInt32BE(offset);
    offset += 4;

    return { creationTime, modificationTime, timescale, duration };
  },

  // 8.3.2 Track header box (TrackHeaderBox)
  tkhd({ buf, offset }: BufferWrapper) {
    const creationTime = buf.readUInt32BE(offset) - hfsTimestampOffst;
    offset += 4;
    const modificationTime = buf.readUInt32BE(offset) - hfsTimestampOffst;
    offset += 4;
    const id = buf.readUInt32BE(offset);
    offset += 4;
    // reserved (4)
    offset += 4;

    // TODO only defined as "a time value" and 4 bytes
    const duration = buf.readUInt32BE(offset);
    offset += 4;

    return { creationTime, modificationTime, id, duration };
  },

  // 8.4.2 Media header box (MediaHeaderBox)
  mdhd({ buf, offset }: BufferWrapper) {
    const creationTime = buf.readUInt32BE(offset) - hfsTimestampOffst;
    offset += 4;
    const modificationTime = buf.readUInt32BE(offset) - hfsTimestampOffst;
    offset += 4;

    const timeScale = buf.readUInt32BE(offset);
    offset += 4;

    const duration = buf.readUInt32BE(offset);
    offset += 4;

    return { creationTime, modificationTime, timeScale, duration };
  },

  // 8.4.3 Handler reference box (HandlerBox)
  hdlr({ buf, offset }: BufferWrapper, len: number) {
    const componentType = buf.slice(offset, offset + 4).toString('ascii');
    offset += 4;
    const componentSubtype = buf.slice(offset, offset + 4).toString('ascii');
    offset += 4;

    // manufacturer (4)
    offset += 4;

    // flags (4);
    offset += 4;

    // flags mask
    offset += 4;

    let strEnd = offset + 1 + buf[offset];

    const componentName = buf.slice(offset + 1, strEnd).toString('utf8');

    return { componentType, componentSubtype, componentName };
  },

  // 8.5.2 Sample description box (SampleTableBox)
  // TODO got this from https://developer.apple.com/library/archive/documentation/QuickTime/QTFF/QTFFChap3/qtff3.html
  stsd({ buf, offset }: BufferWrapper) {
    const n = buf.readUInt32BE(offset);
    offset += 4;

    const sampleDescriptionSize = buf.readUInt32BE(offset);
    offset += 4;

    const dataFormat = buf.slice(offset, offset + 4).toString('ascii');
    offset += 4;

    // reserved (6)
    offset += 6;

    const dataReferenceIndex = buf.readUInt16BE(offset);

    return { n, sampleDescriptionSize, dataFormat, dataReferenceIndex };
  },

  // 8.6.1.2 Decoding time to sample box (TimeToSampleBox)
  stts({ buf, offset }: BufferWrapper) {
    const n = buf.readUInt32BE(offset);
    offset += 4;

    const table: [number, number][] = [];

    for (let i = 0; i < n; i++) {
      const count = buf.readUInt32BE(offset);
      offset += 4;
      const duration = buf.readUInt32BE(offset);
      offset += 4;
      table.push([count, duration]);
    }

    return { n, table };
  },

  // 8.7.4 Sample to chunk box (SampleToChunkBox)
  stsc({ buf, offset }: BufferWrapper) {
    const n = buf.readUInt32BE(offset);
    offset += 4;

    const table: [number, number, number][] = [];

    for (let i = 0; i < n; i++) {
      const firstChunk = buf.readUInt32BE(offset);
      offset += 4;
      const samplesPerChunk = buf.readUInt32BE(offset);
      offset += 4;
      const sampleDescriptionId = buf.readUInt32BE(offset);
      offset += 4;
      table.push([firstChunk, samplesPerChunk, sampleDescriptionId]);
    }

    return { n, table };
  },

  // 8.7.3.2 Sample size box (SampleSizeBox)
  stsz({ buf, offset }: BufferWrapper) {
    const sampleSize = buf.readUInt32BE(offset);
    offset += 4;

    const n = buf.readUInt32BE(offset);
    offset += 4;

    const table = [];

    if (sampleSize === 0) {
      for (let i = 0; i < n; i++) {
        const entrySize = buf.readUInt32BE(offset);
        offset += 4;

        table.push(entrySize);
      }
    }

    return { n, sampleSize, table };
  },

  // 8.7.5 Chunk offset box (SampleToChunkBox)
  stco({ buf, offset }: BufferWrapper) {
    const n = buf.readUInt32BE(offset);
    offset += 4;

    const table = [];

    for (let i = 0; i < n; i++) {
      const entrySize = buf.readUInt32BE(offset);
      offset += 4;

      table.push(entrySize);
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
export function parseSmallIntBoxes(buf: Buffer, offset: number, end: number) {
  const result = [];
  while (offset < end) {
    const len = buf.readUInt16BE(offset);
    if (len === 0) {
      // i think this is what this means:
      // For historical reasons, the data list is optionally terminated by a 32-bit integer set to 0. If you are writing a program to read user data atoms, you should allow for the terminating 0. However, if you are writing a program to create user data atoms, you can safely leave out the terminating 0.
      break;
    }
    offset += 2;
    const type = buf.readUInt16BE(offset);
    offset += 2;
    const end = offset + len;
    const value = buf.slice(offset, end).toString('utf8');
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

export function parseBox(data: SeekableBuffer, parent: Box | Root): Box {
  const { buf, filePos: fileOffset } = data;
  let { offset } = data;

  const len = buf.readUInt32BE(offset);
  offset += 4;
  const type = buf.slice(offset, offset + 4).toString('latin1');
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

export function readValue(data: SeekableBuffer, box: Box): any {
  if (box.parentType === 'udta') {
    // TODO from https://developer.apple.com/library/archive/documentation/QuickTime/QTFF/QTFFChap2/qtff2.html#//apple_ref/doc/uid/TP40000939-CH204-BBCCFFGD
    data.move(box.fileOffset + 8, box.len - 8);
    if (box.fourcc.charCodeAt(0) === 169) {
      return parseSmallIntBoxes(
        data.buf,
        data.offset,
        data.offset + box.len - 8
      );
    } else {
      return data.buf.slice(data.offset, data.offset + box.len - 8);
    }
  } else {
    const parser = boxParsers[box.fourcc as keyof typeof boxParsers];
    if (parser) {
      data.move(box.fileOffset + 8, 1);
      const version = data.buf[data.offset];
      if (version !== 0) {
        throw new Error(
          `don't support v ${version} for box ${box.fourcc} at ${box.fileOffset}`
        );
      }
      data.move(box.fileOffset + 12, box.len - 8);

      return parser(data, box.len);
    }
  }
}
