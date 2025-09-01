import { getJsonFromFile, Tool } from '.';
import { features } from '../geo';

const geojsonTypes = new Set([
  'Feature',
  'FeatureCollection',
  'Point',
  'MultiPoint',
  'LineString',
  'MultiLineString',
  'Polygon',
  'MultiPolygon',
  'Topology',
]);

const geojsonTool: Tool = {
  couldProcessFileByExtension(extension) {
    return extension === 'geojson'
      ? 'yes'
      : extension === 'json'
        ? 'maybe'
        : 'no';
  },
  couldProcessFileByJson(json) {
    // TODO more precise check?
    return geojsonTypes.has(json.type) ? 'yes' : 'no';
  },
  async processFile(file) {
    // TODO this osm filtering code was hanging around in the old code
    // Object.prototype.hasOwnProperty.call(
    //     highwayLevels,
    //     feature.properties?.highway
    //   )
    const result = await getJsonFromFile(file);
    if (result.type === 'Topology') {
      return features(result);
    } else {
      return result;
    }
  },
};

export default geojsonTool;
