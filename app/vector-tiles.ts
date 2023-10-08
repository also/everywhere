import { drawTile2, TileRenderOpts } from './tile-drawing';
import {
  getTile,
  renderDistanceTileInWorker,
  renderTileInWorker,
} from './worker-stuff';
import { WorkerChannel } from './WorkerChannel';

export async function drawTile(
  channel: WorkerChannel,
  canvas: HTMLCanvasElement,
  coords: { x: number; y: number; z: number },
  opts: TileRenderOpts | undefined
) {
  if (canvas.transferControlToOffscreen) {
    const offscreen = canvas.transferControlToOffscreen();
    await channel.sendRequest(
      renderTileInWorker,
      {
        canvas: offscreen,
        coords,
        opts,
      },
      [offscreen]
    );
  } else {
    const tile = await channel.sendRequest(getTile, coords);
    if (tile) {
      // TODO support feature tree rendering in safari?
      drawTile2(canvas, tile, coords.z, opts);
    }
  }
}
export async function drawDistanceTile(
  channel: WorkerChannel,
  canvas: HTMLCanvasElement,
  coords: { x: number; y: number; z: number },
  opts: TileRenderOpts | undefined
) {
  const offscreen = canvas.transferControlToOffscreen();
  await channel.sendRequest(
    renderDistanceTileInWorker,
    {
      canvas: offscreen,
      coords,
      opts,
    },
    [offscreen]
  );
}
