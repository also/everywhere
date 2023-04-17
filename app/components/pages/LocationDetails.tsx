import { Link } from 'react-router-dom';
import { useHistory } from 'react-router-dom';

import * as format from '../../format';
import { CoverageTree, findNearbyVideos } from '../../videos';
import { wayTree, group } from '../../ways';
import { featureCollection, lineSegmentsWithinDistance } from '../../geo';

import StandardPage from '../StandardPage';
import PageTitle from '../PageTitle';
import Thumbnails from '../Thumbnails';
import Thumbnail from '../Thumbnail';
import MapComponent from '../Map';
import Dot from '../Dot';
import Ways from '../Ways';
import TripList from '../TripList';
import { StravaTripFeature, TripTree } from '../../trips';
import { Position } from 'geojson';

export default function LocationDetails({
  location,
  tripTree,
  videoTree,
}: {
  location: Position;
  tripTree: TripTree;
  videoTree: CoverageTree;
}) {
  const history = useHistory();

  function onClick({ geo }: { geo: [number, number] }) {
    history.push(`/locations/${geo.join(',')}`);
  }

  const maxDistance = 40;

  const nearbyWays = lineSegmentsWithinDistance(
    wayTree,
    location,
    maxDistance
  ).map(({ item: { data } }) => data);
  const nearbyGroupedWays = group(nearbyWays);
  const nearbyTrips: StravaTripFeature[] = Array.from(
    new Set(
      lineSegmentsWithinDistance(tripTree, location, maxDistance).map(
        ({ item: { data } }) => data
      )
    )
  );

  const nearbyVideos = findNearbyVideos(videoTree, location, maxDistance);

  return (
    <StandardPage>
      <PageTitle>{location.join(', ')}</PageTitle>
      <MapComponent width={1000} height={1000} onClick={onClick}>
        <Ways features={nearbyWays} selected={true} />
        {/* @ts-expect-error Position isn't a tuple for some reason */}
        <Dot r={4} className="position" position={location} />
      </MapComponent>
      <h2>Videos</h2>
      <Thumbnails>
        {nearbyVideos.map(
          ({ video: { name, duration, start, thumbnail }, time }) => (
            <Thumbnail key={name}>
              <Link to={`/videos/${name}/${time}`}>
                <div>
                  <img src={thumbnail.small} width="160" height="90" />
                </div>
                <div>
                  <strong>{start.format('LLL')}</strong>
                </div>
                <div>
                  {format.duration(duration)}{' '}
                  <span className="name">{name}</span>
                </div>
              </Link>
            </Thumbnail>
          )
        )}
      </Thumbnails>
      <h2>Trips</h2>
      <TripList trips={nearbyTrips} />
      <h2>Streets</h2>
      <Thumbnails>
        {nearbyGroupedWays.map((way) => (
          <Thumbnail key={way.displayName}>
            <Link to={`/ways/${way.displayName}`}>
              <MapComponent
                width={160}
                height={160}
                zoomFeature={featureCollection(way.features)}
              >
                {() => <Ways features={way.features} selected={true} />}
              </MapComponent>
              <div>
                <strong>{way.displayName}</strong>
              </div>
            </Link>
          </Thumbnail>
        ))}
      </Thumbnails>
    </StandardPage>
  );
}
