import { WorkerChannel, workerHandshake } from './WorkerChannel';

import geojsonvt, { GeoJSONVT } from 'geojson-vt';
import {
  getTile,
  lookup,
  renderDistanceTileInWorker,
  renderTileInWorker,
  setWorkerFiles,
} from './worker-stuff';
import { LineRTree, features, tree, filteredNearestLine } from './geo';
import { drawDistanceTile, drawTile2 } from './tile-drawing';
import {
  Feature,
  FeatureCollection,
  GeoJsonProperties,
  LineString,
  MultiLineString,
} from 'geojson';
import { highwayLevels, shouldShowHighwayAtZoom } from './osm';
import { mp4ToGeoJson } from './file-data';

// https://github.com/Microsoft/TypeScript/issues/20595
// self is a WorkerGlobalScope, but TypeScript doesn't know that
const ctx: Worker = self as any;

const channel = new WorkerChannel(ctx.postMessage.bind(ctx), ctx);

channel.handle(workerHandshake, () => 'pong');

let tileIndex: GeoJSONVT | undefined = undefined;

let featureTree:
  | LineRTree<Feature<LineString | MultiLineString, GeoJsonProperties>>
  | undefined = undefined;

channel.handle(setWorkerFiles, async (files) => {
  const f: FeatureCollection<LineString | MultiLineString> = {
    type: 'FeatureCollection',
    features: [],
  };
  let i = 0;
  for (const {
    file: { file, inferredType },
    type: fileType,
  } of files) {
    if (inferredType === 'mp4') {
      f.features.push(await mp4ToGeoJson(file));
      continue;
    }
    const value = JSON.parse(await file.text());
    f.features.push(
      ...(value.type === 'Topology'
        ? features(value)
        : (value as FeatureCollection)
      ).features.filter((f): f is Feature<LineString | MultiLineString> => {
        const {
          geometry: { type },
        } = f;
        let { properties } = f;
        // TODO don't do this in filter
        if (!properties) {
          properties = f.properties = {};
        }
        properties.everywhereFeatureIndex = i++;
        if (type === 'LineString' || type === 'MultiLineString') {
          return (
            fileType !== 'osm' ||
            Object.prototype.hasOwnProperty.call(
              highwayLevels,
              properties?.highway
            )
          );
        } else {
          return type === 'Point';
        }
      })
    );
  }

  tileIndex = geojsonvt(f, { maxZoom: 24 });
  featureTree = tree(f);
});

channel.handle(getTile, ({ z, x, y }) => tileIndex?.getTile(z, x, y));

channel.handle(renderTileInWorker, ({ size, coords: { z, x, y }, opts }) => {
  const tile = tileIndex?.getTile(z, x, y);
  if (tile) {
    const offscreen = new OffscreenCanvas(size, size);
    drawTile2(offscreen, tile, z, opts);
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
