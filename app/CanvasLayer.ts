import L from 'leaflet';
import { drawTile } from './vector-tiles';
import { getTile } from './worker-stuff';
import { WorkerChannel } from './WorkerChannel';

export default L.GridLayer.extend({
  initialize(channel: WorkerChannel) {
    this.channel = channel;
  },

  createTile(
    this: { channel: WorkerChannel } & L.GridLayer,
    coords: L.Coords,
    done: L.DoneCallback
  ) {
    const canvas = L.DomUtil.create('canvas') as HTMLCanvasElement;

    const size = this.getTileSize();
    canvas.width = size.x;
    canvas.height = size.y;

    const ctx = canvas.getContext('2d')!;

    this.channel.sendRequest(getTile, coords).then((tile) => {
      if (tile) {
        drawTile(ctx, tile, size.x);
      }
      done(undefined, canvas);
    }, done);

    return canvas;
  },
});
