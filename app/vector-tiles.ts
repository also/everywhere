import { getTile, renderTileInWorker, Tile } from './worker-stuff';
import { WorkerChannel } from './WorkerChannel';

const extent = 4096;

export async function drawTile(
  channel: WorkerChannel,
  canvas: HTMLCanvasElement,
  coords: any
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
      drawTile2(canvas, tile, coords.z);
    }
  }
}

const highwayLevels: Record<string, number> = {
  motorway: 3,
  trunk: 5,
  primary: 10,
  secondary: 11,
  tertiary: 13,
  residential: 14,
};

export function drawTile2(
  canvas: HTMLCanvasElement | OffscreenCanvas,
  tile: Tile,
  z: number
) {
  const size = canvas.width;
  const ctx = canvas.getContext('2d')!;
  const ratio = size / extent;
  const pad = 0;
  tile.features.forEach((feat) => {
    const highway = feat.tags.highway as string;
    if (highway) {
      const level = highwayLevels[highway];
      if (!level || level >= z) {
        return;
      }
    }
    const { type, geometry } = feat;
    ctx.beginPath();
    ctx.strokeStyle = 'red';
    ctx.lineWidth = 2;
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
