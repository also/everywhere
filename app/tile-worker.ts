import { WorkerChannel, workerHandshake } from './WorkerChannel';

import { GeoJSONVT } from 'geojson-vt';
import {
  getTile,
  lookup,
  renderDistanceTileInWorker,
  renderTileInWorker,
  setWorkerFiles,
} from './worker-stuff';
import { LineRTree, filteredNearestLine } from './geo';
import { drawDebugInfo, drawDistanceTile, drawTile2 } from './tile-drawing';
import {
  Feature,
  GeoJsonProperties,
  LineString,
  MultiLineString,
  Point,
} from 'geojson';
import { shouldShowHighwayAtZoom } from './osm';
import { loadTileDataFromFiles } from './vector-tile-data';

// https://github.com/Microsoft/TypeScript/issues/20595
// self is a WorkerGlobalScope, but TypeScript doesn't know that
const ctx: Worker = self as any;

const channel = new WorkerChannel(ctx.postMessage.bind(ctx), ctx);

channel.handle(workerHandshake, () => 'pong');

let tileIndex: GeoJSONVT | undefined = undefined;

let featureTree:
  | LineRTree<Feature<LineString | MultiLineString | Point, GeoJsonProperties>>
  | undefined = undefined;

channel.handle(setWorkerFiles, async (files) => {
  const data = await loadTileDataFromFiles(files);

  tileIndex = data.tileIndex;
  featureTree = data.featureTree;
});

channel.handle(getTile, ({ z, x, y }) => tileIndex?.getTile(z, x, y));

const debug = false;

channel.handle(renderTileInWorker, ({ size, coords: { z, x, y }, opts }) => {
  const tile = tileIndex?.getTile(z, x, y);
  let offscreen: OffscreenCanvas | undefined;
  if (tile) {
    offscreen = new OffscreenCanvas(size, size);
    drawTile2(offscreen, tile, z, opts);
  }
  if (debug) {
    offscreen ??= new OffscreenCanvas(size, size);
    const ctx = offscreen.getContext('2d')!;
    drawDebugInfo(ctx, size, { x, y, z }, tile);
  }
  if (offscreen) {
    return offscreen.transferToImageBitmap();
  }
});

channel.handle(renderDistanceTileInWorker, ({ size, coords }) => {
  const offscreen = new OffscreenCanvas(size, size);
  drawDistanceTile(offscreen, coords, featureTree);
  return offscreen.transferToImageBitmap();
});

channel.handle(lookup, ({ coords, zoom }) => {
  const result = filteredNearestLine(featureTree!, coords, (i) => {
    if (i.data.properties?.highway) {
      return shouldShowHighwayAtZoom(i.data.properties.highway, zoom);
    } else {
      return true;
    }
  });
  return result
    ? { feature: result.item.data, distance: result.distance }
    : undefined;
});
