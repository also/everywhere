import { Link } from 'react-router-dom';

import { featureCollection } from '../../geo';

import PageTitle from '../PageTitle';
import MapComponent from '../stylized/Map';
import Ways from '../stylized/Ways';
import WayListColumns from '../WayListColumns';
import MapBox from '../MapBox';
import Table from '../Table';
import { GroupedWays } from '../../ways';
import StandardPage from '../StandardPage';

export default function WayDetails({ way }: { way: GroupedWays }) {
  const intersections: Set<string> = new Set();

  way.features.forEach((feat) => {
    feat.properties.intersections.forEach((intersection) => {
      intersection.properties.ways.forEach((iway) =>
        intersections.add(iway.properties.displayName)
      );
    });
  });

  intersections.delete(way.displayName);

  return (
    <StandardPage>
      <PageTitle>{way.displayName}</PageTitle>
      <MapBox>
        <MapComponent
          width={400}
          height={400}
          zoomFeature={featureCollection(way.features)}
          zoom={0.7}
        >
          <Ways features={way.features} selected={true} />
        </MapComponent>
      </MapBox>

      <h2>Intersections</h2>
      <WayListColumns>
        {Array.from(intersections)
          .sort()
          .map((int) => (
            <li key={int}>
              <Link to={`/ways/${int}`}>{int}</Link>
            </li>
          ))}
      </WayListColumns>

      <h2>OpenStreetMap Ways</h2>
      <Table>
        <thead>
          <tr>
            <th>Name</th>
            <th>Type</th>
            <th>One Way</th>
            <th>ID</th>
          </tr>
        </thead>
        <tbody>
          {way.features.map((f) => (
            <tr key={f.properties.id}>
              <td>
                <a href={`https://www.openstreetmap.org/${f.properties.id}`}>
                  {f.properties.displayName}
                </a>
              </td>
              <td>{f.properties.highway}</td>
              <td>{f.properties.oneway}</td>
              <td>{f.properties.id}</td>
            </tr>
          ))}
        </tbody>
      </Table>
    </StandardPage>
  );
}
