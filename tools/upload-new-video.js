import * as path from 'path';
import { sync as globSync } from 'glob';

import { Bucket, client } from './s3-client';
import { list, simpleNames } from './list-s3-videos';

export default function({ _: [dir = 'video'] }) {
  list('raw')
    .then(simpleNames)
    .then(raw => {
      const local = simpleNames(globSync(path.join(dir, '*.MP4')));
      const toUpload = new Set(local);
      raw.forEach(name => toUpload.delete(name));

      const first = toUpload[Symbol.iterator]().next().value;
      if (first) {
        const basename = `${first}.MP4`;
        const Key = `everywhere/video/raw/${basename}`;
        const upload = client.uploadFile({
          localFile: path.join(dir, basename),
          s3Params: { Bucket, Key },
        });

        console.log(Key);

        return new Promise((resolve, reject) => {
          upload.on('progress', () =>
            process.stdout.write(
              `${((upload.progressAmount / upload.progressTotal) * 100).toFixed(
                2
              )}\r`
            )
          );
          upload.on('end', resolve(Key));
          upload.on('error', err => reject(err));
        });
      } else {
        return Promise.resolve(false);
      }
    })
    .catch(err => console.error(err.stack));
}
