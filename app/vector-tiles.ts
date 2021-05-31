import { Tile } from './worker-stuff';

const extent = 4096;

export function drawTile(
  ctx: CanvasRenderingContext2D,
  tile: Tile,
  size: number
) {
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
