import { listVids, simpleNames } from './list-s3-videos';
import { encode } from './zencoder';

export default async function(argv) {
  const rawPromise = listVids('raw').then(simpleNames);
  const encodedPromise = listVids('mp4-low').then(simpleNames);

  const raw = await rawPromise;
  const encoded = await encodedPromise;

  const toEncode = new Set(raw);
  encoded.forEach(name => toEncode.delete(name));
  console.log(
    `${raw.length} total, ${encoded.length} already encoded, ${toEncode.size} to encode`
  );
  throw new Error('remove this line'); // running this costs money
  toEncode.forEach(name => {
    console.log(`submitting ${name}`);
    encode(name).then(() => `finished ${name}`);
  });
}
