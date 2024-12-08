import { FeatureCollection } from 'geojson';
import { isProbablyStravaCompleteActivity, mp4ToGeoJson } from '../file-data';
import { features } from '../geo';
import { highwayLevels } from '../osm';
import { ToolFunction } from '.';
import { completeActivityToGeoJson } from '../../tools/strava';

const anythingTool: ToolFunction = async ({
  file: { file, inferredType },
  type: fileType,
}) => {
  if (inferredType === 'mp4') {
    return mp4ToGeoJson(file);
  }
  const value = JSON.parse(await file.text());

  const collection: FeatureCollection = {
    type: 'FeatureCollection',
    features: [],
  };

  if (isProbablyStravaCompleteActivity(value)) {
    const feature = completeActivityToGeoJson(value);
    if (feature) {
      collection.features.push();
      return collection;
    }
  }

  for (const f of value.type === 'Feature'
    ? [value]
    : value.type === 'Topology'
    ? features(value).features
    : (value as FeatureCollection).features) {
    if (
      f.geometry.type === 'LineString' ||
      f.geometry.type === 'MultiLineString'
    ) {
      if (
        fileType !== 'osm' ||
        Object.prototype.hasOwnProperty.call(
          highwayLevels,
          f.properties?.highway
        )
      ) {
        collection.features.push(f);
      }
    } else if (f.geometry.type === 'Point') {
      collection.features.push(f);
    }
  }

  return collection;
};

export default anythingTool;
