import { BufferWrapper, SeekableBuffer } from './buffers';

export interface Parser<T extends Entry, S = any> {
  parseEntry(
    fileOffset: number,
    data: BufferWrapper,
    parent: T | Root,
    state: S | undefined
  ): T;
  parseValue(data: SeekableBuffer, entry: T): Promise<any>;
  hasChildren(entry: T): boolean;
  nextState?(
    data: SeekableBuffer,
    entry: T,
    state: S | undefined
  ): Promise<S | undefined>;
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
  value<V = any>(e: T): Promise<V>;
  clone(): Traverser<T>;
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
      return e.fourcc === 'root'
        ? Promise.resolve(undefined)
        : parser.parseValue(data, e);
    },
    iterator(e) {
      if (e.fourcc === 'root' || parser.hasChildren(e as T)) {
        return iterate(parser, data, e);
      } else {
        // eslint-disable-next-line @typescript-eslint/no-empty-function
        return (async function* () {})();
      }
    },
    clone() {
      return bind(parser, data.view(), root);
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
  const start =
    parent.fourcc === 'root' ? parent.fileOffset : parent.fileOffset + 8;

  const end = parent.fileOffset + parent.len;
  let next = start;

  while (next < end) {
    await data.move(next, 8);
    const entry = parser.parseEntry(next, data, parent, state);
    if (parser.nextState) {
      state = await parser.nextState(data, entry, state);
    }
    // only encountered in the udta GPMF
    if (entry.fourcc === '\0\0\0\0') {
      break;
    }
    yield entry;
    next = entry.fileOffset + entry.len;
  }
}

export function iterateChildren<T extends Entry, S = any>(
  parent: T,
  parser: Parser<T, S>,
  data: SeekableBuffer
): AsyncGenerator<T> {
  return iterate(parser, data, parent);
}
