import { WorkerChannel, workerHandshake } from './WorkerChannel';

import geojsonvt from 'geojson-vt';
import {
  getTile,
  lookup,
  renderTileInWorker,
  setWorkerFile,
} from './worker-stuff';
import { features } from './geo';
import { drawTile2 } from './vector-tiles';
import { tree } from './geo';
import {
  Feature,
  FeatureCollection,
  GeoJsonProperties,
  LineString,
  MultiLineString,
} from 'geojson';
import { Node } from './tree';
import { highwayLevels } from './osm';

const channel = new WorkerChannel(self.postMessage.bind(self), self);
channel.handle(workerHandshake, () => 'pong');

let file: File | undefined = undefined;
let tileIndex: any = undefined;
let featureTree:
  | Node<Feature<LineString | MultiLineString, GeoJsonProperties>>
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

channel.handle(
  renderTileInWorker,
  ({ canvas, coords: { z, x, y }, selectedId }) => {
  const tile = tileIndex?.getTile(z, x, y);
  if (tile) {
      drawTile2(canvas, tile, z, selectedId);
  }
  }
);

channel.handle(lookup, ({ coords }) => {
  const result = featureTree?.nearest(coords)?.data;
  return result;
});
