import { SeekableBuffer } from './buffers';

export interface Parser<T extends Entry, S = any> {
  parseEntry(data: SeekableBuffer, parent: T | Root, state: S | undefined): T;
  parseValue(data: SeekableBuffer, entry: T): any;
  hasChildren(entry: T): boolean;
  nextState?(
    data: SeekableBuffer,
    entry: T,
    state: S | undefined
  ): S | undefined;
}

export interface Entry {
  fourcc: string;
  fileOffset: number;
  len: number;
}

export type Root = {
  fourcc: 'root';
  fileOffset: number;
  len: number;
};

export function fileRoot(data: SeekableBuffer): Root {
  return root(0, data.size);
}

export function root(fileOffset: number, len: number): Root {
  return { fourcc: 'root', fileOffset, len };
}

export interface Traverser<T extends Entry> {
  parser: Parser<T, any>;
  iterator(e: T | Root): AsyncIterable<T>;
  value(e: T): any;
  root: Root;
  data: SeekableBuffer;
}

export function bind<T extends Entry>(
  parser: Parser<T>,
  data: SeekableBuffer,
  root: Root
): Traverser<T> {
  return {
    parser,
    root,
    value(e) {
      return parser.parseValue(data, e);
    },
    iterator(e) {
      return iterate(parser, data, e);
    },
    data,
  };
}

export async function* iterate<T extends Entry, S = undefined>(
  parser: Parser<T, S>,
  data: SeekableBuffer,
  parent: T | Root
) {
  let state;
  let start;
  if (parent.fourcc === 'root') {
    start = parent.fileOffset;
  } else {
    start = parent.fileOffset + 8;
  }
  const end = parent.fileOffset + parent.len;
  data.move(start, 8);

  while (data.filePos < end) {
    const entry = parser.parseEntry(data, parent, state);
    if (parser.nextState) {
      state = parser.nextState(data, entry, state);
    }
    // only encountered in the udta GPMF
    if (entry.fourcc === '\0\0\0\0') {
      break;
    }
    yield entry;
    data.move(entry.fileOffset + entry.len, 8);
  }
}

export function iterateChildren<T extends Entry, S = any>(
  parent: T,
  parser: Parser<T, S>,
  data: SeekableBuffer
): AsyncGenerator<T> {
  return iterate(parser, data, parent);
}

export function nullTerminated(buf: Buffer): string {
  const end = buf.findIndex((v) => v === 0);
  if (end) {
    buf = buf.slice(0, end);
  }
  return buf.toString('utf8');
}
