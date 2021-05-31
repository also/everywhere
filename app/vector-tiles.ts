import { getTile, renderTileInWorker, Tile } from './worker-stuff';
import { WorkerChannel } from './WorkerChannel';

const extent = 4096;

export async function drawTile(
  channel: WorkerChannel,
  canvas: HTMLCanvasElement,
  coords: any,
  size: number
) {
  if (canvas.transferControlToOffscreen) {
    const offscreen = canvas.transferControlToOffscreen();
    await channel.sendRequest(
      renderTileInWorker,
      {
        canvas: offscreen,
        coords,
      },
      [offscreen]
    );
  } else {
    const tile = await channel.sendRequest(getTile, coords);
    if (tile) {
      drawTile2(canvas, tile);
    }
  }
}

export function drawTile2(
  canvas: HTMLCanvasElement | OffscreenCanvas,
  tile: Tile
) {
  const size = canvas.width;
  const ctx = canvas.getContext('2d')!;
  const ratio = size / extent;
  const pad = 0;
  tile.features.forEach(({ type, geometry }) => {
    ctx.beginPath();
    ctx.strokeStyle = 'red';
    // TODO handle points
    geometry.forEach((points) => {
      points.forEach(([x, y], i) => {
        if (i > 0) {
          ctx.lineTo(x * ratio + pad, y * ratio + pad);
        } else {
          ctx.moveTo(x * ratio + pad, y * ratio + pad);
        }
      });
    });
    ctx.stroke();
  });
}
