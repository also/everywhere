import { useContext } from 'react';
import DataSetContext from '../components/DataSetContext';
import LeafletMap from '../components/LeafletMap';

export default function LeafletMapExample({
  data,
}: {
  data: 'trips' | 'videoCoverage';
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
      <LeafletMap features={dataset[data]} />
    </div>
  );
}
