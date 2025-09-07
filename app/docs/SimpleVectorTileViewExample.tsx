import { useContext } from 'react';
import DataSetContext from '../components/DataSetContext';
import { StravaTripFeature } from '../trips';
import {
  DataSetFeatureExtractor,
  extractFeaturesFromDataSet,
} from './dataset-utils';
import { SimpleVectorTileView } from '../components/pages/data/DataExplorer';

export default function SimpleVectorTileViewExample({
  data,
}: {
  data: DataSetFeatureExtractor<StravaTripFeature>;
}) {
  const dataset = useContext(DataSetContext);

  const trips = extractFeaturesFromDataSet(dataset, data) ?? [];

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        width: 500,
        height: 300,
      }}
    >
      <SimpleVectorTileView
        features={trips.map((f) => ({
          ...f,
          properties: { type: 'strava-trip' },
        }))}
      />
    </div>
  );
}
