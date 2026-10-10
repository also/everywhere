import { readdirSync, readFileSync } from 'fs';
import * as path from 'path';

import { getConfig } from './config';

export function dataPath(...segments: string[]) {
  return path.join(getConfig().dataDir, ...segments);
}

export function* readAllJson<T>(
  dir: string,
  filter = /.+\..*json$/
): Generator<T> {
  const filenames = readdirSync(dataPath(dir));
  for (const filename of filenames) {
    if (filter.test(filename)) {
      yield JSON.parse(readFileSync(dataPath(dir, filename), 'utf8'));
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
