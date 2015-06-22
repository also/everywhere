import * as path from 'path';

import {client, Bucket} from './s3-client';

export function simpleName(filename) {
  return path.basename(filename, '.MP4');
}

export function simpleNames(filenames) {
  return filenames.map(simpleName);
}

export function list(dir) {
  return new Promise((resolve, reject) => {
    const req = client.listObjects({s3Params: {Bucket, Prefix: `everywhere/video/${dir}/`}});
    const result = [];
    req.on('data', ({Contents}) => result.push(...Contents.map(({Key}) => Key).filter(filename => path.extname(filename) === '.MP4')));
    req.on('error', err => reject(err));
    req.on('end', () => resolve(result));
  });
}

export default function({_: [dir='']}) {
  list(dir)
  .then(
    (vids) => console.log(vids),
    (err) => console.log(err)
  );
}
