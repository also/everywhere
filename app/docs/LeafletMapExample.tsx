import { useContext, useMemo } from 'react';
import DataSetContext from '../components/DataSetContext';
import LeafletMap from '../components/LeafletMap';
import { DataSet } from '../data';

export default function LeafletMapExample({
  data,
  zoom,
  center,
}: {
  data?:
    | 'trips'
    | 'videoCoverage'
    | ((dataset: DataSet) => GeoJSON.Feature[] | GeoJSON.Feature | undefined);
  zoom?: number;
  center?: [number, number];
}) {
  const dataset = useContext(DataSetContext);

  const features = useMemo(() => {
    if (typeof data === 'function') {
      const result = data(dataset);
      return result && !Array.isArray(result) ? [result] : result;
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
      <LeafletMap features={features} center={center} zoom={zoom} />
    </div>
  );
}
