import { WorkerChannel, workerHandshake } from './WorkerChannel';

import geojsonvt, { GeoJSONVT } from 'geojson-vt';
import {
  getTile,
  lookup,
  renderFeatureTileInWorker,
  renderTileInWorker,
  setWorkerFile,
} from './worker-stuff';
import { LineRTree, features, nearestLine, tree } from './geo';
import { drawDistanceTile, drawTile2 } from './tile-drawing';
import {
  Feature,
  FeatureCollection,
  GeoJsonProperties,
  LineString,
  MultiLineString,
} from 'geojson';
import { highwayLevels } from './osm';

// https://github.com/Microsoft/TypeScript/issues/20595
// self is a WorkerGlobalScope, but TypeScript doesn't know that
const ctx: Worker = self as any;

const channel = new WorkerChannel(ctx.postMessage.bind(ctx), ctx);

channel.handle(workerHandshake, () => 'pong');

let file: File | undefined = undefined;
let tileIndex: GeoJSONVT | undefined = undefined;

let featureTree:
  | LineRTree<Feature<LineString | MultiLineString, GeoJsonProperties>>
  | undefined = undefined;

channel.handle(setWorkerFile, async ({ file: f, type: fileType }) => {
  file = f;
  if (file) {
    const value = JSON.parse(await file.text());
    const f: FeatureCollection<LineString | MultiLineString> = {
      type: 'FeatureCollection',
      features: (value.type === 'Topology'
        ? features(value)
        : (value as FeatureCollection)
      ).features.filter((f): f is Feature<LineString | MultiLineString> => {
        const {
          geometry: { type },
          properties,
        } = f;
        if (type === 'LineString' || type === 'MultiLineString') {
          return (
            fileType !== 'osm' ||
            Object.prototype.hasOwnProperty.call(
              highwayLevels,
              properties?.highway
            )
          );
        } else {
          return false;
        }
      }),
    };

    tileIndex = geojsonvt(f, { maxZoom: 24 });
    featureTree = tree({
      type: 'FeatureCollection',
      features: f.features,
    });
  }
});

channel.handle(getTile, ({ z, x, y }) => tileIndex?.getTile(z, x, y));

channel.handle(renderTileInWorker, ({ canvas, coords: { z, x, y }, opts }) => {
  const tile = tileIndex?.getTile(z, x, y);
  if (tile) {
    drawTile2(canvas, tile, z, opts);
  }
});

channel.handle(
  renderFeatureTileInWorker,
  ({ canvas, coords: { z, x, y }, opts }) => {
    console.time('drawDistanceTile');
    drawDistanceTile(canvas, { z, x, y }, featureTree);
    console.timeEnd('drawDistanceTile');
  }
);

channel.handle(lookup, ({ coords }) => {
  const result = nearestLine(featureTree!, coords);
  return result
    ? { feature: result.item.data, distance: result.distance }
    : undefined;
});
