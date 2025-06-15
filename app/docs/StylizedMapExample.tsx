import { useContext } from 'react';
import DataSetContext from '../components/DataSetContext';
import MapComponent from '../components/stylized/Map';
import Trips from '../components/Trips';
import { StravaTripFeature } from '../trips';
import {
  DataSetFeatureExtractor,
  extractFeaturesFromDataSet,
} from './dataset-utils';

export default function StylizedMapExample({
  data,
}: {
  data: DataSetFeatureExtractor<StravaTripFeature>;
}) {
  const dataset = useContext(DataSetContext);

  const trips = extractFeaturesFromDataSet(dataset, data) ?? [];

  return (
    <MapComponent width={500} height={500}>
      <Trips trips={trips} />
    </MapComponent>
  );
}
