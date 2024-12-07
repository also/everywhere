import { WorkerChannel, workerHandshake } from './WorkerChannel';

import geojsonVt, { GeoJSONVT } from 'geojson-vt';
import {
  features,
  featureSummary,
  getTile,
  lookup,
  renderDistanceTileInWorker,
  renderTileInWorker,
  toolFiles,
  toolFileStatus,
  toolReady,
} from './worker-stuff';
import { filteredNearestLine, LineRTree, tree } from './geo';
import { drawDebugInfo, drawDistanceTile, drawTile2 } from './tile-drawing';
import { shouldShowHighwayAtZoom } from './osm';
import { Tool, tools } from './tools';
import { Feature, FeatureCollection } from 'geojson';

// https://github.com/Microsoft/TypeScript/issues/20595
// self is a WorkerGlobalScope, but TypeScript doesn't know that
const ctx: Worker = self as any;

const channel = new WorkerChannel(ctx.postMessage.bind(ctx), ctx);

channel.handle(workerHandshake, () => 'pong');

export interface TileData {
  tileIndex: GeoJSONVT;
  featureTree: LineRTree<Feature>;
}

function createTileHandlers(data: TileData) {
  const tileIndex = data.tileIndex;
  const featureTree = data.featureTree;

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
}

channel.handle(toolFiles, async ({ files, tool: toolName }) => {
  let index = 0;
  const collection: FeatureCollection = {
    type: 'FeatureCollection',
    features: [],
  };

  const t = tools[toolName];
  const tool: Tool<any> =
    typeof t === 'function'
      ? {
          processFile: t,
          createState() {
            return undefined;
          },
        }
      : t;

  const toolState = tool.createState();

  for (const file of files) {
    try {
      channel.sendRequest(toolFileStatus, { index, status: 'processing' });
      const geoJson = await tool.processFile(file, toolState);
      if (geoJson) {
        if (geoJson.type === 'Feature') {
          collection.features.push(geoJson);
        } else if (geoJson.type === 'FeatureCollection') {
          collection.features.push(...geoJson.features);
        } else {
          // make a feature from the geometry
          collection.features.push({
            type: 'Feature',
            geometry: geoJson,
            properties: {},
          });
        }
      }

      channel.sendRequest(toolFileStatus, { index, status: 'done' });
    } catch (e) {
      channel.sendRequest(toolFileStatus, { index, status: 'error' });
    } finally {
      index++;
    }
  }

  let i = 0;
  for (const feature of collection.features) {
    feature.properties!.everywhereFeatureIndex = i;
    i++;
  }

  channel.handle(featureSummary, () =>
    collection.features.map((f) => ({
      id: f.id,
      properties: f.properties,
      geometry: { type: f.geometry.type },
    }))
  );

  channel.handle(features, () => collection.features);

  createTileHandlers({
    tileIndex: geojsonVt(collection, { maxZoom: 24 }),
    featureTree: tree(collection),
  });

  channel.sendRequest(toolReady, { resultType: 'tiles' });
});
