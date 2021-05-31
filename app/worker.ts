import { WorkerChannel, workerHandshake } from './WorkerChannel';

import geojsonvt from 'geojson-vt';
import { getTile, setWorkerFile } from './worker-stuff';
import { features } from './geo';

const channel = new WorkerChannel(self.postMessage.bind(self), self);
channel.handle(workerHandshake, () => 'pong');

let file: File | undefined = undefined;
let tileIndex: any = undefined;
channel.handle(setWorkerFile, async (f) => {
  file = f;
  if (file) {
    const value = JSON.parse(await file.text());
    const f = features(value);
    tileIndex = geojsonvt(f, { maxZoom: 24 });
  }
});

channel.handle(getTile, ({ z, x, y }) => tileIndex?.getTile(z, x, y));
