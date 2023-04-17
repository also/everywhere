import L from 'leaflet';
import { drawTile } from './vector-tiles';
import { WorkerChannel } from './WorkerChannel';
import { TileRenderOpts } from './tile-drawing';

export default class CanvasLayer extends L.GridLayer {
  opts: TileRenderOpts | undefined;

  constructor(private channel: WorkerChannel, private draw: typeof drawTile) {
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

    this.draw(this.channel, canvas, coords, this.opts).then(
      () => done(undefined, canvas),
      done
    );

    return canvas;
  }

  setOpts(v: TileRenderOpts | undefined) {
    this.opts = v;
    this.redraw();
  }
}
