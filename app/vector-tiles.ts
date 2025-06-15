import { TileRenderOpts } from './tile-drawing';
import { renderDistanceTileInWorker, renderTileInWorker } from './worker-stuff';
import { WorkerChannel } from './WorkerChannel';

export async function drawTile(
  channel: WorkerChannel,
  canvas: HTMLCanvasElement,
  coords: { x: number; y: number; z: number },
  opts: TileRenderOpts | undefined
) {
  const bitmap = await channel.sendRequest(renderTileInWorker, {
    size: canvas.width,
    coords,
    opts,
  });
  canvas.getContext('bitmaprenderer')!.transferFromImageBitmap(bitmap);
}
export async function drawDistanceTile(
  channel: WorkerChannel,
  canvas: HTMLCanvasElement,
  coords: { x: number; y: number; z: number },
  opts: TileRenderOpts | undefined
) {
  // TODO opts are not used
  const bitmap = await channel.sendRequest(renderDistanceTileInWorker, {
    size: canvas.width,
    coords,
  });
  canvas.getContext('bitmaprenderer')!.transferFromImageBitmap(bitmap);
}
