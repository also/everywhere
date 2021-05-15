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
  iterator(e: T | Root): Generator<T>;
  value(e: T): any;
  root: Root;
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
  };
}

export function* iterate<T extends Entry, S = undefined>(
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
    yield entry;
    data.move(entry.fileOffset + entry.len, 8);
  }
}

export function iterateChildren<T extends Entry, S = any>(
  parent: T,
  parser: Parser<T, S>,
  data: SeekableBuffer
): Generator<T> {
  return iterate(parser, data, parent);
}
