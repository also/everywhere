import L from 'leaflet';
import { drawTile } from './vector-tiles';
import { WorkerChannel } from './WorkerChannel';

export default class CanvasLayer extends L.GridLayer {
  selectedId: string | number | undefined;

  constructor(private channel: WorkerChannel) {
    // by default, GridLayer goes in the same pane as TileLayer and can end up behid the tiles
    // https://leafletjs.com/reference.html#map-pane
    // https://leafletjs.com/examples/map-panes/
    super({ pane: 'overlayPane' });
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

  setSelectedId(v: string | number | undefined) {
    this.selectedId = v;
    this.redraw();
  }
}
