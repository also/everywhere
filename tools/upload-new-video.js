import * as path from 'path';
import * as fs from 'fs';
import { sync as globSync } from 'glob';

import { Upload } from '@aws-sdk/lib-storage';

import { Bucket, client } from './s3-client';
import { listVids, simpleNames } from './list-s3-videos';

export default async function ({ _: [dir = 'video'] }) {
  const existingVids = simpleNames(await listVids('raw'));

  const local = simpleNames(globSync(path.join(dir, '*.MP4')));
  const toUpload = new Set(local);
  existingVids.forEach((name) => toUpload.delete(name));

  console.log({ toUpload });

  const first = toUpload[Symbol.iterator]().next().value;
  if (first) {
    const basename = `${first}.MP4`;
    const Key = `everywhere/video/raw/${basename}`;
    const upload = new Upload({
      client,
      params: {
        Bucket,
        Key,
        Body: fs.createReadStream(path.join(dir, basename)),
      },
    });

    console.log(Key);

    upload.on('httpUploadProgress', (progress) =>
      process.stdout.write(`${JSON.stringify(progress)}\r`)
    );

    await upload.done();
    return true;
  } else {
    return Promise.resolve(false);
  }
}
