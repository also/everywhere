import { list, simpleNames } from './list-s3-videos';
import { encode } from './zencoder';

export default function(argv) {
  throw new Error('remove this line'); // running this costs money
  const rawPromise = list('raw').then(simpleNames);
  const encodedPromise = list('mp4-low').then(simpleNames);

  Promise.all([rawPromise, encodedPromise])
    .then(([raw, encoded]) => {
      const toEncode = new Set(raw);
      encoded.forEach(name => toEncode.delete(name));
      console.log(
        `${raw.length} total, ${encoded.length} already encoded, ${toEncode.size} to encode`
      );
      toEncode.forEach(name => {
        console.log(`submitting ${name}`);
        encode(name)
          .then(() => `finished ${name}`)
          .catch(err => console.log(err));
      });
    })
    .catch(err => console.log(err));
}
