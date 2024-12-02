import { useContext, useMemo } from 'react';
import DataSetContext from '../components/DataSetContext';
import { LeafletFeatureMap } from '../components/LeafletMap';
import {
  DataSetFeatureExtractor,
  extractFeaturesFromDataSet,
} from './dataset-utils';

export default function LeafletMapExample({
  data,
  zoom,
  center,
}: {
  data?: 'trips' | 'videoCoverage' | DataSetFeatureExtractor;
  zoom?: number;
  center?: [number, number];
}) {
  const dataset = useContext(DataSetContext);

  const features = useMemo(() => {
    if (typeof data === 'function') {
      return extractFeaturesFromDataSet(dataset, data);
    }
    return data ? dataset[data] : undefined;
  }, [data, dataset]);

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        width: 500,
        height: 300,
      }}
    >
      <LeafletFeatureMap
        features={features ?? []}
        center={center}
        zoom={zoom}
      />
    </div>
  );
}
