import fs from 'fs';
import path from 'path';
import SeekableFileBuffer from './parse/SeekableFileBuffer';
import { extractGps } from './parse/gopro-gps';

async function extractFileGps(filename: string): Promise<GeoJSON.Feature> {
  const data = new SeekableFileBuffer(
    fs.openSync(filename, 'r'),
    Buffer.alloc(10240)
  );

  return extractGps(data);
}

export default async function ({ _: [filename] }: { _: string[] }) {
  const files = fs.statSync(filename).isDirectory()
    ? fs
        .readdirSync(filename)
        .filter((f) => f.toLowerCase().endsWith('.mp4'))
        .map((f) => path.join(filename, f))
    : [filename];

  let i = 0;
  for (const f of files) {
    const basename = path.basename(f);
    console.log(basename, (i++ / files.length) * 100);
    const dest = path.join(
      __dirname,
      '..',
      'app-data',
      'video-metadata',
      basename + '.geojson'
    );

    if (!fs.existsSync(dest) || true) {
      try {
        const geojson = await extractFileGps(f);
        fs.writeFileSync(dest, JSON.stringify(geojson));
      } catch (e) {
        console.log(e);
      }
    }
  }
}
