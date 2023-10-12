import {
  Feature,
  GeoJsonProperties,
  LineString,
  MultiLineString,
} from 'geojson';
import { Tile, TileCoords } from 'geojson-vt';
import { positionDistance } from './distance';
import { shouldShowHighwayAtZoom } from './osm';
import { interpolateTurbo as interpolate } from 'd3-scale-chromatic';
import {
  LineRTree,
  RTreeItem,
  nearestLine,
  pointLineSegmentItemDistance,
} from './geo';

export interface TileRenderOpts {
  selectedId: string | number | undefined;
}

const extent = 4096;

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

export function color(d: number, scale = interpolate) {
  return scale(
    -clamp(
      mapRange(d, minDistance, maxDistance, minOpacity, maxOpacity),
      minOpacity,
      maxOpacity
    ) + 1
  );
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

export const minDistance = 100;
export const maxDistance = 500;

function computeSquareSize(
  initialSize: number,
  referenceZ: number,
  targetZ: number
) {
  const scaleFactor = Math.pow(2, targetZ - referenceZ);
  return initialSize * scaleFactor;
}

export function drawDistanceTile(
  canvas: HTMLCanvasElement | OffscreenCanvas,
  coords: TileCoords,
  featureTree:
    | LineRTree<Feature<LineString | MultiLineString, GeoJsonProperties>>
    | undefined
) {
  const size = canvas.width;
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  const ctx = canvas.getContext('2d')!;

  // TODO still looks better with just "5" - probably want a nonlinear scale
  // const squareSize = computeSquareSize(4, 11, coords.z);
  const squareSize = 8;
  let prev:
    | {
        item: RTreeItem<
          Feature<LineString | MultiLineString, GeoJsonProperties>
        >;
        distance: number;
      }
    | undefined;

  for (let x = 0; x < size; x += squareSize) {
    for (let y = 0; y < size; y += squareSize) {
      const lat = tile2lat(coords.y + (y + squareSize / 2) / size, coords.z);
      const lng = tile2long(coords.x + (x + squareSize / 2) / size, coords.z);

      let d: number;

      const point = [lng, lat];

      if (
        prev &&
        pointLineSegmentItemDistance(point, prev.item, positionDistance) <=
          minDistance
      ) {
        d = minDistance;
      } else {
        const p = featureTree
          ? nearestLine(featureTree, point, maxDistance, minDistance)
          : undefined;
        d = p?.distance ?? maxDistance;
        prev = p;
      }
      ctx.fillStyle = color(d).replace('rgb', 'rgba').replace(')', ', 0.5)');
      ctx.fillRect(x, y, squareSize, squareSize);
    }
  }
}

function drawDebugInfo(
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  size: number,
  tile: Tile,
  z: number
) {
  const text = `${z} ${tile.x} ${tile.y}: ${tile.features.length} features`;

  ctx.font = '14px monospace';
  ctx.fillStyle = 'white';
  ctx.fillText(text, 12, 22);
  ctx.fillStyle = 'black';
  ctx.fillText(text, 10, 20);

  ctx.strokeStyle = 'black';
  ctx.strokeRect(0, 0, size, size);
}

export function drawTile2(
  canvas: HTMLCanvasElement | OffscreenCanvas,
  tile: Tile,
  z: number,
  opts: TileRenderOpts | undefined
) {
  const size = canvas.width;
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  const ctx = canvas.getContext('2d')!;
  const ratio = size / extent;
  const pad = 0;

  let selectedFeature;

  function drawFeature(
    feat: Tile['features'][0],
    isStroke = false,
    isSelected = false
  ) {
    const { type, geometry } = feat;
    if (type !== 2) {
      return;
    }

    const highway = feat.tags.highway as string;
    if (highway && !shouldShowHighwayAtZoom(highway, z)) {
      return;
    }

    ctx.beginPath();
    ctx.lineJoin = 'round';
    ctx.strokeStyle = isSelected ? 'blue' : isStroke ? 'white' : '#00dcc2';
    ctx.lineWidth = isSelected || isStroke ? 8 : 2;
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
      //
    } else {
      drawFeature(feat, true);
    }
  });
  tile.features.forEach((feat) => {
    if (feat.id == opts?.selectedId) {
      selectedFeature = feat;
    } else {
      drawFeature(feat);
    }
  });
  if (selectedFeature) {
    drawFeature(selectedFeature, false, true);
  }

  //   drawDebugInfo(ctx, size, tile, z);
}
