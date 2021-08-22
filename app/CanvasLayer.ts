import L from 'leaflet';
import { drawTile } from './vector-tiles';
import { WorkerChannel } from './WorkerChannel';

export default class CanvasLayer extends L.GridLayer {
  constructor(private channel: WorkerChannel) {
    super();
  }

  createTile(coords: L.Coords, done: L.DoneCallback) {
    const canvas = L.DomUtil.create('canvas') as HTMLCanvasElement;

    const size = this.getTileSize();
    canvas.width = size.x;
    canvas.height = size.y;

    drawTile(this.channel, canvas, coords).then(
      () => done(undefined, canvas),
      done
    );

    return canvas;
  }
}
