import * as path from 'path';

import { list } from './s3-client';

export function simpleName(filename) {
  return path.basename(filename, '.MP4');
}

export function simpleNames(filenames) {
  return filenames.map(simpleName);
}

export async function listVids(dir) {
  return (await list(`everywhere/video/${dir ? dir + '/' : ''}`))
    .map(({ Key }) => Key)
    .filter((filename) => path.extname(filename) === '.MP4');
}

export default async function ({ _: [dir] }) {
  const vids = await listVids(dir);
  console.log(vids);
}
