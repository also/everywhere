import { Traverser, Entry, Root } from '.';

type FindPath = string[];
type FindFn<E extends Entry, T> = (entry: E) => T | Promise<T>;

export type Truthy<T> = T extends null | undefined | false | 0 ? never : T;

export async function findFirst<E extends Entry, T>(
  traverser: Traverser<E>,
  parent: E | Root,
  path: string[],
  fn: FindFn<E, T>
): Promise<Truthy<T> | undefined> {
  for await (const entry of find(traverser, parent, path, fn)) {
    return entry;
  }
}

export async function findRequired<E extends Entry, T>(
  traverser: Traverser<E>,
  parent: E | Root,
  path: string[],
  fn: FindFn<E, T>
): Promise<Truthy<T>> {
  for await (const entry of find(traverser, parent, path, fn)) {
    return entry;
  }
  throw new Error(`missing required entry ${path.join('.')}`);
}

type Mapper<E extends Entry> = {
  [fourcc: string]: (value: any) => any;
};

type Mapped<M extends Mapper<any>> = {
  [K in keyof M]: ReturnType<M[K]>;
};

export async function findAllValues<E extends Entry, M extends Mapper<E>>(
  traverser: Traverser<E>,
  parent: E | Root,
  mapper: M
): Promise<Mapped<M>> {
  const result: any = {};
  const missing = new Set(Object.keys(mapper));
  for await (const entry of traverser.iterator(parent)) {
    if (missing.delete(entry.fourcc)) {
      result[entry.fourcc] = mapper[entry.fourcc](
        await traverser.xvalue(entry)
      );
    }
  }

  if (missing.size > 0) {
    throw new Error(`missing ${[...missing].join(', ')}`);
  }

  return result;
}

export async function* find<E extends Entry, T>(
  traverser: Traverser<E>,
  parent: E | Root,
  path: FindPath,
  fn: FindFn<E, T>
): AsyncGenerator<Truthy<T>> {
  if (path.length === 0) {
    return;
  }
  const [current, ...rest] = path;
  for await (const entry of traverser.iterator(parent)) {
    if (entry.fourcc === current) {
      if (rest.length === 0) {
        const result = await fn(entry);
        if (result) {
          // TODO can we do better with truthy?
          yield result as any;
        }
      } else {
        if (traverser.parser.hasChildren(entry)) {
          for await (const child of find(traverser, entry, rest, fn)) {
            yield child;
          }
        }
      }
    }
  }
}

export async function* findAnywhere<E extends Entry, T>(
  traverser: Traverser<E>,
  parent: E | Root,
  fn: FindFn<E, T>,
  path: E[] = []
): AsyncGenerator<E[]> {
  for await (const entry of traverser.iterator(parent)) {
    if (await fn(entry)) {
      yield [...path, entry];
    }
    if (traverser.parser.hasChildren(entry)) {
      for await (const child of findAnywhere(traverser, entry, fn, [
        ...path,
        entry,
      ])) {
        yield child;
      }
    }
  }
}
