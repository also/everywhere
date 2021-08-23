import L from 'leaflet';
import { drawTile } from './vector-tiles';
import { WorkerChannel } from './WorkerChannel';

export default class CanvasLayer extends L.GridLayer {
  selectedId: number | undefined;

  constructor(private channel: WorkerChannel) {
    super();
  }

  createTile(coords: L.Coords, done: L.DoneCallback) {
    const canvas = L.DomUtil.create('canvas') as HTMLCanvasElement;

    const size = this.getTileSize();
    canvas.width = size.x;
    canvas.height = size.y;

    drawTile(this.channel, canvas, coords, this.selectedId).then(
      () => done(undefined, canvas),
      done
    );

    return canvas;
  }

  setSelectedId(v: number | undefined) {
    this.selectedId = v;
    this.redraw();
  }
}
