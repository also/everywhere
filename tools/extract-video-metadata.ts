import fs from 'fs';
import path from 'path';
import SeekableFileBuffer from './parse/SeekableFileBuffer';
import { extractGps } from './parse/gopro-gps';
import { bind, fileRoot } from './parse';
import { parser as mp4Parser } from './parse/mp4';
import { getMeta } from './parse/gpmf';
import { Feature } from 'geojson';

async function extractFileGps(filename: string): Promise<Feature> {
  const data = new SeekableFileBuffer(
    fs.openSync(filename, 'r'),
    Buffer.alloc(10240)
  );

  const mp4 = bind(mp4Parser, data, fileRoot(data));

  const track = await getMeta(mp4);

  return extractGps(track, mp4);
}

export default async function ({ _: [filename, destDir] }: { _: string[] }) {
  const files = fs.statSync(filename).isDirectory()
    ? fs
        .readdirSync(filename)
        .filter((f) => f.toLowerCase().endsWith('.mp4'))
        .map((f) => path.join(filename, f))
    : [filename];

  if (!destDir) {
    destDir = path.join(__dirname, '..');
  }

  const toProcess = files
    .map((f) => {
      const basename = path.basename(f);
      const dest = path.join(
        destDir,
        'app-data',
        'video-metadata',
        basename + '.geojson'
      );

      return { f, dest };
    })
    .filter(({ dest }) => !fs.existsSync(dest));

  let i = 0;
  for (const { f, dest } of toProcess) {
    const basename = path.basename(f);
    console.log(basename, (i++ / toProcess.length) * 100);

    try {
      const geojson = await extractFileGps(f);
      fs.writeFileSync(dest, JSON.stringify(geojson));
    } catch (e) {
      console.log(e);
    }
  }
}
