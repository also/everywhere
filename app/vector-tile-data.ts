import geojsonvt from 'geojson-vt';
import { features, tree } from './geo';
import { FeatureCollection } from 'geojson';
import { highwayLevels } from './osm';
import { FileWithDetails, mp4ToGeoJson } from './file-data';

export async function loadTileDataFromFiles(
  files: { file: FileWithDetails; type: 'osm' | 'generic' }[]
) {
  const collection: FeatureCollection = {
    type: 'FeatureCollection',
    features: [],
  };
  let i = 0;
  for (const {
    file: { file, inferredType },
    type: fileType,
  } of files) {
    if (inferredType === 'mp4') {
      collection.features.push(await mp4ToGeoJson(file));
      continue;
    }
    const value = JSON.parse(await file.text());

    for (const f of (value.type === 'Topology'
      ? features(value)
      : (value as FeatureCollection)
    ).features) {
      let { properties } = f;
      if (!properties) {
        properties = f.properties = {};
      }
      properties.everywhereFeatureIndex = i++;
      if (
        f.geometry.type === 'LineString' ||
        f.geometry.type === 'MultiLineString'
      ) {
        if (
          fileType !== 'osm' ||
          Object.prototype.hasOwnProperty.call(
            highwayLevels,
            properties?.highway
          )
        ) {
          collection.features.push(f);
        }
      } else if (f.geometry.type === 'Point') {
        collection.features.push(f);
      }
    }
  }

  return {
    tileIndex: geojsonvt(collection, { maxZoom: 24 }),
    featureTree: tree(collection),
  };
}
