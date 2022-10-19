import {
  Feature,
  GeoJsonProperties,
  LineString,
  MultiLineString,
} from 'geojson';
import { Tile, TileCoords } from 'geojson-vt';
import { positionDistance } from './distance';
import { highwayLevels } from './osm';
import { Leaf, Node, pointDistance } from './tree';
import { getTile, renderTileInWorker } from './worker-stuff';
import { WorkerChannel } from './WorkerChannel';

export interface TileRenderOpts {
  selectedId: string | number | undefined;
}

const extent = 4096;

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

function tile2long(x: number, z: number) {
  return (x / Math.pow(2, z)) * 360 - 180;
}
function tile2lat(y: number, z: number) {
  const n = Math.PI - (2 * Math.PI * y) / Math.pow(2, z);
  return (180 / Math.PI) * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n)));
}

function clamp(value: number, a: number, b: number) {
  return Math.max(Math.min(value, Math.max(a, b)), Math.min(a, b));
}

function mapRange(
  value: number,
  inMin: number,
  inMax: number,
  outMin: number,
  outMax: number
) {
  return ((value - inMin) * (outMax - outMin)) / (inMax - inMin) + outMin;
}

const minOpacity = 0.8;
const maxOpacity = 0.0;

const minDistance = 200;
const maxDistance = 300;

export function drawDistanceTile(
  canvas: HTMLCanvasElement | OffscreenCanvas,
  coords: TileCoords,
  featureTree:
    | Node<Feature<LineString | MultiLineString, GeoJsonProperties>>
    | undefined
) {
  const size = canvas.width;
  const ctx = canvas.getContext('2d')!;

  const squareSize = 10;
  let prev:
    | {
        node: Leaf<Feature<LineString | MultiLineString, GeoJsonProperties>>;
        distance: number;
      }
    | undefined;

  for (let x = 0; x < size; x += squareSize) {
    for (let y = 0; y < size; y += squareSize) {
      const lat = tile2lat(coords.y + (y + squareSize / 2) / size, coords.z);
      const lng = tile2long(coords.x + (x + squareSize / 2) / size, coords.z);

      let d: number;

      if (
        prev?.node &&
        prev.node.distance([lng, lat], positionDistance) <= minDistance
      ) {
        d = minDistance;
      } else {
        const p = featureTree?.nearestWithDistance(
          [lng, lat],
          positionDistance,
          minDistance,
          maxDistance
        );
        d = p?.distance ?? maxDistance;
        prev = p;
      }
      const v = positionDistance(
        [lng, lat],
        [-71.03517293930055, 42.33059904560688]
      );
      ctx.fillStyle = `rgba(0, 0, 155, ${clamp(
        mapRange(d, minDistance, maxDistance, minOpacity, maxOpacity),
        minOpacity,
        maxOpacity
      )})`;
      ctx.fillRect(x, y, squareSize, squareSize);
    }
  }
}

export function drawTile2(
  canvas: HTMLCanvasElement | OffscreenCanvas,
  tile: Tile,
  z: number,
  opts: TileRenderOpts | undefined
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
    if (feat.id == opts?.selectedId) {
      selectedFeature = feat;
    } else {
      drawFeature(feat);
    }
  });
  if (selectedFeature) {
    drawFeature(selectedFeature, true);
  }

  // const text = `${z} ${tile.x} ${tile.y}: ${tile.features.length} features`;

  // ctx.font = '14px monospace';
  // ctx.fillStyle = 'white';
  // ctx.fillText(text, 12, 22);
  // ctx.fillStyle = 'black';
  // ctx.fillText(text, 10, 20);

  // ctx.strokeStyle = 'black';
  // ctx.strokeRect(0, 0, size, size);
}
