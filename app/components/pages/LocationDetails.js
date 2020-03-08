import React from 'react';
import createReactClass from 'create-react-class';
import { Link } from 'react-router-dom';
import { withRouter } from 'react-router';
import { useHistory } from 'react-router-dom';

import * as format from '../../format';
import { findNearbyVideos } from '../../videos';
import { wayTree, group } from '../../ways';
import { featureCollection } from '../../geo';

import MapComponent from '../Map';
import Dot from '../Dot';
import Ways from '../Ways';
import TripList from '../TripList';

export default function LocationDetails({ location, tripTree, videoTree }) {
  let history = useHistory();

  function onClick({ geo }) {
    history.push(`/locations/${geo.join(',')}`);
  }

  const maxDistance = 0.0000005;

  const nearbyWays = wayTree.within(location, maxDistance).map(
    ({
      node: {
        data: { feature },
      },
    }) => feature
  );
  const nearbyGroupedWays = group(nearbyWays);
  const nearbyTrips = Array.from(
    new Set(
      tripTree.within(location, maxDistance).map(
        ({
          node: {
            data: { feature },
          },
        }) => feature
      )
    )
  );

  const nearbyVideos = findNearbyVideos(videoTree, location, maxDistance);

  return (
    <div>
      <h1>{location.join(', ')}</h1>
      <MapComponent width={1000} height={1000} onClick={onClick}>
        {() => [
          <Ways features={nearbyWays} selected={true} />,
          <Dot r={4} className="position" position={location} />,
        ]}
      </MapComponent>
      <h2>Videos</h2>
      <div className="thumbnails">
        {nearbyVideos.map(
          ({ video: { name, duration, start, thumbnail }, time }) => (
            <div key={name}>
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
            </div>
          )
        )}
      </div>
      <h2>Trips</h2>
      <TripList trips={nearbyTrips} />
      <h2>Streets</h2>
      <div className="thumbnails">
        {nearbyGroupedWays.map(way => (
          <div key={way.displayName}>
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
          </div>
        ))}
      </div>
    </div>
  );
}
