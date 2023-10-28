import { useContext } from 'react';
import TinyQueue from 'tinyqueue';
import DataContext from '../components/DataContext';
import { geometryLength } from '../distance';

export default function WayPointRatioExample() {
  const { ways } = useContext(DataContext);

  // a heap isn't especially helpful here, just a simple API I copy/pasted
  const wayHeap = new TinyQueue<{
    feat: typeof ways.features[0];
    ratio: number;
    length: number;
  }>([], (a, b) => b.ratio - a.ratio);

  // find the way with the fewest segments per meter
  for (const way of ways.features) {
    const length = geometryLength(way.geometry) || 0;
    if (length !== 0) {
      const metersPerSegment = length / (way.geometry.coordinates.length - 1);
      wayHeap.push({ feat: way, ratio: metersPerSegment, length });
    }
  }

  const result = [];
  for (let i = 0; i < 5; i++) {
    const longest = wayHeap.pop();
    if (!longest) {
      break;
    }
    result.push(longest);
  }

  return (
    <>
      {result.map(({ feat: way, length, ratio }) => (
        <div key={way.properties.id}>
          <p>
            <strong>
              Way:{' '}
              <a href={`https://www.openstreetmap.org/${way.properties.id}`}>
                {way.properties.id} {way.properties.displayName}
              </a>
            </strong>
          </p>
          <p>Points: {way.geometry.coordinates.length}</p>
          <p>Length: {length.toLocaleString()} meters</p>
          <p>Points per meter: {ratio.toLocaleString()}</p>
        </div>
      ))}
    </>
  );
}
