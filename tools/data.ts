import { readdirSync, readFileSync } from 'fs';
import * as path from 'path';

const dataPath = path.join(__dirname, '..', 'data');

export function* readAllJson<T>(
  dir: string,
  filter = /.+\..*json$/
): Generator<T> {
  const filenames = readdirSync(path.join(dataPath, dir));
  for (const filename of filenames) {
    if (filter.test(filename)) {
      yield JSON.parse(
        readFileSync(path.join(dataPath, dir, filename), 'utf8')
      );
    }
  }
}

export function* mapGen<T, U>(
  gen: Generator<T>,
  fn: (value: T) => U | undefined
): Generator<U> {
  for (const value of gen) {
    const result = fn(value);
    if (result) {
      yield result;
    }
  }
}
