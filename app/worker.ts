import { WorkerChannel, workerHandshake } from './WorkerChannel';

import geojsonvt from 'geojson-vt';
import { getTile, renderTileInWorker, setWorkerFile } from './worker-stuff';
import { features } from './geo';
import { drawTile2 } from './vector-tiles';

const channel = new WorkerChannel(self.postMessage.bind(self), self);
channel.handle(workerHandshake, () => 'pong');

let file: File | undefined = undefined;
let tileIndex: any = undefined;
channel.handle(setWorkerFile, async (f) => {
  file = f;
  if (file) {
    const value = JSON.parse(await file.text());
    const f = value.type === 'Topology' ? features(value) : value;
    tileIndex = geojsonvt(f, { maxZoom: 24 });
  }
});

channel.handle(getTile, ({ z, x, y }) => tileIndex?.getTile(z, x, y));

channel.handle(renderTileInWorker, ({ canvas, coords: { z, x, y } }) => {
  const tile = tileIndex?.getTile(z, x, y);
  if (tile) {
    drawTile2(canvas, tile, z);
  }
});
