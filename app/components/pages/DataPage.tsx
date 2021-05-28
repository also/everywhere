import { useContext } from 'react';
import { Link } from 'react-router-dom';
import { TripFeature } from '../../trips';
import DataSetContext from '../DataSetContext';

function GeometryInfo({ geometry: g }: { geometry: TripFeature['geometry'] }) {
  return g.type === 'MultiLineString' ? (
    <>
      {g.coordinates.reduce((s, c) => s + c.length, 0).toLocaleString()}{' '}
      coordinates, {g.coordinates.length} segments
    </>
  ) : (
    <>{g.coordinates.length.toLocaleString()} coordinates</>
  );
}

export default function DataPage() {
  const { trips } = useContext(DataSetContext);

  return (
    <table>
      <thead>
        <tr>
          <th>Trip ID</th>
          <th>Type</th>
        </tr>
      </thead>
      <tbody>
        {trips.map((t) => (
          <tr key={t.properties.id}>
            <td>
              <Link to={`/trips/${t.id}`}>{t.properties.id}</Link>
            </td>
            <td>{t.type}</td>
            <td>
              <GeometryInfo geometry={t.geometry} />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
