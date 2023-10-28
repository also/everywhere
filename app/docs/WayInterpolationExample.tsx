import { useContext } from 'react';
import DataContext from '../components/DataContext';
import MapComponent from '../components/Map';
import MapContext from '../components/MapContext';
import Ways from '../components/Ways';
import { positionDistance } from '../distance';
import { GoodPosition, interpolateLineRange } from '../interpolate-lines';

function Coordinates({ coordinates }: { coordinates: GoodPosition[] }) {
  const { projection } = useContext(MapContext);
  return (
    <g>
      {coordinates.map((position, i) => {
        const [x, y] = projection(position);
        return <circle key={i} cx={x} cy={y} r={4} />;
      })}
    </g>
  );
}

export default function WayInterpolationExample() {
  const way = useContext(DataContext).ways.features.find(
    (w) => w.properties.id === 'way/9430174'
  );

  if (!way) {
    return null;
  }

  const lines =
    way.geometry.type === 'LineString'
      ? [way.geometry.coordinates]
      : way.geometry.coordinates;

  const interpolatedLines = lines.map((coordinates) => [
    ...interpolateLineRange(coordinates, 50, positionDistance, 100).map(
      ({ point }) => point
    ),
  ]);

  return (
    <MapComponent width={500} height={500} zoomFeature={way}>
      <Ways features={[way]} selected={true} />
      {interpolatedLines.map((coordinates, i) => (
        <Coordinates key={i} coordinates={coordinates} />
      ))}
    </MapComponent>
  );
}
