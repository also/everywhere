import { DataSet } from '../data';

export type DataSetFeatureExtractor<
  T extends GeoJSON.Feature = GeoJSON.Feature
> = (dataset: DataSet) => T[] | T | undefined;

export function extractFeaturesFromDataSet<T extends GeoJSON.Feature>(
  dataSet: DataSet,
  extract: DataSetFeatureExtractor<T>
): T[] | undefined {
  const result = extract(dataSet);
  return result && !Array.isArray(result) ? [result] : result;
}
