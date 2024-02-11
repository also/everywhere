import { Feature } from 'geojson';
import { DataSet } from '../data';

export type DataSetFeatureExtractor<T extends Feature = Feature> = (
  dataset: DataSet
) => T[] | T | undefined;

export function extractFeaturesFromDataSet<T extends Feature>(
  dataSet: DataSet,
  extract: DataSetFeatureExtractor<T>
): T[] | undefined {
  const result = extract(dataSet);
  return result && !Array.isArray(result) ? [result] : result;
}
