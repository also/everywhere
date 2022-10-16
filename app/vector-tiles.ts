import { Tile } from 'geojson-vt';
import { highwayLevels } from './osm';
import { getTile, renderTileInWorker } from './worker-stuff';
import { WorkerChannel } from './WorkerChannel';

const extent = 4096;

export async function drawTile(
  channel: WorkerChannel,
  canvas: HTMLCanvasElement,
  coords: any,
  selectedId: string | number | undefined
) {
  if (canvas.transferControlToOffscreen) {
    const offscreen = canvas.transferControlToOffscreen();
    await channel.sendRequest(
      renderTileInWorker,
      {
        canvas: offscreen,
        coords,
        selectedId,
      },
      [offscreen]
    );
  } else {
    const tile = await channel.sendRequest(getTile, coords);
    if (tile) {
      drawTile2(canvas, tile, coords.z, selectedId);
    }
  }
}

export function drawTile2(
  canvas: HTMLCanvasElement | OffscreenCanvas,
  tile: Tile,
  z: number,
  selectedId: string | number | undefined
) {
  const size = canvas.width;
  const ctx = canvas.getContext('2d')!;
  const ratio = size / extent;
  const pad = 0;

  let selectedFeature;

  function drawFeature(feat: Tile['features'][0], isSelected = false) {
    const highway = feat.tags.highway as string;
    const { type, geometry } = feat;
    if (type !== 2) {
      return;
    }
    if (highway) {
      const level = highwayLevels[highway];
      if (!level || level >= z) {
        return;
      }
    }
    ctx.beginPath();
    ctx.lineJoin = 'round';
    ctx.strokeStyle = isSelected ? 'blue' : 'red';
    ctx.lineWidth = isSelected ? 4 : 2;
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
  }
  tile.features.forEach((feat) => {
    if (feat.id == selectedId) {
      selectedFeature = feat;
    } else {
      drawFeature(feat);
    }
  });
  if (selectedFeature) {
    drawFeature(selectedFeature, true);
  }
}
