import { useContext } from 'react';
import DataSetContext from '../components/DataSetContext';
import LeafletMap from '../components/LeafletMap';

export default function LeafletMapExample({
  data,
  zoom,
  center,
}: {
  data?: 'trips' | 'videoCoverage';
  zoom?: number;
  center?: [number, number];
}) {
  const dataset = useContext(DataSetContext);

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        width: 500,
        height: 300,
      }}
    >
      <LeafletMap
        features={data ? dataset[data] : undefined}
        center={center}
        zoom={zoom}
      />
    </div>
  );
}
